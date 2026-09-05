import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, CreditCard, ShoppingCart, Trash2, Minus, Plus, AlertTriangle, PackageSearch,
} from "lucide-react";

import { PageTransition, EmptyState } from "@/components/PageTransition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";
import { ImagePreview } from "@/components/ImageUpload";
import { useCart } from "@/context/CartContext";
import { applyStoreCoupon, removeStoreCoupon } from "@/api/endpoints";
import { TicketPercent } from "lucide-react";
import { cn, formatToman, toFa } from "@/lib/utils";

/**
 * Cart page: every price and total is rendered from the backend cart view
 * (live catalog prices). Quantity changes, removals and issues (out of
 * stock / removed products) are all handled against server responses.
 */
export default function CartPage() {
  const { cart, ready, refresh, updateQty, removeItem, clearCart } = useCart();
  const [confirmClear, setConfirmClear] = useState(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);

  async function changeQty(item, nextQty) {
    try {
      await updateQty(item.variant_id, nextQty);
    } catch (err) {
      toast(err.message, "error");
      refresh();
    }
  }

  async function onRemove(item) {
    try {
      await removeItem(item.variant_id);
      toast("از سبد خرید حذف شد");
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function onApplyCoupon() {
    if (!couponCode.trim()) return;
    setCouponBusy(true);
    try {
      await applyStoreCoupon(couponCode.trim());
      toast("کد تخفیف اعمال شد");
      setCouponCode("");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setCouponBusy(false);
    }
  }

  async function onRemoveCoupon() {
    setCouponBusy(true);
    try {
      await removeStoreCoupon();
      toast("کد تخفیف حذف شد");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setCouponBusy(false);
    }
  }

  async function onClear() {
    try {
      await clearCart();
      toast("سبد خرید خالی شد");
    } catch (err) {
      toast(err.message, "error");
    }
  }

  if (!ready) {
    return (
      <div className="container py-16">
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-6 space-y-4">
          <div className="h-28 animate-pulse rounded-xl bg-muted" />
          <div className="h-28 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  if (!cart.items || cart.items.length === 0) {
    return (
      <PageTransition>
        <div className="container py-16">
          <EmptyState
            icon={ShoppingCart}
            title="سبد خرید شما خالی است"
            description="از فروشگاه ورزشی سانسیار دیدن کنید و محصولات دلخواهتان را اضافه کنید."
            action={
              <Link to="/store">
                <Button>
                  <PackageSearch className="h-4 w-4" /> رفتن به فروشگاه
                </Button>
              </Link>
            }
          />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="container py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-black">سبد خرید</h1>
          {cart.items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() =>
                setConfirmClear({
                  title: "خالی کردن سبد خرید",
                  message: "همه اقلام سبد خرید حذف شوند؟",
                  actionLabel: "خالی کن",
                  onConfirm: onClear,
                })
              }
            >
              <Trash2 className="h-3.5 w-3.5" /> خالی کردن سبد
            </Button>
          )}
        </div>

        {cart.has_issues && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              برخی اقلام سبد شما ناموجود شده‌اند یا موجودی‌شان کمتر از تعداد انتخابی است.
              برای ادامه، این اقلام را حذف کنید یا تعدادشان را کم کنید.
            </p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Items */}
          <div className="space-y-3">
            {cart.items.map((item) => {
              const overStock = !item.unavailable && item.qty > item.available;
              return (
                <Card key={item.variant_id} className={cn(item.unavailable && "opacity-70")}>
                  <CardContent className="flex gap-4 p-4">
                    <Link
                      to={item.slug ? `/store/products/${encodeURIComponent(item.slug)}` : "/store"}
                      className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted"
                    >
                      <ImagePreview src={item.image} alt={item.product_name} className="h-full w-full object-cover" />
                    </Link>
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link
                            to={item.slug ? `/store/products/${encodeURIComponent(item.slug)}` : "/store"}
                            className="text-sm font-bold hover:text-primary"
                          >
                            {item.product_name}
                          </Link>
                          {item.variant_name && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{item.variant_name}</p>
                          )}
                        </div>
                        <button
                          onClick={() => onRemove(item)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="حذف از سبد"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {item.unavailable ? (
                        <Badge tone="destructive" className="mt-1 w-fit">ناموجود — قابل خرید نیست</Badge>
                      ) : (
                        <>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <div className="flex items-center rounded-lg border border-border">
                              <button
                                onClick={() => changeQty(item, item.qty - 1)}
                                disabled={item.qty <= 1}
                                className="grid h-9 w-9 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40"
                                aria-label="کاهش"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="w-9 text-center text-sm font-bold">{toFa(item.qty)}</span>
                              <button
                                onClick={() => changeQty(item, item.qty + 1)}
                                disabled={item.qty >= item.available}
                                className="grid h-9 w-9 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40"
                                aria-label="افزایش"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-black text-primary">
                                {formatToman(item.line_total)}
                                <span className="text-[10px] font-medium"> تومان</span>
                              </p>
                              {item.original_price > item.unit_price && (
                                <p className="text-[11px] text-muted-foreground">
                                  هر واحد: {formatToman(item.unit_price)} تومان
                                  <span className="mr-1 line-through">{formatToman(item.original_price)}</span>
                                </p>
                              )}
                            </div>
                          </div>
                          {overStock && (
                            <p className="mt-1 text-[11px] text-amber-600">
                              تنها {toFa(item.available)} عدد موجود است — تعداد را کم کنید.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Summary */}
          <Card className="h-fit lg:sticky lg:top-20">
            <CardContent className="space-y-3 p-5">
              <h2 className="text-sm font-bold">خلاصه سفارش</h2>

              {/* Coupon */}
              {cart.coupon ? (
                <div className={`flex items-center justify-between rounded-lg border p-2.5 text-xs ${cart.coupon.discount > 0 ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}>
                  <span className="flex items-center gap-1.5 font-bold">
                    <TicketPercent className="h-3.5 w-3.5" />
                    <span dir="ltr">{cart.coupon.code}</span>
                    {cart.coupon.discount > 0
                      ? ` — ${formatToman(cart.coupon.discount)} تومان تخفیف`
                      : " — دیگر معتبر نیست"}
                  </span>
                  <button onClick={onRemoveCoupon} disabled={couponBusy} className="text-muted-foreground hover:text-destructive">
                    حذف
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="کد تخفیف دارید؟"
                    dir="ltr"
                    className="text-left"
                  />
                  <Button variant="outline" onClick={onApplyCoupon} disabled={couponBusy || !couponCode.trim()}>
                    اعمال
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  جمع اقلام ({toFa(cart.item_count)} عدد)
                </span>
                <span className="font-bold">{formatToman(cart.subtotal)} تومان</span>
              </div>
              {(cart.discount || 0) > 0 && (
                <div className="flex items-center justify-between text-sm text-success">
                  <span>تخفیف</span>
                  <span className="font-bold">−{formatToman(cart.discount)} تومان</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="font-bold">مبلغ قابل پرداخت</span>
                <span className="text-base font-black text-primary">
                  {formatToman(cart.total)} تومان
                </span>
              </div>
              <p className="text-[11px] leading-5 text-muted-foreground">
                هزینه ارسال در مرحله پرداخت و پس از انتخاب آدرس محاسبه می‌شود.
              </p>
              <Link to="/store/checkout" className="block">
                <Button className="w-full" size="lg" disabled={cart.has_issues}>
                  <CreditCard className="h-4 w-4" /> تکمیل خرید و ثبت سفارش
                </Button>
              </Link>
              <Link to="/store" className="block">
                <Button variant="outline" className="w-full">
                  ادامه خرید
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <ConfirmDialog confirm={confirmClear} onClose={() => setConfirmClear(null)} />
      </div>
    </PageTransition>
  );
}
