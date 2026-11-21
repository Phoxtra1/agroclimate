import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  // Unit tests import modules that construct the Supabase client at module
  // load time. Supply non-production placeholders so local/CI tests do not
  // depend on a committed .env file or production credentials.
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://unit-test.supabase.co"),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify("unit-test-publishable-key"),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
