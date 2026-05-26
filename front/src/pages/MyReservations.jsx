import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  Clock,
  Building2,
  CheckCircle2,
  XCircle,
  Ticket,
} from "lucide-react";

import { PageTransition, EmptyState } from "@/components/PageTransition";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { Dialog } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { myBookings, cancelBooking, getStore } from "@/api/endpoints";
import { useAuth } from "@/context/AuthContext";
import { PAYMENT_TYPE } from "@/lib/constants";
import { SPORT_BY_ID } from "@/data/mock";
import {
  formatToman,
  formatJalaliDate,
  formatJalaliWeekday,
  formatTimeRange,
} from "@/lib/utils";

const cancellable = new Set(["confirmed", "awaiting_payment", "pending"]);

export default function MyReservations() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [params, setParams] = useSearchParams();
  const [bookings, setBookings] = useState(null);
  const [toCancel, setToCancel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showSuccess, setShowSuccess] = useState(params.get("success") === "1");

  const store = getStore();
  const complexMap = Object.fromEntries(store.complexes.map((c) => [c.id, c]));
  const hallMap = Object.fromEntries(store.halls.map((h) => [h.id, h]));

  function load() {
    myBookings().then((items) =>
      setBookings([...items].sort((a, b) => b.created_at.localeCompare(a.created_at)))
    );
  }

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login?redirect=/my-reservations");
      return;
    }
    load();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!showSuccess) return;
    const t = setTimeout(() => {
      setShowSuccess(false);
      setParams({}, { replace: true });
    }, 4000);
    return () => clearTimeout(t);
  }, [showSuccess]);

  async function doCancel() {
    setBusy(true);
    try {
      await cancelBooking(toCancel.id);
      setToCancel(null);
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageTransition>
      <div className="container max-w-4xl py-8">
        <h1 className="text-2xl font-extrabold">رزروهای من</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          وضعیت رزروهایت را ببین و در صورت نیاز لغو کن.
        </p>

        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-5 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success"
            >
              <CheckCircle2 className="h-5 w-5" />
              رزرو شما با موفقیت ثبت شد!
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 space-y-4">
          {!bookings ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full" />
            ))
          ) : bookings.length === 0 ? (
            <EmptyState
              icon={Ticket}
              title="هنوز رزروی نداری"
              description="اولین سانس ورزشی‌ات را همین حالا رزرو کن."
              action={<Button onClick={() => navigate("/complexes")}>مشاهده مجموعه‌ها</Button>}
            />
          ) : (
            bookings.map((b, i) => {
              const complex = complexMap[b.complex_id];
              const hall = hallMap[b.hall_id];
              return (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                          <Building2 className="h-5 w-5" />
                        </span>
                        <div>
                          <h3 className="font-bold">
                            {complex?.name || "مجموعه ورزشی"}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {hall?.name} · {SPORT_BY_ID[b.sport_id]}
                          </p>
                        </div>
                      </div>
                      <StatusBadge kind="booking" status={b.status} />
                    </div>

                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                      <Info
                        icon={CalendarDays}
                        label="تاریخ"
                        value={`${formatJalaliWeekday(b.starts_at)}، ${formatJalaliDate(
                          b.starts_at
                        )}`}
                      />
                      <Info
                        icon={Clock}
                        label="ساعت"
                        value={formatTimeRange(b.starts_at, b.ends_at)}
                      />
                      <Info
                        icon={Ticket}
                        label="مبلغ"
                        value={`${formatToman(b.final_amount)} تومان`}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                      <span className="text-xs text-muted-foreground">
                        {PAYMENT_TYPE[b.payment_type]}
                      </span>
                      {cancellable.has(b.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/5"
                          onClick={() => setToCancel({ id: b.id, name: complex?.name })}
                        >
                          <XCircle className="h-4 w-4" />
                          لغو رزرو
                        </Button>
                      )}
                    </div>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      <Dialog
        open={!!toCancel}
        onClose={() => setToCancel(null)}
        title="لغو رزرو"
        description="آیا از لغو این رزرو مطمئن هستی؟ این عمل قابل بازگشت نیست."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setToCancel(null)}>
            انصراف
          </Button>
          <Button variant="destructive" onClick={doCancel} disabled={busy}>
            {busy ? <Spinner /> : <XCircle className="h-4 w-4" />}
            بله، لغو کن
          </Button>
        </div>
      </Dialog>
    </PageTransition>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
