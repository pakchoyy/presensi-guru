import { useEffect, useMemo, useState } from "react";
import { History, ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { teacherAttendanceRepo } from "@/repositories/dexie/teacher-attendance.repo";
import type { TeacherAttendance, Teacher } from "@/types/entities";
import { inisial } from "@/lib/utils";

const BULAN_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function monthRange(year: number, monthIdx: number): { start: string; end: string; daysInMonth: number } {
  const first = new Date(year, monthIdx, 1);
  const last = new Date(year, monthIdx + 1, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return {
    start: toYmd(first),
    end: toYmd(last),
    daysInMonth: last.getDate(),
  };
}

type Mode = "pick" | "list";

export function LogPresensiPage() {
  const { teachers } = useApp();
  const [guru, setGuru] = useState<Teacher | null>(null);
  const [mode, setMode] = useState<Mode>("pick");

  // auto-pick kalau sesi presensi lagi aktif
  useEffect(() => {
    try {
      const raw = localStorage.getItem("bgy_presensi_guru_session");
      if (!raw) return;
      const s = JSON.parse(raw);
      const t = teachers.find((x) => x.id === s.guruId);
      if (t) {
        setGuru(t);
        setMode("list");
      }
    } catch { /* ignore */ }
  }, [teachers]);

  if (mode === "pick" || !guru) {
    return (
      <GuruPicker
        teachers={teachers}
        onPick={(t) => { setGuru(t); setMode("list"); }}
      />
    );
  }
  return <LogList guru={guru} onChangeGuru={() => setMode("pick")} />;
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
    <div className="flex-1 px-[14px] pt-[14px] pb-[90px] lg:pb-4">
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
                {t.jabatan || "—"}{t.nip ? ` • ${t.nip}` : ""}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function LogList({ guru, onChangeGuru }: { guru: Teacher; onChangeGuru: () => void }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [monthIdx, setMonthIdx] = useState(today.getMonth());
  const [records, setRecords] = useState<TeacherAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  const { start, end, daysInMonth } = useMemo(() => monthRange(year, monthIdx), [year, monthIdx]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await teacherAttendanceRepo.getRange(guru.id, start, end);
        setRecords(data.sort((a, b) => b.tanggal.localeCompare(a.tanggal)));
      } finally {
        setLoading(false);
      }
    })();
  }, [guru.id, start, end]);

  const summary = useMemo(() => {
    const sudah = records.filter((r) => r.jamMasuk).length;
    const terlambat = records.filter((r) => r.statusMasuk === "LATE").length;
    const far = records.filter((r) => r.statusMasuk === "FAR").length;
    return { sudah, terlambat, far };
  }, [records]);

  const gantiBulan = (delta: number) => {
    let m = monthIdx + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonthIdx(m);
    setYear(y);
  };

  return (
    <div className="flex-1 px-[14px] pt-[14px] pb-[90px] lg:pb-4">
      {/* Guru chip + ganti */}
      <div
        className="rounded-2xl p-3 text-white relative overflow-hidden flex items-center gap-3"
        style={{ background: "var(--grad)", boxShadow: "var(--shadow-lg)" }}
      >
        <span className="header-orb" style={{ width: 100, height: 100, top: -30, right: -20 }} />
        <div
          className="w-11 h-11 rounded-full bg-white/20 border border-white/30 flex items-center justify-center font-extrabold text-[0.9rem]"
        >
          {inisial(guru.nama)}
        </div>
        <div className="flex-1 min-w-0 relative">
          <div className="text-[0.95rem] font-extrabold truncate">{guru.nama}</div>
          <div className="text-[0.7rem] opacity-90 truncate">
            {guru.jabatan || "Guru"}{guru.nip ? ` · ${guru.nip}` : ""}
          </div>
        </div>
        <button
          onClick={onChangeGuru}
          className="h-9 px-3 rounded-xl bg-white/15 border border-white/30 text-[0.72rem] font-bold active:scale-95 relative"
        >
          Ganti
        </button>
      </div>

      {/* Pager bulan */}
      <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-[10px] mt-3 flex items-center gap-2" style={{ boxShadow: "var(--shadow)" }}>
        <button
          onClick={() => gantiBulan(-1)}
          className="w-9 h-9 rounded-xl bg-[var(--input-bg)] flex items-center justify-center active:scale-95"
          aria-label="Bulan sebelumnya"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 text-center">
          <div className="text-[0.9rem] font-extrabold text-[var(--text)] leading-tight">
            {BULAN_ID[monthIdx]} {year}
          </div>
          <div className="text-[0.63rem] text-[var(--text-light)]">
            {daysInMonth} hari · {records.length} catatan
          </div>
        </div>
        <button
          onClick={() => gantiBulan(1)}
          className="w-9 h-9 rounded-xl bg-[var(--input-bg)] flex items-center justify-center active:scale-95"
          aria-label="Bulan berikutnya"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Mini summary */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <SummaryTile label="Hadir" val={summary.sudah} color="var(--hadir)" bg="var(--hadir-bg)" />
        <SummaryTile label="Terlambat" val={summary.terlambat} color="var(--terlambat)" bg="var(--terlambat-bg)" />
        <SummaryTile label="Di luar radius" val={summary.far} color="var(--alpha)" bg="var(--alpha-bg)" />
      </div>

      {/* Daftar */}
      <div className="mt-3 space-y-2">
        {!loading && records.length === 0 && (
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-6 text-center text-[var(--text-light)] text-[0.85rem]">
            Belum ada catatan presensi di {BULAN_ID[monthIdx]} {year}.
          </div>
        )}
        {records.map((r) => (
          <div
            key={r.id}
            className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-3 flex items-center gap-3"
            style={{ boxShadow: "var(--shadow)" }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-[0.85rem]"
              style={{ background: "var(--brand-soft)", color: "var(--brand-strong)" }}
            >
              {r.tanggal.slice(8, 10)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[0.78rem] font-bold text-[var(--text)]">{r.tanggal}</div>
              <div className="text-[0.68rem] text-[var(--text-light)] flex items-center gap-2 mt-[2px]">
                <span className="flex items-center gap-1">
                  <Clock size={10} /> {r.jamMasuk?.slice(0, 5) ?? "—"}
                </span>
                <span>→</span>
                <span>{r.jamPulang?.slice(0, 5) ?? "—"}</span>
              </div>
            </div>
            <div className="text-right">
              <StatusBadge status={r.statusMasuk} />
              {r.jarakMasukMeter != null && (
                <div className="text-[0.6rem] text-[var(--text-light)] mt-1 flex items-center gap-1 justify-end">
                  <MapPin size={9} /> {r.jarakMasukMeter}m
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  val,
  color,
  bg,
}: {
  label: string;
  val: number;
  color: string;
  bg: string;
}) {
  return (
    <div className="rounded-2xl p-3 text-center" style={{ background: bg, border: "1px solid var(--border)" }}>
      <div className="text-[0.65rem] text-[var(--text-light)] font-semibold">{label}</div>
      <div className="font-extrabold text-[1.15rem] mt-1 leading-none" style={{ color }}>
        {val}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; color: string }> = {
    ONTIME: { label: "Tepat", color: "#16a34a" },
    LATE: { label: "Terlambat", color: "#f59e0b" },
    FAR: { label: "Luar radius", color: "#dc2626" },
  };
  const s = status ? map[status] : null;
  if (!s) return <span className="text-[0.68rem] font-bold text-[var(--text-light)]">—</span>;
  return (
    <span
      className="inline-block px-[8px] py-[3px] rounded-full text-[0.63rem] font-extrabold"
      style={{ background: s.color + "22", color: s.color }}
    >
      {s.label}
    </span>
  );
}
