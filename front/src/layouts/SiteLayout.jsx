import { useState } from "react";
import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import {
  Home,
  Building2,
  CalendarCheck,
  LifeBuoy,
  UserRound,
  LogIn,
  LogOut,
  User,
  LayoutDashboard,
  Phone,
  PackageCheck,
  ShoppingBag,
  ShoppingCart,
} from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import { ContactModal } from "@/components/ContactModal";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { SUPPORT_PHONE } from "@/lib/constants";
import { cn, toFa } from "@/lib/utils";

const navItems = [
  { to: "/", label: "خانه", icon: Home, end: true },
  { to: "/complexes", label: "مجموعه‌ها", icon: Building2 },
  { to: "/store", label: "فروشگاه", icon: ShoppingBag },
  { to: "/store/orders", label: "سفارش‌های من", icon: PackageCheck },
  { to: "/my-reservations", label: "رزروهای من", icon: CalendarCheck },
  { to: "/my-tickets", label: "تیکت‌های من", icon: LifeBuoy },
  { to: "/profile", label: "پروفایل", icon: UserRound },
];

function NavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground"
        )
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  );
}

function CartButton({ className }) {
  const { cart } = useCart();
  const count = cart.item_count || 0;
  return (
    <Link
      to="/store/cart"
      className={cn("relative grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground", className)}
      aria-label={`سبد خرید (${count} قلم)`}
    >
      <ShoppingCart className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -left-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {toFa(count)}
        </span>
      )}
    </Link>
  );
}

export default function SiteLayout() {
  const { isAuthenticated, user, logout, isSuperAdmin, isVenueOwner } = useAuth();
  const navigate = useNavigate();

  // Way back into the management panels — only rendered for admin roles.
  const panel = isSuperAdmin
    ? { to: "/platform/dashboard", label: "پنل مدیریت" }
    : isVenueOwner
      ? { to: "/owner/dashboard", label: "پنل مالک مجموعه" }
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-background pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Logo />

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <CartButton />
            {isAuthenticated ? (
              <>
                {panel && (
                  <Button variant="outline" onClick={() => navigate(panel.to)}>
                    <LayoutDashboard className="h-4 w-4" />
                    {panel.label}
                  </Button>
                )}
                <Link
                  to="/profile"
                  className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/70"
                >
                  <User className="h-4 w-4 text-primary" />
                  {user.full_name}
                </Link>
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

          {/* Navigation itself lives in the bottom bar on mobile; the header
              keeps only the account actions. */}
          <div className="flex items-center gap-1 md:hidden">
            <CartButton />
            {isAuthenticated ? (
              <>
                {panel && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate(panel.to)}
                    aria-label={panel.label}
                  >
                    <LayoutDashboard className="h-5 w-5" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={logout} aria-label="خروج">
                  <LogOut className="h-5 w-5" />
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => navigate("/login")}>
                <LogIn className="h-4 w-4" />
                ورود
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <Footer />

      <BottomNav items={navItems} breakpoint="md" />
    </div>
  );
}

function Footer() {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <footer className="mt-16 border-t border-border bg-navy text-navy-foreground">
      <div className="container grid gap-10 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo light stacked />
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
              <Link to="/store" className="hover:text-white">
                فروشگاه ورزشی
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
          </ul>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-bold">ارتباط با ما</h4>
          <ul className="space-y-3 text-sm text-white/60">
            <li className="hover:text-white">درباره ما</li>
            <li>
              <button onClick={() => setContactOpen(true)} className="hover:text-white">
                تماس با ما
              </button>
            </li>
            <li>
              <a
                href={`tel:${SUPPORT_PHONE}`}
                className="flex items-center gap-2 text-white/80 hover:text-white"
              >
                <Phone className="h-4 w-4" />
                <span dir="ltr">{toFa(SUPPORT_PHONE)}</span>
              </a>
            </li>
            <li className="flex items-center gap-2 text-white/80">
              <CalendarCheck className="h-4 w-4" /> پشتیبانی ۲۴ ساعته
            </li>
          </ul>
        </div>
      </div>
      <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 py-5 text-xs text-white/50 sm:flex-row">
        <span>© تمامی حقوق برای پلتفرم سانسیار محفوظ است.</span>
        <a
          referrerPolicy="origin"
          target="_blank"
          rel="noreferrer"
          href="https://trustseal.enamad.ir/?id=7347772&Code=hyLyej5OmllVENIa986kVv597FYYZLBS"
          className="shrink-0"
        >
          <img
            referrerPolicy="origin"
            src="https://trustseal.enamad.ir/logo.aspx?id=7347772&Code=hyLyej5OmllVENIa986kVv597FYYZLBS"
            alt="نماد اعتماد الکترونیکی"
            code="hyLyej5OmllVENIa986kVv597FYYZLBS"
            className="h-[72px] w-[72px] cursor-pointer rounded bg-white object-contain p-1"
          />
        </a>
      </div>

      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </footer>
  );
}
