import { Camera, X } from "lucide-react";
import { useToast } from "@/components/shared/Toast";
import { kompresFoto } from "@/lib/foto";

/** Lampiran foto izin (surat dokter dll): kamera/galeri, dikompres jadi data URL. */
export function LampiranFoto({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const { toast } = useToast();
  const pilih = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { onChange(await kompresFoto(f)); } catch { toast("Foto tidak bisa dibaca", "error"); }
  };
  return value ? (
    <div className="relative w-fit">
      <img src={value} alt="Lampiran izin" className="max-h-[160px] rounded-xl border border-[var(--border)]" />
      <button
        onClick={() => onChange(null)}
        aria-label="Hapus foto"
        className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#ef4444] text-white flex items-center justify-center border-none"
      >
        <X size={14} />
      </button>
    </div>
  ) : (
    <label className="flex items-center justify-center gap-2 py-3 rounded-xl border-[1.5px] border-dashed border-[var(--brand)] text-[var(--brand)] text-[0.82rem] font-bold cursor-pointer">
      <Camera size={16} /> Ambil / pilih foto (surat dokter dll)
      <input type="file" accept="image/*" onChange={pilih} className="hidden" />
    </label>
  );
}
