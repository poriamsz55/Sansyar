import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { Dialog } from "@/components/ui/dialog";

// Same custom pin as MapPicker, kept in sync visually but this view is
// read-only: no search, no drag, just a highlighted marker on the venue.
const pinIcon = L.divIcon({
  className: "",
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="hsl(var(--primary))" stroke="white" stroke-width="1.5" style="filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.35))"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="white" stroke="none"/></svg>`,
  iconSize: [40, 40],
  iconAnchor: [20, 38],
});

/** Read-only map dialog highlighting one venue's location. */
export function VenueLocationDialog({ open, onClose, complex }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  const coords = complex?.location?.coordinates;
  const lat = coords?.[1];
  const lng = coords?.[0];

  useEffect(() => {
    if (!open || !containerRef.current || lat == null || lng == null) return undefined;

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 15,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    L.marker([lat, lng], { icon: pinIcon, interactive: false }).addTo(map);
    mapRef.current = map;

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [open, lat, lng]);

  return (
    <Dialog open={open} onClose={onClose} title={complex?.name} description={complex?.address} wide>
      {lat == null || lng == null ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          موقعیت این مجموعه ثبت نشده است.
        </p>
      ) : (
        <div ref={containerRef} className="h-72 w-full overflow-hidden rounded-xl sm:h-96" />
      )}
    </Dialog>
  );
}
