import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Runs on 5173 to match the backend CORS_ORIGINS allowlist.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Optional dev proxy so the SPA can call the Go API without CORS friction.
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
