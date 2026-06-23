import { useMemo, useRef, useState } from "react";
import { X, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/**
 * Chip-based tag input for dynamic, free-form lists (custom sports, amenities…).
 *
 * - Add with Enter or the add button.
 * - Remove a tag instantly with its × button.
 * - Duplicates are rejected (case-insensitive after normalization).
 * - Values are trimmed; `normalize` (default trim only) can also lower/upper-case.
 * - `suggestions` render as one-tap chips for the common options.
 *
 * `value` is a string[]; `onChange` receives the next string[].
 */
export default function TagInput({
  value = [],
  onChange,
  suggestions = [],
  placeholder = "افزودن…",
  normalize = (s) => s.trim(),
  disabled = false,
  addLabel = "افزودن",
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  const has = (item) =>
    value.some((v) => normalize(v).toLowerCase() === normalize(item).toLowerCase());

  function add(raw) {
    const item = normalize(raw);
    if (!item || has(item)) {
      setDraft("");
      return;
    }
    onChange?.([...value, item]);
    setDraft("");
    inputRef.current?.focus();
  }

  function remove(item) {
    onChange?.(value.filter((v) => v !== item));
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      remove(value[value.length - 1]);
    }
  }

  // Suggestions not already chosen.
  const openSuggestions = useMemo(
    () => suggestions.filter((s) => !has(s)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suggestions, value]
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
        />
        <button
          type="button"
          disabled={disabled || !normalize(draft)}
          onClick={() => add(draft)}
          className="inline-flex h-11 shrink-0 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {addLabel}
        </button>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-sm text-primary"
            >
              {item}
              {!disabled && (
                <button type="button" onClick={() => remove(item)} aria-label="حذف" className="hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {openSuggestions.length > 0 && !disabled && (
        <div className="flex flex-wrap gap-1.5">
          {openSuggestions.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => add(s)}
              className={cn(
                "rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              )}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
