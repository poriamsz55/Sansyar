import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Image as ImageIcon, Minus, PackageCheck, PackageX, Plus, ShoppingCart, Store } from "lucide-react";

import { PageTransition, EmptyState } from "@/components/PageTransition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/Toast";
import { useCart } from "@/context/CartContext";
import { getStoreProduct } from "@/api/endpoints";
import { cn, formatToman, toFa } from "@/lib/utils";

/** A variant is "implicit" when it is the unnamed default single variant. */
function isImplicitDefault(variant) {
  return variant.name === "default" && !(variant.options || []).length;
}

/**
 * Storefront product detail: image gallery, variant selection (price, stock
 * and discount follow the selected variant), specifications and description.
 * The add-to-cart action arrives with the cart phase.
 */
export default function ProductDetail() {
  const { idOrSlug } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let active = true;
    setProduct(null);
    setError(null);
    setActiveImage(0);
    setSelectedVariantId(null);
    setQty(1);
    (async () => {
      try {
        const data = await getStoreProduct(idOrSlug);
        if (active) {
          setProduct(data);
          setSelectedVariantId(data.variants?.[0]?.id || null);
        }
      } catch (err) {
        if (active) setError(err.message);
      }
    })();
    return () => {
      active = false;
    };
  }, [idOrSlug]);

  const variants = product?.variants || [];
  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === selectedVariantId) || variants[0],
    [variants, selectedVariantId]
  );
  const showVariantPicker = variants.length > 1 || (variants[0] && !isImplicitDefault(variants[0]));

  if (error) {
    return (
      <div className="container py-16">
        <EmptyState
          icon={PackageX}
          title="محصول یافت نشد"
          description={error}
          action={
            <Link to="/store">
              <Button variant="outline">
                <ChevronLeft className="h-4 w-4" /> بازگشت به فروشگاه
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container py-16">
        <div className="grid gap-8 md:grid-cols-2">
          <Skeleton className="aspect-square w-full" />
          <div className="space-y-4">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const images = (product.images || []).filter((i) => i.url);
  const current = images[activeImage] || images[0];

  // Price/stock follow the selected variant when one is selectable, else the
  // product-level summary (single implicit variant).
  const price = selectedVariant ? selectedVariant.price : product.price_from;
  const original = selectedVariant ? selectedVariant.original_price : product.original_from;
  const available = selectedVariant
    ? selectedVariant.stock - (selectedVariant.reserved || 0)
    : product.available_stock;
  const discount =
    original > price && price > 0 ? Math.round(((original - price) / original) * 100) : 0;
  const soldOut = available <= 0;
  const lowStock = !soldOut && available <= 3;
  const specs = product.attributes || [];

  return (
    <PageTransition>
      <div className="container py-8">
        {/* Breadcrumbs */}
        <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">خانه</Link>
          <ChevronLeft className="h-3 w-3" />
          <Link to="/store" className="hover:text-foreground">فروشگاه</Link>
          {product.category && (
            <>
              <ChevronLeft className="h-3 w-3" />
              <Link to={`/store?categoryId=${product.category.id}`} className="hover:text-foreground">
                {product.category.name}
              </Link>
            </>
          )}
          <ChevronLeft className="h-3 w-3" />
          <span className="text-foreground">{product.name}</span>
        </nav>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Gallery */}
          <div className="space-y-3">
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
              {current ? (
                <img src={current.url} alt={current.alt || product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-muted-foreground">
                  <ImageIcon className="h-16 w-16 opacity-20" />
                </div>
              )}
              {discount > 0 && !soldOut && (
                <Badge tone="destructive" className="absolute right-3 top-3">
                  {toFa(discount)}٪ تخفیف
                </Badge>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={img.url}
                    onClick={() => setActiveImage(i)}
                    className={cn(
                      "h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                      i === activeImage ? "border-primary" : "border-border hover:border-primary/40"
                    )}
                  >
                    <img src={img.url} alt={img.alt || ""} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              {product.brand &&
                (product.brand.logo_url ? (
                  <div className="flex items-center gap-2">
                    <img src={product.brand.logo_url} alt={product.brand.name} className="h-6 w-6 rounded object-contain" />
                    <span className="text-xs text-muted-foreground">{product.brand.name}</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{product.brand.name}</p>
                ))}
              <h1 className="text-xl font-black leading-8 md:text-2xl">{product.name}</h1>
            </div>

            {/* Variant picker */}
            {showVariantPicker && (
              <div>
                <h2 className="mb-2 text-sm font-bold">
                  انتخاب گونه
                  {selectedVariant && (selectedVariant.options || []).length === 0 && (
                    <span className="mr-2 text-xs font-normal text-muted-foreground">
                      ({selectedVariant.name})
                    </span>
                  )}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v) => {
                    const vAvailable = v.stock - (v.reserved || 0);
                    return (
                      <button
                        key={v.id}
                        onClick={() => {
                          setSelectedVariantId(v.id);
                          setQty(1);
                        }}
                        disabled={vAvailable <= 0}
                        className={cn(
                          "rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors",
                          v.id === selectedVariant?.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-foreground hover:border-primary/40",
                          vAvailable <= 0 && "cursor-not-allowed opacity-40 line-through"
                        )}
                      >
                        {variantLabel(v)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Price block */}
            <div className="rounded-xl border border-border bg-card p-4">
              {soldOut ? (
                <p className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                  <PackageX className="h-5 w-5" />
                  {showVariantPicker && selectedVariant
                    ? "این گونه فعلاً ناموجود است"
                    : "این محصول فعلاً ناموجود است"}
                </p>
              ) : (
                <>
                  {original > price && (
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground line-through">{formatToman(original)}</p>
                      <Badge tone="destructive">{toFa(discount)}٪ تخفیف</Badge>
                    </div>
                  )}
                  <p className="mt-1 text-2xl font-black text-primary">
                    {formatToman(price)}
                    <span className="text-sm font-medium"> تومان</span>
                  </p>
                  <p
                    className={cn(
                      "mt-2 flex items-center gap-1.5 text-xs",
                      lowStock ? "text-amber-600" : "text-success"
                    )}
                  >
                    <PackageCheck className="h-4 w-4" />
                    {lowStock
                      ? `تنها ${toFa(available)} عدد در انبار باقی مانده است`
                      : "موجود در انبار"}
                  </p>
                </>
              )}
              {selectedVariant?.sku && (
                <p className="mt-2 font-mono text-[10px] text-muted-foreground" dir="ltr">
                  SKU: {selectedVariant.sku}
                </p>
              )}

              {/* Quantity + add to cart */}
              {!soldOut && (
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex items-center rounded-lg border border-border">
                    <button
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="grid h-10 w-10 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40"
                      disabled={qty <= 1}
                      aria-label="کاهش تعداد"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-10 text-center text-sm font-bold">{toFa(qty)}</span>
                    <button
                      onClick={() => setQty((q) => Math.min(available, q + 1))}
                      className="grid h-10 w-10 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40"
                      disabled={qty >= available}
                      aria-label="افزایش تعداد"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <Button
                    className="flex-1"
                    size="lg"
                    disabled={adding || !selectedVariant}
                    onClick={async () => {
                      if (!selectedVariant) return;
                      setAdding(true);
                      try {
                        await addItem({ variantId: selectedVariant.id, qty });
                        toast("به سبد خرید اضافه شد");
                        navigate("/store/cart");
                      } catch (err) {
                        toast(err.message, "error");
                      } finally {
                        setAdding(false);
                      }
                    }}
                  >
                    <ShoppingCart className="h-5 w-5" />
                    {adding ? "در حال افزودن…" : "افزودن به سبد خرید"}
                  </Button>
                </div>
              )}
              <p className="mt-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
                <Store className="ml-1 inline h-3 w-3" />
                فروش و ارسال توسط فروشگاه سانسیار
              </p>
            </div>

            {product.description && (
              <div>
                <h2 className="mb-2 text-sm font-bold">توضیحات</h2>
                <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">
                  {product.description}
                </p>
              </div>
            )}

            {specs.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-bold">مشخصات</h2>
                <dl className="divide-y divide-border rounded-xl border border-border bg-card text-sm">
                  {specs.map((s) => (
                    <div key={s.key} className="flex items-center justify-between gap-4 px-4 py-2.5">
                      <dt className="text-muted-foreground">{s.key}</dt>
                      <dd className="font-medium">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function variantLabel(variant) {
  if ((variant.options || []).length > 0) {
    return variant.options.map((o) => `${o.key} ${o.value}`).join(" / ");
  }
  return variant.name;
}
