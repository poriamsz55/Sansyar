import { useEffect, useState } from "react";
import { Plus, Users, Maximize2, Warehouse, Power, Pencil, Trash2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/PageTransition";
import { ImageUpload, BannerUpload, ImagePreview, splitImages, joinImages } from "@/components/ImageUpload";
import { toast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import {
  listOwnerComplexes,
  listAdminComplexes,
  listHalls,
  createHall,
  updateHall,
  deleteHall,
} from "@/api/endpoints";
import { listSports } from "@/api/endpoints";
import { formatToman, toFa } from "@/lib/utils";

const emptyForm = {
  complexId: "",
  name: "",
  capacity: 20,
  base_price: 2000000,
  floor_type: "پارکت",
  dimensions: "۴۰×۲۰",
  indoor_outdoor: "indoor",
  gender_rule: "all",
  supported_sport_ids: [],
  banner: "",
  gallery: [],
  amenities: [],
};

export default function AdminHalls() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const [complexes, setComplexes] = useState([]);
  const [sports, setSports] = useState([]);
  const [halls, setHalls] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setError(null);
    try {
      const [cx, sp] = await Promise.all([
        isSuperAdmin ? listAdminComplexes() : listOwnerComplexes(),
        listSports(),
      ]);
      setComplexes(cx);
      setSports(sp);
      const lists = await Promise.all(
        cx.map((c) => listHalls(c.id, { includeInactive: true }))
      );
      setHalls(lists.flat());
      if (cx[0] && !form.complexId) {
        setForm((f) => ({ ...f, complexId: cx[0].id }));
      }
    } catch (err) {
      setError(err.message);
      setHalls([]);
    }
  }

  useEffect(() => {
    load();
  }, [isSuperAdmin]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, complexId: complexes[0]?.id || "" });
    setOpen(true);
  }

  function openEdit(h) {
    setEditing(h);
    setForm({
      complexId: h.complex_id,
      name: h.name || "",
      capacity: h.capacity || 20,
      base_price: h.base_price || 0,
      floor_type: h.floor_type || "",
      dimensions: h.dimensions || "",
      indoor_outdoor: h.indoor_outdoor || "indoor",
      gender_rule: h.gender_rule || "all",
      supported_sport_ids: h.supported_sport_ids || [],
      ...splitImages(h.images),
      amenities: h.amenities || [],
    });
    setOpen(true);
  }

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleSport(id) {
    setForm((f) => ({
      ...f,
      supported_sport_ids: f.supported_sport_ids.includes(id)
        ? f.supported_sport_ids.filter((x) => x !== id)
        : [...f.supported_sport_ids, id],
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { complexId, banner, gallery, ...payload } = form;
      const body = {
        ...payload,
        capacity: Number(payload.capacity),
        base_price: Number(payload.base_price),
        supported_sport_ids: payload.supported_sport_ids.length
          ? payload.supported_sport_ids
          : [sports[0]?.id].filter(Boolean),
        images: joinImages(banner, gallery),
      };
      if (editing) {
        await updateHall(editing.id, body);
        toast("سالن به‌روزرسانی شد");
      } else {
        await createHall(complexId, body);
        toast("سالن جدید ثبت شد");
      }
      setOpen(false);
      load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("این سالن غیرفعال شود؟")) return;
    try {
      await deleteHall(id);
      toast("سالن غیرفعال شد");
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  const sportName = (id) => sports.find((s) => s.id === id)?.name || id;
  const complexName = (id) => complexes.find((c) => c.id === id)?.name || "—";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {halls ? `${toFa(halls.length)} سالن ثبت شده` : "در حال بارگذاری..."}
        </p>
        <Button onClick={openCreate} disabled={!complexes.length}>
          <Plus className="h-4 w-4" />
          سالن جدید
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!halls ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : halls.length === 0 ? (
        <EmptyState icon={Warehouse} title="سالنی ثبت نشده" description="اولین سالن را اضافه کن." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {halls.map((h) => (
            <Card key={h.id} className="overflow-hidden">
              <div className="relative h-32">
                <ImagePreview
                  src={h.images?.[0]}
                  alt={h.name}
                  className="h-full w-full object-cover"
                />
                <Badge
                  tone={h.is_active ? "success" : "muted"}
                  className="absolute right-2 top-2"
                >
                  <Power className="h-3 w-3" />
                  {h.is_active ? "فعال" : "غیرفعال"}
                </Badge>
                <div className="absolute left-2 top-2 flex gap-1">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(h)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {h.is_active && (
                    <Button variant="secondary" size="sm" onClick={() => handleDelete(h.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
              <CardContent className="space-y-3 p-4">
                <div>
                  <h3 className="font-bold">{h.name}</h3>
                  <p className="text-xs text-muted-foreground">{complexName(h.complex_id)}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {h.supported_sport_ids?.map((sid) => (
                    <Badge key={sid} tone="primary">
                      {sportName(sid)}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {toFa(h.capacity)} نفر
                  </span>
                  <span className="flex items-center gap-1">
                    <Maximize2 className="h-3.5 w-3.5" /> {h.dimensions}
                  </span>
                </div>
                <div className="border-t border-border pt-3 text-sm">
                  <span className="font-extrabold text-navy">{formatToman(h.base_price)}</span>{" "}
                  <span className="text-xs text-muted-foreground">تومان / سانس</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "ویرایش سالن" : "ثبت سالن جدید"}
        description="سالن را به یکی از مجموعه‌ها اضافه کن."
      >
        <form onSubmit={submit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label>تصویر بنر (اصلی)</Label>
            <BannerUpload
              value={form.banner}
              onChange={(banner) => set("banner", banner)}
              folder="halls"
            />
          </div>
          <div className="space-y-1.5">
            <Label>گالری تصاویر</Label>
            <ImageUpload
              value={form.gallery}
              onChange={(gallery) => set("gallery", gallery)}
              folder="halls"
              disabled={!form.banner}
            />
          </div>
          {!editing && (
            <div className="space-y-1.5">
              <Label>مجموعه</Label>
              <Select value={form.complexId} onChange={(e) => set("complexId", e.target.value)}>
                {complexes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>نام سالن</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="مثلاً سالن فوتسال شماره ۱"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>ورزش‌های قابل اجرا</Label>
            <div className="flex flex-wrap gap-2">
              {sports.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => toggleSport(s.id)}
                  className={
                    "rounded-full border px-3 py-1.5 text-sm transition-colors " +
                    (form.supported_sport_ids.includes(s.id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-accent")
                  }
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>نوع</Label>
              <Select
                value={form.indoor_outdoor}
                onChange={(e) => set("indoor_outdoor", e.target.value)}
              >
                <option value="indoor">سرپوشیده</option>
                <option value="outdoor">روباز</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>قانون جنسیت</Label>
              <Select value={form.gender_rule} onChange={(e) => set("gender_rule", e.target.value)}>
                <option value="all">همه</option>
                <option value="male">آقایان</option>
                <option value="female">بانوان</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>ظرفیت</Label>
              <Input
                type="number"
                value={form.capacity}
                onChange={(e) => set("capacity", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>ابعاد</Label>
              <Input value={form.dimensions} onChange={(e) => set("dimensions", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>کف‌پوش</Label>
              <Input value={form.floor_type} onChange={(e) => set("floor_type", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>قیمت پایه (ریال)</Label>
            <Input
              type="number"
              value={form.base_price}
              onChange={(e) => set("base_price", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              معادل {formatToman(form.base_price)} تومان
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner /> : <Plus className="h-4 w-4" />}
              {editing ? "ذخیره تغییرات" : "ثبت سالن"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
