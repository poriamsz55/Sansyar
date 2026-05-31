import { useState } from "react";
import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, CalendarCheck, LogIn, LogOut, User } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "خانه", end: true },
  { to: "/complexes", label: "مجموعه‌ها" },
  { to: "/my-reservations", label: "رزروهای من" },
];

function NavItem({ to, label, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "relative rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground"
        )
      }
    >
      {label}
    </NavLink>
  );
}

export default function SiteLayout() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Logo />

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {isAuthenticated ? (
              <>
                <span className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-medium">
                  <User className="h-4 w-4 text-primary" />
                  {user.full_name}
                </span>
                <Button variant="ghost" size="icon" onClick={logout} aria-label="خروج">
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button onClick={() => navigate("/login")}>
                <LogIn className="h-4 w-4" />
                ورود
              </Button>
            )}
          </div>

          <button
            className="rounded-lg p-2 text-foreground md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="منو"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-border bg-background md:hidden"
            >
              <div className="container flex flex-col gap-1 py-3">
                {navItems.map((item) => (
                  <NavItem key={item.to} {...item} onClick={() => setOpen(false)} />
                ))}
                <div className="mt-2 border-t border-border pt-3">
                  {isAuthenticated ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        logout();
                        setOpen(false);
                      }}
                    >
                      <LogOut className="h-4 w-4" /> خروج ({user.full_name})
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => {
                        navigate("/login");
                        setOpen(false);
                      }}
                    >
                      <LogIn className="h-4 w-4" /> ورود
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-navy text-navy-foreground">
      <div className="container grid gap-10 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-7 text-white/60">
            سانسیار پلتفرم رزرو آنلاین مجموعه‌های ورزشی است؛ سریع، امن و شفاف. سانس
            دلخواهت را پیدا کن و در چند ثانیه رزرو کن.
          </p>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-bold">دسترسی سریع</h4>
          <ul className="space-y-3 text-sm text-white/60">
            <li>
              <Link to="/complexes" className="hover:text-white">
                مجموعه‌ها
              </Link>
            </li>
            <li>
              <Link to="/my-reservations" className="hover:text-white">
                رزروهای من
              </Link>
            </li>
            <li>
              <Link to="/owner/login" className="hover:text-white">
                پنل مالک مجموعه
              </Link>
            </li>
            <li>
              <Link to="/platform/login" className="hover:text-white">
                پنل مدیر ارشد
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-bold">ارتباط با ما</h4>
          <ul className="space-y-3 text-sm text-white/60">
            <li className="hover:text-white">درباره ما</li>
            <li className="hover:text-white">تماس با ما</li>
            <li className="flex items-center gap-2 text-white/80">
              <CalendarCheck className="h-4 w-4" /> پشتیبانی ۲۴ ساعته
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/50">
        © تمامی حقوق برای پلتفرم سانسیار محفوظ است.
      </div>
    </footer>
  );
}
