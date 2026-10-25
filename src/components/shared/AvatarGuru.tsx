import { useFotoProfil } from "@/lib/foto-profil";
import { inisial } from "@/lib/utils";

/** Foto profil lokal; kalau belum ada tampil inisial nama. */
export function AvatarGuru({ id, nama, size = 34, className = "" }: { id?: number | null; nama?: string; size?: number; className?: string }) {
  const foto = useFotoProfil(id);
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full overflow-hidden flex-shrink-0 font-bold text-white ${className}`}
      style={{ width: size, height: size, background: "linear-gradient(135deg,#3b82f6,#2563eb,#1d4ed8)", fontSize: size * 0.4 }}
    >
      {foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : inisial(nama || "G")}
    </span>
  );
}
