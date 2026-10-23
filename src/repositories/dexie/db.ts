import Dexie, { type EntityTable } from "dexie";
import type {
  School,
  Teacher,
  AcademicYear,
  TeacherAttendance,
  AcademicCalendarEntry,
  License,
  BackupMeta,
  Tombstone,
} from "@/types/entities";

export class PresensiDB extends Dexie {
  schools!: EntityTable<School, "id">;
  teachers!: EntityTable<Teacher, "id">;
  academicYears!: EntityTable<AcademicYear, "id">;
  teacherAttendance!: EntityTable<TeacherAttendance, "id">;
  calendarEntries!: EntityTable<AcademicCalendarEntry, "id">;
  licenses!: EntityTable<License, "id">;
  backupMeta!: EntityTable<BackupMeta, "id">;
  tombstones!: EntityTable<Tombstone, "id">;

  constructor() {
    super("bgy_presensi_guru_db");
    this.version(1).stores({
      schools: "id",
      teachers: "id, sekolahId, absenToken",
      academicYears: "id, guruId",
      teacherAttendance: "id, guruId, tanggal, [guruId+tanggal]",
      calendarEntries: "id, tahunAjaranId, tanggal",
      licenses: "id, guruId",
      backupMeta: "id, guruId",
      tombstones: "++id, entityType, localId",
    });
  }
}

export const db = new PresensiDB();

// Jangan pernah hapus database otomatis: "blocked" berarti tab/PWA lain masih
// membuka versi lama, dan data presensi bisa hanya ada di HP ini.
const askReload = () =>
  alert("Presensi Yuk sedang terbuka di tab lain. Tutup tab lain lalu muat ulang halaman ini.");
db.on("blocked", askReload);
db.on("versionchange", () => { db.close(); askReload(); return false; });

db.open().catch((err) => {
  console.error("[DB] Database open failed:", err);
  askReload();
});
