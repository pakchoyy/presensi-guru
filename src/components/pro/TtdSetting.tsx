import { useEffect, useState } from "react";
import { PenLine } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/components/shared/Toast";
import { schoolRepo } from "@/repositories/dexie/school.repo";
import { ttdBlok } from "@/services/export.service";
import type { School } from "@/types/entities";

type Ttd = NonNullable<School["ttd"]>;
const inputCls = "w-full px-[10px] py-[8px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.85rem] bg-[var(--input-bg)] outline-none focus:border-[#2563eb] font-[inherit]";
const labelCls = "block text-[0.65rem] font-bold text-[var(--text-light)] mb-1 uppercase";

/** Setelan blok tanda tangan Kepala Sekolah di laporan rekap PDF/Excel. */
export function TtdSetting() {
  const { school, teachers, refreshSchool } = useApp();
  const { toast } = useToast();
  const [ttd, setTtd] = useState<Ttd>(school?.ttd || {});
  const [busy, setBusy] = useState(false);
  useEffect(() => { setTtd(school?.ttd || {}); }, [school?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!school) return null;

  const auto = ttdBlok({ ...school, ttd: {} }, teachers);
  const aktif = ttd.aktif !== false;
  const set = (k: keyof Ttd, v: string | boolean) => setTtd((t) => ({ ...t, [k]: v }));
  const simpan = async () => {
    setBusy(true);
    try {
      const bersih = Object.fromEntries(Object.entries(ttd).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])) as Ttd;
      await schoolRepo.save({ ...school, ttd: bersih, diubahPada: Date.now() });
      await refreshSchool();
      toast("✅ Tanda tangan laporan disimpan");
    } catch {
      toast("❌ Gagal menyimpan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] border-l-4 border-l-[#2563eb] p-[14px] mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[0.8rem] font-bold flex items-center gap-[6px]"><PenLine size={15} /> Tanda Tangan Laporan</div>
        <label className="flex items-center gap-2 text-[0.72rem] font-semibold cursor-pointer">
          <input type="checkbox" checked={aktif} onChange={(e) => set("aktif", e.target.checked)} className="w-4 h-4" />
          Tampilkan
        </label>
      </div>
      {aktif && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Tempat</label>
              <input value={ttd.tempat || ""} onChange={(e) => set("tempat", e.target.value)} placeholder="Bumi Agung" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tanggal</label>
              <input type="date" value={ttd.tanggal || ""} onChange={(e) => set("tanggal", e.target.value)} aria-label="Tanggal tanda tangan" className={inputCls} />
            </div>
          </div>
          <p className="text-[0.66rem] text-[var(--text-light)] m-0">Tanggal kosong = tanggal saat laporan dicetak.</p>
          <div>
            <label className={labelCls}>Jabatan</label>
            <input value={ttd.jabatan || ""} onChange={(e) => set("jabatan", e.target.value)} placeholder={auto?.baris[1]} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Nama</label>
            <input value={ttd.nama || ""} onChange={(e) => set("nama", e.target.value)} placeholder={auto?.nama || "Nama Kepala Sekolah"} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>NIP</label>
            <input value={ttd.nip ?? ""} onChange={(e) => set("nip", e.target.value)} placeholder={auto?.nip || "19760515 200604 1 009"} className={inputCls} />
          </div>
          <p className="text-[0.66rem] text-[var(--text-light)] m-0">Kolom kosong diisi otomatis dari guru berperan Kepala Sekolah.</p>
        </div>
      )}
      <button onClick={simpan} disabled={busy} className="mt-3 w-full py-[10px] rounded-[10px] text-white font-bold text-[0.8rem] border-none cursor-pointer disabled:opacity-60" style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb)" }}>
        {busy ? "Menyimpan..." : "Simpan Tanda Tangan"}
      </button>
    </div>
  );
}
