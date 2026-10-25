import { useEffect, useState } from "react";
import { isPaid } from "@/lib/features";
import { licenseService } from "@/services/license.service";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/shared/Toast";
import { AvatarGuru } from "@/components/shared/AvatarGuru";
import { PageName, Tier } from "@/types/enums";
import { BookOpen, Info, Download, ArrowUpCircle, Cloud, Calendar, Repeat, Gift } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function DropdownMenu({ isOpen, onClose }: Props) {
  const { setActivePage, setupSelesai, teacher, setEntryMode } = useApp();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [lic, setLic] = useState<{ berakhir: string; daysRemaining: number } | null>(null);

  useEffect(() => {
    if (!isOpen || !teacher || !isPaid(teacher.tier)) { setLic(null); return; }
    licenseService.getStatus(teacher.id).then((st) => {
      setLic(st.aktif && st.berakhir && st.daysRemaining !== undefined
        ? { berakhir: st.berakhir, daysRemaining: st.daysRemaining } : null);
    }).catch(() => setLic(null));
  }, [isOpen, teacher]);

  if (!isOpen || !setupSelesai) return null;

  const isPRO = isPaid(teacher?.tier);

  const handleInstall = () => { pasangAplikasi(toast); onClose(); };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[290]"
        onClick={onClose}
      />

      {/* Dropdown */}
      <div
        className="absolute top-[calc(100%+8px)] right-0 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl z-[400] min-w-[200px] overflow-hidden"
        style={{ boxShadow: "var(--shadow-lg)" }}
      >
        {teacher && (
          <button
            onClick={() => { setActivePage(PageName.PENGATURAN); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-transparent border-x-0 border-t-0 cursor-pointer text-left"
          >
            <AvatarGuru id={teacher.id} nama={teacher.nama} size={34} />
            <span className="min-w-0">
              <span className="block text-[0.83rem] font-bold text-[var(--text)] truncate">{teacher.nama}</span>
              <span className="block text-[0.65rem] text-[var(--text-light)]">Admin · ubah foto di Pengaturan</span>
            </span>
          </button>
        )}
        <button
          onClick={() => { setActivePage(PageName.PETUNJUK); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-[11px] text-[0.83rem] font-semibold text-[var(--text)] hover:bg-[var(--input-bg)] transition-colors border-none bg-transparent cursor-pointer text-left"
        >
          <BookOpen size={16} /> Petunjuk
        </button>
        <button
          onClick={() => { setActivePage(PageName.KALENDER); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-[11px] text-[0.83rem] font-semibold text-[var(--text)] hover:bg-[var(--input-bg)] transition-colors border-none bg-transparent cursor-pointer text-left"
        >
          <Calendar size={16} /> Kalender
        </button>

        {isPRO && isAuthenticated && (
          <>
            <div className="h-px bg-[var(--border)] mx-0" />
            <button
              onClick={() => { setActivePage(PageName.CLOUD_SETTINGS); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-[11px] text-[0.83rem] font-semibold text-[var(--text)] hover:bg-[var(--input-bg)] transition-colors border-none bg-transparent cursor-pointer text-left"
            >
              <Cloud size={16} /> Cloud Settings
            </button>
          </>
        )}

        <div className="h-px bg-[var(--border)] mx-0" />

        <button
          onClick={() => { setActivePage(PageName.TENTANG); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-[11px] text-[0.83rem] font-semibold text-[var(--text)] hover:bg-[var(--input-bg)] transition-colors border-none bg-transparent cursor-pointer text-left"
        >
          <Info size={16} /> Tentang &amp; Kontak
        </button>
        <button
          onClick={handleInstall}
          className="w-full flex items-center gap-3 px-4 py-[11px] text-[0.83rem] font-semibold text-[var(--text)] hover:bg-[var(--input-bg)] transition-colors border-none bg-transparent cursor-pointer text-left"
        >
          <Download size={16} /> Install Presensi Yuk
        </button>

        <div className="h-px bg-[var(--border)] mx-0" />

        <button
          onClick={() => { onClose(); setEntryMode("choose"); }}
          className="w-full flex items-center gap-3 px-4 py-[11px] text-[0.83rem] font-semibold text-[var(--text)] hover:bg-[var(--input-bg)] transition-colors border-none bg-transparent cursor-pointer text-left"
        >
          <Repeat size={16} /> Ganti Peran (Admin / Guru)
        </button>

        <div className="h-px bg-[var(--border)] mx-0" />
        <button
          onClick={() => { setActivePage(PageName.AFFILIATE); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-[11px] text-[0.83rem] font-semibold text-[var(--text)] hover:bg-[var(--input-bg)] transition-colors border-none bg-transparent cursor-pointer text-left"
        >
          <Gift size={16} /> Program Affiliate
        </button>

        <div className="h-px bg-[var(--border)] mx-0" />

        {/* Paling bawah: tanda pelanggan / tombol upgrade */}
        {isPRO && lic ? (
          <div className="px-4 py-[11px] bg-[rgba(37,99,235,0.08)]">
            <div className="text-[0.8rem] font-extrabold text-[var(--brand)]">Pelanggan {teacher?.tier} ✓</div>
            <div className="text-[0.68rem] text-[var(--text-light)] mt-[2px]">
              Aktif sampai {lic.berakhir} ({lic.daysRemaining} hari lagi)
            </div>
            {teacher?.tier === Tier.PLUS && (
              <button
                onClick={() => { setActivePage(PageName.UPGRADE); onClose(); }}
                className="mt-[6px] text-[0.7rem] font-bold text-[#d97706] bg-transparent border-none p-0 cursor-pointer"
              >
                Upgrade ke PRO →
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => { setActivePage(PageName.UPGRADE); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-[12px] text-[0.85rem] font-bold text-white border-none cursor-pointer text-left"
            style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
          >
            <ArrowUpCircle size={17} /> Upgrade paket
          </button>
        )}
      </div>
    </>
  );
}

const KUNCI_TERPASANG = "bgy_guru_terpasang";

/** Sudah dibuka sebagai aplikasi terpasang, atau pernah menerima event appinstalled di HP ini. */
export function sudahTerpasang(): boolean {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
  try {
    if (standalone) localStorage.setItem(KUNCI_TERPASANG, "1");
    return standalone || localStorage.getItem(KUNCI_TERPASANG) === "1";
  } catch { return standalone; }
}
window.addEventListener("appinstalled", () => { try { localStorage.setItem(KUNCI_TERPASANG, "1"); } catch { /* ignore */ } });

/** Tampilkan prompt install PWA; kalau sudah terpasang beri tahu; kalau browser tidak menyediakannya, beri petunjuk manual. */
export function pasangAplikasi(toast: (pesan: string) => void) {
  if (sudahTerpasang()) { toast("Aplikasi sudah terpasang di HP ini"); return; }
  const promptEv = (window as any).__bgy_deferredPrompt as BeforeInstallPromptEvent | undefined;
  if (promptEv) {
    promptEv.prompt();
    promptEv.userChoice.then(() => {
      (window as any).__bgy_deferredPrompt = null;
    });
  } else {
    toast("Buka di Chrome/Edge Android, lalu menu > Tambahkan ke Layar Utama");
  }
}
