// Registers the service worker that makes Sansyar installable and
// offline-capable. Only runs in production builds (incl. `vite preview`) so
// the service worker never interferes with the Vite dev server / HMR.
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  });
}
