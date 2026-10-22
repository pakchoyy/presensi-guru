import { db } from "./db";
import type { License } from "@/types/entities";

export const licenseRepo = {
  async getActive(guruId: number): Promise<License | undefined> {
    if (!guruId || typeof guruId !== 'number') {
      console.warn('getActive: invalid guruId', { guruId });
      return undefined;
    }
    const licenses = await db.licenses
      .where("guruId")
      .equals(guruId)
      .filter((l) => l.statusLisensi === "Aktif")
      .toArray();
    // Return the latest active license
    return licenses.sort((a, b) => b.tanggalAktivasi - a.tanggalAktivasi)[0];
  },

  async save(license: License): Promise<number> {
    return db.licenses.put(license);
  },

  async expire(id: number): Promise<void> {
    if (!id || typeof id !== 'number') {
      console.warn('expire: invalid id', { id });
      return;
    }
    await db.licenses.update(id, { statusLisensi: "Kedaluwarsa" as const });
  },
};
