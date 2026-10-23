import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";

// Tawarkan install setiap kali dibuka di browser (bukan dari aplikasi terpasang).
// "Nanti" hanya berlaku untuk sesi ini (sessionStorage), kunjungan berikutnya muncul lagi.
const DISMISS_KEY = "bgy_install_later";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

function isIosSafari() {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

function dismissedThisSession() {
  try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
}

export function InstallPrompt() {
  const [mode, setMode] = useState<"android" | "ios" | null>(null);

  useEffect(() => {
    if (isStandalone() || dismissedThisSession()) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const tryShow = () => {
      if (isStandalone() || dismissedThisSession()) return;
      if ((window as any).__bgy_deferredPrompt) setMode("android");
      else if (isIosSafari()) setMode("ios");
    };
    timer = setTimeout(tryShow, 2500);

    const onReady = () => { clearTimeout(timer); timer = setTimeout(tryShow, 800); };
    const onInstalled = () => setMode(null);
    window.addEventListener("bgy_install_ready", onReady);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("bgy_install_ready", onReady);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const later = () => {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setMode(null);
  };

  const install = async () => {
    const promptEv = (window as any).__bgy_deferredPrompt;
    if (!promptEv) return later();
    promptEv.prompt();
    const { outcome } = await promptEv.userChoice;
    (window as any).__bgy_deferredPrompt = null;
    if (outcome === "accepted") setMode(null);
    else later();
  };

  if (!mode) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[500]" onClick={later} />
      <div
        role="dialog"
        aria-label="Install Presensi Yuk | Guru"
        className="fixed left-0 right-0 bottom-0 z-[501] mx-auto w-full max-w-[440px] bg-[var(--card-bg)] rounded-t-3xl border border-[var(--border)] px-5 pt-5"
        style={{ boxShadow: "0 -8px 32px rgba(0,0,0,0.18)", paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={later}
          aria-label="Tutup"
          className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center text-[var(--text-light)] cursor-pointer bg-transparent border-none"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-4 pr-10">
          <img src="/icons/pg-192-v1.png" alt="" className="w-14 h-14 rounded-2xl flex-shrink-0" />
          <div className="min-w-0">
            <h3 className="text-[1.02rem] font-extrabold text-[var(--text)] leading-tight">
              Pasang <i>Presensi Yuk</i> | Guru
            </h3>
            <p className="text-[0.78rem] text-[var(--text-light)] leading-snug mt-1">
              Buka langsung dari layar utama, lebih cepat, dan pengingat absen bisa jalan.
            </p>
          </div>
        </div>

        {mode === "android" ? (
          <button
            onClick={install}
            className="w-full min-h-[48px] rounded-xl text-white font-bold text-[0.92rem] cursor-pointer border-none flex items-center justify-center gap-2"
            style={{ background: "var(--grad)" }}
          >
            <Download size={18} /> Install Sekarang
          </button>
        ) : (
          <ol className="text-[0.82rem] text-[var(--text)] leading-relaxed bg-[var(--input-bg)] rounded-xl px-4 py-3 m-0 list-none flex flex-col gap-2">
            <li className="flex items-center gap-2">
              <span className="font-bold">1.</span> Ketuk <Share size={16} className="inline text-[#2563eb]" /> <b>Bagikan</b> di bawah layar Safari
            </li>
            <li className="flex items-center gap-2">
              <span className="font-bold">2.</span> Pilih <SquarePlus size={16} className="inline text-[#2563eb]" /> <b>Tambah ke Layar Utama</b>
            </li>
          </ol>
        )}
        <button
          onClick={later}
          className="w-full min-h-[44px] mt-2 rounded-xl text-[var(--text-light)] font-semibold text-[0.82rem] cursor-pointer border-none bg-transparent"
        >
          Nanti saja
        </button>
      </div>
    </>
  );
}
