import { db } from "@/repositories/dexie/db";
import { supabase } from "@/lib/supabase";

export type SyncStatus = "tersinkron" | "menyinkronkan" | "menunggu" | "error";

const LAST_SYNC_KEY = "presensi_last_sync";
const SYNC_LOG_KEY = "presensi_sync_log";

export interface SyncLogEntry {
  at: number;
  action: string;
  ok: boolean;
  uploaded?: number;
  downloaded?: number;
  error?: string;
  detail?: Record<string, number>;
}

export function saveSyncLog(entry: SyncLogEntry) {
  try {
    localStorage.setItem(SYNC_LOG_KEY, JSON.stringify(entry));
    window.dispatchEvent(new Event("sync-log-updated"));
  } catch {}
}

export function getSyncLog(): SyncLogEntry | null {
  try {
    const raw = localStorage.getItem(SYNC_LOG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const SYNC_TABLES = [
  "schools",
  "teachers",
  "academicYears",
  "teacherAttendance",
  "calendarEntries",
] as const;

// Tabel yang TIDAK boleh dihapus/overwrite saat force sync
// karena berisi data auth & lisensi (tier PRO) yang hidupnya di lokal
const PROTECTED_TABLES = new Set(["schools", "teachers"]);

const CLOUD_TABLE_MAP: Record<string, string> = {
  schools: "cloud_schools",
  teachers: "cloud_guru_teachers",
  academicYears: "cloud_academic_years",
  teacherAttendance: "cloud_guru_attendance",
  calendarEntries: "cloud_calendar_entries",
};

let _userIdCache: { email: string; id: string } | null = null;

function getLastSyncTimestamp(): number {
  const stored = localStorage.getItem(LAST_SYNC_KEY);
  return stored ? parseInt(stored) : 0;
}

// Supabase membatasi 1000 baris per select: ambil per halaman sampai habis.
const PAGE = 1000;
async function selectAll(build: () => any): Promise<{ data: any[]; error: { message: string } | null }> {
  const all: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().order("id").range(from, from + PAGE - 1);
    if (error) return { data: all, error };
    all.push(...(data || []));
    if (!data || data.length < PAGE) return { data: all, error: null };
  }
}

function saveLastSyncTimestamp(ts: number) {
  localStorage.setItem(LAST_SYNC_KEY, ts.toString());
}

async function getUserIdByEmail(email: string): Promise<string | null> {
  if (_userIdCache && _userIdCache.email === email.toLowerCase().trim()) {
    return _userIdCache.id;
  }
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();
  if (data?.id) {
    _userIdCache = { email: email.toLowerCase().trim(), id: data.id };
  }
  return data?.id || null;
}

// Cek apakah baris data masih ada di cloud. Dipakai untuk tombstones:
// kalau data ternyata masih ada (di-create ulang setelah tombstones tercatat),
// tombstone dianggap basi dan TIDAK boleh menghapus data lokal.
async function cloudDataExists(cloudTable: string, userId: string, localId: number): Promise<boolean> {
  try {
    const { count } = await supabase
      .from(cloudTable)
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("local_id", localId);
    return (count || 0) > 0;
  } catch {
    return true; // gagal cek → jangan hapus data (lebih aman)
  }
}

async function getLocalChanges(since: number): Promise<Record<string, any[]>> {
  const changes: Record<string, any[]> = {};
  for (const table of SYNC_TABLES) {
    try {
      const records = await db.table(table).toArray();
      const filtered = records.filter((r: any) => {
        const modifiedAt = r.diubahPada || r.dibuatPada || 0;
        return modifiedAt > since;
      });
      if (filtered.length > 0) changes[table] = filtered;
    } catch {
      changes[table] = [];
    }
  }
  return changes;
}

export const syncService = {
  async initialUpload(email: string): Promise<number> {
    try {
      const userId = await getUserIdByEmail(email);
      if (!userId) {
        saveSyncLog({ at: Date.now(), action: "upload", ok: false, uploaded: 0, error: "Email tidak terdaftar di cloud" });
        return 0;
      }

      const allData = await Promise.all(SYNC_TABLES.map(t => db.table(t).toArray()));
      const now = Date.now();

      let totalUploaded = 0;
      let lastError: string | null = null;
      const detail: Record<string, number> = {};

      for (let i = 0; i < SYNC_TABLES.length; i++) {
        const table = SYNC_TABLES[i];
        const rows = allData[i];
        const cloudTable = CLOUD_TABLE_MAP[table];

        // Skip tabel protected (schools, teachers) — biar cloud gak ke-timpa data auth/lisensi
        if (PROTECTED_TABLES.has(table)) continue;

        if (rows.length === 0) continue;

        // MERGE: cek data cloud yang sudah ada, hanya overwrite jika lokal lebih baru
        const localIds = rows.map(r => r.id);
        const { data: existingRows } = await supabase
          .from(cloudTable)
          .select("id, local_id, diubah_pada")
          .eq("user_id", userId)
          .in("local_id", localIds);

        const existingMap = new Map(
          (existingRows || []).map((r: any) => [r.local_id, { cloudId: r.id, timestamp: r.diubah_pada || 0 }])
        );

        const toInsert: any[] = [];
        const toUpdate: any[] = [];

        for (const row of rows) {
          const existing = existingMap.get(row.id);
          const localTimestamp = row.diubahPada || row.dibuatPada || 0;

          if (!existing) {
            // Belum ada di cloud → insert
            toInsert.push({
              user_id: userId,
              local_id: row.id,
              ...buildCloudRow(table, row, now),
            });
          } else if (localTimestamp >= existing.timestamp) {
            // Lokal lebih baru → update
            toUpdate.push({
              cloudId: existing.cloudId,
              data: buildCloudRow(table, row, now),
            });
          }
          // else: cloud lebih baru, skip (biarkan cloud data menang)
        }

        if (toInsert.length > 0) {
          // UPSERT supaya tidak membuat baris duplikat (user_id+local_id unik)
          const { error } = await supabase
            .from(cloudTable)
            .upsert(toInsert, { onConflict: "user_id,local_id" });
          if (!error) {
            totalUploaded += toInsert.length;
            detail[table] = (detail[table] || 0) + toInsert.length;
          } else {
            lastError = `${cloudTable} insert: ${error.message}`;
          }
        }

        for (const item of toUpdate) {
          const { error } = await supabase
            .from(cloudTable)
            .update(item.data)
            .eq("id", item.cloudId);
          if (!error) {
            totalUploaded++;
            detail[table] = (detail[table] || 0) + 1;
          } else {
            lastError = `${cloudTable} update: ${error.message}`;
          }
        }
      }

      // NOTE: cloud tombstones TIDAK dihapus di sini. Tombstone lama dipakai
      // downloadAll/incrementalSync dengan guard "data masih ada di cloud?"
      // supaya data yang di-create-ulang tidak ikut terhapus di device lain.

      if (!lastError) saveLastSyncTimestamp(Date.now());
      saveSyncLog({ at: Date.now(), action: "upload", ok: totalUploaded > 0 && !lastError, uploaded: totalUploaded, error: lastError || undefined, detail });

      return totalUploaded;
    } catch (error) {
      console.error("Initial upload failed:", error);
      saveSyncLog({ at: Date.now(), action: "upload", ok: false, uploaded: 0, error: (error as Error)?.message || "Upload gagal" });
      return 0;
    }
  },

  async downloadAll(email: string): Promise<number> {
    try {
      const userId = await getUserIdByEmail(email);
      if (!userId) return 0;

      let count = 0;
      const detail: Record<string, number> = {};

      // Proses per tabel (bukan 1 transaksi besar) untuk hindari "commit too large"
      for (const table of SYNC_TABLES) {
        // Skip tabel protected (schools, teachers) biar tier PRO & sekolah gak berubah
        if (PROTECTED_TABLES.has(table)) continue;

        const { data: cloudRows } = await selectAll(() => supabase
          .from(CLOUD_TABLE_MAP[table])
          .select("*")
          .eq("user_id", userId));

        if (!cloudRows || cloudRows.length === 0) continue;

        // Transaksi per tabel (lebih kecil, aman dari "commit too large")
        await db.transaction("rw", db.table(table), async () => {
          let tableDownloaded = 0;
          for (const cloudRow of cloudRows) {
            const localId = cloudRow.local_id;
            if (!localId || typeof localId !== "number" || isNaN(localId)) continue;

            const existing = await db.table(table).get(localId);
            const cloudTimestamp = cloudRow.diubah_pada || 0;
            const localTimestamp = existing ? ((existing as any).diubahPada || 0) : 0;

            // Cloud menang jika lebih baru ATAU lokal belum ada
            if (!existing || cloudTimestamp >= localTimestamp) {
              const localData = convertCloudToLocal(cloudRow);
              await db.table(table).put(localData);
              count++;
              tableDownloaded++;
            }
          }
          if (tableDownloaded > 0) {
            detail[table] = tableDownloaded;
          }
        });
      }

      // Tombstones (hapus data yang di-delete)
      const { data: tombstones } = await supabase
        .from("cloud_tombstones")
        .select("id, entity_type, local_id, deleted_at")
        .eq("user_id", userId);

      if (tombstones) {
        for (const tomb of tombstones) {
          if (!tomb.local_id || typeof tomb.local_id !== "number" || isNaN(tomb.local_id)) continue;
          if (PROTECTED_TABLES.has(tomb.entity_type)) continue;
          const cloudTable = CLOUD_TABLE_MAP[tomb.entity_type];
          // Guard: kalau baris data masih ada di cloud berarti data dibuat ulang
          // setelah tombstones tercatat (mis. re-import siswa yang sama) → tombstone
          // basi, jangan hapus data lokal, dan buang tombstone-nya dari cloud.
          if (cloudTable && (await cloudDataExists(cloudTable, userId, tomb.local_id))) {
            await supabase.from("cloud_tombstones").delete().eq("id", tomb.id);
            continue;
          }
          await db.table(tomb.entity_type).delete(tomb.local_id);
        }
      }

      if (count > 0) {
        window.dispatchEvent(new Event("data-changed"));
      }

      saveLastSyncTimestamp(Date.now());
      saveSyncLog({ at: Date.now(), action: "download", ok: count > 0, downloaded: count, detail });

      return count;
    } catch (error) {
      console.error("Download all failed:", error);
      saveSyncLog({ at: Date.now(), action: "download", ok: false, downloaded: 0, error: (error as Error)?.message || "Download gagal" });
      return 0;
    }
  },

  async hasCloudChanges(email: string): Promise<boolean> {
    try {
      const userId = await getUserIdByEmail(email);
      if (!userId) return false;

      const lastSync = getLastSyncTimestamp();

      for (const table of SYNC_TABLES) {
        const cloudTable = CLOUD_TABLE_MAP[table];
        const { count } = await supabase
          .from(cloudTable)
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .gt("last_synced_at", lastSync);

        if (count && count > 0) return true;
      }

      const { count: tombCount } = await supabase
        .from("cloud_tombstones")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gt("deleted_at", lastSync);

      return (tombCount || 0) > 0;
    } catch {
      return false;
    }
  },

  async incrementalSync(email: string): Promise<{ uploaded: number; downloaded: number; hasChanges: boolean; ok: boolean }> {
    try {
      const userId = await getUserIdByEmail(email);
      if (!userId) return { uploaded: 0, downloaded: 0, hasChanges: false, ok: false };

      const lastSync = getLastSyncTimestamp();
      // Waktu MULAI dipakai sebagai cap waktu baru, supaya perubahan selama sinkron ikut terkirim berikutnya.
      const now = Date.now();

      const localChanges = await getLocalChanges(lastSync);
      const localTombstones = await db.tombstones.toArray();

      const hasLocalChanges = Object.values(localChanges).some(r => r.length > 0) || localTombstones.length > 0;

      let uploaded = 0;
      let lastError: string | null = null;

      if (hasLocalChanges) {
        for (const [table, rows] of Object.entries(localChanges)) {
          const cloudTable = CLOUD_TABLE_MAP[table];
          if (!cloudTable || rows.length === 0) continue;

          const localIds = rows.map(r => r.id);
          const { data: existingRows } = await supabase
            .from(cloudTable)
            .select("id, local_id, version, diubah_pada")
            .eq("user_id", userId)
            .in("local_id", localIds);

          const existingMap = new Map(
            (existingRows || []).map((r: any) => [r.local_id, r])
          );

          const toInsert: any[] = [];
          const toUpdate: any[] = [];

          for (const row of rows) {
            const existing = existingMap.get(row.id);
            if (existing) {
              if ((row.diubahPada || 0) >= (existing.diubah_pada || 0)) {
                toUpdate.push({ ...buildCloudRow(table, row, now), version: existing.version + 1, _eq_id: existing.id });
              }
            } else {
              toInsert.push({ ...buildCloudRow(table, row, now), user_id: userId, local_id: row.id });
            }
          }

          if (toInsert.length > 0) {
            // UPSERT agar tidak menciptakan baris duplikat di cloud
            const { error } = await supabase
              .from(cloudTable)
              .upsert(toInsert, { onConflict: "user_id,local_id" });
            if (!error) uploaded += toInsert.length;
            else lastError = `insert ${cloudTable}: ${error.message}`;
          }

          for (const item of toUpdate) {
            const { _eq_id, ...updateData } = item;
            const { error } = await supabase.from(cloudTable).update(updateData).eq("id", _eq_id);
            if (!error) uploaded++;
            else lastError = `update ${cloudTable}: ${error.message}`;
          }
        }

        for (const tomb of localTombstones) {
          const cloudTable = CLOUD_TABLE_MAP[tomb.entityType];
          if (!cloudTable) continue;
          // Guard: kalau data masih ada di lokal (dibuat ulang setelah tombstone
          // tercatat, mis. re-add siswa senama), tombstone basi — jangan hapus cloud.
          const localRow = await db.table(tomb.entityType).get(tomb.localId).catch(() => undefined);
          if (localRow) continue;
          await supabase.from(cloudTable).delete().eq("user_id", userId).eq("local_id", tomb.localId);
          // UPSERT tombstone agar tidak duplikat
          await supabase
            .from("cloud_tombstones")
            .upsert({
              user_id: userId,
              entity_type: tomb.entityType,
              local_id: tomb.localId,
              deleted_at: now,
            }, { onConflict: "user_id,entity_type,local_id" });
        }
      }

      // Batasi cek perubahan cloud (beberapa query) maksimal tiap 30 detik biar hemat kuota
      let hasCloud = false;
      if (now - lastSync >= 30_000) {
        hasCloud = await this.hasCloudChanges(email);
      }
      let downloaded = 0;
      let hasChanges = hasLocalChanges || hasCloud;

      if (hasCloud) {
        for (const table of SYNC_TABLES) {
          const cloudTable = CLOUD_TABLE_MAP[table];
          const { data: cloudRows, error: pullErr } = await selectAll(() => supabase
            .from(cloudTable)
            .select("*")
            .eq("user_id", userId)
            .gt("last_synced_at", lastSync));
          if (pullErr) lastError = `ambil ${cloudTable}: ${pullErr.message}`;

          if (cloudRows && cloudRows.length > 0) {
            for (const cloudRow of cloudRows) {
              const localId = cloudRow.local_id;
              if (!localId || isNaN(localId)) continue;

              const existing = await db.table(table).get(localId);
              if (existing) {
                if ((cloudRow.diubah_pada || 0) >= ((existing as any).diubahPada || 0)) {
                  const localData = convertCloudToLocal(cloudRow);
                  await db.table(table).put(localData);
                  downloaded++;
                }
              } else {
                const localData = convertCloudToLocal(cloudRow);
                await db.table(table).put(localData);
                downloaded++;
              }
            }
          }
        }

        const { data: cloudTombstones } = await supabase
          .from("cloud_tombstones")
          .select("id, entity_type, local_id, deleted_at")
          .eq("user_id", userId)
          .gt("deleted_at", lastSync);

        if (cloudTombstones && cloudTombstones.length > 0) {
          for (const tomb of cloudTombstones) {
            if (!tomb.local_id || typeof tomb.local_id !== "number" || isNaN(tomb.local_id)) continue;
            const cloudTable = CLOUD_TABLE_MAP[tomb.entity_type];
            // Guard tombstone basi (data di-create ulang) — jangan hapus data lokal
            if (cloudTable && (await cloudDataExists(cloudTable, userId, tomb.local_id))) {
              await supabase.from("cloud_tombstones").delete().eq("id", tomb.id);
              continue;
            }
            await db.table(tomb.entity_type).delete(tomb.local_id);
          }
        }
      }

      // Gagal sebagian: jangan buang tombstone & jangan majukan cap waktu, supaya dicoba lagi.
      if (!lastError) {
        await db.tombstones.clear();
        saveLastSyncTimestamp(now);
      }
      saveSyncLog({ at: now, action: "sync", ok: !lastError, uploaded, downloaded, error: lastError || undefined });

      if (downloaded > 0) {
        window.dispatchEvent(new Event("data-changed"));
      }

      return { uploaded, downloaded, hasChanges, ok: !lastError };
    } catch (error) {
      console.error("Incremental sync failed:", error);
      saveSyncLog({ at: Date.now(), action: "sync", ok: false, uploaded: 0, downloaded: 0, error: (error as Error)?.message || "Sinkronisasi gagal" });
      return { uploaded: 0, downloaded: 0, hasChanges: false, ok: false };
    }
  },

  async fullSync(email: string): Promise<{ uploaded: number; downloaded: number }> {
    const uploaded = await this.initialUpload(email);
    const downloaded = await this.downloadAll(email);
    saveLastSyncTimestamp(Date.now());
    return { uploaded, downloaded };
  },

  async syncAll(email: string): Promise<{ uploaded: number; downloaded: number }> {
    const lastSync = getLastSyncTimestamp();
    if (lastSync === 0) {
      return await this.fullSync(email);
    }

    try {
      const result = await this.incrementalSync(email);
      return { uploaded: result.uploaded, downloaded: result.downloaded };
    } catch (error) {
      console.error("Incremental sync failed, falling back to full sync", error);
      return await this.fullSync(email);
    }
  },

  resetSyncState() {
    localStorage.removeItem(LAST_SYNC_KEY);
    _userIdCache = null;
  },
};

function buildCloudRow(table: string, row: any, now: number): Record<string, any> {
  switch (table) {
    case "schools":
      return {
        nama: row.nama,
        jenjang: row.jenjang,
        logo_url: row.logoUrl || null,
        alamat: row.alamat || null,
        dibuat_pada: row.dibuatPada || now,
        diubah_pada: row.diubahPada || now,
        last_synced_at: now,
        version: 1,
      };
    case "teachers":
      return {
        nama: row.nama,
        email: row.email || "",
        sekolah_id: row.sekolahId || 0,
        tier: row.tier || "FREE",
        nip: row.nip || null,
        jabatan: row.jabatan || null,
        role: row.role || "guru",
        absen_token: row.absenToken || null,
        status_aktif: row.statusAktif !== false,
        dibuat_pada: row.dibuatPada || now,
        diubah_pada: row.diubahPada || now,
        last_synced_at: now,
        version: 1,
      };
    case "academicYears":
      return {
        guru_id: row.guruId || 0,
        label: row.label,
        tanggal_mulai: row.tanggalMulai,
        tanggal_selesai: row.tanggalSelesai,
        semester_aktif: row.semesterAktif,
        last_synced_at: now,
        version: 1,
      };
    case "teacherAttendance":
      return {
        guru_id: row.guruId || 0,
        tanggal: row.tanggal,
        jam_masuk: row.jamMasuk || null,
        jam_pulang: row.jamPulang || null,
        selfie_masuk_url: row.selfieMasukUrl || null,
        selfie_pulang_url: row.selfiePulangUrl || null,
        lokasi_masuk_lat: row.lokasiMasukLat ?? null,
        lokasi_masuk_lng: row.lokasiMasukLng ?? null,
        lokasi_pulang_lat: row.lokasiPulangLat ?? null,
        lokasi_pulang_lng: row.lokasiPulangLng ?? null,
        jarak_masuk_meter: row.jarakMasukMeter ?? null,
        jarak_pulang_meter: row.jarakPulangMeter ?? null,
        status_masuk: row.statusMasuk || null,
        status_pulang: row.statusPulang || null,
        status_hari: row.statusHari || null,
        catatan: row.catatan || null,
        diubah_pada: row.diubahPada || now,
        last_synced_at: now,
        version: 1,
      };
    case "calendarEntries":
      return {
        tahun_ajaran_id: row.tahunAjaranId || 0,
        tanggal: row.tanggal,
        jenis: row.jenis,
        keterangan: row.keterangan || null,
        sumber: row.sumber,
        last_synced_at: now,
        version: 1,
      };
    default:
      return { last_synced_at: now, version: 1 };
  }
}

function convertCloudToLocal(cloudRow: any): any {
  const localData: any = { id: cloudRow.local_id };
  for (const [key, value] of Object.entries(cloudRow)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (!["user_id", "local_id", "last_synced_at", "version", "id"].includes(key)) {
      localData[camelKey] = value;
    }
  }
  return localData;
}
