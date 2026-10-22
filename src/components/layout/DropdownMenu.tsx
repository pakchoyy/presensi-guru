import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/shared/Toast";
import { PageName, Tier } from "@/types/enums";
import { PRO_PRICE } from "@/lib/constants";
import { Home, BookOpen, Info, Download, Globe, ArrowUpCircle, Settings, Cloud, QrCode, Users, Calendar } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function DropdownMenu({ isOpen, onClose }: Props) {
  const { setActivePage, setupSelesai, teacher } = useApp();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [qrMode, setQrMode] = useState(localStorage.getItem("bgy_qr_mode") === "1");

  if (!isOpen || !setupSelesai) return null;

  const isPRO = teacher?.tier === Tier.PRO;

  const canInstall = !!(window as any).__bgy_deferredPrompt;

  const handleInstall = () => {
    const promptEv = (window as any).__bgy_deferredPrompt as BeforeInstallPromptEvent | undefined;
    if (promptEv) {
      promptEv.prompt();
      promptEv.userChoice.then(() => {
        (window as any).__bgy_deferredPrompt = null;
      });
    } else {
      toast("Buka di Chrome/Edge Android, lalu menu > Tambahkan ke Layar Utama");
    }
    onClose();
  };

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
        <button
          onClick={() => { setActivePage(PageName.DASHBOARD); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-[11px] text-[0.83rem] font-semibold text-[var(--text)] hover:bg-[var(--input-bg)] transition-colors border-none bg-transparent cursor-pointer text-left"
        >
          <Home size={16} /> Home
        </button>
        <button
          onClick={() => { setActivePage(PageName.GURU); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-[11px] text-[0.83rem] font-semibold text-[var(--text)] hover:bg-[var(--input-bg)] transition-colors border-none bg-transparent cursor-pointer text-left"
        >
          <Users size={16} /> Daftar Guru
        </button>
        <button
          onClick={() => { setActivePage(PageName.KALENDER); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-[11px] text-[0.83rem] font-semibold text-[var(--text)] hover:bg-[var(--input-bg)] transition-colors border-none bg-transparent cursor-pointer text-left"
        >
          <Calendar size={16} /> Kalender
        </button>
        <button
          onClick={() => { setActivePage(PageName.PETUNJUK); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-[11px] text-[0.83rem] font-semibold text-[var(--text)] hover:bg-[var(--input-bg)] transition-colors border-none bg-transparent cursor-pointer text-left"
        >
          <BookOpen size={16} /> Petunjuk
        </button>

        <div className="h-px bg-[var(--border)] mx-0" />

        <button
          onClick={() => { setActivePage(PageName.PENGATURAN); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-[11px] text-[0.83rem] font-semibold text-[var(--text)] hover:bg-[var(--input-bg)] transition-colors border-none bg-transparent cursor-pointer text-left"
        >
          <Settings size={16} /> Pengaturan
        </button>

        <button
          onClick={() => {
            const newVal = !qrMode;
            setQrMode(newVal);
            localStorage.setItem("bgy_qr_mode", newVal ? "1" : "0");
            if (newVal) {
              localStorage.setItem("bgy_pjj_mode", "0");
              localStorage.setItem("bgy_auto_hadir", "0");
              localStorage.removeItem("bgy_qr_hint_seen");
              toast("✅ Mode QR: ON — Auto Hadir dimatikan, cetak kartu di menu Siswa");
            } else {
              toast("Mode QR: OFF");
            }
            window.dispatchEvent(new Event("storage"));
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-[11px] text-[0.83rem] font-semibold text-[var(--text)] hover:bg-[var(--input-bg)] transition-colors border-none bg-transparent cursor-pointer text-left"
        >
          <QrCode size={16} /> Mode QR {qrMode ? <span className="ml-auto text-[0.65rem] font-bold text-[var(--brand)]">ON</span> : <span className="ml-auto text-[0.65rem] text-[var(--text-light)]">OFF</span>}
        </button>

        {isPRO && isAuthenticated && (
          <button
            onClick={() => { setActivePage(PageName.CLOUD_SETTINGS); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-[11px] text-[0.83rem] font-semibold text-[var(--text)] hover:bg-[var(--input-bg)] transition-colors border-none bg-transparent cursor-pointer text-left"
          >
            <Cloud size={16} /> Cloud Settings
          </button>
        )}

        <div className="h-px bg-[var(--border)] mx-0" />

        <button
          onClick={() => { setActivePage(PageName.TENTANG); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-[11px] text-[0.83rem] font-semibold text-[var(--text)] hover:bg-[var(--input-bg)] transition-colors border-none bg-transparent cursor-pointer text-left"
        >
          <Info size={16} /> Tentang &amp; Kontak
        </button>

        <div className="h-px bg-[var(--border)] mx-0" />

        <button
          onClick={handleInstall}
          className="w-full flex items-center gap-3 px-4 py-[11px] text-[0.83rem] font-semibold text-[var(--text)] hover:bg-[var(--input-bg)] transition-colors border-none bg-transparent cursor-pointer text-left"
        >
          <Download size={16} /> Install BGY Presensi
        </button>
        <button
          onClick={() => {
            window.open("https://bantuguruyuk.web.id", "_blank", "noopener");
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-[11px] text-[0.83rem] font-semibold text-[var(--text)] hover:bg-[var(--input-bg)] transition-colors border-none bg-transparent cursor-pointer text-left"
        >
          <Globe size={16} /> bantuguruyuk.web.id
        </button>

        <div className="h-px bg-[var(--border)] mx-0" />

        {!isPRO && (
          <button
            onClick={() => { setActivePage(PageName.UPGRADE); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-[11px] text-[0.83rem] font-semibold text-[var(--brand)] hover:bg-[var(--input-bg)] transition-colors border-none bg-transparent cursor-pointer text-left"
          >
            <ArrowUpCircle size={16} /> Upgrade PRO
            <span className="ml-auto text-[0.65rem] text-[var(--text-light)]">{PRO_PRICE}</span>
          </button>
        )}
      </div>
    </>
  );
}
