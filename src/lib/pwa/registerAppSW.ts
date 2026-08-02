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
      .filter((r) => (r.active?.scriptURL || r.waiting?.scriptURL || "").includes(SW_URL))
      .map((r) => r.unregister()),
  );
}

/**
 * Registers the Agyenkwa service worker and prompts the user whenever a new
 * version has been deployed from the main web app.
 */
export async function registerAppSW() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  if (isPreviewContext()) {
    await unregisterAppSW();
    return;
  }

  const { registerSW } = await import("virtual:pwa-register");

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      toast("A new version of Agyenkwa is available", {
        description: "Update now to get the latest features and fixes.",
        duration: Infinity,
        action: {
          label: "Update",
          onClick: () => updateSW(true),
        },
        cancel: { label: "Later", onClick: () => undefined },
      });
    },
    onOfflineReady() {
      toast.success("Agyenkwa is ready to work offline");
    },
  });
}
