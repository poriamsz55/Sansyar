import { useRef, useState } from "react";
import { Lock } from "lucide-react";

import { cn, toFa, formatToman } from "@/lib/utils";
import {
  DAY_START_HOUR,
  DAY_END_HOUR,
  WEEKDAY_LABELS,
  minutesOfDay,
  sessionSpan,
  isoFromLocal,
  snap,
  clockLabel,
  occupancy,
  sessionColors,
  jalaliDayNum,
  sameDay,
  startOfWeek,
  addDays,
} from "@/lib/sessions";

const HOUR_PX = 56;
const GRID_MIN = DAY_START_HOUR * 60;
const GRID_HEIGHT = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_PX;
const MIN_DURATION = 30;
const DRAG_THRESHOLD = 4;

/**
 * Time-grid calendar: rows are the day's hours, columns are the supplied days
 * (7 for week view, 1 for day view). Sessions render as color-coded blocks that
 * can be tapped to edit, dragged to move (desktop), and edge-dragged to resize.
 */
export default function WeekGrid({
  days,
  sessions,
  onSelect,
  onCreate,
  onMove,
  onResize,
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
}) {
  const bodyRef = useRef(null);
  const dragRef = useRef(null);
  // The browser fires a `click` right after a session pointer interaction; that
  // click bubbles to the column and would otherwise open the new-session dialog
  // at the drop point (an accidental duplicate). This flag swallows that click.
  const suppressClickRef = useRef(false);
  const [drag, setDrag] = useState(null); // { id, mode, dayIndex, startMin, durationMin, moved }

  // Keep a ref in sync so pointer handlers can read the latest drag without
  // running side effects inside the (pure) state updater.
  function updateDrag(next) {
    const value = typeof next === "function" ? next(dragRef.current) : next;
    dragRef.current = value;
    setDrag(value);
  }

  const byDay = days.map((day) =>
    sessions
      .filter((s) => sameDay(new Date(s.starts_at), day))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  );

  function metrics() {
    const rect = bodyRef.current.getBoundingClientRect();
    return { rect, dayWidth: rect.width / days.length };
  }

  function pointFromEvent(e) {
    const { rect, dayWidth } = metrics();
    // RTL: the rightmost column is day index 0.
    let dayIndex = Math.floor((rect.right - e.clientX) / dayWidth);
    dayIndex = Math.max(0, Math.min(days.length - 1, dayIndex));
    const minutes = GRID_MIN + ((e.clientY - rect.top) / HOUR_PX) * 60;
    return { dayIndex, minutes };
  }

  function beginDrag(e, session, mode) {
    if (selectionMode) return;
    if (session.status === "closed" || session.status === "blocked") return;
    e.preventDefault();
    e.stopPropagation();
    const { startMin: start, durationMin } = sessionSpan(session);
    const dayIndex = days.findIndex((d) => sameDay(new Date(session.starts_at), d));
    const origin = { x: e.clientX, y: e.clientY };
    const base = { id: session.id, mode, dayIndex, startMin: start, durationMin, moved: false, session };
    updateDrag(base);

    function onMoveEvt(ev) {
      const movedEnough =
        Math.abs(ev.clientX - origin.x) > DRAG_THRESHOLD || Math.abs(ev.clientY - origin.y) > DRAG_THRESHOLD;
      const p = pointFromEvent(ev);
      updateDrag((d) => {
        if (!d) return d;
        if (d.mode === "resize") {
          const newEnd = snap(Math.max(d.startMin + MIN_DURATION, Math.min(DAY_END_HOUR * 60, p.minutes)));
          return { ...d, durationMin: newEnd - d.startMin, moved: movedEnough || d.moved };
        }
        // move
        let newStart = snap(p.minutes - d.durationMin / 2);
        newStart = Math.max(GRID_MIN, Math.min(DAY_END_HOUR * 60 - d.durationMin, newStart));
        return { ...d, startMin: newStart, dayIndex: p.dayIndex, moved: movedEnough || d.moved };
      });
    }

    function onUp() {
      window.removeEventListener("pointermove", onMoveEvt);
      window.removeEventListener("pointerup", onUp);
      const d = dragRef.current;
      updateDrag(null);
      if (!d) return;
      // Swallow the click that the browser dispatches after this pointerup so it
      // can't reach the column's create handler. Reset on the next tick.
      suppressClickRef.current = true;
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
      if (!d.moved) {
        onSelect?.(d.session);
        return;
      }
      const day = days[d.dayIndex];
      const startsAt = isoFromLocal(day, d.startMin);
      const endsAt = isoFromLocal(day, d.startMin + d.durationMin);
      if (d.mode === "resize") onResize?.(d.session, { endsAt });
      else onMove?.(d.session, { startsAt, endsAt });
    }

    window.addEventListener("pointermove", onMoveEvt);
    window.addEventListener("pointerup", onUp);
  }

  function handleColumnClick(e, day) {
    if (suppressClickRef.current || drag) return;
    const { minutes } = pointFromEvent(e);
    onCreate?.({ day, startMinutes: Math.max(GRID_MIN, snap(minutes, 30)) });
  }

  const hours = [];
  for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) hours.push(h);

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[640px]" style={{ direction: "rtl" }}>
        {/* Time gutter (rightmost in RTL) */}
        <div className="w-12 shrink-0 pt-10">
          {hours.map((h) => (
            <div key={h} className="relative text-[10px] text-muted-foreground" style={{ height: HOUR_PX }}>
              <span className="absolute -top-1.5 right-1">{toFa(`${String(h).padStart(2, "0")}:00`)}</span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div ref={bodyRef} className="flex flex-1">
          {days.map((day, dayIndex) => {
            const isToday = sameDay(day, new Date());
            return (
              <div key={dayIndex} className="flex-1 border-r border-border first:border-l">
                <div
                  className={cn(
                    "sticky top-0 z-10 h-10 border-b border-border bg-card/95 text-center backdrop-blur",
                    isToday && "bg-primary/5"
                  )}
                >
                  <div className="text-[11px] font-bold leading-4 pt-1">
                    {WEEKDAY_LABELS[(day.getDay() + 1) % 7]}
                  </div>
                  <div className={cn("text-[10px] leading-3", isToday ? "text-primary font-bold" : "text-muted-foreground")}>
                    {jalaliDayNum(day)}
                  </div>
                </div>

                <div
                  className="relative cursor-copy"
                  style={{ height: GRID_HEIGHT }}
                  onClick={(e) => handleColumnClick(e, day)}
                >
                  {/* hour grid lines */}
                  {hours.map((h, i) => (
                    <div
                      key={h}
                      className="absolute inset-x-0 border-b border-border/60"
                      style={{ top: i * HOUR_PX, height: HOUR_PX }}
                    />
                  ))}

                  {byDay[dayIndex].map((session) => {
                    const dragging = drag?.id === session.id;
                    const span = sessionSpan(session);
                    const startMin = dragging ? drag.startMin : span.startMin;
                    const durMin = dragging ? drag.durationMin : span.durationMin;
                    const colDayIndex = dragging ? drag.dayIndex : dayIndex;
                    if (dragging && colDayIndex !== dayIndex) return null; // render in target column instead
                    const occ = occupancy(session);
                    const colors = sessionColors(session);
                    const top = ((startMin - GRID_MIN) / 60) * HOUR_PX;
                    const height = Math.max(22, (durMin / 60) * HOUR_PX);
                    const selected = selectedIds.has(session.id);
                    return (
                      <SessionBlock
                        key={session.id}
                        session={session}
                        colors={colors}
                        occ={occ}
                        top={top}
                        height={height}
                        durMin={durMin}
                        selected={selected}
                        selectionMode={selectionMode}
                        dragging={dragging}
                        onPointerDownBlock={(e) =>
                          selectionMode ? onToggleSelect?.(session.id) : beginDrag(e, session, "move")
                        }
                        onPointerDownResize={(e) => beginDrag(e, session, "resize")}
                      />
                    );
                  })}

                  {/* blocks dragged into THIS column from another column */}
                  {drag && days[drag.dayIndex] && sameDay(days[drag.dayIndex], day) && (() => {
                    const fromOtherCol = !sameDay(new Date(drag.session.starts_at), day);
                    if (!fromOtherCol) return null;
                    const occ = occupancy(drag.session);
                    const colors = sessionColors(drag.session);
                    const top = ((drag.startMin - GRID_MIN) / 60) * HOUR_PX;
                    const height = Math.max(22, (drag.durationMin / 60) * HOUR_PX);
                    return (
                      <SessionBlock
                        key={`ghost-${drag.id}`}
                        session={drag.session}
                        colors={colors}
                        occ={occ}
                        top={top}
                        height={height}
                        durMin={drag.durationMin}
                        dragging
                      />
                    );
                  })()}

                  {isToday && <NowLine />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SessionBlock({
  session,
  colors,
  occ,
  top,
  height,
  durMin,
  selected,
  selectionMode,
  dragging,
  onPointerDownBlock,
  onPointerDownResize,
}) {
  const locked = session.status === "closed" || session.status === "blocked";
  const compact = height < 44;
  return (
    <div
      onPointerDown={onPointerDownBlock}
      className={cn(
        "absolute inset-x-0.5 overflow-hidden rounded-md border px-1.5 py-1 text-[11px] shadow-sm transition-shadow",
        colors.block,
        selectionMode ? "cursor-pointer" : locked ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        dragging && "z-30 opacity-90 ring-2 ring-primary shadow-lg",
        selected && "ring-2 ring-primary"
      )}
      style={{ top, height }}
      title={`${clockLabel(occ ? minutesOfDayStr(session) : 0)}`}
    >
      <div className="flex items-center justify-between gap-1 font-bold leading-tight">
        <span className="truncate" dir="ltr">
          {fmtRange(session)}
        </span>
        {locked && <Lock className="h-3 w-3 shrink-0" />}
      </div>
      {!compact && (
        <>
          <div className="truncate">{session.title || formatToman(session.final_price) + " ت"}</div>
          <div className="mt-0.5 flex items-center gap-1">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/10">
              <div className={cn("h-full", colors.bar)} style={{ width: `${occ.pct}%` }} />
            </div>
            <span className="shrink-0 tabular-nums">
              {toFa(occ.booked)}/{toFa(occ.capacity)}
            </span>
          </div>
        </>
      )}
      {!selectionMode && !locked && (
        <div
          onPointerDown={onPointerDownResize}
          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
          title="تغییر مدت"
        />
      )}
    </div>
  );
}

function NowLine() {
  const min = minutesOfDay(new Date());
  if (min < GRID_MIN || min > DAY_END_HOUR * 60) return null;
  const top = ((min - GRID_MIN) / 60) * HOUR_PX;
  return (
    <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top }}>
      <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
      <div className="h-px flex-1 bg-rose-500/70" />
    </div>
  );
}

function fmtRange(session) {
  const s = new Date(session.starts_at);
  const e = new Date(session.ends_at);
  const f = (d) => toFa(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
  return `${f(s)}–${f(e)}`;
}

function minutesOfDayStr(session) {
  return minutesOfDay(new Date(session.starts_at));
}

export { GRID_HEIGHT, startOfWeek, addDays };
