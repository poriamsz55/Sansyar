import { Badge } from "./ui/badge";
import { BOOKING_STATUS, COMPLEX_STATUS, SLOT_STATUS } from "@/lib/constants";

const MAPS = {
  booking: BOOKING_STATUS,
  complex: COMPLEX_STATUS,
  slot: SLOT_STATUS,
};

/** Renders a colored Persian badge for a backend status enum. */
export function StatusBadge({ kind = "booking", status, className }) {
  const entry = MAPS[kind]?.[status];
  if (!entry) return <Badge className={className}>{status}</Badge>;
  return (
    <Badge tone={entry.tone} className={className}>
      {entry.label}
    </Badge>
  );
}
