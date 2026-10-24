// Deep link aktivasi dari toko: /aktivasi?email=...&kode=BGY-PG-XXXX
// Disimpan di sessionStorage supaya tetap ada walau user harus lewat wizard dulu.
const KEY = "bgy_aktivasi_link";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KODE_RE = /^BGY-[A-Z0-9-]{4,60}$/;

export interface AktivasiLink {
  email: string;
  kode: string;
}

/** Tangkap parameter dari URL /aktivasi, simpan, lalu bersihkan URL. */
export function captureAktivasiLink(): boolean {
  if (typeof window === "undefined" || !/^\/aktivasi\/?$/.test(window.location.pathname)) return false;
  const q = new URLSearchParams(window.location.search);
  const email = (q.get("email") || "").trim().toLowerCase().slice(0, 254);
  const kode = (q.get("kode") || "").trim().toUpperCase().slice(0, 64);
  const data: AktivasiLink = {
    email: EMAIL_RE.test(email) ? email : "",
    kode: KODE_RE.test(kode) ? kode : "",
  };
  try { sessionStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
  window.history.replaceState(null, "", "/");
  return true;
}

export function readAktivasiLink(): AktivasiLink | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AktivasiLink) : null;
  } catch {
    return null;
  }
}

export function clearAktivasiLink() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

// Link ajakan affiliate: ?ref=PY-XXXXXX di URL mana pun. Disimpan sampai aktivasi.
const REF_KEY = "py_ref";
const REF_RE = /^PY-[A-Z0-9]{6}$/;

export function captureRef() {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams(window.location.search);
  const ref = (q.get("ref") || "").trim().toUpperCase();
  if (!REF_RE.test(ref)) return;
  try { localStorage.setItem(REF_KEY, ref); } catch { /* ignore */ }
  q.delete("ref");
  const rest = q.toString();
  window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
}

export function readRef(): string {
  try { return localStorage.getItem(REF_KEY) || ""; } catch { return ""; }
}

export function clearRef() {
  try { localStorage.removeItem(REF_KEY); } catch { /* ignore */ }
}
