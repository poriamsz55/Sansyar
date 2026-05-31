import { useEffect, useMemo, useState } from "react";
import { Ticket } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/PageTransition";
import { listOwnerBookings, loadVenueLookups } from "@/api/endpoints";
import { useSportsMap } from "@/hooks/useSportsMap";
import { PAYMENT_TYPE } from "@/lib/constants";
import { formatToman, toFa, formatJalaliDate, formatTime, cn } from "@/lib/utils";

const FILTERS = [
  { value: "all", label: "همه" },
  { value: "confirmed", label: "تأییدشده" },
  { value: "awaiting_payment", label: "در انتظار پرداخت" },
  { value: "completed", label: "انجام‌شده" },
  { value: "cancelled_by_user", label: "لغوشده" },
];

export default function OwnerReservations() {
  const sportsMap = useSportsMap();
  const [bookings, setBookings] = useState(null);
  const [filter, setFilter] = useState("all");
  const [lookups, setLookups] = useState({ complexMap: {}, hallMap: {} });

  useEffect(() => {
    Promise.all([listOwnerBookings(), loadVenueLookups({ owner: true })]).then(([items, maps]) => {
      setLookups(maps);
      setBookings([...items].sort((a, b) => b.created_at.localeCompare(a.created_at)));
    });
  }, []);

  const visible = useMemo(() => {
    if (!bookings) return null;
    if (filter === "all") return bookings;
    return bookings.filter((b) => b.status === filter);
  }, [bookings, filter]);

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
