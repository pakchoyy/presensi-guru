import { ketPresensi } from "@/lib/ket-presensi";
import { LegendKet } from "@/components/attendance/LegendKet";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/components/shared/Toast";
import { teacherRepo } from "@/repositories/dexie/teacher.repo";
import { teacherAttendanceRepo } from "@/repositories/dexie/teacher-attendance.repo";
import { db } from "@/repositories/dexie/db";
import { exportRekapGuruPDF, exportRekapGuruXLSX, exportRekapKolektifPDF, exportRekapKolektifXLSX, periodeLabel, ttdBlok, type BarisKolektif } from "@/services/export.service";
import { ringkasKode } from "@/lib/rekap-kolektif";
import { isHariEfektif, todayStr } from "@/lib/utils";
import { adminCloud } from "@/services/multi-perangkat.service";
import { CalendarEntryType } from "@/types/enums";
import type { Teacher, TeacherAttendance } from "@/types/entities";
import { BarChart3, FileSpreadsheet, FileText, UserCheck } from "lucide-react";

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

function statusMasukLabel(s?: string) {
  if (!s) return "-";
  if (s === "ONTIME") return "Tepat";
  if (s === "LATE") return "Terlambat";
  if (s === "FAR") return "Luar Area";
  return s;
}

function statusMasukColor(s?: string) {
  if (s === "ONTIME") return "#16a34a";
  if (s === "LATE") return "#f59e0b";
  if (s === "FAR") return "#dc2626";
  return "var(--text-light)";
}

export function RekapPage() {
  const { school, teacher } = useApp();
  const { toast } = useToast();

  const now = new Date();
  const [guruList, setGuruList] = useState<Teacher[]>([]);
  const [selectedGuruId, setSelectedGuruId] = useState<number | null>(null);
  const [bulan, setBulan] = useState<number>(now.getMonth() + 1);
  const [tahun, setTahun] = useState<number>(now.getFullYear());
  const [records, setRecords] = useState<TeacherAttendance[]>([]);
  const [liburSet, setLiburSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [mode, setMode] = useState<"guru" | "semua">("guru");
  const [semuaRecords, setSemuaRecords] = useState<TeacherAttendance[]>([]);

  // Muat tanggal libur dari kalender akademik sekali (dipakai filter hari efektif).
  useEffect(() => {
    db.calendarEntries.toArray().then((entries) => {
      const libur = new Set(
        entries
          .filter((e) => e.jenis === CalendarEntryType.HARI_LIBUR)
          .map((e) => e.tanggal)
      );
      setLiburSet(libur);
    });
  }, []);

  // Absen guru dari HP masing-masing: tarik sebulan dari cloud, lalu baca ulang.
  const [versiCloud, setVersiCloud] = useState(0);
  useEffect(() => {
    const d1 = `${tahun}-${String(bulan).padStart(2, "0")}-01`;
    const d2 = `${tahun}-${String(bulan).padStart(2, "0")}-${String(daysInMonth(tahun, bulan)).padStart(2, "0")}`;
    adminCloud.tarikAbsen(d1, d2)
      .then(() => setVersiCloud((v) => v + 1))
      .catch(() => {});
  }, [bulan, tahun]);

  useEffect(() => {
    teacherRepo.list().then((list) => {
      const active = list.filter((g) => g.statusAktif !== false);
      setGuruList(active);
      if (active.length > 0 && selectedGuruId == null) {
        setSelectedGuruId(active[0].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versiCloud]); // HP Kepala Sekolah: daftar guru baru ada setelah tarik cloud

  useEffect(() => {
    if (!selectedGuruId) return;
    setLoading(true);
    const d1 = `${tahun}-${String(bulan).padStart(2, "0")}-01`;
    const dLast = daysInMonth(tahun, bulan);
    const d2 = `${tahun}-${String(bulan).padStart(2, "0")}-${String(dLast).padStart(2, "0")}`;
    teacherAttendanceRepo
      .getRange(selectedGuruId, d1, d2)
      .then((r) => setRecords(r))
      .finally(() => setLoading(false));
  }, [selectedGuruId, bulan, tahun, versiCloud]);

  // Rekap semua guru: satu baca untuk sebulan, lalu diringkas per guru.
  useEffect(() => {
    if (mode !== "semua") return;
    const mm = String(bulan).padStart(2, "0");
    teacherAttendanceRepo
      .getAllRange(`${tahun}-${mm}-01`, `${tahun}-${mm}-${String(daysInMonth(tahun, bulan)).padStart(2, "0")}`)
      .then(setSemuaRecords);
  }, [mode, bulan, tahun, versiCloud]);

  // Guru yang tidak ikut rekap kolektif (mis. akun Admin milik Kepala Sekolah yang sama), diingat per perangkat.
  const [kecuali, setKecuali] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("bgy_rekap_kecuali") || "[]")); } catch { return new Set(); }
  });
  const toggleKecuali = (id: number) => {
    const next = new Set(kecuali);
    if (next.has(id)) next.delete(id); else next.add(id);
    setKecuali(next);
    try { localStorage.setItem("bgy_rekap_kecuali", JSON.stringify([...next])); } catch { /* abaikan */ }
  };

  const barisSemuaAll = useMemo<(BarisKolektif & { id: number })[]>(() => {
    if (mode !== "semua") return [];
    const today = todayStr();
    const byKey = new Map(semuaRecords.map((r) => [`${r.guruId}|${r.tanggal}`, r]));
    const dMax = daysInMonth(tahun, bulan);
    return [...guruList]
      .sort((a, b) => a.nama.localeCompare(b.nama, "id"))
      .map((g) => {
        const kodes: string[] = [];
        for (let d = 1; d <= dMax; d++) {
          const date = `${tahun}-${String(bulan).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          if (date > today || !isHariEfektif(date, g, liburSet)) continue;
          kodes.push(ketPresensi(date, byKey.get(`${g.id}|${date}`)).kode);
        }
        return { id: g.id, nama: g.nama, ...ringkasKode(kodes) };
      });
  }, [mode, semuaRecords, guruList, bulan, tahun, liburSet]);
  const barisSemua = useMemo<BarisKolektif[]>(
    () => barisSemuaAll.filter((r) => !kecuali.has(r.id)).map(({ id: _id, ...r }) => r),
    [barisSemuaAll, kecuali]
  );

  const selectedGuru = useMemo(
    () => guruList.find((g) => g.id === selectedGuruId) || null,
    [guruList, selectedGuruId]
  );

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

  // Hanya HARI EFEKTIF (ikuti setting hari aktif + exclude libur). Minggu/libur
  // tidak ditampilkan sebagai baris.
  const previewRows = useMemo(() => {
    const dMax = daysInMonth(tahun, bulan);
    const byDate = new Map(records.map((r) => [r.tanggal, r]));
    const rows: Array<{ tgl: string; date: string; hari: string; rec?: TeacherAttendance }> = [];
    for (let d = 1; d <= dMax; d++) {
      const date = `${tahun}-${String(bulan).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (!isHariEfektif(date, selectedGuru ?? undefined, liburSet)) continue;
      const dow = new Date(tahun, bulan - 1, d).getDay();
      rows.push({ tgl: String(d), date, hari: HARI[dow], rec: byDate.get(date) });
    }
    return rows;
  }, [records, bulan, tahun, selectedGuru, liburSet]);

  const handleExport = async (jenis: "pdf" | "xlsx") => {
    if (mode === "semua") {
      setExporting(true);
      try {
        const ttd = ttdBlok(school, guruList);
        if (jenis === "pdf") await exportRekapKolektifPDF(school, periodeLabel(bulan, tahun), barisSemua, ttd);
        else await exportRekapKolektifXLSX(school, periodeLabel(bulan, tahun), barisSemua, ttd);
        toast(`✅ ${jenis.toUpperCase()} berhasil di-download`);
      } catch (e) {
        console.error(e);
        toast("❌ Gagal export");
      } finally {
        setExporting(false);
      }
      return;
    }
    if (!selectedGuru) { toast("Pilih guru dulu"); return; }
    setExporting(true);
    try {
      const ctx = {
        school,
        teacher,
        guru: selectedGuru,
        bulan,
        tahun,
        records,
        periode: periodeLabel(bulan, tahun),
        liburSet,
        ttd: ttdBlok(school, guruList),
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
      {/* Filter card */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
        <div className="text-[0.8rem] font-bold flex items-center gap-[6px] mb-[12px]">
          <BarChart3 size={15} /> Rekap Presensi Guru
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 mb-3 rounded-[10px] bg-[var(--input-bg)]" role="tablist" aria-label="Jenis rekap">
          {([["guru", "Per guru"], ["semua", "Semua guru"]] as const).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={mode === k}
              onClick={() => setMode(k)}
              className={`py-[8px] rounded-[8px] text-[0.78rem] font-bold border-none cursor-pointer ${mode === k ? "bg-[#2563eb] text-white" : "bg-transparent text-[var(--text-light)]"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "guru" && (<>
        <label className="block text-[0.68rem] font-bold text-[var(--text-light)] mb-1 uppercase">
          <UserCheck size={11} className="inline mr-1" /> Guru
        </label>
        <select
          value={selectedGuruId ?? ""}
          onChange={(e) => setSelectedGuruId(Number(e.target.value) || null)}
          className="w-full px-[10px] py-[9px] mb-3 border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.85rem] text-[var(--text)] bg-[var(--input-bg)] outline-none focus:border-[#2563eb] font-[inherit]"
        >
          {guruList.length === 0 && <option value="">— Belum ada guru —</option>}
          {guruList.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nama}{g.jabatan ? ` (${g.jabatan})` : ""}
            </option>
          ))}
        </select>
        </>)}

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="block text-[0.68rem] font-bold text-[var(--text-light)] mb-1 uppercase">Bulan</label>
            <select
              value={bulan}
              onChange={(e) => setBulan(Number(e.target.value))}
              className="w-full px-[10px] py-[9px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.85rem] bg-[var(--input-bg)] outline-none focus:border-[#2563eb] font-[inherit]"
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
              className="w-full px-[10px] py-[9px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.85rem] bg-[var(--input-bg)] outline-none focus:border-[#2563eb] font-[inherit]"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleExport("pdf")}
            disabled={exporting || (mode === "guru" ? !selectedGuru : barisSemua.length === 0)}
            className="flex-1 flex items-center justify-center gap-[6px] py-[10px] rounded-[10px] bg-[#2563eb] text-white font-bold text-[0.8rem] disabled:opacity-50 active:scale-95 transition-transform"
          >
            <FileText size={14} /> Export PDF
          </button>
          <button
            onClick={() => handleExport("xlsx")}
            disabled={exporting || (mode === "guru" ? !selectedGuru : barisSemua.length === 0)}
            className="flex-1 flex items-center justify-center gap-[6px] py-[10px] rounded-[10px] border-[1.5px] border-[#16a34a] text-[#16a34a] font-bold text-[0.8rem] bg-transparent disabled:opacity-50 active:scale-95 transition-transform"
          >
            <FileSpreadsheet size={14} /> Export Excel
          </button>
        </div>
      </div>

      {/* Rekap semua guru */}
      {mode === "semua" && guruList.length > 0 && (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
          <div className="text-[0.75rem] font-bold text-[var(--text-light)] mb-2">
            Rekap Kehadiran Guru {periodeLabel(bulan, tahun)}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[0.72rem]">
              <thead>
                <tr className="text-left text-[var(--text-light)] border-b border-[var(--border)]">
                  {["Ikut", "Nama", "Hari", "Hadir", "Terlambat", "Sakit", "Izin", "Alpa", "%"].map((h) => (
                    <th key={h} className={`py-1 pr-2 ${h === "Nama" ? "" : "text-center"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {barisSemuaAll.map((r) => (
                  <tr key={r.id} className={`border-b border-[var(--border)]/50 ${kecuali.has(r.id) ? "opacity-40" : ""}`}>
                    <td className="py-1 pr-2 text-center">
                      <input type="checkbox" checked={!kecuali.has(r.id)} onChange={() => toggleKecuali(r.id)} aria-label={`Ikutkan ${r.nama} di rekap`} className="w-4 h-4 cursor-pointer" />
                    </td>
                    <td className="py-1 pr-2 font-bold text-[var(--text)] whitespace-nowrap">{r.nama}</td>
                    <td className="py-1 pr-2 text-center">{r.hari}</td>
                    <td className="py-1 pr-2 text-center text-[#16a34a]">{r.hadir}</td>
                    <td className="py-1 pr-2 text-center text-[#f59e0b]">{r.terlambat}</td>
                    <td className="py-1 pr-2 text-center text-[#ea580c]">{r.sakit}</td>
                    <td className="py-1 pr-2 text-center text-[#2563eb]">{r.izin}</td>
                    <td className="py-1 pr-2 text-center text-[#991b1b]">{r.alpa}</td>
                    <td className="py-1 pr-2 text-center font-bold">{r.persen}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[0.66rem] text-[var(--text-light)] mt-2 mb-0">Hari = hari efektif yang sudah berjalan. Hadir termasuk pulang cepat & luar area. Hilangkan centang "Ikut" untuk guru yang tidak dicetak (mis. akun Admin milik Kepala Sekolah yang sama).</p>
        </div>
      )}

      {/* Stats */}
      {mode === "guru" && selectedGuru && (
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
            <StatBox label="Alpha" value={previewRows.filter((r) => ketPresensi(r.date, r.rec).kode === "A").length} color="#991b1b" />
            <StatBox label="Hari" value={previewRows.length} color="var(--text-light)" />
          </div>
        </div>
      )}

      {/* Preview tabel */}
      {mode === "guru" && selectedGuru && (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px]">
          <div className="text-[0.75rem] font-bold text-[var(--text-light)] mb-2">
            Preview — {loading ? "memuat..." : `${records.length} record`}
          </div>
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
                {previewRows.map((r, i) => (
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
        </div>
      )}

      {guruList.length === 0 && (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-6 text-center">
          <UserCheck className="mx-auto text-[var(--text-light)] mb-2" size={32} />
          <div className="font-bold text-[var(--text)]">Belum ada guru</div>
          <div className="text-[0.78rem] text-[var(--text-light)] mt-1">
            Tambah guru dulu di menu Guru untuk melihat rekap presensi
          </div>
        </div>
      )}
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
