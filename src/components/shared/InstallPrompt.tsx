import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

export function InstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone) {
      setShow(false);
      return;
    }

    // Check if beforeinstallprompt is available
    const checkPrompt = () => {
      const canInstall = !!(window as any).__bgy_deferredPrompt;
      if (canInstall) {
        setShow(true);
      }
    };

    // Check immediately and after a short delay (in case prompt fires late)
    checkPrompt();
    const timer = setTimeout(checkPrompt, 1000);

    // Listen for beforeinstallprompt event
    const handleBeforeInstall = () => {
      setTimeout(checkPrompt, 100);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setShow(false);
      localStorage.removeItem("bgy_install_dismissed");
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    const promptEv = (window as any).__bgy_deferredPrompt;
    if (!promptEv) return;

    promptEv.prompt();
    const { outcome } = await promptEv.userChoice;

    if (outcome === "accepted") {
      setShow(false);
      localStorage.removeItem("bgy_install_dismissed");
    }

    (window as any).__bgy_deferredPrompt = null;
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem("bgy_install_dismissed", Date.now().toString());
  };

  if (!show) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-[500]" onClick={handleDismiss} />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[501] w-[calc(100%-32px)] max-w-[360px]">
        <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-5 relative" style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 text-[var(--text-light)] hover:text-[var(--text)] cursor-pointer bg-transparent border-none"
          >
            <X size={18} />
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488)" }}>
              <Download size={32} className="text-white" />
            </div>
          </div>

          {/* Content */}
          <div className="text-center mb-5">
            <h3 className="text-[1.1rem] font-extrabold text-[var(--text)] mb-2">
              Install Presensi Yuk | Guru
            </h3>
            <p className="text-[0.8rem] text-[var(--text-light)] leading-relaxed">
              Install aplikasi di HP untuk akses lebih cepat dan bisa dipakai offline
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleInstall}
              className="w-full py-3 rounded-xl text-white font-bold text-[0.9rem] cursor-pointer border-none flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488)" }}
            >
              <Download size={18} />
              Install Sekarang
            </button>
            <button
              onClick={handleDismiss}
              className="w-full py-2 rounded-xl text-[var(--text-light)] font-semibold text-[0.8rem] cursor-pointer border-none bg-transparent hover:bg-[var(--input-bg)]"
            >
              Nanti Saja
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
