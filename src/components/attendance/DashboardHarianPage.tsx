import { useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Calendar as CalIcon,
  Users,
} from "lucide-react";
import { teacherAttendanceRepo } from "@/repositories/dexie/teacher-attendance.repo";
import { teacherRepo } from "@/repositories/dexie/teacher.repo";
import type { TeacherAttendance, Teacher } from "@/types/entities";
import { formatTanggalPanjang, inisial } from "@/lib/utils";

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
  if (!att?.jamMasuk) {
    if (att?.statusHari === "S") return "sakit";
    if (att?.statusHari === "I") return "izin";
    if (att?.statusHari === "A") return "alpha";
    return "belum";
  }
  if (att.statusMasuk === "LATE") return "terlambat";
  if (att.statusMasuk === "FAR") return "alpha";
  return "hadir";
}

export function DashboardHarianPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tanggal, setTanggal] = useState<string>(ymd(new Date()));

  const load = async (tglOverride?: string) => {
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
  };

  useEffect(() => { load(tanggal); /* eslint-disable-next-line */ }, [tanggal]);

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
          onClick={() => load()}
          className="w-9 h-9 rounded-xl bg-[var(--input-bg)] text-[var(--text)] flex items-center justify-center cursor-pointer active:scale-95"
          aria-label="Muat ulang"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
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
          <div className="text-[0.65rem] text-[var(--text-light)] font-semibold">Sudah Absen</div>
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
              className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-3 flex items-center gap-3 relative overflow-hidden"
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
                  {guru.jabatan || "—"}{guru.nip ? ` • ${guru.nip}` : ""}
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
