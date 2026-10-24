import { lazy, Suspense, type ComponentProps } from "react";
import { Lock } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { effectiveTier } from "@/lib/features";
import { PageName, Tier } from "@/types/enums";
import type { PetaLokasi as PetaLokasiType } from "./PetaLokasi";

// Leaflet hanya dimuat untuk PRO (termasuk masa coba).
const PetaLokasi = lazy(() => import("./PetaLokasi").then((m) => ({ default: m.PetaLokasi })));

export function PetaPro(props: ComponentProps<typeof PetaLokasiType>) {
  const { teacher, setActivePage } = useApp();
  if (effectiveTier(teacher?.tier) === Tier.PRO) {
    return (
      <Suspense fallback={<div className="mt-3 h-[190px] rounded-2xl bg-[var(--input-bg)]" />}>
        <PetaLokasi {...props} />
      </Suspense>
    );
  }
  return (
    <div className="mt-3 bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-[#fef3c7] text-[#b45309] flex items-center justify-center flex-shrink-0">
        <Lock size={16} />
      </div>
      <div className="flex-1 min-w-0 text-[0.75rem] text-[var(--text)]">
        <b>Peta lokasi tersedia di PRO</b>
        {props.jarakMeter != null && <div className="text-[0.65rem] text-[var(--text-light)]">Jarak ke sekolah: {props.jarakMeter} m</div>}
      </div>
      <button onClick={() => setActivePage(PageName.UPGRADE)} className="text-[0.7rem] font-bold text-[#b45309] whitespace-nowrap">
        Upgrade →
      </button>
    </div>
  );
}
