import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Confirmation modal driven by a `confirm` object:
 * `{ title, message, actionLabel, onConfirm }` — render with null to hide.
 */
export function ConfirmDialog({ confirm, onClose }) {
  return (
    <Dialog open={!!confirm} onClose={onClose} title={confirm?.title}>
      <p className="text-sm text-muted-foreground">{confirm?.message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          انصراف
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            confirm?.onConfirm();
            onClose();
          }}
        >
          {confirm?.actionLabel || "تأیید"}
        </Button>
      </div>
    </Dialog>
  );
}
