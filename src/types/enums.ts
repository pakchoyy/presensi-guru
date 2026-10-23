export enum AttendanceStatus {
  HADIR = "H",
  SAKIT = "S",
  IZIN = "I",
  ALPHA = "A",
  TERLAMBAT = "T",
}

export enum ClockInStatus {
  ONTIME = "ONTIME",
  LATE = "LATE",
  FAR = "FAR",
  /** Presensi pulang sebelum jam pulang. */
  EARLY = "EARLY",
}

export enum Tier {
  FREE = "FREE",
  PRO = "PRO",
}

export enum Jenjang {
  SD = "SD",
  SMP = "SMP",
  SMA = "SMA",
}

export enum Semester {
  GANJIL = "Ganjil",
  GENAP = "Genap",
}

export enum CalendarEntryType {
  HARI_LIBUR = "HariLibur",
  HARI_EFEKTIF = "HariEfektif",
  HARI_PENTING = "HariPenting",
}

export enum HariAktif {
  SENIN_JUMAT = "Senin-Jumat",
  SENIN_SABTU = "Senin-Sabtu",
  KUSTOM = "Kustom",
}

export enum CalendarSource {
  BAWAAN = "Bawaan",
  KUSTOM = "Kustom",
}

export enum PageName {
  DASHBOARD = "dashboard",
  REKAP = "rekap",
  GURU = "guru",
  KALENDER = "kalender",
  PETUNJUK = "petunjuk",
  TENTANG = "tentang",
  UPGRADE = "upgrade",
  PENGATURAN = "pengaturan",
  BACKUP = "backup",
  CLOUD_SETTINGS = "cloud-settings",
  PRESENSI = "presensi",
  LOG_PRESENSI = "log-presensi",
}

export enum WizStep {
  SEKOLAH = 1,
  GURU = 2,
  TAHUN_AJARAN = 3,
  LOKASI = 4,
}
