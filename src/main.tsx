import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerAppSW } from "./lib/pwa/registerAppSW";
import { ErrorBoundary } from "./components/ErrorBoundary";


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

const root = document.getElementById("root");
if (root) createRoot(root).render(<ErrorBoundary fallbackTitle="AgroClimate could not start"><App /></ErrorBoundary>);

void registerAppSW();


