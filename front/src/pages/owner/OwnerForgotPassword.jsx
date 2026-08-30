import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, Smartphone, Lock, ArrowRight } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/skeleton";
import { toast } from "@/components/Toast";
import { forgotPassword, resetPassword } from "@/api/endpoints";
import { isIranMobile, isStrongPassword, normalizePhoneInput } from "@/lib/validation";

export default function OwnerForgotPassword() {
  const navigate = useNavigate();
  const [stepName, setStepName] = useState("phone"); // phone | reset
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendCode(e) {
    e.preventDefault();
    setError("");
    if (!isIranMobile(phone)) {
      setError("شماره موبایل معتبر نیست");
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(phone.trim());
      toast("کد بازیابی ارسال شد");
      setStepName("reset");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitReset(e) {
    e.preventDefault();
    setError("");
    if (!code.trim()) return setError("کد بازیابی را وارد کنید");
    if (!isStrongPassword(newPassword)) {
      setError("رمز عبور باید حداقل ۸ کاراکتر و شامل حروف و اعداد باشد");
      return;
    }
    setLoading(true);
    try {
      await resetPassword({ phone: phone.trim(), code: code.trim(), newPassword });
      toast("رمز عبور تغییر کرد؛ اکنون وارد شوید");
      navigate("/owner/login", { replace: true });
    } catch (err) {
      setError(err.message || "کد نامعتبر است");
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
              <KeyRound className="h-6 w-6" />
            </span>
            <h1 className="text-xl font-extrabold">بازیابی رمز عبور</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {stepName === "phone"
                ? "شماره موبایل حساب خود را وارد کنید."
                : "کد ارسال‌شده و رمز عبور جدید را وارد کنید."}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {stepName === "phone" ? (
              <motion.form key="phone" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} onSubmit={sendCode} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>شماره موبایل</Label>
                  <div className="relative">
                    <Smartphone className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input inputMode="numeric" dir="ltr" placeholder="09123456789" value={phone} onChange={(e) => setPhone(normalizePhoneInput(e.target.value))} className="pr-11 text-center" />
                  </div>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? <Spinner /> : <KeyRound className="h-5 w-5" />}
                  ارسال کد بازیابی
                </Button>
              </motion.form>
            ) : (
              <motion.form key="reset" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} onSubmit={submitReset} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>کد بازیابی</Label>
                  <Input inputMode="numeric" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} className="text-center tracking-[0.4em]" />
                </div>
                <div className="space-y-1.5">
                  <Label>رمز عبور جدید</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input type="password" dir="ltr" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pr-11" />
                  </div>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? <Spinner /> : <Lock className="h-5 w-5" />}
                  تغییر رمز عبور
                </Button>
                <button type="button" onClick={() => setStepName("phone")} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
                  ویرایش شماره موبایل
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="mt-6 border-t border-border pt-4 text-center text-sm">
            <Link to="/owner/login" className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
              <ArrowRight className="h-4 w-4" />
              بازگشت به ورود
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
