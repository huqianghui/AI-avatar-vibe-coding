import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import istanbul from "vite-plugin-istanbul";
import path from "path";

// Note: vitest's `test` config (including coverage.thresholds) lives in the
// sibling `vitest.config.ts` file, not here — this project splits build config
// (vite.config.ts) from unit-test config (vitest.config.ts). See 29-10-SUMMARY.md.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(process.env.INSTRUMENT_COVERAGE === "true"
      ? [
          istanbul({
            include: "src/**/*",
            exclude: ["node_modules", "e2e", "dist"],
            extension: [".ts", ".tsx"],
            requireEnv: false,
            forceBuildInstrument: false,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET ?? "http://localhost:8000",
        changeOrigin: true,
        ws: true,
      },
      // Anonymous public-avatar routes (frontend/src/api/public-avatar.ts)
      // are mounted bare (no /api/v1 prefix) on the backend -- see that
      // file's module docstring. Without this entry, dev-server requests to
      // /public/avatar/* 404 instead of reaching the backend.
      "/public": {
        target: process.env.VITE_PROXY_TARGET ?? "http://localhost:8000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
