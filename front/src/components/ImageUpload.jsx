import { useCallback, useState } from "react";
import { Upload, X, Loader2, ImageIcon, RefreshCw, Star } from "lucide-react";

import { apiUpload } from "@/api/client";
import { cn } from "@/lib/utils";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

// The backend stores a single `images` array; by convention the first entry is
// the main banner and the rest are the gallery.
export const splitImages = (images) => ({
  banner: images?.[0] || "",
  gallery: (images || []).slice(1),
});
export const joinImages = (banner, gallery) => [banner, ...(gallery || [])].filter(Boolean);

/**
 * Single "main banner" image uploader. The banner is the primary visual the
 * design system shows at the top of venue pages, so it is uploaded separately
 * from the gallery.
 */
export function BannerUpload({ value, onChange, folder = "uploads", admin = false, className }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  async function handleFile(file) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const { url } = await apiUpload(file, { folder, admin });
      onChange?.(url);
    } catch (err) {
      setError(err.message || "خطا در آپلود");
    } finally {
      setUploading(false);
    }
  }

  const fileInput = (
    <input
      type="file"
      accept={ACCEPT}
      className="hidden"
      disabled={uploading}
      onChange={(e) => {
        handleFile(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  return (
    <div className={cn("space-y-2", className)}>
      {value ? (
        <div className="group relative aspect-[21/9] w-full overflow-hidden rounded-xl border border-border">
          <img src={value} alt="" className="h-full w-full object-cover" />
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-medium text-white">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            تصویر بنر
          </span>
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-white">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              تعویض
              {fileInput}
            </label>
            <button
              type="button"
              onClick={() => onChange?.("")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-white"
            >
              <X className="h-3.5 w-3.5" />
              حذف
            </button>
          </div>
        </div>
      ) : (
        <label className="flex aspect-[21/9] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:border-primary hover:text-primary">
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <Upload className="h-6 w-6" />
              <span className="text-sm font-medium">آپلود تصویر بنر</span>
              <span className="text-[11px]">تصویر اصلی که در صدر صفحه نمایش داده می‌شود</span>
            </>
          )}
          {fileInput}
        </label>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ImageUpload({
  value = [],
  onChange,
  folder = "uploads",
  max = 5,
  admin = false,
  disabled = false,
  disabledHint,
  className,
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const images = Array.isArray(value) ? value : [];

  const uploadFiles = useCallback(
    async (files) => {
      if (!files?.length) return;
      setError(null);
      setUploading(true);
      try {
        const next = [...images];
        for (const file of files) {
          if (next.length >= max) break;
          const { url } = await apiUpload(file, { folder, admin });
          next.push(url);
        }
        onChange?.(next);
      } catch (err) {
        setError(err.message || "خطا در آپلود");
      } finally {
        setUploading(false);
      }
    },
    [folder, images, max, onChange, admin]
  );

  function removeAt(index) {
    onChange?.(images.filter((_, i) => i !== index));
  }

  if (disabled) {
    return (
      <div className={cn("rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center", className)}>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ImageIcon className="h-3.5 w-3.5" />
          {disabledHint || "ابتدا تصویر بنر را آپلود کنید"}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap gap-3">
        {images.map((url, i) => (
          <div key={`${url}-${i}`} className="group relative h-24 w-24 overflow-hidden rounded-lg border border-border">
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute left-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {images.length < max && (
          <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Upload className="h-5 w-5" />
                <span className="text-[10px]">آپلود</span>
              </>
            )}
            <input
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                uploadFiles(Array.from(e.target.files || []));
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      {images.length === 0 && !uploading && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ImageIcon className="h-3.5 w-3.5" />
          حداکثر {max} تصویر (JPG, PNG, WebP)
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ImagePreview({ src, alt, className, fallback }) {
  if (!src) {
    return (
      fallback || (
        <div className={cn("grid place-items-center bg-muted text-muted-foreground", className)}>
          <ImageIcon className="h-8 w-8 opacity-40" />
        </div>
      )
    );
  }
  return <img src={src} alt={alt || ""} className={className} />;
}
