import { useEffect, useState } from "react";

// Browser bawaan aplikasi (Facebook, Instagram, TikTok, WebView) sering tidak menyimpan data.
const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|musical_ly|; wv\)/i;
const DISMISS_KEY = "bgy_storage_warn_dismissed";

/** Minta penyimpanan permanen, lalu peringatkan bila data HP kemungkinan akan terhapus. */
export function StorageGuard() {
  const [warn, setWarn] = useState<"inapp" | "private" | null>(null);

  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {});
    try { if (sessionStorage.getItem(DISMISS_KEY)) return; } catch { /* abaikan */ }
    if (IN_APP.test(navigator.userAgent)) { setWarn("inapp"); return; }
    // shortcut: mode Penyamaran Chrome memberi kuota kecil; HP normal jauh di atas 120 MB.
    navigator.storage?.estimate?.().then((e) => {
      if (e.quota && e.quota < 120 * 1024 * 1024) setWarn("private");
    }).catch(() => {});
  }, []);

  if (!warn) return null;
  const isAndroid = /Android/i.test(navigator.userAgent);
  const chromeUrl = `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=https;package=com.android.chrome;end`;
  const tutup = () => {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* abaikan */ }
    setWarn(null);
  };

  return (
    <div role="alert" className="fixed top-0 inset-x-0 z-[1000] bg-[#fef3c7] text-[#78350f] border-b border-[#f59e0b] px-3 py-2 text-[0.75rem] leading-snug shadow">
      <div className="max-w-[640px] mx-auto flex items-start gap-2">
        <div className="flex-1">
          {warn === "inapp"
            ? "Kamu membuka aplikasi dari dalam Facebook/Instagram/aplikasi lain. Data bisa hilang saat ditutup. Buka lewat Google Chrome supaya data tersimpan."
            : "Mode Penyamaran (Incognito) aktif. Semua data akan hilang saat tab ditutup. Buka di tab biasa."}
          {warn === "inapp" && (
            isAndroid
              ? <a href={chromeUrl} className="ml-1 font-bold underline text-[#78350f]">Buka di Chrome</a>
              : <span className="ml-1 font-bold">Salin alamat lalu buka di Safari/Chrome.</span>
          )}
        </div>
        <button onClick={tutup} aria-label="Tutup" className="bg-transparent border-none text-[#78350f] font-bold cursor-pointer px-1">✕</button>
      </div>
    </div>
  );
}
