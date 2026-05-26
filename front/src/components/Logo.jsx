import { Link } from "react-router-dom";
import { Hexagon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ to = "/", light = false, className }) {
  return (
    <Link to={to} className={cn("flex items-center gap-2.5", className)}>
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
        <Hexagon className="h-5 w-5" />
        <span className="absolute h-1.5 w-1.5 rounded-full bg-success" />
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "text-lg font-extrabold tracking-tight",
            light ? "text-white" : "text-navy"
          )}
        >
          سانسیار
        </span>
        <span
          className={cn(
            "text-[10px] font-medium",
            light ? "text-white/60" : "text-muted-foreground"
          )}
        >
          رزرو مجموعه‌های ورزشی
        </span>
      </span>
    </Link>
  );
}
