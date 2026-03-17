import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const bootstrapRedirect = () => {
  const url = new URL(window.location.href);
  const redirect = url.searchParams.get("redirect");

  if (!redirect) return;

  url.searchParams.delete("redirect");
  const cleanQuery = url.searchParams.toString();
  const normalized = redirect.startsWith("/") ? redirect : `/${redirect}`;
  const nextUrl = `${normalized}${cleanQuery ? `?${cleanQuery}` : ""}`;

  window.history.replaceState({}, "", nextUrl);
};

bootstrapRedirect();

createRoot(document.getElementById("root")!).render(<App />);

// ✅ ADD THIS PART
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").then((reg) => {
      reg.onupdatefound = () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.onstatechange = () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            // 🔥 Force reload when new version is available
            window.location.reload();
          }
        };
      };
    });
  });
}
