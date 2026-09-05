import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, Banknote, ClipboardList, Package, ShoppingCart, TrendingUp, Truck, Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTransition } from "@/components/PageTransition";
import { adminStoreStats, adminListStoreOrders } from "@/api/endpoints";
import { formatToman, toFa } from "@/lib/utils";
import { orderStatus } from "../../store/orderStatus";

function StatCard({ icon: Icon, label, value, tone, to }) {
  const inner = (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-black">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

/** Platform: store dashboard — real numbers from the orders pipeline. */
export default function PlatformStore() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([adminStoreStats(), adminListStoreOrders({ limit: 5, page: 1 })])
      .then(([s, o]) => {
        setStats(s);
        setRecent(o.items || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black">داشبورد فروشگاه</h1>
            <p className="mt-1 text-xs text-muted-foreground">نمای کلی فروش، سفارش‌ها و موجودی فروشگاه ورزشی</p>
          </div>
          <div className="flex gap-2">
            <Link to="/platform/store/products"><Button variant="outline" size="sm"><Package className="h-4 w-4" /> محصولات</Button></Link>
            <Link to="/platform/store/orders"><Button size="sm"><ClipboardList className="h-4 w-4" /> سفارش‌ها</Button></Link>
          </div>
        </div>

        {error && <Card><CardContent className="p-4 text-sm text-destructive">{error} — <button className="underline" onClick={load}>تلاش مجدد</button></CardContent></Card>}

        {!stats && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        )}

        {stats && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={Banknote} label="درآمد کل (پرداخت‌شده)" value={`${formatToman(stats.revenue_total)} ت`} tone="bg-success/10 text-success" to="/platform/store/orders?payment_status=paid" />
              <StatCard icon={TrendingUp} label="درآمد امروز" value={`${formatToman(stats.revenue_today)} ت`} tone="bg-primary/10 text-primary" />
              <StatCard icon={ShoppingCart} label="سفارش‌ها" value={`${toFa(stats.orders_total)} سفارش`} tone="bg-primary/10 text-primary" to="/platform/store/orders" />
              <StatCard icon={AlertTriangle} label="گونه‌های کم‌موجود" value={`${toFa(stats.low_stock_count)} گونه`} tone="bg-amber-100 text-amber-700" to="/platform/store/inventory" />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard icon={ClipboardList} label="در انتظار پرداخت" value={toFa(stats.orders_pending)} tone="bg-amber-100 text-amber-700" to="/platform/store/orders?status=pending_payment" />
              <StatCard icon={Truck} label="در پردازش/ارسال" value={toFa(stats.orders_paid)} tone="bg-primary/10 text-primary" to="/platform/store/orders?status=processing" />
              <StatCard icon={Users} label="مشتریان فروشگاه" value="" tone="bg-muted text-muted-foreground" to="/platform/store/customers" />
            </div>

            {/* Recent orders */}
            <Card>
              <CardContent className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-bold">آخرین سفارش‌ها</h2>
                  <Link to="/platform/store/orders" className="text-xs text-primary hover:underline">مشاهده همه</Link>
                </div>
                {!recent ? (
                  <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
                ) : recent.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">هنوز سفارشی ثبت نشده است</p>
                ) : (
                  <div className="space-y-2">
                    {recent.map((order) => {
                      const st = orderStatus(order.status);
                      return (
                        <Link
                          key={order.id}
                          to={`/platform/store/orders/${order.id}`}
                          className="flex items-center justify-between rounded-lg border border-border p-3 text-xs transition-colors hover:border-primary/40"
                        >
                          <div>
                            <p className="font-bold">{order.customer_name}</p>
                            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground" dir="ltr">#{order.id.slice(0, 8)}</p>
                          </div>
                          <Badge tone={st.tone}>{st.label}</Badge>
                          <span className="font-black text-primary">{formatToman(order.total)} تومان</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick links */}
            <div className="grid gap-3 sm:grid-cols-4">
              <Link to="/platform/store/categories" className="rounded-xl border border-border p-4 text-center text-xs font-bold transition-colors hover:border-primary/40">دسته‌بندی‌ها</Link>
              <Link to="/platform/store/brands" className="rounded-xl border border-border p-4 text-center text-xs font-bold transition-colors hover:border-primary/40">برندها</Link>
              <Link to="/platform/store/coupons" className="rounded-xl border border-border p-4 text-center text-xs font-bold transition-colors hover:border-primary/40">کدهای تخفیف</Link>
              <Link to="/platform/store/settings" className="rounded-xl border border-border p-4 text-center text-xs font-bold transition-colors hover:border-primary/40">تنظیمات فروشگاه</Link>
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}
