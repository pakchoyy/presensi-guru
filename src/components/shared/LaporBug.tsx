import { useState } from "react";
import { createPortal } from "react-dom";
import { APP_NAME, WA_ADMIN } from "@/lib/constants";
import { Bug, X } from "lucide-react";

/** Form singkat laporan bug → dikirim lewat WhatsApp ke admin (tanpa server). */
export function LaporBug({ onClose }: { onClose: () => void }) {
  const [apa, setApa] = useState("");
  const [halaman, setHalaman] = useState("");
  const [langkah, setLangkah] = useState("");

  const kirim = (e: React.FormEvent) => {
    e.preventDefault();
    const teks = [
      `Laporan bug ${APP_NAME}`,
      `Masalah: ${apa.trim()}`,
      `Halaman: ${halaman.trim() || "-"}`,
      langkah.trim() && `Langkah: ${langkah.trim()}`,
      `Perangkat: ${navigator.userAgent.slice(0, 120)}`,
      `Waktu: ${new Date().toLocaleString("id-ID")}`,
    ].filter(Boolean).join("\n");
    window.open(`https://wa.me/${WA_ADMIN}?text=${encodeURIComponent(teks)}`, "_blank");
    onClose();
  };

  const input = "w-full px-3 py-[10px] rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)] text-[0.85rem]";
  // Portal ke body: header/menu punya stacking context sendiri, jadi modal bisa tertutup navbar bawah.
  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-black/50 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <form onSubmit={kirim} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[var(--card-bg)] rounded-2xl p-4 space-y-3" style={{ boxShadow: "var(--shadow-lg)" }}>
        <div className="flex items-center gap-2">
          <Bug size={18} className="text-[var(--brand)]" />
          <div className="font-extrabold text-[var(--text)] flex-1">Laporkan Bug</div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="border-none bg-transparent text-[var(--text-light)] p-1"><X size={18} /></button>
        </div>
        <label className="block text-[0.75rem] font-bold text-[var(--text-light)]">Apa yang terjadi?
          <textarea required value={apa} onChange={(e) => setApa(e.target.value)} rows={3} className={`${input} mt-1`} placeholder="Mis. tombol Simpan tidak bisa ditekan" />
        </label>
        <label className="block text-[0.75rem] font-bold text-[var(--text-light)]">Di halaman mana?
          <input value={halaman} onChange={(e) => setHalaman(e.target.value)} className={`${input} mt-1`} placeholder="Mis. Pengaturan" />
        </label>
        <label className="block text-[0.75rem] font-bold text-[var(--text-light)]">Langkah sebelum terjadi (opsional)
          <textarea value={langkah} onChange={(e) => setLangkah(e.target.value)} rows={2} className={`${input} mt-1`} />
        </label>
        <button type="submit" className="w-full py-3 rounded-xl border-none text-white font-bold bg-[#16a34a]">Kirim lewat WhatsApp</button>
      </form>
    </div>,
    document.body,
  );
}
