import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight, Plus, Pencil, Trash2, Star, Save, Package, ImageIcon, X,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ImageUpload } from "@/components/ImageUpload";
import { toast } from "@/components/Toast";
import {
  adminGetStoreProduct,
  adminUpdateStoreProduct,
  adminCreateStoreVariant,
  adminUpdateStoreVariant,
  adminDeleteStoreVariant,
  adminListStoreCategories,
  adminListStoreBrands,
} from "@/api/endpoints";
import { formatToman, toFa } from "@/lib/utils";

const RIAL_PER_TOMAN = 10;

/**
 * Store Admin — full product editor: basic info, image management with
 * primary selection, variant management (SKU/price/stock/options) and
 * specification attributes.
 */
export default function PlatformStoreProductEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  // Basic info form (name/description/category/brand/status/slug).
  const [form, setForm] = useState(null);
  // Images as URL list; first = primary (backend normalises).
  const [imageUrls, setImageUrls] = useState([]);
  // Specification attributes editor state.
  const [attrs, setAttrs] = useState(null);

  // Variant dialog state.
  const [variantOpen, setVariantOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [variantForm, setVariantForm] = useState(null);
  const [variantSaving, setVariantSaving] = useState(false);

  async function load() {
    const [d, cats, brs] = await Promise.all([
      adminGetStoreProduct(id),
      adminListStoreCategories(),
      adminListStoreBrands(),
    ]);
    setDetail(d);
    setCategories(cats);
    setBrands(brs);
    setForm({
      name: d.name,
      slug: d.slug,
      description: d.description || "",
      category_id: d.category_id || "",
      brand_id: d.brand_id || "",
      status: d.status,
    });
    setImageUrls((d.images || []).map((img) => img.url));
  }

  useEffect(() => {
    load().catch((err) => {
      toast(err.message, "error");
      navigate("/platform/store/products");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!detail || !form) {
    return <Skeleton className="h-96" />;
  }

  async function saveBasic(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const d = await adminUpdateStoreProduct(id, {
        ...form,
        // Re-send the (possibly reordered) image list; first = primary.
        images: imageUrls.filter(Boolean).map((url, i) => ({ url, alt: "", is_primary: i === 0 })),
      });
      setDetail(d);
      setImageUrls((d.images || []).map((img) => img.url));
      toast("اطلاعات محصول ذخیره شد");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function setPrimary(url) {
    setImageUrls((urls) => [url, ...urls.filter((u) => u !== url)]);
  }

  function removeImage(url) {
    setImageUrls((urls) => urls.filter((u) => u !== url));
  }

  // ---- Variants ----

  function openVariantCreate() {
    setEditingVariant(null);
    setVariantForm({
      name: "",
      options: [{ key: "", value: "" }],
      sku: "",
      price_toman: "",
      original_toman: "",
      stock: "",
      is_active: true,
    });
    setVariantOpen(true);
  }

  function openVariantEdit(variant) {
    setEditingVariant(variant);
    setVariantForm({
      name: variant.name === "default" ? "" : variant.name,
      options: (variant.options || []).length
        ? variant.options.map((o) => ({ ...o }))
        : [{ key: "", value: "" }],
      sku: variant.sku,
      price_toman: String(Math.round(variant.price / RIAL_PER_TOMAN)),
      original_toman: variant.original_price ? String(Math.round(variant.original_price / RIAL_PER_TOMAN)) : "",
      stock: String(variant.stock),
      is_active: variant.is_active,
    });
    setVariantOpen(true);
  }

  async function submitVariant(e) {
    e.preventDefault();
    const price = Number(variantForm.price_toman) * RIAL_PER_TOMAN;
    if (!price || price <= 0) {
      toast("قیمت گونه را وارد کنید", "error");
      return;
    }
    const options = variantForm.options
      .filter((o) => o.key.trim() && o.value.trim())
      .map((o) => ({ key: o.key.trim(), value: o.value.trim() }));
    const payload = {
      name: variantForm.name.trim(),
      options,
      sku: variantForm.sku.trim(),
      price,
      original_price: variantForm.original_toman ? Number(variantForm.original_toman) * RIAL_PER_TOMAN : 0,
      stock: Number(variantForm.stock || 0),
      is_active: variantForm.is_active,
    };
    setVariantSaving(true);
    try {
      const d = editingVariant
        ? await adminUpdateStoreVariant(editingVariant.id, payload)
        : await adminCreateStoreVariant(id, payload);
      setDetail(d);
      setVariantOpen(false);
      toast(editingVariant ? "گونه به‌روزرسانی شد" : "گونه جدید اضافه شد");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setVariantSaving(false);
    }
  }

  function askDeleteVariant(variant) {
    setConfirm({
      title: "حذف گونه",
      message: `آیا از حذف «${variant.name}» مطمئن هستید؟ هر محصول باید حداقل یک گونه داشته باشد.`,
      actionLabel: "حذف",
      onConfirm: async () => {
        try {
          const d = await adminDeleteStoreVariant(variant.id);
          setDetail(d);
          toast("گونه حذف شد");
        } catch (err) {
          toast(err.message, "error");
        }
      },
    });
  }

  // ---- Attributes ----

  useEffect(() => {
    if (detail && attrs === null) {
      setAttrs((detail.attributes || []).map((a) => ({ ...a })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  async function saveAttributes() {
    const cleaned = attrs.filter((a) => a.key.trim() && a.value.trim());
    try {
      const d = await adminUpdateStoreProduct(id, { attributes: cleaned });
      setDetail(d);
      setAttrs((d.attributes || []).map((a) => ({ ...a })));
      toast("مشخصات ذخیره شد");
    } catch (err) {
      toast(err.message, "error");
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/platform/store/products")} aria-label="بازگشت">
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-lg font-bold">{detail.name}</h2>
            <p className="text-xs text-muted-foreground">
              {toFa(detail.total_stock)} موجودی کل · {toFa(detail.available_stock)} قابل فروش ·{" "}
              <span className="font-mono" dir="ltr">{detail.slug}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={detail.status === "published" ? "success" : "muted"}>
            {detail.status === "published" ? "منتشرشده" : "پیش‌نویس"}
          </Badge>
          <Link to={`/store/products/${encodeURIComponent(detail.slug || detail.id)}`}>
            <Button variant="outline" size="sm">مشاهده در فروشگاه</Button>
          </Link>
        </div>
      </div>

      {/* Basic info + images */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">اطلاعات پایه</CardTitle>
            <CardDescription>نام، دسته، برند و وضعیت انتشار</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveBasic} className="space-y-4">
              <div className="space-y-1.5">
                <Label>نام محصول</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>نامک (slug)</Label>
                <Input dir="ltr" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>دسته‌بندی</Label>
                  <Select value={form.category_id} onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}>
                    <option value="">— بدون دسته —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>برند</Label>
                  <Select value={form.brand_id} onChange={(e) => setForm((f) => ({ ...f, brand_id: e.target.value }))}>
                    <option value="">— بدون برند —</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>توضیحات</Label>
                <Textarea rows={4} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>وضعیت انتشار</Label>
                <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="published">منتشرشده در فروشگاه</option>
                  <option value="draft">پیش‌نویس (مخفی)</option>
                </Select>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving ? <Spinner /> : <Save className="h-4 w-4" />} ذخیره اطلاعات
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Images */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">تصاویر محصول</CardTitle>
            <CardDescription>اولین تصویر یا تصویر علامت‌دار، تصویر اصلی فروشگاه است</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {imageUrls.length === 0 && (
              <p className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
                <ImageIcon className="h-4 w-4" /> هنوز تصویری بارگذاری نشده است
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {imageUrls.map((url, i) => (
                <div key={url} className="group relative h-24 w-24 overflow-hidden rounded-lg border border-border">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  {i === 0 && (
                    <span className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-amber-400">
                      <Star className="h-3.5 w-3.5 fill-amber-400" />
                    </span>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    {i !== 0 && (
                      <button
                        type="button"
                        onClick={() => setPrimary(url)}
                        title="تبدیل به تصویر اصلی"
                        className="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-amber-500 hover:bg-white"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      title="حذف"
                      className="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-destructive hover:bg-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <ImageUpload
              value={[]}
              onChange={(urls) => {
                if (urls.length) setImageUrls((prev) => [...prev, ...urls]);
              }}
              folder="store/products"
              admin
              max={6}
            />
            <p className="text-[11px] text-muted-foreground">
              برای اعمال ترتیب و حذف‌ها، «ذخیره اطلاعات» را بزنید.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Variants */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">گونه‌ها و موجودی</CardTitle>
            <CardDescription>هر ترکیب سایز/رنگ یک گونه با کد کالا و موجودی مستقل است</CardDescription>
          </div>
          <Button size="sm" onClick={openVariantCreate}>
            <Plus className="h-4 w-4" /> گونه جدید
          </Button>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <Table>
            <THead>
              <TR>
                <TH>گونه</TH>
                <TH>کد کالا (SKU)</TH>
                <TH>قیمت</TH>
                <TH>موجودی</TH>
                <TH>وضعیت</TH>
                <TH>عملیات</TH>
              </TR>
            </THead>
            <TBody>
              {detail.variants.map((v) => (
                <TR key={v.id}>
                  <TD className="font-medium">
                    {(v.options || []).length > 0
                      ? v.options.map((o) => `${o.key} ${o.value}`).join(" / ")
                      : v.name === "default" ? "— (بدون گونه)" : v.name}
                  </TD>
                  <TD className="font-mono text-xs text-muted-foreground" dir="ltr">{v.sku}</TD>
                  <TD>
                    <span className="font-bold">{formatToman(v.price)} ت</span>
                    {v.original_price > v.price && (
                      <span className="mr-1 text-xs text-muted-foreground line-through">
                        {formatToman(v.original_price)}
                      </span>
                    )}
                  </TD>
                  <TD>
                    {v.stock - (v.reserved || 0) <= 0 ? (
                      <Badge tone="destructive">ناموجود</Badge>
                    ) : (
                      <span>
                        {toFa(v.stock - (v.reserved || 0))}
                        {v.reserved > 0 && (
                          <span className="mr-1 text-[10px] text-muted-foreground">
                            ({toFa(v.reserved)} رزرو)
                          </span>
                        )}
                      </span>
                    )}
                  </TD>
                  <TD>
                    <Badge tone={v.is_active ? "success" : "muted"}>{v.is_active ? "فعال" : "غیرفعال"}</Badge>
                  </TD>
                  <TD>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openVariantEdit(v)} title="ویرایش">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => askDeleteVariant(v)} title="حذف">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* Attributes */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">مشخصات محصول</CardTitle>
            <CardDescription>جدول مشخصات نمایش داده شده در صفحه محصول</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setAttrs((a) => [...(a || []), { key: "", value: "" }])}>
              <Plus className="h-4 w-4" /> ردیف جدید
            </Button>
            <Button size="sm" onClick={saveAttributes}>
              <Save className="h-4 w-4" /> ذخیره مشخصات
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {(attrs || []).map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="عنوان (مثلاً جنس)"
                value={a.key}
                onChange={(e) => setAttrs((prev) => prev.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}
                className="flex-1"
              />
              <Input
                placeholder="مقدار (مثلاً چرم)"
                value={a.value}
                onChange={(e) => setAttrs((prev) => prev.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setAttrs((prev) => prev.filter((_, j) => j !== i))}
                aria-label="حذف ردیف"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {(attrs || []).length === 0 && (
            <p className="text-xs text-muted-foreground">مشخصه‌ای ثبت نشده است.</p>
          )}
        </CardContent>
      </Card>

      {/* Variant dialog */}
      <Dialog
        open={variantOpen}
        onClose={() => setVariantOpen(false)}
        title={editingVariant ? "ویرایش گونه" : "گونه جدید"}
      >
        <form onSubmit={submitVariant} className="space-y-4">
          <div className="space-y-1.5">
            <Label>نام نمایشی (اختیاری — از گزینه‌ها ساخته می‌شود)</Label>
            <Input value={variantForm.name} onChange={(e) => setVariantForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>گزینه‌ها (مثلاً سایز / ۴۲)</Label>
            {variantForm.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  placeholder="عنوان"
                  value={o.key}
                  onChange={(e) => setVariantForm((f) => ({
                    ...f,
                    options: f.options.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)),
                  }))}
                  className="flex-1"
                />
                <Input
                  placeholder="مقدار"
                  value={o.value}
                  onChange={(e) => setVariantForm((f) => ({
                    ...f,
                    options: f.options.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)),
                  }))}
                  className="flex-1"
                />
                {variantForm.options.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setVariantForm((f) => ({ ...f, options: f.options.filter((_, j) => j !== i) }))}
                    aria-label="حذف گزینه"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setVariantForm((f) => ({ ...f, options: [...f.options, { key: "", value: "" }] }))}
            >
              <Plus className="h-4 w-4" /> گزینه جدید
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label>کد کالا / SKU (خالی = خودکار)</Label>
            <Input dir="ltr" value={variantForm.sku} onChange={(e) => setVariantForm((f) => ({ ...f, sku: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>قیمت (تومان)</Label>
              <Input
                type="number" min="1000" step="1000"
                value={variantForm.price_toman}
                onChange={(e) => setVariantForm((f) => ({ ...f, price_toman: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>قبل از تخفیف</Label>
              <Input
                type="number" min="0" step="1000"
                value={variantForm.original_toman}
                onChange={(e) => setVariantForm((f) => ({ ...f, original_toman: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>موجودی</Label>
              <Input
                type="number" min="0"
                value={variantForm.stock}
                onChange={(e) => setVariantForm((f) => ({ ...f, stock: e.target.value }))}
                required
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={variantForm.is_active}
              onChange={(e) => setVariantForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="h-4 w-4 accent-[hsl(var(--primary))]"
            />
            گونه فعال (قابل فروش)
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setVariantOpen(false)}>انصراف</Button>
            <Button type="submit" disabled={variantSaving}>
              {variantSaving ? <Spinner /> : <Package className="h-4 w-4" />}
              {editingVariant ? "ذخیره" : "افزودن"}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
