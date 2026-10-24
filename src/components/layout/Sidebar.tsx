import { isPaid } from "@/lib/features";
import { useApp } from "@/contexts/AppContext";
import { PageName } from "@/types/enums";
import { PRO_PRICE } from "@/lib/constants";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Calendar,
  BookOpen,
  Settings,
  Database,
  ArrowUpCircle,
  School,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  page: PageName;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { page: PageName.DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
  { page: PageName.GURU, label: "Daftar Guru", icon: Users },
  { page: PageName.REKAP, label: "Rekap", icon: BarChart3 },
  { page: PageName.KALENDER, label: "Kalender", icon: Calendar },
  { page: PageName.UPGRADE, label: "Upgrade PRO", icon: ArrowUpCircle },
  { page: PageName.PETUNJUK, label: "Petunjuk", icon: BookOpen },
  { page: PageName.PENGATURAN, label: "Pengaturan", icon: Settings },
  { page: PageName.BACKUP, label: "Backup", icon: Database },
];

export function Sidebar() {
  const { setupSelesai, school, teacher, teachers, activePage, setActivePage } = useApp();

  if (!setupSelesai) return null;

  const isPRO = isPaid(teacher?.tier);

  return (
    <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 min-h-[calc(100vh-3.5rem)] border-r border-[var(--border)] bg-[var(--card-bg)] sticky top-14">
      <div className="px-4 pt-4 pb-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 mb-1">
          <School size={14} className="text-[var(--text-light)]" />
          <span className="text-[0.72rem] font-semibold text-[var(--text-light)] truncate">
            {school?.nama || "Sekolah"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <GraduationCap size={14} className="text-[var(--text-light)]" />
          <span className="text-[0.72rem] text-[var(--text-light)] truncate">
            {teacher?.nama || "Admin"}
          </span>
        </div>
        <div className="text-[0.65rem] text-[var(--text-light)] mt-1">
          {teachers.length} guru terdaftar
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        <div className="text-[0.6rem] font-bold uppercase tracking-[0.8px] text-[var(--text-light)] mb-2 px-1">
          Menu
        </div>
        {NAV_ITEMS.filter((item) => !(item.page === PageName.UPGRADE && isPRO)).map((item) => {
          const isActive = activePage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => setActivePage(item.page)}
              className={`w-full flex items-center gap-3 px-3 py-[8px] rounded-lg text-left text-[0.8rem] font-semibold transition-colors mb-[2px] ${
                isActive
                  ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                  : "text-[var(--text)] hover:bg-[var(--input-bg)]"
              }`}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-[var(--border)]">
        {isPRO ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--brand-soft)]">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[0.6rem] font-bold"
              style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb)" }}
            >
              PRO
            </div>
            <span className="text-[0.72rem] font-semibold text-[var(--brand-strong)]">Akun PRO</span>
          </div>
        ) : (
          <button
            onClick={() => setActivePage(PageName.UPGRADE)}
            className="w-full flex items-center gap-2 px-3 py-[8px] rounded-lg text-[0.78rem] font-bold text-white"
            style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb,#1d4ed8)" }}
          >
            <ArrowUpCircle size={16} />
            <span>Upgrade PRO</span>
            <span className="ml-auto text-[0.65rem] opacity-90">{PRO_PRICE}</span>
          </button>
        )}
      </div>
    </aside>
  );
}
