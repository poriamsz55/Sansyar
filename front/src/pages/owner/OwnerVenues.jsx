import { useEffect, useState } from "react";
import {
  Plus,
  MapPin,
  Building2,
  Star,
  Pencil,
  Trash2,
  Users,
  Maximize2,
  Warehouse,
  Phone,
  PowerOff,
  Hourglass,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageUpload, BannerUpload, ImagePreview, splitImages, joinImages } from "@/components/ImageUpload";
import { MapPicker } from "@/components/MapPicker";
import { StepForm } from "@/components/StepForm";
import { EmptyState } from "@/components/PageTransition";
import { toast } from "@/components/Toast";
import {
  listOwnerComplexes,
  listHalls,
  listSports,
  createComplex,
  updateComplex,
  deleteComplex,
  createHall,
  updateHall,
  deleteHall,
} from "@/api/endpoints";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  CITIES,
  AMENITIES,
  complexDisplayStatus,
  complexModerated,
  mergePendingChanges,
} from "@/lib/constants";
import { toFa, formatToman } from "@/lib/utils";

const COMPLEX_STEPS = ["اطلاعات پایه", "موقعیت مکانی", "تصاویر", "امکانات و توضیحات"];

const emptyComplex = {
  name: "",
  city: CITIES[0],
  neighborhood: "",
  contact_phone: "",
  address: "",
  lat: 35.6892,
  lng: 51.389,
  banner: "",
  gallery: [],
  amenities: [],
  rules: [],
  description: "",
};

const emptyHall = {
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
};

export default function OwnerVenues() {
  const [complexes, setComplexes] = useState(null);
  const [hallsByComplex, setHallsByComplex] = useState({});
  const [sports, setSports] = useState([]);
  const [error, setError] = useState(null);

  // Complex dialog state
  const [complexOpen, setComplexOpen] = useState(false);
  const [editingComplex, setEditingComplex] = useState(null);
  const [complexForm, setComplexForm] = useState(emptyComplex);
  const [step, setStep] = useState(0);

  // Hall dialog state — always bound to the complex card it was opened from.
  const [hallOpen, setHallOpen] = useState(false);
  const [hallComplex, setHallComplex] = useState(null);
  const [editingHall, setEditingHall] = useState(null);
  const [hallForm, setHallForm] = useState(emptyHall);

  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  async function load() {
    setError(null);
    try {
      const [cx, sp] = await Promise.all([listOwnerComplexes(), listSports()]);
      setComplexes(cx);
      setSports(sp);
      const lists = await Promise.all(cx.map((c) => listHalls(c.id, { includeInactive: true })));
      setHallsByComplex(Object.fromEntries(cx.map((c, i) => [c.id, lists[i]])));
    } catch (err) {
      setError(err.message);
      setComplexes([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const sportName = (id) => sports.find((s) => s.id === id)?.name || id;

  // ---- Complex CRUD ---------------------------------------------------------

  function openCreateComplex() {
    setEditingComplex(null);
    setComplexForm(emptyComplex);
    setStep(0);
    setComplexOpen(true);
  }

  function openEditComplex(c) {
    setEditingComplex(c);
    const src = mergePendingChanges(c);
    setComplexForm({
      name: src.name || "",
      city: src.city || CITIES[0],
      neighborhood: src.neighborhood || "",
      contact_phone: src.contact_phone || "",
      address: src.address || "",
      lat: src.location?.coordinates?.[1] ?? 35.6892,
      lng: src.location?.coordinates?.[0] ?? 51.389,
      ...splitImages(src.images),
      amenities: src.amenities || [],
      rules: src.rules || [],
      description: src.description || "",
    });
    setStep(0);
    setComplexOpen(true);
  }

  const setC = (key, value) => setComplexForm((f) => ({ ...f, [key]: value }));

  function toggleAmenity(a) {
    setComplexForm((f) => ({
      ...f,
      amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a],
    }));
  }

  function validateComplexStep(s) {
    if (s === 0 && !complexForm.name.trim()) {
      toast("نام مجموعه را وارد کنید", "error");
      return false;
    }
    if (s === 1 && !complexForm.address.trim()) {
      toast("آدرس کامل را وارد کنید", "error");
      return false;
    }
    return true;
  }

  function changeStep(next) {
    if (next > step && !validateComplexStep(step)) return;
    setStep(next);
  }

  async function submitComplex() {
    if (!validateComplexStep(0) || !validateComplexStep(1)) return;
    setSaving(true);
    try {
      const { banner, gallery, ...rest } = complexForm;
      const payload = {
        ...rest,
        lat: Number(complexForm.lat),
        lng: Number(complexForm.lng),
        images: joinImages(banner, gallery),
      };
      if (editingComplex) {
        await updateComplex(editingComplex.id, payload);
        if (["approved", "published"].includes(editingComplex.status)) {
          toast("تغییرات ثبت شد و پس از تأیید مدیر ارشد اعمال می‌شود؛ تا آن زمان نسخه قبلی نمایش داده می‌شود");
        } else {
          toast("مجموعه به‌روزرسانی شد");
        }
      } else {
        await createComplex({ ...payload, slug: `complex-${Date.now()}` });
        toast("مجموعه ثبت شد — پس از تأیید مدیر ارشد در سایت نمایش داده می‌شود");
      }
      setComplexOpen(false);
      load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function askDeleteComplex(c) {
    const moderated = complexModerated(c);
    setConfirm({
      title: moderated ? "غیرفعال‌سازی مجموعه" : "حذف کامل مجموعه",
      message: moderated
        ? `مجموعه‌های تأییدشده برای حفظ سوابق رزرو قابل حذف کامل نیستند. «${c.name}» فقط غیرفعال و از سایت برداشته می‌شود.`
        : `مجموعه «${c.name}» هنوز تأیید نشده و به همراه سالن‌ها و سانس‌هایش برای همیشه حذف می‌شود. این عملیات قابل بازگشت نیست.`,
      actionLabel: moderated ? "غیرفعال کن" : "حذف کامل",
      onConfirm: async () => {
        try {
          await deleteComplex(c.id);
          toast(moderated ? "مجموعه غیرفعال شد" : "مجموعه برای همیشه حذف شد");
          load();
        } catch (err) {
          toast(err.message, "error");
        }
      },
    });
  }

  // ---- Hall CRUD --------------------------------------------------------------

  function openCreateHall(complex) {
    setHallComplex(complex);
    setEditingHall(null);
    setHallForm(emptyHall);
    setHallOpen(true);
  }

  function openEditHall(complex, h) {
    setHallComplex(complex);
    setEditingHall(h);
    setHallForm({
      name: h.name || "",
      capacity: h.capacity || 20,
      base_price: h.base_price || 0,
      floor_type: h.floor_type || "",
      dimensions: h.dimensions || "",
      indoor_outdoor: h.indoor_outdoor || "indoor",
      gender_rule: h.gender_rule || "all",
      supported_sport_ids: h.supported_sport_ids || [],
      ...splitImages(h.images),
    });
    setHallOpen(true);
  }

  const setH = (key, value) => setHallForm((f) => ({ ...f, [key]: value }));

  function toggleSport(id) {
    setHallForm((f) => ({
      ...f,
      supported_sport_ids: f.supported_sport_ids.includes(id)
        ? f.supported_sport_ids.filter((x) => x !== id)
        : [...f.supported_sport_ids, id],
    }));
  }

  async function submitHall() {
    if (!hallForm.name.trim()) {
      toast("نام سالن را وارد کنید", "error");
      return;
    }
    if (!Number(hallForm.base_price)) {
      toast("قیمت پایه را وارد کنید", "error");
      return;
    }
    setSaving(true);
    try {
      const { banner, gallery, ...rest } = hallForm;
      const body = {
        ...rest,
        capacity: Number(hallForm.capacity),
        base_price: Number(hallForm.base_price),
        supported_sport_ids: hallForm.supported_sport_ids.length
          ? hallForm.supported_sport_ids
          : [sports[0]?.id].filter(Boolean),
        images: joinImages(banner, gallery),
      };
      if (editingHall) {
        await updateHall(editingHall.id, body);
        toast("سالن به‌روزرسانی شد");
      } else {
        await createHall(hallComplex.id, body);
        toast("سالن ثبت شد — پس از تأیید مدیر ارشد در سایت نمایش داده می‌شود");
      }
      setHallOpen(false);
      load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function askDeleteHall(h) {
    setConfirm({
      title: "غیرفعال‌سازی سالن",
      message: `سالن «${h.name}» از سایت برداشته می‌شود و دیگر قابل رزرو نخواهد بود. ادامه می‌دهید؟`,
      actionLabel: "غیرفعال کن",
      onConfirm: async () => {
        try {
          await deleteHall(h.id);
          toast("سالن غیرفعال شد");
          load();
        } catch (err) {
          toast(err.message, "error");
        }
      },
    });
  }

  // ---- Render -----------------------------------------------------------------

  const totalHalls = Object.values(hallsByComplex).flat().length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {complexes
            ? `${toFa(complexes.length)} مجموعه · ${toFa(totalHalls)} سالن`
            : "در حال بارگذاری..."}
        </p>
        <Button onClick={openCreateComplex}>
          <Plus className="h-4 w-4" />
          مجموعه جدید
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!complexes ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : complexes.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="هنوز مجموعه‌ای ثبت نکرده‌اید"
          description="ابتدا مجموعه ورزشی خود را ثبت کنید؛ سپس سالن‌های آن را داخل همان مجموعه اضافه می‌کنید."
          action={
            <Button onClick={openCreateComplex}>
              <Plus className="h-4 w-4" />
              ثبت اولین مجموعه
            </Button>
          }
        />
      ) : (
        complexes.map((c) => {
          const halls = hallsByComplex[c.id] || [];
          return (
            <Card key={c.id} className="overflow-hidden">
              {/* Complex header: banner + identity + actions */}
              <div className="relative h-36 sm:h-44">
                <ImagePreview src={c.images?.[0]} alt={c.name} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 p-4">
                  <div className="text-white">
                    <h2 className="text-lg font-extrabold">{c.name}</h2>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-white/85">
                      <MapPin className="h-3.5 w-3.5" />
                      {c.city}
                      {c.neighborhood ? `، ${c.neighborhood}` : ""}
                      {c.contact_phone && (
                        <span className="mr-2 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          <span dir="ltr">{toFa(c.contact_phone)}</span>
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs text-white">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {toFa((c.rating_avg || 0).toFixed(1))}
                  </span>
                </div>
                <div className="absolute right-3 top-3">
                  <StatusBadge kind="complex" status={complexDisplayStatus(c)} />
                </div>
                <div className="absolute left-3 top-3 flex gap-1">
                  <Button variant="secondary" size="sm" onClick={() => openEditComplex(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                    ویرایش
                  </Button>
                  {c.status !== "suspended" &&
                    (complexModerated(c) ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        title="مجموعه‌های تأییدشده قابل حذف کامل نیستند"
                        onClick={() => askDeleteComplex(c)}
                      >
                        <PowerOff className="h-3.5 w-3.5 text-destructive" />
                        غیرفعال‌سازی
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => askDeleteComplex(c)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        حذف
                      </Button>
                    ))}
                </div>
              </div>

              {/* Halls of this complex */}
              <CardContent className="space-y-3 p-4">
                {c.pending_changes && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
                    <Hourglass className="h-3.5 w-3.5 shrink-0" />
                    تغییرات شما در انتظار تأیید مدیر ارشد است؛ تا تأیید، نسخه قبلی در سایت نمایش داده می‌شود.
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-sm font-bold">
                    <Warehouse className="h-4 w-4 text-primary" />
                    سالن‌های این مجموعه
                    <span className="text-xs font-normal text-muted-foreground">({toFa(halls.length)})</span>
                  </h3>
                  <Button variant="outline" size="sm" onClick={() => openCreateHall(c)}>
                    <Plus className="h-3.5 w-3.5" />
                    افزودن سالن
                  </Button>
                </div>

                {halls.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => openCreateHall(c)}
                    className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    <Plus className="h-5 w-5" />
                    اولین سالن این مجموعه را اضافه کنید
                  </button>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {halls.map((h) => (
                      <div
                        key={h.id}
                        className="group flex gap-3 rounded-xl border border-border p-2.5 transition-colors hover:border-primary/40"
                      >
                        <ImagePreview
                          src={h.images?.[0]}
                          alt={h.name}
                          className="h-20 w-24 shrink-0 rounded-lg object-cover"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-start justify-between gap-1">
                            <p className="truncate text-sm font-bold">{h.name}</p>
                            <div className="flex shrink-0 gap-0.5">
                              <Button variant="ghost" size="sm" onClick={() => openEditHall(c, h)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {h.is_active && (
                                <Button variant="ghost" size="sm" onClick={() => askDeleteHall(h)}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {h.supported_sport_ids?.slice(0, 2).map((sid) => (
                              <Badge key={sid} tone="primary">{sportName(sid)}</Badge>
                            ))}
                            <StatusBadge kind="hall" status={h.status || (h.is_active ? "approved" : "rejected")} />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-0.5">
                              <Users className="h-3 w-3" />
                              {toFa(h.capacity)}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Maximize2 className="h-3 w-3" />
                              {h.dimensions}
                            </span>
                            <span className="font-bold text-foreground">{formatToman(h.base_price)} ت</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* ---- Complex create / edit wizard ---- */}
      <Dialog
        open={complexOpen}
        onClose={() => setComplexOpen(false)}
        wide
        title={editingComplex ? `ویرایش «${editingComplex.name}»` : "ثبت مجموعه جدید"}
        description={
          editingComplex
            ? undefined
            : "پس از ثبت، مجموعه تا زمان تأیید مدیر ارشد در سایت عمومی نمایش داده نمی‌شود."
        }
      >
        <StepForm
          steps={COMPLEX_STEPS}
          step={step}
          onStepChange={changeStep}
          onSubmit={submitComplex}
          saving={saving}
          submitLabel={editingComplex ? "ذخیره تغییرات" : "ثبت مجموعه"}
        >
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>نام مجموعه</Label>
                <Input value={complexForm.name} onChange={(e) => setC("name", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>شهر</Label>
                <Select value={complexForm.city} onChange={(e) => setC("city", e.target.value)}>
                  {CITIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>محله</Label>
                <Input value={complexForm.neighborhood} onChange={(e) => setC("neighborhood", e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>تلفن تماس</Label>
                <Input
                  value={complexForm.contact_phone}
                  onChange={(e) => setC("contact_phone", e.target.value)}
                  dir="ltr"
                />
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label>آدرس کامل</Label>
                <Input value={complexForm.address} onChange={(e) => setC("address", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>موقعیت روی نقشه</Label>
                <MapPicker
                  value={{ lat: complexForm.lat, lng: complexForm.lng }}
                  onChange={({ lat, lng }) => setComplexForm((f) => ({ ...f, lat, lng }))}
                />
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="grid gap-5">
              <div className="space-y-1.5">
                <Label>تصویر بنر (اصلی)</Label>
                <BannerUpload
                  value={complexForm.banner}
                  onChange={(banner) => setC("banner", banner)}
                  folder="complexes"
                />
              </div>
              <div className="space-y-1.5">
                <Label>گالری تصاویر</Label>
                <ImageUpload
                  value={complexForm.gallery}
                  onChange={(gallery) => setC("gallery", gallery)}
                  folder="complexes"
                  disabled={!complexForm.banner}
                  disabledHint="ابتدا تصویر بنر را آپلود کنید؛ سپس تصاویر گالری را اضافه کنید"
                />
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="grid gap-4">
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
                        (complexForm.amenities.includes(a)
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
                  value={complexForm.description}
                  onChange={(e) => setC("description", e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}
        </StepForm>
      </Dialog>

      {/* ---- Hall create / edit (single form, bound to its complex) ---- */}
      <Dialog
        open={hallOpen}
        onClose={() => setHallOpen(false)}
        wide
        title={editingHall ? `ویرایش «${editingHall.name}»` : "افزودن سالن"}
        description={hallComplex ? `این سالن زیرمجموعهٔ «${hallComplex.name}» است.` : undefined}
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>نام سالن</Label>
              <Input value={hallForm.name} onChange={(e) => setH("name", e.target.value)} required />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>ورزش‌ها</Label>
              <div className="flex flex-wrap gap-2">
                {sports.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => toggleSport(s.id)}
                    className={
                      "rounded-full border px-3 py-1.5 text-sm transition-colors " +
                      (hallForm.supported_sport_ids.includes(s.id)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-accent")
                    }
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>نوع</Label>
              <Select value={hallForm.indoor_outdoor} onChange={(e) => setH("indoor_outdoor", e.target.value)}>
                <option value="indoor">سرپوشیده</option>
                <option value="outdoor">روباز</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>جنسیت</Label>
              <Select value={hallForm.gender_rule} onChange={(e) => setH("gender_rule", e.target.value)}>
                <option value="all">همه</option>
                <option value="male">آقایان</option>
                <option value="female">بانوان</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>ظرفیت</Label>
              <Input type="number" value={hallForm.capacity} onChange={(e) => setH("capacity", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>ابعاد</Label>
              <Input value={hallForm.dimensions} onChange={(e) => setH("dimensions", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>جنس کف</Label>
              <Input value={hallForm.floor_type} onChange={(e) => setH("floor_type", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>قیمت پایه (ریال)</Label>
              <Input
                type="number"
                value={hallForm.base_price}
                onChange={(e) => setH("base_price", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{formatToman(hallForm.base_price)} تومان / سانس</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>تصویر بنر (اصلی)</Label>
            <BannerUpload value={hallForm.banner} onChange={(banner) => setH("banner", banner)} folder="halls" />
          </div>
          <div className="space-y-1.5">
            <Label>گالری تصاویر</Label>
            <ImageUpload
              value={hallForm.gallery}
              onChange={(gallery) => setH("gallery", gallery)}
              folder="halls"
              disabled={!hallForm.banner}
              disabledHint="ابتدا تصویر بنر را آپلود کنید؛ سپس تصاویر گالری را اضافه کنید"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setHallOpen(false)}>
              انصراف
            </Button>
            <Button onClick={submitHall} disabled={saving}>
              {saving ? "در حال ذخیره..." : editingHall ? "ذخیره تغییرات" : "ثبت سالن"}
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
