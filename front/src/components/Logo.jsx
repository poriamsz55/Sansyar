import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import logoOnDark from "@/assets/logo-on-dark.png";
import logoPlate from "@/assets/logo-plate.png";
import logoMark from "@/assets/logo-mark.png";
import logoMarkOnDark from "@/assets/logo-mark-on-dark.png";

export function Logo({ to = "/", light = false, stacked = false, className }) {
  const stackedSrc = light ? logoOnDark : logoPlate;
  const markSrc = light ? logoMarkOnDark : logoMark;

  return (
    <Link
      to={to}
      aria-label="سانسیار"
      className={cn("inline-flex items-center gap-2.5", className)}
    >
      {stacked ? (
        <img src={stackedSrc} alt="" className="h-28 w-auto" />
      ) : (
        <>
          <img src={markSrc} alt="" className="h-9 w-auto shrink-0" />
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
                "mt-1 text-[10px] font-medium",
                light ? "text-white/60" : "text-muted-foreground"
              )}
            >
              پلتفرم جامع خدمات ورزشی
            </span>
          </span>
        </>
      )}
    </Link>
  );
}
