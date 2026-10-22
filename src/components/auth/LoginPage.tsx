import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Mail, Lock, Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { DeviceLimitModal } from "./DeviceLimitModal";

export function LoginPage() {
  const { login, register, loading, deviceLimitError, clearDeviceLimitError } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  // Check for pre-filled email from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const emailParam = params.get('email');
    const refParam = params.get('ref');
    
    if (emailParam) {
      setEmail(emailParam);
      if (refParam === 'activation') {
        setMode('register');
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        if (!name.trim()) {
          setError("Nama tidak boleh kosong");
          setSubmitting(false);
          return;
        }
        await register(email, password, name);
      }
      // Success - AuthContext will handle navigation
    } catch (err: any) {
      const errorMessage = err.message || "Terjadi kesalahan. Coba lagi.";
      // Don't show error in form if it's a device limit error (modal will show)
      if (!errorMessage.includes("Batas perangkat tercapai")) {
        setError(errorMessage);
      }
      setSubmitting(false);
    }
  };

  const handleDeviceLoggedOut = () => {
    // Retry login after device is logged out
    clearDeviceLimitError();
    handleSubmit({ preventDefault: () => {} } as React.FormEvent);
  };

  const isValid = email.includes("@") && password.length >= 6;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #14b8a6, #0d9488, #0f766e)" }}>
      {/* Ornamen lingkaran */}
      <span className="absolute -top-16 -right-10 w-72 h-72 rounded-full bg-white/10 blur-2xl" />
      <span className="absolute -bottom-20 -left-16 w-80 h-80 rounded-full bg-white/8 blur-3xl" />
      <div className="w-full max-w-md relative">
        {/* Card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #14b8a6, #0d9488)" }}>
              <span className="text-2xl text-white font-extrabold italic">PY</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              {mode === "login" ? "Login Admin" : "Daftar Akun Admin"}
            </h1>
            <p className="text-sm text-gray-600">
              {mode === "login" ? "Masuk untuk sinkron data ke cloud" : "Akun ini untuk Operator / Kepala Sekolah"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name (Register only) */}
            {mode === "register" && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                  Nama Lengkap
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama Anda"
                    className="w-full px-4 py-3 pl-10 border-2 border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:border-[#0d9488] focus:bg-white transition-colors"
                    required
                  />
                  <UserPlus size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full px-4 py-3 pl-10 border-2 border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:border-[#0d9488] focus:bg-white transition-colors"
                  required
                />
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-4 py-3 pl-10 pr-10 border-2 border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:border-[#0d9488] focus:bg-white transition-colors"
                  required
                  minLength={6}
                />
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {mode === "register" && password.length > 0 && password.length < 6 && (
                <p className="text-xs text-orange-600 mt-1">Password minimal 6 karakter</p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!isValid || submitting || loading}
              className="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg"
              style={{ background: "linear-gradient(135deg, #14b8a6, #0d9488)" }}
            >
              {submitting ? (
                "Memproses..."
              ) : mode === "login" ? (
                <>
                  <LogIn size={16} />
                  Masuk
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  Daftar
                </>
              )}
            </button>
          </form>

          {/* Toggle Mode */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
              }}
              className="text-sm text-gray-600 hover:text-[#0d9488] transition-colors"
            >
              {mode === "login" ? (
                <>
                  Belum punya akun? <span className="font-bold">Daftar</span>
                </>
              ) : (
                <>
                  Sudah punya akun? <span className="font-bold">Login</span>
                </>
              )}
            </button>
          </div>

          {/* Info */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              Dengan login, data presensi Anda akan tersinkronisasi ke cloud.
              Anda bisa akses dari perangkat lain (max 3 perangkat).
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-white/80">
            © 2026 Presensi Siswa by{" "}
            <a href="https://bantuguruyuk.web.id" target="_blank" rel="noopener noreferrer" className="font-bold hover:underline">
              Bantu Guru Yuk
            </a>
          </p>
        </div>
      </div>

      {/* Device Limit Modal */}
      {deviceLimitError && (
        <DeviceLimitModal
          isOpen={true}
          onClose={clearDeviceLimitError}
          devices={deviceLimitError.devices}
          tier={deviceLimitError.tier}
          deviceLimit={deviceLimitError.deviceLimit}
          onDeviceLoggedOut={handleDeviceLoggedOut}
        />
      )}
    </div>
  );
}
