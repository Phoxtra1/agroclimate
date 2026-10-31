import { toast } from "sonner";

const SW_URL = "/sw.js";

function isPreviewContext() {
  if (typeof window === "undefined") return true;
  const { hostname, href } = window.location;
  return (
    !import.meta.env.PROD ||
    window.self !== window.top ||
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev") ||
    new URL(href).searchParams.get("sw") === "off"
  );
}

async function unregisterAppSW() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((registration) =>
        (registration.active?.scriptURL || registration.waiting?.scriptURL || "").includes(SW_URL)
      )
      .map((registration) => registration.unregister()),
  );
}

/** Register the application worker without making it a prerequisite for React startup. */
export async function registerAppSW() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  try {
    if (isPreviewContext()) {
      await unregisterAppSW();
      return;
    }

    const { registerSW } = await import("virtual:pwa-register");
    registerSW({
      immediate: true,
      onOfflineReady() {
        toast.success("AgroClimate is ready to work offline");
      },
      onRegisterError(error) {
        console.error("AgroClimate service worker registration failed:", error);
      },
    });
  } catch (error) {
    // PWA support is an enhancement; a worker failure must not interrupt React startup.
    console.error("AgroClimate PWA initialization failed:", error);
  }
}
