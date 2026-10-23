/**
 * Sinkron multi-perangkat: guru absen dari HP-nya sendiri, admin melihatnya.
 *
 * Kunci yang membuat dua perangkat "bertemu":
 *  - Guru di HP-nya memakai id lokal yang SAMA dengan di HP admin
 *    (cloud_guru_teachers.local_id), dan id absen = attendanceIdFrom(guruId,
 *    tanggal). Jadi absen yang sama punya id yang sama di semua perangkat.
 *  - Penggabungan: yang diubahPada-nya paling baru menang. Selfie lokal
 *    (data URL) tetap disimpan untuk tampilan offline.
 *
 * Sisi guru memakai `supabaseGuru` (sesi terpisah), sisi admin memakai
 * `supabase` (sesi admin dari AuthContext).
 */
import { supabase } from "@/lib/supabase";
import { supabaseGuru } from "@/lib/supabase-guru";
import { db } from "@/repositories/dexie/db";
import { attendanceIdFrom, getActiveDays, timestamp, todayStr, addDays, passwordDariPin } from "@/lib/utils";
import { Jenjang, Tier } from "@/types/enums";
import type { School, Teacher, TeacherAttendance } from "@/types/entities";

const KUNCI_PERANGKAT = "bgy_perangkat_guru";
const KUNCI_ANTRIAN = "bgy_antrian_absen_cloud";
const KUNCI_TERUNGGAH = "bgy_selfie_terunggah";
const KUNCI_ANTRIAN_ADMIN = "bgy_antrian_absen_kios";
const BUCKET = "selfie-guru";
/** Penanda selfie yang tersimpan di Storage (bukan data URL lokal). */
export const PREFIX_STORAGE = "sb:";

export interface InfoPerangkatGuru {
  uid: string;
  sekolahUuid: string;
  guruId: number;
  sekolahId: number;
  /**
   * true kalau perangkat masih kosong saat guru login (HP guru sendiri).
   * Hanya perangkat seperti ini yang datanya dihapus saat guru keluar —
   * jangan pernah menghapus data di HP admin / perangkat bersama.
   */
  perangkatBaru: boolean;
}

interface BarisSekolah {
  id: string;
  local_id: number;
  nama: string;
  lat: number | null;
  lng: number | null;
  radius_meter: number;
  jam_masuk: string;
  jam_pulang: string;
  toleransi_menit: number;
  mulai_masuk: string | null;
  batas_pulang: string | null;
  hari_aktif: string;
  diubah_pada: number;
}

interface BarisGuru {
  user_id: string;
  local_id: number;
  nama: string;
  nip: string | null;
  jabatan: string | null;
  kode_login: string | null;
  sekolah_uuid: string | null;
  status_aktif: boolean;
}

/** Satu pengajuan izin di daftar Verifikasi Izin. */
export interface IzinSekolah {
  kunci: string;
  nama: string;
  tanggal: string;
  statusHari?: TeacherAttendance["statusHari"];
  statusIzin: "proses" | "disetujui" | "ditolak";
  catatan?: string;
}

interface BarisAbsen {
  user_id: string;
  sekolah_uuid: string;
  local_id: number;
  guru_id: number;
  tanggal: string;
  jam_masuk: string | null;
  jam_pulang: string | null;
  selfie_masuk_url: string | null;
  selfie_pulang_url: string | null;
  verifikasi_masuk: boolean | null;
  verifikasi_pulang: boolean | null;
  lokasi_masuk_lat: number | null;
  lokasi_masuk_lng: number | null;
  lokasi_pulang_lat: number | null;
  lokasi_pulang_lng: number | null;
  jarak_masuk_meter: number | null;
  jarak_pulang_meter: number | null;
  status_masuk: string | null;
  status_pulang: string | null;
  status_hari: string | null;
  status_izin: string | null;
  catatan: string | null;
  diubah_pada: number;
  last_synced_at: number;
}

// ---------------------------------------------------------------- util ----

function bacaJson<T>(kunci: string, cadangan: T): T {
  try {
    const raw = localStorage.getItem(kunci);
    return raw ? (JSON.parse(raw) as T) : cadangan;
  } catch {
    return cadangan;
  }
}

function tulisJson(kunci: string, nilai: unknown) {
  try {
    localStorage.setItem(kunci, JSON.stringify(nilai));
  } catch {
    /* storage penuh/diblokir — antrean hilang, absen tetap ada di lokal */
  }
}

const n = <T,>(v: T | undefined): T | null => (v === undefined ? null : v);
const u = <T,>(v: T | null): T | undefined => (v === null ? undefined : v);

function keBarisAbsen(
  rec: TeacherAttendance,
  userId: string,
  sekolahUuid: string,
  selfie: { masuk: string | null; pulang: string | null },
): BarisAbsen {
  return {
    user_id: userId,
    sekolah_uuid: sekolahUuid,
    local_id: rec.id,
    guru_id: rec.guruId,
    tanggal: rec.tanggal,
    jam_masuk: n(rec.jamMasuk),
    jam_pulang: n(rec.jamPulang),
    selfie_masuk_url: selfie.masuk,
    selfie_pulang_url: selfie.pulang,
    verifikasi_masuk: n(rec.verifikasiWajahMasuk),
    verifikasi_pulang: n(rec.verifikasiWajahPulang),
    lokasi_masuk_lat: n(rec.lokasiMasukLat),
    lokasi_masuk_lng: n(rec.lokasiMasukLng),
    lokasi_pulang_lat: n(rec.lokasiPulangLat),
    lokasi_pulang_lng: n(rec.lokasiPulangLng),
    jarak_masuk_meter: n(rec.jarakMasukMeter),
    jarak_pulang_meter: n(rec.jarakPulangMeter),
    status_masuk: n(rec.statusMasuk),
    // EARLY disimpan sebagai 'LATE' di cloud (lihat migrasi 00306).
    status_pulang: rec.statusPulang === "EARLY" ? "LATE" : n(rec.statusPulang),
    status_izin: n(rec.statusIzin),
    status_hari: n(rec.statusHari),
    catatan: n(rec.catatan),
    diubah_pada: rec.diubahPada || timestamp(),
    last_synced_at: timestamp(),
  };
}

function dariBarisAbsen(row: BarisAbsen, guruId: number): TeacherAttendance {
  const selfie = (p: string | null) => (p ? `${PREFIX_STORAGE}${p}` : undefined);
  return {
    id: attendanceIdFrom(guruId, row.tanggal),
    guruId,
    tanggal: row.tanggal,
    jamMasuk: u(row.jam_masuk),
    jamPulang: u(row.jam_pulang),
    selfieMasukUrl: selfie(row.selfie_masuk_url),
    selfiePulangUrl: selfie(row.selfie_pulang_url),
    verifikasiWajahMasuk: u(row.verifikasi_masuk),
    verifikasiWajahPulang: u(row.verifikasi_pulang),
    lokasiMasukLat: u(row.lokasi_masuk_lat),
    lokasiMasukLng: u(row.lokasi_masuk_lng),
    lokasiPulangLat: u(row.lokasi_pulang_lat),
    lokasiPulangLng: u(row.lokasi_pulang_lng),
    jarakMasukMeter: u(row.jarak_masuk_meter),
    jarakPulangMeter: u(row.jarak_pulang_meter),
    statusMasuk: u(row.status_masuk) as TeacherAttendance["statusMasuk"],
    statusPulang: (row.status_pulang === "LATE" ? "EARLY" : u(row.status_pulang)) as TeacherAttendance["statusPulang"],
    statusIzin: u(row.status_izin) as TeacherAttendance["statusIzin"],
    statusHari: u(row.status_hari) as TeacherAttendance["statusHari"],
    catatan: u(row.catatan),
    diubahPada: row.diubah_pada,
  };
}

/** Gabungkan record dari cloud ke Dexie. Yang lebih baru menang. */
async function gabungKeLokal(dariCloud: TeacherAttendance): Promise<boolean> {
  const lokal = await db.teacherAttendance.get(dariCloud.id);
  if (lokal && (lokal.diubahPada || 0) > (dariCloud.diubahPada || 0)) return false;
  const pakaiLokal = (l?: string, c?: string) => (l && l.startsWith("data:") ? l : c);
  await db.teacherAttendance.put({
    ...dariCloud,
    selfieMasukUrl: pakaiLokal(lokal?.selfieMasukUrl, dariCloud.selfieMasukUrl),
    selfiePulangUrl: pakaiLokal(lokal?.selfiePulangUrl, dariCloud.selfiePulangUrl),
  });
  return true;
}

function sekolahLokalDari(s: BarisSekolah, lama?: School): School {
  return {
    ...(lama ?? { jenjang: Jenjang.SD, dibuatPada: timestamp() }),
    id: s.local_id,
    nama: s.nama,
    lat: u(s.lat),
    lng: u(s.lng),
    radiusMeter: s.radius_meter,
    jamMasukStandar: s.jam_masuk,
    jamPulangStandar: s.jam_pulang,
    toleransiTerlambatMenit: s.toleransi_menit,
    mulaiPresensiMasuk: u(s.mulai_masuk),
    batasPresensiPulang: u(s.batas_pulang),
    diubahPada: timestamp(),
  } as School;
}

async function dataUrlKeBlob(dataUrl: string): Promise<Blob> {
  const resp = await fetch(dataUrl);
  return resp.blob();
}

// ================================================================ GURU ====

export const guruCloud = {
  /** Info perangkat guru yang sudah tersambung cloud, atau null. */
  info(): InfoPerangkatGuru | null {
    return bacaJson<InfoPerangkatGuru | null>(KUNCI_PERANGKAT, null);
  },

  aktif(): boolean {
    return this.info() !== null;
  },

  jumlahAntrian(): number {
    return bacaJson<number[]>(KUNCI_ANTRIAN, []).length;
  },

  /**
   * Login guru lewat cloud lalu siapkan perangkat: data sekolah & guru
   * ditulis ke Dexie, riwayat ditarik. Melempar Error berpesan siap-tampil.
   */
  async masuk(kode: string, pin: string): Promise<{ guruId: number }> {
    const email = `${kode.trim().toLowerCase()}@guru.local`;
    const { data: login, error } = await supabaseGuru.auth.signInWithPassword({
      email,
      password: passwordDariPin(pin),
    });
    if (error || !login.user) {
      if (error && /fetch|network/i.test(error.message)) {
        throw new Error("Tidak ada koneksi internet");
      }
      throw new Error("Kode atau PIN salah");
    }
    const uid = login.user.id;

    const { data: guru } = await supabaseGuru
      .from("cloud_guru_teachers")
      .select("user_id, local_id, nama, nip, jabatan, kode_login, sekolah_uuid, status_aktif, verifikator")
      .eq("user_id", uid)
      .maybeSingle<BarisGuru & { verifikator: boolean }>();
    if (!guru || !guru.status_aktif || !guru.sekolah_uuid) {
      await supabaseGuru.auth.signOut();
      throw new Error("Akun guru ini sudah tidak aktif. Hubungi Ops / Kepala Sekolah.");
    }

    const { data: sekolah } = await supabaseGuru
      .from("cloud_guru_sekolah")
      .select("*")
      .eq("id", guru.sekolah_uuid)
      .maybeSingle<BarisSekolah>();
    if (!sekolah) {
      await supabaseGuru.auth.signOut();
      throw new Error("Data sekolah belum tersedia. Minta admin membuka aplikasi sekali.");
    }

    // Perangkat yang sudah dipakai sekolah lain tidak boleh ditimpa diam-diam.
    const sekolahLokal = await db.schools.toArray();
    if (sekolahLokal.length > 0 && !sekolahLokal.some((s) => s.id === sekolah.local_id)) {
      await supabaseGuru.auth.signOut();
      throw new Error("Perangkat ini sudah dipakai untuk sekolah lain.");
    }

    const perangkatBaru = sekolahLokal.length === 0 && (await db.teachers.count()) === 0;
    const lama = sekolahLokal.find((s) => s.id === sekolah.local_id);
    await db.schools.put(sekolahLokalDari(sekolah, lama));

    const now = timestamp();
    const guruLokal: Teacher = {
      ...(await db.teachers.get(guru.local_id)),
      id: guru.local_id,
      nama: guru.nama,
      email: "",
      sekolahId: sekolah.local_id,
      tier: Tier.FREE,
      role: guru.verifikator ? "ks" : "guru",
      jabatan: u(guru.jabatan),
      nip: u(guru.nip),
      kodeLogin: guru.kode_login ?? kode.trim(),
      pin: pin.trim(),
      statusAktif: true,
      hariAktifMode: "Kustom",
      hariAktifCustom: sekolah.hari_aktif,
      dibuatPada: now,
      diubahPada: now,
    };
    await db.teachers.put(guruLokal);

    tulisJson(KUNCI_PERANGKAT, {
      uid,
      sekolahUuid: sekolah.id,
      guruId: guru.local_id,
      sekolahId: sekolah.local_id,
      perangkatBaru,
    } satisfies InfoPerangkatGuru);

    await this.tarikRiwayat(90).catch(() => 0);
    return { guruId: guru.local_id };
  },

  /** Perbarui setelan sekolah (titik, radius, jam) dari cloud. */
  async perbaruiSekolah(): Promise<boolean> {
    const info = this.info();
    if (!info || !navigator.onLine) return false;
    const { data: sekolah } = await supabaseGuru
      .from("cloud_guru_sekolah")
      .select("*")
      .eq("id", info.sekolahUuid)
      .maybeSingle<BarisSekolah>();
    if (!sekolah) return false;
    const lama = await db.schools.get(sekolah.local_id);
    await db.schools.put(sekolahLokalDari(sekolah, lama));
    const g = await db.teachers.get(info.guruId);
    if (g && g.hariAktifCustom !== sekolah.hari_aktif) {
      await db.teachers.put({ ...g, hariAktifMode: "Kustom", hariAktifCustom: sekolah.hari_aktif });
    }
    return true;
  },

  /** Tarik riwayat absen guru ini dari cloud ke Dexie. */
  /** Apakah guru ini ditunjuk admin sebagai verifikator izin (mis. Kepala Sekolah)? */
  async cekVerifikator(): Promise<boolean> {
    const info = this.info();
    if (!info || !navigator.onLine) return false;
    const { data } = await supabaseGuru
      .from("cloud_guru_teachers")
      .select("verifikator")
      .eq("user_id", info.uid)
      .maybeSingle<{ verifikator: boolean }>();
    return !!data?.verifikator;
  },

  /**
   * HP Kepala Sekolah: tarik daftar guru + presensi sekolah (RLS hanya
   * meloloskannya untuk verifikator; guru biasa hanya mendapat datanya sendiri).
   */
  async tarikSekolah(dari: string, sampai: string): Promise<number> {
    const info = this.info();
    if (!info || !navigator.onLine) return 0;
    const { data: guru } = await supabaseGuru
      .from("cloud_guru_teachers")
      .select("user_id, local_id, nama, nip, jabatan, kode_login, status_aktif, verifikator");
    const keLokal = new Map<string, number>();
    for (const g of (guru ?? []) as (BarisGuru & { verifikator: boolean })[]) {
      const id = Number(g.local_id);
      keLokal.set(g.user_id, id);
      if (id === info.guruId) continue;
      const lama = await db.teachers.get(id);
      await db.teachers.put({
        ...(lama ?? { email: "", tier: Tier.FREE, dibuatPada: timestamp() }),
        id,
        nama: g.nama,
        sekolahId: info.sekolahId,
        role: g.verifikator ? "ks" : "guru",
        jabatan: u(g.jabatan),
        nip: u(g.nip),
        kodeLogin: u(g.kode_login),
        statusAktif: g.status_aktif,
        diubahPada: timestamp(),
      } as Teacher);
    }
    const { data } = await supabaseGuru
      .from("cloud_guru_attendance")
      .select("*")
      .gte("tanggal", dari)
      .lte("tanggal", sampai);
    let berubah = 0;
    for (const row of (data ?? []) as BarisAbsen[]) {
      const guruId = keLokal.get(row.user_id);
      if (guruId != null && (await gabungKeLokal(dariBarisAbsen(row, guruId)))) berubah++;
    }
    return berubah;
  },

  /** HP Kepala Sekolah: simpan perubahan presensi guru lain ke cloud. */
  async kirimAbsenSekolah(guruLocalId: number, rec: TeacherAttendance): Promise<"terkirim" | "tertunda"> {
    const info = this.info();
    if (!info) return "tertunda";
    if (guruLocalId === info.guruId) return (await this.kirimAbsen(rec.id)) ? "terkirim" : "tertunda";
    if (!navigator.onLine) return "tertunda";
    const { data: g } = await supabaseGuru
      .from("cloud_guru_teachers")
      .select("user_id")
      .eq("local_id", guruLocalId)
      .maybeSingle<{ user_id: string }>();
    if (!g) return "tertunda";
    // Foto tidak dikirim dari sini; server mempertahankan foto lama.
    const path = (v?: string) => (v?.startsWith(PREFIX_STORAGE) ? v.slice(PREFIX_STORAGE.length) : null);
    const { error } = await supabaseGuru
      .from("cloud_guru_attendance")
      .upsert(keBarisAbsen(rec, g.user_id, info.sekolahUuid, { masuk: path(rec.selfieMasukUrl), pulang: path(rec.selfiePulangUrl) }), {
        onConflict: "user_id,tanggal",
      });
    return error ? "tertunda" : "terkirim";
  },

  async tarikRiwayat(hari = 35): Promise<number> {
    const info = this.info();
    if (!info) return 0;
    const dari = addDays(todayStr(), -hari);
    const { data, error } = await supabaseGuru
      .from("cloud_guru_attendance")
      .select("*")
      .eq("user_id", info.uid)
      .gte("tanggal", dari);
    if (error || !data) return 0;
    let berubah = 0;
    for (const row of data as BarisAbsen[]) {
      if (await gabungKeLokal(dariBarisAbsen(row, info.guruId))) berubah++;
    }
    return berubah;
  },

  /** Unggah selfie (kalau masih data URL) dan kembalikan path Storage. */
  async unggahSelfie(
    info: InfoPerangkatGuru,
    url: string | undefined,
    tanggal: string,
    jenis: "masuk" | "pulang",
  ): Promise<string | null> {
    if (!url) return null;
    if (url.startsWith(PREFIX_STORAGE)) return url.slice(PREFIX_STORAGE.length);
    if (!url.startsWith("data:")) return null;

    const path = `${info.sekolahUuid}/${info.uid}/${tanggal}-${jenis}.jpg`;
    const sudah = bacaJson<string[]>(KUNCI_TERUNGGAH, []);
    if (sudah.includes(path)) return path;

    const blob = await dataUrlKeBlob(url);
    const { error } = await supabaseGuru.storage
      .from(BUCKET)
      .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
    if (error) throw error;
    tulisJson(KUNCI_TERUNGGAH, [...sudah.slice(-200), path]);
    return path;
  },

  /**
   * Kirim satu record absen ke cloud. Kalau gagal (offline, sesi habis),
   * id-nya masuk antrean untuk dikirim ulang. Mengembalikan true kalau terkirim.
   */
  async kirimAbsen(recordId: number): Promise<boolean> {
    const info = this.info();
    if (!info) return false;
    const rec = await db.teacherAttendance.get(recordId);
    if (!rec) return true; // tidak ada yang perlu dikirim

    try {
      if (!navigator.onLine) throw new Error("offline");
      const { data: sesi } = await supabaseGuru.auth.getSession();
      if (!sesi.session) throw new Error("sesi habis");

      const masuk = await this.unggahSelfie(info, rec.selfieMasukUrl, rec.tanggal, "masuk");
      const pulang = await this.unggahSelfie(info, rec.selfiePulangUrl, rec.tanggal, "pulang");

      const { error } = await supabaseGuru
        .from("cloud_guru_attendance")
        .upsert(keBarisAbsen(rec, info.uid, info.sekolahUuid, { masuk, pulang }), {
          onConflict: "user_id,tanggal",
        });
      if (error) throw error;

      const antrian = bacaJson<number[]>(KUNCI_ANTRIAN, []).filter((x) => x !== recordId);
      tulisJson(KUNCI_ANTRIAN, antrian);
      return true;
    } catch {
      const antrian = bacaJson<number[]>(KUNCI_ANTRIAN, []);
      if (!antrian.includes(recordId)) tulisJson(KUNCI_ANTRIAN, [...antrian, recordId]);
      return false;
    }
  },

  /** Kirim ulang semua absen yang tertunda. Mengembalikan sisa antrean. */
  async kirimAntrian(): Promise<number> {
    const antrian = bacaJson<number[]>(KUNCI_ANTRIAN, []);
    for (const id of antrian) {
      await this.kirimAbsen(id);
    }
    return this.jumlahAntrian();
  },

  /** URL sementara untuk menampilkan selfie yang tersimpan di Storage. */
  async urlSelfie(nilai: string | undefined): Promise<string | null> {
    if (!nilai) return null;
    if (/^(data:|https?:|blob:)/.test(nilai)) return nilai;
    // Path Storage: berawalan "sb:" (dari HP guru) atau mentah (dari link /g/token lewat sinkron).
    const path = nilai.startsWith(PREFIX_STORAGE) ? nilai.slice(PREFIX_STORAGE.length) : nilai;
    const klien = this.aktif() ? supabaseGuru : supabase;
    const { data } = await klien.storage.from(BUCKET).createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  },

  /**
   * Keluar dari sesi cloud guru. Di HP guru sendiri (perangkatBaru) data lokal
   * juga dihapus supaya HP yang dipinjam tidak menyimpan data guru; di HP
   * admin / perangkat bersama data lokal TIDAK disentuh. Panggil setelah
   * antrean kosong (atau guru setuju data tertunda hilang).
   * Mengembalikan true kalau data lokal dihapus.
   */
  async keluar(): Promise<boolean> {
    const info = this.info();
    await supabaseGuru.auth.signOut().catch(() => {});
    const hapus = !!info?.perangkatBaru;
    if (hapus) {
      await db.transaction("rw", db.teachers, db.schools, db.teacherAttendance, async () => {
        await db.teacherAttendance.clear();
        await db.teachers.clear();
        await db.schools.clear();
      });
    }
    for (const k of [KUNCI_PERANGKAT, KUNCI_ANTRIAN, KUNCI_TERUNGGAH]) {
      try { localStorage.removeItem(k); } catch { /* abaikan */ }
    }
    return hapus;
  },
};

// =============================================================== ADMIN ====

async function uidAdmin(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

export const adminCloud = {
  /** Uid admin kalau sedang login cloud dan online. */
  async siap(): Promise<string | null> {
    if (!navigator.onLine) return null;
    return uidAdmin();
  },

  /**
   * Daftarkan / perbarui sekolah milik admin di cloud. Wajib sebelum guru
   * bisa dibuatkan akun, dan supaya HP guru tahu titik & jam sekolah.
   */
  async daftarkanSekolah(school: School, adminTeacher?: Teacher | null): Promise<string | null> {
    const uid = await this.siap();
    if (!uid) return null;
    const { data, error } = await supabase
      .from("cloud_guru_sekolah")
      .upsert(
        {
          owner_user_id: uid,
          local_id: school.id,
          nama: school.nama,
          lat: n(school.lat),
          lng: n(school.lng),
          radius_meter: school.radiusMeter ?? 100,
          jam_masuk: school.jamMasukStandar ?? "07:00",
          jam_pulang: school.jamPulangStandar ?? "15:00",
          toleransi_menit: school.toleransiTerlambatMenit ?? 15,
          mulai_masuk: n(school.mulaiPresensiMasuk),
          batas_pulang: n(school.batasPresensiPulang),
          hari_aktif: getActiveDays(adminTeacher ?? undefined).join(","),
          diubah_pada: timestamp(),
        },
        { onConflict: "owner_user_id" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data?.id ?? null;
  },

  /** Peta guru lokal → akun cloud (hanya guru sekolah milik admin, via RLS). */
  async petaGuru(): Promise<Map<number, { userId: string; aktif: boolean }>> {
    const peta = new Map<number, { userId: string; aktif: boolean }>();
    if (!(await this.siap())) return peta;
    const { data } = await supabase
      .from("cloud_guru_teachers")
      .select("user_id, local_id, status_aktif");
    for (const r of (data ?? []) as Pick<BarisGuru, "user_id" | "local_id" | "status_aktif">[]) {
      peta.set(Number(r.local_id), { userId: r.user_id, aktif: r.status_aktif });
    }
    return peta;
  },

  /** Tarik absen guru sekolah ini dari cloud ke Dexie untuk rentang tanggal. */
  async tarikAbsen(dari: string, sampai: string): Promise<number> {
    // HP Kepala Sekolah (login sebagai guru) menarik lewat akun gurunya.
    if (!(await this.siap())) return guruCloud.aktif() ? guruCloud.tarikSekolah(dari, sampai) : 0;
    const peta = await this.petaGuru();
    if (peta.size === 0) return 0;
    const keGuru = new Map<string, number>();
    peta.forEach((v, localId) => keGuru.set(v.userId, localId));

    const { data, error } = await supabase
      .from("cloud_guru_attendance")
      .select("*")
      .gte("tanggal", dari)
      .lte("tanggal", sampai);
    if (error || !data) return 0;

    let berubah = 0;
    for (const row of data as BarisAbsen[]) {
      const guruId = keGuru.get(row.user_id);
      if (guruId == null) continue;
      if (await gabungKeLokal(dariBarisAbsen(row, guruId))) berubah++;
    }
    return berubah;
  },

  /** Kirim perubahan absen yang dibuat admin (status / jam manual) ke cloud. */
  /**
   * Kirim absen dari perangkat admin/bersama ke cloud.
   * "lokal" = sekolah atau guru ini memang tidak memakai cloud.
   */
  async kirimAbsen(guruLocalId: number, rec: TeacherAttendance): Promise<"terkirim" | "tertunda" | "lokal"> {
    // Sekolah tanpa akun cloud: cukup lokal, jangan menumpuk antrean.
    const uid = await uidAdmin();
    if (!uid) return guruCloud.aktif() ? guruCloud.kirimAbsenSekolah(guruLocalId, rec) : "lokal";
    if (!navigator.onLine) {
      this.antrekan(guruLocalId, rec.id);
      return "tertunda";
    }
    const peta = await this.petaGuru();
    const akun = peta.get(guruLocalId);
    if (!akun) return "lokal"; // guru belum punya akun cloud
    const { data: sekolah } = await supabase
      .from("cloud_guru_sekolah")
      .select("id")
      .eq("owner_user_id", uid)
      .maybeSingle();
    if (!sekolah) return "lokal";

    try {
      // Selfie dari perangkat bersama masih data URL → unggah atas nama admin.
      const unggah = async (v: string | undefined, jenis: "masuk" | "pulang") => {
        if (!v) return null;
        if (v.startsWith(PREFIX_STORAGE)) return v.slice(PREFIX_STORAGE.length);
        if (!v.startsWith("data:")) return null;
        const path = `${sekolah.id}/${akun.userId}/${rec.tanggal}-${jenis}.jpg`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, await dataUrlKeBlob(v), { upsert: true, contentType: "image/jpeg" });
        if (error) throw error;
        return path;
      };
      const masuk = await unggah(rec.selfieMasukUrl, "masuk");
      const pulang = await unggah(rec.selfiePulangUrl, "pulang");

      const { error } = await supabase
        .from("cloud_guru_attendance")
        .upsert(keBarisAbsen(rec, akun.userId, sekolah.id, { masuk, pulang }), {
          onConflict: "user_id,tanggal",
        });
      if (error) throw error;
      this.lepasAntrian(rec.id);
      return "terkirim";
    } catch {
      this.antrekan(guruLocalId, rec.id);
      return "tertunda";
    }
  },

  /** Antrean absen dari perangkat bersama yang belum terkirim (admin offline). */
  antrekan(guruLocalId: number, recordId: number) {
    const a = bacaJson<{ guruId: number; id: number }[]>(KUNCI_ANTRIAN_ADMIN, []);
    if (!a.some((x) => x.id === recordId)) tulisJson(KUNCI_ANTRIAN_ADMIN, [...a, { guruId: guruLocalId, id: recordId }]);
  },

  lepasAntrian(recordId: number) {
    const a = bacaJson<{ guruId: number; id: number }[]>(KUNCI_ANTRIAN_ADMIN, []);
    tulisJson(KUNCI_ANTRIAN_ADMIN, a.filter((x) => x.id !== recordId));
  },

  /** Kirim ulang antrean perangkat bersama. Dipanggil saat Dashboard dibuka. */
  async kirimAntrian(): Promise<void> {
    if (!(await this.siap())) return;
    const a = bacaJson<{ guruId: number; id: number }[]>(KUNCI_ANTRIAN_ADMIN, []);
    for (const x of a) {
      const rec = await db.teacherAttendance.get(x.id);
      if (!rec) { this.lepasAntrian(x.id); continue; }
      await this.kirimAbsen(x.guruId, rec);
    }
  },

  /** Tunjuk / cabut guru sebagai verifikator izin. false = guru belum punya akun cloud. */
  async aturVerifikator(guruLocalId: number, verifikator: boolean): Promise<boolean> {
    if (!(await this.siap())) return false;
    const { data, error } = await supabase
      .from("cloud_guru_teachers")
      .update({ verifikator, diubah_pada: timestamp() })
      .eq("local_id", guruLocalId)
      .select("user_id");
    if (error) throw new Error(error.message);
    return (data ?? []).length > 0;
  },

  /** Nonaktifkan akun cloud guru (dipanggil saat guru dihapus). */
  async nonaktifkanGuru(guruLocalId: number): Promise<void> {
    if (!(await this.siap())) return;
    await supabase
      .from("cloud_guru_teachers")
      .update({ status_aktif: false, diubah_pada: timestamp() })
      .eq("local_id", guruLocalId);
  },
};
