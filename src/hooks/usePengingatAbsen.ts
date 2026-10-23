import { useCallback, useEffect, useState } from "react";
import { useAbsenReminder } from "@/hooks/useAbsenReminder";
import { pushService, pushDidukung, type KonfigPengingat } from "@/services/push.service";
import { getActiveDays } from "@/lib/utils";
import type { Teacher } from "@/types/entities";

/** Pengingat dikirim sekian menit sebelum batas absen. */
export const MENIT_SEBELUM_BATAS = 5;

export type ModePengingat =
  | "unsupported" // browser tidak mendukung notifikasi sama sekali
  | "off"         // mati
  | "denied"      // izin notifikasi diblokir
  | "lokal"       // jalan selama aplikasi terbuka
  | "push";       // Web Push — jalan walau aplikasi tertutup

/** Tambah/kurangi menit pada "HH:MM", hasil tetap dalam 24 jam. */
function geserJam(hhmm: string, menit: number): string {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm.slice(0, 5);
  const total = (h * 60 + m + menit + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export interface KontrolPengingat {
  mode: ModePengingat;
  memuat: boolean;
  nyalakan: () => Promise<{ mode: ModePengingat; catatan?: string }>;
  matikan: () => Promise<void>;
  /** Jam notifikasi dikirim (HH:MM). */
  ingatMasuk: string;
  ingatPulang: string;
}

/**
 * Pengingat absen dengan dua tingkat:
 *  1. Web Push (lewat Supabase) — tetap bunyi walau aplikasi tertutup.
 *  2. Kalau push tidak bisa (guru belum punya akun cloud, browser menolak,
 *     mode lokal/demo), otomatis turun ke pengingat dalam aplikasi.
 */
export function usePengingatAbsen({
  guru,
  jamMasuk,
  jamPulang,
  sekolahId,
  toleransiMenit = 15,
  sudahMasuk,
  sudahPulang,
}: {
  guru?: Teacher;
  jamMasuk?: string;
  jamPulang?: string;
  sekolahId?: number;
  toleransiMenit?: number;
  sudahMasuk: boolean;
  sudahPulang: boolean;
}): KontrolPengingat {
  const [pushAktif, setPushAktif] = useState(false);
  const [memuat, setMemuat] = useState(true);

  // Satu kali saja, 5 menit sebelum batas absen — bukan diingatkan terus.
  const jamM = (jamMasuk ?? "07:00").slice(0, 5);
  const jamP = (jamPulang ?? "13:00").slice(0, 5);
  const batasMasuk = geserJam(jamM, toleransiMenit);
  const ingatMasuk = geserJam(batasMasuk, -MENIT_SEBELUM_BATAS);
  const ingatPulang = geserJam(jamP, -MENIT_SEBELUM_BATAS);
  const teksMasuk = `Batas presensi masuk ${batasMasuk} — tinggal ${MENIT_SEBELUM_BATAS} menit lagi.`;
  const teksPulang = `Jam pulang ${jamP} — jangan lupa presensi pulang.`;

  // Pengingat dalam aplikasi hanya dipakai kalau push tidak aktif, supaya
  // notifikasinya tidak dobel.
  const lokal = useAbsenReminder({
    jamMasuk: pushAktif ? undefined : ingatMasuk,
    jamPulang: pushAktif ? undefined : ingatPulang,
    menitSebelum: 0,
    teksMasuk,
    teksPulang,
    sudahMasuk,
    sudahPulang,
  });

  useEffect(() => {
    let batal = false;
    pushService
      .statusLangganan()
      .then((ada) => { if (!batal) setPushAktif(ada); })
      .finally(() => { if (!batal) setMemuat(false); });
    return () => { batal = true; };
  }, []);

  const identitas = guru
    ? {
        kodeLogin: guru.kodeLogin || guru.nip || String(guru.id),
        pin: guru.pin ?? "",
        sekolahId,
      }
    : null;

  const konfig: KonfigPengingat = {
    jamMasuk: jamM,
    jamPulang: jamP,
    batasMasuk,
    ingatMasuk,
    ingatPulang,
    hariAktif: getActiveDays(guru),
  };

  const mode: ModePengingat = pushAktif
    ? "push"
    : lokal.state === "on"
      ? "lokal"
      : lokal.state === "denied"
        ? "denied"
        : lokal.state === "unsupported"
          ? "unsupported"
          : "off";

  const nyalakan = useCallback(async (): Promise<{ mode: ModePengingat; catatan?: string }> => {
    // Coba Web Push dulu.
    if (pushDidukung() && identitas && identitas.pin) {
      try {
        await pushService.nyalakan(identitas, konfig);
        setPushAktif(true);
        return { mode: "push" };
      } catch (e) {
        const pesan = e instanceof Error ? e.message : String(e);
        if (/ditolak|denied/i.test(pesan)) return { mode: "denied", catatan: pesan };
        // Push gagal (mis. akun guru belum ada di cloud) → turun ke lokal.
        const hasil = await lokal.nyalakan();
        return hasil === "on"
          ? { mode: "lokal", catatan: pesan }
          : { mode: hasil === "denied" ? "denied" : "off", catatan: pesan };
      }
    }

    const hasil = await lokal.nyalakan();
    if (hasil === "on") return { mode: "lokal" };
    if (hasil === "denied") return { mode: "denied" };
    return { mode: hasil === "unsupported" ? "unsupported" : "off" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identitas?.kodeLogin, identitas?.pin, konfig.ingatMasuk, konfig.ingatPulang, lokal.nyalakan]);

  const matikan = useCallback(async () => {
    if (pushAktif && identitas) {
      await pushService.matikan(identitas);
      setPushAktif(false);
    }
    lokal.matikan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushAktif, identitas?.kodeLogin, identitas?.pin, lokal.matikan]);

  return { mode, memuat, nyalakan, matikan, ingatMasuk, ingatPulang };
}
