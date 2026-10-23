import { teacherAttendanceRepo } from "@/repositories/dexie/teacher-attendance.repo";
import { db } from "@/repositories/dexie/db";
import type { TeacherAttendance, School } from "@/types/entities";
import { ClockInStatus } from "@/types/enums";
import { attendanceIdFrom, timestamp, todayStr } from "@/lib/utils";
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

  async clockIn(
    guruId: number,
    lat: number,
    lng: number,
    selfieUrl?: string,
    verifikasiWajah?: boolean
  ): Promise<ClockInResult> {
    const school = await this.getSchool();
    const tanggal = todayStr();
    const jam = hhmmssNow();
    const id = attendanceIdFrom(guruId, tanggal);

    const jarakMeter = school?.lat != null && school?.lng != null
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
      lokasiMasukLat: lat,
      lokasiMasukLng: lng,
      jarakMasukMeter: Math.round(jarakMeter),
      statusMasuk,
      diubahPada: timestamp(),
    } as TeacherAttendance;

    await teacherAttendanceRepo.save(record);
    return { record, jarakMeter, statusMasuk };
  },

  async clockOut(
    guruId: number,
    lat: number,
    lng: number,
    selfieUrl?: string,
    verifikasiWajah?: boolean
  ): Promise<{ record: TeacherAttendance; jarakMeter: number; statusPulang: ClockInStatus }> {
    const school = await this.getSchool();
    const tanggal = todayStr();
    const jam = hhmmssNow();
    const id = attendanceIdFrom(guruId, tanggal);

    const jarakMeter = school?.lat != null && school?.lng != null
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
      lokasiPulangLat: lat,
      lokasiPulangLng: lng,
      jarakPulangMeter: Math.round(jarakMeter),
      statusPulang,
      diubahPada: timestamp(),
    } as TeacherAttendance;

    await teacherAttendanceRepo.save(record);
    return { record, jarakMeter, statusPulang };
  },
};
