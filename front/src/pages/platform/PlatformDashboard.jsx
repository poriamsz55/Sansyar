import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Building2,
  Warehouse,
  Ticket,
  TrendingUp,
  Users,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listAdminComplexes,
  listAdminHalls,
  listAllBookings,
  listUsers,
  loadVenueLookups,
} from "@/api/endpoints";
import { formatToman, toFa, formatJalaliDate } from "@/lib/utils";

export default function PlatformDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

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
  const revenue = data.bookings
    .filter((b) => ["confirmed", "completed"].includes(b.status))
    .reduce((sum, b) => sum + b.final_amount, 0);

  const stats = [
    { label: "درآمد کل", value: formatToman(revenue), icon: TrendingUp, tone: "bg-primary/20 text-primary" },
    { label: "مجموعه‌ها", value: toFa(data.complexes.length), icon: Building2, tone: "bg-muted text-foreground" },
    { label: "مالکان", value: toFa(data.owners.length), icon: Users, tone: "bg-muted text-foreground" },
    { label: "رزروها", value: toFa(data.bookings.length), icon: Ticket, tone: "bg-muted text-foreground" },
  ];

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-border bg-card">
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
