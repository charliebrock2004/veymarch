import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // single player runs the realm's SQL in the browser (PGlite ships its own wasm and data files)
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  build: {
    // three.js and the procedural world are one lazily loaded chunk (~230 kB gzipped)
    chunkSizeWarningLimit: 1200,
  },
});
