import { licenseRepo } from "@/repositories/dexie/license.repo";
import { teacherRepo } from "@/repositories/dexie/teacher.repo";
import type { License } from "@/types/entities";
import { Tier } from "@/types/enums";
import { generateId, timestamp } from "@/lib/utils";
import { asTier } from "@/lib/features";
import { supabase } from "@/lib/supabase";

interface AffiliateReward {
  commission: number;
  days: number;
}

export interface AffiliateInfo {
  rewards: { PLUS: AffiliateReward; PRO: AffiliateReward; GURU_PLUS?: AffiliateReward; GURU_PRO?: AffiliateReward };
  minWithdraw: number;
  capPerSemester: number;
}

export interface AffiliateDashboard extends AffiliateInfo {
  code: string;
  email: string;
  referrals: { email: string; tier: string | null; product?: string; at: string; amount: number; days: number }[];
  rewardsThisSemester: number;
  earned: number;
  withdrawn: number;
  pending: number;
  saldo: number;
  hasPending: boolean;
}

export interface ActivationResult {
  success: boolean;
  message: string;
  email?: string;
  shouldAutoRegister?: boolean;
  cloudEmail?: string;
  tanggalBerakhir?: number;
}

async function callLicenseApi(body: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: any }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const { data: sess } = await supabase.auth.getSession();
  if (sess.session?.access_token) headers.Authorization = `Bearer ${sess.session.access_token}`;
  const res = await fetch("/api/license", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export const licenseService = {
  /** Cek lisensi aktif milik email lewat server (tabel licenses tidak dibaca langsung dari browser). */
  async lookupByEmail(email: string): Promise<{ found: boolean; tanggalBerakhir: number | null; tier: string | null }> {
    const { ok, data } = await callLicenseApi({ action: "status", email });
    if (!ok) throw new Error(data.error || "Gagal cek lisensi");
    return { found: !!data.found, tanggalBerakhir: data.tanggalBerakhir ?? null, tier: data.tier ?? null };
  },

  async validateKode(email: string, kode: string): Promise<ActivationResult> {
    if (!email || !email.includes("@")) {
      return { success: false, message: "Email tidak valid" };
    }
    if (!kode || kode.trim().length < 4) {
      return { success: false, message: "Kode lisensi tidak valid" };
    }
    return { success: true, message: "Kode valid" };
  },

  /** Angka program affiliate (publik): komisi, bonus hari, minimal tarik. */
  async getAffiliateInfo(): Promise<AffiliateInfo | null> {
    try {
      const { ok, data } = await callLicenseApi({ action: "affiliate_info" });
      return ok ? (data as AffiliateInfo) : null;
    } catch {
      return null;
    }
  },

  /** Dashboard affiliate (khusus PRO, butuh sesi verifikasi email). */
  async getAffiliate(): Promise<{ ok: true; data: AffiliateDashboard } | { ok: false; code?: string; error: string }> {
    try {
      const { ok, data } = await callLicenseApi({ action: "affiliate" });
      if (!ok) return { ok: false, code: data.code, error: data.error || "Gagal memuat data affiliate" };
      return { ok: true, data };
    } catch {
      return { ok: false, error: "Gagal memuat. Periksa koneksi internet." };
    }
  },

  /** Ajukan penarikan seluruh saldo komisi. */
  async requestWithdraw(nama: string, tujuan: string): Promise<{ ok: boolean; amount?: number; error?: string }> {
    try {
      const { ok, data } = await callLicenseApi({ action: "withdraw", nama, tujuan });
      return ok ? { ok: true, amount: data.amount } : { ok: false, error: data.error || "Gagal mengajukan penarikan" };
    } catch {
      return { ok: false, error: "Gagal mengajukan. Periksa koneksi internet." };
    }
  },

  async activate(email: string, kode: string, guruId: number, ref?: string): Promise<ActivationResult> {
    if (!email || !email.includes("@")) {
      return { success: false, message: "Email tidak valid" };
    }
    if (!kode || kode.trim().length < 8) {
      return { success: false, message: "Format kode: BGY-PG-XXXX" };
    }

    const existing = await licenseRepo.getActive(guruId);
    if (existing) {
      return { success: false, message: "Kamu sudah memiliki lisensi aktif" };
    }

    const upperKode = kode.toUpperCase().trim();
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const { ok, status, data } = await callLicenseApi({ action: "activate", email: normalizedEmail, kode: upperKode, guruId, ref: ref?.trim().toUpperCase() || undefined });
      if (!ok) {
        return { success: false, message: status >= 500 ? "Gagal mengaktivasi lisensi" : data.error || "Gagal mengaktivasi lisensi" };
      }
      const now = Date.now();
      const tanggalBerakhir: number = data.tanggalBerakhir;

      const license_: License = {
        id: generateId(),
        guruId,
        emailAktivasi: email,
        kodeLisensi: upperKode,
        tanggalAktivasi: now,
        tanggalBerakhir,
        statusLisensi: "Aktif",
      };

      await licenseRepo.save(license_);
      const tier = asTier(data.tier);
      await teacherRepo.updateTier(guruId, tier);

      const teacher = await teacherRepo.get();
      if (teacher) {
        await teacherRepo.update(teacher.id, { ...teacher, email });
      }

      localStorage.setItem("presensi_cloud_email", normalizedEmail);

      return {
        success: true,
        message: `✅ Lisensi ${tier} berhasil diaktivasi!`,
        cloudEmail: normalizedEmail,
        tanggalBerakhir,
      };
    } catch (err) {
      return { success: false, message: "Gagal terhubung ke server. Periksa koneksi internet." };
    }
  },

  async checkExpiry(guruId: number): Promise<boolean> {
    const license = await licenseRepo.getActive(guruId);
    if (!license) return false;

    const now = timestamp();
    if (now > license.tanggalBerakhir) {
      await licenseRepo.expire(license.id);
      await teacherRepo.updateTier(guruId, Tier.FREE);
      return true;
    }
    return false;
  },

  async getStatus(guruId: number): Promise<{
    aktif: boolean;
    berakhir?: string;
    daysRemaining?: number;
    isExpiring?: boolean;
    email?: string;
    kode?: string;
  }> {
    const license = await licenseRepo.getActive(guruId);
    if (!license) return { aktif: false };

    const now = timestamp();
    if (now > license.tanggalBerakhir) {
      await licenseRepo.expire(license.id);
      await teacherRepo.updateTier(guruId, Tier.FREE);
      return { aktif: false };
    }

    const daysRemaining = Math.ceil((license.tanggalBerakhir - now) / (24 * 60 * 60 * 1000));

    return {
      aktif: true,
      berakhir: formatDate(license.tanggalBerakhir),
      daysRemaining,
      isExpiring: daysRemaining <= 7,
      email: license.emailAktivasi,
      kode: license.kodeLisensi,
    };
  },

  async renew(guruId: number, email: string, kode: string): Promise<ActivationResult> {
    if (!kode || kode.trim().length < 8) {
      return { success: false, message: "Format kode: BGY-PG-XXXX" };
    }

    const upperKode = kode.toUpperCase().trim();
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const { ok, data } = await callLicenseApi({ action: "renew", email: normalizedEmail, kode: upperKode });
      if (!ok) {
        return { success: false, message: data.error || "Kode perpanjangan tidak valid atau sudah digunakan" };
      }
      const newExpiry: number = data.tanggalBerakhir;

      const license = await licenseRepo.getActive(guruId);
      if (license) {
        await licenseRepo.save({
          ...license,
          tanggalBerakhir: newExpiry,
          kodeLisensi: upperKode,
        });
      }
      if (data.tier) await teacherRepo.updateTier(guruId, asTier(data.tier));

      return { success: true, message: "✅ Lisensi berhasil diperpanjang 1 semester!", tanggalBerakhir: newExpiry };
    } catch {
      return { success: false, message: "Gagal terhubung. Periksa internet." };
    }
  },

  async deactivate(guruId: number): Promise<void> {
    const license = await licenseRepo.getActive(guruId);
    if (license) {
      await licenseRepo.expire(license.id);
      await teacherRepo.updateTier(guruId, Tier.FREE);
    }
  },

  getManfaat(): string[] {
    return [
      "Kelola semua kelas yang kamu ajar (tanpa batas)",
      "Buka data yang sama dari HP, laptop, atau tablet",
      "Data aman tersimpan & otomatis sinkron di internet",
      "Atur kalender sendiri: tandai libur & hari penting",
      "Update data siswa lewat Excel tanpa duplikat",
      "Backup & pulihkan data dari internet (cloud)",
      "Tambah logo sekolah di laporan PDF & Excel",
    ];
  },
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
