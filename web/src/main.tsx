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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
