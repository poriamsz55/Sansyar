import { useEffect, useState } from "react";
import {
  Check,
  XCircle,
  MapPin,
  Phone,
  User,
  CreditCard,
  Home,
  Clock,
  Hourglass,
  Warehouse,
  Eye,
} from "lucide-react";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { ImagePreview } from "@/components/ImageUpload";
import HallDetail from "@/components/admin/HallDetail";
import { adminGetVenue } from "@/api/endpoints";
import { complexDisplayStatus } from "@/lib/constants";
import { toFa, formatToman, formatJalaliDate, formatTime } from "@/lib/utils";

const DIFF_FIELDS = [
  ["name", "نام"],
  ["province", "استان"],
  ["city", "شهر"],
  ["neighborhood", "محله"],
  ["address", "آدرس"],
  ["contact_phone", "تلفن"],
  ["description", "توضیحات"],
];

/**
 * Full request/venue detail for the approval flow: owner identity, venue info,
 * images, amenities/rules, timestamps, pending-changes diff, and nested halls.
 * `onApprove(venue)` / `onReject(venue)` are emitted to the parent.
 */
export default function RequestDetail({ venueId, onClose, onApprove, onReject, onApproveHall, onRejectHall }) {
  const [venue, setVenue] = useState(null);
  const [hallDetail, setHallDetail] = useState(null);

  useEffect(() => {
    let active = true;
    adminGetVenue(venueId)
      .then((v) => active && setVenue(v))
      .catch(() => active && setVenue(false));
    return () => {
      active = false;
    };
  }, [venueId]);

  const changes = venue?.pending_changes;
  const actionable = venue && (venue.status === "pending_approval" || !!changes);

  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title="جزئیات درخواست"
      description={venue ? venue.name : undefined}
    >
      {!venue ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Status + rejection note */}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="complex" status={complexDisplayStatus(venue)} />
            {changes && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                <Hourglass className="h-3.5 w-3.5" />
                بازبینی تغییرات
              </span>
            )}
          </div>
          {venue.rejection_reason && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              دلیل رد قبلی: {venue.rejection_reason}
            </div>
          )}

          {/* Owner */}
          <Section title="اطلاعات مالک">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field icon={User} label="نام" value={venue.owner_name} />
              <Field icon={Phone} label="تلفن" value={toFa(venue.owner_phone)} ltr />
              <Field icon={CreditCard} label="کد ملی" value={venue.owner_national_id ? toFa(venue.owner_national_id) : "—"} ltr />
              <Field icon={Home} label="آدرس مالک" value={venue.owner_address || "—"} />
            </div>
          </Section>

          {/* Images */}
          {venue.images?.length > 0 && (
            <Section title="تصاویر">
              <div className="flex flex-wrap gap-2">
                {venue.images.map((src, i) => (
                  <ImagePreview key={i} src={src} alt="" className="h-24 w-32 rounded-lg object-cover" />
                ))}
              </div>
            </Section>
          )}

          {/* Venue info */}
          <Section title="اطلاعات مجموعه">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field icon={MapPin} label="استان / شهر" value={`${venue.province || "—"} / ${venue.city || "—"}`} />
              <Field icon={MapPin} label="محله" value={venue.neighborhood || "—"} />
              <Field icon={Home} label="آدرس" value={venue.address || "—"} />
              <Field icon={Phone} label="تلفن تماس" value={venue.contact_phone ? toFa(venue.contact_phone) : "—"} ltr />
              <Field icon={Clock} label="تاریخ ثبت" value={`${formatJalaliDate(venue.created_at)} ${formatTime(venue.created_at)}`} />
              <Field icon={Clock} label="آخرین به‌روزرسانی" value={`${formatJalaliDate(venue.updated_at)} ${formatTime(venue.updated_at)}`} />
            </div>
            {venue.description && <p className="mt-2 text-sm text-muted-foreground">{venue.description}</p>}
            {venue.amenities?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {venue.amenities.map((a) => (
                  <Badge key={a} tone="muted">{a}</Badge>
                ))}
              </div>
            )}
          </Section>

          {/* Pending changes diff */}
          {changes && (
            <Section title="تغییرات پیشنهادی">
              <div className="space-y-1.5">
                {DIFF_FIELDS.filter(([k]) => changes[k] && changes[k] !== venue[k]).map(([k, label]) => (
                  <div key={k} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-20 shrink-0 text-muted-foreground">{label}:</span>
                    <span className="text-destructive line-through">{venue[k] || "—"}</span>
                    <span>←</span>
                    <span className="font-medium text-success">{changes[k]}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Halls */}
          <Section title={`سالن‌ها (${toFa(venue.halls?.length || 0)})`}>
            {venue.halls?.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {venue.halls.map((h) => (
                  <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2.5">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <ImagePreview src={h.images?.[0]} alt="" className="h-9 w-12 shrink-0 rounded object-cover" />
                      <Warehouse className="h-4 w-4 shrink-0 text-primary" />
                      {h.name}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">{formatToman(h.base_price)} ت</span>
                      <StatusBadge kind="hall" status={h.status || "approved"} />
                      <Button size="sm" variant="ghost" onClick={() => setHallDetail(h)} title="جزئیات سالن">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {h.status === "pending_approval" && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => onApproveHall?.(h)} title="تأیید سالن">
                            <Check className="h-3.5 w-3.5 text-success" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => onRejectHall?.(h)} title="رد سالن">
                            <XCircle className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">سالنی ثبت نشده است.</p>
            )}
          </Section>

          {/* Actions */}
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={onClose}>
              بستن
            </Button>
            {actionable && (
              <>
                <Button variant="destructive" onClick={() => onReject(venue)}>
                  <XCircle className="h-4 w-4" />
                  رد {changes ? "تغییرات" : "درخواست"}
                </Button>
                <Button variant="success" onClick={() => onApprove(venue)}>
                  <Check className="h-4 w-4" />
                  تأیید {changes ? "تغییرات" : ""}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      {hallDetail && <HallDetail hall={hallDetail} complexName={venue?.name} onClose={() => setHallDetail(null)} />}
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

function Field({ icon: Icon, label, value, ltr }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium" dir={ltr ? "ltr" : undefined}>
        {value}
      </div>
    </div>
  );
}
