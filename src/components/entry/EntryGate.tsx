import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/components/shared/Toast";
import type { Teacher } from "@/types/entities";
import { ClipboardCheck, ShieldCheck, LogIn, Hash, KeyRound, Eye, EyeOff, ArrowLeft, Users } from "lucide-react";

function matchGuru(teachers: Teacher[], kode: string): Teacher | undefined {
  const needle = kode.trim();
  if (!needle) return undefined;
  return teachers.find(
    (t) =>
      t.statusAktif !== false &&
      ((t.kodeLogin && t.kodeLogin === needle) ||
        (t.nip && t.nip === needle) ||
        String(t.id) === needle)
  );
}

type Step = "choose" | "guru";

export function EntryGate() {
  const { teachers, setEntryMode, loginGuru } = useApp();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("choose");

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb, #1d4ed8)" }}
    >
      <span className="absolute -top-16 -right-10 w-72 h-72 rounded-full bg-white/10 blur-2xl" />
      <span className="absolute -bottom-20 -left-16 w-80 h-80 rounded-full bg-white/8 blur-3xl" />

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-24 h-24 mx-auto rounded-3xl bg-white flex items-center justify-center shadow-xl p-2">
            <img src="/logo-presensiyuk.png" alt="Presensi Yuk" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-extrabold text-white mt-4">
            <span className="italic">Presensi Yuk</span>
          </h1>
          <p className="text-[0.8rem] text-white/85 font-semibold tracking-[3px] uppercase">Guru</p>
        </div>

        {step === "choose" ? (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-5 space-y-3">
            <div className="text-center text-[0.82rem] text-gray-600 mb-1">Masuk sebagai</div>

            <button
              onClick={() => setStep("guru")}
              className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-blue-100 hover:border-[#2563eb] bg-blue-50/50 transition-colors text-left active:scale-[.99]"
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white flex-shrink-0" style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb)" }}>
                <ClipboardCheck size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-gray-800">Guru</div>
                <div className="text-[0.72rem] text-gray-500">Absen masuk/pulang & lihat riwayat sendiri</div>
              </div>
            </button>

            <button
              onClick={() => setEntryMode("admin")}
              className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-gray-100 hover:border-gray-300 bg-gray-50/60 transition-colors text-left active:scale-[.99]"
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white flex-shrink-0 bg-gradient-to-br from-slate-600 to-slate-800">
                <ShieldCheck size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-gray-800">Admin / Operator</div>
                <div className="text-[0.72rem] text-gray-500">Kelola guru, rekap, pengaturan sekolah</div>
              </div>
            </button>
          </div>
        ) : (
          <GuruLogin
            teachers={teachers}
            onBack={() => setStep("choose")}
            onSuccess={(g) => { loginGuru(g.id); toast(`Selamat datang, ${g.nama}`, "success"); }}
            noGuru={teachers.length === 0}
          />
        )}

        <div className="text-center mt-5">
          <p className="text-[0.7rem] text-white/80">
            © 2026 <span className="italic font-bold">Presensi Yuk</span> · Bantu Guru Yuk
          </p>
        </div>
      </div>
    </div>
  );
}

function GuruLogin({
  teachers,
  onBack,
  onSuccess,
  noGuru,
}: {
  teachers: Teacher[];
  onBack: () => void;
  onSuccess: (g: Teacher) => void;
  noGuru: boolean;
}) {
  const [kode, setKode] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [err, setErr] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const g = matchGuru(teachers, kode);
    if (!g) { setErr("Nomor / Kode tidak ditemukan. Minta Ops / Kepala Sekolah."); return; }
    if (g.pin && g.pin !== pin.trim()) { setErr("PIN salah"); return; }
    onSuccess(g);
  };

  return (
    <form onSubmit={submit} className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-5 space-y-3">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-[0.78rem] font-bold text-gray-500 hover:text-[#2563eb]">
        <ArrowLeft size={14} /> Kembali
      </button>
      <div className="font-extrabold text-gray-800 text-[1.05rem]">Masuk sebagai Guru</div>

      {noGuru ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[0.78rem] text-amber-800 flex items-start gap-2">
          <Users size={15} className="mt-[1px] flex-shrink-0" />
          <span>Belum ada guru terdaftar. Minta Ops / Kepala Sekolah menambahkan guru lewat menu Admin dulu.</span>
        </div>
      ) : (
        <>
          <div>
            <label className="block text-[0.65rem] font-bold text-gray-600 mb-1 uppercase tracking-wide">Nomor NIP / NUPTK / Kode</label>
            <div className="relative">
              <input
                value={kode}
                onChange={(e) => setKode(e.target.value)}
                placeholder="Mis. 1998… atau G-1234"
                autoComplete="off"
                className="w-full px-4 py-3 pl-10 border-2 border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:border-[#2563eb] focus:bg-white transition-colors"
              />
              <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
          <div>
            <label className="block text-[0.65rem] font-bold text-gray-600 mb-1 uppercase tracking-wide">PIN</label>
            <div className="relative">
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="4-6 digit"
                inputMode="numeric"
                type={showPin ? "text" : "password"}
                className="w-full px-4 py-3 pl-10 pr-10 border-2 border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:border-[#2563eb] focus:bg-white transition-colors tracking-widest"
              />
              <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <button type="button" onClick={() => setShowPin(!showPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#2563eb]">
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="text-[0.65rem] text-gray-500 mt-1">Belum punya PIN? Hubungi Ops / Kepala Sekolah.</div>
          </div>

          {err && <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-[0.8rem] text-red-700">{err}</div>}

          <button
            type="submit"
            className="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 hover:shadow-lg transition-all"
            style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)" }}
          >
            <LogIn size={16} /> Masuk & Absen
          </button>
        </>
      )}
    </form>
  );
}
