import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerAppSW } from "./lib/pwa/registerAppSW";


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

