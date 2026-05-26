import { Star } from "lucide-react";
import { toFa } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function RatingStars({ value = 0, count, size = 14, className }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <Star
        className="fill-amber-400 text-amber-400"
        style={{ width: size, height: size }}
      />
      <span className="text-sm font-semibold">{toFa(value.toFixed(1))}</span>
      {count != null && (
        <span className="text-xs text-muted-foreground">({toFa(count)} نظر)</span>
      )}
    </span>
  );
}
