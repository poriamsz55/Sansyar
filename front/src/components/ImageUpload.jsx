import { useCallback, useState } from "react";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiUpload } from "@/api/client";
import { cn } from "@/lib/utils";

export function ImageUpload({ value = [], onChange, folder = "uploads", max = 5, admin = false, className }) {
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
              accept="image/jpeg,image/png,image/webp,image/gif"
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
