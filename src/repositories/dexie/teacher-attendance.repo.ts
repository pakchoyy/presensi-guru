import { db } from "./db";
import type { TeacherAttendance } from "@/types/entities";

export const teacherAttendanceRepo = {
  async getToday(guruId: number, tanggal: string): Promise<TeacherAttendance | undefined> {
    return db.teacherAttendance.where("[guruId+tanggal]").equals([guruId, tanggal]).first();
  },

  async getById(id: number): Promise<TeacherAttendance | undefined> {
    return db.teacherAttendance.get(id);
  },

  async getRange(guruId: number, startDate: string, endDate: string): Promise<TeacherAttendance[]> {
    return db.teacherAttendance
      .where("guruId")
      .equals(guruId)
      .filter((r) => r.tanggal >= startDate && r.tanggal <= endDate)
      .toArray();
  },

  async getAllToday(tanggal: string): Promise<TeacherAttendance[]> {
    return db.teacherAttendance.where("tanggal").equals(tanggal).toArray();
  },

  async save(record: TeacherAttendance): Promise<void> {
    await db.teacherAttendance.put(record);
  },

  async upsert(record: TeacherAttendance): Promise<void> {
    const existing = await db.teacherAttendance.get(record.id);
    if (existing) {
      await db.teacherAttendance.put({ ...existing, ...record });
    } else {
      await db.teacherAttendance.put(record);
    }
  },

  async getAllRange(startDate: string, endDate: string): Promise<TeacherAttendance[]> {
    return db.teacherAttendance
      .filter((r) => r.tanggal >= startDate && r.tanggal <= endDate)
      .toArray();
  },

  /**
   * Foto selfie hanya disimpan 7 hari (cukup untuk dicek), data jam & lokasi tetap.
   * diubahPada sengaja tidak diubah supaya tidak menimpa data cloud.
   */
  async hapusFotoLama(sebelumTanggal: string): Promise<number> {
    return db.teacherAttendance
      .filter((r) => r.tanggal < sebelumTanggal && !!(r.selfieMasukUrl || r.selfiePulangUrl))
      .modify((r) => { delete r.selfieMasukUrl; delete r.selfiePulangUrl; });
  },
};
