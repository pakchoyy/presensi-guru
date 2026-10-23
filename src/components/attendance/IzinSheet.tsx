import { useState } from "react";
import { X, Stethoscope, FileText } from "lucide-react";
import { AttendanceStatus } from "@/types/enums";

type Jenis = AttendanceStatus.SAKIT | AttendanceStatus.IZIN;

/**
 * Sheet pengajuan Sakit / Izin oleh guru sendiri untuk tanggal berjalan.
 * Keterangan opsional, disimpan ke field `catatan`.
 */
export function IzinSheet({
  tanggalLabel,
  jenisAwal,
  keteranganAwal,
  onSubmit,
  onBatalkan,
  onClose,
}: {
  tanggalLabel: string;
  jenisAwal?: Jenis;
  keteranganAwal?: string;
  onSubmit: (jenis: Jenis, keterangan: string) => void;
  onBatalkan?: () => void;
  onClose: () => void;
}) {
  const [jenis, setJenis] = useState<Jenis>(jenisAwal ?? AttendanceStatus.SAKIT);
  const [keterangan, setKeterangan] = useState(keteranganAwal ?? "");

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
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <div className="font-extrabold text-[var(--text)]">Ajukan Sakit / Izin</div>
            <div className="text-[0.68rem] text-[var(--text-light)]">{tanggalLabel}</div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[var(--input-bg)] flex items-center justify-center flex-shrink-0"
            aria-label="Tutup"
          >
            <X size={14} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <PilihanBtn
            aktif={jenis === AttendanceStatus.SAKIT}
            onClick={() => setJenis(AttendanceStatus.SAKIT)}
            icon={<Stethoscope size={16} />}
            label="Sakit"
            color="#b45309"
            bg="#fef3c7"
          />
          <PilihanBtn
            aktif={jenis === AttendanceStatus.IZIN}
            onClick={() => setJenis(AttendanceStatus.IZIN)}
            icon={<FileText size={16} />}
            label="Izin"
            color="#1d4ed8"
            bg="#dbeafe"
          />
        </div>

        <label className="block text-[0.68rem] font-bold text-[var(--text-light)] mt-3 mb-1 uppercase">
          Keterangan (opsional)
        </label>
        <textarea
          value={keterangan}
          onChange={(e) => setKeterangan(e.target.value)}
          rows={3}
          placeholder="Contoh: demam, surat dokter menyusul"
          className="w-full px-3 py-2 rounded-xl border-[1.5px] border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)] text-[0.85rem] outline-none focus:border-[var(--brand)] font-[inherit] resize-none"
        />

        <button
          onClick={() => onSubmit(jenis, keterangan.trim())}
          className="w-full mt-3 py-3 rounded-2xl text-white font-extrabold text-[0.9rem] active:scale-95"
          style={{ background: "var(--grad)" }}
        >
          Kirim Pengajuan
        </button>

        {onBatalkan && (
          <button
            onClick={onBatalkan}
            className="w-full mt-2 py-[10px] rounded-2xl border-[1.5px] border-[#ef4444] text-[#ef4444] font-bold text-[0.82rem] bg-transparent active:scale-95"
          >
            Batalkan pengajuan hari ini
          </button>
        )}

        <div className="text-[0.62rem] text-[var(--text-light)] text-center mt-3">
          Pengajuan langsung tercatat di rekap. Ops / Kepala Sekolah bisa mengubahnya dari Dashboard.
        </div>
      </div>
    </div>
  );
}

function PilihanBtn({
  aktif,
  onClick,
  icon,
  label,
  color,
  bg,
}: {
  aktif: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <button
      onClick={onClick}
      className="py-3 rounded-xl font-extrabold text-[0.85rem] flex items-center justify-center gap-2 active:scale-95"
      style={{
        color,
        background: aktif ? bg : "var(--input-bg)",
        border: `1.5px solid ${aktif ? color : "var(--border)"}`,
        opacity: aktif ? 1 : 0.65,
      }}
    >
      {icon} {label}
    </button>
  );
}
