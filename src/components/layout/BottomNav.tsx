import { useApp } from "@/contexts/AppContext";
import { PageName } from "@/types/enums";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Calendar,
  ArrowUpCircle,
  type LucideIcon,
} from "lucide-react";

interface NavItemData {
  page: PageName;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItemData[] = [
  { page: PageName.DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
  { page: PageName.REKAP, label: "Rekap", icon: BarChart3 },
  { page: PageName.GURU, label: "Guru", icon: Users },
  { page: PageName.KALENDER, label: "Kalender", icon: Calendar },
  { page: PageName.UPGRADE, label: "Upgrade", icon: ArrowUpCircle },
];

export function BottomNav() {
  const { activePage, setActivePage, setupSelesai, teacher } = useApp();

  if (!setupSelesai) return null;

  const isPRO = teacher?.tier === "PRO";

  const filteredItems = NAV_ITEMS.filter((item) => {
    if (item.page === PageName.UPGRADE && isPRO) return false;
    return true;
  });

  return (
    <nav
      className="lg:hidden fixed left-1/2 bottom-0 -translate-x-1/2 w-full max-w-app bg-[var(--card-bg)] border-t border-[var(--border)] flex items-end z-[300] py-[6px] px-1"
      style={{ boxShadow: "0 -2px 12px rgba(0,0,0,.08)" }}
    >
      {filteredItems.map((item) => {
        const isActive = activePage === item.page;
        const isUpgrade = item.page === PageName.UPGRADE;
        return (
          <button
            key={item.page}
            onClick={() => setActivePage(item.page)}
            className={`flex-1 flex flex-col items-center gap-[2px] py-[6px] px-[2px] rounded-[10px] cursor-pointer bg-transparent border-none font-[inherit] ${
              isActive ? (isUpgrade ? "text-[#f59e0b]" : "text-[#1e40af]") : "text-[var(--text-light)]"
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
