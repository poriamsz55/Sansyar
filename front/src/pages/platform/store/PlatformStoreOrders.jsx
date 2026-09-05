import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ClipboardList, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTransition, EmptyState } from "@/components/PageTransition";
import { adminListStoreOrders } from "@/api/endpoints";
import { formatToman, toFa } from "@/lib/utils";
import { ORDER_STATUS, PAYMENT_STATUS, orderStatus, paymentStatus } from "../../store/orderStatus";

const PAGE_SIZE = 20;

/** Platform: store orders list with status/payment filters and search. */
export default function PlatformStoreOrders() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  // Deep links from the dashboard (?status=...&payment_status=...)
  const [initParams] = useSearchParams();
  const [status, setStatus] = useState(initParams.get("status") || "");
  const [paymentStatusF, setPaymentStatusF] = useState(initParams.get("payment_status") || "");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setData(null);
    setError(null);
    try {
      const result = await adminListStoreOrders({
        q: q || undefined,
        status: status || undefined,
        payment_status: paymentStatusF || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setData(result);
    } catch (err) {
      setError(err.message);
    }
  }, [q, status, paymentStatusF, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black">سفارش‌های فروشگاه</h1>
            <p className="mt-1 text-xs text-muted-foreground">مدیریت و پیگیری سفارش‌های فروشگاه ورزشی</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="جستجوی شناسه سفارش، نام یا شماره مشتری…"
              className="pr-9"
            />
          </div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-40">
            <option value="">همه وضعیت‌ها</option>
            {Object.entries(ORDER_STATUS).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </Select>
          <Select value={paymentStatusF} onChange={(e) => { setPaymentStatusF(e.target.value); setPage(1); }} className="w-40">
            <option value="">همه پرداخت‌ها</option>
            {Object.entries(PAYMENT_STATUS).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </Select>
        </div>

        {error && (
          <EmptyState
            icon={ClipboardList}
            title="خطا در دریافت سفارش‌ها"
            description={error}
            action={<Button onClick={load}>تلاش مجدد</Button>}
          />
        )}

        {!error && !data && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        )}

        {data && data.items.length === 0 && (
          <EmptyState
            icon={ClipboardList}
            title="سفارشی یافت نشد"
            description="هنوز سفارشی با این مشخصات ثبت نشده است."
          />
        )}

        {data && data.items.length > 0 && (
          <>
            <div className="space-y-3">
              {data.items.map((order) => {
                const st = orderStatus(order.status);
                const ps = paymentStatus(order.payment_status);
                return (
                  <Link key={order.id} to={`/platform/store/orders/${order.id}`}>
                    <Card className="mb-3 transition-shadow hover:shadow-md">
                      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div>
                          <p className="font-mono text-[11px] text-muted-foreground" dir="ltr">#{order.id.slice(0, 8)}</p>
                          <p className="mt-1 text-sm font-bold">{order.customer_name}</p>
                          <p className="text-xs text-muted-foreground" dir="ltr">{toFa(order.customer_phone)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={st.tone}>{st.label}</Badge>
                          <Badge tone={ps.tone}>{ps.label}</Badge>
                          <Badge tone="outline">{toFa(order.items.length)} قلم</Badge>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-black text-primary">{formatToman(order.total)} تومان</p>
                          <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                            جزئیات <ChevronLeft className="h-3 w-3" />
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {toFa(data.total)} سفارش — صفحه {toFa(page)} از {toFa(totalPages)}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  قبلی
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  بعدی
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}
