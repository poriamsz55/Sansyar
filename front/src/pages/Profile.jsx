import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Mail, CreditCard, Home, Phone, Save } from "lucide-react";

import { PageTransition } from "@/components/PageTransition";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { toast } from "@/components/Toast";
import { getMe, updateProfile } from "@/api/endpoints";
import { useAuth } from "@/context/AuthContext";
import { isIranNationalCode } from "@/lib/validation";
import { toFa } from "@/lib/utils";

export default function Profile() {
  const navigate = useNavigate();
  const { isAuthenticated, updateUser } = useAuth();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login?redirect=/profile");
      return;
    }
    getMe().then((u) => {
      setData(u);
      setForm({
        full_name: u.full_name || "",
        email: u.email || "",
        national_id: u.national_id || "",
        address: u.address || "",
      });
    });
  }, [isAuthenticated, navigate]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast("نام و نام خانوادگی را وارد کنید", "error");
      return;
    }
    if (form.national_id && !isIranNationalCode(form.national_id)) {
      toast("کد ملی معتبر نیست", "error");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateProfile({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        national_id: form.national_id.trim(),
        address: form.address.trim(),
      });
      setData(updated);
      updateUser(updated);
      toast("اطلاعات پروفایل به‌روزرسانی شد");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageTransition>
      <div className="container max-w-2xl py-10">
        <h1 className="text-2xl font-extrabold">پروفایل من</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          مشاهده و ویرایش اطلاعات حساب کاربری‌ات.
        </p>

        <Card className="mt-6">
          <CardContent className="p-6">
            {!form ? (
              <Skeleton className="h-64" />
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> شماره موبایل
                  </Label>
                  <Input value={toFa(data.phone)} disabled dir="ltr" className="font-mono" />
                  <p className="text-xs text-muted-foreground">
                    شماره موبایل شناسه ورود شماست و از این صفحه قابل تغییر نیست.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> نام و نام خانوادگی
                  </Label>
                  <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} required />
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> ایمیل
                  </Label>
                  <Input type="email" dir="ltr" value={form.email} onChange={(e) => set("email", e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" /> کد ملی
                  </Label>
                  <Input dir="ltr" value={form.national_id} onChange={(e) => set("national_id", e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Home className="h-3.5 w-3.5" /> آدرس
                  </Label>
                  <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? <Spinner /> : <Save className="h-4 w-4" />} ذخیره تغییرات
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
