import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Power } from "lucide-react";

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
  listAdminSports,
  createSport,
  updateSport,
  deleteSport,
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

export default function PlatformSports() {
  const [sports, setSports] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  async function load() {
    setSports(await listAdminSports());
  }
  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(sport) {
    setEditing(sport);
    setForm({ name: sport.name, slug: sport.slug, icon: sport.icon || "" });
    setOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await updateSport(editing.id, form);
        toast("رشته ورزشی به‌روزرسانی شد");
      } else {
        await createSport(form);
        toast("رشته ورزشی ایجاد شد");
      }
      setOpen(false);
      load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(sport) {
    try {
      await updateSport(sport.id, { is_active: !sport.is_active });
      toast(sport.is_active ? "غیرفعال شد" : "فعال شد");
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  function askDelete(sport) {
    setConfirm({
      title: "حذف رشته ورزشی",
      message: `آیا از حذف «${sport.name}» مطمئن هستید؟ این عملیات قابل بازگشت نیست.`,
      actionLabel: "حذف",
      onConfirm: async () => {
        try {
          await deleteSport(sport.id);
          toast("رشته ورزشی حذف شد");
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
          {sports ? `${toFa(sports.length)} رشته ورزشی` : "..."}
        </p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> رشته جدید
        </Button>
      </div>

      <Card>
        <CardContent className="px-0 py-0">
          {!sports ? (
            <Skeleton className="m-4 h-48" />
          ) : sports.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">هنوز رشته ورزشی ثبت نشده است.</p>
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
                {sports.map((s) => (
                  <TR key={s.id}>
                    <TD className="font-medium">{s.name}</TD>
                    <TD className="font-mono text-sm text-muted-foreground" dir="ltr">{s.slug}</TD>
                    <TD>
                      <Badge tone={s.is_active ? "success" : "muted"}>
                        {s.is_active ? "فعال" : "غیرفعال"}
                      </Badge>
                    </TD>
                    <TD>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(s)} title="ویرایش">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(s)} title={s.is_active ? "غیرفعال‌سازی" : "فعال‌سازی"}>
                          <Power className={`h-4 w-4 ${s.is_active ? "text-success" : "text-muted-foreground"}`} />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => askDelete(s)} title="حذف">
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
        title={editing ? "ویرایش رشته ورزشی" : "رشته ورزشی جدید"}
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
            <Label>آیکون (اختیاری)</Label>
            <Input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} />
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
