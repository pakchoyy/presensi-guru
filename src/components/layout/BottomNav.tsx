import { useApp } from "@/contexts/AppContext";
import { PageName } from "@/types/enums";
import {
  LayoutDashboard,
  BarChart3,
  ClipboardCheck,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";

interface NavItemData {
  page: PageName;
  label: string;
  icon: LucideIcon;
}

// Nav admin — 5 slot, Presensi tombol tengah. Log Presensi dikeluarkan
// (alur guru dikerjakan terpisah nanti).
const NAV_ITEMS: NavItemData[] = [
  { page: PageName.DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
  { page: PageName.GURU, label: "Guru", icon: Users },
  { page: PageName.PRESENSI, label: "Presensi", icon: ClipboardCheck },
  { page: PageName.REKAP, label: "Rekap", icon: BarChart3 },
  { page: PageName.PENGATURAN, label: "Pengaturan", icon: Settings },
];

export function BottomNav() {
  const { activePage, setActivePage, setupSelesai } = useApp();

  if (!setupSelesai) return null;

  return (
    <nav
      className="lg:hidden fixed left-1/2 bottom-0 -translate-x-1/2 w-full max-w-app bg-[var(--card-bg)] border-t border-[var(--border)] flex items-end z-[300] py-[6px] px-1"
      style={{ boxShadow: "0 -4px 16px rgba(13,148,136,.10)" }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = activePage === item.page;
        const isCenter = item.page === PageName.PRESENSI;
        if (isCenter) {
          return (
            <button
              key={item.page}
              onClick={() => setActivePage(item.page)}
              className="flex-1 flex flex-col items-center justify-end gap-[2px] py-[2px] px-[2px] cursor-pointer bg-transparent border-none font-[inherit] relative"
            >
              <span
                className={`w-[46px] h-[46px] -mt-6 rounded-full flex items-center justify-center text-white shadow-md border-[3px] border-[var(--card-bg)]`}
                style={{ background: "var(--grad)" }}
              >
                <item.icon size={22} />
              </span>
              <span className={`text-[10px] font-bold ${isActive ? "text-[var(--brand)]" : "text-[var(--text-light)]"}`}>
                {item.label}
              </span>
            </button>
          );
        }
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
