import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },

  plugins: [
    react(),

    mode === "development" && componentTagger(),

    VitePWA({
      registerType: "autoUpdate",

      includeAssets: ["favicon.ico", "placeholder.svg"],

      manifest: {
        name: "AgroClimate - Smart Farming Weather",
        short_name: "AgroClimate",
        description:
          "Localized weather forecasts, crop advisory, and aquaculture monitoring for farmers",

        theme_color: "#2d7a4a",
        background_color: "#f7f4ef",

        display: "standalone",
        orientation: "portrait",
        start_url: "/",

        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        skipWaiting: true,
        clientsClaim: true,

        // FIX: Increase default 2MB precache limit
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,

        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,woff2}",
        ],

        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.openweathermap\.org\/.*/i,
            handler: "NetworkFirst",

            options: {
              cacheName: "weather-api",

              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 1800,
              },

              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },

          {
            urlPattern:
              /^https:\/\/.*\.supabase\.co\/functions\/.*/i,

            handler: "NetworkFirst",

            options: {
              cacheName: "edge-functions",

              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 1800,
              },

              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },

          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,

            handler: "CacheFirst",

            options: {
              cacheName: "google-fonts",

              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 31536000,
              },

              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],

        navigateFallbackDenylist: [/^\/~oauth/],
      },

      devOptions: {
        enabled: mode === "development",
      },
    }),
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  build: {
    sourcemap: false,

    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
        },
      },
    },

    chunkSizeWarningLimit: 1500,
  },
}));
