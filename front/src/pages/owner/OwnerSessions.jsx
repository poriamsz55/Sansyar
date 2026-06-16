import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight,
  ChevronLeft,
  Repeat,
  History,
  CalendarClock,
  Building2,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/PageTransition";
import { toast } from "@/components/Toast";

import WeekGrid from "@/components/sessions/WeekGrid";
import TimeField from "@/components/sessions/TimeField";
import MonthView from "@/components/sessions/MonthView";
import SessionEditPanel from "@/components/sessions/SessionEditPanel";
import RecurringDialog from "@/components/sessions/RecurringDialog";
import BulkBar from "@/components/sessions/BulkBar";
import AuditDrawer from "@/components/sessions/AuditDrawer";

import {
  listOwnerComplexes,
  listHalls,
  listSports,
  listSessions,
  createSession,
  updateSession,
} from "@/api/endpoints";
import { cn, toFa, formatToman } from "@/lib/utils";
import {
  weekDays,
  startOfWeek,
  startOfDay,
  addDays,
  monthGrid,
  jalaliMonthLabel,
  jalaliRangeLabel,
  jalaliDayNum,
  isoFromLocal,
  STATUS_LEGEND,
  WEEKDAY_LABELS,
} from "@/lib/sessions";

const VIEWS = [
  { key: "day", label: "روز" },
  { key: "week", label: "هفته" },
  { key: "month", label: "ماه" },
];

export default function OwnerSessions() {
  const [halls, setHalls] = useState(null);
  const [complexMap, setComplexMap] = useState({});
  const [sportMap, setSportMap] = useState({});
  const [hallId, setHallId] = useState("");

  const [view, setView] = useState("week");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [sessions, setSessions] = useState(null);

  const [selected, setSelected] = useState(null); // session being edited
  const [showRecurring, setShowRecurring] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [quickCreate, setQuickCreate] = useState(null); // { day, startMinutes }

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const hall = useMemo(() => halls?.find((h) => h.id === hallId), [halls, hallId]);

  // Sports the session can belong to: the hall's supported sports, or — if the
  // hall has none configured — every sport, so the owner can still pick one.
  const sportOptions = useMemo(() => {
    const ids = hall?.supported_sport_ids?.length ? hall.supported_sport_ids : Object.keys(sportMap);
    return ids.map((id) => ({ id, name: sportMap[id] || id }));
  }, [hall, sportMap]);

  // ---- range for current view ----
  const range = useMemo(() => {
    if (view === "day") return { from: startOfDay(anchor), to: addDays(startOfDay(anchor), 1), days: [startOfDay(anchor)] };
    if (view === "week") {
      const days = weekDays(anchor);
      return { from: days[0], to: addDays(days[6], 1), days };
    }
    const cells = monthGrid(anchor);
    return { from: cells[0].date, to: addDays(cells[41].date, 1), days: [] };
  }, [view, anchor]);

  async function loadHalls() {
    const complexes = await listOwnerComplexes();
    setComplexMap(Object.fromEntries(complexes.map((c) => [c.id, c])));
    const lists = await Promise.all(complexes.map((c) => listHalls(c.id, { includeInactive: true })));
    const flat = lists.flat();
    setHalls(flat);
    if (flat[0] && !hallId) setHallId(flat[0].id);
    const sports = await listSports();
    setSportMap(Object.fromEntries(sports.map((s) => [s.id, s.name])));
  }

  async function loadSessions() {
    if (!hallId) return;
    setSessions(null);
    try {
      const data = await listSessions({
        hallId,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      });
      setSessions(data);
    } catch (err) {
      toast(err.message, "error");
      setSessions([]);
    }
  }

  useEffect(() => {
    loadHalls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hallId, view, anchor]);

  function navigate(dir) {
    const step = view === "month" ? null : view === "week" ? 7 : 1;
    if (step) setAnchor((a) => addDays(a, dir * step));
    else {
      // month: jump ~one Jalali month by stepping 30 days then snapping handled by grid
      setAnchor((a) => addDays(a, dir * 30));
    }
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ---- drag handlers ----
  async function handleMove(session, { startsAt, endsAt }) {
    setSessions((list) => list.map((s) => (s.id === session.id ? { ...s, starts_at: startsAt, ends_at: endsAt } : s)));
    try {
      await updateSession(session.id, { starts_at: startsAt, ends_at: endsAt });
    } catch (err) {
      toast(err.message, "error");
      loadSessions();
    }
  }
  async function handleResize(session, { endsAt }) {
    setSessions((list) => list.map((s) => (s.id === session.id ? { ...s, ends_at: endsAt } : s)));
    try {
      await updateSession(session.id, { ends_at: endsAt });
    } catch (err) {
      toast(err.message, "error");
      loadSessions();
    }
  }

  const monthLabel =
    view === "month" ? jalaliMonthLabel(anchor) : view === "week" ? jalaliRangeLabel(range.days[0], range.days[6]) : `${WEEKDAY_LABELS[(anchor.getDay() + 1) % 7]} ${jalaliDayNum(anchor)}`;

  if (halls === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (halls.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="هنوز سالنی ندارید"
        description="برای مدیریت سانس‌ها، ابتدا یک مجموعه و سالن بسازید."
        action={
          <Link to="/owner/venues">
            <Button>
              <Building2 className="h-4 w-4" />
              رفتن به مجموعه‌ها
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Top controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-60">
            <Select value={hallId} onChange={(e) => setHallId(e.target.value)}>
              {halls.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} — {complexMap[h.complex_id]?.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex rounded-lg border border-border p-0.5">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  view === v.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAudit(true)}>
            <History className="h-4 w-4" />
            تاریخچه
          </Button>
          <Button size="sm" onClick={() => setShowRecurring(true)}>
            <Repeat className="h-4 w-4" />
            سانس تکرارشونده
          </Button>
        </div>
      </div>

      {/* Date nav + bulk tools */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="قبلی">
            <ChevronRight className="h-5 w-5" />
          </Button>
          <span className="min-w-[9rem] text-center text-sm font-bold">{monthLabel}</span>
          <Button variant="ghost" size="icon" onClick={() => navigate(1)} aria-label="بعدی">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAnchor(startOfDay(new Date()))}>
            امروز
          </Button>
        </div>
        <BulkBar
          hall={hall}
          anchor={anchor}
          selectionMode={selectionMode}
          setSelectionMode={setSelectionMode}
          selectedIds={selectedIds}
          clearSelection={() => setSelectedIds(new Set())}
          onDone={loadSessions}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {STATUS_LEGEND.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-full", s.dot)} />
            {s.label}
          </span>
        ))}
      </div>

      {/* Calendar */}
      <Card>
        <CardContent className="p-0">
          {sessions === null ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : view === "month" ? (
            <div className="p-3">
              <MonthView
                anchor={anchor}
                sessions={sessions}
                onPickDay={(d) => {
                  setAnchor(startOfDay(d));
                  setView("day");
                }}
              />
            </div>
          ) : (
            <WeekGrid
              days={range.days}
              sessions={sessions}
              onSelect={setSelected}
              onCreate={({ day, startMinutes }) => setQuickCreate({ day, startMinutes })}
              onMove={handleMove}
              onResize={handleResize}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />
          )}
        </CardContent>
      </Card>

      {selected && (
        <SessionEditPanel
          session={selected}
          sportName={sportMap[selected.sport_id]}
          onClose={() => setSelected(null)}
          onSaved={loadSessions}
        />
      )}
      {showRecurring && (
        <RecurringDialog open onClose={() => setShowRecurring(false)} hall={hall} sportOptions={sportOptions} onDone={loadSessions} />
      )}
      {showAudit && <AuditDrawer hallId={hallId} onClose={() => setShowAudit(false)} />}
      {quickCreate && (
        <QuickCreateDialog
          hall={hall}
          sportOptions={sportOptions}
          init={quickCreate}
          onClose={() => setQuickCreate(null)}
          onDone={loadSessions}
        />
      )}
    </div>
  );
}

function QuickCreateDialog({ hall, sportOptions = [], init, onClose, onDone }) {
  const startH = Math.floor(init.startMinutes / 60);
  const startM = init.startMinutes % 60;
  const [form, setForm] = useState({
    time: `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`,
    duration: 90,
    sport_id: sportOptions[0]?.id || "",
    base_price: hall?.base_price || 2000000,
    discount_percent: 0,
    capacity: 1,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (!form.sport_id) return toast("لطفاً ورزش سانس را انتخاب کنید", "error");
    setSaving(true);
    try {
      const [h, m] = form.time.split(":").map(Number);
      const startMin = h * 60 + m;
      const startsAt = isoFromLocal(init.day, startMin);
      const endsAt = isoFromLocal(init.day, startMin + Number(form.duration));
      await createSession({
        hall_id: hall.id,
        complex_id: hall.complex_id,
        sport_id: form.sport_id,
        starts_at: startsAt,
        ends_at: endsAt,
        base_price: Number(form.base_price),
        discount_percent: Number(form.discount_percent),
        capacity: Number(form.capacity),
        payment_policy: "full_online",
      });
      toast("سانس ساخته شد");
      onDone();
      onClose();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="سانس جدید" description={`${WEEKDAY_LABELS[(init.day.getDay() + 1) % 7]} ${jalaliDayNum(init.day)}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
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
            <Label>ساعت شروع</Label>
            <TimeField value={form.time} onChange={(v) => set("time", v)} />
          </div>
          <div className="space-y-1.5">
            <Label>مدت (دقیقه)</Label>
            <Input type="number" value={form.duration} onChange={(e) => set("duration", e.target.value)} />
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
            <Label>ظرفیت</Label>
            <Input type="number" min={1} value={form.capacity} onChange={(e) => set("capacity", e.target.value)} />
          </div>
        </div>
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          قیمت نهایی: <b>{formatToman(Math.round((Number(form.base_price) * (100 - Number(form.discount_percent))) / 100))} تومان</b>
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarClock className="h-4 w-4" />
          برای ساخت سریع، روی هر خانهٔ خالی تقویم بزنید.
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Spinner /> : "ثبت سانس"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
