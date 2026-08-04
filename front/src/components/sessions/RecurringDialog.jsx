import { useState } from "react";
import { Repeat, X } from "lucide-react";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/skeleton";
import { toast } from "@/components/Toast";
import TimeField from "@/components/sessions/TimeField";
import JalaliDatePicker from "@/components/ui/JalaliDatePicker";
import { generateSessions } from "@/api/endpoints";
import { cn, toFa, formatToman, formatJalaliDate } from "@/lib/utils";
import { localDateStr } from "@/lib/sessions";

// Go time.Weekday: Sunday=0 … Saturday=6. Display starts Saturday (Iran).
const WEEKDAYS = [
  { go: 6, label: "ش" },
  { go: 0, label: "ی" },
  { go: 1, label: "د" },
  { go: 2, label: "س" },
  { go: 3, label: "چ" },
  { go: 4, label: "پ" },
  { go: 5, label: "ج" },
];

export default function RecurringDialog({ open, onClose, hall, sportOptions = [], onDone }) {
  const today = localDateStr(new Date());
  const [form, setForm] = useState({
    start_date: today,
    end_date: today,
    sport_id: sportOptions[0]?.id || "",
    weekdays: [6, 0, 1, 2, 3], // Sat–Wed
    day_start: "08:00",
    day_end: "22:00",
    slot_minutes: 90,
    gap_minutes: 0,
    base_price: hall?.base_price || 2000000,
    discount_percent: 0,
    gender: hall?.gender_rule === "male" || hall?.gender_rule === "female" ? hall.gender_rule : "",
    peak_enabled: false,
    peak_start: "18:00",
    peak_end: "22:00",
    peak_price: (hall?.base_price || 2000000) * 1.3,
  });
  const [exceptions, setExceptions] = useState([]);
  const [exceptionDraft, setExceptionDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  function toggleWeekday(go) {
    setForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(go) ? f.weekdays.filter((d) => d !== go) : [...f.weekdays, go],
    }));
  }
  function addException() {
    if (exceptionDraft && !exceptions.includes(exceptionDraft)) setExceptions((e) => [...e, exceptionDraft]);
    setExceptionDraft("");
  }

  async function submit() {
    if (!hall) return;
    if (!form.sport_id) return toast("لطفاً ورزش سانس را انتخاب کنید", "error");
    if (form.weekdays.length === 0) return toast("حداقل یک روز هفته را انتخاب کنید", "error");
    if (form.end_date < form.start_date) return toast("تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد", "error");
    setSaving(true);
    try {
      const res = await generateSessions({
        hall_id: hall.id,
        sport_id: form.sport_id,
        start_date: form.start_date,
        end_date: form.end_date,
        weekdays: form.weekdays,
        day_start: form.day_start,
        day_end: form.day_end,
        slot_minutes: Number(form.slot_minutes),
        gap_minutes: Number(form.gap_minutes),
        base_price: Number(form.base_price),
        discount_percent: Number(form.discount_percent),
        payment_policy: "full_online",
        peak_start: form.peak_enabled ? form.peak_start : "",
        peak_end: form.peak_enabled ? form.peak_end : "",
        peak_price: form.peak_enabled ? Number(form.peak_price) : 0,
        exception_dates: exceptions,
        gender: form.gender,
      });
      toast(`${toFa(res.created || 0)} سانس ساخته شد${res.skipped ? ` (${toFa(res.skipped)} تکراری رد شد)` : ""}`);
      onDone?.();
      onClose();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} wide title="ساخت سانس‌های تکرارشونده" description={hall ? `سالن: ${hall.name}` : undefined}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>از تاریخ</Label>
            <JalaliDatePicker value={form.start_date} onChange={(v) => set("start_date", v)} min={today} />
          </div>
          <div className="space-y-1.5">
            <Label>تا تاریخ</Label>
            <JalaliDatePicker value={form.end_date} onChange={(v) => set("end_date", v)} min={form.start_date || today} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>ورزش</Label>
            <Select value={form.sport_id} onChange={(e) => set("sport_id", e.target.value)}>
              {sportOptions.length === 0 && <option value="">ورزشی موجود نیست</option>}
              {sportOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>جنسیت</Label>
            <Select value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="">پیش‌فرض سالن</option>
              <option value="male">آقایان</option>
              <option value="female">بانوان</option>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>روزهای هفته</Label>
          <div className="flex gap-1.5">
            {WEEKDAYS.map((w) => (
              <button
                key={w.go}
                type="button"
                onClick={() => toggleWeekday(w.go)}
                className={cn(
                  "h-9 w-9 rounded-full border text-sm font-bold transition-colors",
                  form.weekdays.includes(w.go) ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label>شروع روز</Label>
            <TimeField value={form.day_start} onChange={(v) => set("day_start", v)} />
          </div>
          <div className="space-y-1.5">
            <Label>پایان روز</Label>
            <TimeField value={form.day_end} onChange={(v) => set("day_end", v)} />
          </div>
          <div className="space-y-1.5">
            <Label>مدت سانس (دقیقه)</Label>
            <Input type="number" value={form.slot_minutes} onChange={(e) => set("slot_minutes", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>فاصله بین سانس‌ها (دقیقه)</Label>
            <Input type="number" min={0} value={form.gap_minutes} onChange={(e) => set("gap_minutes", e.target.value)} />
            <p className="text-xs text-muted-foreground">زمان استراحت بین دو سانس متوالی</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>قیمت پایه (ریال)</Label>
            <Input type="number" value={form.base_price} onChange={(e) => set("base_price", e.target.value)} />
            <p className="text-xs text-muted-foreground">{formatToman(form.base_price)} ت</p>
          </div>
          <div className="space-y-1.5">
            <Label>درصد تخفیف</Label>
            <Input type="number" min={0} max={100} value={form.discount_percent} onChange={(e) => set("discount_percent", e.target.value)} />
          </div>
        </div>

        {/* Peak pricing */}
        <div className="rounded-xl border border-border p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={form.peak_enabled} onChange={(e) => set("peak_enabled", e.target.checked)} className="h-4 w-4 accent-primary" />
            قیمت‌گذاری ساعات اوج (پیک)
          </label>
          {form.peak_enabled && (
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>شروع پیک</Label>
                <TimeField value={form.peak_start} onChange={(v) => set("peak_start", v)} />
              </div>
              <div className="space-y-1.5">
                <Label>پایان پیک</Label>
                <TimeField value={form.peak_end} onChange={(v) => set("peak_end", v)} />
              </div>
              <div className="space-y-1.5">
                <Label>قیمت پیک (ریال)</Label>
                <Input type="number" value={form.peak_price} onChange={(e) => set("peak_price", e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Exception dates */}
        <div className="space-y-1.5">
          <Label>روزهای استثنا / تعطیل (در این تاریخ‌ها سانسی ساخته نمی‌شود)</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <JalaliDatePicker
                value={exceptionDraft}
                onChange={setExceptionDraft}
                placeholder="انتخاب روز تعطیل"
                min={form.start_date}
                max={form.end_date}
              />
            </div>
            <Button type="button" variant="secondary" onClick={addException} disabled={!exceptionDraft}>
              افزودن
            </Button>
          </div>
          {exceptions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {exceptions.map((d) => (
                <span key={d} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                  {formatJalaliDate(d)}
                  <button type="button" onClick={() => setExceptions((e) => e.filter((x) => x !== d))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button type="button" onClick={submit} disabled={saving}>
            {saving ? <Spinner /> : <Repeat className="h-4 w-4" />}
            ساخت سانس‌ها
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
