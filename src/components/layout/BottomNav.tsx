import { useApp } from "@/contexts/AppContext";
import { PageName } from "@/types/enums";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Settings,
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
      {NAV_ITEMS.map((item) => {
        const isActive = activePage === item.page;
        return (
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
      })}
    </nav>
  );
}
