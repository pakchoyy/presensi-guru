import { teacherAttendanceRepo } from "@/repositories/dexie/teacher-attendance.repo";
import { db } from "@/repositories/dexie/db";
import type { TeacherAttendance, School } from "@/types/entities";
import { ClockInStatus } from "@/types/enums";
import { attendanceIdFrom, isHariEfektif, timestamp, todayStr } from "@/lib/utils";
import { CalendarEntryType } from "@/types/enums";
import { haversineDistance } from "@/lib/geo";

function hhmmssNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function compareHHMM(a: string, b: string): number {
  // compare "HH:MM" or "HH:MM:SS"
  return a.localeCompare(b);
}

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (((h * 60 + m + mins) % 1440) + 1440) % 1440;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Jendela presensi sekolah, semua "HH:MM". Presensi bisa diulang di dalam jendela; yang terakhir dihitung. */
export function jendelaPresensi(school?: School) {
  const jamMasuk = school?.jamMasukStandar ?? "07:00";
  const jamPulang = school?.jamPulangStandar ?? "15:00";
  return {
    mulaiMasuk: school?.mulaiPresensiMasuk ?? addMinutes(jamMasuk, -60),
    batasMasuk: addMinutes(jamMasuk, school?.toleransiTerlambatMenit ?? 15),
    jamPulang,
    batasPulang: school?.batasPresensiPulang ?? addMinutes(jamPulang, 180),
  };
}

export interface ClockInResult {
  record: TeacherAttendance;
  jarakMeter: number;
  statusMasuk: ClockInStatus;
}

export const teacherAttendanceService = {
  async getSchool(): Promise<School | undefined> {
    const all = await db.schools.toArray();
    return all[0];
  },

  /** Apakah presensi dibuka hari ini? Tutup di hari non-aktif (pengaturan admin) dan hari libur kalender. */
  async hariKerja(guruId: number, tanggal = todayStr()): Promise<boolean> {
    const [guru, entri, school] = await Promise.all([db.teachers.get(guruId), db.calendarEntries.toArray(), this.getSchool()]);
    const libur = new Set(entri.filter((e) => e.jenis === CalendarEntryType.HARI_LIBUR).map((e) => e.tanggal));
    // HP guru tidak punya kalender sendiri: pakai daftar libur yang dikirim admin.
    school?.libur?.split(",").forEach((t) => libur.add(t));
    return isHariEfektif(tanggal, guru, libur);
  },

  async statusHariIni(guruId: number): Promise<{
    sudahMasuk: boolean;
    sudahPulang: boolean;
    record: TeacherAttendance | undefined;
  }> {
    const tanggal = todayStr();
    const record = await teacherAttendanceRepo.getToday(guruId, tanggal);
    return {
      sudahMasuk: !!record?.jamMasuk,
      sudahPulang: !!record?.jamPulang,
      record,
    };
  },

  /** lat/lng null = paket tanpa GPS (selfie saja): tidak ada cek radius. */
  async clockIn(
    guruId: number,
    lat: number | null,
    lng: number | null,
    selfieUrl?: string,
    verifikasiWajah?: boolean
  ): Promise<ClockInResult> {
    const school = await this.getSchool();
    const tanggal = todayStr();
    const jam = hhmmssNow();
    const id = attendanceIdFrom(guruId, tanggal);
    if (!(await this.hariKerja(guruId, tanggal))) throw new Error("Hari ini libur, presensi tidak dibuka");

    const adaLokasi = lat != null && lng != null;
    const jarakMeter = adaLokasi && school?.lat != null && school?.lng != null
      ? haversineDistance(lat, lng, school.lat, school.lng)
      : 0;
    const radius = school?.radiusMeter ?? 100;
    const { mulaiMasuk, batasMasuk: cutoff } = jendelaPresensi(school);
    if (compareHHMM(jam.slice(0, 5), mulaiMasuk) < 0) {
      throw new Error(`Presensi masuk baru dibuka jam ${mulaiMasuk}`);
    }

    let statusMasuk: ClockInStatus;
    if (jarakMeter > radius) statusMasuk = ClockInStatus.FAR;
    else if (compareHHMM(jam.slice(0, 5), cutoff) <= 0) statusMasuk = ClockInStatus.ONTIME;
    else statusMasuk = ClockInStatus.LATE;

    const existing = await teacherAttendanceRepo.getById(id);
    const record: TeacherAttendance = {
      ...(existing || {}),
      id,
      guruId,
      tanggal,
      jamMasuk: jam,
      selfieMasukUrl: selfieUrl ?? existing?.selfieMasukUrl,
      verifikasiWajahMasuk: verifikasiWajah ?? existing?.verifikasiWajahMasuk,
      lokasiMasukLat: lat ?? undefined,
      lokasiMasukLng: lng ?? undefined,
      jarakMasukMeter: adaLokasi ? Math.round(jarakMeter) : undefined,
      statusMasuk,
      diubahPada: timestamp(),
    } as TeacherAttendance;

    await teacherAttendanceRepo.save(record);
    return { record, jarakMeter, statusMasuk };
  },

  async clockOut(
    guruId: number,
    lat: number | null,
    lng: number | null,
    selfieUrl?: string,
    verifikasiWajah?: boolean
  ): Promise<{ record: TeacherAttendance; jarakMeter: number; statusPulang: ClockInStatus }> {
    const school = await this.getSchool();
    const tanggal = todayStr();
    const jam = hhmmssNow();
    const id = attendanceIdFrom(guruId, tanggal);
    if (!(await this.hariKerja(guruId, tanggal))) throw new Error("Hari ini libur, presensi tidak dibuka");

    const adaLokasi = lat != null && lng != null;
    const jarakMeter = adaLokasi && school?.lat != null && school?.lng != null
      ? haversineDistance(lat, lng, school.lat, school.lng)
      : 0;
    const radius = school?.radiusMeter ?? 100;
    const { jamPulang, batasPulang } = jendelaPresensi(school);
    if (compareHHMM(jam.slice(0, 5), batasPulang) > 0) {
      throw new Error(`Presensi pulang sudah ditutup jam ${batasPulang}`);
    }
    const statusPulang: ClockInStatus = jarakMeter > radius
      ? ClockInStatus.FAR
      : compareHHMM(jam.slice(0, 5), jamPulang) < 0
        ? ClockInStatus.EARLY
        : ClockInStatus.ONTIME;

    const existing = await teacherAttendanceRepo.getById(id);
    const record: TeacherAttendance = {
      ...(existing || {}),
      id,
      guruId,
      tanggal,
      jamPulang: jam,
      selfiePulangUrl: selfieUrl ?? existing?.selfiePulangUrl,
      verifikasiWajahPulang: verifikasiWajah ?? existing?.verifikasiWajahPulang,
      lokasiPulangLat: lat ?? undefined,
      lokasiPulangLng: lng ?? undefined,
      jarakPulangMeter: adaLokasi ? Math.round(jarakMeter) : undefined,
      statusPulang,
      diubahPada: timestamp(),
    } as TeacherAttendance;

    await teacherAttendanceRepo.save(record);
    return { record, jarakMeter, statusPulang };
  },
};
