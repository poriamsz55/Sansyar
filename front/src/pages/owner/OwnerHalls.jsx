import { useEffect, useState } from "react";
import { Plus, Users, Maximize2, Warehouse, Pencil, Trash2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/PageTransition";
import { ImageUpload, ImagePreview } from "@/components/ImageUpload";
import { StepForm } from "@/components/StepForm";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "@/components/Toast";
import { listOwnerComplexes, listHalls, createHall, updateHall, deleteHall, listSports } from "@/api/endpoints";
import { formatToman, toFa } from "@/lib/utils";

const STEPS = ["اطلاعات سالن", "جزئیات و قیمت"];

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
  images: [],
};

export default function OwnerHalls() {
  const [complexes, setComplexes] = useState([]);
  const [sports, setSports] = useState([]);
  const [halls, setHalls] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    const [cx, sp] = await Promise.all([listOwnerComplexes(), listSports()]);
    setComplexes(cx);
    setSports(sp);
    const lists = await Promise.all(cx.map((c) => listHalls(c.id, { includeInactive: true })));
    setHalls(lists.flat());
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, complexId: complexes[0]?.id || "" });
    setStep(0);
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
      images: h.images || [],
    });
    setStep(0);
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

  async function submit() {
    setSaving(true);
    try {
      const { complexId, ...payload } = form;
      const body = {
        ...payload,
        capacity: Number(payload.capacity),
        base_price: Number(payload.base_price),
        supported_sport_ids: payload.supported_sport_ids.length ? payload.supported_sport_ids : [sports[0]?.id].filter(Boolean),
      };
      if (editing) {
        await updateHall(editing.id, body);
        toast("سالن به‌روزرسانی شد");
      } else {
        await createHall(complexId, body);
        toast("سالن ثبت شد — پس از تأیید مدیر ارشد در سایت نمایش داده می‌شود");
      }
      setOpen(false);
      load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  const sportName = (id) => sports.find((s) => s.id === id)?.name || id;
  const complexName = (id) => complexes.find((c) => c.id === id)?.name || "—";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{halls ? `${toFa(halls.length)} سالن` : "..."}</p>
        <Button onClick={openCreate} disabled={!complexes.length}>
          <Plus className="h-4 w-4" />
          سالن جدید
        </Button>
      </div>

      {!halls ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : halls.length === 0 ? (
        <EmptyState icon={Warehouse} title="سالنی ثبت نشده" description="اولین سالن را اضافه کنید." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {halls.map((h) => (
            <Card key={h.id} className="overflow-hidden">
              <div className="relative h-32">
                <ImagePreview src={h.images?.[0]} alt={h.name} className="h-full w-full object-cover" />
                <div className="absolute right-2 top-2">
                  <StatusBadge kind="hall" status={h.status || (h.is_active ? "approved" : "rejected")} />
                </div>
                <div className="absolute left-2 top-2 flex gap-1">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(h)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {h.is_active && (
                    <Button variant="secondary" size="sm" onClick={() => deleteHall(h.id).then(load)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
              <CardContent className="space-y-2 p-4">
                <h3 className="font-bold">{h.name}</h3>
                <p className="text-xs text-muted-foreground">{complexName(h.complex_id)}</p>
                <div className="flex flex-wrap gap-1">
                  {h.supported_sport_ids?.map((sid) => (
                    <Badge key={sid} tone="primary">{sportName(sid)}</Badge>
                  ))}
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{toFa(h.capacity)}</span>
                  <span className="flex items-center gap-1"><Maximize2 className="h-3.5 w-3.5" />{h.dimensions}</span>
                </div>
                <p className="border-t border-border pt-2 text-sm font-extrabold">{formatToman(h.base_price)} <span className="text-xs font-normal text-muted-foreground">/ سانس</span></p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} wide title={editing ? "ویرایش سالن" : "ثبت سالن جدید"}>
        <StepForm steps={STEPS} step={step} onStepChange={setStep} onSubmit={submit} saving={saving} submitLabel={editing ? "ذخیره" : "ثبت سالن"}>
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {!editing && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>مجموعه</Label>
                  <Select value={form.complexId} onChange={(e) => set("complexId", e.target.value)}>
                    {complexes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label>نام سالن</Label>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>ورزش‌ها</Label>
                <div className="flex flex-wrap gap-2">
                  {sports.map((s) => (
                    <button type="button" key={s.id} onClick={() => toggleSport(s.id)} className={"rounded-full border px-3 py-1.5 text-sm " + (form.supported_sport_ids.includes(s.id) ? "border-primary bg-primary/10 text-primary" : "border-border")}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>تصاویر</Label>
                <ImageUpload value={form.images} onChange={(images) => set("images", images)} folder="halls" />
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>نوع</Label>
                <Select value={form.indoor_outdoor} onChange={(e) => set("indoor_outdoor", e.target.value)}>
                  <option value="indoor">سرپوشیده</option>
                  <option value="outdoor">روباز</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>جنسیت</Label>
                <Select value={form.gender_rule} onChange={(e) => set("gender_rule", e.target.value)}>
                  <option value="all">همه</option>
                  <option value="male">آقایان</option>
                  <option value="female">بانوان</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>ظرفیت</Label>
                <Input type="number" value={form.capacity} onChange={(e) => set("capacity", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>ابعاد</Label>
                <Input value={form.dimensions} onChange={(e) => set("dimensions", e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>قیمت پایه (ریال)</Label>
                <Input type="number" value={form.base_price} onChange={(e) => set("base_price", e.target.value)} />
                <p className="text-xs text-muted-foreground">{formatToman(form.base_price)} تومان</p>
              </div>
            </div>
          )}
        </StepForm>
      </Dialog>
    </div>
  );
}
