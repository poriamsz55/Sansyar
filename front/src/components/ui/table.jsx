import { cn } from "@/lib/utils";

export function Table({ className, ...props }) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function THead({ className, ...props }) {
  return <thead className={cn("[&_tr]:border-b", className)} {...props} />;
}

export function TBody({ className, ...props }) {
  return (
    <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  );
}

export function TR({ className, ...props }) {
  return (
    <tr
      className={cn(
        "border-b border-border transition-colors hover:bg-muted/50",
        className
      )}
      {...props}
    />
  );
}

export function TH({ className, ...props }) {
  return (
    <th
      className={cn(
        "h-12 px-4 text-right align-middle text-xs font-semibold text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

export function TD({ className, ...props }) {
  return (
    <td className={cn("px-4 py-3.5 align-middle", className)} {...props} />
  );
}
