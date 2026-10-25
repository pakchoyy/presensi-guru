import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "YYYY-MM-DD" menurut tanggal LOKAL perangkat (bukan UTC). */
export function ymdLokal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Dulu memakai toISOString() (UTC): di WIB, absen sebelum 07:00 tercatat di
// tanggal kemarin.
export function todayStr(): string {
  return ymdLokal(new Date());
}

export function formatTanggalPendek(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
}

export function formatTanggalPanjang(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function inisial(nama: string): string {
  return nama
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function timestamp(): number {
  return Date.now();
}

export function generateId(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
}

// Hash 64-bit ke integer 53-bit yang aman (cyrb53 adaptation).
// Dipakai untuk id deterministik supaya peranti yg sama menghasilkan id sama
// (mencegah sesi/record ganda saat 2 perangkat membuka pada waktu bersamaan).
function hashString(value: string): number {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function attendanceIdFrom(guruId: number, tanggal: string): number {
  return hashString(`ta:${guruId}:${tanggal}`);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return ymdLokal(d);
}

export function getMonthLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export function getActiveDays(teacher?: { hariAktifMode?: string; hariAktifCustom?: string }): number[] {
  const stored = localStorage.getItem("bgy_hari_aktif");
  const custom = localStorage.getItem("bgy_hari_aktif_custom");
  const mode = teacher?.hariAktifMode || stored || "Senin-Sabtu";
  const customDays = teacher?.hariAktifCustom || custom;

  if (mode === "Senin-Jumat") return [1, 2, 3, 4, 5];
  if (mode === "Senin-Sabtu") return [1, 2, 3, 4, 5, 6];
  if (customDays) return customDays.split(",").map(Number).filter((n) => n >= 0 && n <= 6);
  return [1, 2, 3, 4, 5, 6];
}

export function isDayActive(day: number, teacher?: { hariAktifMode?: string; hariAktifCustom?: string }): boolean {
  return getActiveDays(teacher).includes(day);
}

/**
 * Apakah suatu tanggal (YYYY-MM-DD) termasuk HARI EFEKTIF / hari masuk?
 * Yaitu: hari aktif menurut setting (Senin-Jumat/Sabtu/Kustom) DAN bukan
 * hari libur di kalender akademik. `liburSet` = Set tanggal ISO yang libur.
 */
export function isHariEfektif(
  tanggalISO: string,
  teacher?: { hariAktifMode?: string; hariAktifCustom?: string },
  liburSet?: Set<string>
): boolean {
  if (liburSet && liburSet.has(tanggalISO)) return false;
  const dow = new Date(tanggalISO + "T00:00:00").getDay();
  return isDayActive(dow, teacher);
}

export function getHariAktifLabel(teacher?: { hariAktifMode?: string; hariAktifCustom?: string }): string {
  const mode = teacher?.hariAktifMode || localStorage.getItem("bgy_hari_aktif") || "Senin-Sabtu";
  if (mode !== "Kustom") {
    if (mode === "Senin-Jumat") return "Senin - Jumat";
    if (mode === "Senin-Sabtu") return "Senin - Sabtu";
    return mode;
  }
  const days = getActiveDays(teacher);
  if (days.length === 7) return "Setiap hari";
  return days.map((d) => DAY_LABELS[d]).join(", ");
}

export function getMonthsInRange(start: string, end: string): string[] {
  const months: string[] = [];
  const startDate = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  while (current <= endDate) {
    months.push(
      current.toLocaleDateString("id-ID", { month: "long", year: "numeric" })
    );
    current.setMonth(current.getMonth() + 1);
  }
  return months;
}

/**
 * PIN acak untuk akun guru. Bawaan 6 digit (1 juta kombinasi, jauh lebih
 * sulit ditebak daripada 4 digit); PIN 4 digit lama tetap diterima.
 */
export function randomPin(len: 4 | 6 = 6): string {
  let s = "";
  for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 10);
  return s;
}

/** Kode login otomatis untuk guru tanpa NIP. */
export function randomKode(): string {
  return `G-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Password akun cloud guru, diturunkan dari PIN.
 * Supabase mewajibkan password minimal 6 karakter, sedangkan PIN guru 4-6
 * digit. PIN tetap yang diketik guru; prefix ini hanya memenuhi syarat panjang
 * (bukan rahasia — kekuatan tetap setara PIN). HARUS sama dengan Edge Function
 * create-guru-account, reset-guru-pin, dan register-push.
 */
export function passwordDariPin(pin: string): string {
  return `pyg-${pin.trim()}`;
}

/** Zona waktu Indonesia dari jam HP (WIB/WITA/WIT); kosong kalau di luar ketiganya. */
export function zonaWaktu(): string {
  const off = -new Date().getTimezoneOffset();
  return off === 420 ? "WIB" : off === 480 ? "WITA" : off === 540 ? "WIT" : "";
}

/** Label peran untuk ditampilkan; guru biasa tidak diberi label. */
export function labelPeran(t: { role?: string }): string | null {
  return t.role === "ks" ? "Kepala Sekolah" : t.role === "admin" ? "Admin" : null;
}
