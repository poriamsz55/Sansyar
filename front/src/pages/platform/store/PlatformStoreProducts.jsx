import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Plus, Pencil, Trash2, EyeOff, Eye, Package, ImageIcon,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
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
  adminListStoreProducts,
  adminCreateStoreProduct,
  adminDeleteStoreProduct,
  adminPublishStoreProduct,
  adminUnpublishStoreProduct,
  adminListStoreCategories,
  adminListStoreBrands,
} from "@/api/endpoints";
import { formatToman, toFa } from "@/lib/utils";

const RIAL_PER_TOMAN = 10;

const emptyForm = {
  name: "",
  description: "",
  category_id: "",
  brand_id: "",
  images: [],
  price_toman: "",
  original_toman: "",
  stock: "",
  status: "published",
};

/** Images are stored as [{url, alt, is_primary}]; first upload = primary. */
function toImageObjects(urls) {
  return (urls || []).map((url, i) => ({ url, alt: "", is_primary: i === 0 }));
}

function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ\s-]/g, "")
    .replace(/\s+/g, "-");
}

/**
 * Store Admin — product management: list with publish toggle, create/edit
 * dialog with images, price (entered in Toman, stored in Rial) and stock.
 */
export default function PlatformStoreProducts() {
  const [result, setResult] = useState(null); // { items, total, page, limit }
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const res = await adminListStoreProducts({
        q: q || undefined,
        status: statusFilter || undefined,
        page: 1,
        limit: 50,
      });
      setResult(res);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    adminListStoreCategories().then(setCategories).catch(() => {});
    adminListStoreBrands().then(setBrands).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, statusFilter]);

  function openCreate() {
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(item) {
    // Full editing (variants, images, attributes) lives on the product page.
    navigate(`/platform/store/products/${item.id}`);
  }

  async function submit(e) {
    e.preventDefault();
    const price = Number(form.price_toman) * RIAL_PER_TOMAN;
    const original = form.original_toman ? Number(form.original_toman) * RIAL_PER_TOMAN : 0;
    if (!price || price <= 0) {
      toast("قیمت محصول را وارد کنید", "error");
      return;
    }
    setSaving(true);
    try {
      const created = await adminCreateStoreProduct({
        name: form.name,
        slug: slugify(form.name),
        description: form.description,
        category_id: form.category_id,
        brand_id: form.brand_id,
        images: toImageObjects(form.images),
        price,
        original_price: original,
        stock: Number(form.stock || 0),
        status: form.status,
      });
      toast("محصول ایجاد شد");
      // Continue full configuration on the product page.
      navigate(`/platform/store/products/${created.id}`);
      setOpen(false);
      load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(item) {
    try {
      if (item.status === "published") {
        await adminUnpublishStoreProduct(item.id);
        toast("محصول از فروشگاه خارج شد");
      } else {
        await adminPublishStoreProduct(item.id);
        toast("محصول در فروشگاه منتشر شد");
      }
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  function askDelete(item) {
    setConfirm({
      title: "حذف محصول",
      message: `آیا از حذف «${item.name}» مطمئن هستید؟ این عملیات قابل بازگشت نیست.`,
      actionLabel: "حذف",
      onConfirm: async () => {
        try {
          await adminDeleteStoreProduct(item.id);
          toast("محصول حذف شد");
          load();
        } catch (err) {
          toast(err.message, "error");
        }
      },
    });
  }

  const items = result?.items || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <Input
            placeholder="جستجوی محصول…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-36"
          >
            <option value="">همه وضعیت‌ها</option>
            <option value="published">منتشرشده</option>
            <option value="draft">پیش‌نویس</option>
          </Select>
          <p className="text-sm text-muted-foreground">
            {result ? `${toFa(result.total)} محصول` : "..."}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> محصول جدید
        </Button>
      </div>

      <Card>
        <CardContent className="px-0 py-0">
          {loading ? (
            <Skeleton className="m-4 h-48" />
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <Package className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                هنوز محصولی ثبت نشده است. اولین محصول فروشگاه را بسازید.
              </p>
              <Button onClick={openCreate} size="sm">
                <Plus className="h-4 w-4" /> محصول جدید
              </Button>
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>محصول</TH>
                  <TH>دسته / برند</TH>
                  <TH>قیمت</TH>
                  <TH>موجودی</TH>
                  <TH>وضعیت</TH>
                  <TH>عملیات</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                          {p.primary_image ? (
                            <img src={p.primary_image} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                          )}
                        </span>
                        <span className="font-medium">{p.name}</span>
                      </div>
                    </TD>
                    <TD className="text-xs text-muted-foreground">
                      {categories.find((c) => c.id === p.category_id)?.name || "—"}
                      <br />
                      {brands.find((b) => b.id === p.brand_id)?.name || ""}
                    </TD>
                    <TD>
                      <span className="font-bold">{formatToman(p.price_from)} ت</span>
                      {p.original_from > p.price_from && (
                        <span className="mr-1 text-xs text-muted-foreground line-through">
                          {formatToman(p.original_from)}
                        </span>
                      )}
                    </TD>
                    <TD>
                      {(p.available_stock ?? 0) <= 0 ? (
                        <Badge tone="destructive">ناموجود</Badge>
                      ) : p.available_stock <= 3 ? (
                        <Badge tone="warning">{toFa(p.available_stock)} عدد</Badge>
                      ) : (
                        <Badge tone="success">{toFa(p.available_stock)} عدد</Badge>
                      )}
                    </TD>
                    <TD>
                      <Badge tone={p.status === "published" ? "success" : "muted"}>
                        {p.status === "published" ? "منتشرشده" : "پیش‌نویس"}
                      </Badge>
                    </TD>
                    <TD>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(p)} title="ویرایش">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => togglePublish(p)}
                          title={p.status === "published" ? "لغو انتشار" : "انتشار"}
                        >
                          {p.status === "published" ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4 text-success" />
                          )}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => askDelete(p)} title="حذف">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="محصول جدید (قیمت و موجودی پایه)"
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>نام محصول</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>دسته‌بندی</Label>
              <Select
                value={form.category_id}
                onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
              >
                <option value="">— بدون دسته —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>برند</Label>
              <Select
                value={form.brand_id}
                onChange={(e) => setForm((f) => ({ ...f, brand_id: e.target.value }))}
              >
                <option value="">— بدون برند —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>توضیحات</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>تصاویر محصول (اولین تصویر = اصلی)</Label>
            <ImageUpload
              value={form.images}
              onChange={(urls) => setForm((f) => ({ ...f, images: urls }))}
              folder="store/products"
              admin
              max={6}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>قیمت (تومان)</Label>
              <Input
                type="number"
                min="1000"
                step="1000"
                value={form.price_toman}
                onChange={(e) => setForm((f) => ({ ...f, price_toman: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>قیمت قبل از تخفیف</Label>
              <Input
                type="number"
                min="0"
                step="1000"
                value={form.original_toman}
                onChange={(e) => setForm((f) => ({ ...f, original_toman: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>موجودی</Label>
              <Input
                type="number"
                min="0"
                value={form.stock}
                onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                required
              />
            </div>
          </div>
          {form.price_toman && (
            <p className="text-xs text-muted-foreground">
              قیمت نهایی: {formatToman(Number(form.price_toman) * RIAL_PER_TOMAN)} تومان
              {form.original_toman && Number(form.original_toman) > Number(form.price_toman) && (
                <span className="mr-2 text-destructive">
                  ({toFa(Math.round((1 - Number(form.price_toman) / Number(form.original_toman)) * 100))}٪ تخفیف)
                </span>
              )}
            </p>
          )}
          <div className="space-y-1.5">
            <Label>وضعیت انتشار</Label>
            <Select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="published">منتشرشده در فروشگاه</option>
              <option value="draft">پیش‌نویس (مخفی)</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner /> : <Plus className="h-4 w-4" />}
              {"ایجاد و ادامه"}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
