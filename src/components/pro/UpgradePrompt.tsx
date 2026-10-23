import { useApp } from "@/contexts/AppContext";
import { PRO_PRICE } from "@/lib/constants";
import { ArrowUpCircle } from "lucide-react";

interface Props {
  title?: string;
  description?: string;
  action?: string;
}

export function UpgradePrompt({
  title = "Fitur PRO",
  description = "Fitur ini tersedia untuk pengguna PRO.",
  action = "Upgrade ke PRO",
}: Props) {
  const { setActivePage } = useApp();

  return (
    <div className="bg-[var(--card-bg)] rounded-xl border-2 border-dashed border-[#2563eb]/30 p-[14px] text-center">
      <div className="text-[#2563eb] mb-2">
        <ArrowUpCircle size={28} className="mx-auto" />
      </div>
      <div className="text-[0.82rem] font-bold text-[var(--text)] mb-1">{title}</div>
      <div className="text-[0.72rem] text-[var(--text-light)] mb-3">{description}</div>
      <div className="text-[0.78rem] font-bold text-[#2563eb] mb-3">{PRO_PRICE}</div>
      <button
        onClick={() => setActivePage("pengaturan" as any)}
        className="inline-flex items-center gap-[6px] py-[8px] px-[16px] rounded-[10px] text-white font-bold text-[0.8rem] cursor-pointer"
        style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb,#1d4ed8)" }}
      >
        <ArrowUpCircle size={15} /> {action}
      </button>
    </div>
  );
}
