import { useState } from "react";
import { X, Clock } from "lucide-react";
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
  jamMasukAwal,
  jamPulangAwal,
  catatan,
  onPick,
  onSimpanJam,
  onClose,
}: {
  nama: string;
  tanggalLabel: string;
  jamMasukAwal?: string;
  jamPulangAwal?: string;
  catatan?: string;
  onPick: (status: StatusKey) => void;
  /** Simpan jam manual (format "HH:MM", string kosong = hapus). */
  onSimpanJam?: (jamMasuk: string, jamPulang: string) => void;
  onClose: () => void;
}) {
  const [jamMasuk, setJamMasuk] = useState(jamMasukAwal?.slice(0, 5) ?? "");
  const [jamPulang, setJamPulang] = useState(jamPulangAwal?.slice(0, 5) ?? "");

  const jamBerubah =
    jamMasuk !== (jamMasukAwal?.slice(0, 5) ?? "") || jamPulang !== (jamPulangAwal?.slice(0, 5) ?? "");

  return (
    <div
      className="fixed inset-0 z-[800] bg-black/50 flex items-end sm:items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[var(--card-bg)] w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-4 animate-slide-up max-h-[90vh] overflow-y-auto"
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

        {catatan && (
          <div className="mt-2 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] px-3 py-2 text-[0.7rem] text-[var(--text-light)] break-words">
            Keterangan guru: <span className="text-[var(--text)] font-semibold">{catatan}</span>
          </div>
        )}

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

        {onSimpanJam && (
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] p-3">
            <div className="text-[0.72rem] font-bold text-[var(--text)] flex items-center gap-[6px] mb-1">
              <Clock size={13} /> Isi jam manual
            </div>
            <div className="text-[0.62rem] text-[var(--text-light)] mb-2">
              Dipakai kalau guru lupa presensi. Kosongkan untuk menghapus jam.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[0.6rem] font-bold text-[var(--text-light)] mb-1 uppercase">Jam Masuk</label>
                <input
                  type="time"
                  value={jamMasuk}
                  onChange={(e) => setJamMasuk(e.target.value)}
                  className="w-full px-[8px] py-[8px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.8rem] bg-[var(--card-bg)] text-[var(--text)] outline-none focus:border-[var(--brand)] font-[inherit]"
                />
              </div>
              <div>
                <label className="block text-[0.6rem] font-bold text-[var(--text-light)] mb-1 uppercase">Jam Pulang</label>
                <input
                  type="time"
                  value={jamPulang}
                  onChange={(e) => setJamPulang(e.target.value)}
                  className="w-full px-[8px] py-[8px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.8rem] bg-[var(--card-bg)] text-[var(--text)] outline-none focus:border-[var(--brand)] font-[inherit]"
                />
              </div>
            </div>
            <button
              onClick={() => onSimpanJam(jamMasuk, jamPulang)}
              disabled={!jamBerubah}
              className="w-full mt-2 py-[10px] rounded-[10px] text-white font-bold text-[0.8rem] disabled:opacity-50 active:scale-95"
              style={{ background: "var(--grad)" }}
            >
              Simpan Jam
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
