import {
  Users,
  Maximize2,
  Warehouse,
  Banknote,
  Dumbbell,
  VenetianMask,
  Power,
} from "lucide-react";

import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { ImagePreview } from "@/components/ImageUpload";
import { formatToman } from "@/lib/utils";

const GENDER_LABEL = { all: "همه", male: "آقایان", female: "بانوان" };

/**
 * Read-only hall detail modal: images, capacity/floor, supported sports,
 * gender rule, pricing, and operational status. Reuses whatever hall object
 * the caller already has in memory (nested under a venue/complex) — no extra
 * fetch required.
 */
export default function HallDetail({ hall: h, complexName, onClose }) {
  return (
    <Dialog open onClose={onClose} wide title="جزئیات سالن" description={complexName ? `${h.name} — ${complexName}` : h.name}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge kind="hall" status={h.status || "approved"} />
          <Badge tone={h.is_active === false ? "destructive" : "success"}>
            <Power className="ml-1 inline h-3 w-3" />
            {h.is_active === false ? "غیرفعال" : "فعال"}
          </Badge>
        </div>

        {h.rejection_reason && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            دلیل رد: {h.rejection_reason}
          </div>
        )}

        {h.images?.length > 0 && (
          <Section title="تصاویر">
            <div className="flex flex-wrap gap-2">
              {h.images.map((src, i) => (
                <ImagePreview key={i} src={src} alt="" className="h-24 w-32 rounded-lg object-cover" />
              ))}
            </div>
          </Section>
        )}

        <Section title="مشخصات سالن">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field icon={Users} label="ظرفیت" value={h.capacity ? String(h.capacity) : "—"} />
            <Field icon={Maximize2} label="ابعاد" value={h.dimensions || "—"} />
            <Field icon={Warehouse} label="نوع فضا" value={h.indoor_outdoor === "outdoor" ? "روباز" : "سرپوشیده"} />
            <Field icon={Warehouse} label="جنس کف" value={h.floor_type || "—"} />
            <Field icon={VenetianMask} label="قانون جنسیت" value={GENDER_LABEL[h.gender_rule] || "همه"} />
            <Field icon={Banknote} label="قیمت پایه" value={`${formatToman(h.base_price)} تومان / سانس`} />
          </div>
        </Section>

        {h.supported_sport_ids?.length > 0 && (
          <Section title="ورزش‌های قابل رزرو">
            <div className="flex flex-wrap gap-1.5">
              {h.supported_sport_ids.map((sid) => (
                <Badge key={sid} tone="primary">
                  <Dumbbell className="ml-1 inline h-3 w-3" />
                  {sid}
                </Badge>
              ))}
            </div>
          </Section>
        )}

        {h.amenities?.length > 0 && (
          <Section title="امکانات">
            <div className="flex flex-wrap gap-1.5">
              {h.amenities.map((a) => (
                <Badge key={a} tone="muted">{a}</Badge>
              ))}
            </div>
          </Section>
        )}
      </div>
    </Dialog>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold">{title}</h3>
      {children}
    </div>
  );
}

function Field({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}
