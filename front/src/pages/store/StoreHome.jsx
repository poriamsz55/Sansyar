import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Store, PackageSearch, ChevronLeft, SlidersHorizontal, X } from "lucide-react";

import { PageTransition, EmptyState } from "@/components/PageTransition";
import { ProductCard } from "@/components/store/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { PriceRangeSlider } from "@/components/ui/PriceRangeSlider";
import { listStoreProducts, listStoreCategories, listStoreBrands } from "@/api/endpoints";
import { cn, toFa } from "@/lib/utils";

const PAGE_SIZE = 12;
const RIAL_PER_TOMAN = 10;
const PRICE_MIN_TOMAN = 0;
const PRICE_MAX_TOMAN = 2000000;
const PRICE_STEP_TOMAN = 10000;

const SORTS = [
  { value: "newest", label: "جدیدترین" },
  { value: "price_asc", label: "ارزان‌ترین" },
  { value: "price_desc", label: "گران‌ترین" },
  { value: "discount", label: "بیشترین تخفیف" },
  { value: "name", label: "الفبایی" },
];

const AVAILABILITIES = [
  { value: "", label: "همه" },
  { value: "in_stock", label: "موجود" },
  { value: "out_of_stock", label: "ناموجود" },
];

function tomanFromRialParam(value, fallback) {
  if (!value) return fallback;
  const n = Number(value) / RIAL_PER_TOMAN;
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Store home: search, category/brand chips, price range, availability and
 * sorting — all synced to the URL so filtered views are shareable.
 */
export default function StoreHome() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filters = {
    q: params.get("q") || "",
    categoryId: params.get("categoryId") || "",
    brandId: params.get("brandId") || "",
    availability: params.get("availability") || "",
    sort: params.get("sort") || "newest",
    minPrice: params.get("minPrice") || "",
    maxPrice: params.get("maxPrice") || "",
  };

  const hasPriceFilter = !!filters.minPrice || !!filters.maxPrice;
  const [priceDraft, setPriceDraft] = useState(() => [
    tomanFromRialParam(filters.minPrice, PRICE_MIN_TOMAN),
    tomanFromRialParam(filters.maxPrice, PRICE_MAX_TOMAN),
  ]);

  useEffect(() => {
    setPriceDraft([
      tomanFromRialParam(filters.minPrice, PRICE_MIN_TOMAN),
      tomanFromRialParam(filters.maxPrice, PRICE_MAX_TOMAN),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.minPrice, filters.maxPrice]);

  // Refetch page 1 whenever a filter changes.
  useEffect(() => {
    let active = true;
    (async () => {
      setError(null);
      setItems(null);
      try {
        const [result, cats, brs] = await Promise.all([
          listStoreProducts({
            q: filters.q || undefined,
            category_id: filters.categoryId || undefined,
            brand_id: filters.brandId || undefined,
            availability: filters.availability || undefined,
            sort: filters.sort !== "newest" ? filters.sort : undefined,
            min_price: filters.minPrice || undefined,
            max_price: filters.maxPrice || undefined,
            page: 1,
            limit: PAGE_SIZE,
          }),
          categories.length ? Promise.resolve(categories) : listStoreCategories(),
          brands.length ? Promise.resolve(brands) : listStoreBrands(),
        ]);
        if (active) {
          setItems(result.items);
          setTotal(result.total);
          setPage(1);
          setCategories(cats);
          setBrands(brs);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, filters.categoryId, filters.brandId, filters.availability, filters.sort, filters.minPrice, filters.maxPrice, reloadKey]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = page + 1;
      const result = await listStoreProducts({
        q: filters.q || undefined,
        category_id: filters.categoryId || undefined,
        brand_id: filters.brandId || undefined,
        availability: filters.availability || undefined,
        sort: filters.sort !== "newest" ? filters.sort : undefined,
        min_price: filters.minPrice || undefined,
        max_price: filters.maxPrice || undefined,
        page: next,
        limit: PAGE_SIZE,
      });
      setItems((prev) => [...(prev || []), ...result.items]);
      setPage(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }

  function setFilter(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  function commitPrice([loToman, hiToman]) {
    const next = new URLSearchParams(params);
    if (loToman > PRICE_MIN_TOMAN) next.set("minPrice", String(loToman * RIAL_PER_TOMAN));
    else next.delete("minPrice");
    if (hiToman < PRICE_MAX_TOMAN) next.set("maxPrice", String(hiToman * RIAL_PER_TOMAN));
    else next.delete("maxPrice");
    setParams(next, { replace: true });
  }

  const activeCategory = categories.find((c) => c.id === filters.categoryId);
  const activeBrand = brands.find((b) => b.id === filters.brandId);
  const hasActiveFilters =
    !!filters.q || !!activeCategory || !!activeBrand || !!filters.availability || hasPriceFilter;

  return (
    <PageTransition>
      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-primary/10 to-transparent">
        <div className="container flex flex-col items-center gap-4 py-10 text-center md:py-14">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
            <Store className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-2xl font-black md:text-3xl">فروشگاه ورزشی سانسیار</h1>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              تجهیزات و پوشاک ورزشی اصل، با ارسال سریع به سراسر کشور
            </p>
          </div>
          <form
            className="relative w-full max-w-xl"
            onSubmit={(e) => {
              e.preventDefault();
              const value = new FormData(e.currentTarget).get("q");
              setFilter("q", value);
            }}
          >
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={filters.q}
              placeholder="جستجوی محصول… مثلاً توپ فوتبال"
              className="h-12 pr-9"
            />
          </form>
        </div>
      </section>

      <div className="container py-8">
        {/* Category chips */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilter("categoryId", "")}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              !filters.categoryId
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            همه دسته‌ها
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilter("categoryId", c.id)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                filters.categoryId === c.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Brand chips */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilter("brandId", "")}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] transition-colors",
              !filters.brandId ? "font-bold text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            همه برندها
          </button>
          {brands.map((b) => (
            <button
              key={b.id}
              onClick={() => setFilter("brandId", b.id)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] transition-colors",
                filters.brandId === b.id ? "font-bold text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {b.name}
            </button>
          ))}
        </div>

        {/* Filter & sort bar */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setFiltersOpen((v) => !v)}>
            <SlidersHorizontal className="h-4 w-4" />
            فیلترها
            {hasActiveFilters && (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
                !
              </span>
            )}
          </Button>
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            {AVAILABILITIES.map((a) => (
              <button
                key={a.value}
                onClick={() => setFilter("availability", a.value)}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
                  filters.availability === a.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div className="mr-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">مرتب‌سازی:</span>
            <Select
              value={filters.sort}
              onChange={(e) => setFilter("sort", e.target.value === "newest" ? "" : e.target.value)}
              className="h-9 w-40 text-xs"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </div>
        </div>

        {/* Collapsible price filter */}
        {filtersOpen && (
          <div className="mt-4 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">محدوده قیمت</p>
              {hasActiveFilters && (
                <button
                  onClick={() => setParams({}, { replace: true })}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" /> حذف همه فیلترها
                </button>
              )}
            </div>
            <div className="mt-4 max-w-md">
              <PriceRangeSlider
                min={PRICE_MIN_TOMAN}
                max={PRICE_MAX_TOMAN}
                step={PRICE_STEP_TOMAN}
                value={priceDraft}
                onChange={setPriceDraft}
                onCommit={commitPrice}
              />
            </div>
          </div>
        )}

        {/* Active filter summary */}
        {hasActiveFilters && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>نمایش نتایج برای:</span>
            {filters.q && <FilterChip label={`جستجو: ${filters.q}`} onClear={() => setFilter("q", "")} />}
            {activeCategory && <FilterChip label={activeCategory.name} onClear={() => setFilter("categoryId", "")} />}
            {activeBrand && <FilterChip label={activeBrand.name} onClear={() => setFilter("brandId", "")} />}
            {filters.availability && (
              <FilterChip
                label={AVAILABILITIES.find((a) => a.value === filters.availability)?.label}
                onClear={() => setFilter("availability", "")}
              />
            )}
            {hasPriceFilter && (
              <FilterChip
                label={`${toFa(Math.round(priceDraft[0]).toLocaleString("en-US"))} تا ${toFa(Math.round(priceDraft[1]).toLocaleString("en-US"))} تومان`}
                onClear={() => {
                  const next = new URLSearchParams(params);
                  next.delete("minPrice");
                  next.delete("maxPrice");
                  setParams(next, { replace: true });
                }}
              />
            )}
          </div>
        )}

        {/* Grid */}
        <div className="mt-6">
          {error ? (
            <EmptyState
              icon={PackageSearch}
              title="خطا در دریافت محصولات"
              description={error}
              action={<Button onClick={() => setReloadKey((k) => k + 1)}>تلاش مجدد</Button>}
            />
          ) : !items ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-72 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="محصولی یافت نشد"
              description="با فیلترهای دیگری جستجو کنید یا همه دسته‌ها را ببینید."
              action={
                <Button variant="outline" onClick={() => setParams({})}>
                  حذف فیلترها
                </Button>
              }
            />
          ) : (
            <>
              <p className="mb-4 text-xs text-muted-foreground">{toFa(total)} محصول</p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              {items.length < total && (
                <div className="mt-8 flex justify-center">
                  <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? <Spinner /> : <ChevronLeft className="h-4 w-4" />}
                    نمایش بیشتر
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

function FilterChip({ label, onClear }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
      {label}
      <button onClick={onClear} className="text-foreground/60 hover:text-destructive" aria-label={`حذف ${label}`}>
        ×
      </button>
    </span>
  );
}
