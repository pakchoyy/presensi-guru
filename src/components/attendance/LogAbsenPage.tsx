import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ClipboardList, LogIn, LogOut, MapPin, UserRound } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { teacherAttendanceRepo } from "@/repositories/dexie/teacher-attendance.repo";
import type { TeacherAttendance } from "@/types/entities";
import { formatTanggalPanjang } from "@/lib/utils";
import { guruCloud } from "@/services/multi-perangkat.service";

const ymdLokal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

interface BarisLog {
  kunci: string;
  jenis: "in" | "out";
  jam: string;
  tanggal: string;
  foto?: string;
  jarak?: number;
  status?: string;
  verifikasi?: boolean;
}

function statusLabel(s?: string) {
  if (s === "ONTIME") return "Tepat waktu";
  if (s === "LATE") return "Terlambat";
  if (s === "FAR") return "Luar area";
  if (s === "EARLY") return "Pulang cepat";
  return null;
}

function statusWarna(s?: string) {
  if (s === "ONTIME") return "#16a34a";
  if (s === "LATE") return "#f59e0b";
  if (s === "FAR") return "#dc2626";
  if (s === "EARLY") return "#6b7280";
  return "var(--text-light)";
}

/**
 * Log presensi harian milik guru yang sedang login: satu kartu per aktivitas
 * (datang / pulang) lengkap dengan foto selfie, jam, dan nama sekolah.
 */
export function LogAbsenPage() {
  const { guruSessionId, school } = useApp();
  const [records, setRecords] = useState<TeacherAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  // Log dibatasi 30 hari terakhir; rentang tanggal bisa dipersempit untuk mencari cepat.
  const hariIni = ymdLokal(new Date());
  const batasAwal = ymdLokal(new Date(Date.now() - 30 * 24 * 3600 * 1000));
  const [dari, setDari] = useState(batasAwal);
  const [sampai, setSampai] = useState(hariIni);

  useEffect(() => {
    if (guruSessionId == null) return;
    setLoading(true);
    teacherAttendanceRepo
      .getRange(guruSessionId, dari, sampai)
      .then(setRecords)
      .finally(() => setLoading(false));
  }, [guruSessionId, dari, sampai]);

  const atur = (d: string, s: string) => {
    const dd = d < batasAwal ? batasAwal : d;
    const ss = s > hariIni ? hariIni : s;
    setDari(dd);
    setSampai(ss < dd ? dd : ss);
  };
  const hariMundur = (n: number) => ymdLokal(new Date(Date.now() - n * 24 * 3600 * 1000));

  const baris = useMemo(() => {
    const out: BarisLog[] = [];
    for (const r of records) {
      if (r.jamMasuk) {
        out.push({
          kunci: `${r.id}-in`,
          jenis: "in",
          jam: r.jamMasuk,
          tanggal: r.tanggal,
          foto: r.selfieMasukUrl,
          jarak: r.jarakMasukMeter,
          status: r.statusMasuk,
          verifikasi: r.verifikasiWajahMasuk,
        });
      }
      if (r.jamPulang) {
        out.push({
          kunci: `${r.id}-out`,
          jenis: "out",
          jam: r.jamPulang,
          tanggal: r.tanggal,
          foto: r.selfiePulangUrl,
          jarak: r.jarakPulangMeter,
          status: r.statusPulang,
          verifikasi: r.verifikasiWajahPulang,
        });
      }
    }
    return out.sort((a, b) =>
      b.tanggal === a.tanggal ? b.jam.localeCompare(a.jam) : b.tanggal.localeCompare(a.tanggal),
    );
  }, [records]);

  // Dikelompokkan per tanggal supaya gampang dicek harian.
  const kelompok = useMemo(() => {
    const peta = new Map<string, BarisLog[]>();
    for (const b of baris) {
      const daftar = peta.get(b.tanggal) ?? [];
      daftar.push(b);
      peta.set(b.tanggal, daftar);
    }
    return [...peta.entries()];
  }, [baris]);

  return (
    <div className="flex-1 px-[14px] pt-[14px] pb-[calc(90px+var(--ticker-h,0px))] lg:pb-4">
      <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-[14px] mb-3" style={{ boxShadow: "var(--shadow)" }}>
        <div className="text-[0.85rem] font-bold flex items-center gap-[6px]">
          <ClipboardList size={16} /> Log Presensi
        </div>
        <div className="text-[0.63rem] text-[var(--text-light)] mt-1">
          Aktivitas presensi datang &amp; pulang Anda, 30 hari terakhir.
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          {([["Dari", dari, (v: string) => atur(v, sampai)], ["Sampai", sampai, (v: string) => atur(dari, v)]] as const).map(([l, v, set]) => (
            <label key={l} className="flex flex-col gap-1 text-[0.62rem] font-bold text-[var(--text-light)]">
              <span className="flex items-center gap-1"><CalendarDays size={11} /> {l}</span>
              <input
                type="date"
                value={v}
                min={batasAwal}
                max={hariIni}
                onChange={(e) => e.target.value && set(e.target.value)}
                className="px-2 py-[7px] rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)] text-[0.8rem] font-[inherit] outline-none"
              />
            </label>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          {([["Hari ini", 0], ["7 hari", 7], ["30 hari", 30]] as const).map(([l, n]) => (
            <button
              key={l}
              onClick={() => atur(hariMundur(n), hariIni)}
              className={`px-3 py-[5px] rounded-full text-[0.68rem] font-bold border-[1.5px] cursor-pointer ${
                dari === hariMundur(n) && sampai === hariIni
                  ? "bg-[var(--brand)] text-white border-transparent"
                  : "bg-[var(--card-bg)] text-[var(--text)] border-[var(--border)]"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-6 text-center text-[var(--text-light)] text-[0.85rem]">
          Memuat...
        </div>
      )}

      {!loading && baris.length === 0 && (
        <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-6 text-center">
          <ClipboardList className="mx-auto text-[var(--text-light)] mb-2" size={30} />
          <div className="font-bold text-[var(--text)] text-[0.9rem]">Belum ada aktivitas</div>
          <div className="text-[0.75rem] text-[var(--text-light)] mt-1">
            Presensi datang dulu di tab Presensi.
          </div>
        </div>
      )}

      {kelompok.map(([tanggal, daftar]) => (
        <div key={tanggal} className="mb-3">
          <div className="text-[0.68rem] font-bold text-[var(--text-light)] px-1 mb-[6px]">
            {formatTanggalPanjang(tanggal)}
          </div>
          <div className="space-y-2">
            {daftar.map((b) => (
              <div
                key={b.kunci}
                className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-3 flex items-center gap-3"
                style={{ boxShadow: "var(--shadow)" }}
              >
                <div
                  className="w-12 h-12 rounded-full overflow-hidden border-2 flex-shrink-0 bg-[var(--input-bg)] flex items-center justify-center"
                  style={{ borderColor: b.jenis === "in" ? "var(--brand)" : "#16a34a" }}
                >
                  <FotoSelfie nilai={b.foto} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[var(--text)] text-[0.85rem] flex items-center gap-[6px]">
                    {b.jenis === "in" ? <LogIn size={13} /> : <LogOut size={13} />}
                    {b.jenis === "in" ? "Datang" : "Pulang"} — {b.jam.slice(0, 8)}
                  </div>
                  <div className="text-[0.68rem] text-[var(--text-light)] truncate mt-[2px]">
                    {school?.nama ?? "—"}
                  </div>
                  {b.jarak != null && (
                    <div className="text-[0.62rem] text-[var(--text-light)] flex items-center gap-1 mt-[2px]">
                      <MapPin size={9} /> {b.jarak} m dari sekolah
                    </div>
                  )}
                  {b.verifikasi === false && (
                    <div className="text-[0.6rem] font-bold text-[#b45309] mt-[2px]">Foto tanpa verifikasi wajah</div>
                  )}
                </div>

                {statusLabel(b.status) && (
                  <span
                    className="px-2 py-[3px] rounded-full text-[0.6rem] font-extrabold flex-shrink-0"
                    style={{ background: statusWarna(b.status) + "22", color: statusWarna(b.status) }}
                  >
                    {statusLabel(b.status)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Selfie bisa berupa data URL lokal atau path Storage ("sb:...") dari cloud. */
function FotoSelfie({ nilai }: { nilai?: string }) {
  const [src, setSrc] = useState<string | null>(
    nilai && !nilai.startsWith("sb:") ? nilai : null,
  );
  useEffect(() => {
    let batal = false;
    if (nilai?.startsWith("sb:")) {
      guruCloud.urlSelfie(nilai).then((u) => { if (!batal) setSrc(u); }).catch(() => {});
    }
    return () => { batal = true; };
  }, [nilai]);
  if (!src) return <UserRound size={22} className="text-[var(--text-light)]" />;
  return <img src={src} alt="" className="w-full h-full object-cover" />;
}
