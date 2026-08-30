import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal, Search, MapPinned, XCircle } from "lucide-react";

import { PageTransition, EmptyState } from "@/components/PageTransition";
import { ComplexCard } from "@/components/ComplexCard";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PriceRangeSlider } from "@/components/ui/PriceRangeSlider";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { listComplexes, listSports } from "@/api/endpoints";
import { CITIES } from "@/lib/constants";
import { toFa } from "@/lib/utils";

const PAGE_SIZE = 12;

// Prices are stored (and filtered) in Rial; the slider shows Toman.
const RIAL_PER_TOMAN = 10;
const PRICE_MIN_TOMAN = 0;
const PRICE_MAX_TOMAN = 500000;
const PRICE_STEP_TOMAN = 10000;

function tomanFromRialParam(value, fallback) {
  if (!value) return fallback;
  const n = Number(value) / RIAL_PER_TOMAN;
  return Number.isFinite(n) ? n : fallback;
}

export default function ComplexList() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [sports, setSports] = useState([]);

  const filters = {
    q: params.get("q") || "",
    sportId: params.get("sportId") || "",
    city: params.get("city") || "",
    minPrice: params.get("minPrice") || "",
    maxPrice: params.get("maxPrice") || "",
  };

  const committedRange = [
    tomanFromRialParam(filters.minPrice, PRICE_MIN_TOMAN),
    tomanFromRialParam(filters.maxPrice, PRICE_MAX_TOMAN),
  ];
  const [priceDraft, setPriceDraft] = useState(committedRange);

  useEffect(() => {
    setPriceDraft([
      tomanFromRialParam(filters.minPrice, PRICE_MIN_TOMAN),
      tomanFromRialParam(filters.maxPrice, PRICE_MAX_TOMAN),
    ]);
  }, [filters.minPrice, filters.maxPrice]);

  // Refetch page 1 whenever a filter changes.
  useEffect(() => {
    let active = true;
    (async () => {
      setError(null);
      setItems(null);
      try {
        const [result, sp] = await Promise.all([
          listComplexes({
            city: filters.city || undefined,
            q: filters.q || undefined,
            sportId: filters.sportId || undefined,
            minPrice: filters.minPrice || undefined,
            maxPrice: filters.maxPrice || undefined,
            page: 1,
            limit: PAGE_SIZE,
          }),
          listSports(),
        ]);
        if (active) {
          setItems(result.items);
          setTotal(result.total);
          setPage(1);
          setSports(sp);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
          setItems([]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [filters.city, filters.q, filters.sportId, filters.minPrice, filters.maxPrice]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await listComplexes({
        city: filters.city || undefined,
        q: filters.q || undefined,
        sportId: filters.sportId || undefined,
        minPrice: filters.minPrice || undefined,
        maxPrice: filters.maxPrice || undefined,
        page: nextPage,
        limit: PAGE_SIZE,
      });
      setItems((prev) => [...(prev || []), ...result.items]);
      setTotal(result.total);
      setPage(nextPage);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }

  function update(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  function commitPriceRange([lo, hi]) {
    const next = new URLSearchParams(params);
    if (lo > PRICE_MIN_TOMAN) next.set("minPrice", String(Math.round(lo) * RIAL_PER_TOMAN));
    else next.delete("minPrice");
    if (hi < PRICE_MAX_TOMAN) next.set("maxPrice", String(Math.round(hi) * RIAL_PER_TOMAN));
    else next.delete("maxPrice");
    setParams(next, { replace: true });
  }

  const hasFilters =
    filters.sportId || filters.city || filters.minPrice || filters.maxPrice || filters.q;
  const hasMore = !!items && items.length < total;

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
                    placeholder="نام مجموعه، شهر یا محله..."
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
                  {sports.map((s) => (
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
                <Label>محدوده قیمت</Label>
                <PriceRangeSlider
                  min={PRICE_MIN_TOMAN}
                  max={PRICE_MAX_TOMAN}
                  step={PRICE_STEP_TOMAN}
                  value={priceDraft}
                  onChange={setPriceDraft}
                  onCommit={commitPriceRange}
                />
              </div>
            </div>
          </Card>
        </aside>

        {/* Results */}
        <section>
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {items
                ? `${toFa(total)} مجموعه یافت شد`
                : "در حال بارگذاری..."}
            </p>
          </div>

          {!items ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-80 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
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
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((c, i) => (
                  <ComplexCard key={c.id} complex={c} index={i} />
                ))}
              </div>
              {hasMore && (
                <div className="mt-6 flex justify-center">
                  <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? <Spinner /> : null} بارگذاری بیشتر
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
