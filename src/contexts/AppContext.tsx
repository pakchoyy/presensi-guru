import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { School, Teacher } from "@/types/entities";
import { PageName } from "@/types/enums";
import { schoolRepo } from "@/repositories/dexie/school.repo";
import { teacherRepo } from "@/repositories/dexie/teacher.repo";
import { setupService } from "@/services/setup.service";
import { licenseService } from "@/services/license.service";
import { useAuth } from "@/contexts/AuthContext";
import { todayStr } from "@/lib/utils";

interface AppState {
  setupSelesai: boolean;
  school: School | null;
  teacher: Teacher | null;
  teachers: Teacher[];
  activePage: PageName;
  tanggalAktif: string;
  darkMode: boolean;
  loading: boolean;
}

interface AppContextType extends AppState {
  setActivePage: (page: PageName) => void;
  setTanggalAktif: (tgl: string) => void;
  toggleDarkMode: () => void;
  refreshTeachers: () => Promise<void>;
  refreshTeacher: () => Promise<void>;
  refreshSchool: () => Promise<void>;
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
  });

  useEffect(() => {
    async function init() {
      const sudah = await setupService.sudahSetup();
      if (sudah) {
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

  return (
    <AppContext.Provider
      value={{
        ...state,
        setActivePage,
        setTanggalAktif,
        toggleDarkMode,
        refreshTeachers,
        refreshTeacher,
        refreshSchool,
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
