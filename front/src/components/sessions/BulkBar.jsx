import { useState } from "react";
import { CopyPlus, CalendarRange, Ban, CheckSquare, CheckCheck, Layers } from "lucide-react";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/skeleton";
import { toast } from "@/components/Toast";
import JalaliDatePicker from "@/components/ui/JalaliDatePicker";
import { copyDay, duplicateWeek, blockRange, bulkUpdateSessions } from "@/api/endpoints";
import { toFa, formatToman, formatJalaliDate } from "@/lib/utils";
import { localDateStr, startOfWeek, addDays } from "@/lib/sessions";

/**
 * Operational toolbar for the session calendar: copy a day, duplicate a week,
 * block a time range (closure/holiday/maintenance), and bulk-edit selected
 * sessions.
 */
export default function BulkBar({ hall, anchor, selectionMode, setSelectionMode, selectedIds, clearSelection, onSelectAll, hasSessions, onDone }) {
  const [dialog, setDialog] = useState(null); // copy | duplicate | block | bulk

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setDialog("copy")}>
        <CopyPlus className="h-4 w-4" />
        کپی روز
      </Button>
      <Button variant="outline" size="sm" onClick={() => setDialog("duplicate")}>
        <CalendarRange className="h-4 w-4" />
        تکرار هفته
      </Button>
      <Button variant="outline" size="sm" onClick={() => setDialog("block")}>
        <Ban className="h-4 w-4" />
        مسدودسازی / تعطیلی
      </Button>
      <Button
        variant={selectionMode ? "default" : "outline"}
        size="sm"
        onClick={() => {
          setSelectionMode(!selectionMode);
          clearSelection();
        }}
      >
        <CheckSquare className="h-4 w-4" />
        {selectionMode ? "خروج از انتخاب" : "انتخاب گروهی"}
      </Button>
      {selectionMode && (
        <>
          <Button variant="outline" size="sm" onClick={onSelectAll} disabled={!hasSessions}>
            <CheckCheck className="h-4 w-4" />
            انتخاب همه
          </Button>
          <Button size="sm" onClick={() => setDialog("bulk")} disabled={selectedIds.size === 0}>
            <Layers className="h-4 w-4" />
            ویرایش {toFa(selectedIds.size)} سانس
          </Button>
        </>
      )}

      {dialog === "copy" && (
        <CopyDayDialog hall={hall} anchor={anchor} onClose={() => setDialog(null)} onDone={onDone} />
      )}
      {dialog === "duplicate" && (
        <DuplicateWeekDialog hall={hall} anchor={anchor} onClose={() => setDialog(null)} onDone={onDone} />
      )}
      {dialog === "block" && (
        <BlockRangeDialog hall={hall} anchor={anchor} onClose={() => setDialog(null)} onDone={onDone} />
      )}
      {dialog === "bulk" && (
        <BulkEditDialog
          ids={[...selectedIds]}
          onClose={() => setDialog(null)}
          onDone={() => {
            clearSelection();
            onDone();
          }}
        />
      )}
    </div>
  );
}

function CopyDayDialog({ hall, anchor, onClose, onDone }) {
  const [from, setFrom] = useState(localDateStr(anchor));
  const [to, setTo] = useState(localDateStr(addDays(anchor, 1)));
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const res = await copyDay({ hall_id: hall.id, from_date: from, to_dates: [to] });
      toast(`${toFa(res.created || 0)} سانس کپی شد`);
      onDone();
      onClose();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="کپی برنامه یک روز" description="سانس‌های یک روز را به روز دیگری منتقل کنید.">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>از روز</Label>
          <JalaliDatePicker value={from} onChange={setFrom} />
        </div>
        <div className="space-y-1.5">
          <Label>به روز</Label>
          <JalaliDatePicker value={to} onChange={setTo} />
        </div>
        <DialogActions saving={saving} onClose={onClose} onSubmit={submit} label="کپی" />
      </div>
    </Dialog>
  );
}

function DuplicateWeekDialog({ hall, anchor, onClose, onDone }) {
  const [weeks, setWeeks] = useState(3);
  const [saving, setSaving] = useState(false);
  const weekStart = localDateStr(startOfWeek(anchor));

  async function submit() {
    setSaving(true);
    try {
      const res = await duplicateWeek({ hall_id: hall.id, from_week_start: weekStart, weeks: Number(weeks) });
      toast(`${toFa(res.created || 0)} سانس برای ${toFa(weeks)} هفته ساخته شد`);
      onDone();
      onClose();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="تکرار برنامه هفته" description="برنامه هفته جاری را برای هفته‌های بعد تکرار کنید.">
      <div className="space-y-4">
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          هفته مبدأ از <b>{formatJalaliDate(weekStart)}</b> (شنبه) آغاز می‌شود.
        </p>
        <div className="space-y-1.5">
          <Label>برای چند هفته بعد؟</Label>
          <Input type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(e.target.value)} />
        </div>
        <DialogActions saving={saving} onClose={onClose} onSubmit={submit} label="تکرار" />
      </div>
    </Dialog>
  );
}

function BlockRangeDialog({ hall, anchor, onClose, onDone }) {
  const day = localDateStr(anchor);
  const [form, setForm] = useState({ date: day, from: "00:00", to: "00:00", status: "closed", reason: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setSaving(true);
    try {
      const fromIso = new Date(`${form.date}T${form.from}:00`).toISOString();
      // A "to" of 00:00 (or any value not after "from") means end-of-day, so it
      // rolls over to the next day's midnight rather than collapsing the range.
      const toDate = new Date(`${form.date}T${form.to}:00`);
      if (form.to <= form.from) toDate.setDate(toDate.getDate() + 1);
      const toIso = toDate.toISOString();
      const res = await blockRange({ hall_id: hall.id, from: fromIso, to: toIso, status: form.status, reason: form.reason });
      toast(`${toFa(res.updated || 0)} سانس به‌روزرسانی شد`);
      onDone();
      onClose();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="مسدودسازی بازه زمانی" description="سانس‌های یک بازه را تعطیل، تعمیراتی یا ویژه کنید.">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>تاریخ</Label>
          <JalaliDatePicker value={form.date} onChange={(v) => set("date", v)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>از ساعت</Label>
            <Input type="time" dir="ltr" value={form.from} onChange={(e) => set("from", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>تا ساعت</Label>
            <Input type="time" dir="ltr" value={form.to} onChange={(e) => set("to", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>نوع</Label>
          <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="closed">تعطیل / مسدود</option>
            <option value="maintenance">تعمیرات</option>
            <option value="holiday">تعطیل رسمی</option>
            <option value="special_event">رویداد ویژه</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>توضیح (اختیاری)</Label>
          <Input value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="مثلاً تعمیرات کف سالن" />
        </div>
        <DialogActions saving={saving} onClose={onClose} onSubmit={submit} label="اعمال" />
      </div>
    </Dialog>
  );
}

function BulkEditDialog({ ids, onClose, onDone }) {
  const [form, setForm] = useState({
    setPrice: false,
    base_price: 2000000,
    setDiscount: false,
    discount_percent: 0,
    setStatus: false,
    status: "available",
    setGender: false,
    gender: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    const payload = { slot_ids: ids };
    if (form.setPrice) payload.base_price = Number(form.base_price);
    if (form.setDiscount) payload.discount_percent = Number(form.discount_percent);
    if (form.setStatus) payload.status = form.status;
    if (form.setGender) payload.gender = form.gender;
    if (Object.keys(payload).length === 1) {
      toast("حداقل یک تغییر را انتخاب کنید", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await bulkUpdateSessions(payload);
      toast(`${toFa(res.updated || 0)} سانس ویرایش شد`);
      onDone();
      onClose();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={`ویرایش گروهی ${toFa(ids.length)} سانس`}>
      <div className="space-y-3">
        <BulkRow enabled={form.setPrice} onToggle={(v) => set("setPrice", v)} label="قیمت پایه (ریال)">
          <Input type="number" value={form.base_price} onChange={(e) => set("base_price", e.target.value)} disabled={!form.setPrice} />
          <p className="text-xs text-muted-foreground">{formatToman(form.base_price)} ت</p>
        </BulkRow>
        <BulkRow enabled={form.setDiscount} onToggle={(v) => set("setDiscount", v)} label="درصد تخفیف">
          <Input type="number" min={0} max={100} value={form.discount_percent} onChange={(e) => set("discount_percent", e.target.value)} disabled={!form.setDiscount} />
        </BulkRow>
        <BulkRow enabled={form.setStatus} onToggle={(v) => set("setStatus", v)} label="وضعیت">
          <Select value={form.status} onChange={(e) => set("status", e.target.value)} disabled={!form.setStatus}>
            <option value="available">آزاد</option>
            <option value="closed">تعطیل</option>
            <option value="maintenance">تعمیرات</option>
            <option value="holiday">تعطیل رسمی</option>
            <option value="special_event">رویداد ویژه</option>
          </Select>
        </BulkRow>
        <BulkRow enabled={form.setGender} onToggle={(v) => set("setGender", v)} label="جنسیت">
          <Select value={form.gender} onChange={(e) => set("gender", e.target.value)} disabled={!form.setGender}>
            <option value="">پیش‌فرض سالن</option>
            <option value="male">آقایان</option>
            <option value="female">بانوان</option>
          </Select>
        </BulkRow>
        <DialogActions saving={saving} onClose={onClose} onSubmit={submit} label="اعمال تغییرات" />
      </div>
    </Dialog>
  );
}

function BulkRow({ enabled, onToggle, label, children }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} className="h-4 w-4 accent-primary" />
        {label}
      </label>
      <div className="mt-2 space-y-1">{children}</div>
    </div>
  );
}

function DialogActions({ saving, onClose, onSubmit, label }) {
  return (
    <div className="flex justify-end gap-2 border-t border-border pt-4">
      <Button type="button" variant="ghost" onClick={onClose}>
        انصراف
      </Button>
      <Button type="button" onClick={onSubmit} disabled={saving}>
        {saving ? <Spinner /> : label}
      </Button>
    </div>
  );
}
