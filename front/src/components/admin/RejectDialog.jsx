import { useState } from "react";
import { XCircle } from "lucide-react";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/skeleton";

/**
 * Confirmation dialog that collects an optional rejection reason/note before
 * rejecting a request. `onConfirm(reason)` is awaited.
 */
export default function RejectDialog({ open, onClose, onConfirm, title = "رد درخواست", subject }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function confirm() {
    setSaving(true);
    try {
      await onConfirm(reason.trim());
      setReason("");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={title} description={subject}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>دلیل رد (اختیاری)</Label>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="دلیل رد درخواست را برای مالک بنویسید…"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">این یادداشت برای پیگیری ثبت می‌شود.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button type="button" variant="destructive" onClick={confirm} disabled={saving}>
            {saving ? <Spinner /> : <XCircle className="h-4 w-4" />}
            رد درخواست
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
