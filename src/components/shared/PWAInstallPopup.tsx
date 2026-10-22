import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("bgy_install_dismissed");
    if (dismissed) return;

    if ((window as any).__bgy_showInstallPopup && (window as any).__bgy_deferredPrompt) {
      setVisible(true);
    }

    const handler = () => {
      if (!localStorage.getItem("bgy_install_dismissed") && (window as any).__bgy_deferredPrompt) {
        setVisible(true);
      }
    };

    window.addEventListener("bgy_install_popup", handler);
    return () => window.removeEventListener("bgy_install_popup", handler);
  }, []);

  if (!visible) return null;

  const handleInstall = async () => {
    const promptEv = (window as any).__bgy_deferredPrompt as BeforeInstallPromptEvent | undefined;
    if (promptEv) {
      promptEv.prompt();
      const choice = await promptEv.userChoice;
      if (choice.outcome === "accepted") {
        (window as any).__bgy_deferredPrompt = null;
        (window as any).__bgy_showInstallPopup = false;
      }
    }
    setVisible(false);
    localStorage.setItem("bgy_install_dismissed", "1");
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem("bgy_install_dismissed", "1");
  };

  return (
    <div
      className="fixed top-[48px] left-1/2 -translate-x-1/2 w-[calc(100%-28px)] max-w-[400px] z-[600] animate-slide-down"
    >
      <div
        className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl px-[14px] py-[12px] flex items-center gap-3"
        style={{ boxShadow: "0 4px 24px rgba(0,0,0,.15)" }}
      >
        <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-[1.2rem]"
          style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488,#0f766e)" }}>
          <Download size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[0.78rem] font-bold text-[var(--text)]">Install aplikasi ini</div>
          <div className="text-[0.7rem] text-[var(--text-light)]">Akses cepat tanpa buka browser</div>
        </div>
        <button
          onClick={handleInstall}
          className="px-3 py-[7px] rounded-lg text-white font-bold text-[0.72rem] cursor-pointer border-none flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488,#0f766e)" }}
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="h-7 w-7 rounded-full border-[1.5px] border-[var(--border)] bg-transparent text-[var(--text-light)] flex items-center justify-center cursor-pointer flex-shrink-0"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
