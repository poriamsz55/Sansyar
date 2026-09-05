import { useCallback, useEffect, useState } from "react";
import { Percent, Plus, Tag, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";
import { PageTransition } from "@/components/PageTransition";
import {
  adminListStoreCoupons,
  adminCreateStoreCoupon,
  adminUpdateStoreCoupon,
  adminDeleteStoreCoupon,
} from "@/api/endpoints";
import { formatToman, toFa } from "@/lib/utils";

function toDateInput(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

const emptyForm = {
  code: "",
  type: "percent",
  valueToman: "",
  minToman: "",
  maxToman: "",
  usage_limit: "",
  per_user_limit: "1",
};

/** Platform: store coupon management (create, toggle, delete). */
export default function PlatformStoreCoupons() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(() => {
    setError(null);
    adminListStoreCoupons()
      .then(setItems)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  async function save() {
    if (!form.code.trim() || !form.valueToman) {
      toast("کد و مقدار تخفیف را وارد کنید", "error");
      return;
    }
    const type = form.type;
    const value = type === "percent" ? parseInt(form.valueToman, 10) : Math.round(parseFloat(form.valueToman) * 10);
    if (!value || value <= 0 || (type === "percent" && value > 100)) {
      toast("مقدار تخفیف نامعتبر است", "error");
      return;
    }
    setSaving(true);
    try {
      await adminCreateStoreCoupon({
        code: form.code.trim(),
        type,
        value,
        min_subtotal: form.minToman ? Math.round(parseFloat(form.minToman) * 10) : 0,
        max_discount: form.maxToman ? Math.round(parseFloat(form.maxToman) * 10) : 0,
        usage_limit: form.usage_limit ? parseInt(form.usage_limit, 10) : 0,
        per_user_limit: form.per_user_limit ? parseInt(form.per_user_limit, 10) : 0,
      });
      toast("کد تخفیف ساخته شد");
      setDialog(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item) {
    try {
      await adminUpdateStoreCoupon(item.id, { is_active: !item.is_active });
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function remove(item) {
    try {
      await adminDeleteStoreCoupon(item.id);
      toast("کد تخفیف حذف شد");
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black">کدهای تخفیف</h1>
            <p className="mt-1 text-xs text-muted-foreground">مدیریت کدهای تخفیف فروشگاه</p>
          </div>
          <Button onClick={() => setDialog(true)}>
            <Plus className="h-4 w-4" /> کد جدید
          </Button>
        </div>

        {error && <Card><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
        {!items && [...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}

        {items && items.length === 0 && (
          <Card><CardContent className="flex flex-col items-center gap-2 p-10 text-muted-foreground">
            <Tag className="h-8 w-8 opacity-40" />
            هنوز کد تخفیفی نساخته‌اید
          </CardContent></Card>
        )}

        {items && items.length > 0 && (
          <div className="space-y-3">
            {items.map((c) => (
              <Card key={c.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="flex items-center gap-2 font-mono font-black" dir="ltr">
                      {c.code}
                      <Badge tone={c.is_active ? "success" : "muted"}>{c.is_active ? "فعال" : "غیرفعال"}</Badge>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.type === "percent"
                        ? `${toFa(c.value)}٪ تخفیف${c.max_discount ? ` (حداکثر ${formatToman(c.max_discount)} تومان)` : ""}`
                        : `${formatToman(c.value)} تومان تخفیف`}
                      {c.min_subtotal > 0 && ` — سفارش بالای ${formatToman(c.min_subtotal)} تومان`}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      استفاده‌شده: {toFa(c.used_count)}{c.usage_limit > 0 ? ` از ${toFa(c.usage_limit)}` : " (نامحدود)"}
                      {c.per_user_limit > 0 && ` — هر مشتری ${toFa(c.per_user_limit)} بار`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => toggle(c)}>
                      {c.is_active ? "غیرفعال‌سازی" : "فعال‌سازی"}
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="text-destructive"
                      onClick={() => setConfirm({ title: `حذف ${c.code}`, message: "این کد تخفیف حذف شود؟", actionLabel: "حذف", onConfirm: () => remove(c) })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialog} onClose={() => setDialog(false)} title="کد تخفیف جدید">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>کد (لاتین، بدون فاصله)</Label>
              <Input dir="ltr" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="SPORT10" />
            </div>
            <div className="space-y-1.5">
              <Label>نوع</Label>
              <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                <option value="percent">درصدی</option>
                <option value="amount">مبلغ ثابت (تومان)</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{form.type === "percent" ? "درصد تخفیف" : "مبلغ تخفیف (تومان)"}</Label>
              <Input dir="ltr" type="number" value={form.valueToman} onChange={(e) => setForm((f) => ({ ...f, valueToman: e.target.value }))} placeholder={form.type === "percent" ? "10" : "50000"} />
            </div>
            {form.type === "percent" && (
              <div className="space-y-1.5">
                <Label>سقف تخفیف (تومان)</Label>
                <Input dir="ltr" type="number" value={form.maxToman} onChange={(e) => setForm((f) => ({ ...f, maxToman: e.target.value }))} placeholder="اختیاری" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>حداقل مبلغ سبد (تومان)</Label>
              <Input dir="ltr" type="number" value={form.minToman} onChange={(e) => setForm((f) => ({ ...f, minToman: e.target.value }))} placeholder="اختیاری" />
            </div>
            <div className="space-y-1.5">
              <Label>سقف کل استفاده</Label>
              <Input dir="ltr" type="number" value={form.usage_limit} onChange={(e) => setForm((f) => ({ ...f, usage_limit: e.target.value }))} placeholder="خالی = نامحدود" />
            </div>
            <div className="space-y-1.5">
              <Label>سقف استفاده هر مشتری</Label>
              <Input dir="ltr" type="number" value={form.per_user_limit} onChange={(e) => setForm((f) => ({ ...f, per_user_limit: e.target.value }))} placeholder="خالی = نامحدود" />
            </div>
          </div>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Percent className="h-3 w-3" /> مبالغ به تومان وارد می‌شوند و در سرور به ریال تبدیل و ذخیره می‌شوند.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setDialog(false)}>انصراف</Button>
            <Button disabled={saving} onClick={save}>ایجاد کد</Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </PageTransition>
  );
}
