import { useState } from "react";
import { Phone, Send, MessageCircle, Bug } from "lucide-react";

import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/skeleton";
import { toast } from "@/components/Toast";
import { submitTicket } from "@/api/endpoints";
import { useAuth } from "@/context/AuthContext";
import { SUPPORT_PHONE } from "@/lib/constants";
import { cn, toFa } from "@/lib/utils";

const EMPTY = { category: "contact", name: "", phone: "", subject: "", message: "" };

const CATEGORY_OPTIONS = [
  { value: "contact", label: "پیام عمومی", icon: MessageCircle },
  { value: "bug", label: "گزارش باگ", icon: Bug },
];

export function ContactModal({ open, onClose }) {
  const { user } = useAuth();
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    name: user?.full_name || "",
    phone: user?.phone || "",
  }));
  const [submitting, setSubmitting] = useState(false);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.phone.trim() || !form.subject.trim() || !form.message.trim()) {
      toast("لطفاً شماره تماس، موضوع و پیام را تکمیل کنید.", "error");
      return;
    }
    setSubmitting(true);
    try {
      await submitTicket(form);
      toast(
        form.category === "bug"
          ? "گزارش شما ثبت شد؛ تیم فنی بررسی می‌کند."
          : "پیام شما ثبت شد؛ به‌زودی با شما تماس می‌گیریم."
      );
      setForm({ ...EMPTY, name: user?.full_name || "", phone: user?.phone || "" });
      onClose();
    } catch (err) {
      toast(err?.message || "ارسال پیام با خطا مواجه شد.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="تماس با ما" description="پیام یا گزارش خود را برایمان ارسال کنید">
      <div className="mb-4 flex items-center gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm">
        <Phone className="h-4 w-4 text-primary" />
        <span dir="ltr" className="font-semibold">
          {toFa(SUPPORT_PHONE)}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        {CATEGORY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => set("category", opt.value)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              form.category === opt.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-accent"
            )}
          >
            <opt.icon className="h-4 w-4" />
            {opt.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>نام (اختیاری)</Label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="نام و نام خانوادگی" />
        </div>
        <div className="space-y-1.5">
          <Label>شماره تماس</Label>
          <Input
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="09xxxxxxxxx"
            dir="ltr"
          />
        </div>
        <div className="space-y-1.5">
          <Label>موضوع</Label>
          <Input value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="موضوع پیام" />
        </div>
        <div className="space-y-1.5">
          <Label>پیام</Label>
          <Textarea
            value={form.message}
            onChange={(e) => set("message", e.target.value)}
            placeholder="متن پیام خود را بنویسید..."
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? <Spinner /> : <Send className="h-4 w-4" />}
          {submitting ? "در حال ارسال..." : "ارسال پیام"}
        </Button>
      </form>
    </Dialog>
  );
}
