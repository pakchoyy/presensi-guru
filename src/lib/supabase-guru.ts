import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase KHUSUS sesi guru.
 *
 * Sengaja dipisah dari `supabase` (sesi admin) dengan storageKey sendiri.
 * Kalau sesi guru masuk ke client admin, AuthContext akan menganggap admin
 * sedang login dan sync admin bisa berjalan atas nama akun guru.
 */
const url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseGuru = createClient(url, anonKey, {
  auth: {
    storageKey: "bgy-guru-auth",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
