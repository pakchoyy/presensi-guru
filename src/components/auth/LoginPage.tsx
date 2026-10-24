import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Mail, Eye, EyeOff, LogIn, KeyRound, Hash, SkipForward } from "lucide-react";
import { OtpVerify } from "./OtpVerify";

type Tab = "guru" | "admin";

export function LoginPage() {
  const { loginGuru, markDeviceOk, loading } = useAuth();

  const [tab, setTab] = useState<Tab>("guru");

  // ===== Admin: masuk dengan kode email =====
  const [email, setEmail] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ===== Guru form =====
  const [kode, setKode] = useState("");
  const [pin, setPin] = useState("");

  // ===== Shared =====
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const emailParam = params.get("email");
    if (emailParam) {
      setEmail(emailParam);
      setTab("admin");
    }
  }, []);

  const handleSubmitGuru = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await loginGuru(kode, pin);
    } catch (err: any) {
      setError(err.message || "Login gagal");
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    // Mode "Coba Dulu" — set flag demo + reload supaya WizardSetup bisa handle.
    localStorage.setItem("bgy_demo_mode", "1");
    window.location.hash = "#demo";
    window.location.reload();
  };

  const guruValid = kode.trim().length > 0 && /^\d{4,6}$/.test(pin.trim());

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb,#1d4ed8)" }}>
      <span className="absolute -top-16 -right-10 w-72 h-72 rounded-full bg-white/10 blur-2xl" />
      <span className="absolute -bottom-20 -left-16 w-80 h-80 rounded-full bg-white/8 blur-3xl" />
      <div className="w-full max-w-md relative">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-7">
          {/* Hero */}
          <div className="text-center mb-5">
            <div className="w-20 h-20 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb)" }}>
              <span className="text-2xl text-white font-extrabold italic">PY</span>
            </div>
            <h1 className="text-xl font-extrabold text-gray-800">
              <span className="italic">Presensi Yuk</span> <span className="text-gray-600">| Guru</span>
            </h1>
            <p className="text-xs text-gray-600 mt-1">
              Masuk untuk mencatat kehadiran atau mengelola sekolah
            </p>
          </div>

          {/* Tabs */}
          <div className="bg-gray-100 rounded-xl p-1 flex mb-4">
            <TabBtn active={tab === "guru"} onClick={() => { setTab("guru"); setError(""); }}>
              Guru (NIP+PIN)
            </TabBtn>
            <TabBtn active={tab === "admin"} onClick={() => { setTab("admin"); setError(""); }}>
              Admin / Ops
            </TabBtn>
          </div>

          {tab === "guru" ? (
            <form onSubmit={handleSubmitGuru} className="space-y-3">
              <Field label="Nomor NIP / NUPTK / Kode">
                <div className="relative">
                  <input
                    type="text"
                    value={kode}
                    onChange={(e) => setKode(e.target.value)}
                    placeholder="Mis. 1998… atau G-1234"
                    className="w-full px-4 py-3 pl-10 border-2 border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:border-[#2563eb] focus:bg-white transition-colors"
                    autoComplete="off"
                    required
                  />
                  <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </Field>
              <Field label="PIN">
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="4-6 digit"
                    inputMode="numeric"
                    className="w-full px-4 py-3 pl-10 pr-10 border-2 border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:border-[#2563eb] focus:bg-white transition-colors tracking-widest"
                    required
                  />
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#2563eb]"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="text-[0.65rem] text-gray-500 mt-1">
                  Belum punya? Hubungi Ops / Kepala Sekolah untuk kode & PIN Anda.
                </div>
              </Field>
              {error && <ErrorBox>{error}</ErrorBox>}
              <button
                type="submit"
                disabled={!guruValid || submitting || loading}
                className="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb)" }}
              >
                {submitting ? "Memproses..." : (<><LogIn size={16} /> Masuk sebagai Guru</>)}
              </button>
            </form>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setShowOtp(true); }} className="space-y-3">
              <Field label="Email admin sekolah">
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    autoComplete="email"
                    className="w-full px-4 py-3 pl-10 border-2 border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:border-[#2563eb] focus:bg-white transition-colors"
                    required
                  />
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </Field>
              <p className="text-[0.7rem] text-gray-500 leading-snug">
                Tanpa password: kami kirim kode ke email ini. Belum punya akun? Akun dibuat otomatis.
              </p>
              <button
                type="submit"
                disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || loading}
                className="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb)" }}
              >
                <LogIn size={16} /> Kirim kode masuk
              </button>
            </form>
          )}

          {/* Lewati / Coba Dulu */}
          <div className="mt-5 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleSkip}
              className="w-full flex items-center justify-center gap-2 text-[0.78rem] font-bold text-gray-600 hover:text-[#2563eb]"
            >
              <SkipForward size={14} /> Coba Dulu / Lewati Login
            </button>
            <p className="text-[0.65rem] text-gray-500 text-center leading-relaxed mt-2">
              Data mode coba hanya tersimpan lokal di perangkat ini — tidak sinkron ke cloud.
            </p>
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-xs text-white/85">
            © 2026 <span className="italic font-bold">Presensi Yuk</span> by{" "}
            <a href="https://bantuguruyuk.web.id" target="_blank" rel="noopener noreferrer" className="font-bold hover:underline">
              Bantu Guru Yuk
            </a>
          </p>
        </div>
      </div>

      {showOtp && (
        <OtpVerify
          email={email}
          title="Masuk admin sekolah"
          onConnected={() => { setShowOtp(false); markDeviceOk(); }}
          onClose={() => setShowOtp(false)}
        />
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-[9px] rounded-lg text-[0.78rem] font-bold transition-all ${
        active ? "bg-white text-[#2563eb] shadow-sm" : "text-gray-600 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[0.65rem] font-bold text-gray-700 mb-1 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-sm text-red-700">
      {children}
    </div>
  );
}
