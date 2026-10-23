import { useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardCheck,
  LogIn,
  LogOut,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  History,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { PageName } from "@/types/enums";
import { useToast } from "@/components/shared/Toast";
import { useGeolocation } from "@/hooks/useGeolocation";
import { teacherAttendanceService } from "@/services/teacher-attendance.service";
import { teacherAttendanceRepo } from "@/repositories/dexie/teacher-attendance.repo";
import { formatTanggalPanjang, inisial, todayStr } from "@/lib/utils";
import type { Teacher, TeacherAttendance } from "@/types/entities";
import { SelfieCamera } from "./SelfieCamera";
import { haversineDistance } from "@/lib/geo";

type Mode = "pick" | "session";

const SESSION_KEY = "bgy_presensi_guru_session";

function loadSession(): { guruId: number; expires: number } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.guruId !== "number") return null;
    if (parsed.expires && parsed.expires < Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveSession(guruId: number) {
  // sesi 8 jam
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ guruId, expires: Date.now() + 8 * 3600_000 })
  );
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

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

export function PresensiGuruPage() {
  const { teachers, school } = useApp();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("pick");
  const [guru, setGuru] = useState<Teacher | null>(null);

  // init: cek sesi tersimpan
  useEffect(() => {
    const s = loadSession();
    if (s) {
      const t = teachers.find((x) => x.id === s.guruId);
      if (t && t.statusAktif !== false) {
        setGuru(t);
        setMode("session");
      } else {
        clearSession();
      }
    }
  }, [teachers]);

  const handleLogin = (g: Teacher) => {
    saveSession(g.id);
    setGuru(g);
    setMode("session");
    toast(`Selamat datang, ${g.nama}`, "success");
  };

  const handleLogout = () => {
    clearSession();
    setGuru(null);
    setMode("pick");
    toast("Sesi presensi diakhiri", "info");
  };

  if (mode === "pick" || !guru) {
    return <PickerForm teachers={teachers} onPick={handleLogin} />;
  }

  return (
    <SelfAbsenPanel
      guru={guru}
      school={school}
      onLogout={handleLogout}
    />
  );
}

/* ─────────────── Picker (login mandiri) ─────────────── */
function PickerForm({
  teachers,
  onPick,
}: {
  teachers: Teacher[];
  onPick: (g: Teacher) => void;
}) {
  const [kode, setKode] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const { toast } = useToast();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const g = matchGuru(teachers, kode);
    if (!g) {
      setErr("Nomor / Kode tidak ditemukan. Minta Ops / Kepala Sekolah membuatkan akun di menu Daftar Guru.");
      return;
    }
    // Jika guru punya PIN di-set, cocokan. Jika tidak di-set, abaikan (fallback: dianggap akun lama).
    if (g.pin && g.pin !== pin.trim()) {
      setErr("PIN salah");
      return;
    }
    onPick(g);
  };

  const hintPertama = teachers.length === 0;

  return (
    <div className="flex-1 px-[14px] pt-[18px] pb-[90px] lg:pb-4">
      <div
        className="rounded-2xl p-5 text-white relative overflow-hidden"
        style={{ background: "var(--grad)", boxShadow: "var(--shadow-lg)" }}
      >
        <span className="header-orb" style={{ width: 140, height: 140, top: -40, right: -30 }} />
        <span className="header-orb" style={{ width: 80, height: 80, bottom: -30, left: -20, background: "rgba(255,255,255,.08)" }} />
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center mb-3">
            <ClipboardCheck size={28} />
          </div>
          <div className="text-[1.1rem] font-extrabold italic leading-tight">Presensi Yuk</div>
          <div className="text-[0.78rem] opacity-90">Login mandiri untuk mencatat kehadiran Anda</div>
        </div>
      </div>

      <form onSubmit={submit} className="mt-4 bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-4 space-y-3" style={{ boxShadow: "var(--shadow)" }}>
        <div>
          <label className="block text-[0.7rem] font-bold text-[var(--text-light)] mb-1 uppercase tracking-wide">
            Nomor NIP / NUPTK / Kode
          </label>
          <input
            value={kode}
            onChange={(e) => setKode(e.target.value)}
            placeholder="Mis. 1998… atau G-1234"
            inputMode="text"
            autoComplete="off"
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)] text-[0.9rem] outline-none focus:border-[var(--brand)]"
          />
        </div>
        <div>
          <label className="block text-[0.7rem] font-bold text-[var(--text-light)] mb-1 uppercase tracking-wide">
            PIN
          </label>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="4–6 digit"
            inputMode="numeric"
            autoComplete="off"
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)] text-[0.9rem] outline-none focus:border-[var(--brand)] tracking-widest"
          />
          <div className="text-[0.65rem] text-[var(--text-light)] mt-1">
            Kalau Anda belum punya PIN, hubungi Ops / Kepala Sekolah.
          </div>
        </div>

        {err && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-2 text-[0.8rem] text-red-700 flex items-start gap-2">
            <AlertTriangle size={14} className="mt-[2px] flex-shrink-0" />
            <span>{err}</span>
          </div>
        )}

        <button
          type="submit"
          className="w-full py-3 rounded-xl text-white font-bold text-[0.9rem] flex items-center justify-center gap-2 active:scale-95"
          style={{ background: "var(--grad)" }}
        >
          <LogIn size={16} /> Masuk & Absen
        </button>

        {hintPertama ? (
          <div className="text-[0.72rem] text-[var(--text-light)] text-center pt-2 border-t border-[var(--border)]">
            Belum ada guru terdaftar. Minta Ops / Kepala Sekolah menambahkan guru di menu
            <button
              type="button"
              onClick={() => toast("Buka menu > Daftar Guru", "info")}
              className="ml-1 text-[var(--brand)] font-bold underline"
            >
              Daftar Guru
            </button>.
          </div>
        ) : (
          <div className="text-[0.68rem] text-[var(--text-light)] text-center pt-2 border-t border-[var(--border)]">
            Data guru dikelola oleh Ops / Kepala Sekolah.
          </div>
        )}
      </form>
    </div>
  );
}

/* ─────────────── Panel absen untuk guru yang sudah login ─────────────── */
function SelfAbsenPanel({
  guru,
  school,
  onLogout,
}: {
  guru: Teacher;
  school: ReturnType<typeof useApp>["school"];
  onLogout: () => void;
}) {
  const { toast } = useToast();
  const { setActivePage } = useApp();
  const [existing, setExisting] = useState<TeacherAttendance | undefined>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCamera, setShowCamera] = useState<null | "in" | "out">(null);
  const [, setTick] = useState(0);
  const { request: requestLocation, error: geoError, loading: geoLoading } = useGeolocation();
  const pendingLocRef = useRef<{ lat: number; lng: number } | null>(null);

  const tanggal = todayStr();

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const rec = await teacherAttendanceRepo.getToday(guru.id, tanggal);
      setExisting(rec);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [guru.id]);

  const sudahMasuk = !!existing?.jamMasuk;
  const sudahPulang = !!existing?.jamPulang;

  const now = new Date();
  const jamNow = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const jarakSekolah = useMemo(() => {
    if (!school?.lat || !school?.lng || !existing?.lokasiMasukLat || !existing?.lokasiMasukLng) return null;
    return Math.round(
      haversineDistance(existing.lokasiMasukLat, existing.lokasiMasukLng, school.lat, school.lng)
    );
  }, [school, existing]);

  const start = async (action: "in" | "out") => {
    const coords = await requestLocation();
    if (!coords) {
      toast(geoError || "Gagal ambil lokasi", "error");
      return;
    }
    pendingLocRef.current = { lat: coords.lat, lng: coords.lng };
    setShowCamera(action);
  };

  const onCapture = async (blob: Blob) => {
    const action = showCamera;
    const loc = pendingLocRef.current;
    setShowCamera(null);
    if (!action || !loc) return;
    setSubmitting(true);
    try {
      const selfieUrl = await blobToDataUrl(blob);
      if (action === "in") {
        const res = await teacherAttendanceService.clockIn(guru.id, loc.lat, loc.lng, selfieUrl);
        toast(
          res.statusMasuk === "ONTIME"
            ? "Absen masuk tersimpan — tepat waktu"
            : res.statusMasuk === "LATE"
              ? "Absen masuk tersimpan — terlambat"
              : `Di luar radius (${Math.round(res.jarakMeter)}m)`,
          res.statusMasuk === "ONTIME" ? "success" : "info"
        );
      } else {
        const res = await teacherAttendanceService.clockOut(guru.id, loc.lat, loc.lng, selfieUrl);
        toast(
          res.statusPulang === "FAR"
            ? `Absen pulang: di luar radius (${Math.round(res.jarakMeter)}m)`
            : "Absen pulang tersimpan — sampai besok!",
          "success"
        );
      }
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal menyimpan absen";
      toast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 px-[14px] pt-[14px] pb-[90px] lg:pb-4">
      {/* Hero kartu guru */}
      <div
        className="rounded-2xl p-5 text-white relative overflow-hidden"
        style={{ background: "var(--grad)", boxShadow: "var(--shadow-lg)" }}
      >
        <span className="header-orb" style={{ width: 140, height: 140, top: -40, right: -30 }} />
        <span className="header-orb" style={{ width: 80, height: 80, bottom: -30, left: -20, background: "rgba(255,255,255,.08)" }} />
        <div className="relative flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-white/20 border border-white/30 flex items-center justify-center font-extrabold text-[1.1rem]">
            {inisial(guru.nama)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[1rem] font-extrabold truncate">{guru.nama}</div>
            <div className="text-[0.74rem] opacity-95 truncate">
              {guru.jabatan || "Guru"}{guru.nip ? ` · ${guru.nip}` : ""}
            </div>
          </div>
          <button
            onClick={onLogout}
            className="h-9 px-3 rounded-xl bg-white/15 border border-white/30 text-[0.72rem] font-bold flex items-center gap-1 active:scale-95"
            aria-label="Keluar"
          >
            <ArrowLeft size={14} /> Keluar
          </button>
        </div>
        <div className="relative mt-3 text-[2rem] font-extrabold tabular-nums tracking-tight">{jamNow}</div>
        <div className="relative text-[0.75rem] opacity-90">{formatTanggalPanjang(tanggal)}</div>
      </div>

      {/* Lokasi sekolah */}
      {school && (
        <div className="mt-3 bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--brand-soft)] text-[var(--brand-strong)] flex items-center justify-center">
            <MapPin size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[0.65rem] text-[var(--text-light)]">Lokasi Presensi</div>
            <div className="font-bold text-[var(--text)] text-[0.85rem] truncate">{school.nama}</div>
          </div>
          {jarakSekolah != null && (
            <div className="text-right">
              <div className="text-[0.6rem] text-[var(--text-light)]">Jarak Anda</div>
              <div className="font-extrabold text-[var(--text)] text-[0.85rem]">{jarakSekolah} m</div>
            </div>
          )}
        </div>
      )}

      {/* Status hari ini */}
      {!loading && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <StatusCard
            label="Jam Masuk"
            jam={existing?.jamMasuk?.slice(0, 5)}
            status={existing?.statusMasuk}
            emptyLabel="Belum absen"
          />
          <StatusCard
            label="Jam Pulang"
            jam={existing?.jamPulang?.slice(0, 5)}
            status={existing?.statusPulang}
            emptyLabel="Belum pulang"
          />
        </div>
      )}

      {/* Aksi */}
      <div className="mt-4">
        {!sudahMasuk && (
          <button
            disabled={submitting || geoLoading}
            onClick={() => start("in")}
            className="w-full py-4 rounded-2xl text-white font-extrabold text-[1rem] flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            style={{ background: "var(--grad)" }}
          >
            <LogIn size={20} /> {submitting ? "Menyimpan..." : geoLoading ? "Ambil lokasi..." : "Datang (Clock In)"}
          </button>
        )}
        {sudahMasuk && !sudahPulang && (
          <button
            disabled={submitting || geoLoading}
            onClick={() => start("out")}
            className="w-full py-4 rounded-2xl text-white font-extrabold text-[1rem] flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}
          >
            <LogOut size={20} /> {submitting ? "Menyimpan..." : geoLoading ? "Ambil lokasi..." : "Pulang (Clock Out)"}
          </button>
        )}
        {sudahMasuk && sudahPulang && (
          <div className="rounded-2xl p-4 bg-[var(--hadir-bg)] border border-[var(--border)] text-center">
            <CheckCircle2 className="mx-auto text-[var(--hadir)]" size={28} />
            <div className="font-extrabold text-[var(--hadir)] mt-1">Presensi hari ini lengkap</div>
            <div className="text-[0.72rem] text-[var(--text-light)]">Terima kasih — sampai besok!</div>
          </div>
        )}

        {/* Riwayat presensi guru ybs */}
        <button
          onClick={() => setActivePage(PageName.LOG_PRESENSI)}
          className="w-full mt-3 py-3 rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] text-[var(--brand)] font-bold text-[0.85rem] flex items-center justify-center gap-2 active:scale-95"
        >
          <History size={16} /> Riwayat Presensi Saya
        </button>
      </div>

      {showCamera && (
        <SelfieCamera onCapture={onCapture} onCancel={() => setShowCamera(null)} />
      )}
    </div>
  );
}

function StatusCard({
  label,
  jam,
  status,
  emptyLabel,
}: {
  label: string;
  jam?: string;
  status?: string;
  emptyLabel: string;
}) {
  const color =
    status === "ONTIME" ? "#16a34a" : status === "LATE" ? "#f59e0b" : status === "FAR" ? "#dc2626" : "#94a3b8";
  return (
    <div
      className="rounded-2xl p-3 bg-[var(--card-bg)] border border-[var(--border)]"
      style={{ boxShadow: "var(--shadow)" }}
    >
      <div className="text-[0.65rem] text-[var(--text-light)] flex items-center gap-1">
        <Clock size={11} /> {label}
      </div>
      {jam ? (
        <>
          <div className="font-extrabold text-[1.4rem] tabular-nums mt-1" style={{ color }}>
            {jam}
          </div>
          <div className="text-[0.65rem] font-bold" style={{ color }}>
            {status === "ONTIME" ? "Tepat Waktu" : status === "LATE" ? "Terlambat" : status === "FAR" ? "Di luar radius" : ""}
          </div>
        </>
      ) : (
        <div className="font-bold text-[var(--text-light)] mt-2 text-[0.9rem]">{emptyLabel}</div>
      )}
    </div>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
