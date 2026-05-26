import { useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Building2,
  Warehouse,
  CalendarClock,
  Ticket,
  LogOut,
  Menu,
  Bell,
  ExternalLink,
} from "lucide-react";

import { Logo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { ROLE } from "@/lib/constants";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/admin/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { to: "/admin/complexes", label: "مجموعه‌ها", icon: Building2 },
  { to: "/admin/halls", label: "سالن‌ها", icon: Warehouse },
  { to: "/admin/slots", label: "سانس‌ها", icon: CalendarClock },
  { to: "/admin/reservations", label: "رزروها", icon: Ticket },
];

const titles = {
  "/admin/dashboard": "داشبورد",
  "/admin/complexes": "مدیریت مجموعه‌ها",
  "/admin/halls": "مدیریت سالن‌ها",
  "/admin/slots": "مدیریت سانس‌ها",
  "/admin/reservations": "مدیریت رزروها",
};

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  function SidebarContent() {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center border-b border-white/10 px-6">
          <Logo light />
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <button
            onClick={() => navigate("/")}
            className="mb-1 flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ExternalLink className="h-5 w-5" />
            مشاهده سایت
          </button>
          <button
            onClick={() => {
              logout();
              navigate("/admin/login");
            }}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-white/70 transition-colors hover:bg-destructive hover:text-white"
          >
            <LogOut className="h-5 w-5" />
            خروج
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-64 bg-navy text-navy-foreground lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-navy/40 backdrop-blur-sm lg:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 right-0 z-50 w-64 bg-navy text-navy-foreground lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="lg:pr-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur-lg lg:px-8">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="منو"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-bold">
              {titles[location.pathname] || "پنل مدیریت"}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative rounded-lg p-2 text-muted-foreground hover:bg-accent">
              <Bell className="h-5 w-5" />
              <span className="absolute left-2 top-2 h-2 w-2 rounded-full bg-destructive" />
            </button>
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {user?.full_name?.charAt(0) || "م"}
              </span>
              <div className="hidden text-right sm:block">
                <p className="text-xs font-bold leading-tight">{user?.full_name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {ROLE[user?.role] || "مدیر"}
                </p>
              </div>
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
