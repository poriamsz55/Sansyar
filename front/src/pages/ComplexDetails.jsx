import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";

import { PageTransition } from "@/components/PageTransition";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RatingStars } from "@/components/RatingStars";
import { SlotChip } from "@/components/SlotChip";
import { getComplex, listHalls, listSlots } from "@/api/endpoints";
import { useSportsMap } from "@/hooks/useSportsMap";
import { savePendingReservation } from "@/lib/reservation";
import {
  cn,
  formatToman,
  toFa,
  formatJalaliWeekday,
  formatJalaliDate,
} from "@/lib/utils";

function groupByDay(slots) {
  const map = new Map();
  for (const s of slots) {
    const key = s.starts_at.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  }
  return Array.from(map.entries()).map(([day, items]) => ({
    day,
    items: items.sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
  }));
}

export default function ComplexDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const sportsMap = useSportsMap();

  const [complex, setComplex] = useState(null);
  const [halls, setHalls] = useState([]);
  const [slots, setSlots] = useState([]);
  const [error, setError] = useState(null);
  const [activeImg, setActiveImg] = useState(0);
  const [selected, setSelected] = useState(null); // { slot, hall }

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
        setSlots(s);
      } catch (err) {
        if (active) setError(err.message);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  function proceed() {
    if (!selected) return;
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
      <div className="container py-8">
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

          <div className="grid grid-cols-3 gap-3 md:grid-cols-2">
            {complex.images.map((src, i) => (
              <button
                key={src}
                onClick={() => setActiveImg(i)}
                className={cn(
                  "relative h-24 overflow-hidden rounded-xl border-2 transition-all md:h-[121px]",
                  activeImg === i ? "border-primary" : "border-transparent opacity-80"
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
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-extrabold md:text-3xl">{complex.name}</h1>
              <RatingStars value={complex.rating_avg} count={complex.rating_count} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {complex.city}، {complex.address}
              </span>
              <span className="flex items-center gap-1.5">
                <Phone className="h-4 w-4" />
                {toFa(complex.contact_phone)}
              </span>
            </div>

            <p className="mt-5 leading-8 text-foreground/80">{complex.description}</p>

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
                label="سانس‌های آزاد"
                value={`${toFa(
                  slots.filter((s) => s.status === "available").length
                )} سانس`}
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
            سالن مورد نظرت را انتخاب کن و روی یک سانس آزاد بزن.
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

      {/* Sticky selection bar */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ y: 80 }}
            animate={{ y: 0 }}
            exit={{ y: 80 }}
            className="sticky bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-lg"
          >
            <div className="container flex flex-wrap items-center justify-between gap-3 py-3.5">
              <div className="flex items-center gap-3 text-sm">
                <span className="font-bold">{selected.hall.name}</span>
                <span className="text-muted-foreground">
                  {formatJalaliWeekday(selected.slot.starts_at)} ساعت{" "}
                  {toFa(selected.slot.starts_at.slice(11, 16))}
                </span>
                <Badge tone="primary">
                  {formatToman(selected.slot.final_price)} تومان
                </Badge>
              </div>
              <Button onClick={proceed}>
                ادامه رزرو
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
  const days = useMemo(() => groupByDay(slots), [slots]);
  const [activeDay, setActiveDay] = useState(0);
  const current = days[activeDay];

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-4 md:grid-cols-[200px_1fr]">
        <div className="relative h-40 md:h-full">
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

          {/* Day selector */}
          {days.length > 0 ? (
            <>
              <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
                {days.map((d, i) => (
                  <button
                    key={d.day}
                    onClick={() => setActiveDay(i)}
                    className={cn(
                      "shrink-0 rounded-lg border px-3 py-2 text-center transition-colors",
                      activeDay === i
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-accent"
                    )}
                  >
                    <span className="block text-xs font-bold">
                      {formatJalaliWeekday(d.day)}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {formatJalaliDate(d.day)}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {current.items.map((slot) => (
                  <SlotChip
                    key={slot.id}
                    slot={slot}
                    selected={selected?.slot?.id === slot.id}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              سانسی برای این سالن ثبت نشده است.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
