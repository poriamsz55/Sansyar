import { useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Building2,
  CalendarClock,
  Ticket,
  LogOut,
  Menu,
  ExternalLink,
} from "lucide-react";

import { Logo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { ROLE } from "@/lib/constants";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/owner/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { to: "/owner/venues", label: "مجموعه‌ها و سالن‌ها", icon: Building2 },
  { to: "/owner/slots", label: "سانس‌ها", icon: CalendarClock },
  { to: "/owner/reservations", label: "رزروها", icon: Ticket },
];

const titles = {
  "/owner/dashboard": "داشبورد مجموعه",
  "/owner/venues": "مجموعه‌ها و سالن‌ها",
  "/owner/slots": "مدیریت سانس‌ها",
  "/owner/reservations": "رزروهای مجموعه",
};

export default function OwnerLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  function SidebarContent() {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center border-b border-border px-6">
          <Logo />
        </div>

        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            پنل مالک مجموعه
          </p>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <button
            onClick={() => navigate("/")}
            className="mb-0.5 flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
            مشاهده سایت
          </button>
          <button
            onClick={() => {
              logout();
              navigate("/owner/login");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            خروج
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="owner-theme min-h-screen bg-background">
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-60 border-l border-border bg-card lg:block">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 right-0 z-50 w-60 border-l border-border bg-card lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="lg:pr-60">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur-lg lg:px-8">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="منو">
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-base font-bold">{titles[location.pathname] || "داشبورد مجموعه"}</h1>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-1.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {user?.full_name?.charAt(0) || "م"}
            </span>
            <div className="hidden text-right sm:block">
              <p className="text-xs font-bold leading-tight">{user?.full_name}</p>
              <p className="text-[10px] text-muted-foreground">{ROLE[user?.role] || "مالک"}</p>
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
