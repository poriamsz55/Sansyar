import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Eye,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  User,
  Phone,
  Building2,
  Banknote,
  Clock,
  History,
  ShieldCheck,
  ShieldX,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/PageTransition";
import { toast } from "@/components/Toast";
import RejectDialog from "@/components/admin/RejectDialog";
import {
  adminListBookings,
  adminGetBooking,
  adminConfirmBooking,
  adminCancelBooking,
  approveCancelBooking,
  rejectCancelBooking,
} from "@/api/endpoints";
import { BOOKING_STATUS, PAYMENT_STATUS, PAYMENT_TYPE } from "@/lib/constants";
import { toFa, formatToman, formatJalaliDate, formatTime } from "@/lib/utils";

const TIMELINE_LABELS = {
  created: "ایجاد رزرو",
  confirmed: "تأیید رزرو",
  cancelled_by_user: "لغو توسط مشتری",
  cancelled_by_admin: "لغو توسط مدیر",
  cancellation_requested: "درخواست لغو توسط مجموعه",
  cancellation_approved: "لغو تأیید شد",
  cancellation_rejected: "درخواست لغو رد شد",
};

export default function PlatformBookings() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ status: "", payment_status: "", from: "", to: "", q: "" });
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState(null);
  const [cancelId, setCancelId] = useState(null);
  const [rejectCancelId, setRejectCancelId] = useState(null);

  const limit = 15;

  async function load() {
    setData(null);
    try {
      const res = await adminListBookings({ ...filters, page, limit });
      setData(res);
    } catch (err) {
      toast(err.message, "error");
      setData({ items: [], total: 0, page: 1, limit });
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  function setFilter(key, value) {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  }

  async function confirmBooking(id) {
    try {
      await adminConfirmBooking(id);
      toast("رزرو تأیید شد");
      setDetailId(null);
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function cancelBooking(reason) {
    try {
      await adminCancelBooking(cancelId, reason);
      toast("رزرو لغو شد");
      setDetailId(null);
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function approveCancel(id) {
    try {
      await approveCancelBooking(id);
      toast("درخواست لغو تأیید و رزرو لغو شد");
      setDetailId(null);
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function rejectCancel(reason) {
    try {
      await rejectCancelBooking(rejectCancelId, reason);
      toast("درخواست لغو رد شد و رزرو تأییدشده باقی ماند");
      setDetailId(null);
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex-1 min-w-[12rem]">
            <label className="mb-1 block text-xs text-muted-foreground">جستجو (کد، مشتری، مجموعه)</label>
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={filters.q} onChange={(e) => setFilter("q", e.target.value)} placeholder="جستجو…" className="pr-10" />
            </div>
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs text-muted-foreground">وضعیت</label>
            <Select value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
              <option value="">همه</option>
              {Object.entries(BOOKING_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs text-muted-foreground">وضعیت پرداخت</label>
            <Select value={filters.payment_status} onChange={(e) => setFilter("payment_status", e.target.value)}>
              <option value="">همه</option>
              {Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">از تاریخ</label>
            <Input type="date" dir="ltr" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">تا تاریخ</label>
            <Input type="date" dir="ltr" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="px-0 py-0">
          {!data ? (
            <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : data.items.length === 0 ? (
            <div className="p-6"><EmptyState icon={Search} title="رزروی با این فیلترها یافت نشد" /></div>
          ) : (
            <Table>
              <THead>
                <TR><TH>کد</TH><TH>مشتری</TH><TH>مجموعه / سالن</TH><TH>تاریخ</TH><TH>مبلغ</TH><TH>وضعیت</TH><TH>پرداخت</TH><TH>عملیات</TH></TR>
              </THead>
              <TBody>
                {data.items.map((b) => (
                  <TR key={b.id}>
                    <TD className="font-mono text-xs">{b.id.slice(-6)}</TD>
                    <TD>
                      <span className="font-medium">{b.customer_name || "—"}</span>
                      <span className="block font-mono text-xs text-muted-foreground" dir="ltr">{toFa(b.customer_phone || "")}</span>
                    </TD>
                    <TD>
                      <span className="font-medium">{b.complex_name || "—"}</span>
                      <span className="block text-xs text-muted-foreground">{b.hall_name || "—"}</span>
                    </TD>
                    <TD className="text-muted-foreground">
                      {formatJalaliDate(b.starts_at)}
                      <span className="block tnum text-xs">{formatTime(b.starts_at)}</span>
                    </TD>
                    <TD className="font-semibold">{formatToman(b.final_amount)}</TD>
                    <TD><StatusBadge kind="booking" status={b.status} /></TD>
                    <TD><StatusBadge kind="payment" status={b.payment_status} /></TD>
                    <TD>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setDetailId(b.id)}><Eye className="h-3.5 w-3.5" /></Button>
                        {b.status === "awaiting_payment" && (
                          <Button size="sm" variant="success" onClick={() => confirmBooking(b.id)}><CheckCircle2 className="h-3.5 w-3.5" /></Button>
                        )}
                        {["confirmed", "awaiting_payment", "pending"].includes(b.status) && (
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => setCancelId(b.id)}><XCircle className="h-3.5 w-3.5" /></Button>
                        )}
                        {b.status === "cancellation_requested" && (
                          <>
                            <Button size="sm" variant="success" title="تأیید لغو" onClick={() => approveCancel(b.id)}><ShieldCheck className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="outline" className="text-destructive" title="رد درخواست لغو" onClick={() => setRejectCancelId(b.id)}><ShieldX className="h-3.5 w-3.5" /></Button>
                          </>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.total > limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{toFa(data.total)} رزرو</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronRight className="h-4 w-4" /> قبلی
            </Button>
            <span className="text-sm">صفحه {toFa(page)} از {toFa(totalPages)}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              بعدی <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {detailId && (
        <BookingDetail
          id={detailId}
          onClose={() => setDetailId(null)}
          onConfirm={confirmBooking}
          onCancel={(id) => setCancelId(id)}
          onApproveCancel={approveCancel}
          onRejectCancel={(id) => setRejectCancelId(id)}
        />
      )}
      <RejectDialog open={!!cancelId} onClose={() => setCancelId(null)} onConfirm={cancelBooking} title="لغو رزرو" />
      <RejectDialog open={!!rejectCancelId} onClose={() => setRejectCancelId(null)} onConfirm={rejectCancel} title="رد درخواست لغو" />
    </div>
  );
}

function BookingDetail({ id, onClose, onConfirm, onCancel, onApproveCancel, onRejectCancel }) {
  const [b, setB] = useState(null);
  useEffect(() => {
    adminGetBooking(id).then(setB).catch(() => setB(false));
  }, [id]);

  return (
    <Dialog open onClose={onClose} wide title="جزئیات رزرو" description={b ? `کد ${b.id.slice(-6)}` : undefined}>
      {!b ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="booking" status={b.status} />
            <StatusBadge kind="payment" status={b.payment_status} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Section title="مشتری">
              <Field icon={User} label="نام" value={b.customer?.full_name || b.customer_name || "—"} />
              <Field icon={Phone} label="تلفن" value={toFa(b.customer?.phone || b.customer_phone || "")} ltr />
            </Section>
            <Section title="مجموعه و سالن">
              <Field icon={Building2} label="مجموعه" value={b.complex_name || "—"} />
              <Field icon={Building2} label="سالن" value={b.hall_name || "—"} />
              <Field icon={Clock} label="زمان" value={`${formatJalaliDate(b.starts_at)} ${formatTime(b.starts_at)} - ${formatTime(b.ends_at)}`} />
            </Section>
          </div>

          <Section title="پرداخت و مبلغ">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field icon={Banknote} label="قیمت پایه" value={`${formatToman(b.price)} ت`} />
              <Field icon={Banknote} label="تخفیف" value={`${toFa(b.discount || 0)}٪`} />
              <Field icon={Banknote} label="مبلغ نهایی" value={`${formatToman(b.final_amount)} ت`} />
              <Field icon={Banknote} label="نوع پرداخت" value={PAYMENT_TYPE[b.payment_type] || b.payment_type} />
              {b.deposit_amount > 0 && <Field icon={Banknote} label="بیعانه" value={`${formatToman(b.deposit_amount)} ت`} />}
              {b.refund_amount > 0 && <Field icon={Banknote} label="بازپرداخت" value={`${formatToman(b.refund_amount)} ت`} />}
              {b.coupon_code && <Field icon={Banknote} label="کد تخفیف" value={b.coupon_code} />}
            </div>
            {b.payments?.length > 0 && (
              <div className="mt-2 space-y-1">
                {b.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-xs">
                    <span>{p.provider || "—"} · {formatToman(p.amount)} ت</span>
                    <StatusBadge kind="payment" status={p.status} />
                  </div>
                ))}
              </div>
            )}
          </Section>

          {(b.cancellation_reason || b.notes) && (
            <Section title="یادداشت‌ها">
              {b.cancellation_reason && <p className="text-sm text-destructive">دلیل لغو: {b.cancellation_reason}</p>}
              {b.notes && <p className="text-sm text-muted-foreground">{b.notes}</p>}
            </Section>
          )}

          {/* Timeline / audit */}
          <Section title="تاریخچه و رویدادها">
            {b.timeline?.length ? (
              <ul className="space-y-2">
                {b.timeline.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <History className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <span className="font-medium">{TIMELINE_LABELS[t.action] || t.action}</span>
                      {t.note && <span className="text-muted-foreground"> — {t.note}</span>}
                      <span className="block text-[11px] text-muted-foreground">{formatJalaliDate(t.at)} - {formatTime(t.at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">رویدادی ثبت نشده است.</p>
            )}
          </Section>

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={onClose}>بستن</Button>
            {b.status === "awaiting_payment" && (
              <Button variant="success" onClick={() => onConfirm(b.id)}><CheckCircle2 className="h-4 w-4" /> تأیید</Button>
            )}
            {["confirmed", "awaiting_payment", "pending"].includes(b.status) && (
              <Button variant="destructive" onClick={() => onCancel(b.id)}><XCircle className="h-4 w-4" /> لغو رزرو</Button>
            )}
            {b.status === "cancellation_requested" && (
              <>
                <Button variant="outline" className="text-destructive" onClick={() => onRejectCancel(b.id)}>
                  <ShieldX className="h-4 w-4" /> رد درخواست لغو
                </Button>
                <Button variant="success" onClick={() => onApproveCancel(b.id)}>
                  <ShieldCheck className="h-4 w-4" /> تأیید لغو
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ icon: Icon, label, value, ltr }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</div>
      <div className="mt-0.5 text-sm font-medium" dir={ltr ? "ltr" : undefined}>{value}</div>
    </div>
  );
}
