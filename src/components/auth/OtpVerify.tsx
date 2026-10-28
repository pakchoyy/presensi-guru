import { useEffect, useRef, useState } from "react";
import { X, Mail, Smartphone, Trash2 } from "lucide-react";
import { cloudLoginService, type CloudDevice, type ConnectResult } from "@/services/cloud-login.service";

type Connected = Extract<ConnectResult, { ok: true }>;

interface Props {
  email: string;
  title?: string;
  onConnected: (result: Connected, email: string) => void | Promise<void>;
  onClose: () => void;
  /** Mulai dari isian email (sudah terisi) supaya pengguna bisa mengganti sebelum kode dikirim. */
  editEmail?: boolean;
  /** Tombol teks untuk menunda, mis. "Nanti saja". */
  laterLabel?: string;
}

const RESEND_SECONDS = 60;

/** Verifikasi email dengan kode OTP, lalu daftarkan perangkat ke cloud (batas perangkat dicek di server). */
export function OtpVerify({ email: initialEmail, title = "Masuk dengan email", onConnected, onClose, editEmail, laterLabel }: Props) {
  const [email, setEmail] = useState(initialEmail.trim().toLowerCase());
  const [step, setStep] = useState<"email" | "code" | "devices">(initialEmail && !editEmail ? "code" : "email");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [devices, setDevices] = useState<CloudDevice[]>([]);
  const sentFor = useRef<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const connect = async (removeRowId?: number) => {
    setBusy(true);
    setError("");
    const res = await cloudLoginService.connect(removeRowId);
    setBusy(false);
    if (res.ok) {
      await onConnected(res, email);
      return;
    }
    if (res.code === "DEVICE_LIMIT") {
      setDevices(res.devices || []);
      setStep("devices");
    }
    setError(res.error);
  };

  const sendCode = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Email tidak valid.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await cloudLoginService.sendCode(email);
    setBusy(false);
    if (!res.ok) {
      setError(res.error || "Gagal mengirim kode.");
      return;
    }
    sentFor.current = email;
    setCooldown(RESEND_SECONDS);
    setInfo(`Kode dikirim ke ${email}. Cek juga folder Spam/Promosi.`);
    setStep("code");
  };

  // Saat dibuka: kalau email ini sudah terverifikasi di perangkat ini, langsung hubungkan; kalau belum, kirim kode.
  useEffect(() => {
    if (!initialEmail || editEmail) return;
    (async () => {
      const verified = await cloudLoginService.verifiedEmail();
      if (verified === email) connect();
      else if (sentFor.current !== email) sendCode();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verify = async () => {
    const c = code.replace(/\D/g, "");
    if (c.length < 6) {
      setError("Masukkan kode dari email.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await cloudLoginService.verifyCode(email, c);
    setBusy(false);
    if (!res.ok) {
      setError(res.error || "Kode salah.");
      return;
    }
    await connect();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[900] flex items-end lg:items-center justify-center p-2" onClick={busy ? undefined : onClose}>
      <div className="bg-[var(--card-bg)] rounded-t-2xl lg:rounded-2xl w-full max-w-[420px] px-4 pt-[18px] pb-[22px] animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-[#0ea5a0]/15 text-[#0ea5a0] flex items-center justify-center">
              {step === "devices" ? <Smartphone size={18} /> : <Mail size={18} />}
            </div>
            <div>
              <div className="text-[0.95rem] font-extrabold text-[var(--text)]">{step === "devices" ? "Batas perangkat" : title}</div>
              <div className="text-[0.7rem] text-[var(--text-light)]">Sekali saja di tiap perangkat</div>
            </div>
          </div>
          <button onClick={onClose} disabled={busy} className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--input-bg)] text-[var(--text-light)] border-none cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {step === "email" && (
          <>
            <label className="text-[0.72rem] font-semibold text-[var(--text-light)]">Email</label>
            <input
              type="email"
              inputMode="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
              placeholder="email@contoh.com"
              className="w-full mt-1 mb-3 px-3 py-[10px] rounded-[10px] border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)] text-[0.85rem]"
            />
            <button onClick={sendCode} disabled={busy} className="w-full py-[11px] rounded-[10px] text-white font-bold text-[0.85rem] border-none cursor-pointer disabled:opacity-60" style={{ background: "linear-gradient(135deg, #0ea5a0, #0d7a8a)" }}>
              {busy ? "Mengirim..." : "Kirim kode ke email"}
            </button>
          </>
        )}

        {step === "code" && (
          <>
            <p className="text-[0.75rem] text-[var(--text-light)] mb-2">{info || `Mengirim kode ke ${email}...`}</p>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && verify()}
              placeholder="Kode dari email"
              className="w-full mb-3 px-3 py-[12px] rounded-[10px] border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)] text-center text-[1.3rem] tracking-[0.4em] font-bold"
            />
            <button onClick={verify} disabled={busy} className="w-full py-[11px] rounded-[10px] text-white font-bold text-[0.85rem] border-none cursor-pointer disabled:opacity-60" style={{ background: "linear-gradient(135deg, #0ea5a0, #0d7a8a)" }}>
              {busy ? "Memeriksa..." : "Verifikasi & hubungkan"}
            </button>
            <div className="flex justify-between mt-3 text-[0.72rem]">
              <button onClick={() => { setStep("email"); setCode(""); setError(""); setInfo(""); }} className="bg-transparent border-none text-[var(--text-light)] cursor-pointer p-0">
                Ganti email
              </button>
              <button onClick={sendCode} disabled={busy || cooldown > 0} className="bg-transparent border-none text-[#0ea5a0] font-semibold cursor-pointer p-0 disabled:text-[var(--text-light)]">
                {cooldown > 0 ? `Kirim ulang (${cooldown})` : "Kirim ulang kode"}
              </button>
            </div>
          </>
        )}

        {step === "devices" && (
          <div className="space-y-2">
            {devices.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 border border-[var(--border)] rounded-[10px] px-3 py-2">
                <div className="min-w-0">
                  <div className="text-[0.8rem] font-semibold text-[var(--text)] truncate">{d.name}</div>
                  <div className="text-[0.68rem] text-[var(--text-light)]">Aktif {new Date(d.lastActiveAt).toLocaleDateString("id-ID")}</div>
                </div>
                <button onClick={() => connect(d.id)} disabled={busy} className="flex items-center gap-1 text-[0.72rem] font-semibold text-[#dc2626] bg-[#dc2626]/10 border-none rounded-[8px] px-2 py-[6px] cursor-pointer disabled:opacity-60">
                  <Trash2 size={13} /> Keluarkan
                </button>
              </div>
            ))}
            <p className="text-[0.7rem] text-[var(--text-light)]">Perangkat yang dikeluarkan harus masuk lagi dengan kode email.</p>
          </div>
        )}

        {error && <div className="mt-3 text-[0.75rem] text-[#dc2626] bg-[#dc2626]/10 rounded-[8px] px-3 py-2">{error}</div>}
        {laterLabel && (
          <button onClick={onClose} disabled={busy} className="w-full mt-3 bg-transparent border-none text-[0.78rem] font-semibold text-[var(--text-light)] cursor-pointer py-2">
            {laterLabel}
          </button>
        )}
      </div>
    </div>
  );
}
