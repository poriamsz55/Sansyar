import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Power, FolderTree } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";
import {
  adminListStoreCategories,
  adminCreateStoreCategory,
  adminUpdateStoreCategory,
  adminDeleteStoreCategory,
} from "@/api/endpoints";
import { toFa } from "@/lib/utils";

const empty = { name: "", slug: "", icon: "" };

function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ\s-]/g, "")
    .replace(/\s+/g, "-");
}

/** Store Admin — category management (create / edit / activate / delete). */
export default function PlatformStoreCategories() {
  const [categories, setCategories] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  async function load() {
    try {
      setCategories(await adminListStoreCategories());
    } catch (err) {
      toast(err.message, "error");
      setCategories([]);
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

  function openEdit(category) {
    setEditing(category);
    setForm({ name: category.name, slug: category.slug, icon: category.icon || "" });
    setOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await adminUpdateStoreCategory(editing.id, form);
        toast("دسته‌بندی به‌روزرسانی شد");
      } else {
        await adminCreateStoreCategory(form);
        toast("دسته‌بندی ایجاد شد");
      }
      setOpen(false);
      load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(category) {
    try {
      await adminUpdateStoreCategory(category.id, { is_active: !category.is_active });
      toast(category.is_active ? "غیرفعال شد" : "فعال شد");
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  function askDelete(category) {
    setConfirm({
      title: "حذف دسته‌بندی",
      message: `آیا از حذف «${category.name}» مطمئن هستید؟ دسته‌های متصل به محصول قابل حذف نیستند.`,
      actionLabel: "حذف",
      onConfirm: async () => {
        try {
          await adminDeleteStoreCategory(category.id);
          toast("دسته‌بندی حذف شد");
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
          {categories ? `${toFa(categories.length)} دسته‌بندی` : "..."}
        </p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> دسته جدید
        </Button>
      </div>

      <Card>
        <CardContent className="px-0 py-0">
          {!categories ? (
            <Skeleton className="m-4 h-48" />
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <FolderTree className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">هنوز دسته‌بندی ثبت نشده است.</p>
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>نام</TH>
                  <TH>نامک</TH>
                  <TH>وضعیت</TH>
                  <TH>عملیات</TH>
                </TR>
              </THead>
              <TBody>
                {categories.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium">{c.name}</TD>
                    <TD className="font-mono text-sm text-muted-foreground" dir="ltr">{c.slug}</TD>
                    <TD>
                      <Badge tone={c.is_active ? "success" : "muted"}>
                        {c.is_active ? "فعال" : "غیرفعال"}
                      </Badge>
                    </TD>
                    <TD>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(c)} title="ویرایش">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(c)} title={c.is_active ? "غیرفعال‌سازی" : "فعال‌سازی"}>
                          <Power className={`h-4 w-4 ${c.is_active ? "text-success" : "text-muted-foreground"}`} />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => askDelete(c)} title="حذف">
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
        title={editing ? "ویرایش دسته‌بندی" : "دسته‌بندی جدید"}
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
