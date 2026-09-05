import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BadgeCheck, CreditCard, Landmark, ShieldCheck, XCircle } from "lucide-react";

import { PageTransition, EmptyState } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/Toast";
import { getMyStoreOrder, completeStorePayment } from "@/api/endpoints";
import { formatToman } from "@/lib/utils";

/**
 * Dev payment gateway: simulates an external PSP (like Zarinpal) with
 * success/cancel outcomes. The amount shown comes from the order document —
 * the completion call never sends money data, only the outcome.
 */
export default function PaymentPage() {
  const { paymentId } = useParams();
  const [params] = useSearchParams();
  const orderId = params.get("order");
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setError("شناسه سفارش نامعتبر است");
      return;
    }
    getMyStoreOrder(orderId)
      .then(setOrder)
      .catch((err) => setError(err.message));
  }, [orderId]);

  async function complete(result) {
    setBusy(true);
    try {
      const { order: updated } = await completeStorePayment(paymentId, result);
      if (result === "success") {
        toast("پرداخت با موفقیت انجام شد");
        navigate(`/store/orders/${updated.id}?paid=1`);
      } else {
        toast("پرداخت لغو شد", "error");
        navigate(`/store/orders/${updated.id}`);
      }
    } catch (err) {
      toast(err.message, "error");
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="container py-16">
        <EmptyState
          icon={CreditCard}
          title="دسترسی به پرداخت ممکن نیست"
          description={error}
          action={<Button onClick={() => navigate("/store/orders")}>سفارش‌های من</Button>}
        />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container max-w-md py-12">
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="container max-w-md py-12">
        <Card>
          <CardContent className="space-y-5 p-6 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10">
              <Landmark className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-black">درگاه پرداخت آزمایشی سانسیار</h1>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                این درگاه برای توسعه و تست ساخته شده؛ در استقرار واقعی به‌جای آن به
                درگاه بانکی منتقل می‌شوید.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
              <p className="text-muted-foreground">سفارش</p>
              <p className="mt-1 font-mono text-xs" dir="ltr">#{order.id.slice(0, 8)}</p>
            </div>

            <div className="text-sm">
              مبلغ قابل پرداخت
              <p className="mt-1 text-xl font-black text-primary">{formatToman(order.total)} تومان</p>
            </div>

            <div className="space-y-2">
              <Button className="w-full" size="lg" disabled={busy} onClick={() => complete("success")}>
                {busy ? "در حال پردازش…" : (<><BadgeCheck className="h-5 w-5" /> پرداخت موفق</>)}
              </Button>
              <Button variant="outline" className="w-full" disabled={busy} onClick={() => complete("failure")}>
                <XCircle className="h-4 w-4" /> انصراف از پرداخت
              </Button>
            </div>

            <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3" />
              مبلغ و وضعیت پرداخت صرفاً روی سرور اعتبارسنجی می‌شود
            </p>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
