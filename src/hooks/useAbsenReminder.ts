import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "bgy_reminder_absen";
const LAST_KEY = "bgy_reminder_terakhir";

export type ReminderState = "unsupported" | "off" | "denied" | "on";

function sudahDitampilkan(slot: string): boolean {
  try {
    return localStorage.getItem(LAST_KEY) === slot;
  } catch {
    return false;
  }
}

function tandaiDitampilkan(slot: string) {
  try {
    localStorage.setItem(LAST_KEY, slot);
  } catch {
    /* storage diblokir — pengingat tetap jalan, cuma bisa dobel */
  }
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Pengingat absen harian berbasis Notification API.
 *
 * Catatan jujur soal batasan: tanpa server push, notifikasi hanya bisa muncul
 * selama aplikasi/PWA masih berjalan (tab terbuka atau baru dibuka). Pengingat
 * dicek tiap menit, dan tiap slot (masuk/pulang) hanya bunyi sekali per hari.
 */
export function useAbsenReminder({
  jamMasuk,
  jamPulang,
  menitSebelum = 0,
  teksMasuk,
  teksPulang,
  sudahMasuk,
  sudahPulang,
}: {
  /** Jam pengingat masuk ("HH:MM"), sudah dihitung pemanggil. */
  jamMasuk?: string;
  /** Jam pengingat pulang ("HH:MM"), sudah dihitung pemanggil. */
  jamPulang?: string;
  menitSebelum?: number;
  teksMasuk?: string;
  teksPulang?: string;
  sudahMasuk: boolean;
  sudahPulang: boolean;
}) {
  const didukung = typeof window !== "undefined" && "Notification" in window;

  const [aktif, setAktif] = useState<boolean>(() => {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });

  const statusRef = useRef({ sudahMasuk, sudahPulang });
  statusRef.current = { sudahMasuk, sudahPulang };

  const state: ReminderState = !didukung
    ? "unsupported"
    : Notification.permission === "denied"
      ? "denied"
      : aktif && Notification.permission === "granted"
        ? "on"
        : "off";

  const nyalakan = useCallback(async (): Promise<ReminderState> => {
    if (!didukung) return "unsupported";
    let izin = Notification.permission;
    if (izin === "default") izin = await Notification.requestPermission();
    if (izin !== "granted") return izin === "denied" ? "denied" : "off";
    try { localStorage.setItem(KEY, "1"); } catch { /* abaikan */ }
    setAktif(true);
    return "on";
  }, [didukung]);

  const matikan = useCallback(() => {
    try { localStorage.removeItem(KEY); } catch { /* abaikan */ }
    setAktif(false);
  }, []);

  useEffect(() => {
    if (state !== "on") return;

    const cek = () => {
      const now = new Date();
      const sekarang = hhmm(now);
      const hari = ymd(now);

      const waktuIngat = (jam?: string) => {
        if (!jam) return null;
        const [h, m] = jam.slice(0, 5).split(":").map(Number);
        if (Number.isNaN(h) || Number.isNaN(m)) return null;
        const total = h * 60 + m - menitSebelum;
        if (total < 0) return null;
        return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
      };

      const slotMasuk = waktuIngat(jamMasuk);
      const slotPulang = waktuIngat(jamPulang);

      if (slotMasuk && sekarang === slotMasuk && !statusRef.current.sudahMasuk) {
        const tanda = `${hari}:masuk`;
        if (!sudahDitampilkan(tanda)) {
          new Notification("Presensi Yuk | Guru", {
            body: teksMasuk ?? "Batas absen masuk sebentar lagi — jangan lupa absen datang.",
            icon: "/logo-presensiyuk.png?v=2",
            tag: tanda,
          });
          tandaiDitampilkan(tanda);
        }
      }

      if (slotPulang && sekarang === slotPulang && !statusRef.current.sudahPulang) {
        const tanda = `${hari}:pulang`;
        if (!sudahDitampilkan(tanda)) {
          new Notification("Presensi Yuk | Guru", {
            body: teksPulang ?? "Jangan lupa absen pulang.",
            icon: "/logo-presensiyuk.png?v=2",
            tag: tanda,
          });
          tandaiDitampilkan(tanda);
        }
      }
    };

    cek();
    const t = setInterval(cek, 60_000);
    return () => clearInterval(t);
  }, [state, jamMasuk, jamPulang, menitSebelum, teksMasuk, teksPulang]);

  return { state, nyalakan, matikan };
}
