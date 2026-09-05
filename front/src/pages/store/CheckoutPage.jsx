import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, CreditCard, MapPin, Truck } from "lucide-react";

import { PageTransition, EmptyState } from "@/components/PageTransition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { toast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import {
  getStoreSettings,
  listStoreAddresses,
  storeCheckout,
} from "@/api/endpoints";
import { IRAN_PROVINCES } from "@/lib/constants";
import { cn, formatToman, toFa } from "@/lib/utils";

const emptyAddress = {
  title: "",
  receiver: "",
  phone: "",
  province: "تهران",
  city: "",
  postal_code: "",
  address: "",
  is_default: true,
};

/**
 * Checkout: address selection (saved or new), shipping method and the final
 * server-computed summary. Submitting creates a pending_payment order.
 */
export default function CheckoutPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { cart, ready, refresh } = useCart();

  const [addresses, setAddresses] = useState(null);
  const [settings, setSettings] = useState(null);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [newAddress, setNewAddress] = useState(emptyAddress);
  const [saveAddress, setSaveAddress] = useState(true);
  const [shippingMethodId, setShippingMethodId] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    Promise.all([listStoreAddresses(), getStoreSettings()])
      .then(([addrs, st]) => {
        setAddresses(addrs);
        setSettings(st);
        const def = addrs.find((a) => a.is_default) || addrs[0];
        if (def) {
          setSelectedAddressId(def.id);
        } else if (addrs.length === 0) {
          setUseNewAddress(true);
        }
        const firstMethod = (st.shipping_methods || []).find((m) => m.is_active);
        if (firstMethod) setShippingMethodId(firstMethod.id);
      })
      .catch((err) => toast(err.message, "error"));
  }, [isAuthenticated]);

  const method = useMemo(
    () => (settings?.shipping_methods || []).find((m) => m.id === shippingMethodId),
    [settings, shippingMethodId]
  );

  if (!isAuthenticated) {
    return (
      <div className="container py-16">
        <EmptyState
          icon={CreditCard}
          title="برای تکمیل خرید وارد شوید"
          description="برای ثبت سفارش نیاز به حساب کاربری دارید. کد تأیید برای شما پیامک می‌شود."
          action={<Button onClick={() => navigate("/login")}>ورود / ثبت‌نام</Button>}
        />
      </div>
    );
  }

  if (!ready || !addresses || !settings) {
    return (
      <div className="container py-16">
        <Skeleton className="h-10 w-48" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!cart.items || cart.items.length === 0) {
    return (
      <div className="container py-16">
        <EmptyState
          icon={Truck}
          title="سبد خرید شما خالی است"
          description="برای ثبت سفارش ابتدا محصولات مورد نظر را به سبد اضافه کنید."
          action={
            <Link to="/store">
              <Button>رفتن به فروشگاه</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const addressValid = useNewAddress
    ? newAddress.receiver.trim() && newAddress.phone.trim() &&
      newAddress.province && newAddress.city.trim() && newAddress.address.trim().length >= 5
    : !!selectedAddressId;

  async function submit() {
    if (!addressValid) {
      toast("آدرس ارسال را کامل کنید", "error");
      return;
    }
    if (!shippingMethodId) {
      toast("روش ارسال را انتخاب کنید", "error");
      return;
    }
    setSubmitting(true);
    try {
      const order = await storeCheckout({
        addressId: useNewAddress ? "" : selectedAddressId,
        newAddress: useNewAddress ? newAddress : null,
        saveAddress,
        shippingMethodId,
        customerNote: note,
        // A fresh key per submission attempt; retries of THIS submit reuse it.
        idempotencyKey: `co-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
      toast("سفارش ثبت شد");
      await refresh();
      navigate(`/store/orders/${order.id}`);
    } catch (err) {
      toast(err.message, "error");
      refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageTransition>
      <div className="container py-8">
        <h1 className="mb-6 text-xl font-black">تکمیل خرید</h1>

        {cart.has_issues && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            برخی اقلام سبد ناموجود شده‌اند. ابتدا{" "}
            <Link to="/store/cart" className="font-bold underline">سبد خرید</Link> را اصلاح کنید.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            {/* Address */}
            <Card>
              <CardContent className="space-y-4 p-5">
                <h2 className="flex items-center gap-2 text-sm font-bold">
                  <MapPin className="h-4 w-4 text-primary" /> آدرس تحویل سفارش
                </h2>

                {addresses.length > 0 && (
                  <div className="space-y-2">
                    {addresses.map((a) => (
                      <label
                        key={a.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                          !useNewAddress && selectedAddressId === a.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        )}
                      >
                        <input
                          type="radio"
                          name="address"
                          checked={!useNewAddress && selectedAddressId === a.id}
                          onChange={() => {
                            setUseNewAddress(false);
                            setSelectedAddressId(a.id);
                          }}
                          className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
                        />
                        <div className="flex-1 text-xs leading-6">
                          <p className="text-sm font-bold">
                            {a.title} {a.is_default && <Badge tone="primary" className="mr-1">پیش‌فرض</Badge>}
                          </p>
                          <p className="text-muted-foreground">
                            {a.receiver} · <span dir="ltr">{toFa(a.phone)}</span>
                          </p>
                          <p className="text-muted-foreground">
                            {a.province}، {a.city}، {a.address}
                            {a.postal_code ? ` — کدپستی ${toFa(a.postal_code)}` : ""}
                          </p>
                        </div>
                      </label>
                    ))}
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-3 text-sm transition-colors",
                        useNewAddress ? "border-primary bg-primary/5 font-bold" : "border-border text-muted-foreground hover:border-primary/40"
                      )}
                    >
                      <input
                        type="radio"
                        name="address"
                        checked={useNewAddress}
                        onChange={() => setUseNewAddress(true)}
                        className="h-4 w-4 accent-[hsl(var(--primary))]"
                      />
                      ارسال به آدرس جدید
                    </label>
                  </div>
                )}

                {useNewAddress && (
                  <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>عنوان (مثلاً خانه)</Label>
                        <Input
                          value={newAddress.title}
                          onChange={(e) => setNewAddress((f) => ({ ...f, title: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>نام گیرنده</Label>
                        <Input
                          value={newAddress.receiver}
                          onChange={(e) => setNewAddress((f) => ({ ...f, receiver: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>موبایل گیرنده</Label>
                        <Input
                          dir="ltr"
                          inputMode="tel"
                          value={newAddress.phone}
                          onChange={(e) => setNewAddress((f) => ({ ...f, phone: e.target.value }))}
                          placeholder="09xxxxxxxxx"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>استان</Label>
                        <Select
                          value={newAddress.province}
                          onChange={(e) => setNewAddress((f) => ({ ...f, province: e.target.value }))}
                        >
                          {IRAN_PROVINCES.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>شهر</Label>
                        <Input
                          value={newAddress.city}
                          onChange={(e) => setNewAddress((f) => ({ ...f, city: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>کد پستی</Label>
                        <Input
                          dir="ltr"
                          inputMode="numeric"
                          value={newAddress.postal_code}
                          onChange={(e) => setNewAddress((f) => ({ ...f, postal_code: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>نشانی کامل</Label>
                      <Textarea
                        rows={2}
                        value={newAddress.address}
                        onChange={(e) => setNewAddress((f) => ({ ...f, address: e.target.value }))}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={saveAddress}
                        onChange={(e) => setSaveAddress(e.target.checked)}
                        className="h-4 w-4 accent-[hsl(var(--primary))]"
                      />
                      این آدرس را برای سفارش‌های بعدی ذخیره کن
                    </label>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Shipping method */}
            <Card>
              <CardContent className="space-y-3 p-5">
                <h2 className="flex items-center gap-2 text-sm font-bold">
                  <Truck className="h-4 w-4 text-primary" /> روش ارسال
                </h2>
                {(settings.shipping_methods || []).filter((m) => m.is_active).map((m) => (
                  <label
                    key={m.id}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition-colors",
                      shippingMethodId === m.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="shipping"
                        checked={shippingMethodId === m.id}
                        onChange={() => setShippingMethodId(m.id)}
                        className="h-4 w-4 accent-[hsl(var(--primary))]"
                      />
                      <div>
                        <p className="text-sm font-bold">{m.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          تحویل تقریبی {toFa(m.eta_days)} روز کاری
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-black text-primary">
                      {m.fee === 0 ? "رایگان" : `${formatToman(m.fee)} ت`}
                    </span>
                  </label>
                ))}
                <div className="space-y-1.5 pt-2">
                  <Label>یادداشت سفارش (اختیاری)</Label>
                  <Textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="مثلاً: لطفاً بعد از ساعت ۱۷ تماس بگیرید"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary */}
          <Card className="h-fit lg:sticky lg:top-20">
            <CardContent className="space-y-3 p-5">
              <h2 className="text-sm font-bold">خلاصه سفارش</h2>
              <div className="max-h-48 space-y-2 overflow-y-auto text-xs">
                {cart.items.map((item) => (
                  <div key={item.variant_id} className="flex items-center justify-between gap-2">
                    <span className="line-clamp-1 text-muted-foreground">
                      {item.product_name}
                      {item.variant_name ? ` (${item.variant_name})` : ""} × {toFa(item.qty)}
                    </span>
                    <span className="shrink-0 font-medium">{formatToman(item.line_total)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5 border-t border-border pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">جمع اقلام</span>
                  <span>{formatToman(cart.subtotal)} تومان</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">هزینه ارسال</span>
                  <span>{method ? (method.fee === 0 ? "رایگان" : `${formatToman(method.fee)} تومان`) : "—"}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="font-bold">مبلغ قابل پرداخت</span>
                  <span className="text-base font-black text-primary">
                    {formatToman(cart.subtotal + (method?.fee || 0))} تومان
                  </span>
                </div>
              </div>
              <Button className="w-full" size="lg" disabled={submitting || cart.has_issues} onClick={submit}>
                {submitting ? <Spinner /> : <CheckCircle2 className="h-5 w-5" />}
                ثبت سفارش
              </Button>
              <p className="text-center text-[10px] leading-4 text-muted-foreground">
                مبلغ نهایی روی سرور محاسبه و ثبت می‌شود؛ پرداخت در مرحله بعد انجام می‌شود.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}
