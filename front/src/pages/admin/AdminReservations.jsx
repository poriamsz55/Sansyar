import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, Ticket } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/PageTransition";
import {
  listAllBookings,
  cancelBooking,
  getStore,
} from "@/api/endpoints";
import { SPORT_BY_ID } from "@/data/mock";
import { PAYMENT_TYPE } from "@/lib/constants";
import {
  formatToman,
  toFa,
  formatJalaliDate,
  formatTime,
} from "@/lib/utils";
import { cn } from "@/lib/utils";

const FILTERS = [
  { value: "all", label: "همه" },
  { value: "confirmed", label: "تأییدشده" },
  { value: "awaiting_payment", label: "در انتظار پرداخت" },
  { value: "completed", label: "انجام‌شده" },
  { value: "cancelled_by_user", label: "لغوشده" },
];

export default function AdminReservations() {
  const [bookings, setBookings] = useState(null);
  const [filter, setFilter] = useState("all");

  const store = getStore();
  const complexMap = Object.fromEntries(store.complexes.map((c) => [c.id, c]));
  const hallMap = Object.fromEntries(store.halls.map((h) => [h.id, h]));

  function load() {
    listAllBookings().then((items) =>
      setBookings([...items].sort((a, b) => b.created_at.localeCompare(a.created_at)))
    );
  }
  useEffect(load, []);

  const visible = useMemo(() => {
    if (!bookings) return null;
    if (filter === "all") return bookings;
    return bookings.filter((b) => b.status === filter);
  }, [bookings, filter]);

  function confirm(b) {
    const rec = store.bookings.find((x) => x.id === b.id);
    if (rec) rec.status = "confirmed";
    load();
  }
  async function cancel(b) {
    await cancelBooking(b.id);
    load();
  }

  return (
    <div className="space-y-5">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count =
            f.value === "all"
              ? bookings?.length
              : bookings?.filter((b) => b.status === f.value).length;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                filter === f.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-accent"
              )}
            >
              {f.label}
              {count != null && (
                <span className="mr-1 text-xs opacity-70">({toFa(count)})</span>
              )}
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="px-0 py-0">
          {!visible ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Ticket} title="رزروی در این وضعیت نیست" />
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>کد</TH>
                  <TH>مجموعه / سالن</TH>
                  <TH>ورزش</TH>
                  <TH>تاریخ و ساعت</TH>
                  <TH>پرداخت</TH>
                  <TH>مبلغ</TH>
                  <TH>وضعیت</TH>
                  <TH>عملیات</TH>
                </TR>
              </THead>
              <TBody>
                {visible.map((b) => (
                  <TR key={b.id}>
                    <TD className="font-mono text-xs">{b.id.slice(-6)}</TD>
                    <TD>
                      <span className="font-medium">{complexMap[b.complex_id]?.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {hallMap[b.hall_id]?.name}
                      </span>
                    </TD>
                    <TD>{SPORT_BY_ID[b.sport_id]}</TD>
                    <TD className="text-muted-foreground">
                      {formatJalaliDate(b.starts_at)}
                      <span className="block tnum text-xs">{formatTime(b.starts_at)}</span>
                    </TD>
                    <TD className="text-xs text-muted-foreground">
                      {PAYMENT_TYPE[b.payment_type]}
                    </TD>
                    <TD className="font-semibold">{formatToman(b.final_amount)}</TD>
                    <TD>
                      <StatusBadge kind="booking" status={b.status} />
                    </TD>
                    <TD>
                      <div className="flex gap-1.5">
                        {b.status === "awaiting_payment" && (
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => confirm(b)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            تأیید
                          </Button>
                        )}
                        {["confirmed", "awaiting_payment", "pending"].includes(
                          b.status
                        ) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            onClick={() => cancel(b)}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            لغو
                          </Button>
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
    </div>
  );
}
