/// <reference types="vitest/config" />
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { gamesPlugin } from "./vite/games-plugin.ts";

const repoRoot = resolve(import.meta.dirname, "../..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "VITE_");
  const content =
    (process.env.VITE_CONTENT ?? env.VITE_CONTENT ?? "fixtures") === "games" ? "games" : "fixtures";

  return {
    plugins: [
      react(),
      tailwindcss(),
      gamesPlugin(repoRoot, content),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: false,
        includeAssets: ["icon.svg"],
        // Send cookies with the manifest request, so installing works behind Cloudflare Access.
        useCredentials: true,
        manifest: {
          name: "Board Games Companion",
          short_name: "BG Companion",
          description: "Learn and play board games — rules, setup and walkthroughs at the table.",
          lang: "en",
          display: "standalone",
          orientation: "any",
          background_color: "#0f1512",
          theme_color: "#0f1512",
          icons: [
            { src: "icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
            { src: "icon.svg", sizes: "any", type: "image/svg+xml" },
          ],
        },
        workbox: {
          // Take control on first visit so runtime caching works before any reload.
          clientsClaim: true,
          skipWaiting: true,
          globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
          globIgnores: ["games/**"],
          navigateFallback: "index.html",
          navigateFallbackDenylist: [/^\/games\//],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => /\/games\/[^/]+\/images\//.test(url.pathname),
              handler: "CacheFirst",
              options: { cacheName: "bgc-game-images", expiration: { maxEntries: 500 } },
            },
            {
              urlPattern: ({ url }) => /\/games\/.+\.json$/.test(url.pathname),
              handler: "StaleWhileRevalidate",
              options: { cacheName: "bgc-game-data" },
            },
          ],
        },
      }),
    ],
    define: {
      __CONTENT_SOURCE__: JSON.stringify(content),
    },
    server: { port: 5173, host: true },
    // host: reachable from phones on the same Wi-Fi; allowedHosts: HTTPS test tunnels
    // (`cloudflared tunnel --url http://localhost:4173`) so the PWA can be installed.
    preview: { port: 4173, host: true, allowedHosts: [".trycloudflare.com"] },
    test: {
      environment: "happy-dom",
      setupFiles: ["./test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
    },
  };
});
