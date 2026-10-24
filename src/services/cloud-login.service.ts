import { supabase } from "@/lib/supabase";
import { getDeviceId, getDeviceName } from "@/lib/device";
import type { Tier } from "@/types/enums";

export interface CloudDevice {
  id: number;
  name: string;
  lastActiveAt: number;
}

export type ConnectResult =
  | { ok: true; profileId: string; tier: Tier; tanggalBerakhir: number | null; limit: number; deviceCount: number }
  | { ok: false; code?: "DEVICE_LIMIT" | "NO_LICENSE" | string; error: string; devices?: CloudDevice[]; limit?: number };

function otpError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate") || m.includes("seconds") || m.includes("too many")) return "Terlalu sering minta kode. Tunggu sebentar lalu coba lagi.";
  if (m.includes("expired") || m.includes("invalid")) return "Kode salah atau sudah kedaluwarsa. Cek lagi atau minta kode baru.";
  if (m.includes("email")) return "Email tidak valid.";
  return "Gagal memproses kode. Periksa koneksi internet lalu coba lagi.";
}

async function callApi(body: Record<string, unknown>): Promise<{ status: number; data: any }> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return { status: 401, data: { error: "Verifikasi email dulu" } };
  const res = await fetch("/api/cloud-login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

export const cloudLoginService = {
  /** Email yang sedang terverifikasi (sesi OTP aktif) di perangkat ini, atau null. */
  async verifiedEmail(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.email?.toLowerCase() ?? null;
  },

  async sendCode(email: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch("/api/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", email: email.toLowerCase().trim() }),
      });
      const data = await res.json().catch(() => ({}));
      return res.ok ? { ok: true } : { ok: false, error: data.error || "Gagal mengirim kode." };
    } catch {
      return { ok: false, error: "Gagal mengirim kode. Periksa koneksi internet." };
    }
  },

  async verifyCode(email: string, code: string): Promise<{ ok: boolean; error?: string }> {
    const e = email.toLowerCase().trim();
    let { error } = await supabase.auth.verifyOtp({ email: e, token: code.trim(), type: "email" });
    if (error) ({ error } = await supabase.auth.verifyOtp({ email: e, token: code.trim(), type: "magiclink" }));
    return error ? { ok: false, error: otpError(error.message) } : { ok: true };
  },

  /** Daftarkan perangkat ini ke akun cloud (batas perangkat dicek di server). */
  async connect(removeRowId?: number): Promise<ConnectResult> {
    const { status, data } = await callApi({
      action: removeRowId ? "remove_device" : "connect",
      rowId: removeRowId,
      deviceId: getDeviceId(),
      deviceName: getDeviceName(),
    });
    if (status === 200 && data.ok) return { ok: true, ...data };
    return { ok: false, code: data.code, error: data.error || "Gagal menghubungkan ke cloud.", devices: data.devices, limit: data.limit };
  },

  /** Lepas jatah perangkat ini (saat Keluar). */
  async release(): Promise<void> {
    try {
      await callApi({ action: "release", deviceId: getDeviceId() });
    } catch {
      /* offline: biarkan */
    }
  },
};
