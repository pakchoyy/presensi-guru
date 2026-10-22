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

export const APP_NAME = "Presensi Siswa";
export const APP_BRAND = "Bantu Guru Yuk";

export const WIZARD_TOTAL_STEPS = 6;

export const PRO_PRICE = "Rp15.000/tahun";

export const MAX_KELAS_FREE = 1;
export const MAX_STUDENTS_FREE = 12;

export const APP_URL = "https://presiswa.bantuguruyuk.web.id";
export const MAIN_SITE_URL = "https://bantuguruyuk.web.id";
