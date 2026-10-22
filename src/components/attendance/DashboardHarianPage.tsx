import { useEffect, useState } from "react";
import { RefreshCw, Clock, CheckCircle2, AlertTriangle, Users } from "lucide-react";
import { teacherAttendanceRepo } from "@/repositories/dexie/teacher-attendance.repo";
import { teacherRepo } from "@/repositories/dexie/teacher.repo";
import type { TeacherAttendance, Teacher } from "@/types/entities";
import { todayStr, formatTanggalPanjang } from "@/lib/utils";

type Row = {
  guru: Teacher;
  attendance?: TeacherAttendance;
};

export function DashboardHarianPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const tanggal = todayStr();

  const load = async () => {
    setLoading(true);
    try {
      const [teachers, records] = await Promise.all([
        teacherRepo.list(),
        teacherAttendanceRepo.getAllToday(tanggal),
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

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const total = rows.length;
  const sudah = rows.filter((r) => r.attendance?.jamMasuk).length;
  const belum = total - sudah;

  return (
    <div className="flex-1 px-[14px] pt-[14px] pb-[90px] lg:pb-4">
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[0.85rem] font-bold flex items-center gap-[6px]">
            <Clock size={16} /> {formatTanggalPanjang(tanggal)}
          </div>
          <button
            onClick={load}
            className="w-8 h-8 rounded-lg bg-[var(--input-bg)] flex items-center justify-center cursor-pointer"
            aria-label="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <div className="text-[0.65rem] text-[#64748b]">Total</div>
            <div className="font-extrabold text-[#1e40af] text-[1.2rem]">{total}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-2 text-center">
            <div className="text-[0.65rem] text-[#64748b]">Sudah Absen</div>
            <div className="font-extrabold text-[#16a34a] text-[1.2rem]">{sudah}</div>
          </div>
          <div className="bg-red-50 rounded-lg p-2 text-center">
            <div className="text-[0.65rem] text-[#64748b]">Belum</div>
            <div className="font-extrabold text-[#dc2626] text-[1.2rem]">{belum}</div>
          </div>
        </div>
      </div>

      {rows.length === 0 && !loading && (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-6 text-center">
          <Users className="mx-auto text-[var(--text-light)] mb-2" size={28} />
          <div className="font-bold text-[var(--text)]">Belum ada guru terdaftar</div>
          <div className="text-[0.75rem] text-[var(--text-light)] mt-1">Tambahkan guru di menu Guru</div>
        </div>
      )}

      <div className="space-y-2">
        {rows.map(({ guru, attendance }) => {
          const sudahMasuk = !!attendance?.jamMasuk;
          const sudahPulang = !!attendance?.jamPulang;
          const warnaBorder = !sudahMasuk ? "#dc2626"
            : attendance?.statusMasuk === "LATE" ? "#f59e0b"
            : attendance?.statusMasuk === "FAR" ? "#dc2626"
            : "#16a34a";
          return (
            <div
              key={guru.id}
              className="bg-[var(--card-bg)] rounded-xl border-l-[4px] border-y border-r border-[var(--border)] p-3 flex items-center gap-3"
              style={{ borderLeftColor: warnaBorder }}
            >
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[var(--text)] text-[0.88rem] truncate">{guru.nama}</div>
                {guru.jabatan && <div className="text-[0.68rem] text-[var(--text-light)] truncate">{guru.jabatan}</div>}
              </div>
              <div className="text-right flex-shrink-0">
                {sudahMasuk ? (
                  <>
                    <div className="text-[0.82rem] font-extrabold flex items-center gap-1 justify-end" style={{ color: warnaBorder }}>
                      {attendance?.statusMasuk === "ONTIME" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                      {attendance?.jamMasuk?.slice(0, 5)}
                    </div>
                    {sudahPulang && (
                      <div className="text-[0.68rem] text-[#64748b]">Pulang: {attendance?.jamPulang?.slice(0, 5)}</div>
                    )}
                  </>
                ) : (
                  <div className="text-[0.72rem] font-bold text-[#dc2626]">Belum absen</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
