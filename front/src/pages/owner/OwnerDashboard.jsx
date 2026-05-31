import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, CalendarClock, Ticket, TrendingUp, ArrowLeft, Clock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { listOwnerBookings, listOwnerComplexes, listSlots, loadVenueLookups } from "@/api/endpoints";
import { useSportsMap } from "@/hooks/useSportsMap";
import { formatToman, toFa, formatJalaliDate, formatTime } from "@/lib/utils";

export default function OwnerDashboard() {
  const sportsMap = useSportsMap();
  const [data, setData] = useState(null);
  const [lookups, setLookups] = useState({ complexMap: {} });

  useEffect(() => {
    (async () => {
      const [bookings, complexes, slots, maps] = await Promise.all([
        listOwnerBookings(),
        listOwnerComplexes(),
        listSlots(),
        loadVenueLookups({ owner: true }),
      ]);
      setLookups(maps);
      setData({ bookings, complexes, slots });
    })();
  }, []);

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const pendingCount = data.complexes.filter((c) => c.status === "pending_approval").length;
  const revenue = data.bookings
    .filter((b) => ["confirmed", "completed"].includes(b.status))
    .reduce((sum, b) => sum + b.final_amount, 0);

  const stats = [
    { label: "مجموعه‌های من", value: toFa(data.complexes.length), icon: Building2, tone: "bg-primary/10 text-primary" },
    { label: "سانس‌های آزاد", value: toFa(data.slots.filter((s) => s.status === "available").length), icon: CalendarClock, tone: "bg-success/10 text-success" },
    { label: "رزروهای مجموعه", value: toFa(data.bookings.length), icon: Ticket, tone: "bg-amber-100 text-amber-700" },
    { label: "درآمد (تومان)", value: formatToman(revenue), icon: TrendingUp, tone: "bg-muted text-foreground" },
  ];

  return (
    <div className="space-y-6">
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Clock className="h-5 w-5 shrink-0" />
          <span>
            {toFa(pendingCount)} مجموعه در انتظار تأیید مدیر ارشد است و هنوز در سایت عمومی نمایش داده نمی‌شود.
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="mt-1 text-2xl font-extrabold">{s.value}</p>
                </div>
                <span className={`grid h-11 w-11 place-items-center rounded-xl ${s.tone}`}>
                  <s.icon className="h-5 w-5" />
                </span>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>آخرین رزروها</CardTitle>
          <Link to="/owner/reservations" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            همه رزروها
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <THead>
              <TR>
                <TH>مجموعه</TH>
                <TH>ورزش</TH>
                <TH>تاریخ</TH>
                <TH>مبلغ</TH>
                <TH>وضعیت</TH>
              </TR>
            </THead>
            <TBody>
              {data.bookings.slice(0, 6).map((b) => (
                <TR key={b.id}>
                  <TD className="font-medium">{lookups.complexMap[b.complex_id]?.name}</TD>
                  <TD>{sportsMap[b.sport_id] || b.sport_id}</TD>
                  <TD className="text-muted-foreground">{formatJalaliDate(b.starts_at)} — {formatTime(b.starts_at)}</TD>
                  <TD className="font-semibold">{formatToman(b.final_amount)}</TD>
                  <TD><StatusBadge kind="booking" status={b.status} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
