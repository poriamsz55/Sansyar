import { motion } from "framer-motion";
import { cn, formatTimeRange, toFa } from "@/lib/utils";
import { SLOT_STATUS, SLOT_GENDER } from "@/lib/constants";
import { isSlotInTheFuture } from "@/lib/reservation";

/**
 * Selectable time-slot chip. Available slots show their full time range and are
 * interactive; reserved and other unavailable slots (blocked, maintenance,
 * holiday…) are disabled and clearly labelled with their specific state so the
 * user can tell a booked session apart from one that's simply closed.
 */
export function SlotChip({ slot, selected, onSelect, className }) {
  const started = !isSlotInTheFuture(slot);
  const disabled = slot.status !== "available" || started;
  const reserved = slot.status === "reserved" || slot.booked_count > 0;
  const statusLabel = started ? "منقضی" : SLOT_STATUS[slot.status]?.label || "نامشخص";

  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.96 }}
      disabled={disabled}
      onClick={() => onSelect?.(slot)}
      title={disabled ? statusLabel : undefined}
      className={cn(
        "flex min-w-0 w-full flex-col items-center gap-0.5 rounded-xl border px-3 py-2.5 text-center transition-all",
        reserved
          ? "cursor-not-allowed border-destructive/30 bg-destructive/5 text-destructive/80"
          : disabled
            ? "cursor-not-allowed border-border bg-muted text-muted-foreground line-through"
            : selected
              ? "border-primary bg-primary text-primary-foreground shadow-soft"
              : "border-border bg-card text-foreground hover:border-primary hover:bg-primary/5",
        className
      )}
    >
      <span className="flex items-center gap-1">
        <span className={cn("text-sm font-bold tnum", reserved && "line-through")}>
          {formatTimeRange(slot.starts_at, slot.ends_at)}
        </span>
        {SLOT_GENDER[slot.gender] && (
          <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
            ({SLOT_GENDER[slot.gender].label})
          </span>
        )}
      </span>
      {slot.discount_percent > 0 && !disabled ? (
        <span
          className={cn(
            "text-[10px] font-medium",
            selected ? "text-primary-foreground/80" : "text-success"
          )}
        >
          {toFa(slot.discount_percent)}٪ تخفیف
        </span>
      ) : (
        <span className="text-[10px] opacity-80">
          {disabled ? statusLabel : "آزاد"}
        </span>
      )}
    </motion.button>
  );
}
