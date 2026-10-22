import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// ── PWA: offline cache + silent auto-update ──────────────────────────────────
// Works on any HTTPS static host (incl. GitHub Pages project subpaths),
// because every reference here is relative.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js", { scope: "./", updateViaCache: "none" })
      .then((reg) => {
        // re-check for a fresh version whenever the game comes back to focus
        const check = () => reg.update().catch(() => {});
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) check();
        });
        window.setInterval(check, 30 * 60 * 1000);
      })
      .catch(() => {});

    // Announce the update; App lets the pilot reload from the menu.
    const wasControlled = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (wasControlled) window.dispatchEvent(new Event('nova-update-ready'));
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
