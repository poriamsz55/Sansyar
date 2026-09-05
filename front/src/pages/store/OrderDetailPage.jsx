import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  BadgeCheck, ChevronLeft, Clock, CreditCard, MapPin, Package, Store, Truck, XCircle,
} from "lucide-react";

import { PageTransition, EmptyState } from "@/components/PageTransition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/Toast";
import { getMyStoreOrder, cancelMyStoreOrder, payStoreOrder } from "@/api/endpoints";
import { formatToman, toFa } from "@/lib/utils";
import { orderStatus, paymentStatus, timelineAction } from "./orderStatus";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("fa-IR", {
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** One order: snapshot items, address, totals and the status timeline.
 *  The payment CTA appears once the payment phase is live. */
export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const paidFlash = params.get("paid") === "1";
  const [order, setOrder] = useState(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    getMyStoreOrder(id)
      .then(setOrder)
      .catch((err) => setError(err.message));
  }, [id]);

  async function doCancel() {
    setCancelling(true);
    try {
      const updated = await cancelMyStoreOrder(id);
      setOrder(updated);
      toast("سفارش لغو شد");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setCancelling(false);
    }
  }

  if (error) {
    return (
      <div className="container py-16">
        <EmptyState
          icon={Package}
          title="سفارش یافت نشد"
          description={error}
          action={<Button onClick={() => navigate("/store/orders")}>سفارش‌های من</Button>}
        />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container py-8">
        <Skeleton className="h-8 w-48" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const st = orderStatus(order.status);
  const ps = paymentStatus(order.payment_status);
  return (
    <PageTransition>
      <div className="container py-8">
        <nav className="mb-4 flex items-center gap-1 text-xs text-muted-foreground">
          <Link to="/store" className="hover:text-foreground">فروشگاه</Link>
          <ChevronLeft className="h-3 w-3" />
          <Link to="/store/orders" className="hover:text-foreground">سفارش‌های من</Link>
          <ChevronLeft className="h-3 w-3" />
          <span className="font-mono" dir="ltr">#{order.id.slice(0, 8)}</span>
        </nav>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-black">
              سفارش <span className="font-mono text-sm" dir="ltr">#{order.id.slice(0, 8)}</span>
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={st.tone} className="px-3 py-1 text-xs">{st.label}</Badge>
            <Badge tone={ps.tone} className="px-3 py-1 text-xs">{ps.label}</Badge>
          </div>
        </div>

        {order.status === "pending_payment" && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            <p className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              این سفارش ثبت شده اما هنوز پرداخت نشده است.
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={paying}
                onClick={async () => {
                  setPaying(true);
                  try {
                    const { payment, redirect_url } = await payStoreOrder(order.id);
                    navigate(`${redirect_url}?order=${order.id}`);
                  } catch (err) {
                    toast(err.message, "error");
                  } finally {
                    setPaying(false);
                  }
                }}
              >
                <CreditCard className="h-4 w-4" /> پرداخت سفارش
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={cancelling}
                onClick={() =>
                  setConfirmCancel({
                    title: "لغو سفارش",
                    message: "این سفارش لغو شود؟ (تا پیش از پرداخت امکان‌پذیر است)",
                    actionLabel: "لغو سفارش",
                    onConfirm: doCancel,
                  })
                }
              >
                <XCircle className="h-4 w-4" /> لغو سفارش
              </Button>
            </div>
          </div>
        )}

        {paidFlash && order.status === "paid" && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-700">
            <BadgeCheck className="h-4 w-4" />
            پرداخت شما با موفقیت انجام شد. سفارش شما پس از پردازش ارسال می‌شود.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            {/* Items */}
            <Card>
              <CardContent className="space-y-4 p-5">
                <h2 className="flex items-center gap-2 text-sm font-bold">
                  <Package className="h-4 w-4 text-primary" /> اقلام سفارش
                </h2>
                {order.items.map((item) => (
                  <div key={item.variant_id} className="flex gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                    <Link
                      to={`/store/products/${encodeURIComponent(item.product_id)}`}
                      className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted"
                    >
                      {item.image ? (
                        <img src={item.image} alt={item.product_name} className="h-full w-full object-cover" />
                      ) : (
                        <Store className="m-4 h-8 w-8 text-muted-foreground/40" />
                      )}
                    </Link>
                    <div className="flex flex-1 items-start justify-between gap-2">
                      <div>
                        <Link
                          to={`/store/products/${encodeURIComponent(item.product_id)}`}
                          className="text-sm font-bold hover:text-primary"
                        >
                          {item.product_name}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.variant_name ? `${item.variant_name} · ` : ""}
                          {toFa(item.qty)} عدد × {formatToman(item.unit_price)} تومان
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-black">{formatToman(item.line_total)} تومان</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardContent className="space-y-4 p-5">
                <h2 className="flex items-center gap-2 text-sm font-bold">
                  <Clock className="h-4 w-4 text-primary" /> وضعیت سفارش
                </h2>
                <ol className="space-y-3">
                  {order.timeline.map((event, idx) => (
                    <li key={idx} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="h-2.5 w-2.5 rounded-full bg-primary mt-1.5" />
                        {idx < order.timeline.length - 1 && <div className="w-px flex-1 bg-border" />}
                      </div>
                      <div className="pb-2">
                        <p className="text-xs font-bold">{timelineAction(event.action)}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDate(event.at)}</p>
                        {event.note && <p className="mt-1 text-[11px] text-muted-foreground">{event.note}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>

          {/* Summary + address */}
          <div className="space-y-5">
            <Card>
              <CardContent className="space-y-3 p-5 text-sm">
                <h2 className="text-sm font-bold">خلاصه پرداخت</h2>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">جمع اقلام</span>
                  <span>{formatToman(order.subtotal)} تومان</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    ارسال ({order.shipping_method?.name || "—"})
                  </span>
                  <span>{order.shipping_fee === 0 ? "رایگان" : `${formatToman(order.shipping_fee)} تومان`}</span>
                </div>
                {order.coupon_discount > 0 && (
                  <div className="flex justify-between text-xs text-success">
                    <span>تخفیف ({order.coupon_code})</span>
                    <span>−{formatToman(order.coupon_discount)} تومان</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-3">
                  <span className="font-bold">مبلغ کل</span>
                  <span className="text-base font-black text-primary">{formatToman(order.total)} تومان</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-2 p-5 text-xs leading-6">
                <h2 className="flex items-center gap-2 text-sm font-bold">
                  <MapPin className="h-4 w-4 text-primary" /> آدرس تحویل
                </h2>
                <p className="font-bold">{order.shipping_address?.receiver} · <span dir="ltr">{toFa(order.shipping_address?.phone || "")}</span></p>
                <p className="text-muted-foreground">
                  {order.shipping_address?.province}، {order.shipping_address?.city}، {order.shipping_address?.address}
                </p>
                {order.shipping_address?.postal_code && (
                  <p className="text-muted-foreground">کدپستی: {toFa(order.shipping_address.postal_code)}</p>
                )}
                <div className="flex items-center gap-2 border-t border-border pt-2 text-muted-foreground">
                  <Truck className="h-3.5 w-3.5" />
                  {order.shipping_method?.name}
                  {order.shipping_method?.eta_days ? ` — حدود ${toFa(order.shipping_method.eta_days)} روز کاری` : ""}
                </div>
                {order.customer_note && (
                  <p className="border-t border-border pt-2 text-muted-foreground">یادداشت: {order.customer_note}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <ConfirmDialog confirm={confirmCancel} onClose={() => setConfirmCancel(null)} />
      </div>
    </PageTransition>
  );
}
