// Guru cloud service — tipis wrapper panggil Supabase Edge Functions
// create-guru-account & reset-guru-pin.
//
// Dipakai oleh GuruPage saat admin ONLINE + login. Kalau offline / belum
// login, caller fallback ke Dexie lokal (lihat GuruPage.handleSave).

import { supabase } from "@/lib/supabase";

type Role = "guru" | "admin" | "kepala" | "operator";

export interface CreateGuruInput {
  nama: string;
  sekolah_id: number;
  kode_login?: string;
  pin?: string;
  nip?: string;
  jabatan?: string;
  role?: Role;
  local_id?: number;
}

export interface CreateGuruResult {
  ok: true;
  user_id: string;
  row_id: number;
  kode_login: string;
  pin: string;
  email: string;
}

async function sessionBearer(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Belum login. Masuk sebagai admin dulu untuk sinkron ke cloud.");
  return token;
}

function endpoint(name: string): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)
    ?? (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined);
  if (!base) throw new Error("VITE_SUPABASE_URL tidak ter-set");
  return `${base.replace(/\/+$/, "")}/functions/v1/${name}`;
}

function apikey(): string | undefined {
  return (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
    ?? (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined);
}

async function callFn<T>(name: string, body: unknown): Promise<T> {
  const token = await sessionBearer();
  const res = await fetch(endpoint(name), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(apikey() ? { apikey: apikey()! } : {}),
    },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || j.error) {
    const err = (j.error as string | undefined) || `HTTP ${res.status}`;
    const detail = j.detail ? ` (${j.detail})` : "";
    throw new Error(`${err}${detail}`);
  }
  return j as unknown as T;
}

export const guruCloudService = {
  async createAccount(input: CreateGuruInput): Promise<CreateGuruResult> {
    return callFn<CreateGuruResult>("create-guru-account", input);
  },

  async resetPin(user_id: string, new_pin?: string): Promise<{ ok: true; new_pin: string }> {
    return callFn<{ ok: true; new_pin: string }>("reset-guru-pin", { user_id, new_pin });
  },

  /** Cek cepat apakah session cloud siap (admin sudah login). */
  async isReady(): Promise<boolean> {
    try {
      const { data } = await supabase.auth.getSession();
      return !!data.session?.access_token;
    } catch {
      return false;
    }
  },
};
