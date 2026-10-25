import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { PresensiGuruPage } from "@/components/attendance/PresensiGuruPage";
import { LogPresensiPage } from "@/components/attendance/LogPresensiPage";
import { LogAbsenPage } from "@/components/attendance/LogAbsenPage";
import { GuruProfilPage } from "@/components/guru/GuruProfilPage";
import { ClipboardCheck, ClipboardList, BarChart3, User, Moon, Sun, FileText, Menu, BookOpen, Download, Info, LayoutDashboard, Bug } from "lucide-react";
import { IzinGuruPage, LogIzinPage } from "@/components/guru/IzinGuruPage";
import { DashboardHarianPage } from "@/components/attendance/DashboardHarianPage";
import { db } from "@/repositories/dexie/db";
import { PetunjukPage } from "@/components/guide/PetunjukPage";
import { TentangKontak } from "@/components/about/TentangKontak";
import { pasangAplikasi } from "@/components/layout/DropdownMenu";
import { LaporBug } from "@/components/shared/LaporBug";
import { useToast } from "@/components/shared/Toast";
import { teacherAttendanceRepo } from "@/repositories/dexie/teacher-attendance.repo";
import { usePengingatAbsen } from "@/hooks/usePengingatAbsen";
import { todayStr } from "@/lib/utils";
import { guruCloud } from "@/services/multi-perangkat.service";
import { showConfirmDialog } from "@/components/shared/ConfirmDialog";
import { AvatarGuru } from "@/components/shared/AvatarGuru";

type GuruTab = "dashboard" | "izin" | "presensi" | "log" | "rekap" | "profil" | "petunjuk" | "tentang";

export function GuruShell() {
  const { darkMode, toggleDarkMode, logoutGuru, teachers, guruSessionId, school, refreshSchool } = useApp();
  const [tab, setTab] = useState<GuruTab>("presensi");
  const [logJenis, setLogJenis] = useState<"presensi" | "izin">("presensi");
  const [menuBuka, setMenuBuka] = useState(false);
  const [bugBuka, setBugBuka] = useState(false);
  // Kepala Sekolah / verifikator yang ditunjuk admin: bisa memutuskan izin guru lain.
  const [cloudKs, setCloudKs] = useState(false);
  useEffect(() => { guruCloud.cekVerifikator().then(setCloudKs).catch(() => {}); }, []);
  const { toast } = useToast();
  const [absenHariIni, setAbsenHariIni] = useState<{ masuk: boolean; pulang: boolean }>({
    masuk: false,
    pulang: false,
  });

  const guru = teachers.find((t) => t.id === guruSessionId);
  // Kepala Sekolah: Dashboard (lihat & ubah presensi semua guru + verifikasi izin).
  const ks = guru?.role === "ks" || cloudKs;
  useEffect(() => {
    // Peran di cloud baru diubah admin → samakan di HP ini.
    if (cloudKs && guru && guru.role !== "ks") db.teachers.update(guru.id, { role: "ks" });
  }, [cloudKs, guru]);

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
          title: "Presensi belum terkirim",
          message: `${sisa} presensi belum terkirim ke sekolah karena belum ada internet. Kalau keluar sekarang, presensi itu hilang dari HP ini. Tetap keluar?`,
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
              <div className="text-[0.92rem] sm:text-[1rem] font-extrabold text-white whitespace-nowrap">
                <span className="italic">Presensi Yuk</span> <span className="opacity-95">| Guru</span>
              </div>
            </div>
          </div>
          <button onClick={() => setTab("profil")} aria-label="Profil" className="mr-2 p-0 border-none bg-transparent rounded-full flex-shrink-0 cursor-pointer" style={{ boxShadow: "0 0 0 2px rgba(255,255,255,.6)" }}>
            <AvatarGuru id={guru?.id} nama={guru?.nama} size={34} />
          </button>
          <button
            onClick={toggleDarkMode}
            className="h-[34px] w-[34px] rounded-[10px] border-[1.5px] border-white/30 bg-white/15 text-white flex items-center justify-center flex-shrink-0 active:bg-white/25"
            title="Mode gelap/terang"
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={() => setMenuBuka((v) => !v)}
            className="ml-2 h-[34px] w-[34px] rounded-[10px] border-[1.5px] border-white/30 bg-white/15 text-white flex items-center justify-center flex-shrink-0 active:bg-white/25"
            aria-label="Menu"
          >
            <Menu size={16} />
          </button>
          {menuBuka && (
            <>
              <div className="fixed inset-0 z-[290]" onClick={() => setMenuBuka(false)} />
              <div
                className="absolute top-[calc(100%+8px)] right-0 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl z-[400] min-w-[200px] overflow-hidden"
                style={{ boxShadow: "var(--shadow-lg)" }}
              >
                {[
                  ...(ks ? [{ ikon: <ClipboardList size={16} />, teks: "Log saya", aksi: () => setTab("log") }] : []),
                  { ikon: <BookOpen size={16} />, teks: "Petunjuk", aksi: () => setTab("petunjuk") },
                  { ikon: <Info size={16} />, teks: "Tentang & Kontak", aksi: () => setTab("tentang") },
                  { ikon: <Download size={16} />, teks: "Install Presensi Yuk", aksi: () => pasangAplikasi(toast) },
                  { ikon: <Bug size={16} />, teks: "Laporkan Bug", aksi: () => setBugBuka(true) },
                ].map((m) => (
                  <button
                    key={m.teks}
                    onClick={() => { m.aksi(); setMenuBuka(false); }}
                    className="w-full flex items-center gap-3 px-4 py-[11px] text-[0.83rem] font-semibold text-[var(--text)] hover:bg-[var(--input-bg)] border-none bg-transparent text-left"
                  >
                    {m.ikon} {m.teks}
                  </button>
                ))}
              </div>
            </>
          )}
          {bugBuka && <LaporBug onClose={() => setBugBuka(false)} />}
        </div>
      </header>

      {/* Konten */}
      <div key={versiData} className="flex-1 flex flex-col w-full max-w-full lg:max-w-[560px] lg:mx-auto overflow-x-hidden">
        {tab === "presensi" && (
          <PresensiGuruPage embedded onLogout={keluar} onRiwayat={() => setTab("rekap")} />
        )}
        {tab === "dashboard" && <DashboardHarianPage bolehUbah />}
        {tab === "izin" && <IzinGuruPage onSelesai={() => { setLogJenis("izin"); setTab("log"); }} />}
        {tab === "log" && (
          <>
            <div className="px-[14px] pt-[14px] -mb-[6px]">
              <div className="grid grid-cols-2 p-1 rounded-xl bg-[var(--input-bg)] border border-[var(--border)]">
                {(["presensi", "izin"] as const).map((j) => (
                  <button
                    key={j}
                    onClick={() => setLogJenis(j)}
                    className={`py-2 rounded-lg text-[0.8rem] font-bold border-none ${
                      logJenis === j ? "bg-[var(--card-bg)] text-[var(--brand)] shadow-sm" : "bg-transparent text-[var(--text-light)]"
                    }`}
                  >
                    {j === "presensi" ? "Log Presensi" : "Log Izin"}
                  </button>
                ))}
              </div>
            </div>
            {logJenis === "presensi" ? <LogAbsenPage /> : <div className="flex-1 px-[14px] pt-[14px] pb-[90px]"><LogIzinPage /></div>}
          </>
        )}
        {tab === "petunjuk" && <PetunjukPage />}
        {tab === "tentang" && <TentangKontak />}
        {tab === "rekap" && <LogPresensiPage embedded />}
        {tab === "profil" && <GuruProfilPage onLogout={keluar} reminder={reminder} />}
      </div>

      {/* Bottom nav guru */}
      <nav
        className="fixed left-1/2 bottom-0 -translate-x-1/2 w-full max-w-app bg-[var(--card-bg)] border-t border-[var(--border)] flex items-stretch z-[300] py-[6px] px-1"
        style={{ boxShadow: "0 -4px 16px rgba(37,99,235,.10)" }}
      >
        <NavBtn active={tab === "izin"} onClick={() => setTab("izin")} icon={<FileText size={20} />} label="Izin" />
        {ks ? (
          <NavBtn active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={<LayoutDashboard size={20} />} label="Dashboard" />
        ) : (
          <NavBtn active={tab === "log"} onClick={() => setTab("log")} icon={<ClipboardList size={20} />} label="Log" />
        )}
        {/* Presensi di tengah, menonjol */}
        <button
          onClick={() => setTab("presensi")}
          className="flex-1 flex flex-col items-center gap-[2px] bg-transparent border-none font-[inherit] -mt-6"
          aria-label="Presensi"
        >
          <span
            className="w-[58px] h-[58px] rounded-full flex items-center justify-center text-white border-4 border-[var(--card-bg)]"
            style={{ background: "var(--grad)", boxShadow: "0 6px 16px rgba(37,99,235,.35)" }}
          >
            <ClipboardCheck size={26} />
          </span>
          <span className={`text-[10px] font-bold ${tab === "presensi" ? "text-[var(--brand)]" : "text-[var(--text-light)]"}`}>Presensi</span>
        </button>
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
