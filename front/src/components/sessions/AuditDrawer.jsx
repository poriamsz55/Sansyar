import { useEffect, useState } from "react";
import { History } from "lucide-react";

import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { listSessionAudit } from "@/api/endpoints";
import { formatJalaliDate, formatTime } from "@/lib/utils";

const ACTION_LABELS = {
  "session.create": "ساخت سانس",
  "session.update": "ویرایش سانس",
  "session.generate": "ساخت سانس‌های تکرارشونده",
  "session.copy_day": "کپی روز",
  "session.duplicate_week": "تکرار هفته",
  "session.bulk_update": "ویرایش گروهی",
  "session.block_range": "مسدودسازی بازه",
};

export default function AuditDrawer({ hallId, onClose }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let active = true;
    listSessionAudit(hallId)
      .then((data) => active && setItems(data))
      .catch(() => active && setItems([]));
    return () => {
      active = false;
    };
  }, [hallId]);

  return (
    <Dialog open onClose={onClose} title="تاریخچه تغییرات برنامه" description="آخرین تغییرات اعمال‌شده روی سانس‌ها">
      {!items ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
          <History className="h-8 w-8 opacity-50" />
          هنوز تغییری ثبت نشده است.
        </div>
      ) : (
        <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
          {items.map((a) => (
            <li key={a.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <History className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{ACTION_LABELS[a.action] || a.action}</p>
                {a.details && <p className="truncate text-xs text-muted-foreground">{a.details}</p>}
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatJalaliDate(a.created_at)} - {formatTime(a.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
