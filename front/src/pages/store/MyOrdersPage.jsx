import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, PackageOpen, ReceiptText } from "lucide-react";

import { PageTransition, EmptyState } from "@/components/PageTransition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { listMyStoreOrders } from "@/api/endpoints";
import { formatToman, toFa } from "@/lib/utils";
import { orderStatus, paymentStatus } from "./orderStatus";

/** Customer's own store orders (newest first). */
export default function MyOrdersPage() {
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    listMyStoreOrders()
      .then(setOrders)
      .catch((err) => setError(err.message));
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="container py-16">
        <EmptyState
          icon={ReceiptText}
          title="سفارش‌های خود را ببینید"
          description="برای مشاهده سفارش‌ها وارد حساب کاربری خود شوید."
          action={<Link to="/login"><Button>ورود / ثبت‌نام</Button></Link>}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-16">
        <EmptyState
          icon={ReceiptText}
          title="خطا در دریافت سفارش‌ها"
          description={error}
          action={<Button onClick={() => window.location.reload()}>تلاش مجدد</Button>}
        />
      </div>
    );
  }

  if (!orders) {
    return (
      <div className="container py-8">
        <Skeleton className="h-8 w-40" />
        <div className="mt-6 space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="container py-8">
        <h1 className="mb-6 text-xl font-black">سفارش‌های من</h1>

        {orders.length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title="هنوز سفارشی ثبت نکرده‌اید"
            description="اولین خرید خود را از فروشگاه ورزشی سانسیار انجام دهید."
            action={<Link to="/store"><Button>رفتن به فروشگاه</Button></Link>}
          />
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const st = orderStatus(order.status);
              const ps = paymentStatus(order.payment_status);
              return (
                <Link key={order.id} to={`/store/orders/${order.id}`}>
                  <Card className="mb-3 transition-shadow hover:shadow-md">
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="min-w-40">
                        <p className="font-mono text-[11px] text-muted-foreground" dir="ltr">
                          #{order.id.slice(0, 8)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {toFa(order.items.length)} قلم کالا
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={st.tone}>{st.label}</Badge>
                        <Badge tone={ps.tone}>{ps.label}</Badge>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-black text-primary">{formatToman(order.total)} تومان</p>
                        <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                          مشاهده جزئیات <ChevronLeft className="h-3 w-3" />
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
