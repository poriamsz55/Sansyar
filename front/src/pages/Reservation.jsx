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
} from "lucide-react";

import { PageTransition, EmptyState } from "@/components/PageTransition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/skeleton";
import {
  getPendingReservation,
  clearPendingReservation,
} from "@/lib/reservation";
import { createBooking } from "@/api/endpoints";
import { toast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { PAYMENT_TYPE } from "@/lib/constants";
import {
  cn,
  formatToman,
  toFa,
  formatJalaliDate,
  formatJalaliWeekday,
  formatTimeRange,
} from "@/lib/utils";

const PAYMENT_OPTIONS = [
  { value: "full_online", label: PAYMENT_TYPE.full_online, desc: "کل مبلغ به‌صورت آنلاین پرداخت می‌شود." },
  {
    value: "deposit_online_remaining_in_person",
    label: PAYMENT_TYPE.deposit_online_remaining_in_person,
    desc: "بخشی به‌عنوان بیعانه آنلاین، باقی در محل.",
  },
  { value: "full_in_person", label: PAYMENT_TYPE.full_in_person, desc: "پرداخت کامل هنگام حضور در مجموعه." },
];

export default function Reservation() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [pending, setPending] = useState(undefined);
  const [payment, setPayment] = useState("full_online");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPending(getPendingReservation());
  }, []);

  async function confirm() {
    if (!isAuthenticated) {
      navigate("/login?redirect=/reservation");
      return;
    }
    setSubmitting(true);
    try {
      await createBooking({ slot_id: pending.slot.id, payment_type: payment });
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
  const deposit = slot.min_deposit_amount || Math.round(slot.final_price * 0.4);
  const payable =
    payment === "full_in_person"
      ? 0
      : payment === "deposit_online_remaining_in_person"
        ? deposit
        : slot.final_price;

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
          جزئیات رزرو را بررسی کن و روش پرداخت را انتخاب کن.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_340px]">
          {/* Details + payment method */}
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
                {PAYMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPayment(opt.value)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border p-4 text-right transition-all",
                      payment === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2",
                        payment === opt.value
                          ? "border-primary"
                          : "border-muted-foreground/40"
                      )}
                    >
                      {payment === opt.value && (
                        <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                      )}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{opt.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {opt.desc}
                      </span>
                    </span>
                  </button>
                ))}
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
                  value={
                    payable === 0 ? "پرداخت در محل" : `${formatToman(payable)} تومان`
                  }
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
                  {submitting ? "در حال ثبت..." : "تأیید و رزرو"}
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
