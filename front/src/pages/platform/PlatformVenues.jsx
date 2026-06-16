import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  MapPin,
  Warehouse,
  Star,
  Check,
  X,
  Globe,
  GlobeLock,
  PowerOff,
  RotateCcw,
  Eye,
  Trash2,
  CalendarClock,
  Ticket,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { ImagePreview } from "@/components/ImageUpload";
import { EmptyState } from "@/components/PageTransition";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";
import RequestDetail from "@/components/admin/RequestDetail";
import RejectDialog from "@/components/admin/RejectDialog";
import {
  adminListVenues,
  approveComplex,
  rejectComplex,
  publishComplex,
  unpublishComplex,
  adminDeleteComplex,
  approveHall,
  rejectHall,
  publishHall,
  unpublishHall,
  adminDeleteHall,
} from "@/api/endpoints";
import { complexDisplayStatus, complexModerated } from "@/lib/constants";
import { toFa, formatToman } from "@/lib/utils";

const STATUS_FILTERS = [
  { value: "", label: "همه وضعیت‌ها" },
  { value: "pending_approval", label: "در انتظار تأیید" },
  { value: "approved", label: "تأییدشده" },
  { value: "published", label: "منتشرشده" },
  { value: "rejected", label: "ردشده" },
  { value: "suspended", label: "غیرفعال" },
];

export default function PlatformVenues() {
  const [venues, setVenues] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [reject, setReject] = useState(null);
  const [confirm, setConfirm] = useState(null);

  async function load() {
    setError(null);
    try {
      setVenues(await adminListVenues());
    } catch (err) {
      setError(err.message);
      setVenues([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    if (!venues) return null;
    return venues.filter((v) => {
      if (status && v.status !== status) return false;
      if (q) {
        const hay = `${v.name} ${v.city || ""} ${v.owner_name || ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [venues, q, status]);

  async function run(fn, msg) {
    try {
      await fn();
      toast(msg);
      setDetailId(null);
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function doReject(reason) {
    if (reject.type === "complex") await run(() => rejectComplex(reject.id, reason), "مجموعه رد شد");
    else await run(() => rejectHall(reject.id, reason), "سالن رد شد");
  }

  function askDeleteHall(h) {
    setConfirm({
      title: "غیرفعال‌سازی سالن",
      message: `سالن «${h.name}» از سایت برداشته می‌شود. ادامه می‌دهید؟`,
      actionLabel: "غیرفعال کن",
      onConfirm: () => run(() => adminDeleteHall(h.id), "سالن غیرفعال شد"),
    });
  }

  function askDeleteComplex(c) {
    const moderated = complexModerated(c);
    setConfirm({
      title: moderated ? "غیرفعال‌سازی مجموعه" : "حذف مجموعه",
      message: moderated
        ? `«${c.name}» فقط غیرفعال و از سایت برداشته می‌شود.`
        : `«${c.name}» به‌همراه سالن‌ها و سانس‌هایش برای همیشه حذف می‌شود.`,
      actionLabel: moderated ? "غیرفعال کن" : "حذف کامل",
      onConfirm: () => run(() => adminDeleteComplex(c.id), moderated ? "مجموعه غیرفعال شد" : "مجموعه حذف شد"),
    });
  }

  if (!venues) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12" />
        {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {toFa(venues.length)} مجموعه · {toFa(venues.reduce((s, v) => s + v.hall_count, 0))} سالن
        </p>
        <div className="flex flex-wrap gap-2">
          <div className="w-44">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </Select>
          </div>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی نام، شهر یا مالک…" className="w-56" />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {visible.length === 0 ? (
        <EmptyState icon={Building2} title="مجموعه‌ای یافت نشد" />
      ) : (
        visible.map((v) => (
          <Card key={v.id} className="overflow-hidden">
            <div className="relative h-32 sm:h-40">
              <ImagePreview src={v.images?.[0]} alt={v.name} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute right-3 top-3"><StatusBadge kind="complex" status={complexDisplayStatus(v)} /></div>
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-2 p-4 text-white">
                <div>
                  <h2 className="text-lg font-extrabold">{v.name}</h2>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/85">
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{v.province ? `${v.province}، ` : ""}{v.city || "—"}</span>
                    <span>مالک: {v.owner_name || "—"}</span>
                    <span dir="ltr">{toFa(v.owner_phone || "")}</span>
                  </p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {toFa((v.rating_avg || 0).toFixed(1))}
                </span>
              </div>
            </div>

            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Warehouse className="h-3.5 w-3.5" />{toFa(v.hall_count)} سالن</span>
                <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{toFa(v.slot_count)} سانس</span>
                <span className="flex items-center gap-1"><Ticket className="h-3.5 w-3.5" />{toFa(v.booking_count)} رزرو</span>
              </div>

              {/* Venue actions */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="outline" onClick={() => setDetailId(v.id)}>
                  <Eye className="h-3.5 w-3.5" /> جزئیات
                </Button>
                {(v.status === "pending_approval" || v.pending_changes) && (
                  <>
                    <Button size="sm" variant="success" onClick={() => run(() => approveComplex(v.id), "تأیید شد")}>
                      <Check className="h-3.5 w-3.5" /> تأیید
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => setReject({ type: "complex", id: v.id, name: v.name })}>
                      <X className="h-3.5 w-3.5" /> رد
                    </Button>
                  </>
                )}
                {v.status === "approved" && !v.pending_changes && (
                  <Button size="sm" variant="outline" onClick={() => run(() => publishComplex(v.id), "منتشر شد")}>
                    <Globe className="h-3.5 w-3.5" /> انتشار
                  </Button>
                )}
                {v.status === "published" && !v.pending_changes && (
                  <Button size="sm" variant="outline" onClick={() => run(() => unpublishComplex(v.id), "انتشار لغو شد")}>
                    <GlobeLock className="h-3.5 w-3.5" /> لغو انتشار
                  </Button>
                )}
                {v.status === "suspended" ? (
                  <Button size="sm" variant="outline" onClick={() => run(() => approveComplex(v.id), "فعال شد")}>
                    <RotateCcw className="h-3.5 w-3.5 text-success" /> فعال‌سازی
                  </Button>
                ) : complexModerated(v) ? (
                  <Button size="sm" variant="ghost" onClick={() => askDeleteComplex(v)} title="غیرفعال‌سازی">
                    <PowerOff className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => askDeleteComplex(v)} title="حذف">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>

              {/* Nested halls */}
              <div className="rounded-xl border border-border">
                <div className="flex items-center gap-1.5 border-b border-border px-3 py-2 text-sm font-bold">
                  <Warehouse className="h-4 w-4 text-primary" /> سالن‌های این مجموعه
                </div>
                {v.halls?.length ? (
                  <div className="divide-y divide-border">
                    {v.halls.map((h) => (
                      <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{h.name}</span>
                          {h.supported_sport_ids?.slice(0, 2).map((sid) => (
                            <Badge key={sid} tone="muted">{sid}</Badge>
                          ))}
                          <span className="text-xs text-muted-foreground">{formatToman(h.base_price)} ت</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <StatusBadge kind="hall" status={h.status || "approved"} />
                          {h.status === "pending_approval" && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => run(() => approveHall(h.id), "سالن تأیید شد")} title="تأیید"><Check className="h-3.5 w-3.5 text-success" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => setReject({ type: "hall", id: h.id, name: h.name })} title="رد"><X className="h-3.5 w-3.5 text-destructive" /></Button>
                            </>
                          )}
                          {h.status === "approved" && (
                            <Button size="sm" variant="ghost" onClick={() => run(() => publishHall(h.id), "سالن منتشر شد")} title="انتشار"><Globe className="h-3.5 w-3.5 text-primary" /></Button>
                          )}
                          {h.status === "published" && (
                            <Button size="sm" variant="ghost" onClick={() => run(() => unpublishHall(h.id), "انتشار لغو شد")} title="لغو انتشار"><GlobeLock className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                          )}
                          {h.is_active !== false && (
                            <Button size="sm" variant="ghost" onClick={() => askDeleteHall(h)} title="غیرفعال‌سازی"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="px-3 py-3 text-xs text-muted-foreground">سالنی ثبت نشده است.</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {detailId && (
        <RequestDetail
          venueId={detailId}
          onClose={() => setDetailId(null)}
          onApprove={(v) => run(() => approveComplex(v.id), "تأیید شد")}
          onReject={(v) => setReject({ type: "complex", id: v.id, name: v.name })}
        />
      )}
      <RejectDialog open={!!reject} onClose={() => setReject(null)} onConfirm={doReject} subject={reject?.name} />
      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
