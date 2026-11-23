import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// A tab opened before a new deployment asks for code files that are no longer served (each
// deployment has its own), so Play would wait on "Reaching the realm…" forever. Reload once to
// pick up the current build; a second failure within a minute is shown as an error instead.
window.addEventListener("vite:preloadError", (e) => {
  try {
    const last = Number(sessionStorage.getItem("veyrmarch.reloaded") ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem("veyrmarch.reloaded", String(Date.now()));
  } catch {
    return;
  }
  e.preventDefault();
  location.reload();
});

// Keep the game's files on the device so it opens offline. Built versions only: the dev server changes too often.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline play is a nicety; the game runs without it */
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
