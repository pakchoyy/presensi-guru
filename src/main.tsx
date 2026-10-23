// PWA Install — simpan deferred prompt; InstallPrompt menampilkan tawarannya.
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  (window as any).__bgy_deferredPrompt = e;
  window.dispatchEvent(new Event("bgy_install_ready"));
});

window.addEventListener("appinstalled", () => {
  (window as any).__bgy_deferredPrompt = null;
});

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Remove loading screen
setTimeout(() => {
  const ls = document.getElementById("loadingScreen");
  if (ls) {
    ls.style.opacity = "0";
    ls.style.transition = "opacity 0.4s";
    setTimeout(() => ls.remove(), 400);
  }
}, 600);
