import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Smartphone, Building2, ArrowLeft, ArrowRight } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { normalizePhoneInput } from "@/lib/validation";

export default function OwnerLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!/^09\d{9}$/.test(phone.trim())) {
      setError("شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)");
      return;
    }
    setLoading(true);
    try {
      const user = await login({ phone: phone.trim(), password, rememberMe });
      if (user.role !== "venue_owner" && user.role !== "venue_manager") {
        setError("این حساب دسترسی مالک مجموعه ندارد");
        return;
      }
      navigate("/owner/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="owner-theme flex min-h-screen items-center justify-center bg-background p-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo stacked />
        </div>
        <Card className="border-border p-8 shadow-soft">
          <div className="mb-6 text-center">
            <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="h-6 w-6" />
            </span>
            <h1 className="text-xl font-extrabold">ورود به داشبورد مجموعه</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              با شماره موبایل و رمز عبور وارد شوید.
            </p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone">شماره موبایل</Label>
              <div className="relative">
                <Smartphone className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone"
                  inputMode="numeric"
                  dir="ltr"
                  placeholder="09123456789"
                  value={phone}
                  onChange={(e) => setPhone(normalizePhoneInput(e.target.value))}
                  className="pr-11 text-center"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">رمز عبور</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-11" />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                مرا به خاطر بسپار
              </label>
              <Link to="/owner/forgot-password" className="text-primary hover:underline">
                فراموشی رمز عبور؟
              </Link>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <Spinner /> : <ArrowLeft className="h-5 w-5" />}
              ورود
            </Button>
          </form>

          <div className="mt-5 rounded-xl border border-dashed border-border p-3 text-center text-sm">
            <span className="text-muted-foreground">حساب کاربری ندارید؟ </span>
            <Link to="/owner/register" className="font-bold text-primary hover:underline">
              ثبت‌نام
            </Link>
          </div>

          <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
            دمو: <b dir="ltr">09120000000</b> + رمز <b dir="ltr">Password123!</b>
          </p>
          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 text-center text-sm">
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
