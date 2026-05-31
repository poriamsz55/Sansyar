import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Multi-step form wizard with horizontal step indicator. */
export function StepForm({
  steps,
  step,
  onStepChange,
  onSubmit,
  saving,
  submitLabel = "ثبت",
  children,
}) {
  const isLast = step === steps.length - 1;

  function next() {
    if (isLast) onSubmit?.();
    else onStepChange(step + 1);
  }

  function back() {
    if (step > 0) onStepChange(step - 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => i < step && onStepChange(i)}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                    ? "bg-primary/15 text-primary cursor-pointer"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {i + 1}
            </button>
            <span
              className={cn(
                "hidden text-xs font-medium sm:block",
                i === step ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "mx-1 hidden h-px flex-1 sm:block",
                  i < step ? "bg-primary/40" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>

      <div>{children}</div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={back} disabled={step === 0}>
          <ChevronRight className="h-4 w-4" />
          قبلی
        </Button>
        <Button type="button" onClick={next} disabled={saving}>
          {saving ? (
            "در حال ذخیره..."
          ) : isLast ? (
            submitLabel
          ) : (
            <>
              بعدی
              <ChevronLeft className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
