import { AttendanceStatus, ClockInStatus, Tier, Jenjang, Semester, CalendarEntryType, CalendarSource } from "./enums";

export interface School {
  id: number;
  nama: string;
  jenjang: Jenjang;
  logoUrl?: string;
  alamat?: string;
  // Lokasi sekolah untuk geofencing presensi guru
  lat?: number;
  lng?: number;
  radiusMeter?: number;       // default 100
  jamMasukStandar?: string;   // "HH:MM" — default "07:00"
  jamPulangStandar?: string;  // "HH:MM" — default "15:00"
  toleransiTerlambatMenit?: number; // default 15
  /** Presensi masuk baru dibuka jam ini ("HH:MM"); default 1 jam sebelum jam masuk. */
  mulaiPresensiMasuk?: string;
  /** Presensi pulang ditutup jam ini ("HH:MM"); default 3 jam setelah jam pulang. */
  batasPresensiPulang?: string;
  dibuatPada: number;
  diubahPada: number;
}

export interface Teacher {
  id: number;
  nama: string;
  email: string;
  sekolahId: number;
  tier: Tier;
  // Guru-specific fields
  absenToken?: string;
  /** "ks" = Kepala Sekolah: presensi seperti guru + bisa memutuskan izin (verifikator). */
  role?: "admin" | "guru" | "ks";
  jabatan?: string;
  nip?: string;
  /** Kode login guru (opsional) — bisa NIP, NUPTK, atau kode auto-generate `G-XXXX`. Dipakai untuk login mandiri guru lewat halaman Presensi. */
  kodeLogin?: string;
  /** PIN login mandiri guru (4-6 digit). Disetel oleh Ops / Kepala Sekolah di halaman Daftar Guru. */
  pin?: string;
  statusAktif?: boolean;
  hariAktifMode?: string;
  hariAktifCustom?: string;
  dibuatPada: number;
  diubahPada: number;
}

export interface AcademicYear {
  id: number;
  label: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  semesterAktif: Semester;
  guruId: number;
}

export interface TeacherAttendance {
  id: number;                 // deterministik: hash("ta:guruId:tanggal")
  guruId: number;
  tanggal: string;            // YYYY-MM-DD
  jamMasuk?: string;          // HH:MM:SS
  jamPulang?: string;
  selfieMasukUrl?: string;
  selfiePulangUrl?: string;
  /** true = selfie lolos deteksi wajah + gerak kepala; false = foto biasa. */
  verifikasiWajahMasuk?: boolean;
  verifikasiWajahPulang?: boolean;
  lokasiMasukLat?: number;
  lokasiMasukLng?: number;
  lokasiPulangLat?: number;
  lokasiPulangLng?: number;
  jarakMasukMeter?: number;
  jarakPulangMeter?: number;
  statusMasuk?: ClockInStatus;
  statusPulang?: ClockInStatus;
  statusHari?: AttendanceStatus;    // H/S/I/A/T — manual input admin bila perlu
  catatan?: string;
  /** Izin yang diajukan guru sendiri; kosong = dicatat admin (dianggap disetujui). */
  statusIzin?: "proses" | "disetujui" | "ditolak";
  diubahPada: number;
}

export interface AcademicCalendarEntry {
  id: number;
  tahunAjaranId: number;
  tanggal: string;
  jenis: CalendarEntryType;
  keterangan?: string;
  sumber: CalendarSource;
}

export interface License {
  id: number;
  guruId: number;
  emailAktivasi: string;
  kodeLisensi: string;
  product?: "siswa" | "guru";   // untuk filter per-produk
  tanggalAktivasi: number;
  tanggalBerakhir: number;
  statusLisensi: "Aktif" | "Kedaluwarsa" | "Dibatalkan";
}

export interface BackupMeta {
  id: number;
  guruId: number;
  jenis: "Lokal" | "Cloud";
  dibuatPada: number;
  ukuranData?: number;
}

export interface Tombstone {
  id: number;
  entityType: string; // "teachers" | "teacherAttendance" | "schools" | ...
  localId: number;
  deletedAt: number;
}
