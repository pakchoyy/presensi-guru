import { AppProvider, useApp } from "@/contexts/AppContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CloudAuthProvider } from "@/contexts/CloudAuthContext";
import { ToastProvider } from "@/components/shared/Toast";
import { ConfirmDialogProvider } from "@/components/shared/ConfirmDialog";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Footer } from "@/components/layout/Footer";
import { Marquee } from "@/components/layout/Marquee";
import { InstallPrompt } from "@/components/shared/InstallPrompt";
import { useAutoSync } from "@/hooks/useAutoSync";
import { WizardSetup } from "@/components/wizard/WizardSetup";
import { LoginPage } from "@/components/auth/LoginPage";
import { DashboardHarianPage } from "@/components/attendance/DashboardHarianPage";
import { RekapPage } from "@/components/reports/RekapPage";
import { GuruPage } from "@/components/teachers/GuruPage";
import { KalenderPage } from "@/components/calendar/KalenderPage";
import { BackupRestorePage } from "@/components/backup/BackupRestorePage";
import { PetunjukPage } from "@/components/guide/PetunjukPage";
import { TentangKontak } from "@/components/about/TentangKontak";
import { PengaturanPage } from "@/components/pro/PengaturanPage";
import { UpgradePage } from "@/components/pro/UpgradePage";
import { CloudSettingsPage } from "@/components/pro/CloudSettingsPage";

import { PageName } from "@/types/enums";
import { AbsenGuruPage } from "@/components/attendance/AbsenGuruPage";

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
    case PageName.UPGRADE:
      return <UpgradePage />;
    case PageName.PENGATURAN:
      return <PengaturanPage />;
    case PageName.CLOUD_SETTINGS:
      return <CloudSettingsPage />;
    default:
      return <DashboardHarianPage />;
  }
}

function AppContent() {
  const { setupSelesai } = useApp();
  const { isAuthenticated, loading: authLoading } = useAuth();

  useAutoSync();

  return (
    <>
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <PageRouter />
      </div>
      {setupSelesai && (
        <div className="sticky bottom-[56px] lg:static z-[95] w-full">
          <Marquee />
          <Footer />
        </div>
      )}
      <BottomNav />
      {setupSelesai && <InstallPrompt />}
    </>
  );
}

export default function App() {
  const token = typeof window !== "undefined" ? getAbsenToken() : null;
  if (token) {
    return (
      <ToastProvider>
        <AbsenGuruPage token={token} />
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
          </ToastProvider>
        </AppProvider>
      </CloudAuthProvider>
    </AuthProvider>
  );
}
