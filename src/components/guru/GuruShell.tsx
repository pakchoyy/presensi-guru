import { ketukResetUji } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { PresensiGuruPage } from "@/components/attendance/PresensiGuruPage";
import { LogPresensiPage } from "@/components/attendance/LogPresensiPage";
import { LogAbsenPage } from "@/components/attendance/LogAbsenPage";
import { GuruProfilPage } from "@/components/guru/GuruProfilPage";
import { ClipboardCheck, ClipboardList, BarChart3, User, Moon, Sun } from "lucide-react";
import { teacherAttendanceRepo } from "@/repositories/dexie/teacher-attendance.repo";
import { usePengingatAbsen } from "@/hooks/usePengingatAbsen";
import { todayStr } from "@/lib/utils";
import { guruCloud } from "@/services/multi-perangkat.service";
import { showConfirmDialog } from "@/components/shared/ConfirmDialog";

type GuruTab = "presensi" | "log" | "rekap" | "profil";

export function GuruShell() {
  const { darkMode, toggleDarkMode, logoutGuru, teachers, guruSessionId, school, refreshSchool } = useApp();
  const [tab, setTab] = useState<GuruTab>("presensi");
  const [absenHariIni, setAbsenHariIni] = useState<{ masuk: boolean; pulang: boolean }>({
    masuk: false,
    pulang: false,
  });

  const guru = teachers.find((t) => t.id === guruSessionId);

  // Status absen hari ini dipakai pengingat: kalau sudah absen, tidak diingatkan.
  const muatStatus = useCallback(async () => {
    if (guruSessionId == null) return;
    const rec = await teacherAttendanceRepo.getToday(guruSessionId, todayStr());
    setAbsenHariIni({ masuk: !!rec?.jamMasuk, pulang: !!rec?.jamPulang });
  }, [guruSessionId]);

  useEffect(() => { muatStatus(); }, [muatStatus, tab]);

  // HP guru yang tersambung cloud: kirim absen tertunda, ambil setelan sekolah
  // terbaru (titik/radius/jam bisa diubah admin), dan tarik koreksi dari admin.
  const [versiData, setVersiData] = useState(0);
  useEffect(() => {
    if (!guruCloud.aktif()) return;
    const sinkron = async () => {
      await guruCloud.kirimAntrian();
      const sekolahBerubah = await guruCloud.perbaruiSekolah().catch(() => false);
      const absenBerubah = await guruCloud.tarikRiwayat(35).catch(() => 0);
      if (sekolahBerubah) await refreshSchool();
      if (absenBerubah > 0) { setVersiData((v) => v + 1); muatStatus(); }
    };
    sinkron();
    window.addEventListener("online", sinkron);
    return () => window.removeEventListener("online", sinkron);
  }, [refreshSchool, muatStatus]);

  /** Keluar: di HP guru, pastikan absen tertunda terkirim dulu. */
  const keluar = useCallback(async () => {
    if (guruCloud.aktif()) {
      const sisa = await guruCloud.kirimAntrian();
      if (sisa > 0) {
        const tetap = await showConfirmDialog({
          title: "Absen belum terkirim",
          message: `${sisa} absen belum terkirim ke sekolah karena belum ada internet. Kalau keluar sekarang, absen itu hilang dari HP ini. Tetap keluar?`,
          confirmText: "Tetap keluar",
          cancelText: "Batal",
          danger: true,
        });
        if (!tetap) return;
      }
      const dihapus = await guruCloud.keluar();
      logoutGuru();
      // Data lokal di HP guru sudah dibersihkan → muat ulang supaya context ikut bersih.
      if (dihapus) window.location.reload();
      return;
    }
    logoutGuru();
  }, [logoutGuru]);

  const reminder = usePengingatAbsen({
    guru,
    jamMasuk: school?.jamMasukStandar,
    jamPulang: school?.jamPulangStandar,
    sekolahId: school?.id,
    toleransiMenit: school?.toleransiTerlambatMenit,
    sudahMasuk: absenHariIni.masuk,
    sudahPulang: absenHariIni.pulang,
  });

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header guru */}
      <header
        className="sticky top-0 z-[300] px-3 relative"
        style={{ background: "var(--grad)", boxShadow: "0 4px 18px rgba(37,99,235,.25)" }}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <span className="header-orb" style={{ width: 110, height: 110, top: -40, right: -30 }} />
          <span className="header-orb" style={{ width: 60, height: 60, bottom: -20, left: 60, background: "rgba(255,255,255,.08)" }} />
        </div>
        <div className="flex items-center justify-between h-[58px] relative">
          <div className="flex items-center gap-[8px] flex-1 min-w-0">
            <img src="/icons/pg-mark-160-v1.png" alt="Presensi Yuk | Guru" className="flex-shrink-0 w-[42px] h-[42px] rounded-xl shadow-md" />
            <div className="min-w-0 leading-tight">
              <div className="text-[1rem] font-extrabold text-white whitespace-nowrap" onClick={ketukResetUji}>
                <span className="italic">Presensi Yuk</span> <span className="opacity-95">| Guru</span>
              </div>
              {guru?.nama && (
                <div className="text-[0.62rem] text-white/80 truncate flex items-center gap-1 mt-[1px]">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-300" />
                  {guru.nama}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={toggleDarkMode}
            className="h-[34px] w-[34px] rounded-[10px] border-[1.5px] border-white/30 bg-white/15 text-white flex items-center justify-center flex-shrink-0 active:bg-white/25"
            title="Mode gelap/terang"
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Konten */}
      <div key={versiData} className="flex-1 flex flex-col w-full max-w-full lg:max-w-[560px] lg:mx-auto overflow-x-hidden">
        {tab === "presensi" && (
          <PresensiGuruPage embedded onLogout={keluar} onRiwayat={() => setTab("rekap")} />
        )}
        {tab === "log" && <LogAbsenPage />}
        {tab === "rekap" && <LogPresensiPage embedded />}
        {tab === "profil" && <GuruProfilPage onLogout={keluar} reminder={reminder} />}
      </div>

      {/* Bottom nav guru */}
      <nav
        className="fixed left-1/2 bottom-0 -translate-x-1/2 w-full max-w-app bg-[var(--card-bg)] border-t border-[var(--border)] flex items-stretch z-[300] py-[6px] px-1"
        style={{ boxShadow: "0 -4px 16px rgba(37,99,235,.10)" }}
      >
        <NavBtn active={tab === "presensi"} onClick={() => setTab("presensi")} icon={<ClipboardCheck size={20} />} label="Presensi" />
        <NavBtn active={tab === "log"} onClick={() => setTab("log")} icon={<ClipboardList size={20} />} label="Log" />
        <NavBtn active={tab === "rekap"} onClick={() => setTab("rekap")} icon={<BarChart3 size={20} />} label="Rekap" />
        <NavBtn active={tab === "profil"} onClick={() => setTab("profil")} icon={<User size={20} />} label="Profil" />
      </nav>
    </div>
  );
}

function NavBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-[2px] py-[6px] rounded-[10px] bg-transparent border-none font-[inherit] ${
        active ? "text-[var(--brand)]" : "text-[var(--text-light)]"
      }`}
    >
      {icon}
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}
