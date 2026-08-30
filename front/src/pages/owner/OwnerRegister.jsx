import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, ArrowRight, Check } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { StepForm } from "@/components/StepForm";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/components/Toast";
import { cn } from "@/lib/utils";
import {
  isIranMobile,
  isIranNationalCode,
  isStrongPassword,
  normalizePhoneInput,
  passwordStrength,
} from "@/lib/validation";

const STEPS = ["نام و نام خانوادگی", "احراز هویت", "آدرس", "رمز عبور"];

const empty = {
  first_name: "",
  last_name: "",
  national_id: "",
  phone: "",
  address: "",
  password: "",
  confirm_password: "",
};

export default function OwnerRegister() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState(empty);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const strength = passwordStrength(form.password);

  function validateStep(s) {
    if (s === 0) {
      if (form.first_name.trim().length < 2) return toast("نام را وارد کنید", "error"), false;
      if (form.last_name.trim().length < 2) return toast("نام خانوادگی را وارد کنید", "error"), false;
    }
    if (s === 1) {
      if (!isIranNationalCode(form.national_id)) return toast("کد ملی معتبر نیست", "error"), false;
      if (!isIranMobile(form.phone)) return toast("شماره موبایل معتبر نیست", "error"), false;
    }
    if (s === 2 && form.address.trim().length < 5) return toast("آدرس را کامل وارد کنید", "error"), false;
    if (s === 3) {
      if (!isStrongPassword(form.password)) return toast("رمز عبور باید حداقل ۸ کاراکتر و شامل حروف و اعداد باشد", "error"), false;
      if (form.password !== form.confirm_password) return toast("تکرار رمز عبور یکسان نیست", "error"), false;
    }
    return true;
  }

  function changeStep(next) {
    if (next > step && !validateStep(step)) return;
    setStep(next);
  }

  async function submit() {
    for (let s = 0; s <= 3; s++) if (!validateStep(s)) return setStep(s);
    setSaving(true);
    try {
      await register({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        national_id: form.national_id.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        password: form.password,
        confirm_password: form.confirm_password,
      });
      toast("ثبت‌نام انجام شد؛ خوش آمدید!");
      navigate("/owner/dashboard", { replace: true });
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="owner-theme flex min-h-screen items-center justify-center bg-background p-4 sm:p-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <Logo stacked />
        </div>
        <Card className="border-border p-6 shadow-soft sm:p-8">
          <div className="mb-6 text-center">
            <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Building2 className="h-6 w-6" />
            </span>
            <h1 className="text-xl font-extrabold">ثبت‌نام</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              در چند گام ساده حساب مدیریت مجموعه‌تان را بسازید.
            </p>
          </div>

          <StepForm
            steps={STEPS}
            step={step}
            onStepChange={changeStep}
            onSubmit={submit}
            saving={saving}
            submitLabel="تکمیل ثبت‌نام"
          >
            {step === 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>نام</Label>
                  <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label>نام خانوادگی</Label>
                  <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-4">
                <div className="space-y-1.5">
                  <Label>کد ملی</Label>
                  <Input
                    value={form.national_id}
                    onChange={(e) => set("national_id", e.target.value.replace(/\D/g, "").slice(0, 10))}
                    inputMode="numeric"
                    dir="ltr"
                    placeholder="0000000000"
                    className="text-center"
                  />
                  {form.national_id.length === 10 && (
                    <p className={cn("text-xs", isIranNationalCode(form.national_id) ? "text-success" : "text-destructive")}>
                      {isIranNationalCode(form.national_id) ? "کد ملی معتبر است" : "کد ملی نامعتبر است"}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>شماره موبایل</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => set("phone", normalizePhoneInput(e.target.value))}
                    inputMode="numeric"
                    dir="ltr"
                    placeholder="09123456789"
                    className="text-center"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-1.5">
                <Label>آدرس محل سکونت</Label>
                <Textarea rows={4} value={form.address} onChange={(e) => set("address", e.target.value)} />
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-4">
                <div className="space-y-1.5">
                  <Label>رمز عبور</Label>
                  <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} dir="ltr" />
                  {form.password && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3].map((i) => (
                          <span
                            key={i}
                            className={cn(
                              "h-1.5 flex-1 rounded-full transition-colors",
                              i < strength.score
                                ? strength.score <= 1
                                  ? "bg-destructive"
                                  : strength.score === 2
                                    ? "bg-amber-500"
                                    : "bg-success"
                                : "bg-muted"
                            )}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">قدرت رمز: {strength.label}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>تکرار رمز عبور</Label>
                  <Input type="password" value={form.confirm_password} onChange={(e) => set("confirm_password", e.target.value)} dir="ltr" />
                  {form.confirm_password && (
                    <p className={cn("flex items-center gap-1 text-xs", form.password === form.confirm_password ? "text-success" : "text-destructive")}>
                      {form.password === form.confirm_password && <Check className="h-3.5 w-3.5" />}
                      {form.password === form.confirm_password ? "رمزها مطابقت دارند" : "تکرار رمز یکسان نیست"}
                    </p>
                  )}
                </div>
              </div>
            )}
          </StepForm>

          <div className="mt-5 border-t border-border pt-4 text-center text-sm">
            <span className="text-muted-foreground">قبلاً ثبت‌نام کرده‌اید؟ </span>
            <Link to="/owner/login" className="inline-flex items-center gap-1 font-bold text-primary hover:underline">
              <ArrowRight className="h-4 w-4" />
              ورود
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
