import { useEffect, useState, useRef } from "react";
import { CheckCircle2, Clock, AlertTriangle, MapPin, LogIn, LogOut, X } from "lucide-react";
import { formatTanggalPanjang } from "@/lib/utils";
import { useGeolocation } from "@/hooks/useGeolocation";
import { SelfieCamera } from "./SelfieCamera";

type Info = {
  guru: { id: number; nama: string; nip?: string; jabatan?: string };
  sekolah: {
    nama: string;
    lat?: number;
    lng?: number;
    radiusMeter?: number;
    jamMasukStandar?: string;
    jamPulangStandar?: string;
    toleransiTerlambatMenit?: number;
  };
  tanggal: string;
  existing: {
    jamMasuk?: string;
    jamPulang?: string;
    statusMasuk?: string;
    statusPulang?: string;
    jarakMasukMeter?: number;
  } | null;
};

const STATUS_LABEL: Record<string, string> = {
  ONTIME: "Tepat Waktu",
  LATE: "Terlambat",
  FAR: "Di Luar Radius",
};

const STATUS_COLOR: Record<string, string> = {
  ONTIME: "#16a34a",
  LATE: "#f59e0b",
  FAR: "#dc2626",
};

export function AbsenGuruPage({ token }: { token: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showCamera, setShowCamera] = useState<null | "in" | "out">(null);
  const [, setTick] = useState(0);
  const { request: requestLocation, error: geoError, loading: geoLoading } = useGeolocation();
  const pendingLocRef = useRef<{ lat: number; lng: number } | null>(null);

  // tick timer tiap detik supaya jam realtime
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchInfo = () => {
    if (!token) { setErr("Link tidak valid"); setLoading(false); return; }
    setLoading(true);
    fetch(`/api/clockin?token=${encodeURIComponent(token)}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) throw new Error(j.error || "Gagal memuat");
        setInfo(j);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchInfo(); /* eslint-disable-next-line */ }, [token]);

  const now = new Date();
  const jamNow = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const sudahMasuk = !!info?.existing?.jamMasuk;
  const sudahPulang = !!info?.existing?.jamPulang;

  const startAction = async (action: "in" | "out") => {
    setErr("");
    const coords = await requestLocation();
    if (!coords) {
      setErr(geoError || "Gagal ambil lokasi");
      return;
    }
    pendingLocRef.current = { lat: coords.lat, lng: coords.lng };
    setShowCamera(action);
  };

  const handleCapture = async (blob: Blob) => {
    const action = showCamera;
    const loc = pendingLocRef.current;
    setShowCamera(null);
    if (!action || !loc) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("token", token);
      fd.append("action", action);
      fd.append("lat", String(loc.lat));
      fd.append("lng", String(loc.lng));
      fd.append("selfie", blob, `selfie_${action}.jpg`);
      const r = await fetch("/api/clockin", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal simpan absen");
      // Refresh info
      fetchInfo();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal";
      setErr(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488,#0f766e)" }}>
        <div className="text-white font-bold">Memuat...</div>
      </div>
    );
  }

  if (err && !info) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488,#0f766e)" }}>
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
          <AlertTriangle className="mx-auto text-[#dc2626] mb-2" size={32} />
          <div className="font-bold text-[#1e293b]">{err}</div>
          <div className="text-sm text-[#64748b] mt-1">Hubungi admin sekolah untuk link baru</div>
        </div>
      </div>
    );
  }

  const statusMasukLabel = info?.existing?.statusMasuk ? STATUS_LABEL[info.existing.statusMasuk] : null;
  const statusMasukColor = info?.existing?.statusMasuk ? STATUS_COLOR[info.existing.statusMasuk] : "#64748b";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-6" style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488,#0f766e)" }}>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <div className="text-center mb-4">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white" style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488)" }}>
            <Clock size={28} />
          </div>
          <div className="font-extrabold text-[#1e293b] text-[1.1rem]">{info?.guru.nama}</div>
          {info?.guru.jabatan && (
            <div className="text-[0.78rem] text-[#64748b]">{info.guru.jabatan}</div>
          )}
          <div className="text-sm text-[#64748b] mt-1">{info?.sekolah.nama}</div>
          <div className="text-xs text-[#94a3b8] mt-1">{info ? formatTanggalPanjang(info.tanggal) : ""}</div>
          <div className="mt-3 text-[2rem] font-extrabold text-[#0d9488] tracking-tight tabular-nums">{jamNow}</div>
        </div>

        {err && <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-sm text-red-700 text-center mb-3">{err}</div>}

        {/* Status hari ini */}
        {sudahMasuk && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 mb-3 text-center">
            <div className="text-[0.75rem] text-[#64748b]">Jam Masuk</div>
            <div className="font-extrabold text-[#0d9488] text-[1.1rem]">{info?.existing?.jamMasuk?.slice(0, 5)}</div>
            {statusMasukLabel && (
              <div className="text-[0.72rem] font-bold mt-1" style={{ color: statusMasukColor }}>
                {statusMasukLabel}
                {info?.existing?.jarakMasukMeter != null && info.existing.statusMasuk === "FAR" && (
                  <> — {info.existing.jarakMasukMeter}m dari sekolah</>
                )}
              </div>
            )}
          </div>
        )}

        {sudahPulang && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3 text-center">
            <div className="text-[0.75rem] text-[#64748b]">Jam Pulang</div>
            <div className="font-extrabold text-[#16a34a] text-[1.1rem]">{info?.existing?.jamPulang?.slice(0, 5)}</div>
            <div className="text-[0.72rem] text-[#64748b] mt-1">Terima kasih — sampai besok!</div>
          </div>
        )}

        {/* Tombol aksi */}
        {!sudahMasuk && (
          <button
            disabled={submitting || geoLoading}
            onClick={() => startAction("in")}
            className="w-full py-4 rounded-xl text-white font-extrabold text-[1rem] flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488)" }}
          >
            <LogIn size={20} /> {submitting ? "Menyimpan..." : geoLoading ? "Ambil lokasi..." : "Datang"}
          </button>
        )}

        {sudahMasuk && !sudahPulang && (
          <button
            disabled={submitting || geoLoading}
            onClick={() => startAction("out")}
            className="w-full py-4 rounded-xl text-white font-extrabold text-[1rem] flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}
          >
            <LogOut size={20} /> {submitting ? "Menyimpan..." : geoLoading ? "Ambil lokasi..." : "Pulang"}
          </button>
        )}

        {sudahMasuk && sudahPulang && (
          <button
            onClick={() => { try { window.close(); } catch { /* ignore */ } }}
            className="w-full py-3 rounded-xl bg-[#0d9488] text-white font-bold text-[0.9rem] flex items-center justify-center gap-2"
          >
            <X size={16} /> Selesai, Tutup Halaman
          </button>
        )}

        <div className="text-center text-xs text-[#94a3b8] mt-4 flex items-center justify-center gap-1">
          <MapPin size={12} /> Link ini pribadi, jangan dishare
        </div>
      </div>

      {showCamera && (
        <SelfieCamera
          onCapture={handleCapture}
          onCancel={() => setShowCamera(null)}
        />
      )}
    </div>
  );
}
