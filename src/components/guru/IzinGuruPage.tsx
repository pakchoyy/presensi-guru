import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, FileText, Save } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/components/shared/Toast";
import { teacherAttendanceRepo } from "@/repositories/dexie/teacher-attendance.repo";
import { guruCloud, adminCloud } from "@/services/multi-perangkat.service";
import { AttendanceStatus } from "@/types/enums";
import type { TeacherAttendance } from "@/types/entities";
import { addDays, attendanceIdFrom, formatTanggalPanjang, timestamp, todayStr } from "@/lib/utils";

// Jenis selain Sakit dicatat sebagai Izin (I) di rekap; labelnya disimpan di
// awal catatan, mis. "[Cuti] urusan keluarga".
const JENIS = ["Sakit", "Izin", "Cuti", "Dinas / Penugasan"] as const;
type Jenis = (typeof JENIS)[number];
const MAKS_HARI = 31;

type StatusIzin = NonNullable<TeacherAttendance["statusIzin"]>;
export const LABEL_STATUS: Record<StatusIzin, string> = { proses: "Proses", disetujui: "Disetujui", ditolak: "Ditolak" };
export const WARNA_STATUS: Record<StatusIzin, string> = { proses: "#f59e0b", disetujui: "#16a34a", ditolak: "#dc2626" };

export function bacaJenis(r: TeacherAttendance): { jenis: Jenis; keterangan: string } {
  const m = /^\[(.+?)\]\s?(.*)$/s.exec(r.catatan ?? "");
  if (m && (JENIS as readonly string[]).includes(m[1])) return { jenis: m[1] as Jenis, keterangan: m[2] };
  return { jenis: r.statusHari === AttendanceStatus.SAKIT ? "Sakit" : "Izin", keterangan: r.catatan ?? "" };
}

async function kirim(guruId: number, rec: TeacherAttendance) {
  if (guruCloud.aktif()) await guruCloud.kirimAbsen(rec.id);
  else await adminCloud.kirimAbsen(guruId, rec);
}

const kartu = "bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-[14px]";
const label = "text-[0.78rem] font-bold text-[var(--text)] mb-1 block";

/** Form pengajuan izin guru: rentang tanggal, jenis, keterangan. */
export function IzinGuruPage({ onSelesai }: { onSelesai: () => void }) {
  const { guruSessionId } = useApp();
  const { toast } = useToast();
  const [awal, setAwal] = useState(todayStr());
  const [akhir, setAkhir] = useState(todayStr());
  const [jenis, setJenis] = useState<Jenis>("Sakit");
  const [keterangan, setKeterangan] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);

  const simpan = async () => {
    if (guruSessionId == null) return;
    if (akhir < awal) return toast("Tanggal akhir tidak boleh sebelum tanggal awal", "error");
    const tanggal: string[] = [];
    for (let t = awal; t <= akhir && tanggal.length <= MAKS_HARI; t = addDays(t, 1)) tanggal.push(t);
    if (tanggal.length > MAKS_HARI) return toast(`Maksimal ${MAKS_HARI} hari sekali ajukan`, "error");

    setMenyimpan(true);
    try {
      const catatan = jenis === "Sakit" || jenis === "Izin" ? keterangan.trim() : `[${jenis}] ${keterangan.trim()}`;
      for (const t of tanggal) {
        const id = attendanceIdFrom(guruSessionId, t);
        const lama = await teacherAttendanceRepo.getById(id);
        const rec = {
          ...(lama || {}),
          id,
          guruId: guruSessionId,
          tanggal: t,
          statusHari: jenis === "Sakit" ? AttendanceStatus.SAKIT : AttendanceStatus.IZIN,
          catatan: catatan || undefined,
          statusIzin: "proses",
          diubahPada: timestamp(),
        } as TeacherAttendance;
        await teacherAttendanceRepo.upsert(rec);
        await kirim(guruSessionId, rec).catch(() => { /* tertunda, dikirim saat online */ });
      }
      toast(`Pengajuan ${jenis.toLowerCase()} terkirim (${tanggal.length} hari) — menunggu persetujuan`, "success");
      onSelesai();
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="flex-1 px-[14px] pt-[14px] pb-[110px] space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {([["Tanggal awal", awal, setAwal], ["Tanggal akhir", akhir, setAkhir]] as const).map(([l, v, set]) => (
          <label key={l} className={`${kartu} flex flex-col items-center text-center cursor-pointer`}>
            <span className="flex items-center gap-1 text-[0.78rem] font-bold text-[var(--text)]">
              <CalendarDays size={16} className="text-[var(--brand)]" /> {l}
            </span>
            <input
              type="date"
              value={v}
              onChange={(e) => e.target.value && set(e.target.value)}
              className="mt-1 bg-transparent border-none text-[0.9rem] text-[var(--text)] text-center font-[inherit] outline-none"
            />
          </label>
        ))}
      </div>

      <div className={kartu}>
        <span className={label}>Jenis izin</span>
        <select
          value={jenis}
          onChange={(e) => setJenis(e.target.value as Jenis)}
          className="w-full py-2 bg-transparent border-0 border-b-[1.5px] border-[var(--border)] text-[0.95rem] text-[var(--text)] font-[inherit] outline-none"
        >
          {JENIS.map((j) => <option key={j} value={j}>{j}</option>)}
        </select>
      </div>

      <div className={kartu}>
        <span className={label}>Keterangan</span>
        <textarea
          value={keterangan}
          onChange={(e) => setKeterangan(e.target.value)}
          rows={3}
          placeholder="Contoh: demam, surat dokter menyusul"
          className="w-full py-2 bg-transparent border-0 border-b-[1.5px] border-[var(--border)] text-[0.9rem] text-[var(--text)] font-[inherit] outline-none resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          onClick={onSelesai}
          className="py-4 rounded-full bg-[#ef4444] text-white font-bold flex items-center justify-center gap-2 border-none active:scale-95"
        >
          <ArrowLeft size={18} /> Kembali
        </button>
        <button
          onClick={simpan}
          disabled={menyimpan}
          className="py-4 rounded-full text-white font-bold flex items-center justify-center gap-2 border-none active:scale-95 disabled:opacity-50"
          style={{ background: "var(--grad)" }}
        >
          <Save size={18} /> {menyimpan ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </div>
  );
}

/** Riwayat izin guru (6 bulan), hari berurutan dengan jenis sama digabung jadi satu baris. */
export function LogIzinPage() {
  const { guruSessionId } = useApp();
  const [records, setRecords] = useState<TeacherAttendance[] | null>(null);

  useEffect(() => {
    if (guruSessionId == null) return;
    teacherAttendanceRepo.getRange(guruSessionId, addDays(todayStr(), -183), addDays(todayStr(), 60)).then(setRecords);
  }, [guruSessionId]);

  const baris = useMemo(() => {
    const izin = (records ?? [])
      .filter((r) => r.statusHari === AttendanceStatus.SAKIT || r.statusHari === AttendanceStatus.IZIN)
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    const out: { awal: string; akhir: string; jenis: Jenis; keterangan: string; status: StatusIzin }[] = [];
    for (const r of izin) {
      const { jenis, keterangan } = bacaJenis(r);
      const status: StatusIzin = r.statusIzin ?? "disetujui";
      const akhir = out[out.length - 1];
      if (akhir && akhir.jenis === jenis && akhir.status === status && addDays(akhir.akhir, 1) === r.tanggal) akhir.akhir = r.tanggal;
      else out.push({ awal: r.tanggal, akhir: r.tanggal, jenis, keterangan, status });
    }
    return out.reverse();
  }, [records]);

  if (records && baris.length === 0) {
    return (
      <div className={`${kartu} p-6 text-center`}>
        <FileText className="mx-auto text-[var(--text-light)] mb-2" size={30} />
        <div className="font-bold text-[var(--text)] text-[0.9rem]">Belum ada izin</div>
        <div className="text-[0.75rem] text-[var(--text-light)] mt-1">Ajukan lewat tab Izin.</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {baris.map((b) => (
        <div key={b.awal} className={`${kartu} flex items-start gap-3`}>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[var(--text)] text-[0.88rem]">{b.jenis}</div>
            <div className="text-[0.72rem] text-[var(--text-light)]">
              {b.awal === b.akhir ? formatTanggalPanjang(b.awal) : `${formatTanggalPanjang(b.awal)} – ${formatTanggalPanjang(b.akhir)}`}
            </div>
            {b.keterangan && <div className="text-[0.72rem] text-[var(--text)] mt-1 break-words">{b.keterangan}</div>}
          </div>
          <span
            className="px-3 py-1 rounded-full text-[0.68rem] font-bold text-white flex-shrink-0"
            style={{ background: WARNA_STATUS[b.status] }}
          >
            {LABEL_STATUS[b.status]}
          </span>
        </div>
      ))}
    </div>
  );
}
