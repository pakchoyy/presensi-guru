import { db } from "@/repositories/dexie/db";
import { timestamp } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

export interface BackupData {
  version: string;
  tanggal: string;
  timestamp: number;
  totalEntitas: number;
  data: {
    schools: unknown[];
    teachers: unknown[];
    academicYears: unknown[];
    classrooms: unknown[];
    students: unknown[];
    attendanceSessions: unknown[];
    attendanceRecords: unknown[];
    calendarEntries: unknown[];
  };
}

export interface CloudBackup {
  _id: string;
  _creationTime: number;
  guruId: number;
  data: string;
  label: string;
  totalEntitas: number;
  dibuatPada: number;
}

export async function createBackup(): Promise<Blob> {
  const tables = [
    "schools",
    "teachers",
    "academicYears",
    "classrooms",
    "students",
    "attendanceSessions",
    "attendanceRecords",
    "calendarEntries",
  ] as const;

  const data: Record<string, unknown[]> = {};
  let totalEntitas = 0;

  await Promise.all(
    tables.map(async (table) => {
      const rows = await db.table(table).toArray();
      data[table] = rows;
      totalEntitas += rows.length;
    })
  );

  const backup: BackupData = {
    version: "1.0.0",
    tanggal: new Date().toISOString(),
    timestamp: timestamp(),
    totalEntitas,
    data: {
      schools: data.schools,
      teachers: data.teachers,
      academicYears: data.academicYears,
      classrooms: data.classrooms,
      students: data.students,
      attendanceSessions: data.attendanceSessions,
      attendanceRecords: data.attendanceRecords,
      calendarEntries: data.calendarEntries,
    },
  };

  const json = JSON.stringify(backup, null, 2);
  return new Blob([json], { type: "application/json" });
}

export function downloadBackup(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `backup_presensi_${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function readBackupFile(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target!.result as string) as BackupData;
        if (!data.version || !data.data || !data.data.schools) {
          reject(new Error("File backup tidak valid"));
          return;
        }
        resolve(data);
      } catch {
        reject(new Error("File tidak dapat dibaca. Pastikan file backup (.json) valid."));
      }
    };
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsText(file);
  });
}

export async function restoreFromBackup(backup: BackupData): Promise<number> {
  let count = 0;

  const tables = [
    { name: "schools", data: backup.data.schools },
    { name: "teachers", data: backup.data.teachers },
    { name: "academicYears", data: backup.data.academicYears },
    { name: "classrooms", data: backup.data.classrooms },
    { name: "students", data: backup.data.students },
    { name: "attendanceSessions", data: backup.data.attendanceSessions },
    { name: "attendanceRecords", data: backup.data.attendanceRecords },
    { name: "calendarEntries", data: backup.data.calendarEntries },
  ];

  await db.transaction("rw", tables.map((t) => db.table(t.name)), async () => {
    for (const table of tables) {
      await db.table(table.name).clear();
      if (table.data.length > 0) {
        await db.table(table.name).bulkAdd(table.data);
        count += table.data.length;
      }
    }
  });

  return count;
}

async function getUserIdByEmail(email: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();
  return data?.id || null;
}

export async function backupToCloud(email: string, type: "auto" | "manual" = "manual"): Promise<boolean> {
  try {
    const userId = await getUserIdByEmail(email);
    if (!userId) return false;

    const blob = await createBackup();
    const json = await blob.text();
    const backup = JSON.parse(json) as BackupData;
    const label = new Date().toLocaleDateString("id-ID", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    await supabase.from("cloud_backups").insert({
      user_id: userId,
      type,
      data: json,
      size: new Blob([json]).size,
      total_entitas: backup.totalEntitas,
      label,
      created_at: Date.now(),
    });

    return true;
  } catch (error) {
    console.error("Backup to cloud failed:", error);
    return false;
  }
}

export async function listCloudBackups(email: string): Promise<CloudBackup[]> {
  try {
    const userId = await getUserIdByEmail(email);
    if (!userId) return [];

    const { data } = await supabase
      .from("cloud_backups")
      .select("id, type, data, size, total_entitas, label, created_at, user_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(0, 49);

    return (data || []).map((b: any) => ({
      _id: b.id.toString(),
      _creationTime: b.created_at,
      guruId: 0,
      data: b.data,
      label: b.label,
      totalEntitas: b.total_entitas,
      dibuatPada: b.created_at,
    }));
  } catch (error) {
    console.error("List cloud backups failed:", error);
    return [];
  }
}

export async function deleteCloudBackup(email: string, backupId: string): Promise<boolean> {
  try {
    const userId = await getUserIdByEmail(email);
    if (!userId) return false;

    const { error } = await supabase
      .from("cloud_backups")
      .delete()
      .eq("id", parseInt(backupId))
      .eq("user_id", userId);

    return !error;
  } catch (error) {
    console.error("Delete cloud backup failed:", error);
    return false;
  }
}

export async function restoreFromCloudBackup(backup: CloudBackup): Promise<number> {
  const data = JSON.parse(backup.data) as BackupData;
  return restoreFromBackup(data);
}
