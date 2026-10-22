/**
 * Import Convex backup (.jsonl) into Supabase
 *
 * Usage: node scripts/import-convex.js
 *
 * Reads backup/ folder, maps Convex data → Supabase schema,
 * inserts in dependency order.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, existsSync } from "fs";
import { randomUUID } from "crypto";
import { resolve, join } from "path";

const BACKUP_DIR = resolve(process.cwd(), "backup");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing env: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ============================================
// HELPERS
// ============================================

function readJsonlFile(folderName) {
  const filePath = join(BACKUP_DIR, folderName, "documents.jsonl");
  if (!existsSync(filePath)) {
    console.log(`  ⚠️  ${folderName}/documents.jsonl not found, skipping`);
    return [];
  }

  const content = readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");
  return lines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function camelToSnake(str) {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toInt(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return Math.floor(val);
  if (typeof val === "string") return parseInt(val) || null;
  return null;
}

function toBool(val) {
  if (typeof val === "boolean") return val;
  if (val === "true") return true;
  if (val === "false") return false;
  return !!val;
}

// ============================================
// IMPORT
// ============================================

const stats = {};
const userMap = new Map(); // Convex _id → Supabase UUID

function addStat(table, count) {
  stats[table] = (stats[table] || 0) + count;
}

function printStats() {
  console.log("\n📊 Import Summary:");
  let total = 0;
  for (const [table, count] of Object.entries(stats)) {
    console.log(`  ${table}: ${count}`);
    total += count;
  }
  console.log(`  ─────────────────`);
  console.log(`  TOTAL: ${total}`);
}

async function importBatch(table, rows) {
  if (!rows || rows.length === 0) return;

  const BATCH = 500;
  let imported = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      console.error(`  ❌ ${table} batch ${i}-${i + batch.length}:`, error.message);
    } else {
      imported += batch.length;
    }
  }

  addStat(table, imported);
  console.log(`  ✅ ${table}: ${imported}/${rows.length} imported`);
}

// ============================================
// STEP 1: IMPORT USERS → PROFILES
// ============================================

async function importUsers() {
  console.log("\n👤 Step 1: Importing users → profiles...");

  const users = readJsonlFile("users");
  if (users.length === 0) {
    console.log("  No users found, skipping");
    return;
  }

  const profileRows = users.map((u) => {
    const uuid = randomUUID();
    userMap.set(u._id, uuid);

    return {
      id: uuid,
      email: u.email || "",
      name: u.name || u.email?.split("@")[0] || "Unknown",
      tier: u.tier || "FREE",
      created_at: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
      updated_at: u.updatedAt ? new Date(u.updatedAt).toISOString() : new Date().toISOString(),
    };
  });

  await importBatch("profiles", profileRows);
  console.log(`  📋 ${userMap.size} users mapped (Convex _id → Supabase UUID)`);
}

// ============================================
// STEP 2: IMPORT LICENSES
// ============================================

async function importLicenses() {
  console.log("\n🔑 Step 2: Importing licenses...");

  const rows = readJsonlFile("licenses");
  if (rows.length === 0) return;

  const licenseRows = rows.map((l) => ({
    kode: l.kode,
    status: l.status || "tersedia",
    email: l.email || null,
    guru_id: l.guruId ? toInt(l.guruId) : null,
    tanggal_aktivasi: l.tanggalAktivasi ? toInt(l.tanggalAktivasi) : null,
    tanggal_berakhir: l.tanggalBerakhir ? toInt(l.tanggalBerakhir) : null,
  }));

  await importBatch("licenses", licenseRows);
}

// ============================================
// STEP 3: IMPORT CLOUD TABLES
// ============================================

function buildCloudRow(row, tableName) {
  let userId = userMap.get(row.userId);
  if (!userId) {
    // Auto-create profile for unknown user
    userId = randomUUID();
    userMap.set(row.userId, userId);
  }

  const base = {
    user_id: userId,
    local_id: toInt(row.localId) || 0,
    last_synced_at: toInt(row.lastSyncedAt) || 0,
    version: toInt(row.version) || 1,
  };

  // Map table-specific fields
  switch (tableName) {
    case "cloud_schools":
      return {
        ...base,
        nama: row.nama || "",
        jenjang: row.jenjang || "",
        logo_url: row.logoUrl || null,
        alamat: row.alamat || null,
        dibuat_pada: toInt(row.dibuatPada) || 0,
        diubah_pada: toInt(row.diubahPada) || 0,
      };

    case "cloud_teachers":
      return {
        ...base,
        nama: row.nama || "",
        email: row.email || "",
        sekolah_id: toInt(row.sekolahId) || 0,
        tier: row.tier || "FREE",
        dibuat_pada: toInt(row.dibuatPada) || 0,
        diubah_pada: toInt(row.diubahPada) || 0,
      };

    case "cloud_academic_years":
      return {
        ...base,
        guru_id: toInt(row.guruId) || 0,
        label: row.label || "",
        tanggal_mulai: row.tanggalMulai || "",
        tanggal_selesai: row.tanggalSelesai || "",
        semester_aktif: row.semesterAktif || "",
      };

    case "cloud_classrooms":
      return {
        ...base,
        tahun_ajaran_id: toInt(row.tahunAjaranId) || 0,
        guru_id: toInt(row.guruId) || 0,
        nama: row.nama || "",
        status_aktif: toBool(row.statusAktif),
        dibuat_pada: toInt(row.dibuatPada) || 0,
        diubah_pada: toInt(row.diubahPada) || 0,
      };

    case "cloud_students":
      return {
        ...base,
        kelas_id: toInt(row.kelasId) || 0,
        nama: row.nama || "",
        nisn: row.nisn || null,
        jenis_kelamin: row.jenisKelamin || null,
        urutan: toInt(row.urutan) || 0,
        status_aktif: toBool(row.statusAktif),
        dibuat_pada: toInt(row.dibuatPada) || 0,
        diubah_pada: toInt(row.diubahPada) || 0,
      };

    case "cloud_attendance_sessions":
      return {
        ...base,
        kelas_id: toInt(row.kelasId) || 0,
        tanggal: row.tanggal || "",
        dibuat_pada: toInt(row.dibuatPada) || 0,
        diubah_pada: toInt(row.diubahPada) || 0,
      };

    case "cloud_attendance_records":
      return {
        ...base,
        sesi_id: toInt(row.sesiId) || 0,
        siswa_id: toInt(row.siswaId) || 0,
        status: row.status || "H",
        catatan: row.catatan || null,
        diubah_pada: toInt(row.diubahPada) || 0,
      };

    case "cloud_calendar_entries":
      return {
        ...base,
        tahun_ajaran_id: toInt(row.tahunAjaranId) || 0,
        tanggal: row.tanggal || "",
        jenis: row.jenis || "",
        keterangan: row.keterangan || null,
        sumber: row.sumber || "",
      };

    default:
      return null;
  }
}

async function importCloudTable(convexFolder, supabaseTable) {
  const rows = readJsonlFile(convexFolder);
  if (rows.length === 0) return;

  const mapped = rows
    .map((row) => buildCloudRow(row, supabaseTable))
    .filter(Boolean);

  await importBatch(supabaseTable, mapped);
}

// ============================================
// STEP 4: IMPORT TOMBSTONES, SYNC METADATA, BACKUPS
// ============================================

async function importTombstones() {
  console.log("\n🪦 Step 4a: Importing tombstones...");

  const rows = readJsonlFile("cloudTombstones");
  if (rows.length === 0) return;

  const mapped = rows.map((t) => {
    let uid = userMap.get(t.userId);
    if (!uid) { uid = randomUUID(); userMap.set(t.userId, uid); }
    return {
      user_id: uid,
      entity_type: t.entityType || "",
      local_id: toInt(t.localId) || 0,
      deleted_at: toInt(t.deletedAt) || 0,
    };
  });

  await importBatch("cloud_tombstones", mapped);
}

async function importSyncMetadata() {
  console.log("\n📋 Step 4b: Importing sync metadata...");

  const rows = readJsonlFile("syncMetadata");
  if (rows.length === 0) return;

  const mapped = rows.map((m) => {
    let uid = userMap.get(m.userId);
    if (!uid) { uid = randomUUID(); userMap.set(m.userId, uid); }
    return {
      user_id: uid,
      entity_type: m.entityType || "",
      last_synced_at: toInt(m.lastSyncedAt) || 0,
      sync_status: m.syncStatus || "idle",
      error_message: m.errorMessage || null,
      total_records: toInt(m.totalRecords) || 0,
    };
  });

  await importBatch("sync_metadata", mapped);
}

async function importCloudBackups() {
  console.log("\n💾 Step 4c: Importing cloud backups...");

  const rows = readJsonlFile("cloudBackups");
  if (rows.length === 0) return;

  const mapped = rows.map((b) => {
    let uid = userMap.get(b.userId);
    if (!uid) { uid = randomUUID(); userMap.set(b.userId, uid); }
    return {
      user_id: uid,
      type: "manual",
      data: b.data || "{}",
      size: b.data ? Buffer.byteLength(b.data, "utf-8") : 0,
      total_entitas: 0,
      label: new Date(b.createdAt || Date.now()).toLocaleDateString("id-ID"),
      created_at: toInt(b.createdAt) || 0,
    };
  });

  await importBatch("cloud_backups", mapped);
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log("🚀 Convex → Supabase Import");
  console.log(`   Backup: ${BACKUP_DIR}`);
  console.log(`   Supabase: ${SUPABASE_URL}\n`);

  const startTime = Date.now();

  try {
    // Step 1: Users (foundation for all FK relationships)
    await importUsers();

    // Step 2: Licenses (no FK dependencies)
    await importLicenses();

    // Step 3: Cloud tables in dependency order
    const cloudTableOrder = [
      ["cloudSchools", "cloud_schools"],
      ["cloudTeachers", "cloud_teachers"],
      ["cloudAcademicYears", "cloud_academic_years"],
      ["cloudClassrooms", "cloud_classrooms"],
      ["cloudStudents", "cloud_students"],
      ["cloudAttendanceSessions", "cloud_attendance_sessions"],
      ["cloudAttendanceRecords", "cloud_attendance_records"],
      ["cloudCalendarEntries", "cloud_calendar_entries"],
    ];

    for (const [convexFolder, supabaseTable] of cloudTableOrder) {
      console.log(`\n📦 Importing ${convexFolder} → ${supabaseTable}...`);
      await importCloudTable(convexFolder, supabaseTable);
    }

    // Step 4: Remaining tables
    await importTombstones();
    await importSyncMetadata();
    await importCloudBackups();

    // Done
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n⏱️  Completed in ${elapsed}s`);
    printStats();
    console.log("\n🎉 Import finished successfully!");

  } catch (err) {
    console.error("\n❌ Import failed:", err);
    process.exit(1);
  }
}

main();
