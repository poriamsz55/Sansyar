import { useState } from "react";
import { Users, Banknote, UserPlus, Save, CalendarClock, Trash2, Lock } from "lucide-react";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/skeleton";
import { toast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import TimeField from "@/components/sessions/TimeField";
import { updateSession, deleteSession, manualBooking } from "@/api/endpoints";
import { occupancy, isBooked, revenueEstimate, startOfDay, isoFromLocal } from "@/lib/sessions";
import {
  toFa,
  formatToman,
  formatJalaliDate,
  formatTimeRange,
} from "@/lib/utils";

const hm = (iso) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const toMin = (s) => {
  const [h, m] = String(s).split(":").map(Number);
  return h * 60 + m;
};

const STATUS_OPTIONS = [
  { value: "available", label: "آزاد (قابل رزرو)" },
  { value: "closed", label: "تعطیل / لغو سانس" },
  { value: "maintenance", label: "تعمیرات" },
  { value: "holiday", label: "تعطیل رسمی" },
  { value: "special_event", label: "رویداد ویژه" },
];

export default function SessionEditPanel({ session, sportName, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    title: session.title || "",
    start_time: hm(session.starts_at),
    end_time: hm(session.ends_at),
    base_price: session.base_price || 0,
    discount_percent: session.discount_percent || 0,
    status: ["reserved", "expired"].includes(session.status) ? "available" : session.status,
    notes: session.notes || "",
    admin_comment: session.admin_comment || "",
  }));
  const [saving, setSaving] = useState(false);
  const [booking, setBooking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const occ = occupancy(session);
  // A reserved/booked session is locked: its time can no longer be changed.
  const locked = isBooked(session);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const finalPreview = Math.round((Number(form.base_price) * (100 - Number(form.discount_percent))) / 100);

  // Duration preview, handling a midnight (00:00) end as "next day".
  const startMin = toMin(form.start_time);
  let endMin = toMin(form.end_time);
  if (endMin <= startMin) endMin += 24 * 60;
  const durationMin = endMin - startMin;

  async function save() {
    if (!locked && durationMin < 15) {
      toast("مدت سانس باید حداقل ۱۵ دقیقه باشد", "error");
      return;
    }
    setSaving(true);
    try {
      const day = startOfDay(new Date(session.starts_at));
      const patch = {
        title: form.title,
        base_price: Number(form.base_price),
        discount_percent: Number(form.discount_percent),
        status: form.status,
        notes: form.notes,
        admin_comment: form.admin_comment,
      };
      // Reserved sessions keep their original time — never send a new one.
      if (!locked) {
        patch.starts_at = isoFromLocal(day, startMin);
        patch.ends_at = isoFromLocal(day, endMin);
      }
      await updateSession(session.id, patch);
      toast("سانس به‌روزرسانی شد");
      onSaved?.();
      onClose();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await deleteSession(session.id);
      toast("سانس حذف شد");
      onSaved?.();
      onClose();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setDeleting(false);
    }
  }

  async function addManualBooking() {
    if (occ.remaining <= 0) {
      toast("ظرفیت این سانس تکمیل است", "error");
      return;
    }
    setBooking(true);
    try {
      await manualBooking({ slotId: session.id, paymentType: "full_in_person" });
      toast("رزرو دستی ثبت شد");
      onSaved?.();
      onClose();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBooking(false);
    }
  }

  return (
    <Dialog open onClose={onClose} wide title="مدیریت سانس" description={sportName}>
      <div className="space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={CalendarClock} label="تاریخ" value={formatJalaliDate(session.starts_at)} />
          <Stat icon={CalendarClock} label="ساعت" value={formatTimeRange(session.starts_at, session.ends_at)} />
          <Stat icon={Users} label="وضعیت رزرو" value={occ.booked > 0 ? "رزرو شده" : "آزاد"} />
          <Stat icon={Banknote} label="درآمد تخمینی" value={`${formatToman(revenueEstimate(session))} ت`} />
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={
              occ.fill === "full" ? "h-full bg-rose-500" : occ.fill === "partial" ? "h-full bg-amber-500" : "h-full bg-emerald-500"
            }
            style={{ width: `${occ.pct}%` }}
          />
        </div>

        {locked && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            این سانس رزرو شده است؛ زمان آن قابل تغییر نیست. برای تغییر زمان ابتدا رزرو را لغو کنید.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>ساعت شروع</Label>
            <TimeField value={form.start_time} onChange={(v) => set("start_time", v)} disabled={locked} />
          </div>
          <div className="space-y-1.5">
            <Label>ساعت پایان</Label>
            <TimeField value={form.end_time} onChange={(v) => set("end_time", v)} disabled={locked} />
          </div>
          {!locked && (
            <p className="-mt-1 text-xs text-muted-foreground sm:col-span-2">
              مدت سانس: <b>{toFa(Math.floor(durationMin / 60))}</b> ساعت و <b>{toFa(durationMin % 60)}</b> دقیقه
              {endMin > 24 * 60 && " (پایان در روز بعد)"}
            </p>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>عنوان سانس (اختیاری)</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="مثلاً سانس عصر بانوان" />
          </div>
          <div className="space-y-1.5">
            <Label>قیمت پایه (ریال)</Label>
            <Input type="number" value={form.base_price} onChange={(e) => set("base_price", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>درصد تخفیف</Label>
            <Input type="number" min={0} max={100} value={form.discount_percent} onChange={(e) => set("discount_percent", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>وضعیت</Label>
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>یادداشت سانس (برای مشتری)</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>یادداشت داخلی (فقط مدیریت)</Label>
            <Textarea rows={2} value={form.admin_comment} onChange={(e) => set("admin_comment", e.target.value)} />
          </div>
        </div>

        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          قیمت نهایی پس از تخفیف: <b>{formatToman(finalPreview)} تومان</b>
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={addManualBooking} disabled={booking || occ.remaining <= 0}>
              {booking ? <Spinner /> : <UserPlus className="h-4 w-4" />}
              {occ.booked > 0 ? "رزرو شده" : "رزرو دستی"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:bg-destructive/5"
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
              title={occ.booked > 0 ? "سانس دارای رزرو فعال است" : "حذف سانس"}
            >
              {deleting ? <Spinner /> : <Trash2 className="h-4 w-4" />}
              حذف
            </Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              انصراف
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? <Spinner /> : <Save className="h-4 w-4" />}
              ذخیره
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        confirm={
          confirmDelete
            ? {
                title: "حذف سانس",
                message:
                  occ.booked > 0
                    ? "این سانس رزرو فعال دارد و قابل حذف نیست. ابتدا آن را ببندید یا رزروها را لغو کنید."
                    : "آیا از حذف این سانس مطمئن هستید؟ این عمل قابل بازگشت نیست.",
                actionLabel: "حذف",
                onConfirm: occ.booked > 0 ? () => {} : remove,
              }
            : null
        }
        onClose={() => setConfirmDelete(false)}
      />
    </Dialog>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-0.5 text-sm font-bold">{value}</div>
    </div>
  );
}
