import { readAktivasiLink, clearAktivasiLink } from "@/lib/aktivasi-link";
import { useState, useEffect, useRef } from "react";
import { useApp } from "@/contexts/AppContext";
import { adminCloud } from "@/services/multi-perangkat.service";
import { useToast } from "@/components/shared/Toast";
import { licenseService } from "@/services/license.service";
import { licenseRepo } from "@/repositories/dexie/license.repo";
import type { License } from "@/types/entities";
import { syncService } from "@/services/sync.service";
import { getSyncLog, type SyncLogEntry } from "@/services/sync.service";
import { Tier, Jenjang, PageName } from "@/types/enums";
import { showConfirmDialog } from "@/components/shared/ConfirmDialog";
import { MAX_STUDENTS_FREE, PRO_PRICE } from "@/lib/constants";
import { generateId, getActiveDays, zonaWaktu } from "@/lib/utils";
import { jendelaPresensi } from "@/services/teacher-attendance.service";
import { supabase } from "@/lib/supabase";
import { trackDevice } from "@/contexts/AuthContext";
import {
  Settings,
  ArrowUpCircle,
  Check,
  Crown,
  Mail,
  Key,
  CalendarCheck,
  AlertTriangle,
  Clock,
  Copy,
  MessageCircle,
  Calendar,
  UserCheck,
  PenLine,
  Plus,
  School,
  Info,
  Upload,
  Download,
  LogOut,
  RefreshCw,
  Smartphone,
  X,
  MapPin,
  Target,
  Save,
} from "lucide-react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { schoolRepo } from "@/repositories/dexie/school.repo";
import { teacherRepo } from "@/repositories/dexie/teacher.repo";
import { academicYearRepo } from "@/repositories/dexie/academic-year.repo";
import type { AcademicYear } from "@/types/entities";
import { Semester } from "@/types/enums";
import { LogoUpload } from "@/components/shared/LogoUpload";
import { useAuth } from "@/contexts/AuthContext";
import { useCloudAuth } from "@/contexts/CloudAuthContext";

const getHariAktif = (): string => {
  return localStorage.getItem("bgy_hari_aktif") || "Senin-Sabtu";
};

const getAutoHadir = (): boolean => {
  const stored = localStorage.getItem("bgy_auto_hadir");
  if (stored === null) {
    localStorage.setItem("bgy_auto_hadir", "1");
    return true;
  }
  return stored === "1";
};

export function PengaturanPage() {
  const { teacher, school, refreshTeacher, refreshSchool, setActivePage } = useApp();
  const { toast } = useToast();
  const { isCloudConnected, cloudUser, setCloudEmail, clearCloudEmail } = useCloudAuth();

  const isPRO = teacher?.tier === Tier.PRO;

  const [email, setEmail] = useState(() => readAktivasiLink()?.email || "");
  const [kode, setKode] = useState(() => readAktivasiLink()?.kode || "");
  const [activating, setActivating] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [syncLog, setSyncLog] = useState<SyncLogEntry | null>(() => getSyncLog());
  const thisDeviceId = localStorage.getItem("presensi_device_id");
  const [licenseInfo, setLicenseInfo] = useState<Awaited<
    ReturnType<typeof licenseService.getStatus>
  > | null>(null);

  const [hariAktif, setHariAktif] = useState<string>(getHariAktif());
  const [customDays, setCustomDays] = useState<string>(localStorage.getItem("bgy_hari_aktif_custom") || "1,2,3,4,5,6");
  const [autoHadir, setAutoHadir] = useState(getAutoHadir());

  // Lokasi & Jam Sekolah (geofencing untuk presensi guru)
  const [editLat, setEditLat] = useState<string>(school?.lat?.toString() ?? "");
  const [editLng, setEditLng] = useState<string>(school?.lng?.toString() ?? "");
  const [editRadius, setEditRadius] = useState<number>(school?.radiusMeter ?? 100);
  const [editJamMasuk, setEditJamMasuk] = useState<string>(school?.jamMasukStandar ?? "07:00");
  const [editJamPulang, setEditJamPulang] = useState<string>(school?.jamPulangStandar ?? "15:00");
  const [editToleransi, setEditToleransi] = useState<number>(school?.toleransiTerlambatMenit ?? 15);
  const [editMulaiMasuk, setEditMulaiMasuk] = useState<string>(jendelaPresensi(school ?? undefined).mulaiMasuk);
  const [editBatasPulang, setEditBatasPulang] = useState<string>(jendelaPresensi(school ?? undefined).batasPulang);
  const [savingLokasi, setSavingLokasi] = useState(false);
  const { loading: gettingGps, request: requestGps, error: gpsError } = useGeolocation();
  const schoolHydrated = useRef(false);

  // Hydrate ketika school pertama kali ter-load
  useEffect(() => {
    if (!school || schoolHydrated.current) return;
    schoolHydrated.current = true;
    setEditLat(school.lat?.toString() ?? "");
    setEditLng(school.lng?.toString() ?? "");
    setEditRadius(school.radiusMeter ?? 100);
    setEditJamMasuk(school.jamMasukStandar ?? "07:00");
    setEditJamPulang(school.jamPulangStandar ?? "15:00");
    setEditToleransi(school.toleransiTerlambatMenit ?? 15);
    setEditMulaiMasuk(jendelaPresensi(school).mulaiMasuk);
    setEditBatasPulang(jendelaPresensi(school).batasPulang);
  }, [school]);

  const [editSekolah, setEditSekolah] = useState(false);
  const [editNamaSekolah, setEditNamaSekolah] = useState(school?.nama || "");
  const [editJenjang, setEditJenjang] = useState<Jenjang>(school?.jenjang || Jenjang.SD);
  const [savingSekolah, setSavingSekolah] = useState(false);
  
  // Academic year state
  const [activeAy, setActiveAy] = useState<AcademicYear | undefined>();
  const [editingAjaran, setEditingAjaran] = useState(false);
  const [editLabel, setEditLabel] = useState("");
  const [editMulai, setEditMulai] = useState("");
  const [editSelesai, setEditSelesai] = useState("");
  const [savingAjaran, setSavingAjaran] = useState(false);

  // Login device lain state
  const [loginEmail, setLoginEmail] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showEmergencyTools, setShowEmergencyTools] = useState(false);

  const [showSyncPrompt, setShowSyncPrompt] = useState(false);

  // Auto-fill email from teacher data
  useEffect(() => {
    if (teacher?.email && !loginEmail) {
      setLoginEmail(teacher.email);
    }
    if (teacher?.email && !email) {
      setEmail(teacher.email);
    }
  }, [teacher]);

  // First-time PRO sync reminder
  useEffect(() => {
    const reminded = localStorage.getItem("bgy_pro_sync_reminded");
    if (isPRO && !isCloudConnected && !reminded) {
      const timer = setTimeout(() => setShowSyncPrompt(true), 800);
      return () => clearTimeout(timer);
    }
  }, [isPRO, isCloudConnected]);

  useEffect(() => {
    if (!teacher) return;

    const teacherId = teacher.id;
    const teacherTier = teacher.tier;
    const teacherEmail = teacher.email;

    let cancelled = false;

    const loadLicense = async () => {
      try {
        const status = await licenseService.getStatus(teacherId);
        if (cancelled) return;

        // If PRO but no local license record, auto-fetch from Supabase
        if (!status.aktif && teacherTier === Tier.PRO && teacherEmail) {
          try {
            const lookup = await licenseService.lookupByEmail(teacherEmail.toLowerCase().trim());
            const licenseData = lookup.found ? { tanggal_berakhir: lookup.tanggalBerakhir } : null;

            if (licenseData?.tanggal_berakhir) {
              const now = Date.now();
              const license: License = {
                id: generateId(),
                guruId: teacherId,
                emailAktivasi: teacherEmail,
                kodeLisensi: "AUTO-RECOVERED",
                tanggalAktivasi: now,
                tanggalBerakhir: licenseData.tanggal_berakhir,
                statusLisensi: "Aktif",
              };
              await licenseRepo.save(license);
              if (!cancelled) {
                const updatedStatus = await licenseService.getStatus(teacherId);
                setLicenseInfo(updatedStatus);
              }
              setCloudEmail(teacherEmail.toLowerCase().trim());
              return;
            }
          } catch (err) {
            console.error("Auto-recover license failed:", err);
          }
        }

        if (!cancelled) {
          setLicenseInfo(status);
        }
      } catch (err) {
        console.error("Load license failed:", err);
        if (!cancelled) {
          setLicenseInfo(null);
        }
      }
    };

    loadLicense();

    return () => {
      cancelled = true;
    };
  }, [teacher?.id, teacher?.tier, teacher?.email]);

  useEffect(() => {
    academicYearRepo.getActive().then((ay) => {
      if (ay) {
        setActiveAy(ay);
        setEditLabel(ay.label);
        setEditMulai(ay.tanggalMulai);
        setEditSelesai(ay.tanggalSelesai);
      }
    });
  }, []);

  // Load hari aktif dari teacher object & cloud (PRO)
  useEffect(() => {
    if (teacher?.hariAktifMode) {
      setHariAktif(teacher.hariAktifMode);
      if (teacher.hariAktifCustom) setCustomDays(teacher.hariAktifCustom);
    }
    if (isPRO && teacher?.email) {
      (async () => {
        try {
          const { data } = await supabase
            .from("teacher_settings")
            .select("hari_aktif_mode, hari_aktif_custom")
            .eq("email", teacher.email.toLowerCase().trim())
            .maybeSingle();
          if (data) {
            setHariAktif(data.hari_aktif_mode);
            if (data.hari_aktif_custom) setCustomDays(data.hari_aktif_custom);
            localStorage.setItem("bgy_hari_aktif", data.hari_aktif_mode);
            if (data.hari_aktif_custom) localStorage.setItem("bgy_hari_aktif_custom", data.hari_aktif_custom);
          }
        } catch {}
      })();
    }
  }, [teacher?.id, isPRO]);

  useEffect(() => {
    if (!cloudUser?.id) return;
    const fetchDevices = async () => {
      const { data } = await supabase
        .from("devices")
        .select("id, device_id, device_name, last_active_at")
        .eq("user_id", cloudUser.id);
      setDevices(data || []);
    };
    fetchDevices();
  }, [cloudUser?.id]);

  useEffect(() => {
    const refreshLog = () => setSyncLog(getSyncLog());
    window.addEventListener("sync-log-updated", refreshLog);
    window.addEventListener("data-changed", refreshLog);
    const interval = setInterval(refreshLog, 5000);
    return () => {
      window.removeEventListener("sync-log-updated", refreshLog);
      window.removeEventListener("data-changed", refreshLog);
      clearInterval(interval);
    };
  }, []);

  const saveHariAktifSettings = async (mode: string, days: string) => {
    setHariAktif(mode);
    setCustomDays(days);
    localStorage.setItem("bgy_hari_aktif", mode);
    localStorage.setItem("bgy_hari_aktif_custom", days);
    if (teacher?.id) {
      await teacherRepo.update(teacher.id, { ...teacher, hariAktifMode: mode, hariAktifCustom: days });
      await refreshTeacher();
    }
    if (isPRO && teacher?.email) {
      await supabase.from("teacher_settings").upsert(
        { email: teacher.email.toLowerCase().trim(), hari_aktif_mode: mode, hari_aktif_custom: days, updated_at: Date.now() },
        { onConflict: "email" }
      );
    }
    const label = mode === "Kustom" ? days.split(",").map(Number).sort().map((d) => ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][d]).join(", ") : mode === "Senin-Jumat" ? "Senin - Jumat" : "Senin - Sabtu";
    toast(`Hari aktif: ${label}`);
  };

  const handleActivate = async () => {
    if (!teacher) return;
    if (!email.trim()) { toast("Masukkan email dulu"); setActivating(false); return; }
    setActivating(true);
    const result: any = await licenseService.activate(email.trim(), kode.trim(), teacher.id);
    setActivating(false);

    if (result.success) {
      toast(result.message);
      setKode("");
      clearAktivasiLink();
      await refreshTeacher();
      const status = await licenseService.getStatus(teacher.id);
      setLicenseInfo(status);
      
      if (result.cloudEmail) {
        setTimeout(async () => {
          try {
            toast("⏳ Mengupload data ke cloud...");
            const uploaded = await syncService.initialUpload(result.cloudEmail);
            if (uploaded > 0) {
              toast(`✅ ${uploaded} data berhasil di-upload ke cloud`);
            } else {
              toast("☁️ Cloud sync aktif (tidak ada data untuk di-upload)");
            }
          } catch (error) {
            console.error("Initial upload failed:", error);
            toast("⚠️ Upload gagal, gunakan Sync Now nanti");
          }
          
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }, 1000);
      }
    } else {
      toast(result.message);
    }
  };

  const handleWA = () => {
    const msg = encodeURIComponent(
      "Halo Pak Choyy, saya mau beli lisensi PRO Presensi Yuk | Guru\nEmail: " + (teacher?.email || "")
    );
    window.open(`https://wa.me/6289530713597?text=${msg}`, "_blank");
  };

  const handleRenew = async () => {
    if (!teacher || !kode.trim()) {
      toast("Masukkan kode perpanjangan dulu");
      return;
    }
    setRenewing(true);
    const result = await licenseService.renew(teacher.id, teacher.email, kode.trim());
    setRenewing(false);

    if (result.success) {
      toast(result.message);
      setKode("");
      await refreshTeacher();
      const status = await licenseService.getStatus(teacher.id);
      setLicenseInfo(status);
    } else {
      toast(result.message);
    }
  };

  const handleForceDownload = async () => {
    if (!cloudUser?.email) return;
    const ok = await showConfirmDialog({
      title: "Tarik Data dari Cloud?",
      message: "Semua data lokal akan DITIMPA dengan data dari cloud. Pastikan data di cloud sudah yang terbaru.",
      confirmText: "Ya, Tarik",
      cancelText: "Batal",
      danger: true,
    });
    if (!ok) return;

    setDownloading(true);
    try {
      syncService.resetSyncState();
      const downloaded = await syncService.downloadAll(cloudUser.email);
      await refreshTeacher();
      window.dispatchEvent(new Event("data-changed"));
      toast(
        downloaded > 0
          ? `✅ ${downloaded} data ditarik dari cloud`
          : "⚠️ Tidak ada data baru di cloud untuk ditarik",
        downloaded > 0 ? "success" : "info"
      );
    } catch (error) {
      toast("❌ Gagal tarik data dari cloud", "error");
    } finally {
      setDownloading(false);
    }
  };

  const handleForceUpload = async () => {
    if (!cloudUser?.email) return;
    const ok = await showConfirmDialog({
      title: "Upload Data ke Cloud?",
      message: "Semua data di cloud akan DITIMPA dengan data lokal device ini. Data di device lain akan diganti.",
      confirmText: "Ya, Upload",
      cancelText: "Batal",
      danger: true,
    });
    if (!ok) return;

    setUploading(true);
    try {
      syncService.resetSyncState();
      const uploaded = await syncService.initialUpload(cloudUser.email);
      await refreshTeacher();
      window.dispatchEvent(new Event("data-changed"));
      toast(
        uploaded > 0
          ? `✅ ${uploaded} data diupload ke cloud`
          : "⚠️ Tidak ada data untuk di-upload (semua sudah pernah di-upload?)",
        uploaded > 0 ? "success" : "info"
      );
    } catch (error) {
      toast("❌ Gagal upload data ke cloud", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!teacher) return;
    await licenseService.deactivate(teacher.id);
    toast("Lisensi PRO dinonaktifkan");
    await refreshTeacher();
    setLicenseInfo(null);
  };

  const handleLogoutFromPro = async () => {
    if (!teacher) return;
    const activeLicense = await licenseRepo.getActive(teacher.id);
    if (activeLicense) {
      await licenseRepo.expire(activeLicense.id);
    }
    await teacherRepo.updateTier(teacher.id, Tier.FREE);
    clearCloudEmail();
    toast("Akun PRO berhasil dikeluarkan dari perangkat ini.");
    setShowLogoutConfirm(false);
    setTimeout(() => window.location.reload(), 700);
  };

  const copyKode = () => {
    if (kode) {
      navigator.clipboard.writeText(kode);
      toast("Kode disalin");
    }
  };

  const startEditAjaran = () => {
    if (!activeAy) return;
    setEditLabel(activeAy.label);
    setEditMulai(activeAy.tanggalMulai);
    setEditSelesai(activeAy.tanggalSelesai);
    setEditingAjaran(true);
  };

  const handleSaveAjaran = async () => {
    if (!activeAy || !editMulai || !editSelesai) return;
    setSavingAjaran(true);
    const updated: AcademicYear = {
      ...activeAy,
      label: editLabel,
      tanggalMulai: editMulai,
      tanggalSelesai: editSelesai,
    };
    await academicYearRepo.save(updated);
    setActiveAy(updated);
    setEditingAjaran(false);
    setSavingAjaran(false);
    toast("✅ Periode ajaran berhasil disimpan");
  };

  const handleTambahAjaranBaru = async () => {
    if (!teacher) return;
    if (!activeAy) return;

    const parts = activeAy.label.split("/");
    const nextStart = parseInt(parts[0]) + 1;
    const nextEnd = parseInt(parts[1] || parts[0]) + 1;
    const nextLabel = `${nextStart}/${nextEnd}`;
    const month = new Date().getMonth() + 1;
    const nextSemester = month >= 7 ? Semester.GANJIL : Semester.GENAP;

    const now = Date.now();
    const newAy: AcademicYear = {
      id: generateId(),
      label: nextLabel,
      tanggalMulai: `${nextStart}-07-01`,
      tanggalSelesai: `${nextEnd}-06-30`,
      semesterAktif: nextSemester,
      guruId: teacher.id,
    };

    await academicYearRepo.save(newAy);
    setActiveAy(newAy);
    setEditLabel(newAy.label);
    setEditMulai(newAy.tanggalMulai);
    setEditSelesai(newAy.tanggalSelesai);
    toast(`✅ Ajaran baru "${nextLabel}" dibuat`);
  };

  const manfaat = licenseService.getManfaat();

  const handleDeviceLogin = async () => {
    if (!teacher) {
      toast("❌ Data guru belum dimuat. Muat ulang halaman lalu coba lagi.");
      return;
    }
    
    const emailAddress = (loginEmail || teacher?.email || "").trim().toLowerCase();
    if (!emailAddress || !emailAddress.includes('@')) {
      toast("❌ Email tidak valid");
      return;
    }
    
    setConnecting(true);
    
    try {
      // Cek izin baca ke Supabase (RLS). Kalau di-block, tampilkan pesan nyata.
      const { error: accessErr } = await supabase.from("profiles").select("id").limit(1);
      if (accessErr) {
        console.error("RLS/profiles access error:", accessErr);
        toast("❌ Tidak bisa akses cloud. Cek izin/RLS profile di dashboard. (" + (accessErr.message || "unknown") + ")");
        setConnecting(false);
        return;
      }

      let licenseData: { tanggal_berakhir: number | null } | null = null;
      try {
        const lookup = await licenseService.lookupByEmail(emailAddress);
        if (lookup.found) licenseData = { tanggal_berakhir: lookup.tanggalBerakhir };
      } catch (licenseErr) {
        console.error("license query error:", licenseErr);
      }

      if (!licenseData) {
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("tier")
          .eq("email", emailAddress)
          .maybeSingle();
        if (profileErr) console.error("profile query error:", profileErr);

        if (!profile || profile.tier !== "PRO") {
          toast("❌ Email tidak ditemukan di cloud (belum PRO / belum terdaftar).");
          setConnecting(false);
          return;
        }
      }

      // Pastikan profile ada agar CloudAuthContext mendeteksi cloud connected
      const { data: existingProfile, error: profileCheckErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", emailAddress)
        .maybeSingle();
      if (profileCheckErr) {
        console.error("profile check error:", profileCheckErr);
        toast("❌ Gagal cek profile di cloud: " + (profileCheckErr.message || "unknown"));
        setConnecting(false);
        return;
      }

      let profileId: string | null = null;
      if (existingProfile) {
        const { error: updErr } = await supabase
          .from("profiles")
          .update({ tier: "PRO", updated_at: new Date().toISOString() })
          .eq("id", existingProfile.id);
        if (updErr) {
          console.error("profile update error:", updErr);
          toast("❌ Gagal update profile cloud: " + (updErr.message || "unknown"));
          setConnecting(false);
          return;
        }
        profileId = existingProfile.id;
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from("profiles")
          .insert({
            id: crypto.randomUUID(),
            email: emailAddress,
            name: teacher?.nama || emailAddress.split("@")[0] || "User",
            tier: "PRO",
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (insErr) {
          console.error("profile insert error:", insErr);
          toast("❌ Gagal daftarkan email di cloud: " + (insErr.message || "unknown"));
          setConnecting(false);
          return;
        }
        profileId = inserted?.id ?? null;
      }

      if (profileId) {
        trackDevice(profileId).catch(() => {});
      }
      
      localStorage.setItem("presensi_cloud_email", emailAddress);
      
      try {
        const downloaded = await syncService.downloadAll(emailAddress);
        if (downloaded > 0) {
          toast(`✅ ${downloaded} data berhasil di-download dari cloud`);
        } else {
          toast("✅ Device berhasil terhubung!");
        }
      } catch (error) {
        console.error("Download error:", error);
        toast("⚠️ Download gagal, tapi cloud sync tetap aktif");
      }
      
      const now = Date.now();
      const expiry = licenseData?.tanggal_berakhir || (now + 365 * 24 * 60 * 60 * 1000);
      
      if (!teacher?.id) {
        toast("⚠️ Error: Invalid teacher data");
        return;
      }
      
      const existingLicense = await licenseRepo.getActive(teacher.id);
      if (!existingLicense) {
        const license: License = {
          id: generateId(),
          guruId: teacher.id,
          emailAktivasi: emailAddress,
          kodeLisensi: "DEVICE-CONNECTED",
          tanggalAktivasi: now,
          tanggalBerakhir: expiry,
          statusLisensi: "Aktif",
        };
        await licenseRepo.save(license);
      }

      await teacherRepo.update(teacher.id, {
        ...teacher,
        tier: Tier.PRO,
        email: emailAddress,
      });
      
      await refreshTeacher();
      
      setConnecting(false);
      toast("✅ Device berhasil terhubung!");
      window.location.reload();
    } catch (error) {
      console.error("Device login error:", error);
      toast("❌ Gagal menghubungkan. Coba lagi.");
      setConnecting(false);
    }
  };

  const handleSaveSekolah = async () => {
    if (!school || !editNamaSekolah.trim()) {
      toast("Nama sekolah tidak boleh kosong");
      return;
    }
    
    setSavingSekolah(true);
    
    try {
      await schoolRepo.save({
        ...school,
        nama: editNamaSekolah.trim(),
        jenjang: editJenjang,
        diubahPada: Date.now()
      });
      
      toast("✅ Nama sekolah diperbarui");
      setEditSekolah(false);
      
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      toast("❌ Gagal menyimpan. Coba lagi.");
    } finally {
      setSavingSekolah(false);
    }
  };

  const isExpiring = licenseInfo?.isExpiring;
  const daysRemaining = licenseInfo?.daysRemaining;

  return (
    <div className="flex-1 px-[14px] pt-[14px] pb-[90px] lg:pb-4">
      {/* Status Tier */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
        <div className="text-[0.8rem] font-bold flex items-center gap-[6px] mb-[10px]">
          <Settings size={15} /> Pengaturan Akun
        </div>

        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-[0.9rem]"
            style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb,#1d4ed8)" }}
          >
            {teacher?.nama?.charAt(0)?.toUpperCase() || "G"}
          </div>
          <div>
            <div className="text-[0.85rem] font-bold text-[var(--text)]">{teacher?.nama}</div>
            <div className="text-[0.7rem] text-[var(--text-light)]">{teacher?.email}</div>
          </div>
          <div className="ml-auto">
            {isPRO ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[0.65rem] font-bold bg-[#2563eb]/10 text-[#2563eb] border border-[#2563eb]/20">
                <Crown size={11} /> PRO
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[0.65rem] font-bold bg-[var(--input-bg)] text-[var(--text-light)] border border-[var(--border)]">
                FREE
              </span>
            )}
          </div>
        </div>
        <div className="text-[0.72rem] text-[var(--text-light)] flex items-center gap-2">
          Sekolah: {school?.nama || "-"} ({school?.jenjang || "-"})
          <button
            onClick={() => { setEditSekolah(true); setEditNamaSekolah(school?.nama || ""); setEditJenjang(school?.jenjang || Jenjang.SD); }}
            className="text-[#2563eb] bg-transparent border-none cursor-pointer p-0"
          >
            <PenLine size={13} />
          </button>
        </div>
      </div>

      {editSekolah && (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
          <div className="text-[0.78rem] font-bold flex items-center gap-[6px] mb-[10px]">
            <School size={15} /> Edit Sekolah
          </div>
          <div className="mb-3">
            <label className="block text-[0.68rem] font-bold text-[var(--text-light)] mb-[5px] uppercase">Nama Sekolah</label>
            <input
              type="text"
              value={editNamaSekolah}
              onChange={(e) => setEditNamaSekolah(e.target.value)}
              className="w-full px-[11px] py-[9px] border-[1.5px] border-[var(--border)] rounded-[9px] text-[0.85rem] bg-[var(--input-bg)] outline-none focus:border-[#2563eb] font-[inherit]"
            />
          </div>
          <div className="mb-3">
            <label className="block text-[0.68rem] font-bold text-[var(--text-light)] mb-[5px] uppercase">Jenjang</label>
            <div className="grid grid-cols-3 gap-2">
              {[Jenjang.SD, Jenjang.SMP, Jenjang.SMA].map((j) => (
                <button
                  key={j}
                  onClick={() => setEditJenjang(j)}
                  className={`py-[10px] rounded-[8px] border-[1.5px] text-[0.78rem] font-bold cursor-pointer ${
                    editJenjang === j ? "border-[#2563eb] bg-[rgba(14,165,160,0.1)] text-[#2563eb]" : "border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-light)]"
                  }`}
                >
                  {j}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditSekolah(false)} className="flex-1 py-[10px] rounded-[10px] border-[1.5px] border-[var(--border)] bg-[var(--card-bg)] text-[var(--text)] font-bold text-[0.8rem] cursor-pointer">Batal</button>
            <button onClick={handleSaveSekolah} disabled={savingSekolah} className="flex-1 py-[10px] rounded-[10px] text-white font-bold text-[0.8rem] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-opacity" style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb,#1d4ed8)" }}>{savingSekolah ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </div>
      )}

      {/* Lokasi & Jam Sekolah (geofencing presensi guru) */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
        <div className="text-[0.8rem] font-bold flex items-center gap-[6px] mb-[12px]">
          <MapPin size={15} className="text-[#2563eb]" /> Lokasi &amp; Jam Sekolah
        </div>

        <div className="text-[0.68rem] text-[var(--text-light)] mb-3 leading-relaxed">
          Set koordinat sekolah untuk <b>geofencing</b> saat guru clock-in/out.
          Guru akan dianggap <b>FAR</b> (di luar radius) kalau presensi lebih dari radius di bawah dari lokasi ini.
        </div>

        {/* Lat / Lng */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="block text-[0.65rem] font-bold text-[var(--text-light)] mb-1 uppercase">Latitude</label>
            <input
              type="text"
              value={editLat}
              onChange={(e) => setEditLat(e.target.value)}
              placeholder="-7.2504"
              className="w-full px-[8px] py-[8px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.8rem] bg-[var(--input-bg)] outline-none focus:border-[#2563eb] font-[inherit]"
            />
          </div>
          <div>
            <label className="block text-[0.65rem] font-bold text-[var(--text-light)] mb-1 uppercase">Longitude</label>
            <input
              type="text"
              value={editLng}
              onChange={(e) => setEditLng(e.target.value)}
              placeholder="112.7688"
              className="w-full px-[8px] py-[8px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.8rem] bg-[var(--input-bg)] outline-none focus:border-[#2563eb] font-[inherit]"
            />
          </div>
        </div>

        <button
          onClick={async () => {
            const c = await requestGps();
            if (c) {
              setEditLat(c.lat.toFixed(6));
              setEditLng(c.lng.toFixed(6));
              toast(`📍 Lokasi: ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)} (±${Math.round(c.accuracy)}m)`);
            }
          }}
          disabled={gettingGps}
          className="w-full flex items-center justify-center gap-[6px] py-[9px] mb-2 rounded-[10px] border-[1.5px] border-[#2563eb] text-[#2563eb] font-bold text-[0.78rem] bg-transparent active:scale-95 disabled:opacity-50"
        >
          <Target size={14} /> {gettingGps ? "Mengambil lokasi..." : "Ambil Lokasi Saat Ini (GPS)"}
        </button>

        {gpsError && (
          <div className="text-[0.65rem] text-[#dc2626] mb-2">⚠️ {gpsError}</div>
        )}

        {/* Radius */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[0.65rem] font-bold text-[var(--text-light)] uppercase">Radius Geofence</label>
            <span className="text-[0.78rem] font-bold text-[#2563eb]">{editRadius} m</span>
          </div>
          <input
            type="range"
            min={50}
            max={500}
            step={10}
            value={editRadius}
            onChange={(e) => setEditRadius(Number(e.target.value))}
            className="w-full accent-[#2563eb]"
          />
          <div className="flex justify-between text-[0.6rem] text-[var(--text-light)]">
            <span>50m</span><span>250m</span><span>500m</span>
          </div>
        </div>

        {/* Jam Kerja Guru — masuk → pulang */}
        <label className="block text-[0.65rem] font-bold text-[var(--text-light)] mb-1 uppercase">
          <Clock size={11} className="inline mr-1" /> Jam Kerja Guru (masuk → pulang){zonaWaktu() && ` · ${zonaWaktu()}`}
        </label>
        <div className="flex items-center gap-2 mb-1">
          <input
            type="time"
            value={editJamMasuk}
            onChange={(e) => setEditJamMasuk(e.target.value)}
            aria-label="Jam masuk"
            className="flex-1 px-[8px] py-[8px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.85rem] bg-[var(--input-bg)] outline-none focus:border-[#2563eb] font-[inherit]"
          />
          <span className="text-[var(--text-light)] font-bold text-[0.85rem]">→</span>
          <input
            type="time"
            value={editJamPulang}
            onChange={(e) => setEditJamPulang(e.target.value)}
            aria-label="Jam pulang"
            className="flex-1 px-[8px] py-[8px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.85rem] bg-[var(--input-bg)] outline-none focus:border-[#2563eb] font-[inherit]"
          />
        </div>
        <div className="text-[0.6rem] text-[var(--text-light)] mb-2">
          Jam mengikuti jam HP, jadi otomatis sesuai daerah (WIB / WITA / WIT).
        </div>

        <label className="block text-[0.65rem] font-bold text-[var(--text-light)] mb-1 uppercase">
          Presensi masuk dibuka → batas tepat waktu
        </label>
        <div className="flex items-center gap-2 mb-1">
          <input type="time" value={editMulaiMasuk} onChange={(e) => e.target.value && setEditMulaiMasuk(e.target.value)} aria-label="Presensi masuk dibuka" className="flex-1 px-[8px] py-[8px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.85rem] bg-[var(--input-bg)] outline-none focus:border-[#2563eb] font-[inherit]" />
          <span className="text-[var(--text-light)] font-bold text-[0.85rem]">→</span>
          <input
            type="time"
            value={geserMenit(editJamMasuk, editToleransi)}
            onChange={(e) => {
              const selisih = keMenit(e.target.value) - keMenit(editJamMasuk);
              if (e.target.value && selisih >= 0) setEditToleransi(selisih);
            }}
            aria-label="Batas presensi masuk"
            className="flex-1 px-[8px] py-[8px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.85rem] bg-[var(--input-bg)] outline-none focus:border-[#2563eb] font-[inherit]"
          />
        </div>
        <div className="text-[0.6rem] text-[var(--text-light)] mb-2">
          Presensi masuk bisa mulai jam {editMulaiMasuk}. Sampai jam {geserMenit(editJamMasuk, editToleransi)} dihitung Tepat Waktu, lewat dari itu Terlambat.
        </div>

        <label className="block text-[0.65rem] font-bold text-[var(--text-light)] mb-1 uppercase">
          Presensi pulang ditutup jam
        </label>
        <div className="flex items-center gap-2 mb-1">
          <span className="flex-1 px-[8px] py-[8px] text-[0.85rem] text-[var(--text-light)]">{editJamPulang} →</span>
          <input type="time" value={editBatasPulang} onChange={(e) => e.target.value && setEditBatasPulang(e.target.value)} aria-label="Presensi pulang ditutup" className="flex-1 px-[8px] py-[8px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.85rem] bg-[var(--input-bg)] outline-none focus:border-[#2563eb] font-[inherit]" />
        </div>
        <div className="text-[0.6rem] text-[var(--text-light)] mb-2">
          Presensi pulang sebelum jam {editJamPulang} dicatat Pulang Cepat. Presensi boleh diulang, yang terakhir dihitung.
        </div>

        <div className="mb-3" />

        {/* Isi Hadir Otomatis — tetap pertahankan untuk fallback */}
        <div className="flex items-center justify-between py-[6px] border-t border-[var(--border)] pt-3">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <Check size={14} className="text-[#16a34a] mt-[2px] flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[0.78rem] font-semibold text-[var(--text)]">Isi Hadir Otomatis</div>
              <div className="text-[0.65rem] text-[var(--text-light)]">Default status hari = Hadir untuk guru yang clock-in</div>
            </div>
          </div>
          <button
            onClick={() => {
              const newVal = !autoHadir;
              setAutoHadir(newVal);
              localStorage.setItem("bgy_auto_hadir", newVal ? "1" : "0");
              toast(newVal ? "✅ Isi Hadir Otomatis: ON" : "Isi Hadir Otomatis: OFF");
            }}
            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer border-none flex-shrink-0 ${
              autoHadir ? "bg-[#2563eb]" : "bg-[var(--border)]"
            }`}
          >
            <span
              className={`absolute top-[2px] left-[2px] w-5 h-5 rounded-full bg-white transition-transform shadow ${
                autoHadir ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Save */}
        <button
          onClick={async () => {
            if (!school) { toast("Sekolah belum siap"); return; }
            const lat = parseFloat(editLat);
            const lng = parseFloat(editLng);
            if (isNaN(lat) || isNaN(lng)) { toast("Lat/Lng tidak valid"); return; }
            if (!/^\d{2}:\d{2}$/.test(editJamMasuk) || !/^\d{2}:\d{2}$/.test(editJamPulang)) {
              toast("Format jam tidak valid"); return;
            }
            setSavingLokasi(true);
            try {
              const baru = {
                ...school,
                lat,
                lng,
                radiusMeter: editRadius,
                jamMasukStandar: editJamMasuk,
                jamPulangStandar: editJamPulang,
                toleransiTerlambatMenit: editToleransi,
                mulaiPresensiMasuk: editMulaiMasuk,
                batasPresensiPulang: editBatasPulang,
                diubahPada: Date.now(),
              };
              await schoolRepo.save(baru);
              // Segarkan context, kalau tidak layar presensi guru masih pakai
              // koordinat lama sampai app di-reload.
              await refreshSchool();
              // HP guru membaca titik/radius/jam dari cloud.
              const keCloud = await adminCloud.daftarkanSekolah(baru, teacher).catch(() => null);
              toast(keCloud ? "✅ Disimpan & dikirim ke HP guru" : "✅ Lokasi & jam sekolah disimpan");
            } catch {
              toast("❌ Gagal menyimpan");
            } finally {
              setSavingLokasi(false);
            }
          }}
          disabled={savingLokasi}
          className="w-full flex items-center justify-center gap-[6px] py-[10px] mt-3 rounded-[10px] text-white font-bold text-[0.8rem] disabled:opacity-50 active:scale-95"
          style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb,#1d4ed8)" }}
        >
          <Save size={14} /> {savingLokasi ? "Menyimpan..." : "Simpan Lokasi & Jam"}
        </button>
      </div>

      {/* Cloud Sync — Simplified (PRO only) */}
      {isPRO && isCloudConnected && (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Smartphone size={15} className="text-[#2563eb]" />
              <span className="text-[0.8rem] font-bold text-[var(--text)]">
                Cloud Sync — {devices.length} Device
              </span>
            </div>
          </div>
          
          {devices.length > 0 && (
            <div className="mb-3 space-y-1">
              {devices.slice(0, 3).map((device: any) => (
                <div key={device.id} className="text-[0.68rem] text-[var(--text-light)] flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-[#2563eb]"></div>
                  {device.device_name} • {formatRelativeTime(device.last_active_at)}
                  {device.device_id === thisDeviceId && (
                    <span className="ml-auto text-[0.58rem] font-bold bg-[#2563eb]/20 text-[#2563eb] px-1.5 py-0.5 rounded-full">
                      Device ini
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mb-3 space-y-1 text-[0.68rem]">
            <div className="text-[var(--text-light)]">Terhubung sebagai: {cloudUser?.email}</div>
          </div>

          {syncLog && ((syncLog.uploaded || 0) > 0 || (syncLog.downloaded || 0) > 0 || !syncLog.ok) && (
            <div
              className={`mb-3 text-[0.68rem] p-2 rounded-lg border ${
                syncLog.ok
                  ? "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-900 dark:text-green-200"
                  : "bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200"
              }`}
            >
              {syncLog.ok
                ? `✅ ${syncLog.action === "upload" ? "Upload" : syncLog.action === "download" ? "Tarik" : "Sync"} OK` +
                  (syncLog.uploaded ? ` · ${syncLog.uploaded} ter-upload` : "") +
                  (syncLog.downloaded ? ` · ${syncLog.downloaded} ter-download` : "") +
                  formatSyncDetail(syncLog.detail)
                : `❌ ${syncLog.action === "upload" ? "Upload" : syncLog.action === "download" ? "Tarik" : "Sync"} gagal: ${syncLog.error || "error tidak diketahui"}`}
            </div>
          )}

          <div className="text-[0.68rem] text-blue-800 dark:text-blue-200 mb-3 p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            ✨ <b>Sync Otomatis Aktif</b><br />
            Data otomatis tersinkronisasi antar device saat kamu edit atau buka app (maksimal 5 menit delay).
          </div>

          {/* Tombol darurat tersembunyi */}
          <button
            onClick={() => setShowEmergencyTools(!showEmergencyTools)}
            className="w-full text-[0.68rem] text-gray-500 dark:text-gray-400 py-2 mb-2 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/30"
          >
            {showEmergencyTools ? "▼" : "▶"} Alat Sinkronisasi Darurat (hanya jika ada masalah)
          </button>

          {showEmergencyTools && (
            <div className="mb-3">
              <div className="text-[0.68rem] text-red-800 dark:text-red-200 mb-2 p-2 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-300 dark:border-red-800">
                ⚠️ <b>PERINGATAN:</b> Gunakan hanya jika data benar-benar berbeda antar device!<br />
                • <b>Upload Cloud</b> = kirim data device ini ke cloud (overwrite jika lebih baru)<br />
                • <b>Tarik Cloud</b> = ambil data cloud ke device ini (merge dengan lokal)
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleForceUpload}
                  disabled={uploading}
                  className="flex items-center justify-center gap-[6px] py-[8px] rounded-[9px] bg-[#2563eb] text-white font-bold text-[0.75rem] cursor-pointer disabled:opacity-50"
                >
                  <Upload size={13} className={uploading ? "animate-bounce" : ""} />
                  {uploading ? "Upload..." : "Upload Cloud"}
                </button>
                <button
                  onClick={handleForceDownload}
                  disabled={downloading}
                  className="flex items-center justify-center gap-[6px] py-[8px] rounded-[9px] border-[1.5px] border-[#3b82f6] text-[#3b82f6] font-bold text-[0.75rem] cursor-pointer disabled:opacity-50 bg-sky-500/10"
                >
                  <Download size={13} className={downloading ? "animate-bounce" : ""} />
                  {downloading ? "Menarik..." : "Tarik Cloud"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cloud Sync Setup (PRO only, not connected) */}
      {isPRO && !isCloudConnected && (
        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800 p-[14px] mb-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
            <span className="text-[0.75rem] font-bold text-amber-900 dark:text-amber-100">
              Aktifkan Sync Antar Device
            </span>
          </div>
          <div className="text-[0.68rem] text-amber-700 dark:text-amber-300 mb-3">
            Cukup lakukan <b>sekali</b>. Setelah itu data otomatis tersinkronisasi ke cloud.
          </div>
          <div className="mb-2">
            <input
              type="email"
              value={loginEmail || teacher?.email || ""}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full px-[10px] py-[9px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.82rem] text-[var(--text)] bg-[var(--input-bg)] outline-none focus:border-[#2563eb] font-[inherit]"
            />
          </div>
          <button
            onClick={handleDeviceLogin}
            disabled={connecting || !(loginEmail || teacher?.email)}
            className="w-full flex items-center justify-center gap-[6px] py-[10px] rounded-[10px] border-[1.5px] border-[#2563eb] text-[#2563eb] font-bold text-[0.82rem] cursor-pointer disabled:opacity-60 bg-transparent"
          >
            <Upload size={15} />
            {connecting ? "Menghubungkan..." : "Hubungkan Sekarang"}
          </button>
        </div>
      )}

      {/* Logo Sekolah (PRO only) */}
      {isPRO && (
        <LogoUpload editable={true} />
      )}

      {/* Periode Ajaran */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
        <div className="text-[0.8rem] font-bold flex items-center gap-[6px] mb-[10px]">
          <Calendar size={15} /> Periode Ajaran
        </div>
        <div className="text-[0.72rem] text-[var(--text-light)] mb-3">
          Atur tanggal mulai dan selesai tahun ajaran untuk menghitung rekap kehadiran.
        </div>

        {editingAjaran ? (
          <>
            <div className="mb-2">
              <label className="block text-[0.65rem] font-bold text-[var(--text-light)] mb-1 uppercase">Label</label>
              <input
                type="text"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                className="w-full px-[10px] py-[9px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.82rem] text-[var(--text)] bg-[var(--input-bg)] outline-none focus:border-[#2563eb] font-[inherit]"
              />
            </div>
            <div className="flex gap-2 mb-2">
              <div className="flex-1">
                <label className="block text-[0.65rem] font-bold text-[var(--text-light)] mb-1 uppercase">Tanggal Mulai</label>
                <input
                  type="date"
                  value={editMulai}
                  onChange={(e) => setEditMulai(e.target.value)}
                  className="w-full px-[10px] py-[9px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.82rem] text-[var(--text)] bg-[var(--input-bg)] outline-none focus:border-[#2563eb] font-[inherit]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[0.65rem] font-bold text-[var(--text-light)] mb-1 uppercase">Tanggal Selesai</label>
                <input
                  type="date"
                  value={editSelesai}
                  onChange={(e) => setEditSelesai(e.target.value)}
                  className="w-full px-[10px] py-[9px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.82rem] text-[var(--text)] bg-[var(--input-bg)] outline-none focus:border-[#2563eb] font-[inherit]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveAjaran}
                disabled={savingAjaran}
                className="flex-1 py-[9px] rounded-[10px] bg-[#2563eb] text-white font-bold text-[0.78rem] border-none cursor-pointer disabled:opacity-50"
              >
                {savingAjaran ? "Menyimpan..." : "Simpan"}
              </button>
              <button
                onClick={() => setEditingAjaran(false)}
                className="flex-1 py-[9px] rounded-[10px] border border-[var(--border)] text-[var(--text)] font-bold text-[0.78rem] cursor-pointer bg-transparent"
              >
                Batal
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1 mb-3 text-[0.74rem]">
              <div className="flex gap-2">
                <span className="text-[var(--text-light)] min-w-[80px]">Label:</span>
                <span className="text-[var(--text)] font-semibold">{activeAy?.label || "-"}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-[var(--text-light)] min-w-[80px]">Mulai:</span>
                <span className="text-[var(--text)]">{activeAy?.tanggalMulai || "-"}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-[var(--text-light)] min-w-[80px]">Selesai:</span>
                <span className="text-[var(--text)]">{activeAy?.tanggalSelesai || "-"}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-[var(--text-light)] min-w-[80px]">Semester:</span>
                <span className="text-[var(--text)] font-semibold">{activeAy?.semesterAktif || "-"}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={startEditAjaran}
                className="flex-1 py-[9px] rounded-[10px] border border-[var(--border)] text-[var(--text)] font-bold text-[0.78rem] cursor-pointer bg-transparent flex items-center justify-center gap-1"
              >
                <PenLine size={13} /> Edit
              </button>
              <button
                onClick={handleTambahAjaranBaru}
                className="flex-1 py-[9px] rounded-[10px] bg-[#2563eb] text-white font-bold text-[0.78rem] border-none cursor-pointer flex items-center justify-center gap-1"
              >
                <Plus size={13} /> Ajaran Baru
              </button>
            </div>
          </>
        )}
      </div>

      {/* Hari Aktif */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
        <div className="text-[0.8rem] font-bold flex items-center gap-[6px] mb-[10px]">
          <Calendar size={15} /> Hari Aktif
        </div>
        <div className="text-[0.72rem] text-[var(--text-light)] mb-3">
          Pilih hari yang masuk presensi. Hari tidak aktif akan ditandai merah di kalender.
        </div>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => saveHariAktifSettings("Senin-Jumat", "1,2,3,4,5")}
            className={`flex-1 py-[10px] rounded-[10px] text-[0.78rem] font-bold border-[1.5px] cursor-pointer ${
              hariAktif === "Senin-Jumat"
                ? "border-[#2563eb] bg-[rgba(14,165,160,0.1)] text-[#2563eb]"
                : "border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-light)]"
            }`}
          >
            Senin - Jumat
          </button>
          <button
            onClick={() => saveHariAktifSettings("Senin-Sabtu", "1,2,3,4,5,6")}
            className={`flex-1 py-[10px] rounded-[10px] text-[0.78rem] font-bold border-[1.5px] cursor-pointer ${
              hariAktif === "Senin-Sabtu"
                ? "border-[#2563eb] bg-[rgba(14,165,160,0.1)] text-[#2563eb]"
                : "border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-light)]"
            }`}
          >
            Senin - Sabtu
          </button>
          <button
            onClick={() => saveHariAktifSettings("Kustom", customDays || "1,2,3,4,5,6")}
            className={`flex-1 py-[10px] rounded-[10px] text-[0.78rem] font-bold border-[1.5px] cursor-pointer ${
              hariAktif === "Kustom"
                ? "border-[#2563eb] bg-[rgba(14,165,160,0.1)] text-[#2563eb]"
                : "border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-light)]"
            }`}
          >
            Custom
          </button>
        </div>

        {hariAktif === "Kustom" && (
          <div className="mb-3">
            <div className="grid grid-cols-7 gap-1.5">
              {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((label, i) => {
                const active = customDays?.split(",").map(Number).includes(i) || false;
                return (
                  <button
                    key={i}
                    onClick={() => {
                      const current = customDays ? customDays.split(",").map(Number) : [];
                      const next = current.includes(i) ? current.filter((d) => d !== i) : [...current, i];
                      const sorted = next.sort((a, b) => a - b);
                      const joined = sorted.join(",");
                      setCustomDays(joined);
                      localStorage.setItem("bgy_hari_aktif_custom", joined);
                    }}
                    className={`py-2 rounded-lg text-[0.72rem] font-bold border-[1.5px] cursor-pointer transition-all ${
                      active
                        ? "border-[#2563eb] bg-[#2563eb] text-white shadow-sm"
                        : "border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-light)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="text-[0.65rem] text-[var(--text-light)]">
          {hariAktif === "Senin-Jumat" && "Sabtu & Minggu: tidak masuk presensi, merah di kalender"}
          {hariAktif === "Senin-Sabtu" && "Minggu: tidak masuk presensi, merah di kalender"}
          {hariAktif === "Kustom" && "Hari yang tidak aktif: tidak masuk presensi, merah di kalender"}
        </div>
      </div>

      {/* PRO Section */}
      {isPRO ? (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
          <div className="text-[0.8rem] font-bold flex items-center gap-[6px] mb-[10px]">
            <Crown size={15} className="text-[#f59e0b]" /> Lisensi PRO Aktif
          </div>

          {licenseInfo ? (
            <>
              <div className="mb-3 space-y-1 text-[0.74rem]">
                <div className="flex gap-2">
                  <Mail size={13} className="text-[var(--text-light)] flex-shrink-0 mt-[1px]" />
                  <span className="text-[var(--text)]">{licenseInfo.email}</span>
                </div>
                <div className="flex gap-2">
                  <CalendarCheck size={13} className="text-[var(--text-light)] flex-shrink-0 mt-[1px]" />
                  <span className="text-[var(--text)]">
                    Berlaku sampai <b>{licenseInfo.berakhir}</b>
                  </span>
                </div>
                {daysRemaining !== undefined && (
                  <div className="flex gap-2">
                    <Clock size={13} className="text-[var(--text-light)] flex-shrink-0 mt-[1px]" />
                    <span className={isExpiring ? "text-[#b45309] font-semibold" : "text-[var(--text)]"}>
                      {daysRemaining} hari tersisa
                    </span>
                  </div>
                )}
              </div>

              {isExpiring && daysRemaining !== undefined && (
                <div className="bg-[#fef3c7] rounded-lg p-3 mb-3 border border-[#fbbf24] flex items-start gap-2">
                  <AlertTriangle size={14} className="text-[#b45309] flex-shrink-0 mt-[1px]" />
                  <div className="text-[0.7rem] text-[#78350f] flex-1">
                    {daysRemaining === 0
                      ? "Lisensi akan habis hari ini! Perpanjang sekarang agar fitur PRO tetap aktif."
                      : `Lisensi akan habis dalam ${daysRemaining} hari. Perpanjang sekarang agar tidak terputus.`}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-[0.74rem] text-[var(--text-light)] mb-3">
              Memuat info lisensi...
            </div>
          )}

          <div className="border-t border-[var(--border)] pt-3 mb-3">
            <div className="text-[0.72rem] font-bold text-[var(--text)] mb-2">
              Perpanjang Lisensi
            </div>
            <div className="mb-2">
              <label className="block text-[0.65rem] font-bold text-[var(--text-light)] mb-1 uppercase">
                <Key size={11} className="inline mr-1" /> Kode Perpanjangan
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={kode}
                  onChange={(e) => setKode(e.target.value)}
                  placeholder="BGY-PS-XXXX"
                  className="flex-1 px-[10px] py-[9px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.82rem] text-[var(--text)] bg-[var(--input-bg)] outline-none focus:border-[#2563eb] font-[inherit] uppercase"
                />
                {kode && (
                  <button
                    onClick={copyKode}
                    className="px-2 py-[9px] rounded-[8px] border-[1.5px] border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-light)] cursor-pointer"
                  >
                    <Copy size={14} />
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={handleRenew}
              disabled={renewing || !kode.trim()}
              className="w-full flex items-center justify-center gap-[6px] py-[10px] rounded-[10px] text-white font-bold text-[0.82rem] cursor-pointer disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb,#1d4ed8)" }}
            >
              <ArrowUpCircle size={15} />
              {renewing ? "Memperpanjang..." : "Perpanjang 1 Tahun"}
            </button>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 mb-3 border border-blue-200 dark:border-blue-800 flex items-start gap-2">
            <Info size={14} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-[1px]" />
            <div className="text-[0.7rem] text-blue-900 dark:text-blue-100">
              <b>Fitur PRO Aktif:</b> Unlimited kelas & siswa, kalender custom, logo laporan, update Excel, cloud sync otomatis, multi-device (max 3), backup cloud harian.
            </div>
          </div>

          <button
            onClick={handleDeactivate}
            className="w-full py-[9px] rounded-[10px] border-[1.5px] border-[#ef4444] text-[#ef4444] font-bold text-[0.78rem] cursor-pointer bg-transparent"
          >
            Nonaktifkan Lisensi
          </button>
        </div>
      ) : (
        /* FREE / Upgrade */
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
          <div className="text-[0.8rem] font-bold flex items-center gap-[6px] mb-[10px]">
            <ArrowUpCircle size={15} className="text-[#2563eb]" /> Upgrade ke PRO
          </div>

          <div className="bg-[rgba(14,165,160,0.06)] rounded-lg p-2 mb-3 text-[0.72rem] text-[var(--text)] flex items-start gap-2">
            <Info size={13} className="text-[#2563eb] flex-shrink-0 mt-[2px]" />
            <span>Sudah pernah beli? Masukkan email & kode yang sama untuk aktivasi ulang.</span>
          </div>

          <div className="bg-gradient-to-br from-[#2563eb]/8 to-[#1d4ed8]/12 rounded-xl p-4 mb-3 border-2 border-[#2563eb]/20 text-center"
            style={{
              background: "linear-gradient(135deg, rgba(14,165,160,0.06), rgba(13,122,138,0.10))",
            }}>
            <Crown size={24} className="text-[#2563eb] mx-auto mb-1" />
            <div className="text-[1rem] font-bold text-[var(--text)] mb-1">
              Akses Penuh Semua Fitur Premium
            </div>
            <div className="text-[0.75rem] text-[var(--text-light)] mb-2">
              Kelola semua kelas, cloud sync, backup otomatis & banyak lagi
            </div>
            <div className="text-[1.6rem] font-black text-[#2563eb] leading-tight">
              {PRO_PRICE}
            </div>
            <div className="text-[0.65rem] text-[var(--text-light)] mt-1">
              per tahun
            </div>
          </div>

          <div className="mb-3">
            {manfaat.map((m, i) => (
              <div key={i} className="flex items-start gap-2 mb-1 text-[0.74rem] text-[var(--text)]">
                <Check size={14} className="text-[#16a34a] flex-shrink-0 mt-[2px]" />
                <span>{m}</span>
              </div>
            ))}
          </div>

          <div className="mb-3">
            <a
              href="https://kreacy.my.id/produk/8nonq6ro"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center py-[10px] rounded-[10px] text-white font-bold text-[0.82rem] cursor-pointer no-underline"
              style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb,#1d4ed8)" }}
            >
              Beli Disini
            </a>
          </div>
          <div className="mb-3">
            <button
              onClick={handleWA}
              className="w-full flex items-center justify-center gap-[6px] py-[9px] rounded-[10px] text-white font-bold text-[0.78rem] cursor-pointer"
              style={{ background: "#25D366" }}
            >
              <MessageCircle size={14} /> Atau via WhatsApp
            </button>
          </div>

          <div className="border-t border-[var(--border)] pt-3">
            <div className="text-[0.72rem] font-bold text-[var(--text)] mb-2 flex items-center gap-[4px]">
              <Key size={13} /> Dapatkan Kode Lisensi
            </div>

            <div className="mb-2">
              <label className="block text-[0.65rem] font-bold text-[var(--text-light)] mb-1 uppercase">
                <Mail size={11} className="inline mr-1" /> Email
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full px-[10px] py-[9px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.82rem] text-[var(--text)] bg-[var(--input-bg)] outline-none focus:border-[#2563eb] font-[inherit]"
              />
            </div>
            <div className="mb-3">
              <label className="block text-[0.65rem] font-bold text-[var(--text-light)] mb-1 uppercase">
                <Key size={11} className="inline mr-1" /> Kode Lisensi
              </label>
              <input
                type="text"
                value={kode}
                onChange={(e) => setKode(e.target.value)}
                placeholder="BGY-PS-XXXX"
                className="w-full px-[10px] py-[9px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.82rem] text-[var(--text)] bg-[var(--input-bg)] outline-none focus:border-[#2563eb] font-[inherit] uppercase"
              />
            </div>
            <button
              onClick={handleActivate}
              disabled={activating || !kode.trim() || !email.trim()}
              className="w-full flex items-center justify-center gap-[6px] py-[10px] rounded-[10px] text-white font-bold text-[0.82rem] cursor-pointer disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb,#1d4ed8)" }}
            >
              <ArrowUpCircle size={15} />
              {activating ? "Mengaktivasi..." : "Aktivasi Sekarang"}
            </button>
          </div>
          
          {/* Login Device Lain */}
          <div className="border-t border-[var(--border)] pt-4 mt-4">
            <div className="text-[0.72rem] font-bold text-[var(--text)] mb-2 flex items-center gap-[4px]">
              <Upload size={13} /> Sudah PRO di Device Lain?
            </div>
            <div className="text-[0.68rem] text-[var(--text-light)] mb-3">
              Hubungkan device ini dengan email yang sudah terdaftar PRO untuk sinkronisasi data.
            </div>
            <div className="mb-2">
              <label className="block text-[0.65rem] font-bold text-[var(--text-light)] mb-1 uppercase">
                <Mail size={11} className="inline mr-1" /> Email PRO Anda
              </label>
              <input
                type="email"
                value={loginEmail || teacher?.email || ""}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full px-[10px] py-[9px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.82rem] text-[var(--text)] bg-[var(--input-bg)] outline-none focus:border-[#2563eb] font-[inherit]"
              />
            </div>
            <button
              onClick={handleDeviceLogin}
              disabled={connecting || !(loginEmail || teacher?.email)}
              className="w-full flex items-center justify-center gap-[6px] py-[10px] rounded-[10px] border-[1.5px] border-[#2563eb] text-[#2563eb] font-bold text-[0.82rem] cursor-pointer disabled:opacity-60 bg-transparent"
            >
              <Upload size={15} />
              {connecting ? "Menghubungkan..." : "Hubungkan Device"}
            </button>
          </div>
        </div>
      )}

      {/* Perbandingan Gratis vs PRO (khusus FREE) */}
      {!isPRO && (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px]">
          <div className="text-[0.75rem] font-bold text-[var(--text)] mb-2">
            Perbandingan Gratis vs PRO
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[0.7rem] border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="py-2 px-2 text-left text-[0.62rem] uppercase text-[var(--text-light)] font-semibold">Fitur</th>
                  <th className="py-2 px-2 text-center text-[0.62rem] uppercase text-[var(--text-light)] font-semibold">Gratis</th>
                  <th className="py-2 px-2 text-center text-[0.62rem] uppercase text-[#2563eb] font-bold">PRO</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { fitur: "Bisa kelola kelas", free: "1 Kelas", pro: "Semua Kelas" },
                  { fitur: "Jumlah siswa per kelas", free: `${MAX_STUDENTS_FREE} siswa`, pro: "Unlimited" },
                  { fitur: "Buka di HP & laptop", free: "Tidak", pro: "Bisa" },
                  { fitur: "Data aman di internet", free: "Tidak", pro: "Bisa" },
                  { fitur: "Atur kalender sendiri", free: "Lihat saja", pro: "Bisa atur" },
                  { fitur: "Backup ke internet", free: "Tidak", pro: "Bisa" },
                  { fitur: "Logo di laporan", free: "Tidak", pro: "Bisa" },
                  { fitur: "Update data Excel", free: "Tidak", pro: "Bisa" },
                  { fitur: "Harga", free: "Gratis", pro: PRO_PRICE },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2 px-2 font-semibold">{row.fitur}</td>
                    <td className="py-2 px-2 text-center text-[var(--text-light)]">{row.free}</td>
                    <td className="py-2 px-2 text-center text-[#2563eb] font-bold">{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Keluar dari Akun PRO (PRO only) */}
      {isPRO && (
        <div className="mt-3">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-[6px] py-[10px] rounded-[10px] border-[1.5px] border-[#ef4444] text-[#ef4444] font-bold text-[0.8rem] cursor-pointer bg-transparent"
          >
            <LogOut size={15} /> Keluar dari Akun PRO di Perangkat Ini
          </button>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-end lg:items-center justify-center animate-fade-in" onClick={() => setShowLogoutConfirm(false)}>
          <div className="bg-[var(--card-bg)] rounded-t-2xl lg:rounded-2xl w-full max-w-[420px] mx-4 px-4 pt-[18px] pb-[22px] animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-[var(--border)] rounded-full mx-auto mb-[14px]" />
            <div className="text-[0.85rem] font-bold mb-2 text-center text-[#ef4444]">
              Keluar dari Akun PRO?
            </div>
            <p className="text-[var(--text-light)] text-[0.75rem] text-center mb-[14px]">
              Perangkat ini akan kembali ke paket FREE dan berhenti sync. Data lokal tetap aman, lisensi PRO pengguna tidak dinonaktifkan.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 flex items-center justify-center py-[10px] px-[14px] rounded-[10px] border-[1.5px] border-[var(--border)] bg-[var(--card-bg)] text-[var(--text)] font-bold text-[0.82rem] cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleLogoutFromPro}
                className="flex-1 flex items-center justify-center py-[10px] px-[14px] rounded-[10px] bg-[#ef4444] text-white font-bold text-[0.82rem] cursor-pointer"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* First-time PRO sync prompt */}
      {showSyncPrompt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-end lg:items-center justify-center animate-fade-in" onClick={() => setShowSyncPrompt(false)}>
          <div className="bg-[var(--card-bg)] rounded-t-2xl lg:rounded-2xl w-full max-w-[420px] mx-4 px-4 pt-[18px] pb-[22px] animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-[var(--border)] rounded-full mx-auto mb-[14px]" />
            <div className="flex justify-center mb-3">
              <div className="w-14 h-14 rounded-full bg-[#2563eb]/10 flex items-center justify-center">
                <Smartphone size={28} className="text-[#2563eb]" />
              </div>
            </div>
            <div className="text-[0.85rem] font-bold mb-2 text-center text-[var(--text)]">
              Selamat Datang di PRO! 🎉
            </div>
            <p className="text-[var(--text-light)] text-[0.75rem] text-center mb-[14px]">
              Aktifkan <b>Sinkronisasi Cloud</b> agar data kamu aman dan bisa diakses dari perangkat lain. Cukup sekali, selanjutnya otomatis!
            </p>
            <div className="bg-[rgba(14,165,160,0.06)] rounded-lg p-3 mb-3 text-[0.7rem] text-[var(--text)]">
              <b>Cara:</b> Buka halaman ini → gulir ke <b>Pengaturan Cloud Sync</b> → masukkan email → klik <b>Hubungkan Sekarang</b>.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowSyncPrompt(false); localStorage.setItem("bgy_pro_sync_reminded", "1"); }}
                className="flex-1 flex items-center justify-center py-[10px] px-[14px] rounded-[10px] border-[1.5px] border-[var(--border)] bg-[var(--card-bg)] text-[var(--text)] font-bold text-[0.82rem] cursor-pointer"
              >
                Nanti
              </button>
              <button
                onClick={() => { setShowSyncPrompt(false); localStorage.setItem("bgy_pro_sync_reminded", "1"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="flex-1 flex items-center justify-center py-[10px] px-[14px] rounded-[10px] text-white font-bold text-[0.82rem] cursor-pointer"
                style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb,#1d4ed8)" }}
              >
                Oke, Saya Mau!
              </button>
            </div>
            <button
              onClick={() => { setShowSyncPrompt(false); localStorage.setItem("bgy_pro_sync_reminded", "1"); setActivePage(PageName.CLOUD_SETTINGS); }}
              className="w-full text-center text-[0.68rem] text-[#2563eb] font-semibold mt-2 bg-transparent border-none cursor-pointer"
            >
              Buka Pengaturan Cloud Sync
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(ts: number): string {
  if (!ts) return "belum pernah";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

const SYNC_DETAIL_LABEL: Record<string, string> = {
  schools: "sekolah",
  teachers: "guru",
  academicYears: "tahun ajaran",
  classrooms: "kelas",
  students: "siswa",
  attendanceSessions: "sesi",
  attendanceRecords: "catatan",
  calendarEntries: "kalender",
};

function formatSyncDetail(detail?: Record<string, number>): string {
  if (!detail || Object.keys(detail).length === 0) return "";
  const parts = Object.entries(detail).map(([key, val]) => `${val} ${SYNC_DETAIL_LABEL[key] || key}`);
  return ` (${parts.join(" · ")})`;
}

const keMenit = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const geserMenit = (hhmm: string, menit: number) => {
  const t = (keMenit(hhmm) + menit) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
