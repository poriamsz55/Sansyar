import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, User, ShieldCheck, ArrowLeft, ArrowRight } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";

// Maps the demo admin username to the seeded phone the API expects.
const USERNAME_TO_PHONE = {
  admin: "09000000000",
  owner: "09120000000",
};

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!username || !password) {
      setError("نام کاربری و رمز عبور الزامی است");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const phone = USERNAME_TO_PHONE[username] || "09000000000";
      const user = await login({ phone, password });
      if (user.role !== "super_admin" && user.role !== "venue_owner") {
        setError("این حساب دسترسی مدیریتی ندارد");
        return;
      }
      navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hero-gradient flex min-h-screen items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="mb-6 flex justify-center">
          <Logo light />
        </div>

        <Card className="p-8">
          <div className="mb-6 text-center">
            <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-navy text-navy-foreground">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <h1 className="text-xl font-extrabold">ورود به پنل مدیریت</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              با نام کاربری و رمز عبور وارد شو.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">نام کاربری</Label>
              <div className="relative">
                <User className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="pr-11"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">رمز عبور</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-11"
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" size="lg" variant="navy" disabled={loading}>
              {loading ? <Spinner /> : <ArrowLeft className="h-5 w-5" />}
              ورود
            </Button>
          </form>

          <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
            دمو: نام کاربری <b>admin</b> و هر رمزی وارد کن.
          </p>

          <div className="mt-6 border-t border-border pt-4 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
            >
              <ArrowRight className="h-4 w-4" />
              ورود کاربران عادی
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
