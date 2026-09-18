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
      // Prompt the user whenever a new version is deployed from the web app
      registerType: "prompt",
      injectRegister: null,

      includeAssets: ["favicon.png", "placeholder.svg"],


      manifest: {
        name: "AgroClimate",
        short_name: "AGC",
        description:
          "Agriculture & climate intelligence for African producers",

        theme_color: "#1f7a3a",
        background_color: "#f5f0e6",

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
        // Prompt flow: the new SW waits until the user accepts the update
        skipWaiting: false,
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
          // AGNav offline support: map tiles
          {
            urlPattern:
              /^https:\/\/(?:[a-c]\.)?tile\.openstreetmap\.org\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "agnav-osm-tiles",
              expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          {
            urlPattern:
              /^https:\/\/(?:[a-c]\.)?tile\.opentopomap\.org\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "agnav-topo-tiles",
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          {
            urlPattern:
              /^https:\/\/services\.arcgisonline\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "agnav-satellite-tiles",
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // AGNav offline support: routing + geocoding responses
          {
            urlPattern: /^https:\/\/router\.project-osrm\.org\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "agnav-routing",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          {
            urlPattern: /^https:\/\/nominatim\.openstreetmap\.org\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "agnav-geocoding",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],

        navigateFallbackDenylist: [/^\/~oauth/],
      },

      devOptions: {
        enabled: false,
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
