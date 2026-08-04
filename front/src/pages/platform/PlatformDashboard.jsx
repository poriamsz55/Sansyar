import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Building2,
  Ticket,
  TrendingUp,
  Users,
  ShieldCheck,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import JalaliDatePicker from "@/components/ui/JalaliDatePicker";
import { TrendChart } from "@/components/charts/TrendChart";
import { RankBarChart } from "@/components/charts/RankBarChart";
import {
  listAdminComplexes,
  listAdminHalls,
  listAllBookings,
  listUsers,
  loadVenueLookups,
  getAdminAnalytics,
} from "@/api/endpoints";
import { BOOKING_STATUS, TONE_CHART_COLOR } from "@/lib/constants";
import { localDateStr, addDays } from "@/lib/sessions";
import { formatToman, toFa, formatJalaliDate } from "@/lib/utils";

function defaultRange() {
  const today = new Date();
  return { from: localDateStr(addDays(today, -29)), to: localDateStr(today) };
}

export default function PlatformDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [range, setRange] = useState(defaultRange);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    (async () => {
      setError(null);
      try {
        const [complexes, halls, bookings, owners, customers, maps] = await Promise.all([
          listAdminComplexes(),
          listAdminHalls(),
          listAllBookings(),
          listUsers("venue_owner"),
          listUsers("customer"),
          loadVenueLookups({ admin: true }),
        ]);
        setData({ complexes, halls, bookings, owners, customers, maps });
      } catch (err) {
        setError(err.message);
        setData({ complexes: [], halls: [], bookings: [], owners: [], customers: [], maps: { complexMap: {} } });
      }
    })();
  }, []);

  useEffect(() => {
    setAnalytics(null);
    getAdminAnalytics({ from: range.from, to: range.to }).then(setAnalytics);
  }, [range.from, range.to]);

  if (!data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  const pendingComplexes = data.complexes.filter((c) => c.status === "pending_approval").length;
  const pendingHalls = data.halls.filter((h) => h.status === "pending_approval").length;

  const stats = analytics && [
    {
      label: "درآمد کل",
      value: formatToman(analytics.total_revenue),
      icon: TrendingUp,
      tone: "bg-primary/20 text-primary",
      delta: analytics.revenue_by_period.change_pct,
    },
    { label: "رزروها", value: toFa(analytics.total_reservations), icon: Ticket, tone: "bg-muted text-foreground" },
    { label: "مشتریان", value: toFa(analytics.total_customers), icon: Users, tone: "bg-muted text-foreground" },
    { label: "مجموعه‌های منتشرشده", value: toFa(analytics.total_venues), icon: Building2, tone: "bg-muted text-foreground" },
  ];

  const statusStats = (analytics?.reservations_by_status || []).map((row) => ({
    ...row,
    label: BOOKING_STATUS[row.label]?.label || row.label,
    color: TONE_CHART_COLOR[BOOKING_STATUS[row.label]?.tone] || TONE_CHART_COLOR.muted,
  }));

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {(pendingComplexes > 0 || pendingHalls > 0) && (
        <Link
          to="/platform/approvals"
          className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-5 py-4 transition-colors hover:bg-primary/15"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <div>
              <p className="font-bold">صف تأیید</p>
              <p className="text-sm text-muted-foreground">
                {toFa(pendingComplexes)} مجموعه و {toFa(pendingHalls)} سالن در انتظار بررسی
              </p>
            </div>
          </div>
          <ArrowLeft className="h-5 w-5 text-primary" />
        </Link>
      )}

      {/* Date range filter for the analytics below */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">از تاریخ</label>
            <JalaliDatePicker value={range.from} onChange={(v) => setRange((r) => ({ ...r, from: v }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">تا تاریخ</label>
            <JalaliDatePicker value={range.to} onChange={(v) => setRange((r) => ({ ...r, to: v }))} />
          </div>
          <Button variant="outline" size="sm" onClick={() => setRange(defaultRange())}>
            ۳۰ روز اخیر
          </Button>
        </CardContent>
      </Card>

      {!stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="border-border bg-card">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className="mt-1 text-2xl font-extrabold">{s.value}</p>
                    {s.delta != null && (
                      <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${s.delta >= 0 ? "text-success" : "text-destructive"}`}>
                        {s.delta >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {toFa(Math.abs(s.delta).toFixed(1))}٪ نسبت به دوره قبل
                      </p>
                    )}
                  </div>
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${s.tone}`}>
                    <s.icon className="h-5 w-5" />
                  </span>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Trends */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>روند درآمد</CardTitle></CardHeader>
          <CardContent>
            {analytics ? (
              <TrendChart data={analytics.revenue_trend} color="hsl(var(--primary))" formatValue={(v) => `${formatToman(v)} تومان`} />
            ) : (
              <Skeleton className="h-56" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>روند رزرو</CardTitle></CardHeader>
          <CardContent>
            {analytics ? (
              <TrendChart data={analytics.reservation_trend} color="hsl(var(--success))" />
            ) : (
              <Skeleton className="h-56" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Breakdowns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>رزروها بر اساس وضعیت</CardTitle></CardHeader>
          <CardContent>
            {analytics ? (
              <RankBarChart data={statusStats} dataKey="count" colorFor={(row) => row.color} />
            ) : (
              <Skeleton className="h-40" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>محبوب‌ترین رشته‌های ورزشی</CardTitle></CardHeader>
          <CardContent>
            {analytics ? (
              <RankBarChart data={analytics.reservations_by_sport} dataKey="count" />
            ) : (
              <Skeleton className="h-40" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>رزروها بر اساس شهر</CardTitle></CardHeader>
          <CardContent>
            {analytics ? (
              <RankBarChart data={analytics.reservations_by_city} dataKey="count" color="hsl(var(--navy))" />
            ) : (
              <Skeleton className="h-40" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>پراکندگی مشتریان بر اساس شهر</CardTitle></CardHeader>
          <CardContent>
            {analytics ? (
              <RankBarChart data={analytics.customer_distribution_by_city} dataKey="count" color="hsl(var(--navy))" />
            ) : (
              <Skeleton className="h-40" />
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>برترین مجموعه‌ها از نظر درآمد</CardTitle></CardHeader>
          <CardContent>
            {analytics ? (
              <RankBarChart
                data={analytics.top_venues}
                dataKey="revenue"
                formatValue={(v) => `${formatToman(v)} تومان`}
              />
            ) : (
              <Skeleton className="h-40" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>آخرین رزروها</CardTitle>
            <Link to="/platform/bookings" className="text-sm text-primary hover:underline">همه</Link>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <THead>
                <TR><TH>مجموعه</TH><TH>مبلغ</TH><TH>وضعیت</TH></TR>
              </THead>
              <TBody>
                {data.bookings.slice(0, 5).map((b) => (
                  <TR key={b.id}>
                    <TD>{data.maps.complexMap[b.complex_id]?.name}</TD>
                    <TD>{formatToman(b.final_amount)}</TD>
                    <TD><StatusBadge kind="booking" status={b.status} /></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>خلاصه سیستم</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between rounded-lg bg-muted/50 px-4 py-3">
              <span className="text-muted-foreground">مشتریان</span>
              <span className="font-bold">{toFa(data.customers.length)}</span>
            </div>
            <div className="flex justify-between rounded-lg bg-muted/50 px-4 py-3">
              <span className="text-muted-foreground">سالن‌های فعال</span>
              <span className="font-bold">{toFa(data.halls.filter((h) => h.status === "approved" || !h.status).length)}</span>
            </div>
            <div className="flex justify-between rounded-lg bg-muted/50 px-4 py-3">
              <span className="text-muted-foreground">مجموعه‌های تأییدشده</span>
              <span className="font-bold">{toFa(data.complexes.filter((c) => c.status === "published").length)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
