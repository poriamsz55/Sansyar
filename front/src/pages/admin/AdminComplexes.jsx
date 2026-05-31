import { useEffect, useState } from "react";
import { Plus, MapPin, Building2, Star, Pencil, Trash2, Check, X, Globe, GlobeLock } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { ImageUpload } from "@/components/ImageUpload";
import { toast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import {
  listOwnerComplexes,
  listAdminComplexes,
  createComplex,
  updateComplex,
  deleteComplex,
  adminUpdateComplex,
  adminDeleteComplex,
  approveComplex,
  rejectComplex,
  publishComplex,
  unpublishComplex,
} from "@/api/endpoints";
import { CITIES, AMENITIES } from "@/lib/constants";
import { toFa } from "@/lib/utils";

const empty = {
  name: "",
  city: CITIES[0],
  neighborhood: "",
  address: "",
  description: "",
  contact_phone: "",
  lat: 35.6892,
  lng: 51.389,
  images: [],
  amenities: [],
  rules: [],
};

export default function AdminComplexes() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    setError(null);
    try {
      const data = isSuperAdmin
        ? await listAdminComplexes()
        : await listOwnerComplexes();
      setItems(data);
    } catch (err) {
      setError(err.message);
      setItems([]);
    }
  }

  useEffect(() => {
    load();
  }, [isSuperAdmin]);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(c) {
    setEditing(c);
    setForm({
      name: c.name || "",
      city: c.city || CITIES[0],
      neighborhood: c.neighborhood || "",
      address: c.address || "",
      description: c.description || "",
      contact_phone: c.contact_phone || "",
      lat: c.location?.coordinates?.[1] ?? 35.6892,
      lng: c.location?.coordinates?.[0] ?? 51.389,
      images: c.images || [],
      amenities: c.amenities || [],
      rules: c.rules || [],
    });
    setOpen(true);
  }

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleAmenity(a) {
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(a)
        ? f.amenities.filter((x) => x !== a)
        : [...f.amenities, a],
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        lat: Number(form.lat),
        lng: Number(form.lng),
      };
      if (editing) {
        if (isSuperAdmin) await adminUpdateComplex(editing.id, payload);
        else await updateComplex(editing.id, payload);
        toast("مجموعه به‌روزرسانی شد");
      } else {
        await createComplex({ ...payload, slug: `complex-${Date.now()}` });
        toast("مجموعه جدید ثبت شد");
      }
      setOpen(false);
      setForm(empty);
      load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("این مجموعه غیرفعال شود؟")) return;
    try {
      if (isSuperAdmin) await adminDeleteComplex(id);
      else await deleteComplex(id);
      toast("مجموعه غیرفعال شد");
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function handleApprove(id, approved) {
    try {
      if (approved) await approveComplex(id);
      else await rejectComplex(id);
      toast(approved ? "مجموعه تأیید شد" : "مجموعه رد شد");
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function handlePublish(id, publish) {
    try {
      if (publish) await publishComplex(id);
      else await unpublishComplex(id);
      toast(publish ? "مجموعه منتشر شد" : "انتشار مجموعه لغو شد");
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items ? `${toFa(items.length)} مجموعه ثبت شده` : "در حال بارگذاری..."}
        </p>
        {!isSuperAdmin && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            مجموعه جدید
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="px-0 py-0">
          {!items ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>نام مجموعه</TH>
                  <TH>شهر</TH>
                  <TH>امتیاز</TH>
                  <TH>سانس آزاد</TH>
                  <TH>وضعیت</TH>
                  <TH>عملیات</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <div className="flex items-center gap-2">
                        <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-lg bg-primary/10 text-primary">
                          {c.images?.[0] ? (
                            <img src={c.images[0]} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Building2 className="h-4 w-4" />
                          )}
                        </span>
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </TD>
                    <TD className="text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {c.city}
                      </span>
                    </TD>
                    <TD>
                      <span className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {toFa((c.rating_avg || 0).toFixed(1))}
                      </span>
                    </TD>
                    <TD>{toFa(c.available_slot_count || 0)}</TD>
                    <TD>
                      <StatusBadge kind="complex" status={c.status} />
                    </TD>
                    <TD>
                      <div className="flex flex-wrap items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(c)} title="ویرایش">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} title="حذف">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                        {isSuperAdmin && c.status === "pending_approval" && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleApprove(c.id, true)} title="تأیید">
                              <Check className="h-3.5 w-3.5 text-success" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleApprove(c.id, false)} title="رد">
                              <X className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </>
                        )}
                        {isSuperAdmin && c.status === "approved" && (
                          <Button variant="ghost" size="sm" onClick={() => handlePublish(c.id, true)} title="انتشار">
                            <Globe className="h-3.5 w-3.5 text-primary" />
                          </Button>
                        )}
                        {isSuperAdmin && c.status === "published" && (
                          <Button variant="ghost" size="sm" onClick={() => handlePublish(c.id, false)} title="لغو انتشار">
                            <GlobeLock className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        )}
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
        title={editing ? "ویرایش مجموعه" : "ثبت مجموعه جدید"}
        description="اطلاعات مجموعه ورزشی را وارد کن."
      >
        <form onSubmit={submit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label>تصاویر</Label>
            <ImageUpload
              value={form.images}
              onChange={(images) => set("images", images)}
              folder="complexes"
              admin={isSuperAdmin}
            />
          </div>
          <div className="space-y-1.5">
            <Label>نام مجموعه</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="مثلاً مجموعه ورزشی آزادی"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>شهر</Label>
              <Select value={form.city} onChange={(e) => set("city", e.target.value)}>
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>محله</Label>
              <Input
                value={form.neighborhood}
                onChange={(e) => set("neighborhood", e.target.value)}
                placeholder="مثلاً ولنجک"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>آدرس</Label>
            <Input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="آدرس کامل"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>تلفن تماس</Label>
            <Input
              value={form.contact_phone}
              onChange={(e) => set("contact_phone", e.target.value)}
              placeholder="02100000000"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>عرض جغرافیایی</Label>
              <Input
                type="number"
                step="any"
                value={form.lat}
                onChange={(e) => set("lat", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>طول جغرافیایی</Label>
              <Input
                type="number"
                step="any"
                value={form.lng}
                onChange={(e) => set("lng", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>امکانات</Label>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map((a) => (
                <button
                  type="button"
                  key={a}
                  onClick={() => toggleAmenity(a)}
                  className={
                    "rounded-full border px-3 py-1.5 text-sm transition-colors " +
                    (form.amenities.includes(a)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-accent")
                  }
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>توضیحات</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="توضیح کوتاهی درباره مجموعه..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner /> : <Plus className="h-4 w-4" />}
              {editing ? "ذخیره تغییرات" : "ثبت مجموعه"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
