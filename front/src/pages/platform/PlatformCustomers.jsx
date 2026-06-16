import { useEffect, useMemo, useState } from "react";
import { Eye, Search, Ticket, Banknote, XCircle, Clock, Heart } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { adminListCustomers, adminGetCustomer } from "@/api/endpoints";
import { toFa, formatToman, formatJalaliDate, formatTime } from "@/lib/utils";

export default function PlatformCustomers() {
  const [customers, setCustomers] = useState(null);
  const [q, setQ] = useState("");
  const [detailId, setDetailId] = useState(null);

  useEffect(() => {
    adminListCustomers().then(setCustomers);
  }, []);

  const visible = useMemo(() => {
    if (!customers) return null;
    if (!q) return customers;
    return customers.filter((c) => `${c.full_name} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));
  }, [customers, q]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{customers ? `${toFa(customers.length)} مشتری` : "..."}</p>
        <div className="relative w-64">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی نام یا تلفن…" className="pr-10" />
        </div>
      </div>

      <Card>
        <CardContent className="px-0 py-0">
          {!visible ? (
            <Skeleton className="m-4 h-48" />
          ) : (
            <Table>
              <THead>
                <TR><TH>نام</TH><TH>تلفن</TH><TH>رزروها</TH><TH>لغوها</TH><TH>آخرین فعالیت</TH><TH>وضعیت</TH><TH>عملیات</TH></TR>
              </THead>
              <TBody>
                {visible.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium">{c.full_name || "—"}</TD>
                    <TD className="font-mono text-sm" dir="ltr">{toFa(c.phone)}</TD>
                    <TD>{toFa(c.booking_count || 0)}</TD>
                    <TD>{toFa(c.cancelled_count || 0)}</TD>
                    <TD className="text-sm text-muted-foreground">{c.last_activity_at ? formatJalaliDate(c.last_activity_at) : "—"}</TD>
                    <TD>
                      <Badge tone={c.status === "active" ? "success" : "destructive"}>
                        {c.status === "active" ? "فعال" : "معلق"}
                      </Badge>
                    </TD>
                    <TD>
                      <Button size="sm" variant="outline" onClick={() => setDetailId(c.id)}>
                        <Eye className="h-3.5 w-3.5" /> پروفایل
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {detailId && <CustomerDetail id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

const BOOKING_FILTERS = [
  { value: "all", label: "همه" },
  { value: "confirmed", label: "تأییدشده" },
  { value: "completed", label: "انجام‌شده" },
  { value: "cancelled", label: "لغوشده" },
];

function CustomerDetail({ id, onClose }) {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    adminGetCustomer(id).then(setData).catch(() => setData(false));
  }, [id]);

  const bookings = useMemo(() => {
    if (!data?.bookings) return [];
    let list = [...data.bookings];
    if (filter === "cancelled") list = list.filter((b) => b.status.startsWith("cancelled") || ["refunded", "partially_refunded", "expired", "no_show"].includes(b.status));
    else if (filter !== "all") list = list.filter((b) => b.status === filter);
    if (q) list = list.filter((b) => `${b.complex_name} ${b.hall_name} ${b.sport_name}`.toLowerCase().includes(q.toLowerCase()));
    list.sort((a, b) =>
      sort === "newest"
        ? b.starts_at.localeCompare(a.starts_at)
        : sort === "oldest"
          ? a.starts_at.localeCompare(b.starts_at)
          : (b.final_amount || 0) - (a.final_amount || 0)
    );
    return list;
  }, [data, filter, q, sort]);

  return (
    <Dialog open onClose={onClose} wide title="پروفایل مشتری" description={data ? data.full_name : undefined}>
      {!data ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="تلفن" value={toFa(data.phone)} ltr />
            <Field label="تاریخ ثبت‌نام" value={formatJalaliDate(data.created_at)} />
            <Field label="آخرین فعالیت" value={data.last_activity_at ? formatJalaliDate(data.last_activity_at) : "—"} />
            <Field label="وضعیت حساب" value={data.status === "active" ? "فعال" : "معلق"} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={Ticket} label="کل رزروها" value={toFa(data.stats?.total || 0)} />
            <Stat icon={Ticket} label="تأییدشده" value={toFa(data.stats?.confirmed || 0)} />
            <Stat icon={XCircle} label="لغوشده" value={toFa(data.stats?.cancelled || 0)} />
            <Stat icon={Banknote} label="مجموع خرید" value={`${formatToman(data.stats?.revenue || 0)} ت`} />
          </div>

          {(data.favorite_venues?.length > 0 || data.favorite_sports?.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {data.favorite_venues?.map((f) => (
                <Badge key={f.id} tone="primary"><Heart className="ml-1 inline h-3 w-3" />{f.name} ({toFa(f.count)})</Badge>
              ))}
              {data.favorite_sports?.map((f) => (
                <Badge key={f.id} tone="muted">{f.name} ({toFa(f.count)})</Badge>
              ))}
            </div>
          )}

          {/* Booking history with filter/sort/search */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold">تاریخچه رزروها ({toFa(bookings.length)})</h3>
              <div className="flex flex-wrap gap-2">
                <div className="relative w-40">
                  <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو…" className="h-9 pr-8 text-sm" />
                </div>
                <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 w-32 text-sm">
                  {BOOKING_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </Select>
                <Select value={sort} onChange={(e) => setSort(e.target.value)} className="h-9 w-32 text-sm">
                  <option value="newest">جدیدترین</option>
                  <option value="oldest">قدیمی‌ترین</option>
                  <option value="amount">بیشترین مبلغ</option>
                </Select>
              </div>
            </div>
            {bookings.length === 0 ? (
              <p className="rounded-lg border border-border p-4 text-center text-sm text-muted-foreground">رزروی یافت نشد.</p>
            ) : (
              <div className="max-h-[40vh] space-y-2 overflow-y-auto">
                {bookings.map((b) => (
                  <div key={b.id} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium">{b.complex_name || "—"} <span className="text-muted-foreground">/ {b.hall_name || "—"}</span></div>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge kind="booking" status={b.status} />
                        <StatusBadge kind="payment" status={b.payment_status} />
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatJalaliDate(b.starts_at)} - {formatTime(b.starts_at)}</span>
                      <span className="font-semibold text-foreground">{formatToman(b.final_amount)} ت</span>
                      {b.discount > 0 && <span className="text-success">{toFa(b.discount)}٪ تخفیف</span>}
                      {b.refund_amount > 0 && <span>بازپرداخت: {formatToman(b.refund_amount)} ت</span>}
                    </div>
                    {b.cancellation_reason && <p className="mt-1 text-xs text-destructive">دلیل لغو: {b.cancellation_reason}</p>}
                    {b.notes && <p className="mt-1 text-xs text-muted-foreground">یادداشت: {b.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className="mt-0.5 text-sm font-bold">{value}</div>
    </div>
  );
}

function Field({ label, value, ltr }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium" dir={ltr ? "ltr" : undefined}>{value}</div>
    </div>
  );
}
