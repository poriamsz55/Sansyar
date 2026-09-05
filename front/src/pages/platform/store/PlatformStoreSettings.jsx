import { useEffect, useState } from "react";
import { Plus, Save, Store, Trash2, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/Toast";
import { PageTransition } from "@/components/PageTransition";
import { getStoreSettings, adminUpdateStoreSettings } from "@/api/endpoints";
import { formatToman } from "@/lib/utils";

const emptyMethod = { id: "", name: "", feeToman: 0, eta_days: 2, is_active: true };

/** Platform: store settings — storefront info + shipping methods. */
export default function PlatformStoreSettings() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getStoreSettings().then((s) => {
      setSettings(s);
      setForm({
        name: s.name || "",
        tagline: s.tagline || "",
        support_phone: s.support_phone || "",
        is_open: s.is_open,
        shipping_methods: (s.shipping_methods || []).map((m) => ({
          id: m.id,
          name: m.name,
          feeToman: Math.round(m.fee / 10),
          eta_days: m.eta_days,
          is_active: m.is_active,
        })),
      });
    }).catch((err) => toast(err.message, "error"));
  }, []);

  if (!form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  function setMethod(idx, patch) {
    setForm((f) => ({
      ...f,
      shipping_methods: f.shipping_methods.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    }));
  }

  async function save() {
    if (!form.name.trim()) {
      toast("نام فروشگاه را وارد کنید", "error");
      return;
    }
    const methods = form.shipping_methods.filter((m) => m.id.trim() && m.name.trim());
    if (methods.length === 0) {
      toast("حداقل یک روش ارسال لازم است", "error");
      return;
    }
    setSaving(true);
    try {
      await adminUpdateStoreSettings({
        name: form.name.trim(),
        tagline: form.tagline.trim(),
        support_phone: form.support_phone.trim(),
        is_open: form.is_open,
        shipping_methods: methods.map((m) => ({
          id: m.id.trim(),
          name: m.name.trim(),
          fee: Math.round((m.feeToman || 0) * 10),
          eta_days: parseInt(m.eta_days, 10) || 0,
          is_active: m.is_active,
        })),
      });
      toast("تنظیمات ذخیره شد");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black">تنظیمات فروشگاه</h1>
            <p className="mt-1 text-xs text-muted-foreground">اطلاعات فروشگاه و روش‌های ارسال</p>
          </div>
          <Button onClick={save} disabled={saving}>
            <Save className="h-4 w-4" /> ذخیره
          </Button>
        </div>

        <Card>
          <CardContent className="space-y-4 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Store className="h-4 w-4 text-primary" /> اطلاعات فروشگاه
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>نام فروشگاه</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>تلفن پشتیبانی</Label>
                <Input dir="ltr" value={form.support_phone} onChange={(e) => setForm((f) => ({ ...f, support_phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>شعار / توضیح کوتاه</Label>
                <Input value={form.tagline} onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm">
              <input
                type="checkbox"
                checked={form.is_open}
                onChange={(e) => setForm((f) => ({ ...f, is_open: e.target.checked }))}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
              />
              فروشگاه باز است (پذیرش سفارش فعال)
            </label>
            {!form.is_open && (
              <p className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-700">
                توجه: بستن فروشگاه در این نسخه صرفاً اطلاع‌رسانی است و ثبت سفارش را مسدود نمی‌کند.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Truck className="h-4 w-4 text-primary" /> روش‌های ارسال
              </h2>
              <Button variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, shipping_methods: [...f.shipping_methods, { ...emptyMethod, id: `method-${Date.now() % 10000}` }] }))}>
                <Plus className="h-4 w-4" /> روش جدید
              </Button>
            </div>
            <div className="space-y-3">
              {form.shipping_methods.map((m, idx) => (
                <div key={idx} className="grid items-end gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_120px_100px_auto_auto]">
                  <div className="space-y-1.5">
                    <Label>نام روش</Label>
                    <Input value={m.name} onChange={(e) => setMethod(idx, { name: e.target.value })} placeholder="مثلاً پست پیشتاز" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>هزینه (تومان)</Label>
                    <Input dir="ltr" type="number" value={m.feeToman} onChange={(e) => setMethod(idx, { feeToman: parseInt(e.target.value, 10) || 0 })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>زمان (روز)</Label>
                    <Input dir="ltr" type="number" value={m.eta_days} onChange={(e) => setMethod(idx, { eta_days: parseInt(e.target.value, 10) || 0 })} />
                  </div>
                  <label className="flex cursor-pointer items-center gap-1.5 pb-2 text-xs">
                    <input type="checkbox" checked={m.is_active} onChange={(e) => setMethod(idx, { is_active: e.target.checked })} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                    فعال
                  </label>
                  <button
                    className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setForm((f) => ({ ...f, shipping_methods: f.shipping_methods.filter((_, i) => i !== idx) }))}
                    aria-label="حذف روش"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <p className="text-[10px] text-muted-foreground sm:col-span-5">
                    شناسه: <span className="font-mono" dir="ltr">{m.id}</span>
                    {m.feeToman > 0 ? ` — معادل ${formatToman(m.feeToman * 10)} ریال` : " — رایگان"}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              تغییر هزینه ارسال فقط روی سفارش‌های جدید اثر می‌گذارد؛ سفارش‌های قبلی snapshot خود را نگه می‌دارند.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
