import { CLOUD_PROMPT_KEY } from "@/components/layout/CloudNudge";
import { useState, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/components/shared/Toast";
import { setupService, type SetupData } from "@/services/setup.service";
import { Jenjang, Semester } from "@/types/enums";
import { APP_BRAND } from "@/lib/constants";
import { School as SchoolIcon, User, Calendar, MapPin, Clock, Check, Target, SkipForward, Sparkles } from "lucide-react";

const WIZARD_TOTAL = 4;

export function WizardSetup() {
  const { refreshTeachers, refreshSchool } = useApp();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [progress, setProgress] = useState((1 / WIZARD_TOTAL) * 100);

  const [sekolah, setSekolah] = useState("");
  const [jenjang, setJenjang] = useState<Jenjang>(Jenjang.SD);
  const [namaGuru, setNamaGuru] = useState("");
  const [email, setEmail] = useState("");
  const [tahunAjaran, setTahunAjaran] = useState("2026/2027");
  const [semester, setSemester] = useState<Semester>(Semester.GANJIL);

  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [radiusMeter, setRadiusMeter] = useState(100);
  const [jamMasuk, setJamMasuk] = useState("07:00");
  const [jamPulang, setJamPulang] = useState("15:00");
  const [toleransi, setToleransi] = useState(15);
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => {
    setProgress((step / WIZARD_TOTAL) * 100);
  }, [step]);

  const ambilLokasi = () => {
    if (!navigator.geolocation) { toast("Browser tidak mendukung GPS"); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGpsLoading(false);
        toast("Lokasi tersimpan");
      },
      () => { setGpsLoading(false); toast("Gagal ambil lokasi"); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const next = () => {
    if (step === 1 && !sekolah.trim()) { toast("Nama sekolah wajib"); return; }
    if (step === 2) {
      if (!namaGuru.trim()) { toast("Nama admin wajib"); return; }
      if (!email.trim()) { toast("Email wajib"); return; }
    }
    if (step < WIZARD_TOTAL) setStep((s) => s + 1);
    else selesaikan();
  };
  const back = () => { if (step > 1) setStep((s) => s - 1); };

  const selesaikan = async () => {
    const data: SetupData = {
      sekolah, jenjang,
      namaGuru, email,
      tahunAjaran, semester,
      lat, lng,
      radiusMeter,
      jamMasukStandar: jamMasuk,
      jamPulangStandar: jamPulang,
      toleransiTerlambatMenit: toleransi,
    };
    try {
      await setupService.executeSetup(data);
      // Setelah wizard: tawarkan simpan ke cloud sekali (dialog dibuka oleh CloudNudge).
      try { localStorage.setItem(CLOUD_PROMPT_KEY, "1"); } catch { /* abaikan */ }
      await refreshSchool();
      await refreshTeachers();
      toast("Setup selesai!", "success");
    } catch {
      toast("Gagal setup", "error");
    }
  };

  // "Coba Dulu" — isi otomatis dengan data demo lokal (Dexie), tanpa
  // meminta sekolah/admin dulu. Admin bisa kembali ke Pengaturan nanti.
  const [cobaLoading, setCobaLoading] = useState(false);
  const cobaDulu = async () => {
    setCobaLoading(true);
    const data: SetupData = {
      sekolah: "Sekolah Coba (Demo)",
      jenjang: Jenjang.SD,
      namaGuru: "Admin Demo",
      email: "demo@guru.local",
      tahunAjaran: "2026/2027",
      semester: Semester.GANJIL,
      lat: undefined,
      lng: undefined,
      radiusMeter: 100,
      jamMasukStandar: "07:00",
      jamPulangStandar: "15:00",
      toleransiTerlambatMenit: 15,
    };
    try {
      localStorage.setItem("bgy_demo_mode", "1");
      await setupService.executeSetup(data);
      await refreshSchool();
      await refreshTeachers();
      toast("Mode coba aktif — data disimpan lokal", "success");
    } catch {
      toast("Gagal mulai mode coba", "error");
    } finally {
      setCobaLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-5">
          <div className="text-[1.2rem] font-extrabold text-[var(--text)]">
            <span className="italic">Presensi Yuk</span> <span className="text-[var(--text-light)] font-bold">| Guru</span>
          </div>
          <div className="text-[0.72rem] text-[var(--text-light)] mt-[2px]">{APP_BRAND}</div>
          <div className="text-[0.78rem] text-[var(--text-light)] mt-2">Setup awal — {step}/{WIZARD_TOTAL}</div>
          <div className="mt-3 bg-[var(--border)] rounded-full h-2 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "linear-gradient(90deg,#2563eb,#1d4ed8)" }} />
          </div>
        </div>

        {step === 1 && (
          <div className="mb-3 rounded-2xl border border-[var(--border)] p-3 bg-[var(--brand-soft)] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/70 text-[var(--brand-strong)] flex items-center justify-center flex-shrink-0">
              <Sparkles size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[0.82rem] font-extrabold text-[var(--brand-strong)]">Belum siap setup?</div>
              <div className="text-[0.68rem] text-[var(--text-light)] leading-snug">
                Masuk mode coba dengan 1 ketukan — data demo tersimpan di perangkat.
              </div>
            </div>
            <button
              onClick={cobaDulu}
              disabled={cobaLoading}
              className="h-9 px-3 rounded-xl bg-white text-[var(--brand-strong)] border border-[var(--brand)] text-[0.78rem] font-bold flex items-center gap-1 active:scale-95 disabled:opacity-50"
            >
              <SkipForward size={13} /> {cobaLoading ? "..." : "Coba Dulu"}
            </button>
          </div>
        )}

        <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-5 mb-4">
          {step === 1 && (
            <>
              <div className="flex items-center gap-2 mb-4 text-[1rem] font-bold text-[var(--text)]"><SchoolIcon size={18} /> Data Sekolah</div>
              <input placeholder="Nama sekolah" value={sekolah} onChange={(e) => setSekolah(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--input-bg)] mb-3 text-[0.9rem]" />
              <div className="text-[0.78rem] text-[var(--text-light)] mb-2">Jenjang</div>
              <div className="grid grid-cols-3 gap-2">
                {[Jenjang.SD, Jenjang.SMP, Jenjang.SMA].map((j) => (
                  <button key={j} onClick={() => setJenjang(j)} className={`py-2 rounded-lg border-[1.5px] font-bold text-[0.82rem] ${jenjang === j ? "border-[#2563eb] bg-[var(--brand-soft)] text-[#2563eb]" : "border-[var(--border)]"}`}>{j}</button>
                ))}
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div className="flex items-center gap-2 mb-4 text-[1rem] font-bold text-[var(--text)]"><User size={18} /> Data Admin</div>
              <input placeholder="Nama admin / kepsek" value={namaGuru} onChange={(e) => setNamaGuru(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--input-bg)] mb-3 text-[0.9rem]" />
              <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--input-bg)] text-[0.9rem]" />
            </>
          )}
          {step === 3 && (
            <>
              <div className="flex items-center gap-2 mb-4 text-[1rem] font-bold text-[var(--text)]"><Calendar size={18} /> Tahun Ajaran</div>
              <input placeholder="2026/2027" value={tahunAjaran} onChange={(e) => setTahunAjaran(e.target.value)} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--input-bg)] mb-3 text-[0.9rem]" />
              <div className="text-[0.78rem] text-[var(--text-light)] mb-2">Semester Aktif</div>
              <div className="grid grid-cols-2 gap-2">
                {[Semester.GANJIL, Semester.GENAP].map((s) => (
                  <button key={s} onClick={() => setSemester(s)} className={`py-2 rounded-lg border-[1.5px] font-bold text-[0.82rem] ${semester === s ? "border-[#2563eb] bg-[var(--brand-soft)] text-[#2563eb]" : "border-[var(--border)]"}`}>{s}</button>
                ))}
              </div>
            </>
          )}
          {step === 4 && (
            <>
              <div className="flex items-center gap-2 mb-4 text-[1rem] font-bold text-[var(--text)]"><MapPin size={18} /> Lokasi & Jam Sekolah</div>
              <button onClick={ambilLokasi} disabled={gpsLoading} className="w-full py-2 rounded-lg bg-[var(--brand-soft)] text-[#2563eb] font-bold text-[0.85rem] mb-3 flex items-center justify-center gap-2">
                <Target size={16} /> {gpsLoading ? "Mengambil GPS..." : "Ambil Lokasi Sekolah Sekarang"}
              </button>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <input placeholder="Lat" type="number" step="any" value={lat ?? ""} onChange={(e) => setLat(e.target.value ? parseFloat(e.target.value) : undefined)} className="px-2 py-2 border border-[var(--border)] rounded-lg bg-[var(--input-bg)] text-[0.8rem]" />
                <input placeholder="Lng" type="number" step="any" value={lng ?? ""} onChange={(e) => setLng(e.target.value ? parseFloat(e.target.value) : undefined)} className="px-2 py-2 border border-[var(--border)] rounded-lg bg-[var(--input-bg)] text-[0.8rem]" />
              </div>
              <div className="text-[0.78rem] mb-1 flex justify-between"><span>Radius geofence</span><b>{radiusMeter}m</b></div>
              <input type="range" min={50} max={500} step={10} value={radiusMeter} onChange={(e) => setRadiusMeter(+e.target.value)} className="w-full mb-3" />
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <div className="text-[0.72rem] text-[var(--text-light)] mb-1 flex items-center gap-1"><Clock size={12} /> Jam Masuk</div>
                  <input type="time" value={jamMasuk} onChange={(e) => setJamMasuk(e.target.value)} className="w-full px-2 py-2 border border-[var(--border)] rounded-lg bg-[var(--input-bg)] text-[0.85rem]" />
                </div>
                <div>
                  <div className="text-[0.72rem] text-[var(--text-light)] mb-1 flex items-center gap-1"><Clock size={12} /> Jam Pulang</div>
                  <input type="time" value={jamPulang} onChange={(e) => setJamPulang(e.target.value)} className="w-full px-2 py-2 border border-[var(--border)] rounded-lg bg-[var(--input-bg)] text-[0.85rem]" />
                </div>
              </div>
              <div className="text-[0.78rem] mb-1 flex justify-between"><span>Toleransi terlambat</span><b>{toleransi} menit</b></div>
              <input type="range" min={0} max={60} step={5} value={toleransi} onChange={(e) => setToleransi(+e.target.value)} className="w-full" />
            </>
          )}
        </div>

        <div className="flex gap-2">
          {step > 1 && (
            <button onClick={back} className="flex-1 py-3 rounded-xl border border-[var(--border)] font-bold text-[0.85rem]">Kembali</button>
          )}
          <button onClick={next} className="flex-1 py-3 rounded-xl text-white font-bold text-[0.85rem] flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb)" }}>
            {step === WIZARD_TOTAL ? (<><Check size={16} /> Selesai Setup</>) : "Lanjut"}
          </button>
        </div>
      </div>
    </div>
  );
}
