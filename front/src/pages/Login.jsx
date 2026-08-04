import { useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, ShieldCheck, ArrowLeft, ArrowRight, KeyRound } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { requestOtp } from "@/api/endpoints";
import { OTP_LENGTH } from "@/lib/constants";
import { normalizePhoneInput } from "@/lib/validation";
import { toFa } from "@/lib/utils";

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { loginWithOtp } = useAuth();
  const redirect = params.get("redirect") || "/";

  const [step, setStep] = useState("phone"); // phone | otp
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(() => Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputs = useRef([]);

  async function sendCode(e) {
    e.preventDefault();
    if (!/^09\d{9}$/.test(phone)) {
      setError("شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await requestOtp(phone);
      setStep("otp");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function onOtpChange(i, val) {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < OTP_LENGTH - 1) inputs.current[i + 1]?.focus();
  }

  async function verify(e) {
    e.preventDefault();
    if (otp.join("").length < OTP_LENGTH) {
      setError(`کد تأیید ${toFa(OTP_LENGTH)} رقمی را کامل وارد کن`);
      return;
    }
    setError("");
    setLoading(true);
    try {
      await loginWithOtp(phone, otp.join(""));
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Visual side */}
      <div className="hero-gradient relative hidden flex-col justify-between p-12 text-white lg:flex">
        <Logo light />
        <div>
          <h2 className="text-3xl font-extrabold leading-snug">
            رزرو سانس ورزشی،
            <br />
            ساده‌تر از همیشه
          </h2>
          <p className="mt-4 max-w-sm leading-8 text-white/70">
            با شماره موبایلت وارد شو و در چند ثانیه بهترین سانس را رزرو کن.
          </p>
          <div className="mt-8 flex items-center gap-2 text-sm text-white/80">
            <ShieldCheck className="h-5 w-5 text-success" />
            ورود امن با کد یک‌بارمصرف
          </div>
        </div>
        <p className="text-xs text-white/40">© پلتفرم سانسیار</p>
      </div>

      {/* Form side */}
      <div className="flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo />
          </div>

          <button
            onClick={() => navigate("/")}
            className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="h-4 w-4" />
            بازگشت به خانه
          </button>

          <AnimatePresence mode="wait">
            {step === "phone" ? (
              <motion.form
                key="phone"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={sendCode}
                className="space-y-5"
              >
                <div>
                  <h1 className="text-2xl font-extrabold">ورود | ثبت‌نام</h1>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    شماره موبایلت را وارد کن تا کد تأیید برایت ارسال شود.
                  </p>
                </div>

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

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? <Spinner /> : <ArrowLeft className="h-5 w-5" />}
                  دریافت کد تأیید
                </Button>

                <p className="rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
                  برای دموی کاربر: {toFa("09350000000")}
                </p>
              </motion.form>
            ) : (
              <motion.form
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={verify}
                className="space-y-5"
              >
                <div>
                  <h1 className="text-2xl font-extrabold">کد تأیید</h1>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    کد {toFa(OTP_LENGTH)} رقمی ارسال‌شده به {toFa(phone)} را وارد کن.
                  </p>
                </div>

                <div className="flex justify-center gap-3" dir="ltr">
                  {otp.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => (inputs.current[i] = el)}
                      value={d}
                      onChange={(e) => onOtpChange(i, e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Backspace" &&
                        !otp[i] &&
                        i > 0 &&
                        inputs.current[i - 1]?.focus()
                      }
                      inputMode="numeric"
                      maxLength={1}
                      className="h-14 w-14 rounded-xl border border-input bg-card text-center text-2xl font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  ))}
                </div>

                {error && (
                  <p className="text-center text-sm text-destructive">{error}</p>
                )}

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? <Spinner /> : <KeyRound className="h-5 w-5" />}
                  ورود
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setStep("phone");
                    setOtp(Array(OTP_LENGTH).fill(""));
                    setError("");
                  }}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  ویرایش شماره موبایل
                </button>

                <p className="rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
                  کد تأیید به شماره موبایلت پیامک شد.
                </p>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="mt-8 space-y-2 border-t border-border pt-5 text-center text-sm">
            <Link to="/owner/login" className="block font-medium text-muted-foreground hover:text-primary">
              ورود مالک مجموعه ←
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
