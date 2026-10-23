import { useApp } from "@/contexts/AppContext";
import { PageName } from "@/types/enums";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Settings,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";

interface NavItemData {
  page: PageName;
  label: string;
  icon: LucideIcon;
}

// Nav ADMIN — presensi mandiri guru ada di shell guru (alur masuk terpisah).
const NAV_ITEMS: NavItemData[] = [
  { page: PageName.DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
  { page: PageName.GURU, label: "Guru", icon: Users },
  { page: PageName.REKAP, label: "Rekap", icon: BarChart3 },
  { page: PageName.PENGATURAN, label: "Pengaturan", icon: Settings },
];

export function BottomNav() {
  const { activePage, setActivePage, setupSelesai } = useApp();

  if (!setupSelesai) return null;

  return (
    <nav
      className="lg:hidden fixed left-1/2 bottom-0 -translate-x-1/2 w-full max-w-app bg-[var(--card-bg)] border-t border-[var(--border)] flex items-stretch z-[300] py-[6px] px-1"
      style={{ boxShadow: "0 -4px 16px rgba(37,99,235,.10)" }}
    >
      {NAV_ITEMS.flatMap((item, i) => {
        const isActive = activePage === item.page;
        const tombol = (
          <button
            key={item.page}
            onClick={() => setActivePage(item.page)}
            className={`flex-1 flex flex-col items-center gap-[2px] py-[6px] px-[2px] rounded-[10px] cursor-pointer bg-transparent border-none font-[inherit] ${
              isActive ? "text-[var(--brand)]" : "text-[var(--text-light)]"
            }`}
          >
            <item.icon size={19} />
            <span className="text-[10px] font-bold">{item.label}</span>
          </button>
        );
        if (i !== 1) return [tombol];
        // Presensi di tengah, menonjol (sama dengan nav guru).
        const presensiAktif = activePage === PageName.PRESENSI;
        return [
          tombol,
          <button
            key="presensi"
            onClick={() => setActivePage(PageName.PRESENSI)}
            className="flex-1 flex flex-col items-center gap-[2px] bg-transparent border-none font-[inherit] -mt-6"
            aria-label="Presensi"
          >
            <span
              className="w-[58px] h-[58px] rounded-full flex items-center justify-center text-white border-4 border-[var(--card-bg)]"
              style={{ background: "var(--grad)", boxShadow: "0 6px 16px rgba(37,99,235,.35)" }}
            >
              <ClipboardCheck size={26} />
            </span>
            <span className={`text-[10px] font-bold ${presensiAktif ? "text-[var(--brand)]" : "text-[var(--text-light)]"}`}>Presensi</span>
          </button>,
        ];
      })}
    </nav>
  );
}
