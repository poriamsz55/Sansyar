import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, Ticket } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/PageTransition";
import { toast } from "@/components/Toast";
import {
  listAllBookings,
  adminCancelBooking,
  adminConfirmBooking,
  loadVenueLookups,
} from "@/api/endpoints";
import { useSportsMap } from "@/hooks/useSportsMap";
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
  const sportsMap = useSportsMap();
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [lookups, setLookups] = useState({ complexMap: {}, hallMap: {} });

  const complexMap = lookups.complexMap;
  const hallMap = lookups.hallMap;

  async function load() {
    setError(null);
    try {
      const [items, maps] = await Promise.all([
        listAllBookings(),
        loadVenueLookups({ admin: true }),
      ]);
      setLookups(maps);
      setBookings([...items].sort((a, b) => b.created_at.localeCompare(a.created_at)));
    } catch (err) {
      setError(err.message);
      setBookings([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    if (!bookings) return null;
    if (filter === "all") return bookings;
    return bookings.filter((b) => b.status === filter);
  }, [bookings, filter]);

  async function confirm(b) {
    try {
      await adminConfirmBooking(b.id);
      toast("رزرو تأیید شد");
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function cancel(b) {
    if (!confirm("این رزرو لغو شود؟")) return;
    try {
      await adminCancelBooking(b.id);
      toast("رزرو لغو شد");
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

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
                      <span className="font-medium">{complexMap[b.complex_id]?.name || "—"}</span>
                      <span className="block text-xs text-muted-foreground">
                        {hallMap[b.hall_id]?.name || "—"}
                      </span>
                    </TD>
                    <TD>{sportsMap[b.sport_id] || b.sport_id}</TD>
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
                          <Button size="sm" variant="success" onClick={() => confirm(b)}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            تأیید
                          </Button>
                        )}
                        {["confirmed", "awaiting_payment", "pending"].includes(b.status) && (
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
