import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Building2,
  CalendarClock,
  Ticket,
  TrendingUp,
  ArrowLeft,
  Clock,
  XCircle,
  CalendarX2,
  Banknote,
  RotateCcw,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendChart } from "@/components/charts/TrendChart";
import {
  listOwnerBookings,
  listOwnerComplexes,
  listSessions,
  loadVenueLookups,
  getOwnerAnalytics,
} from "@/api/endpoints";
import { useSportsMap } from "@/hooks/useSportsMap";
import { cn, formatToman, toFa, formatJalaliDate, formatTime, formatTimeRange } from "@/lib/utils";

export default function OwnerDashboard() {
  const sportsMap = useSportsMap();
  const [data, setData] = useState(null);
  const [lookups, setLookups] = useState({ complexMap: {}, hallMap: {} });
  const [analytics, setAnalytics] = useState(null);
  const [sessionFilter, setSessionFilter] = useState("available");

  useEffect(() => {
    (async () => {
      const now = new Date();
      const in30Days = new Date(now.getTime() + 30 * 86400000);
      const [bookings, complexes, sessions, maps, ownerAnalytics] = await Promise.all([
        listOwnerBookings(),
        listOwnerComplexes(),
        listSessions({ from: now.toISOString(), to: in30Days.toISOString() }),
        loadVenueLookups({ owner: true }),
        getOwnerAnalytics(),
      ]);
      setLookups(maps);
      setData({ bookings, complexes, sessions });
      setAnalytics(ownerAnalytics);
    })();
  }, []);

  const filteredSessions = useMemo(() => {
    if (!data) return [];
    return data.sessions
      .filter((s) => s.status === sessionFilter)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }, [data, sessionFilter]);

  if (!data || !analytics) {
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
  const availableCount = data.sessions.filter((s) => s.status === "available").length;
  const reservedCount = data.sessions.filter((s) => s.status === "reserved").length;

  const stats = [
    { label: "مجموعه‌های من", value: toFa(data.complexes.length), icon: Building2, tone: "bg-primary/10 text-primary" },
    { label: "سانس‌های آزاد (۳۰ روز آینده)", value: toFa(availableCount), icon: CalendarClock, tone: "bg-success/10 text-success" },
    { label: "رزروهای مجموعه", value: toFa(data.bookings.length), icon: Ticket, tone: "bg-amber-100 text-amber-700" },
    { label: "درآمد (تومان)", value: formatToman(revenue), icon: TrendingUp, tone: "bg-muted text-foreground" },
  ];

  const analyticsStats = [
    { label: "کل رزروها", value: toFa(analytics.total_reservations), icon: Ticket },
    { label: "درآمد کل", value: `${formatToman(analytics.total_revenue)} ت`, icon: Banknote },
    { label: "لغو شده", value: toFa(analytics.cancelled_reservations), icon: XCircle },
    { label: "روزهای تعطیل/مسدود", value: toFa(analytics.holiday_closure_days), icon: CalendarX2 },
    { label: "مبلغ بازپرداختی", value: `${formatToman(analytics.total_refund_amount)} ت`, icon: RotateCcw },
    { label: "تعداد بازپرداخت", value: toFa(analytics.refunded_count), icon: RotateCcw },
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

      {/* Session list with Reserved/Available filter */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>سانس‌ها (۳۰ روز آینده)</CardTitle>
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            <button
              onClick={() => setSessionFilter("available")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                sessionFilter === "available" ? "bg-card text-primary shadow-soft" : "text-muted-foreground"
              )}
            >
              آزاد ({toFa(availableCount)})
            </button>
            <button
              onClick={() => setSessionFilter("reserved")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                sessionFilter === "reserved" ? "bg-card text-primary shadow-soft" : "text-muted-foreground"
              )}
            >
              رزرو شده ({toFa(reservedCount)})
            </button>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {filteredSessions.length === 0 ? (
            <p className="p-5 text-center text-sm text-muted-foreground">سانسی در این دسته یافت نشد.</p>
          ) : (
            <Table>
              <THead>
                <TR><TH>سالن</TH><TH>مجموعه</TH><TH>تاریخ</TH><TH>ساعت</TH></TR>
              </THead>
              <TBody>
                {filteredSessions.slice(0, 8).map((s) => (
                  <TR key={s.id}>
                    <TD className="font-medium">{lookups.hallMap[s.hall_id]?.name || "—"}</TD>
                    <TD>{lookups.complexMap[s.complex_id]?.name || "—"}</TD>
                    <TD className="text-muted-foreground">{formatJalaliDate(s.starts_at)}</TD>
                    <TD className="tnum">{formatTimeRange(s.starts_at, s.ends_at)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Business analytics */}
      <div>
        <h2 className="mb-3 text-base font-bold">تحلیل کسب‌وکار</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {analyticsStats.map((s) => (
            <Card key={s.label}>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="mt-1 text-xl font-extrabold">{s.value}</p>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-muted-foreground">
                  <s.icon className="h-5 w-5" />
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>روند درآمد (۳۰ روز اخیر)</CardTitle></CardHeader>
          <CardContent>
            <TrendChart
              data={analytics.revenue_trend}
              color="hsl(var(--primary))"
              formatValue={(v) => `${formatToman(v)} تومان`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>روند رزرو (۳۰ روز اخیر)</CardTitle></CardHeader>
          <CardContent>
            <TrendChart data={analytics.reservation_trend} color="hsl(var(--success))" />
          </CardContent>
        </Card>
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
