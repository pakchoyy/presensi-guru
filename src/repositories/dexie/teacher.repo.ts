import { db } from "./db";
import type { Teacher } from "@/types/entities";
import { Tier } from "@/types/enums";
import { triggerAutoSync } from "@/hooks/useAutoSync";

export const teacherRepo = {
  async get(): Promise<Teacher | undefined> {
    // "admin" account = guru pertama / role admin
    const all = await db.teachers.toArray();
    return all.find((t) => t.role === "admin") || all[0];
  },

  async list(): Promise<Teacher[]> {
    return db.teachers.toArray();
  },

  async getByToken(token: string): Promise<Teacher | undefined> {
    return db.teachers.where("absenToken").equals(token).first();
  },

  async save(teacher: Teacher): Promise<number> {
    const result = await db.teachers.put(teacher);
    triggerAutoSync();
    return result;
  },

  async update(id: number, teacher: Teacher): Promise<void> {
    if (!id || typeof id !== 'number') {
      console.warn('update: invalid id', { id });
      return;
    }
    await db.teachers.update(id, { ...teacher, diubahPada: Date.now() });
    triggerAutoSync();
  },

  async updateTier(id: number, tier: Tier): Promise<void> {
    if (!id || typeof id !== 'number') {
      console.warn('updateTier: invalid id', { id });
      return;
    }
    await db.teachers.update(id, { tier, diubahPada: Date.now() });
    triggerAutoSync();
  },
};
