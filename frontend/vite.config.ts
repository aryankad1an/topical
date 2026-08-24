import path from "path"
import { fileURLToPath } from "url"
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), TanStackRouterVite(),],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        timeout: 120000,       // 2 min — AI generation can be slow
      },
      "/ws": {
        target: 'http://127.0.0.1:3000',
        ws: true,
        changeOrigin: true,
      }
    }
  }
});
