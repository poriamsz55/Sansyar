import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";

const cell =
  "relative flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium transition-colors";

function Indicator({ show }) {
  return (
    <span
      className={cn(
        "absolute top-0 h-0.5 w-8 rounded-full bg-primary transition-opacity",
        show ? "opacity-100" : "opacity-0"
      )}
    />
  );
}

/**
 * Mobile bottom navigation — the app-like tab bar that replaces the drawer /
 * header menu on small screens. Hidden from `breakpoint` up, where the desktop
 * sidebar or header takes over.
 *
 * `action` renders an extra trailing cell (a "more" button opening the full
 * menu) for panels with more destinations than fit in a tab bar. Items may
 * carry a `shortLabel` for names too long for a tab.
 */
export default function BottomNav({ items, action, breakpoint = "lg", className }) {
  const hideAt = breakpoint === "md" ? "md:hidden" : "lg:hidden";
  const columns = items.length + (action ? 1 : 0);

  return (
    <nav
      aria-label="ناوبری اصلی"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_-12px_hsl(222_47%_11%/0.35)] backdrop-blur-xl",
        hideAt,
        className
      )}
    >
      <ul
        className="grid h-16"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <li key={item.to} className="min-w-0">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(cell, isActive ? "text-primary" : "text-muted-foreground")
              }
            >
              {({ isActive }) => (
                <>
                  <Indicator show={isActive} />
                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0 transition-transform",
                      isActive && "scale-110"
                    )}
                  />
                  <span className="w-full truncate text-center leading-none">
                    {item.shortLabel || item.label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}

        {action && (
          <li className="min-w-0">
            <button
              type="button"
              onClick={action.onClick}
              aria-label={action.label}
              className={cn(cell, action.active ? "text-primary" : "text-muted-foreground")}
            >
              <Indicator show={!!action.active} />
              <action.icon className="h-5 w-5 shrink-0" />
              <span className="w-full truncate text-center leading-none">{action.label}</span>
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}
