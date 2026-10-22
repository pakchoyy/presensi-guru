// PWA Install — simpan deferred prompt untuk dropdown "Install BGY"
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  (window as any).__bgy_deferredPrompt = e;
  // Show install popup after 5 seconds
  setTimeout(() => {
    if ((window as any).__bgy_deferredPrompt && !localStorage.getItem("bgy_install_dismissed")) {
      (window as any).__bgy_showInstallPopup = true;
      window.dispatchEvent(new Event("bgy_install_popup"));
    }
  }, 5000);
});

window.addEventListener("appinstalled", () => {
  (window as any).__bgy_deferredPrompt = null;
  (window as any).__bgy_showInstallPopup = false;
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
