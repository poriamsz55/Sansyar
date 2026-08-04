import { useEffect, useMemo, useState } from "react";
import { Ticket, Eye, Ban, Clock, Banknote, History, Building2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner, Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/PageTransition";
import { toast } from "@/components/Toast";
import { listOwnerBookings, loadVenueLookups, requestCancelBooking } from "@/api/endpoints";
import { useSportsMap } from "@/hooks/useSportsMap";
import { PAYMENT_TYPE } from "@/lib/constants";
import { formatToman, toFa, formatJalaliDate, formatTime, formatTimeRange, cn } from "@/lib/utils";

const FILTERS = [
  { value: "all", label: "همه" },
  { value: "confirmed", label: "تأییدشده" },
  { value: "awaiting_payment", label: "در انتظار پرداخت" },
  { value: "cancellation_requested", label: "درخواست لغو" },
  { value: "completed", label: "انجام‌شده" },
  { value: "cancelled_by_user", label: "لغوشده" },
];

const TIMELINE_LABELS = {
  created: "ایجاد رزرو",
  confirmed: "تأیید رزرو",
  cancelled_by_user: "لغو توسط مشتری",
  cancelled_by_admin: "لغو توسط مدیر",
  cancellation_requested: "درخواست لغو توسط مجموعه",
  cancellation_approved: "لغو تأیید شد",
  cancellation_rejected: "درخواست لغو رد شد",
};

export default function OwnerReservations() {
  const sportsMap = useSportsMap();
  const [bookings, setBookings] = useState(null);
  const [filter, setFilter] = useState("all");
  const [lookups, setLookups] = useState({ complexMap: {}, hallMap: {} });
  const [detailId, setDetailId] = useState(null);
  const [cancelId, setCancelId] = useState(null);

  function load() {
    Promise.all([listOwnerBookings(), loadVenueLookups({ owner: true })]).then(([items, maps]) => {
      setLookups(maps);
      setBookings([...items].sort((a, b) => b.created_at.localeCompare(a.created_at)));
    });
  }

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    if (!bookings) return null;
    if (filter === "all") return bookings;
    return bookings.filter((b) => b.status === filter);
  }, [bookings, filter]);

  const detailBooking = bookings?.find((b) => b.id === detailId);

  async function submitCancelRequest(reason) {
    try {
      await requestCancelBooking(cancelId, reason);
      toast("درخواست لغو ثبت شد و برای تأیید مدیر ارشد ارسال شد");
      setDetailId(null);
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = f.value === "all" ? bookings?.length : bookings?.filter((b) => b.status === f.value).length;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                filter === f.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent"
              )}
            >
              {f.label}
              {count != null && <span className="mr-1 text-xs opacity-70">({toFa(count)})</span>}
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="px-0 py-0">
          {!visible ? (
            <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : visible.length === 0 ? (
            <div className="p-6"><EmptyState icon={Ticket} title="رزروی یافت نشد" /></div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>مجموعه / سالن</TH>
                  <TH>ورزش</TH>
                  <TH>تاریخ</TH>
                  <TH>پرداخت</TH>
                  <TH>مبلغ</TH>
                  <TH>وضعیت</TH>
                  <TH>عملیات</TH>
                </TR>
              </THead>
              <TBody>
                {visible.map((b) => (
                  <TR key={b.id}>
                    <TD>
                      <span className="font-medium">{lookups.complexMap[b.complex_id]?.name}</span>
                      <span className="block text-xs text-muted-foreground">{lookups.hallMap[b.hall_id]?.name}</span>
                    </TD>
                    <TD>{sportsMap[b.sport_id]}</TD>
                    <TD className="text-muted-foreground">{formatJalaliDate(b.starts_at)} — {formatTime(b.starts_at)}</TD>
                    <TD className="text-xs">{PAYMENT_TYPE[b.payment_type]}</TD>
                    <TD className="font-semibold">{formatToman(b.final_amount)}</TD>
                    <TD><StatusBadge kind="booking" status={b.status} /></TD>
                    <TD>
                      <Button size="sm" variant="outline" onClick={() => setDetailId(b.id)}>
                        <Eye className="h-3.5 w-3.5" /> جزئیات
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {detailBooking && (
        <BookingDetail
          booking={detailBooking}
          complexName={lookups.complexMap[detailBooking.complex_id]?.name}
          hallName={lookups.hallMap[detailBooking.hall_id]?.name}
          sportName={sportsMap[detailBooking.sport_id]}
          onClose={() => setDetailId(null)}
          onRequestCancel={() => setCancelId(detailBooking.id)}
        />
      )}

      <RequestCancelDialog open={!!cancelId} onClose={() => setCancelId(null)} onConfirm={submitCancelRequest} />
    </div>
  );
}

function BookingDetail({ booking: b, complexName, hallName, sportName, onClose, onRequestCancel }) {
  return (
    <Dialog open onClose={onClose} wide title="جزئیات رزرو" description={`کد ${b.id.slice(-6)}`}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge kind="booking" status={b.status} />
          <StatusBadge kind="payment" status={b.payment_status} />
        </div>

        <Section title="مجموعه و سالن">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field icon={Building2} label="مجموعه" value={complexName || "—"} />
            <Field icon={Building2} label="سالن" value={hallName || "—"} />
            <Field icon={Ticket} label="ورزش" value={sportName || "—"} />
            <Field icon={Clock} label="زمان" value={`${formatJalaliDate(b.starts_at)} — ${formatTimeRange(b.starts_at, b.ends_at)}`} />
          </div>
        </Section>

        <Section title="پرداخت و مبلغ">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field icon={Banknote} label="قیمت پایه" value={`${formatToman(b.price)} ت`} />
            <Field icon={Banknote} label="تخفیف" value={`${toFa(b.discount || 0)}٪`} />
            <Field icon={Banknote} label="مبلغ نهایی" value={`${formatToman(b.final_amount)} ت`} />
            <Field icon={Banknote} label="نوع پرداخت" value={PAYMENT_TYPE[b.payment_type] || b.payment_type} />
            {b.deposit_amount > 0 && <Field icon={Banknote} label="بیعانه پرداختی" value={`${formatToman(b.deposit_amount)} ت`} />}
            {b.remaining_amount > 0 && <Field icon={Banknote} label="مانده پرداخت" value={`${formatToman(b.remaining_amount)} ت`} />}
            {b.refund_amount > 0 && <Field icon={Banknote} label="بازپرداخت" value={`${formatToman(b.refund_amount)} ت`} />}
            {b.coupon_code && <Field icon={Banknote} label="کد تخفیف" value={b.coupon_code} />}
          </div>
        </Section>

        {(b.cancellation_reason || b.notes) && (
          <Section title="یادداشت‌ها">
            {b.cancellation_reason && <p className="text-sm text-destructive">دلیل لغو: {b.cancellation_reason}</p>}
            {b.notes && <p className="text-sm text-muted-foreground">{b.notes}</p>}
          </Section>
        )}

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
          {b.status === "confirmed" && (
            <Button variant="destructive" onClick={onRequestCancel}>
              <Ban className="h-4 w-4" /> درخواست لغو رزرو
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function RequestCancelDialog({ open, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await onConfirm(reason.trim());
      setReason("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="درخواست لغو رزرو"
      description="این رزرو تا زمان تأیید مدیر ارشد پلتفرم لغو نمی‌شود."
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>دلیل درخواست لغو</Label>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثلاً تعمیرات فوری سالن، مشکل فنی و..."
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button type="button" variant="destructive" onClick={submit} disabled={saving}>
            {saving ? <Spinner /> : <Ban className="h-4 w-4" />}
            ثبت درخواست لغو
          </Button>
        </div>
      </div>
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
