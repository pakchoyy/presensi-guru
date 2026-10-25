import { useState } from "react";
import { isOnTrial, trialDaysRemaining } from "@/lib/features";
import { useApp } from "@/contexts/AppContext";
import { Tier } from "@/types/enums";
import { DropdownMenu } from "@/components/layout/DropdownMenu";
import { SyncIndicator } from "@/components/layout/SyncIndicator";
import { LicenseExpiryBadge } from "@/components/layout/LicenseExpiryBadge";
import { Moon, Sun, Menu } from "lucide-react";
import { AvatarGuru } from "@/components/shared/AvatarGuru";
import { LaporBug } from "@/components/shared/LaporBug";

export function Header() {
  const { darkMode, toggleDarkMode, setupSelesai, teacher } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bugOpen, setBugOpen] = useState(false);

  // Judul PATEN — selalu "Presensi Yuk | Guru" apapun halaman aktifnya.
  return (
    <header
      className="sticky top-0 z-[300] px-3 relative"
      style={{
        background: "var(--grad)",
        boxShadow: "0 4px 18px rgba(13,148,136,.25)",
      }}
    >
      {/* Ornamen lingkaran dekoratif — di layer terpisah yang di-clip,
          supaya DropdownMenu (child header) tidak ikut ke-clip. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <span className="header-orb" style={{ width: 110, height: 110, top: -40, right: -30 }} />
        <span className="header-orb" style={{ width: 70, height: 70, bottom: -24, left: 60, background: "rgba(255,255,255,.08)" }} />
        <span className="header-orb" style={{ width: 42, height: 42, top: 8, left: "40%", background: "rgba(255,255,255,.07)" }} />
      </div>

      <div className="flex items-center justify-between h-[58px] relative">
        <div className="flex items-center gap-[6px] sm:gap-[8px] flex-1 min-w-0">
          {/* Logo sama dengan tampilan guru */}
          <img src="/icons/pg-mark-160-v1.png" alt="Presensi Yuk | Guru" className="flex-shrink-0 w-[36px] h-[36px] sm:w-[42px] sm:h-[42px] rounded-xl shadow-md" />
          <div className="min-w-0 leading-tight">
            <div className="text-[0.92rem] sm:text-[1rem] font-extrabold text-white whitespace-nowrap overflow-hidden text-ellipsis">
              <span className="italic">Presensi Yuk</span>{" "}
              <span className="font-bold opacity-95">| Guru</span>
            </div>
          </div>
        </div>

        {setupSelesai && (
          <span className={`text-[0.65rem] px-[8px] py-[3px] rounded-full font-bold flex-shrink-0 sm:mr-1 ${
            isOnTrial(teacher?.tier) || (teacher?.tier && teacher.tier !== Tier.FREE)
              ? "bg-[#f59e0b]/25 text-[#fef3c7] border border-[#f59e0b]/40"
              : "bg-white/15 text-white/85 border border-white/25"
          }`}>
            {isOnTrial(teacher?.tier) ? <><span className="sm:hidden">Trial {trialDaysRemaining()} hari</span><span className="hidden sm:inline">PRO Trial · sisa {trialDaysRemaining()} hari</span></> : teacher?.tier || "FREE"}
          </span>
        )}

        <div className="flex items-center gap-[5px] flex-shrink-0 relative">
          <SyncIndicator />
          <LicenseExpiryBadge />
          {setupSelesai && teacher && <AvatarGuru id={teacher.id} nama={teacher.nama} size={34} className="hidden sm:inline-flex" />}
          <button
            onClick={toggleDarkMode}
            className="h-[34px] w-[34px] rounded-[10px] border-[1.5px] border-white/30 bg-white/15 text-white flex items-center justify-center flex-shrink-0 active:bg-white/25 cursor-pointer"
            title="Mode gelap/terang"
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {setupSelesai && (
            <>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="h-[34px] w-[34px] rounded-[10px] border-[1.5px] border-white/30 bg-white/15 text-white flex items-center justify-center flex-shrink-0 active:bg-white/25 cursor-pointer"
                title="Menu"
              >
                <Menu size={16} />
              </button>
              <DropdownMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} onLaporBug={() => setBugOpen(true)} />
              {bugOpen && <LaporBug onClose={() => setBugOpen(false)} />}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
