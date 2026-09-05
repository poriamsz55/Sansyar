import { useEffect, useState } from "react";
import { Phone, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTransition, EmptyState } from "@/components/PageTransition";
import { adminListStoreCustomers } from "@/api/endpoints";
import { formatToman, toFa } from "@/lib/utils";

function formatAt(iso) {
  try {
    return new Date(iso).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return iso;
  }
}

/** Platform: store customers aggregated from orders (name, spend, recency). */
export default function PlatformStoreCustomers() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminListStoreCustomers()
      .then(setRows)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-black">مشتریان فروشگاه</h1>
          <p className="mt-1 text-xs text-muted-foreground">خریداران فروشگاه بر اساس سفارش‌های ثبت‌شده</p>
        </div>

        {error && <EmptyState icon={Users} title="خطا" description={error} />}

        {!rows && [...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}

        {rows && rows.length === 0 && (
          <EmptyState icon={Users} title="مشتری‌ای وجود ندارد" description="با اولین سفارش، مشتریان اینجا نمایش داده می‌شوند." />
        )}

        {rows && rows.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((c) => (
              <Card key={c.user_id}>
                <CardContent className="space-y-2 p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-bold">{c.name || "بدون نام"}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground" dir="ltr">
                      <Phone className="h-3 w-3" /> {toFa(c.phone)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">سفارش‌ها: <b>{toFa(c.orders_count)}</b></span>
                    <span className="text-muted-foreground">
                      خرید کل: <b className="text-primary">{formatToman(c.total_spent)} تومان</b>
                    </span>
                  </div>
                  <p className="border-t border-border pt-2 text-[11px] text-muted-foreground">
                    آخرین سفارش: {formatAt(c.last_order_at)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
