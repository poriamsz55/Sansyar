import { Link } from "react-router-dom";
import { Image as ImageIcon, PackageX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ImagePreview } from "@/components/ImageUpload";
import { cn, formatToman, toFa } from "@/lib/utils";

/**
 * Storefront product card: primary image, discount badge, price range and
 * stock state. Links to the product detail page.
 */
export function ProductCard({ product }) {
  const image = product.primary_image || "";
  const soldOut = (product.available_stock ?? 0) <= 0;
  const discount = product.discount_max || 0;
  const hasRange = (product.variant_count ?? 1) > 1;

  return (
    <Link
      to={`/store/products/${encodeURIComponent(product.slug || product.id)}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        <ImagePreview
          src={image}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          fallback={
            <div className="grid h-full w-full place-items-center bg-muted text-muted-foreground">
              <ImageIcon className="h-10 w-10 opacity-30" />
            </div>
          }
        />
        {discount > 0 && !soldOut && (
          <Badge tone="destructive" className="absolute right-2 top-2">
            {toFa(discount)}٪ تخفیف
          </Badge>
        )}
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-bold text-muted-foreground">
              <PackageX className="h-3.5 w-3.5" />
              ناموجود
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.brand_name && (
          <p className="text-[11px] text-muted-foreground">{product.brand_name}</p>
        )}
        <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-5">
          {product.name}
        </h3>
        <div className="mt-auto flex items-end justify-between gap-2">
          <div>
            {product.original_from > 0 && (
              <p className="text-xs text-muted-foreground line-through">
                {formatToman(product.original_from)}
              </p>
            )}
            <p className={cn("text-sm font-black text-primary", soldOut && "text-muted-foreground")}>
              {formatToman(product.price_from)}
              <span className="text-[11px] font-medium"> تومان{hasRange ? " (از)" : ""}</span>
            </p>
          </div>
          {!soldOut && product.available_stock <= 3 && (
            <Badge tone="warning">{toFa(product.available_stock)} عدد باقی مانده</Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
