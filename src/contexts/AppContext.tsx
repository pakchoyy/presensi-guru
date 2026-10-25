import { teacherAttendanceRepo } from "@/repositories/dexie/teacher-attendance.repo";
import { addDays } from "@/lib/utils";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { School, Teacher } from "@/types/entities";
import { PageName, Tier } from "@/types/enums";
import { effectiveTier, paketSekolah } from "@/lib/features";
import { guruCloud, adminCloud } from "@/services/multi-perangkat.service";
import { schoolRepo } from "@/repositories/dexie/school.repo";
import { teacherRepo } from "@/repositories/dexie/teacher.repo";
import { setupService } from "@/services/setup.service";
import { licenseService } from "@/services/license.service";
import { useAuth } from "@/contexts/AuthContext";
import { todayStr } from "@/lib/utils";

export type EntryMode = "choose" | "admin" | "guru";

const ENTRY_KEY = "bgy_entry_mode";
const GURU_SESSION_KEY = "bgy_presensi_guru_session";
/** Dihapus saat lisensi berubah supaya paket langsung dikirim ulang ke cloud. */
export const PAKET_SYNC_KEY = "bgy_paket_sync";

function readEntryMode(): EntryMode {
  const v = localStorage.getItem(ENTRY_KEY);
  if (v === "admin") return v;
  // Tanpa sesi guru (belum masuk / sudah Keluar) → kembali ke layar masuk, jangan tertahan di shell guru tanpa guru.
  if (v === "guru") {
    if (readGuruSessionId() != null) return v;
    localStorage.removeItem(ENTRY_KEY);
  }
  return "choose";
}

function readGuruSessionId(): number | null {
  try {
    const raw = localStorage.getItem(GURU_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return typeof s?.guruId === "number" ? s.guruId : null;
  } catch { return null; }
}

interface AppState {
  setupSelesai: boolean;
  school: School | null;
  teacher: Teacher | null;
  teachers: Teacher[];
  activePage: PageName;
  tanggalAktif: string;
  darkMode: boolean;
  loading: boolean;
  entryMode: EntryMode;
  guruSessionId: number | null;
}

interface AppContextType extends AppState {
  /** Paket efektif untuk gating fitur: masa coba = PRO. Cloud/lisensi tetap pakai teacher.tier asli. */
  tier: Tier;
  setActivePage: (page: PageName) => void;
  setTanggalAktif: (tgl: string) => void;
  toggleDarkMode: () => void;
  refreshTeachers: () => Promise<void>;
  refreshTeacher: () => Promise<void>;
  refreshSchool: () => Promise<void>;
  setEntryMode: (mode: EntryMode) => void;
  loginGuru: (guruId: number) => void;
  logoutGuru: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [state, setState] = useState<AppState>({
    setupSelesai: false,
    school: null,
    teacher: null,
    teachers: [],
    activePage: PageName.DASHBOARD,
    tanggalAktif: todayStr(),
    darkMode: localStorage.getItem("bgy_presensi_dark") === "1",
    loading: true,
    entryMode: readEntryMode(),
    guruSessionId: readGuruSessionId(),
  });

  useEffect(() => {
    async function init() {
      const sudah = await setupService.sudahSetup();
      if (sudah) {
        // Lengkapi akun lama yang belum punya kode login / PIN.
        await teacherRepo.ensureLoginCredentials();
        teacherAttendanceRepo.hapusFotoLama(addDays(todayStr(), -7)).catch(() => {});
        const [school, teacher, teachers] = await Promise.all([
          schoolRepo.get(),
          teacherRepo.get(),
          teacherRepo.list(),
        ]);
        setState((prev) => ({
          ...prev,
          setupSelesai: true,
          school: school || null,
          teacher: teacher || null,
          teachers,
          loading: false,
        }));
        // Admin: sampaikan paket (lisensi/masa coba) ke cloud supaya HP guru ikut; paling sering tiap 6 jam.
        if (school && !guruCloud.aktif() && Date.now() - Number(localStorage.getItem(PAKET_SYNC_KEY) || 0) > 6 * 3600_000) {
          localStorage.setItem(PAKET_SYNC_KEY, String(Date.now()));
          adminCloud.daftarkanSekolah(school, teacher).catch(() => {});
        }
      } else {
        setState((prev) => ({ ...prev, loading: false }));
      }
    }
    init();
  }, [token]);

  useEffect(() => {
    if (state.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("bgy_presensi_dark", state.darkMode ? "1" : "0");
  }, [state.darkMode]);

  const setActivePage = useCallback((page: PageName) => {
    setState((prev) => ({ ...prev, activePage: page }));
  }, []);

  const setTanggalAktif = useCallback((tgl: string) => {
    setState((prev) => ({ ...prev, tanggalAktif: tgl }));
  }, []);

  const toggleDarkMode = useCallback(() => {
    setState((prev) => ({ ...prev, darkMode: !prev.darkMode }));
  }, []);

  const refreshTeachers = useCallback(async () => {
    const teachers = await teacherRepo.list();
    const t = await teacherRepo.get();
    setState((prev) => ({
      ...prev,
      teachers,
      setupSelesai: true,
      teacher: t || prev.teacher,
    }));
  }, []);

  const refreshTeacher = useCallback(async () => {
    const teacher = await teacherRepo.get();
    if (teacher) {
      await licenseService.checkExpiry(teacher.id);
    }
    const updated = await teacherRepo.get();
    setState((prev) => ({ ...prev, teacher: updated || null }));
  }, []);

  const refreshSchool = useCallback(async () => {
    const school = await schoolRepo.get();
    setState((prev) => ({ ...prev, school: school || null }));
  }, []);

  const setEntryMode = useCallback((mode: EntryMode) => {
    if (mode === "choose") localStorage.removeItem(ENTRY_KEY);
    else localStorage.setItem(ENTRY_KEY, mode);
    setState((prev) => ({ ...prev, entryMode: mode }));
  }, []);

  const loginGuru = useCallback((guruId: number) => {
    localStorage.setItem(GURU_SESSION_KEY, JSON.stringify({ guruId }));
    localStorage.setItem(ENTRY_KEY, "guru");
    setState((prev) => ({ ...prev, entryMode: "guru", guruSessionId: guruId, activePage: PageName.PRESENSI }));
  }, []);

  const logoutGuru = useCallback(() => {
    localStorage.removeItem(GURU_SESSION_KEY);
    localStorage.removeItem(ENTRY_KEY);
    setState((prev) => ({ ...prev, entryMode: "choose", guruSessionId: null }));
  }, []);

  return (
    <AppContext.Provider
      value={{
        ...state,
        // HP guru memakai paket sekolah (catatan admin); perangkat admin: lisensi/masa coba lokal.
        tier: guruCloud.aktif() ? paketSekolah(state.school) : effectiveTier(state.teacher?.tier),
        setActivePage,
        setTanggalAktif,
        toggleDarkMode,
        refreshTeachers,
        refreshTeacher,
        refreshSchool,
        setEntryMode,
        loginGuru,
        logoutGuru,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
