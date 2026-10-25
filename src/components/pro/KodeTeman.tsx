import { useState } from "react";
import { Gift } from "lucide-react";
import { licenseService } from "@/services/license.service";
import { licenseRepo } from "@/repositories/dexie/license.repo";
import { useToast } from "@/components/shared/Toast";

/** "Punya kode teman?" untuk pelanggan yang lupa mengisi kode saat aktivasi. */
export function KodeTeman({ guruId }: { guruId: number }) {
  const { toast } = useToast();
  const [buka, setBuka] = useState(false);
  const [kode, setKode] = useState("");
  const [proses, setProses] = useState(false);

  const kirim = async () => {
    const lis = await licenseRepo.getActive(guruId);
    if (!lis) return toast("Lisensi di HP ini tidak ditemukan", "error");
    if (!/^PY-[A-Z0-9]{6}$/i.test(kode.trim())) return toast("Format kode teman: PY-XXXXXX", "error");
    setProses(true);
    const r = await licenseService.pakaiRef(lis.emailAktivasi, lis.kodeLisensi, kode);
    setProses(false);
    toast(r.pesan, r.ok ? "success" : "error");
    if (r.ok) setBuka(false);
  };

  if (!buka) {
    return (
      <button onClick={() => setBuka(true)} className="w-full text-left text-[0.72rem] font-bold text-[#2563eb] bg-transparent border-none cursor-pointer mb-3 flex items-center gap-[6px] p-0">
        <Gift size={13} /> Punya kode teman? Ketuk untuk mengisi
      </button>
    );
  }
  return (
    <div className="mb-3">
      <div className="text-[0.7rem] text-[var(--text-light)] mb-2">Isi kode teman yang mengajakmu. Bisa sekali, paling lambat 7 hari setelah aktivasi pertama.</div>
      <div className="flex gap-2">
        <input
          value={kode}
          onChange={(e) => setKode(e.target.value.toUpperCase())}
          placeholder="PY-XXXXXX"
          className="flex-1 min-w-0 px-[10px] py-[9px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.82rem] text-[var(--text)] bg-[var(--input-bg)] outline-none focus:border-[#2563eb] font-[inherit] uppercase"
        />
        <button onClick={kirim} disabled={proses} className="px-4 rounded-[8px] text-white font-bold text-[0.78rem] border-none cursor-pointer disabled:opacity-60" style={{ background: "#2563eb" }}>
          {proses ? "…" : "Simpan"}
        </button>
      </div>
    </div>
  );
}
