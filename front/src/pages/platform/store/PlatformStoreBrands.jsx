import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Power, Award } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ImageUpload } from "@/components/ImageUpload";
import { toast } from "@/components/Toast";
import {
  adminListStoreBrands,
  adminCreateStoreBrand,
  adminUpdateStoreBrand,
  adminDeleteStoreBrand,
} from "@/api/endpoints";
import { toFa } from "@/lib/utils";

const empty = { name: "", slug: "", logo_url: "" };

function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ\s-]/g, "")
    .replace(/\s+/g, "-");
}

function logoUrlOf(brand) {
  return brand.logo_url || "";
}

/** Store Admin — brand management with single logo upload. */
export default function PlatformStoreBrands() {
  const [brands, setBrands] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  async function load() {
    try {
      setBrands(await adminListStoreBrands());
    } catch (err) {
      toast(err.message, "error");
      setBrands([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(brand) {
    setEditing(brand);
    setForm({ name: brand.name, slug: brand.slug, logo_url: logoUrlOf(brand) });
    setOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await adminUpdateStoreBrand(editing.id, form);
        toast("برند به‌روزرسانی شد");
      } else {
        await adminCreateStoreBrand(form);
        toast("برند ایجاد شد");
      }
      setOpen(false);
      load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(brand) {
    try {
      await adminUpdateStoreBrand(brand.id, { is_active: !brand.is_active });
      toast(brand.is_active ? "غیرفعال شد" : "فعال شد");
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  function askDelete(brand) {
    setConfirm({
      title: "حذف برند",
      message: `آیا از حذف «${brand.name}» مطمئن هستید؟ برندهای متصل به محصول قابل حذف نیستند.`,
      actionLabel: "حذف",
      onConfirm: async () => {
        try {
          await adminDeleteStoreBrand(brand.id);
          toast("برند حذف شد");
          load();
        } catch (err) {
          toast(err.message, "error");
        }
      },
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {brands ? `${toFa(brands.length)} برند` : "..."}
        </p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> برند جدید
        </Button>
      </div>

      <Card>
        <CardContent className="px-0 py-0">
          {!brands ? (
            <Skeleton className="m-4 h-48" />
          ) : brands.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <Award className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">هنوز برندی ثبت نشده است.</p>
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>لوگو</TH>
                  <TH>نام</TH>
                  <TH>نامک</TH>
                  <TH>وضعیت</TH>
                  <TH>عملیات</TH>
                </TR>
              </THead>
              <TBody>
                {brands.map((b) => (
                  <TR key={b.id}>
                    <TD>
                      <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg bg-muted">
                        {b.logo_url ? (
                          <img src={b.logo_url} alt={b.name} className="h-full w-full object-contain" />
                        ) : (
                          <Award className="h-4 w-4 text-muted-foreground/50" />
                        )}
                      </span>
                    </TD>
                    <TD className="font-medium">{b.name}</TD>
                    <TD className="font-mono text-sm text-muted-foreground" dir="ltr">{b.slug}</TD>
                    <TD>
                      <Badge tone={b.is_active ? "success" : "muted"}>
                        {b.is_active ? "فعال" : "غیرفعال"}
                      </Badge>
                    </TD>
                    <TD>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(b)} title="ویرایش">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(b)} title={b.is_active ? "غیرفعال‌سازی" : "فعال‌سازی"}>
                          <Power className={`h-4 w-4 ${b.is_active ? "text-success" : "text-muted-foreground"}`} />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => askDelete(b)} title="حذف">
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
        title={editing ? "ویرایش برند" : "برند جدید"}
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>نام</Label>
            <Input
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((f) => ({ ...f, name, slug: editing ? f.slug : slugify(name) }));
              }}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>نامک (slug)</Label>
            <Input
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              dir="ltr"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>لوگو (اختیاری)</Label>
            <ImageUpload
              value={form.logo_url ? [form.logo_url] : []}
              onChange={(urls) => setForm((f) => ({ ...f, logo_url: urls[0] || "" }))}
              folder="store/brands"
              admin
              max={1}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner /> : <Plus className="h-4 w-4" />}
              {editing ? "ذخیره" : "ایجاد"}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
