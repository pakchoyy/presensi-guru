import { useState } from "react";
import { Cloud, CloudOff, LogIn, LogOut, Link2, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/shared/Toast";
import { supabase } from "@/lib/supabase";

/**
 * Kartu akun cloud sekolah di halaman Daftar Guru.
 *
 * Guru hanya bisa absen dari HP masing-masing kalau sekolahnya punya akun
 * cloud: akun admin inilah yang memiliki data sekolah di server dan yang
 * membuatkan akun login guru.
 */
export function AkunCloudSekolah({
  jumlahTersambung,
  jumlahBelum,
  menyambungkan,
  onSambungkan,
}: {
  jumlahTersambung: number;
  jumlahBelum: number;
  menyambungkan: boolean;
  onSambungkan: () => void;
}) {
  const { user, isAuthenticated, login, register, logout } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"masuk" | "daftar">("masuk");
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [memproses, setMemproses] = useState(false);
  const [err, setErr] = useState("");

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!email.trim() || password.length < 6) {
      setErr("Isi email dan password (minimal 6 karakter)");
      return;
    }
    setMemproses(true);
    try {
      if (mode === "daftar") {
        await register(email, password, nama.trim() || email.split("@")[0]);
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          toast("Akun dibuat — cek email untuk konfirmasi, lalu Masuk", "info");
          setMode("masuk");
          return;
        }
        toast("Akun cloud sekolah aktif", "success");
      } else {
        await login(email, password);
        toast("Masuk cloud berhasil", "success");
      }
      setPassword("");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Gagal");
    } finally {
      setMemproses(false);
    }
  };

  if (isAuthenticated) {
    return (
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-[var(--hadir-bg)] text-[var(--hadir)] flex items-center justify-center flex-shrink-0">
            <Cloud size={16} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[0.8rem] font-bold text-[var(--text)]">Cloud sekolah aktif</div>
            <div className="text-[0.63rem] text-[var(--text-light)] truncate">{user?.email}</div>
          </div>
          <button
            onClick={async () => { await logout(); toast("Keluar dari cloud", "info"); }}
            className="h-8 px-2 rounded-lg border border-[var(--border)] text-[var(--text-light)] text-[0.65rem] font-bold flex items-center gap-1 bg-transparent"
          >
            <LogOut size={12} /> Keluar
          </button>
        </div>

        <div className="mt-3 text-[0.68rem] text-[var(--text-light)] leading-snug">
          <b className="text-[var(--text)]">{jumlahTersambung}</b> guru bisa presensi dari HP sendiri
          {jumlahBelum > 0 && (
            <>
              {" · "}
              <b className="text-[#b45309]">{jumlahBelum}</b> belum tersambung
            </>
          )}
        </div>
        {jumlahBelum > 0 && (
          <button
            onClick={onSambungkan}
            disabled={menyambungkan}
            className="w-full mt-2 py-[9px] rounded-[10px] text-white font-bold text-[0.78rem] flex items-center justify-center gap-[6px] disabled:opacity-50 active:scale-95"
            style={{ background: "var(--grad)" }}
          >
            <Link2 size={14} /> {menyambungkan ? "Menyambungkan..." : `Sambungkan ${jumlahBelum} guru ke cloud`}
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={kirim} className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
      <div className="flex items-start gap-2">
        <span className="w-8 h-8 rounded-lg bg-[var(--input-bg)] text-[var(--text-light)] flex items-center justify-center flex-shrink-0">
          <CloudOff size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[0.8rem] font-bold text-[var(--text)]">Guru presensi dari HP masing-masing?</div>
          <div className="text-[0.63rem] text-[var(--text-light)] leading-snug mt-[2px]">
            Hubungkan sekolah ke cloud sekali saja. Tanpa ini, guru hanya bisa presensi di perangkat ini.
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {mode === "daftar" && (
          <input
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Nama admin / sekolah"
            className="w-full px-[10px] py-[9px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.82rem] bg-[var(--input-bg)] text-[var(--text)] outline-none focus:border-[var(--brand)]"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email admin"
          autoComplete="email"
          className="w-full px-[10px] py-[9px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.82rem] bg-[var(--input-bg)] text-[var(--text)] outline-none focus:border-[var(--brand)]"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min. 6 karakter)"
          autoComplete={mode === "daftar" ? "new-password" : "current-password"}
          className="w-full px-[10px] py-[9px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.82rem] bg-[var(--input-bg)] text-[var(--text)] outline-none focus:border-[var(--brand)]"
        />
      </div>

      {err && <div className="mt-2 text-[0.7rem] text-[#dc2626]">{err}</div>}

      <button
        type="submit"
        disabled={memproses}
        className="w-full mt-3 py-[10px] rounded-[10px] text-white font-bold text-[0.8rem] flex items-center justify-center gap-[6px] disabled:opacity-50 active:scale-95"
        style={{ background: "var(--grad)" }}
      >
        {mode === "daftar" ? <UserPlus size={14} /> : <LogIn size={14} />}
        {memproses ? "Memproses..." : mode === "daftar" ? "Buat akun cloud sekolah" : "Masuk cloud"}
      </button>
      <button
        type="button"
        onClick={() => { setMode(mode === "masuk" ? "daftar" : "masuk"); setErr(""); }}
        className="w-full mt-2 text-[0.68rem] font-bold text-[var(--brand)] bg-transparent border-none"
      >
        {mode === "masuk" ? "Belum punya akun? Buat sekarang" : "Sudah punya akun? Masuk"}
      </button>
    </form>
  );
}
