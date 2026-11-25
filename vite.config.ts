import { defineConfig, loadEnv } from "vite";

// Public (publishable) backend values used when an external host builds without
// a .env, so the app never starts with an empty backend address.
const PUBLIC_BACKEND = {
  VITE_SUPABASE_URL: "https://apoqexuhlysoirtcvgfo.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwb3FleHVobHlzb2lydGN2Z2ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NjI5NTgsImV4cCI6MjA4NzIzODk1OH0.IeChoUJk5nSsg1taOB2HMONcZfpRvy1Y1pf-rmgz6aM",
  VITE_SUPABASE_PROJECT_ID: "apoqexuhlysoirtcvgfo",
};
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), "VITE_") };
  const define = Object.fromEntries(
    Object.entries(PUBLIC_BACKEND)
      .filter(([k]) => !env[k])
      .map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)]),
  );
  return {
  define,
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
      // Keep installed PWAs aligned with the deployed application shell.
      registerType: "autoUpdate",
      injectRegister: null,

      includeAssets: ["favicon.png", "placeholder.svg"],


      manifest: {
        name: "Agroclimate",
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
        // Activate updated workers promptly and remove obsolete precache entries.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,


        // FIX: Increase default 2MB precache limit
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,

        // Keep lazy route chunks out of install-time precache. They are cached
        // on first use, so initial install/download stays small.
        globPatterns: [
          "**/*.{css,ico,png,svg,woff2}",
        ],

        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => request.mode === "navigate" && !url.pathname.startsWith("/~oauth"),
            handler: "NetworkFirst",
            options: { cacheName: "agroclimate-pages", networkTimeoutSeconds: 4 },
          },
          {
            // Lazy-loaded application chunks are cached after first visit,
            // rather than downloaded eagerly during PWA installation.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/assets\/.*-[\w-]+\.js$/i.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "agroclimate-app-chunks-v2",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Reuse map imagery between visits; tile URLs are immutable for a
            // given scene/layer/zoom and expire after a week.
            urlPattern: /^https:\/\/titiler\.xyz\/stac\/.*\/(?:tiles|tile)\//i,
            handler: "CacheFirst",
            options: {
              cacheName: "satellite-imagery-tiles",
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/gibs\.earthdata\.nasa\.gov\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "nasa-gibs-imagery",
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
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
            // Edge Functions may return user-specific or authenticated data.
            // Always go to the network; do not persist these responses in Cache Storage.
            urlPattern: /^https:\/\/.*\.supabase\.co\/functions\/.*/i,
            handler: "NetworkOnly",
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
          // Shared Satellite offline support: map tiles
          {
            urlPattern:
              /^https:\/\/(?:[a-c]\.)?tile\.openstreetmap\.org\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "satellite-osm-tiles",
              expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          {
            urlPattern:
              /^https:\/\/(?:[a-c]\.)?tile\.opentopomap\.org\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "satellite-topo-tiles",
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          {
            urlPattern:
              /^https:\/\/services\.arcgisonline\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "satellite-esri-tiles",
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // Shared Satellite offline support: routing + geocoding responses
          {
            urlPattern: /^https:\/\/router\.project-osrm\.org\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "satellite-routing",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          {
            urlPattern: /^https:\/\/nominatim\.openstreetmap\.org\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "satellite-geocoding",
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
          maps: ["leaflet", "react-leaflet"],
          charts: ["recharts"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },

    chunkSizeWarningLimit: 1500,
  },
};
});
