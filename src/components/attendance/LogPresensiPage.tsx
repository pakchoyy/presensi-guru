import { labelPeran } from "@/lib/utils";
import { ketPresensi } from "@/lib/ket-presensi";
import { LegendKet } from "@/components/attendance/LegendKet";
import { useEffect, useMemo, useState } from "react";
import { History, FileSpreadsheet, FileText } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/components/shared/Toast";
import { teacherAttendanceRepo } from "@/repositories/dexie/teacher-attendance.repo";
import { db } from "@/repositories/dexie/db";
import { exportRekapGuruPDF, exportRekapGuruXLSX, periodeLabel } from "@/services/export.service";
import { isHariEfektif, inisial } from "@/lib/utils";
import { CalendarEntryType } from "@/types/enums";
import type { TeacherAttendance, Teacher } from "@/types/entities";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

function fmtTime(t?: string) {
  if (!t) return "-";
  return t.slice(0, 5);
}

function statusLabel(rec?: TeacherAttendance) {
  if (rec?.statusHari === "S") return "Sakit";
  if (rec?.statusHari === "I") return "Izin";
  if (rec?.statusHari === "A") return "Alpha";
  const s = rec?.statusMasuk;
  if (s === "ONTIME") return "Tepat";
  if (s === "LATE") return "Terlambat";
  if (s === "FAR") return "Luar Area";
  return "-";
}

function statusColor(rec?: TeacherAttendance) {
  if (rec?.statusHari === "S") return "#ea580c";
  if (rec?.statusHari === "I") return "#2563eb";
  if (rec?.statusHari === "A") return "#991b1b";
  const s = rec?.statusMasuk;
  if (s === "ONTIME") return "#16a34a";
  if (s === "LATE") return "#f59e0b";
  if (s === "FAR") return "#dc2626";
  return "var(--text-light)";
}

type Mode = "pick" | "list";

export function LogPresensiPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { teachers, guruSessionId } = useApp();
  const [guru, setGuru] = useState<Teacher | null>(null);
  const [mode, setMode] = useState<Mode>("pick");

  // auto-pick kalau sesi presensi lagi aktif
  useEffect(() => {
    const sid = guruSessionId ?? (() => {
      try { return JSON.parse(localStorage.getItem("bgy_presensi_guru_session") || "null")?.guruId ?? null; } catch { return null; }
    })();
    if (sid != null) {
      const t = teachers.find((x) => x.id === sid);
      if (t) { setGuru(t); setMode("list"); }
    }
  }, [teachers, guruSessionId]);

  if (mode === "pick" || !guru) {
    // Embedded (guru shell): tidak ada picker/ganti — kalau sesi hilang, minta login ulang.
    if (embedded) {
      return <div className="flex-1 p-8 text-center text-[var(--text-light)]">Sesi berakhir. Silakan masuk ulang.</div>;
    }
    return (
      <GuruPicker
        teachers={teachers}
        onPick={(t) => { setGuru(t); setMode("list"); }}
      />
    );
  }
  return <RiwayatGuru guru={guru} onChangeGuru={embedded ? undefined : () => setMode("pick")} />;
}

function GuruPicker({
  teachers,
  onPick,
}: {
  teachers: Teacher[];
  onPick: (t: Teacher) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return teachers
      .filter((t) => t.statusAktif !== false)
      .filter((t) => !needle
        || t.nama.toLowerCase().includes(needle)
        || (t.nip || "").toLowerCase().includes(needle)
        || (t.kodeLogin || "").toLowerCase().includes(needle));
  }, [teachers, q]);

  return (
    <div className="flex-1 px-[14px] pt-[14px] pb-[calc(90px+var(--ticker-h,0px))] lg:pb-4">
      <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-[14px] mb-3" style={{ boxShadow: "var(--shadow)" }}>
        <div className="text-[0.85rem] font-bold flex items-center gap-[6px] mb-2">
          <History size={16} /> Log Presensi — pilih guru
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama / NIP / kode"
          className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[0.9rem] outline-none focus:border-[var(--brand)]"
        />
      </div>
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-6 text-center text-[var(--text-light)] text-[0.85rem]">
            Tidak ada guru cocok.
          </div>
        )}
        {filtered.map((t) => (
          <button
            key={t.id}
            onClick={() => onPick(t)}
            className="w-full text-left bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-3 flex items-center gap-3 active:scale-[.99]"
            style={{ boxShadow: "var(--shadow)" }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[0.85rem]"
              style={{ background: "var(--grad)" }}
            >
              {inisial(t.nama)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[var(--text)] text-[0.88rem] truncate">{t.nama}</div>
              <div className="text-[0.68rem] text-[var(--text-light)] truncate">
                {labelPeran(t) || t.jabatan || "—"}{t.nip ? ` • ${t.nip}` : ""}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Riwayat presensi milik satu guru — tampilannya mengikuti Rekap di sisi admin
 * (filter bulan/tahun, ringkasan angka, tabel hari efektif, export PDF/Excel).
 */
function RiwayatGuru({ guru, onChangeGuru }: { guru: Teacher; onChangeGuru?: () => void }) {
  const { school, teacher } = useApp();
  const { toast } = useToast();

  const now = new Date();
  const [bulan, setBulan] = useState<number>(now.getMonth() + 1);
  const [tahun, setTahun] = useState<number>(now.getFullYear());
  const [records, setRecords] = useState<TeacherAttendance[]>([]);
  const [liburSet, setLiburSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    db.calendarEntries.toArray().then((entries) => {
      setLiburSet(
        new Set(
          entries
            .filter((e) => e.jenis === CalendarEntryType.HARI_LIBUR)
            .map((e) => e.tanggal)
        )
      );
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const mm = String(bulan).padStart(2, "0");
    const d1 = `${tahun}-${mm}-01`;
    const d2 = `${tahun}-${mm}-${String(daysInMonth(tahun, bulan)).padStart(2, "0")}`;
    teacherAttendanceRepo
      .getRange(guru.id, d1, d2)
      .then(setRecords)
      .finally(() => setLoading(false));
  }, [guru.id, bulan, tahun]);

  const stats = useMemo(() => {
    let totalMasuk = 0, ontime = 0, late = 0, far = 0, sakit = 0, izin = 0, alpha = 0;
    for (const r of records) {
      if (r.jamMasuk) {
        totalMasuk++;
        if (r.statusMasuk === "LATE") late++;
        else if (r.statusMasuk === "FAR") far++;
        else ontime++;
      }
      if (r.statusHari === "S") sakit++;
      else if (r.statusHari === "I") izin++;
      else if (r.statusHari === "A") alpha++;
    }
    return { totalMasuk, ontime, late, far, sakit, izin, alpha };
  }, [records]);

  // Hanya hari efektif (ikut setting hari aktif + kalender libur).
  const rows = useMemo(() => {
    const dMax = daysInMonth(tahun, bulan);
    const byDate = new Map(records.map((r) => [r.tanggal, r]));
    const out: Array<{ tgl: string; date: string; hari: string; rec?: TeacherAttendance }> = [];
    for (let d = 1; d <= dMax; d++) {
      const date = `${tahun}-${String(bulan).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (!isHariEfektif(date, guru, liburSet)) continue;
      out.push({ tgl: String(d), date, hari: HARI[new Date(tahun, bulan - 1, d).getDay()], rec: byDate.get(date) });
    }
    return out;
  }, [records, bulan, tahun, guru, liburSet]);

  const handleExport = async (jenis: "pdf" | "xlsx") => {
    setExporting(true);
    try {
      const ctx = {
        school,
        teacher,
        guru,
        bulan,
        tahun,
        records,
        periode: periodeLabel(bulan, tahun),
        liburSet,
      };
      if (jenis === "pdf") await exportRekapGuruPDF(ctx);
      else await exportRekapGuruXLSX(ctx);
      toast(`✅ ${jenis.toUpperCase()} berhasil di-download`);
    } catch (e) {
      console.error(e);
      toast("❌ Gagal export");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex-1 px-[14px] pt-[14px] pb-[calc(90px+var(--ticker-h,0px))] lg:pb-4">
      {/* Identitas guru */}
      <div
        className="rounded-2xl p-3 text-white relative overflow-hidden flex items-center gap-3"
        style={{ background: "var(--grad)", boxShadow: "var(--shadow-lg)" }}
      >
        <span className="header-orb" style={{ width: 100, height: 100, top: -30, right: -20 }} />
        <div className="w-11 h-11 rounded-full bg-white/20 border border-white/30 flex items-center justify-center font-extrabold text-[0.9rem] relative">
          {inisial(guru.nama)}
        </div>
        <div className="flex-1 min-w-0 relative">
          <div className="text-[0.95rem] font-extrabold truncate">{guru.nama}</div>
          <div className="text-[0.7rem] opacity-90 truncate">
            {labelPeran(guru) || guru.jabatan || "Guru"}{guru.nip ? ` · ${guru.nip}` : ""}
          </div>
        </div>
        {onChangeGuru && (
          <button
            onClick={onChangeGuru}
            className="h-9 px-3 rounded-xl bg-white/15 border border-white/30 text-[0.72rem] font-bold active:scale-95 relative"
          >
            Ganti
          </button>
        )}
      </div>

      {/* Filter + export */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mt-3 mb-3">
        <div className="text-[0.8rem] font-bold flex items-center gap-[6px] mb-[12px]">
          <History size={15} /> Rekap Presensi Saya
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="block text-[0.68rem] font-bold text-[var(--text-light)] mb-1 uppercase">Bulan</label>
            <select
              value={bulan}
              onChange={(e) => setBulan(Number(e.target.value))}
              className="w-full px-[10px] py-[9px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.85rem] bg-[var(--input-bg)] text-[var(--text)] outline-none focus:border-[#2563eb] font-[inherit]"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[0.68rem] font-bold text-[var(--text-light)] mb-1 uppercase">Tahun</label>
            <input
              type="number"
              value={tahun}
              onChange={(e) => setTahun(Number(e.target.value))}
              className="w-full px-[10px] py-[9px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.85rem] bg-[var(--input-bg)] text-[var(--text)] outline-none focus:border-[#2563eb] font-[inherit]"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleExport("pdf")}
            disabled={exporting}
            className="flex-1 flex items-center justify-center gap-[6px] py-[10px] rounded-[10px] bg-[#2563eb] text-white font-bold text-[0.8rem] disabled:opacity-50 active:scale-95 transition-transform"
          >
            <FileText size={14} /> Export PDF
          </button>
          <button
            onClick={() => handleExport("xlsx")}
            disabled={exporting}
            className="flex-1 flex items-center justify-center gap-[6px] py-[10px] rounded-[10px] border-[1.5px] border-[#16a34a] text-[#16a34a] font-bold text-[0.8rem] bg-transparent disabled:opacity-50 active:scale-95 transition-transform"
          >
            <FileSpreadsheet size={14} /> Export Excel
          </button>
        </div>
      </div>

      {/* Ringkasan */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
        <div className="text-[0.75rem] font-bold text-[var(--text-light)] mb-2">
          Ringkasan {periodeLabel(bulan, tahun)}
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <StatBox label="Masuk" value={stats.totalMasuk} color="#2563eb" />
          <StatBox label="Tepat" value={stats.ontime} color="#16a34a" />
          <StatBox label="Terlambat" value={stats.late} color="#f59e0b" />
          <StatBox label="Luar Area" value={stats.far} color="#dc2626" />
          <StatBox label="Sakit" value={stats.sakit} color="#ea580c" />
          <StatBox label="Izin" value={stats.izin} color="#2563eb" />
          <StatBox label="Alpha" value={rows.filter((r) => ketPresensi(r.date, r.rec).kode === "A").length} color="#991b1b" />
          <StatBox label="Hari" value={rows.length} color="var(--text-light)" />
        </div>
      </div>

      {/* Tabel hari efektif */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px]">
        <div className="text-[0.75rem] font-bold text-[var(--text-light)] mb-2">
          {loading ? "Memuat..." : `${records.length} catatan · ${rows.length} hari efektif`}
        </div>
        {rows.length === 0 && !loading ? (
          <div className="py-6 text-center text-[var(--text-light)] text-[0.8rem]">
            Tidak ada hari efektif di {MONTHS[bulan - 1]} {tahun}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[0.72rem]">
              <thead>
                <tr className="text-left text-[var(--text-light)] border-b border-[var(--border)]">
                  <th className="py-1 pr-2">Tgl</th>
                  <th className="py-1 pr-2">Hari</th>
                  <th className="py-1 pr-2">Masuk</th>
                  <th className="py-1 pr-2">Pulang</th>
                  <th className="py-1 pr-2 text-center">Ket</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--border)]/50">
                    <td className="py-1 pr-2 font-bold text-[var(--text)]">{r.tgl}</td>
                    <td className="py-1 pr-2 text-[var(--text-light)]">{r.hari}</td>
                    <td className="py-1 pr-2">{fmtTime(r.rec?.jamMasuk)}</td>
                    <td className="py-1 pr-2">{fmtTime(r.rec?.jamPulang)}</td>
                    <td className="py-1 pr-2 font-bold text-center" style={{ color: ketPresensi(r.date, r.rec).warna }} title={ketPresensi(r.date, r.rec).label}>
                      {ketPresensi(r.date, r.rec).kode}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <LegendKet />
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-[var(--input-bg)] py-2 px-1">
      <div className="text-[1.2rem] font-extrabold" style={{ color }}>{value}</div>
      <div className="text-[0.6rem] text-[var(--text-light)] uppercase tracking-wide">{label}</div>
    </div>
  );
}
