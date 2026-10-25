import { AppProvider, useApp } from "@/contexts/AppContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CloudAuthProvider } from "@/contexts/CloudAuthContext";
import { ToastProvider } from "@/components/shared/Toast";
import { ConfirmDialogProvider } from "@/components/shared/ConfirmDialog";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Footer } from "@/components/layout/Footer";
import { TrialEndedModal } from "@/components/pro/TrialEndedModal";
import { isPaid, trialDaysRemaining, TRIAL_END_SEEN_KEY } from "@/lib/features";
import { Marquee } from "@/components/layout/Marquee";
import { InstallPrompt } from "@/components/shared/InstallPrompt";
import { useAutoSync } from "@/hooks/useAutoSync";
import { WizardSetup } from "@/components/wizard/WizardSetup";
import { LoginPage } from "@/components/auth/LoginPage";
import { DashboardHarianPage } from "@/components/attendance/DashboardHarianPage";
import { PresensiGuruPage } from "@/components/attendance/PresensiGuruPage";
import { LogPresensiPage } from "@/components/attendance/LogPresensiPage";
import { RekapPage } from "@/components/reports/RekapPage";
import { GuruPage } from "@/components/teachers/GuruPage";
import { KalenderPage } from "@/components/calendar/KalenderPage";
import { BackupRestorePage } from "@/components/backup/BackupRestorePage";
import { PetunjukPage } from "@/components/guide/PetunjukPage";
import { TentangKontak } from "@/components/about/TentangKontak";
import { PengaturanPage } from "@/components/pro/PengaturanPage";
import { UpgradePage } from "@/components/pro/UpgradePage";
import { CloudSettingsPage } from "@/components/pro/CloudSettingsPage";

import { PageName, Tier } from "@/types/enums";
import { AbsenGuruPage } from "@/components/attendance/AbsenGuruPage";
import { EntryGate } from "@/components/entry/EntryGate";
import { GuruShell } from "@/components/guru/GuruShell";
import { useEffect } from "react";
import { captureAktivasiLink, captureRef, readAktivasiLink } from "@/lib/aktivasi-link";
import { AffiliatePage } from "@/components/pro/AffiliatePage";

// Tangkap /aktivasi?email=&kode= dari link toko sebelum render apa pun.
captureRef();
captureAktivasiLink();

function getAbsenToken(): string | null {
  const m = window.location.pathname.match(/^\/g\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function PageRouter() {
  const { setupSelesai, loading } = useApp();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-[var(--text-light)]">
          <div className="text-lg font-bold mb-2">Memuat...</div>
        </div>
      </div>
    );
  }

  if (!setupSelesai) {
    return (
      <div className="flex-1 flex flex-col w-full max-w-full lg:max-w-app lg:mx-auto lg:w-full overflow-x-hidden">
        <WizardSetup />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col w-full max-w-full lg:max-w-[720px] lg:mx-auto lg:w-full overflow-x-hidden">
      <PageContent />
    </div>
  );
}

function PageContent() {
  const { activePage } = useApp();

  switch (activePage) {
    case PageName.DASHBOARD:
      return <DashboardHarianPage />;
    case PageName.REKAP:
      return <RekapPage />;
    case PageName.GURU:
      return <GuruPage />;
    case PageName.KALENDER:
      return <KalenderPage />;
    case PageName.PETUNJUK:
      return <PetunjukPage />;
    case PageName.TENTANG:
      return <TentangKontak />;
    case PageName.BACKUP:
      return <BackupRestorePage />;
    case PageName.AFFILIATE:
      return <AffiliatePage />;
    case PageName.UPGRADE:
      return <UpgradePage />;
    case PageName.PENGATURAN:
      return <PengaturanPage />;
    case PageName.CLOUD_SETTINGS:
      return <CloudSettingsPage />;
    case PageName.PRESENSI:
      return <PresensiGuruPage />;
    case PageName.LOG_PRESENSI:
      return <LogPresensiPage />;
    default:
      return <DashboardHarianPage />;
  }
}

function AppContent() {
  const { setupSelesai, loading, entryMode, setActivePage, teacher, tier } = useApp();

  useAutoSync();

  // Deep link aktivasi: setelah setup selesai, buka Pengaturan (form aktivasi terisi).
  useEffect(() => {
    if (setupSelesai && readAktivasiLink()) setActivePage(PageName.PENGATURAN);
  }, [setupSelesai, setActivePage]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="text-center text-[var(--text-light)]">
          <div className="text-lg font-bold mb-2">Memuat...</div>
        </div>
      </div>
    );
  }

  // Layar awal: pilih peran Admin / Guru
  if (entryMode === "choose") return <EntryGate />;

  // Mode guru: shell sendiri (Presensi / Riwayat / Profil)
  if (entryMode === "guru") return <GuruShell />;

  // Mode admin: aplikasi lengkap (wizard bila belum setup)
  return (
    <>
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <PageRouter />
      </div>
      {setupSelesai && (
        <div className="w-full">
          {tier !== Tier.PRO && <div className="hidden lg:block"><Marquee /></div>}
          <Footer />
        </div>
      )}
      <BottomNav />
      {setupSelesai && !isPaid(teacher?.tier) && trialDaysRemaining() <= 0 && localStorage.getItem(TRIAL_END_SEEN_KEY) !== "1" && (
        <TrialEndedModal onLihatPaket={() => setActivePage(PageName.UPGRADE)} />
      )}
    </>
  );
}

export default function App() {
  const token = typeof window !== "undefined" ? getAbsenToken() : null;
  if (token) {
    return (
      <ToastProvider>
        <AbsenGuruPage token={token} />
        <InstallPrompt />
      </ToastProvider>
    );
  }
  return (
    <AuthProvider>
      <CloudAuthProvider>
        <AppProvider>
          <ToastProvider>
            <ConfirmDialogProvider />
            <AppContent />
            <InstallPrompt />
          </ToastProvider>
        </AppProvider>
      </CloudAuthProvider>
    </AuthProvider>
  );
}
