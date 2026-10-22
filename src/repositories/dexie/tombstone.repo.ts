import { db } from "./db";
import type { Tombstone } from "@/types/entities";

export const tombstoneRepo = {
  async add(entityType: string, localId: number): Promise<void> {
    await db.tombstones.add({
      entityType,
      localId,
      deletedAt: Date.now(),
    });
  },

  async addMany(items: { entityType: string; localId: number }[]): Promise<void> {
    if (items.length === 0) return;
    await db.tombstones.bulkAdd(
      items.map((i) => ({
        entityType: i.entityType,
        localId: i.localId,
        deletedAt: Date.now(),
      }))
    );
  },

  async getAll(): Promise<Tombstone[]> {
    return db.tombstones.toArray();
  },

  async clear(): Promise<void> {
    await db.tombstones.clear();
  },
};
