import { Info, MessageCircle, ExternalLink } from "lucide-react";
import { APP_URL, MAIN_SITE_URL } from "@/lib/constants";

export function TentangKontak() {
  return (
    <div className="flex-1 px-[14px] pt-[14px] pb-[calc(90px+var(--ticker-h,0px))] lg:pb-4">
      {/* Tentang */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
        <div className="text-[0.85rem] font-bold flex items-center gap-[8px] mb-3">
          <Info size={18} className="text-[#2563eb]" /> Tentang
        </div>

        <div className="text-[0.8rem] text-[var(--text)] leading-[1.8] mb-3">
          <b>Presensi Yuk | Guru</b> — v1.0.0
        </div>

        <p className="text-[0.78rem] text-[var(--text-light)] leading-[1.8] mb-3">
          Aplikasi presensi sekolah paling sederhana untuk guru Indonesia.
          Dirancang dengan filosofi <b>Offline First</b> dan <b>Mobile First</b> —
          seluruh fitur inti berjalan tanpa koneksi internet.
        </p>

        <div className="text-[0.74rem] text-[var(--text-light)] leading-[1.7]">
          <div className="flex gap-2 mb-1">
            <span className="font-semibold text-[#2563eb]">Visi:</span>
            <span>Presensi guru selesai dalam <b>&lt;30 detik</b></span>
          </div>
          <div className="flex gap-2 mb-1">
            <span className="font-semibold text-[#2563eb]">FREE:</span>
            <span>maks 5 guru, presensi selfie, rekap & export lengkap</span>
          </div>
          <div className="flex gap-2">
            <span className="font-semibold text-[#2563eb]">Berbayar:</span>
            <span>PLUS Rp27.000 (maks 10 guru, logo sekolah) · PRO Rp51.000 (guru tanpa batas, GPS & peta lokasi, Kepala Sekolah verifikasi izin) — per semester</span>
          </div>
        </div>
      </div>

      {/* Kontak */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
        <div className="text-[0.85rem] font-bold flex items-center gap-[8px] mb-3">
          <MessageCircle size={18} className="text-[#2563eb]" /> Kontak
        </div>

        <p className="text-[0.78rem] text-[var(--text-light)] mb-4">
          Untuk bantuan, kritik, saran, atau kolaborasi:
        </p>

        <div className="flex flex-col gap-[10px]">
          <a
            href="https://wa.me/6289530713597?text=saya%20mau%20konsultasi%20seputar%20aplikasi%20bantu%20guru%20yuk%20%7C%20presensi%20guru"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-[11px] rounded-[10px] bg-[#25D366] text-white font-bold text-[0.82rem] no-underline hover:opacity-90 transition-opacity"
          >
            <MessageCircle size={18} /> WhatsApp Pak Choyy
            <span className="ml-auto text-[0.7rem] opacity-80">0895 3071 3597</span>
          </a>

          <a
            href="https://www.tiktok.com/@pak.choyy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-[11px] rounded-[10px] bg-[#000] text-white font-bold text-[0.82rem] no-underline hover:opacity-90 transition-opacity"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
            </svg>
            TikTok @pak.choyy
          </a>

          <a
            href={APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-[11px] rounded-[10px] bg-[#2563eb]/10 border-2 border-[#2563eb] text-[#2563eb] font-bold text-[0.82rem] no-underline hover:bg-[#2563eb]/20 transition-colors"
          >
            <ExternalLink size={18} />
            <div className="flex-1 text-left">
              <div className="text-[0.85rem] font-extrabold">Presensi Yuk | Guru</div>
              <div className="text-[0.65rem] opacity-80">preguru.bantuguruyuk.web.id</div>
            </div>
          </a>

          <a
            href={MAIN_SITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-[11px] rounded-[10px] border-[1.5px] border-[var(--border)] bg-[var(--card-bg)] text-[var(--text)] font-bold text-[0.82rem] no-underline hover:border-[#2563eb] transition-colors"
          >
            <ExternalLink size={18} className="text-[#2563eb]" />
            bantuguruyuk.web.id
          </a>
        </div>
      </div>
    </div>
  );
}
