import { X } from "lucide-react";
import type { AttendanceStatus } from "@/types/enums";

type StatusKey = AttendanceStatus | "RESET";

const OPTIONS: { key: StatusKey; label: string; color: string; bg: string }[] = [
  { key: "H" as AttendanceStatus, label: "Hadir", color: "#16a34a", bg: "#dcfce7" },
  { key: "T" as AttendanceStatus, label: "Terlambat", color: "#f59e0b", bg: "#fef3c7" },
  { key: "S" as AttendanceStatus, label: "Sakit", color: "#b45309", bg: "#fef3c7" },
  { key: "I" as AttendanceStatus, label: "Izin", color: "#1d4ed8", bg: "#dbeafe" },
  { key: "A" as AttendanceStatus, label: "Alpha", color: "#dc2626", bg: "#fee2e2" },
  { key: "RESET", label: "Belum / Reset", color: "#64748b", bg: "#f1f5f9" },
];

export function StatusSheet({
  nama,
  tanggalLabel,
  onPick,
  onClose,
}: {
  nama: string;
  tanggalLabel: string;
  onPick: (status: StatusKey) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[800] bg-black/50 flex items-end sm:items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[var(--card-bg)] w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-4 animate-slide-up"
        style={{ boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <div className="min-w-0">
            <div className="font-extrabold text-[var(--text)] truncate">{nama}</div>
            <div className="text-[0.68rem] text-[var(--text-light)]">{tanggalLabel} — set status kehadiran</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-[var(--input-bg)] flex items-center justify-center flex-shrink-0">
            <X size={14} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => onPick(o.key)}
              className="py-3 rounded-xl font-extrabold text-[0.85rem] active:scale-95 border-[1.5px]"
              style={{ color: o.color, background: o.bg, borderColor: o.color + "44" }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
