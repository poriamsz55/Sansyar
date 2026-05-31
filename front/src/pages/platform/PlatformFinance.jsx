import { useEffect, useState } from "react";
import { TrendingUp, Ticket, Building2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listAllBookings, listAdminComplexes } from "@/api/endpoints";
import { formatToman, toFa } from "@/lib/utils";

export default function PlatformFinance() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([listAllBookings(), listAdminComplexes()]).then(([bookings, complexes]) => {
      const confirmed = bookings.filter((b) => ["confirmed", "completed"].includes(b.status));
      const revenue = confirmed.reduce((s, b) => s + b.final_amount, 0);
      const byComplex = {};
      for (const b of confirmed) {
        byComplex[b.complex_id] = (byComplex[b.complex_id] || 0) + b.final_amount;
      }
      const complexMap = Object.fromEntries(complexes.map((c) => [c.id, c]));
      const topVenues = Object.entries(byComplex)
        .map(([id, amount]) => ({ name: complexMap[id]?.name || id, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);
      setStats({ revenue, bookingCount: confirmed.length, topVenues });
    });
  }, []);

  if (!stats) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/20 text-primary">
              <TrendingUp className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">درآمد تأییدشده</p>
              <p className="text-2xl font-extrabold">{formatToman(stats.revenue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-muted">
              <Ticket className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">رزروهای تأییدشده</p>
              <p className="text-2xl font-extrabold">{toFa(stats.bookingCount)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            برترین مجموعه‌ها از نظر درآمد
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {stats.topVenues.map((v, i) => (
            <div key={v.name} className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
              <span className="text-sm font-medium">{toFa(i + 1)}. {v.name}</span>
              <span className="font-bold">{formatToman(v.amount)}</span>
            </div>
          ))}
          {stats.topVenues.length === 0 && (
            <p className="text-sm text-muted-foreground">هنوز داده مالی ثبت نشده.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
