import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, User, Shield, ArrowLeft, ArrowRight } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";

const USERNAME_TO_PHONE = {
  admin: "09000000000",
  superadmin: "09000000000",
};

export default function PlatformLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const phone = USERNAME_TO_PHONE[username] || "09000000000";
      const user = await login({ phone, password });
      if (user.role !== "super_admin") {
        setError("فقط مدیران ارشد به این پنل دسترسی دارند");
        return;
      }
      navigate("/platform/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="platform-theme flex min-h-screen items-center justify-center bg-background p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(262_83%_58%/0.12),transparent_50%)]" />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo light />
        </div>
        <Card className="border-border bg-card p-8 shadow-soft-lg">
          <div className="mb-6 text-center">
            <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/20 text-primary">
              <Shield className="h-6 w-6" />
            </span>
            <h1 className="text-xl font-extrabold">Sansyar Platform</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              پنل مدیریت ارشد — تأیید مجموعه‌ها، کاربران و گزارش‌های مالی
            </p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">نام کاربری</Label>
              <div className="relative">
                <User className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} className="pr-11 bg-muted/30" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">رمز عبور</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-11 bg-muted/30" />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <Spinner /> : <ArrowLeft className="h-5 w-5" />}
              ورود به پلتفرم
            </Button>
          </form>
          <p className="mt-4 rounded-lg bg-muted/50 px-3 py-2 text-center text-xs text-muted-foreground">
            دمو: <b>admin</b> + رمز <b dir="ltr">Password123!</b>
          </p>
          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 text-center text-sm">
            <Link to="/owner/login" className="text-muted-foreground hover:text-primary">
              ورود مالک مجموعه
            </Link>
            <Link to="/login" className="inline-flex items-center justify-center gap-1 text-muted-foreground hover:text-primary">
              <ArrowRight className="h-4 w-4" />
              ورود مشتری
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
