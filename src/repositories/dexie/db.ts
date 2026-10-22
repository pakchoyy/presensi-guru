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

db.on('blocked', () => {
  console.warn('[DB] Database blocked - forcing delete');
  db.delete().then(() => {
    console.warn('[DB] Database deleted, reloading page...');
    window.location.reload();
  }).catch(console.error);
});

db.open().catch((err) => {
  console.error('[DB] Database open failed:', err);
  const isCorrupt = err.name === 'DataError' ||
                    err.name === 'InvalidStateError' ||
                    (err.message && err.message.includes('not a valid key'));

  if (isCorrupt) {
    console.warn('[DB] Corrupt database detected - auto-deleting');
    db.delete().then(() => {
      console.warn('[DB] Database cleared, reloading page...');
      window.location.reload();
    }).catch(console.error);
  }
});
