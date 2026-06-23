import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, LocateFixed, Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn, toFa } from "@/lib/utils";

// Wait this long after the user stops typing before firing a search.
const SEARCH_DEBOUNCE_MS = 1000;
const MIN_QUERY_LEN = 3;

const DEFAULT_CENTER = { lat: 35.6892, lng: 51.389 }; // تهران

// Custom SVG pin so we don't depend on Leaflet's image assets.
const pinIcon = L.divIcon({
  className: "",
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="hsl(var(--primary))" stroke="white" stroke-width="1.5" style="filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.35))"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="white" stroke="none"/></svg>`,
  iconSize: [36, 36],
  iconAnchor: [18, 34],
});

/**
 * Interactive location picker: click the map or drag the pin to choose a
 * point, or search an address (OpenStreetMap Nominatim). Reports `{ lat, lng }`
 * via onChange — no manual coordinate entry anywhere.
 */
export function MapPicker({ value, onChange, province, className }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Cancels the in-flight geocode request so a slow earlier response can't
  // overwrite a newer one (race condition).
  const abortRef = useRef(null);
  // Set right after picking a suggestion so the resulting query change does not
  // immediately trigger another search for the address we just filled in.
  const justPickedRef = useRef(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null); // null = no search yet
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  function place(lat, lng, { pan = false, zoom } = {}) {
    markerRef.current?.setLatLng([lat, lng]);
    if (pan && mapRef.current) {
      mapRef.current.setView([lat, lng], zoom ?? Math.max(mapRef.current.getZoom(), 15));
    }
    onChangeRef.current?.({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
  }

  useEffect(() => {
    const start = value?.lat && value?.lng ? value : DEFAULT_CENTER;
    const map = L.map(containerRef.current, {
      center: [start.lat, start.lng],
      zoom: 14,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    const marker = L.marker([start.lat, start.lng], { draggable: true, icon: pinIcon }).addTo(map);
    marker.on("dragend", () => {
      const p = marker.getLatLng();
      place(p.lat, p.lng);
    });
    map.on("click", (e) => place(e.latlng.lat, e.latlng.lng));

    mapRef.current = map;
    markerRef.current = marker;

    // The dialog animates in, so the container has no size on mount.
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Geocode the address, biasing results to the selected province so search is
  // scoped to where the venue actually is. Cancels any previous request first.
  async function runSearch(raw) {
    const q = raw.trim();
    abortRef.current?.abort();
    if (q.length < MIN_QUERY_LEN) {
      setResults(null);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    try {
      const scoped = province ? `${q}، ${province}` : q;
      const params = new URLSearchParams({
        format: "json",
        q: scoped,
        limit: "6",
        addressdetails: "1",
        "accept-language": "fa",
        countrycodes: "ir",
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        signal: controller.signal,
      });
      const data = await res.json();
      // Ignore a stale response that lost the race to a newer request.
      if (controller.signal.aborted) return;
      setResults(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err?.name !== "AbortError") setResults([]);
    } finally {
      if (abortRef.current === controller) setSearching(false);
    }
  }

  // Debounced auto-search: fire ~1s after the user stops typing — no button.
  useEffect(() => {
    if (justPickedRef.current) {
      justPickedRef.current = false;
      return undefined;
    }
    const q = query.trim();
    if (q.length < MIN_QUERY_LEN) {
      abortRef.current?.abort();
      setResults(null);
      setSearching(false);
      return undefined;
    }
    const timer = setTimeout(() => runSearch(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, province]);

  function pickResult(r) {
    abortRef.current?.abort();
    justPickedRef.current = true; // don't auto-search the address we just filled in
    setResults(null);
    setQuery(r.display_name);
    place(parseFloat(r.lat), parseFloat(r.lon), { pan: true, zoom: 16 });
  }

  function locateMe() {
    if (!navigator.geolocation || locating) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        place(pos.coords.latitude, pos.coords.longitude, { pan: true, zoom: 16 });
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch(query);
              }
            }}
            placeholder={province ? `جستجوی آدرس در ${province}…` : "ابتدا استان را انتخاب کنید…"}
            className="pr-10 pl-9"
          />
          {searching && (
            <Loader2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        {results !== null && (
          <div className="absolute inset-x-0 top-full z-[1100] mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-soft-lg">
            {results.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">
                {searching ? "در حال جستجو…" : "نتیجه‌ای یافت نشد"}
              </p>
            ) : (
              results.map((r) => (
                <button
                  key={r.place_id}
                  type="button"
                  onClick={() => pickResult(r)}
                  className="block w-full truncate px-3 py-2.5 text-right text-sm transition-colors hover:bg-accent"
                >
                  {r.display_name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border">
        <div ref={containerRef} className="h-64 w-full sm:h-72" />
        <button
          type="button"
          onClick={locateMe}
          title="موقعیت من"
          className="absolute bottom-3 right-3 z-[1000] grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-foreground shadow-soft transition-colors hover:text-primary"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        روی نقشه بزنید یا پین را جابه‌جا کنید؛ مختصات به‌صورت خودکار ذخیره می‌شود.
        {value?.lat && value?.lng && (
          <span className="mr-1 text-muted-foreground/70">
            ({toFa(value.lat)}، {toFa(value.lng)})
          </span>
        )}
      </p>
    </div>
  );
}
