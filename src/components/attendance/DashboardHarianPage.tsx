import { labelPeran } from "@/lib/utils";
import { PersetujuanIzin } from "@/components/attendance/PersetujuanIzin";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalIcon,
  Users,
} from "lucide-react";
import { teacherAttendanceRepo } from "@/repositories/dexie/teacher-attendance.repo";
import { teacherRepo } from "@/repositories/dexie/teacher.repo";
import type { TeacherAttendance, Teacher } from "@/types/entities";
import { formatTanggalPanjang, inisial, attendanceIdFrom, timestamp } from "@/lib/utils";
import type { AttendanceStatus } from "@/types/enums";
import { ClockInStatus } from "@/types/enums";
import { useApp } from "@/contexts/AppContext";
import { adminCloud } from "@/services/multi-perangkat.service";
import { StatusSheet } from "./StatusSheet";
import { useToast } from "@/components/shared/Toast";

type Row = {
  guru: Teacher;
  attendance?: TeacherAttendance;
};

// util tanggal lokal (hindari masalah timezone todayStr dari UTC)
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

type Bucket = "hadir" | "sakit" | "izin" | "alpha" | "terlambat" | "belum";
const CHIP_COLOR: Record<Bucket, { dot: string; label: string; text: string }> = {
  hadir:     { dot: "#16a34a", label: "Hadir",     text: "text-[#16a34a]" },
  sakit:     { dot: "#b45309", label: "Sakit",     text: "text-[#b45309]" },
  izin:      { dot: "#1d4ed8", label: "Izin",      text: "text-[#1d4ed8]" },
  alpha:     { dot: "#dc2626", label: "Alpha",     text: "text-[#dc2626]" },
  terlambat: { dot: "#f59e0b", label: "Terlambat", text: "text-[#f59e0b]" },
  belum:     { dot: "#94a3b8", label: "Belum",     text: "text-[var(--text-light)]" },
};

function bucketFor(att?: TeacherAttendance): Bucket {
  // Status manual (statusHari) selalu diprioritaskan.
  const ditolak = att?.statusIzin === "ditolak" && (att.statusHari === "S" || att.statusHari === "I");
  if (att?.statusHari && !ditolak) {
    if (att.statusHari === "H") return "hadir";
    if (att.statusHari === "T") return "terlambat";
    if (att.statusHari === "S") return "sakit";
    if (att.statusHari === "I") return "izin";
    if (att.statusHari === "A") return "alpha";
  }
  if (!att?.jamMasuk) return "belum";
  if (att.statusMasuk === "LATE") return "terlambat";
  if (att.statusMasuk === "FAR") return "alpha";
  return "hadir";
}

export function DashboardHarianPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tanggal, setTanggal] = useState<string>(ymd(new Date()));
  const [editGuru, setEditGuru] = useState<Teacher | null>(null);
  const { school } = useApp();
  const { toast } = useToast();
  const dateInputRef = useRef<HTMLInputElement>(null);

  const setStatus = async (guru: Teacher, status: AttendanceStatus | "RESET") => {
    const id = attendanceIdFrom(guru.id, tanggal);
    const existing = await teacherAttendanceRepo.getById(id);
    if (status === "RESET") {
      await teacherAttendanceRepo.upsert({
        ...(existing || {}),
        id, guruId: guru.id, tanggal,
        statusHari: undefined,
        statusIzin: undefined,
        diubahPada: timestamp(),
      } as TeacherAttendance);
    } else {
      await teacherAttendanceRepo.upsert({
        ...(existing || {}),
        id, guruId: guru.id, tanggal,
        statusHari: status,
        // Diputuskan admin langsung → bukan lagi pengajuan.
        statusIzin: undefined,
        diubahPada: timestamp(),
      } as TeacherAttendance);
    }
    setEditGuru(null);
    toast(`Status ${guru.nama} diperbarui`, "success");
    const rec = await teacherAttendanceRepo.getById(id);
    if (rec) await adminCloud.kirimAbsen(guru.id, rec).catch(() => false);
    load(tanggal, false);
  };

  /** Admin mengisi jam masuk/pulang manual (guru lupa absen). */
  const simpanJamManual = async (guru: Teacher, jamMasuk: string, jamPulang: string) => {
    const id = attendanceIdFrom(guru.id, tanggal);
    const existing = await teacherAttendanceRepo.getById(id);

    const masuk = jamMasuk ? `${jamMasuk}:00` : undefined;
    const pulang = jamPulang ? `${jamPulang}:00` : undefined;

    // Status masuk ikut jam standar + toleransi sekolah, sama seperti clock-in.
    let statusMasuk = existing?.statusMasuk;
    if (!masuk) {
      statusMasuk = undefined;
    } else {
      const standar = school?.jamMasukStandar ?? "07:00";
      const toleransi = school?.toleransiTerlambatMenit ?? 15;
      const [h, m] = standar.split(":").map(Number);
      const batas = h * 60 + m + toleransi;
      const [jh, jm] = jamMasuk.split(":").map(Number);
      statusMasuk = jh * 60 + jm <= batas ? ClockInStatus.ONTIME : ClockInStatus.LATE;
    }

    await teacherAttendanceRepo.upsert({
      ...(existing || {}),
      id,
      guruId: guru.id,
      tanggal,
      jamMasuk: masuk,
      jamPulang: pulang,
      statusMasuk,
      statusPulang: pulang ? (existing?.statusPulang ?? ClockInStatus.ONTIME) : undefined,
      diubahPada: timestamp(),
    } as TeacherAttendance);

    setEditGuru(null);
    toast(`Jam ${guru.nama} disimpan`, "success");
    const rec = await teacherAttendanceRepo.getById(id);
    if (rec) await adminCloud.kirimAbsen(guru.id, rec).catch(() => false);
    load(tanggal, false);
  };

  const bukaKalender = () => {
    const el = dateInputRef.current;
    if (!el) return;
    // showPicker() didukung browser modern; fallback ke focus+click.
    if (typeof el.showPicker === "function") {
      try { el.showPicker(); return; } catch { /* ignore */ }
    }
    el.focus();
    el.click();
  };

  const load = async (tglOverride?: string, tarikCloud = true) => {
    const tgl = tglOverride || tanggal;
    setLoading(true);
    try {
      const [teachers, records] = await Promise.all([
        teacherRepo.list(),
        teacherAttendanceRepo.getAllToday(tgl),
      ]);
      const map = new Map(records.map((r) => [r.guruId, r]));
      setRows(
        teachers
          .filter((t) => t.statusAktif !== false)
          .map((guru) => ({ guru, attendance: map.get(guru.id) }))
      );
    } finally {
      setLoading(false);
    }
    // Tampilkan data lokal dulu, lalu tarik absen dari HP guru (cloud).
    if (tarikCloud) {
      await adminCloud.kirimAntrian().catch(() => {});
      const berubah = await adminCloud.tarikAbsen(tgl, tgl).catch(() => 0);
      if (berubah > 0) await load(tgl, false);
    }
  };

  useEffect(() => { load(tanggal); /* eslint-disable-next-line */ }, [tanggal]);

  // Selama dashboard terbuka, absen guru dari HP masing-masing ikut masuk.
  useEffect(() => {
    const segarkan = () => { if (document.visibilityState === "visible") load(tanggal); };
    const t = setInterval(segarkan, 60_000);
    document.addEventListener("visibilitychange", segarkan);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", segarkan); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanggal]);

  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { hadir: 0, sakit: 0, izin: 0, alpha: 0, terlambat: 0, belum: 0 };
    for (const r of rows) c[bucketFor(r.attendance)] += 1;
    return c;
  }, [rows]);

  const total = rows.length;
  const sudah = rows.filter((r) => r.attendance?.jamMasuk).length;

  const gantiTanggal = (delta: number) => {
    const d = parseYmd(tanggal);
    d.setDate(d.getDate() + delta);
    setTanggal(ymd(d));
  };

  return (
    <div className="flex-1 px-[14px] pt-[14px] pb-[90px] lg:pb-4">
      <PersetujuanIzin onBerubah={() => load()} />
      {/* Date pager */}
      <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-[10px] mb-3 flex items-center gap-2" style={{ boxShadow: "var(--shadow)" }}>
        <button
          onClick={() => gantiTanggal(-1)}
          className="w-9 h-9 rounded-xl bg-[var(--input-bg)] text-[var(--text)] flex items-center justify-center cursor-pointer active:scale-95"
          aria-label="Hari sebelumnya"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 text-center">
          <div className="text-[0.9rem] font-extrabold text-[var(--text)] leading-tight">
            {formatTanggalPanjang(tanggal)}
          </div>
          <div className="text-[0.65rem] text-[var(--text-light)] flex items-center justify-center gap-1 mt-[2px]">
            <CalIcon size={10} /> {tanggal}
          </div>
        </div>
        <button
          onClick={bukaKalender}
          className="relative w-9 h-9 rounded-xl bg-[var(--input-bg)] text-[var(--brand)] flex items-center justify-center cursor-pointer active:scale-95"
          aria-label="Pilih tanggal"
          title="Pilih tanggal"
        >
          <CalIcon size={17} className={loading ? "opacity-50" : ""} />
          <input
            ref={dateInputRef}
            type="date"
            value={tanggal}
            onChange={(e) => { if (e.target.value) setTanggal(e.target.value); }}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            tabIndex={-1}
            aria-hidden="true"
          />
        </button>
        <button
          onClick={() => gantiTanggal(1)}
          className="w-9 h-9 rounded-xl bg-[var(--input-bg)] text-[var(--text)] flex items-center justify-center cursor-pointer active:scale-95"
          aria-label="Hari berikutnya"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Chip stat ringkasan — gaya prototype */}
      <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-[10px] mb-3 flex items-center gap-2 overflow-x-auto scrollbar-hide" style={{ boxShadow: "var(--shadow)" }}>
        {(["hadir", "sakit", "izin", "alpha", "terlambat", "belum"] as Bucket[]).map((k) => {
          const c = CHIP_COLOR[k];
          return (
            <div
              key={k}
              className="flex items-center gap-[6px] flex-shrink-0 px-[10px] py-[6px] rounded-full bg-[var(--input-bg)]"
            >
              <span className="w-2 h-2 rounded-full" style={{ background: c.dot }} />
              <span className="text-[0.7rem] text-[var(--text-light)] font-semibold">{c.label}</span>
              <span className={`text-[0.78rem] font-extrabold ${c.text}`}>{counts[k]}</span>
            </div>
          );
        })}
      </div>

      {/* Total ringkas */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-2xl p-3 text-center" style={{ background: "linear-gradient(135deg,#dbeafe,#ffffff)", border: "1px solid var(--border)" }}>
          <div className="text-[0.65rem] text-[var(--text-light)] font-semibold">Total Guru</div>
          <div className="font-extrabold text-[var(--brand-strong)] text-[1.25rem] leading-none mt-1">{total}</div>
        </div>
        <div className="rounded-2xl p-3 text-center bg-[var(--hadir-bg)]" style={{ border: "1px solid var(--border)" }}>
          <div className="text-[0.65rem] text-[var(--text-light)] font-semibold">Sudah Presensi</div>
          <div className="font-extrabold text-[var(--hadir)] text-[1.25rem] leading-none mt-1">{sudah}</div>
        </div>
        <div className="rounded-2xl p-3 text-center bg-[var(--alpha-bg)]" style={{ border: "1px solid var(--border)" }}>
          <div className="text-[0.65rem] text-[var(--text-light)] font-semibold">Belum</div>
          <div className="font-extrabold text-[var(--alpha)] text-[1.25rem] leading-none mt-1">{total - sudah}</div>
        </div>
      </div>

      {rows.length === 0 && !loading && (
        <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-6 text-center">
          <Users className="mx-auto text-[var(--text-light)] mb-2" size={28} />
          <div className="font-bold text-[var(--text)]">Belum ada guru terdaftar</div>
          <div className="text-[0.75rem] text-[var(--text-light)] mt-1">Buka menu Daftar Guru untuk menambahkan</div>
        </div>
      )}

      <div className="space-y-2">
        {rows.map(({ guru, attendance }) => {
          const bucket = bucketFor(attendance);
          const c = CHIP_COLOR[bucket];
          const jam = attendance?.jamMasuk?.slice(0, 5);
          return (
            <div
              key={guru.id}
              onClick={() => setEditGuru(guru)}
              className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-3 flex items-center gap-3 relative overflow-hidden cursor-pointer hover:border-[var(--brand)] transition-colors"
              style={{ boxShadow: "var(--shadow)" }}
            >
              <span className="absolute left-0 top-0 bottom-0 w-[4px]" style={{ background: c.dot }} />
              <div
                className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-[0.85rem]"
                style={{ background: "var(--grad)" }}
              >
                {inisial(guru.nama)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[var(--text)] text-[0.9rem] truncate">{guru.nama}</div>
                <div className="text-[0.68rem] text-[var(--text-light)] truncate">
                  {labelPeran(guru) && <span className="inline-block mr-1 px-[6px] py-[1px] rounded-md bg-[var(--brand-soft)] text-[var(--brand-strong)] text-[0.6rem] font-bold">{labelPeran(guru)}</span>}{guru.jabatan || "—"}{guru.nip ? ` • ${guru.nip}` : ""}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <span
                  className={`inline-block px-[10px] py-[4px] rounded-full text-[0.7rem] font-extrabold ${c.text}`}
                  style={{ background: c.dot + "22" }}
                >
                  {c.label}
                </span>
                {jam && (
                  <div className="text-[0.65rem] text-[var(--text-light)] mt-1 tabular-nums">
                    masuk {jam}{attendance?.jamPulang ? ` · pulang ${attendance.jamPulang.slice(0, 5)}` : ""}
                  </div>
                )}
                {(attendance?.verifikasiWajahMasuk === false || attendance?.verifikasiWajahPulang === false) && (
                  <div className="text-[0.6rem] font-bold text-[#b45309] mt-[2px]">foto tanpa verifikasi wajah</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editGuru && (
        <StatusSheet
          nama={editGuru.nama}
          tanggalLabel={formatTanggalPanjang(tanggal)}
          jamMasukAwal={rows.find((r) => r.guru.id === editGuru.id)?.attendance?.jamMasuk}
          jamPulangAwal={rows.find((r) => r.guru.id === editGuru.id)?.attendance?.jamPulang}
          catatan={rows.find((r) => r.guru.id === editGuru.id)?.attendance?.catatan}
          onPick={(status) => setStatus(editGuru, status)}
          onSimpanJam={(masuk, pulang) => simpanJamManual(editGuru, masuk, pulang)}
          onClose={() => setEditGuru(null)}
        />
      )}
    </div>
  );
}
