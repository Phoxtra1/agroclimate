import { toast } from "sonner";
import { refuseAppWorker } from "./updatePolicy";

const SW_URL = "/sw.js";

function isPreviewContext() {
  if (typeof window === "undefined") return true;
  return refuseAppWorker(window.location.hostname, import.meta.env.PROD,
    window.self !== window.top, new URL(window.location.href).searchParams.get("sw") === "off");
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

    // The generated worker activates automatically, but a page reload must be
    // deliberate so a new release never discards a scan or an unfinished form.
    const wasControlled = Boolean(navigator.serviceWorker.controller);
    const registration = await navigator.serviceWorker.register(SW_URL);
    let notified = false;
    const notify = () => {
      if (notified) return;
      notified = true;
      toast("AgroClimate update available", {
        id: "agroclimate-update", duration: Infinity,
        description: "Save any unfinished work before reloading.",
        action: { label: "Reload", onClick: () => window.location.reload() },
      });
    };
    if (registration.waiting && wasControlled) notify();
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && (wasControlled || navigator.serviceWorker.controller)) notify();
        if (worker.state === "activated" && !wasControlled && !notified) toast.success("AgroClimate is ready to work offline");
      });
    });
    const check = () => {
      if (navigator.onLine && document.visibilityState === "visible") void registration.update().catch(() => undefined);
    };
    window.setInterval(check, 60 * 60 * 1000);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
  } catch (error) {
    // PWA support is an enhancement; a worker failure must not interrupt React startup.
    console.error("AgroClimate PWA initialization failed:", error);
  }
}
