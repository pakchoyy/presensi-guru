import { db } from "./db";
import type { Teacher } from "@/types/entities";
import { Tier } from "@/types/enums";
import { randomPin, randomKode, timestamp } from "@/lib/utils";
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

  /**
   * Backfill akun lama (mis. admin hasil wizard) yang belum punya kode login
   * atau PIN, supaya bisa dipakai login mandiri di layar Guru.
   * Mengembalikan jumlah akun yang dilengkapi.
   */
  async ensureLoginCredentials(): Promise<number> {
    const all = await db.teachers.toArray();
    const dipakai = new Set(
      all.flatMap((t) => [t.kodeLogin, t.nip].filter(Boolean) as string[])
    );
    let diperbaiki = 0;
    for (const t of all) {
      const patch: Partial<Teacher> = {};
      if (!t.kodeLogin) {
        let kode = t.nip || randomKode();
        while (dipakai.has(kode)) kode = randomKode();
        dipakai.add(kode);
        patch.kodeLogin = kode;
      }
      if (!t.pin) patch.pin = randomPin();
      if (Object.keys(patch).length === 0) continue;
      patch.diubahPada = timestamp();
      await db.teachers.update(t.id, patch);
      diperbaiki++;
    }
    return diperbaiki;
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
