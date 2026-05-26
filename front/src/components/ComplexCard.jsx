import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, CalendarClock, ArrowLeft, Tag } from "lucide-react";

import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { buttonVariants } from "./ui/button";
import { RatingStars } from "./RatingStars";
import { cn, formatToman, toFa } from "@/lib/utils";

export function ComplexCard({ complex, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
    >
      <Card className="group flex h-full flex-col overflow-hidden transition-all hover:-translate-y-1 hover:shadow-soft-lg">
        <div className="relative h-44 overflow-hidden">
          <img
            src={complex.images?.[0]}
            alt={complex.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy/50 to-transparent" />
          {complex.discount_percent > 0 && (
            <Badge tone="success" className="absolute right-3 top-3 shadow-soft">
              <Tag className="h-3 w-3" />
              {toFa(complex.discount_percent)}٪ تخفیف
            </Badge>
          )}
          <div className="absolute bottom-3 right-3 flex flex-wrap gap-1.5">
            {complex.sports?.slice(0, 2).map((s) => (
              <span
                key={s}
                className="glass rounded-full px-2.5 py-1 text-xs font-medium text-white"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-bold leading-6">{complex.name}</h3>
            <RatingStars value={complex.rating_avg} />
          </div>

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>
              {complex.city}
              {complex.neighborhood ? `، ${complex.neighborhood}` : ""}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4 shrink-0 text-success" />
            <span>{toFa(complex.available_slot_count)} سانس آزاد</span>
          </div>

          <div className="mt-auto flex items-end justify-between gap-2 border-t border-border pt-4">
            <div>
              <span className="text-xs text-muted-foreground">شروع از</span>
              <p className="text-base font-extrabold text-navy">
                {formatToman(complex.lowest_price)}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  تومان
                </span>
              </p>
            </div>
            <Link
              to={`/complexes/${complex.id}`}
              className={cn(
                buttonVariants({ variant: "navy", size: "sm" }),
                "shrink-0"
              )}
            >
              مشاهده
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
