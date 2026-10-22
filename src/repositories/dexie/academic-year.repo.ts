import { db } from "./db";
import type { AcademicYear } from "@/types/entities";
import { triggerAutoSync } from "@/hooks/useAutoSync";

export const academicYearRepo = {
  async getActive(): Promise<AcademicYear | undefined> {
    return db.academicYears.orderBy("id").last();
  },

  async save(ay: AcademicYear): Promise<number> {
    const result = await db.academicYears.put(ay);
    triggerAutoSync();
    return result;
  },
};
