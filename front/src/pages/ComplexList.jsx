import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal, Search, MapPinned, XCircle } from "lucide-react";

import { PageTransition, EmptyState } from "@/components/PageTransition";
import { ComplexCard } from "@/components/ComplexCard";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listComplexes } from "@/api/endpoints";
import { SPORTS, CITIES } from "@/lib/constants";
import { toFa } from "@/lib/utils";

const PRICE_STEPS = [
  { value: "", label: "همه قیمت‌ها" },
  { value: "2000000", label: "تا ۲۰۰٬۰۰۰ تومان" },
  { value: "2500000", label: "تا ۲۵۰٬۰۰۰ تومان" },
  { value: "3000000", label: "تا ۳۰۰٬۰۰۰ تومان" },
];

export default function ComplexList() {
  const [params, setParams] = useSearchParams();
  const [all, setAll] = useState(null);

  const filters = {
    q: params.get("q") || "",
    sportId: params.get("sportId") || "",
    city: params.get("city") || "",
    maxPrice: params.get("maxPrice") || "",
  };

  useEffect(() => {
    listComplexes().then(setAll);
  }, []);

  const results = useMemo(() => {
    if (!all) return null;
    return all.filter((c) => {
      if (filters.sportId && !c.sport_ids?.includes(filters.sportId)) return false;
      if (filters.city && c.city !== filters.city) return false;
      if (filters.maxPrice && c.lowest_price > Number(filters.maxPrice)) return false;
      if (
        filters.q &&
        !(
          c.name.includes(filters.q) ||
          c.city.includes(filters.q) ||
          c.neighborhood?.includes(filters.q)
        )
      )
        return false;
      return true;
    });
  }, [all, filters.sportId, filters.city, filters.maxPrice, filters.q]);

  function update(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const hasFilters = filters.sportId || filters.city || filters.maxPrice || filters.q;

  return (
    <PageTransition>
      <div className="border-b border-border bg-card">
        <div className="container py-8">
          <h1 className="text-2xl font-extrabold">مجموعه‌های ورزشی</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            بین مجموعه‌ها فیلتر بزن و بهترین گزینه را پیدا کن.
          </p>
        </div>
      </div>

      <div className="container grid gap-6 py-8 lg:grid-cols-[280px_1fr]">
        {/* Filters */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                فیلترها
              </h2>
              {hasFilters && (
                <button
                  onClick={() => setParams({}, { replace: true })}
                  className="flex items-center gap-1 text-xs text-destructive hover:underline"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  پاک کردن
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>جستجو</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={filters.q}
                    onChange={(e) => update("q", e.target.value)}
                    placeholder="نام مجموعه..."
                    className="pr-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>نوع ورزش</Label>
                <Select
                  value={filters.sportId}
                  onChange={(e) => update("sportId", e.target.value)}
                >
                  <option value="">همه ورزش‌ها</option>
                  {SPORTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>شهر</Label>
                <Select
                  value={filters.city}
                  onChange={(e) => update("city", e.target.value)}
                >
                  <option value="">همه شهرها</option>
                  {CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>حداکثر قیمت</Label>
                <Select
                  value={filters.maxPrice}
                  onChange={(e) => update("maxPrice", e.target.value)}
                >
                  {PRICE_STEPS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </Card>
        </aside>

        {/* Results */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {results
                ? `${toFa(results.length)} مجموعه یافت شد`
                : "در حال بارگذاری..."}
            </p>
          </div>

          {!results ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-80 w-full" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              icon={MapPinned}
              title="مجموعه‌ای پیدا نشد"
              description="فیلترها را تغییر بده یا عبارت دیگری جستجو کن."
              action={
                <Button variant="outline" onClick={() => setParams({}, { replace: true })}>
                  پاک کردن فیلترها
                </Button>
              }
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((c, i) => (
                <ComplexCard key={c.id} complex={c} index={i} />
              ))}
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
