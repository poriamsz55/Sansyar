import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Clock,
  MapPin,
  Building2,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  CreditCard,
  Layers,
  Users,
} from "lucide-react";

import { PageTransition, EmptyState } from "@/components/PageTransition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/skeleton";
import {
  getPendingReservation,
  clearPendingReservation,
  isSlotInTheFuture,
} from "@/lib/reservation";
import { createBooking } from "@/api/endpoints";
import { toast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import {
  cn,
  formatToman,
  toFa,
  formatJalaliDate,
  formatJalaliWeekday,
  formatTimeRange,
} from "@/lib/utils";

export default function Reservation() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [pending, setPending] = useState(undefined);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const p = getPendingReservation();
    if (p?.slot && !isSlotInTheFuture(p.slot)) {
      clearPendingReservation();
      toast("این سانس شروع شده و دیگر قابل رزرو نیست.", "error");
      navigate(p.complex?.id ? `/complexes/${p.complex.id}` : "/complexes", { replace: true });
      setPending(null);
      return;
    }
    setPending(p);
  }, [navigate]);

  async function confirm() {
    if (!isAuthenticated) {
      navigate("/login?redirect=/reservation");
      return;
    }
    setSubmitting(true);
    try {
      // No real payment gateway is wired up yet — simulate the processing
      // delay so a logged-in payment reads as an actual mock payment flow
      // rather than an instant database write.
      await new Promise((r) => setTimeout(r, 900));
      await createBooking({ slot_id: pending.slot.id, payment_type: "full_online" });
      clearPendingReservation();
      navigate("/my-reservations?success=1");
    } catch (err) {
      const m = err?.message || "";
      if (/expired/i.test(m)) {
        toast("این سانس منقضی شده است. لطفاً سانس دیگری انتخاب کنید.", "error");
        clearPendingReservation();
        navigate("/complexes");
      } else if (/full|capacity/i.test(m)) {
        toast("ظرفیت این سانس تکمیل شده است.", "error");
      } else {
        toast(m || "ثبت رزرو با خطا مواجه شد.", "error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (pending === undefined) {
    return (
      <div className="container grid place-items-center py-24">
        <Spinner className="h-6 w-6 text-primary" />
      </div>
    );
  }

  if (!pending) {
    return (
      <PageTransition>
        <div className="container py-16">
          <EmptyState
            icon={CalendarDays}
            title="سانسی انتخاب نشده است"
            description="برای رزرو، ابتدا یک مجموعه و سانس آزاد انتخاب کن."
            action={
              <Button onClick={() => navigate("/complexes")}>مشاهده مجموعه‌ها</Button>
            }
          />
        </div>
      </PageTransition>
    );
  }

  const { complex, hall, slot } = pending;
  const payable = slot.final_price;

  return (
    <PageTransition>
      <div className="container max-w-4xl py-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
          بازگشت
        </button>

        <h1 className="text-2xl font-extrabold">تأیید و پرداخت رزرو</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          جزئیات رزرو را بررسی و پرداخت را نهایی کن.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_340px]">
          {/* Booking details */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>جزئیات سانس</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Detail icon={Building2} label="مجموعه" value={complex.name} />
                <Detail icon={MapPin} label="شهر" value={complex.city} />
                <Detail icon={CheckCircle2} label="سالن" value={hall.name} />
                <Detail
                  icon={CalendarDays}
                  label="تاریخ"
                  value={`${formatJalaliWeekday(slot.starts_at)}، ${formatJalaliDate(
                    slot.starts_at
                  )}`}
                />
                <Detail
                  icon={Clock}
                  label="ساعت"
                  value={formatTimeRange(slot.starts_at, slot.ends_at)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>روش پرداخت</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3 rounded-xl border border-primary bg-primary/5 p-4">
                  <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>
                    <span className="block text-sm font-semibold">پرداخت کامل آنلاین</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      کل مبلغ رزرو به‌صورت آنلاین و امن پرداخت می‌شود.
                    </span>
                  </span>
                </div>

                <div
                  className="flex cursor-not-allowed items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 opacity-60"
                  title="این روش پرداخت هنوز فعال نشده است"
                >
                  <Layers className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <span className="flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      پرداخت اقساطی
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        به‌زودی
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      پرداخت مبلغ رزرو در چند قسط.
                    </span>
                  </span>
                </div>

                <div
                  className="flex cursor-not-allowed items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 opacity-60"
                  title="این روش پرداخت هنوز فعال نشده است"
                >
                  <Users className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <span className="flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      پرداخت دونگی
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        به‌زودی
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      هزینه سانس را بین بازیکنان تقسیم کن و هر نفر سهم خودش را بپردازد.
                    </span>
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Price summary */}
          <div>
            <Card className="md:sticky md:top-20">
              <CardHeader>
                <CardTitle>خلاصه پرداخت</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <PriceRow label="قیمت سانس" value={formatToman(slot.base_price)} />
                {slot.discount_percent > 0 && (
                  <PriceRow
                    label={`تخفیف (${toFa(slot.discount_percent)}٪)`}
                    value={`−${formatToman(slot.base_price - slot.final_price)}`}
                    tone="success"
                  />
                )}
                <div className="my-2 border-t border-dashed border-border" />
                <PriceRow
                  label="مبلغ نهایی"
                  value={formatToman(slot.final_price)}
                  strong
                />
                <PriceRow
                  label="قابل پرداخت اکنون"
                  value={`${formatToman(payable)} تومان`}
                  tone="primary"
                  strong
                />

                <Button
                  className="mt-4 w-full"
                  size="lg"
                  variant="success"
                  onClick={confirm}
                  disabled={submitting}
                >
                  {submitting ? <Spinner /> : <CheckCircle2 className="h-5 w-5" />}
                  {submitting ? "در حال پردازش پرداخت..." : "تأیید و رزرو"}
                </Button>

                <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-success" />
                  پرداخت امن و قابل بازگشت طبق قوانین لغو
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function PriceRow({ label, value, tone, strong }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn("text-muted-foreground", strong && "text-foreground")}>
        {label}
      </span>
      <span
        className={cn(
          "font-semibold",
          strong && "text-base font-extrabold",
          tone === "success" && "text-success",
          tone === "primary" && "text-primary"
        )}
      >
        {value}
      </span>
    </div>
  );
}
