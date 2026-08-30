import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Phone,
  Users,
  CheckCircle2,
  Info,
  Maximize2,
  ArrowLeft,
  ArrowRight,
  X,
} from "lucide-react";

import { PageTransition } from "@/components/PageTransition";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HallSlotPicker } from "@/components/HallSlotPicker";
import { VenueLocationDialog } from "@/components/VenueLocationDialog";
import {
  getComplex,
  listHalls,
  listSlots,
  myBookings,
} from "@/api/endpoints";
import { useSportsMap } from "@/hooks/useSportsMap";
import { useAuth } from "@/context/AuthContext";
import { savePendingReservation, isSlotInTheFuture } from "@/lib/reservation";
import { toast } from "@/components/Toast";
import { startOfWeek, addDays } from "@/lib/sessions";
import {
  cn,
  formatToman,
  toFa,
  formatJalaliWeekday,
  formatTimeRange,
} from "@/lib/utils";

/** Sessions whose start falls in the current Iranian week (Sat–Fri, local). */
function countSlotsThisWeek(slots) {
  const start = startOfWeek(new Date());
  const from = start.getTime();
  const to = addDays(start, 7).getTime();
  return slots.filter((s) => {
    const t = new Date(s.starts_at).getTime();
    return t >= from && t < to;
  }).length;
}

export default function ComplexDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const sportsMap = useSportsMap();
  const { isAuthenticated } = useAuth();

  const [complex, setComplex] = useState(null);
  const [halls, setHalls] = useState([]);
  const [slots, setSlots] = useState([]);
  const [error, setError] = useState(null);
  const [activeImg, setActiveImg] = useState(0);
  const [selected, setSelected] = useState(null); // { slot, hall }
  const [hasCompletedBooking, setHasCompletedBooking] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setError(null);
      try {
        const [c, h, s] = await Promise.all([
          getComplex(id),
          listHalls(id),
          listSlots({ complexId: id }),
        ]);
        if (!active) return;
        if (!c) {
          setError("مجموعه یافت نشد");
          return;
        }
        setComplex(c);
        setHalls(h);
        setSlots((s || []).filter(isSlotInTheFuture));
      } catch (err) {
        if (active) setError(err.message);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  // The venue's phone number is only revealed once the customer has an
  // actual completed reservation there — check their bookings separately so
  // an anonymous/logged-out visitor never triggers this authenticated call.
  useEffect(() => {
    if (!isAuthenticated) {
      setHasCompletedBooking(false);
      return;
    }
    let active = true;
    myBookings()
      .then((bookings) => {
        if (!active) return;
        setHasCompletedBooking(
          bookings.some(
            (b) => b.complex_id === id && ["confirmed", "completed"].includes(b.status)
          )
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id, isAuthenticated]);

  function proceed() {
    if (!selected) return;
    if (!isSlotInTheFuture(selected.slot)) {
      toast("این سانس شروع شده و دیگر قابل رزرو نیست.", "error");
      setSelected(null);
      return;
    }
    savePendingReservation({
      complex: { id: complex.id, name: complex.name, city: complex.city },
      hall: { id: selected.hall.id, name: selected.hall.name },
      slot: selected.slot,
    });
    navigate("/reservation");
  }

  if (error) {
    return (
      <div className="container py-8">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  if (!complex) {
    return (
      <div className="container space-y-6 py-8">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className={cn("container py-8", selected && "pb-36 md:pb-28")}>
        <Link
          to="/complexes"
          className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
          بازگشت به مجموعه‌ها
        </Link>

        {/* Gallery */}
        <div className="grid gap-3 md:grid-cols-[1.6fr_1fr]">
          <motion.div
            layout
            className="relative h-64 overflow-hidden rounded-xl md:h-[380px]"
          >
            <AnimatePresence mode="wait">
              <motion.img
                key={activeImg}
                src={complex.images[activeImg]}
                alt={complex.name}
                initial={{ opacity: 0.4, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full w-full object-cover"
              />
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-t from-navy/40 to-transparent" />
          </motion.div>

          <div className="flex max-h-64 flex-col gap-3 overflow-y-auto md:max-h-[380px]">
            {complex.images.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setActiveImg(i)}
                className={cn(
                  "relative h-24 w-full shrink-0 overflow-hidden rounded-xl border-2 transition-all md:h-[118px]",
                  activeImg === i
                    ? "border-primary opacity-100"
                    : "border-transparent opacity-80 hover:opacity-100"
                )}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Header info */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <h1 className="text-2xl font-extrabold md:text-3xl">{complex.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                className="flex items-center gap-1.5 text-right transition-colors hover:text-primary"
              >
                <MapPin className="h-4 w-4" />
                {complex.city}، {complex.address}
              </button>
              {hasCompletedBooking ? (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-4 w-4" />
                  {toFa(complex.contact_phone)}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground/80">
                  <Phone className="h-4 w-4" />
                  شماره تماس پس از تکمیل رزرو نمایش داده می‌شود.
                </span>
              )}
            </div>

            {/* Amenities */}
            <div className="mt-6">
              <h3 className="mb-3 font-bold">امکانات</h3>
              <div className="flex flex-wrap gap-2">
                {complex.amenities.map((a) => (
                  <span
                    key={a}
                    className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-sm"
                  >
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    {a}
                  </span>
                ))}
              </div>
            </div>

            {/* Rules */}
            {complex.rules?.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-3 font-bold">قوانین مجموعه</h3>
                <ul className="space-y-2">
                  {complex.rules.map((r) => (
                    <li
                      key={r}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Side summary */}
          <Card className="h-fit p-5 lg:sticky lg:top-20">
            <span className="text-sm text-muted-foreground">شروع قیمت از</span>
            <p className="mt-1 text-2xl font-extrabold text-navy">
              {formatToman(complex.lowest_price)}
              <span className="mr-1 text-sm font-normal text-muted-foreground">
                تومان
              </span>
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <Row label="تعداد سالن‌ها" value={`${toFa(halls.length)} سالن`} />
              <Row
                label="تعداد سانس‌های این هفته"
                value={`${toFa(countSlotsThisWeek(slots))} سانس`}
              />
              <Row label="وضعیت" value={<Badge tone="success">فعال</Badge>} />
            </div>
            <Button
              className="mt-5 w-full"
              onClick={() =>
                document
                  .getElementById("halls")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              انتخاب سانس
            </Button>
          </Card>
        </div>

        {/* Halls + slots */}
        <div id="halls" className="mt-12 scroll-mt-20">
          <h2 className="text-xl font-extrabold">سالن‌ها و سانس‌ها</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            سالن و سانس مورد نظرت را از مجموعه {complex.name} انتخاب کن.
          </p>

          <div className="mt-6 space-y-6">
            {halls.map((hall) => (
              <HallBlock
                key={hall.id}
                hall={hall}
                slots={slots.filter((s) => s.hall_id === hall.id)}
                selected={selected}
                sportsMap={sportsMap}
                onSelect={(slot) => setSelected({ slot, hall })}
              />
            ))}
          </div>
        </div>
      </div>

      {createPortal(
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 28, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
              className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 px-3 md:bottom-5 md:px-6"
            >
              <div className="pointer-events-auto mx-auto max-w-4xl">
                <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-navy/95 px-3 py-3 text-navy-foreground shadow-[0_18px_50px_-18px_hsl(222_47%_8%/0.65)] backdrop-blur-xl md:px-5">
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="لغو انتخاب"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{selected.hall.name}</p>
                    <p className="truncate text-xs text-white/65">
                      {formatJalaliWeekday(selected.slot.starts_at)} ·{" "}
                      {formatTimeRange(selected.slot.starts_at, selected.slot.ends_at)}
                    </p>
                  </div>
                  <Badge tone="primary" className="hidden shrink-0 sm:inline-flex">
                    {formatToman(selected.slot.final_price)} تومان
                  </Badge>
                  <Button size="sm" className="shrink-0" onClick={proceed}>
                    ادامه رزرو
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <VenueLocationDialog open={mapOpen} onClose={() => setMapOpen(false)} complex={complex} />
    </PageTransition>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function HallBlock({ hall, slots, selected, onSelect, sportsMap }) {
  return (
    <Card className="overflow-hidden">
      <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
        <div className="relative h-40 lg:h-full">
          <img
            src={hall.images?.[0]}
            alt={hall.name}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">{hall.name}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {hall.supported_sport_ids.map((sid) => (
                  <Badge key={sid} tone="primary">
                    {sportsMap[sid] || sid}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="text-left">
              <span className="text-xs text-muted-foreground">هر سانس</span>
              <p className="text-lg font-extrabold text-navy">
                {formatToman(hall.base_price)}
                <span className="mr-1 text-xs font-normal text-muted-foreground">
                  تومان
                </span>
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" /> ظرفیت {toFa(hall.capacity)} نفر
            </span>
            <span className="flex items-center gap-1.5">
              <Maximize2 className="h-4 w-4" /> {hall.dimensions} متر
            </span>
            <span>کف‌پوش: {hall.floor_type}</span>
          </div>

          {slots.length > 0 ? (
            <HallSlotPicker
              slots={slots}
              selectedId={selected?.slot?.id}
              onSelect={onSelect}
            />
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              سانس قابل رزروی برای این سالن باقی نمانده است.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
