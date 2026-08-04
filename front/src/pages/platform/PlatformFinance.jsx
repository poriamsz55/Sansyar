import { useEffect, useState } from "react";
import { TrendingUp, AlertTriangle, Clock, Building2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RankBarChart } from "@/components/charts/RankBarChart";
import { getAdminFinanceSummary, getAdminAnalytics } from "@/api/endpoints";
import { formatToman, toFa } from "@/lib/utils";

export default function PlatformFinance() {
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    Promise.all([getAdminFinanceSummary(), getAdminAnalytics()]).then(([s, a]) => {
      setSummary(s);
      setAnalytics(a);
    });
  }, []);

  if (!summary || !analytics) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/20 text-primary">
              <TrendingUp className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">درآمد پلتفرم</p>
              <p className="text-2xl font-extrabold">{formatToman(summary.platform_revenue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">پرداخت‌های ناموفق</p>
              <p className="text-2xl font-extrabold">{toFa(summary.failed_payments)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-muted text-muted-foreground">
              <Clock className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">تسویه‌های در انتظار</p>
              <p className="text-2xl font-extrabold">{toFa(summary.pending_settlements)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">سامانه تسویه هنوز راه‌اندازی نشده است</p>
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
        <CardContent>
          {analytics.top_venues.length === 0 ? (
            <p className="text-sm text-muted-foreground">هنوز داده مالی ثبت نشده.</p>
          ) : (
            <RankBarChart
              data={analytics.top_venues}
              dataKey="revenue"
              formatValue={(v) => `${formatToman(v)} تومان`}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
