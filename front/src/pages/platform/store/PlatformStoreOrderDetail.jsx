import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight, ClipboardList, Clock, MapPin, Package, Phone, Store, Truck, User, XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";
import { PageTransition, EmptyState } from "@/components/PageTransition";
import { adminGetStoreOrder, adminUpdateStoreOrderStatus } from "@/api/endpoints";
import { formatToman, toFa } from "@/lib/utils";
import { ORDER_STATUS, orderStatus, paymentStatus, timelineAction } from "../../store/orderStatus";

// Mirrors the server's status machine: from -> allowed next statuses.
const NEXT_STATUSES = {
  pending_payment: [{ value: "cancelled", label: "لغو سفارش", destructive: true }],
  paid: [
    { value: "processing", label: "شروع پردازش" },
    { value: "cancelled", label: "لغو و بازگشت وجه", destructive: true },
  ],
  processing: [
    { value: "shipped", label: "ارسال شد" },
    { value: "cancelled", label: "لغو سفارش", destructive: true },
  ],
  shipped: [{ value: "delivered", label: "تحویل داده شد" }],
  delivered: [],
  cancelled: [],
};

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("fa-IR", {
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Platform: one store order — items, customer, timeline, status management. */
export default function PlatformStoreOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [action, setAction] = useState(null); // {value,label,destructive}
  const [note, setNote] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(() => {
    adminGetStoreOrder(id)
      .then(setOrder)
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(load, [load]);

  async function applyStatus() {
    if (!action) return;
    setBusy(true);
    try {
      const updated = await adminUpdateStoreOrderStatus(
        id,
        action.value,
        note || undefined,
        action.value === "shipped" && trackingCode ? trackingCode : undefined
      );
      setOrder(updated);
      toast(`وضعیت سفارش به «${ORDER_STATUS[action.value]?.label}» تغییر کرد`);
      setAction(null);
      setNote("");
      setTrackingCode("");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="سفارش یافت نشد"
        description={error}
        action={<Button onClick={() => navigate("/platform/store/orders")}>بازگشت به لیست</Button>}
      />
    );
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const st = orderStatus(order.status);
  const ps = paymentStatus(order.payment_status);
  const nexts = NEXT_STATUSES[order.status] || [];

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/platform/store/orders" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowRight className="h-3.5 w-3.5" /> بازگشت به لیست سفارش‌ها
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black">
              سفارش <span className="font-mono text-sm" dir="ltr">#{order.id.slice(0, 8)}</span>
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={st.tone} className="px-3 py-1">{st.label}</Badge>
            <Badge tone={ps.tone} className="px-3 py-1">{ps.label}</Badge>
          </div>
        </div>

        {/* Status actions */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Truck className="h-4 w-4 text-primary" /> اقدام‌های وضعیت
            </h2>
            {nexts.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                این سفارش در وضعیت نهایی است و اقدامی باقی نمانده.
              </p>
            ) : (
              nexts.map((n) => (
                <Button
                  key={n.value}
                  variant={n.destructive ? "destructive" : "default"}
                  size="sm"
                  onClick={() => {
                    setAction(n);
                    if (n.destructive) {
                      setConfirm({
                        title: n.label,
                        message: `تغییر وضعیت سفارش به «${n.label}» قطعی است. ادامه می‌دهید؟`,
                        actionLabel: n.label,
                        onConfirm: () => applyStatus(),
                      });
                    }
                  }}
                >
                  {n.destructive && <XCircle className="h-4 w-4" />}
                  {n.label}
                </Button>
              ))
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Items + timeline */}
          <div className="space-y-6">
            <Card>
              <CardContent className="space-y-4 p-5">
                <h2 className="flex items-center gap-2 text-sm font-bold">
                  <Package className="h-4 w-4 text-primary" /> اقلام سفارش
                </h2>
                {order.items.map((item) => (
                  <div key={item.variant_id} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="flex gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                        {item.image ? (
                          <img src={item.image} alt={item.product_name} className="h-full w-full object-cover" />
                        ) : (
                          <Store className="m-3 h-6 w-6 text-muted-foreground/40" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.variant_name ? `${item.variant_name} · ` : ""}
                          <span className="font-mono" dir="ltr">{item.sku}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {toFa(item.qty)} × {formatToman(item.unit_price)} = {formatToman(item.line_total)} تومان
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-5">
                <h2 className="flex items-center gap-2 text-sm font-bold">
                  <Clock className="h-4 w-4 text-primary" /> تاریخچه
                </h2>
                <ol className="space-y-3">
                  {order.timeline.map((event, idx) => (
                    <li key={idx} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
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

          {/* Customer + address + totals */}
          <div className="space-y-6">
            <Card>
              <CardContent className="space-y-2 p-5 text-xs leading-6">
                <h2 className="flex items-center gap-2 text-sm font-bold">
                  <User className="h-4 w-4 text-primary" /> مشتری
                </h2>
                <p className="text-sm font-bold">{order.customer_name}</p>
                <p className="flex items-center gap-1 text-muted-foreground" dir="ltr">
                  <Phone className="h-3 w-3" /> {toFa(order.customer_phone)}
                </p>
                {order.customer_note && (
                  <p className="border-t border-border pt-2 text-muted-foreground">یادداشت مشتری: {order.customer_note}</p>
                )}
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
                {order.tracking_code && (
                  <p className="border-t border-border pt-2 text-muted-foreground">
                    کد رهگیری پستی: <span className="font-mono" dir="ltr">{toFa(order.tracking_code)}</span>
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-5 text-sm">
                <h2 className="text-sm font-bold">مالی</h2>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">جمع اقلام</span>
                  <span>{formatToman(order.subtotal)} تومان</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">ارسال</span>
                  <span>{order.shipping_fee === 0 ? "رایگان" : `${formatToman(order.shipping_fee)} تومان`}</span>
                </div>
                {order.coupon_discount > 0 && (
                  <div className="flex justify-between text-xs text-success">
                    <span>تخفیف کد {order.coupon_code}</span>
                    <span>−{formatToman(order.coupon_discount)} تومان</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-3">
                  <span className="font-bold">مبلغ کل</span>
                  <span className="text-base font-black text-primary">{formatToman(order.total)} تومان</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Status change dialog (non-destructive transitions) */}
        <Dialog open={!!action && !confirm} onClose={() => setAction(null)} title={action?.label}>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>یادداشت (اختیاری)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً: تحویل به پست" />
            </div>
            {action?.value === "shipped" && (
              <div className="space-y-1.5">
                <Label>کد رهگیری پستی</Label>
                <Input dir="ltr" value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} placeholder="مثلاً: 241234567890123456789" />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setAction(null)}>انصراف</Button>
              <Button disabled={busy} onClick={applyStatus}>تأیید</Button>
            </div>
          </div>
        </Dialog>

        <ConfirmDialog confirm={confirm} onClose={() => { setConfirm(null); setAction(null); }} />
      </div>
    </PageTransition>
  );
}
