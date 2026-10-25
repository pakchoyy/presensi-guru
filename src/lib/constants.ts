import { AttendanceStatus } from "@/types/enums";

export const STATUS_HADIR: AttendanceStatus = AttendanceStatus.HADIR;
export const STATUS_SAKIT: AttendanceStatus = AttendanceStatus.SAKIT;
export const STATUS_IZIN: AttendanceStatus = AttendanceStatus.IZIN;
export const STATUS_ALPHA: AttendanceStatus = AttendanceStatus.ALPHA;

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  [AttendanceStatus.HADIR]: "Hadir",
  [AttendanceStatus.SAKIT]: "Sakit",
  [AttendanceStatus.IZIN]: "Izin",
  [AttendanceStatus.ALPHA]: "Alpha",
  [AttendanceStatus.TERLAMBAT]: "Terlambat",
};

export const STATUS_COLOR: Record<AttendanceStatus, string> = {
  [AttendanceStatus.HADIR]: "#16a34a",
  [AttendanceStatus.SAKIT]: "#b45309",
  [AttendanceStatus.IZIN]: "#1d4ed8",
  [AttendanceStatus.ALPHA]: "#dc2626",
  [AttendanceStatus.TERLAMBAT]: "#f59e0b",
};

export const STORAGE_KEY = "bgy_presensi";
export const STORAGE_DARK_KEY = "bgy_presensi_dark";

export const APP_NAME = "Presensi Yuk | Guru";
export const APP_BRAND = "Bantu Guru Yuk";

export const WIZARD_TOTAL_STEPS = 6;

export const PLUS_PRICE = "Rp27.000/semester";
export const PRO_PRICE = "Rp51.000/semester";
export const DAY_MS = 24 * 60 * 60 * 1000;
export const LICENSE_DURATION_DAYS = 180;
export const KREACY_PLUS_URL = "https://kreacy.my.id/produk/rj99kg07";
export const KREACY_PRO_URL = "https://kreacy.my.id/produk/cynjla94";

export const APP_URL = "https://preguru.bantuguruyuk.web.id";
export const MAIN_SITE_URL = "https://bantuguruyuk.web.id";

// Logo bawaan aplikasi. Logo bawaan lama yang tersimpan di data sekolah dianggap sama dengan bawaan.
export const DEFAULT_LOGO = "/icons/pg-192-v1.png";
const LEGACY_DEFAULT_LOGOS = ["/logo-presensiyuk.png", "/logo-presensiyuk.png?v=2", "/guru-presguru.png", "/guru-cibisd2.png"];
export const resolveLogo = (url?: string | null) =>
  !url || LEGACY_DEFAULT_LOGOS.includes(url) || /^\/icons\/pg-\d+-v\d+\.png$/.test(url) ? DEFAULT_LOGO : url;
export const WA_ADMIN = "6289530713597";
