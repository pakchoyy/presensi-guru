import { supabase } from "@/lib/supabase";
import { licenseService } from "@/services/license.service";
import { schoolRepo } from "@/repositories/dexie/school.repo";
import { teacherRepo } from "@/repositories/dexie/teacher.repo";
import { academicYearRepo } from "@/repositories/dexie/academic-year.repo";
import { db } from "@/repositories/dexie/db";
import { generateDefaultCalendar } from "@/data/kalender-akademik";
import { Tier, Jenjang, Semester } from "@/types/enums";
import type { School, Teacher, AcademicYear } from "@/types/entities";
import { timestamp, generateId, randomPin, randomKode } from "@/lib/utils";

const ADMIN_EMAILS = ["pulsachoy@gmail.com", "choiruddin2410@gmail.com"];

export interface SetupData {
  sekolah: string;
  jenjang: Jenjang;
  namaGuru: string;      // admin / kepala sekolah
  email: string;
  tahunAjaran: string;
  semester: Semester;
  // Lokasi sekolah untuk geofence absen guru
  lat?: number;
  lng?: number;
  radiusMeter?: number;
  jamMasukStandar?: string;
  jamPulangStandar?: string;
  toleransiTerlambatMenit?: number;
}

export const setupService = {
  async sudahSetup(): Promise<boolean> {
    const count = await db.teachers.count();
    return count > 0;
  },

  async executeSetup(data: SetupData): Promise<void> {
    const now = timestamp();
    const normalizedEmail = data.email.toLowerCase().trim();

    let defaultTier = Tier.FREE;

    if (ADMIN_EMAILS.includes(normalizedEmail)) {
      defaultTier = Tier.PRO;
    } else {
      try {
        const license = (await licenseService.lookupByEmail(normalizedEmail)).found;
        if (license) {
          defaultTier = Tier.PRO;
        } else {
          const { data: profile } = await supabase
            .from("profiles")
            .select("tier")
            .eq("email", normalizedEmail)
            .maybeSingle();
          if (profile && profile.tier === "PRO") {
            defaultTier = Tier.PRO;
          }
        }
      } catch {
        // Offline — default to FREE
      }
    }

    const school: School = {
      id: generateId(),
      nama: data.sekolah,
      jenjang: data.jenjang,
      lat: data.lat,
      lng: data.lng,
      radiusMeter: data.radiusMeter ?? 100,
      jamMasukStandar: data.jamMasukStandar ?? "07:00",
      jamPulangStandar: data.jamPulangStandar ?? "13:00",
      toleransiTerlambatMenit: data.toleransiTerlambatMenit ?? 15,
      dibuatPada: now,
      diubahPada: now,
    };
    await schoolRepo.save(school);

    // Admin (dirinya sendiri)
    const admin: Teacher = {
      id: generateId(),
      nama: data.namaGuru,
      email: data.email,
      sekolahId: school.id,
      tier: defaultTier,
      role: "admin",
      jabatan: "Admin / Kepala Sekolah",
      // Admin juga ikut presensi, jadi dia butuh kode login + PIN sejak awal.
      kodeLogin: randomKode(),
      pin: randomPin(4),
      absenToken: crypto.randomUUID(),
      statusAktif: true,
      dibuatPada: now,
      diubahPada: now,
    };
    await teacherRepo.save(admin);

    const [startStr] = data.tahunAjaran.split("/");
    const startYear = parseInt(startStr);
    const academicYear: AcademicYear = {
      id: generateId(),
      label: data.tahunAjaran,
      tanggalMulai: `${startYear}-07-01`,
      tanggalSelesai: `${startYear + 1}-06-30`,
      semesterAktif: data.semester,
      guruId: admin.id,
    };
    await academicYearRepo.save(academicYear);

    const calendarEntries = generateDefaultCalendar(academicYear.id, data.tahunAjaran);
    await db.calendarEntries.bulkPut(calendarEntries);
  },
};
