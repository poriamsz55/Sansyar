import { motion } from "framer-motion";
import { cn, formatTime, toFa } from "@/lib/utils";

/**
 * Selectable time-slot chip. Available slots are colored & interactive;
 * reserved / maintenance slots are gray and disabled (per the spec).
 */
export function SlotChip({ slot, selected, onSelect }) {
  const disabled = slot.status !== "available";

  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.96 }}
      disabled={disabled}
      onClick={() => onSelect?.(slot)}
      className={cn(
        "flex min-w-[92px] flex-col items-center gap-0.5 rounded-xl border px-3 py-2 text-center transition-all",
        disabled
          ? "cursor-not-allowed border-border bg-muted text-muted-foreground line-through"
          : selected
            ? "border-primary bg-primary text-primary-foreground shadow-soft"
            : "border-border bg-card text-foreground hover:border-primary hover:bg-primary/5"
      )}
    >
      <span className="text-sm font-bold tnum">{formatTime(slot.starts_at)}</span>
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
        <span className="text-[10px] opacity-70">
          {disabled ? "رزرو شده" : "آزاد"}
        </span>
      )}
    </motion.button>
  );
}
