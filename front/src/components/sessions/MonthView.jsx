import { cn, toFa, formatToman } from "@/lib/utils";
import {
  monthGrid,
  WEEKDAY_LABELS,
  jalaliDayNum,
  sameDay,
  occupancy,
  revenueEstimate,
} from "@/lib/sessions";

/**
 * Month overview: each Jalali day cell shows its session count, occupancy dots
 * by status, and a revenue estimate. Clicking a day (outside a dot) jumps to
 * its day view; in selection mode, clicking a dot toggles that session instead.
 */
export default function MonthView({
  anchor,
  sessions,
  onPickDay,
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
}) {
  const cells = monthGrid(anchor);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-muted/50 text-center text-[11px] font-bold">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="py-2">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map(({ date, inMonth }, i) => {
          const daySessions = sessions.filter((s) => sameDay(new Date(s.starts_at), date));
          const revenue = daySessions.reduce((sum, s) => sum + revenueEstimate(s), 0);
          const isToday = sameDay(date, new Date());
          const dots = daySessions.slice(0, 8);
          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              onClick={() => !selectionMode && onPickDay(date)}
              onKeyDown={(e) => e.key === "Enter" && !selectionMode && onPickDay(date)}
              className={cn(
                "min-h-[88px] border-b border-l border-border p-1.5 text-right transition-colors",
                !selectionMode && "cursor-pointer hover:bg-accent",
                !inMonth && "bg-muted/30 text-muted-foreground/60",
                isToday && "bg-primary/5"
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("text-xs font-bold", isToday && "grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground")}>
                  {jalaliDayNum(date)}
                </span>
                {daySessions.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">{toFa(daySessions.length)} سانس</span>
                )}
              </div>
              {dots.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {dots.map((s) => {
                    const occ = occupancy(s);
                    const tone =
                      s.status === "closed" || s.status === "blocked"
                        ? "bg-slate-400"
                        : s.status === "holiday"
                          ? "bg-violet-400"
                          : s.status === "maintenance"
                            ? "bg-orange-400"
                            : occ.fill === "full"
                              ? "bg-rose-500"
                              : occ.fill === "partial"
                                ? "bg-amber-500"
                                : "bg-emerald-500";
                    const selected = selectedIds.has(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        title={s.title || undefined}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectionMode) onToggleSelect?.(s.id);
                          else onPickDay(date);
                        }}
                        className={cn(
                          "h-2.5 w-2.5 rounded-full ring-offset-1 transition-all",
                          tone,
                          selectionMode && "hover:scale-125",
                          selected && "ring-2 ring-primary scale-125"
                        )}
                      />
                    );
                  })}
                </div>
              )}
              {revenue > 0 && (
                <div className="mt-1 truncate text-[10px] font-medium text-success">{formatToman(revenue)} ت</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
