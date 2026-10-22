import { useApp } from "@/contexts/AppContext";
import { licenseService } from "@/services/license.service";
import { Tier } from "@/types/enums";
import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

export function LicenseExpiryBadge() {
  const { teacher, setupSelesai } = useApp();
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!teacher || teacher.tier !== Tier.PRO) {
      setDaysRemaining(null);
      return;
    }

    licenseService.getStatus(teacher.id).then((status) => {
      if (status.aktif && status.daysRemaining !== undefined && status.daysRemaining <= 7) {
        setDaysRemaining(status.daysRemaining);
      } else {
        setDaysRemaining(null);
      }
    });
  }, [teacher]);

  if (!setupSelesai || daysRemaining === null) return null;

  const isCritical = daysRemaining <= 1;
  const isWarning = daysRemaining <= 3;

  return (
    <div
      className="flex items-center gap-[3px] text-[0.6rem] px-[6px] py-[2px] rounded-full font-bold text-white"
      style={{
        background: isCritical
          ? "rgba(239,68,68,0.85)"
          : isWarning
          ? "rgba(245,158,11,0.85)"
          : "rgba(14,165,160,0.75)",
      }}
      title={`Lisensi PRO habis dalam ${daysRemaining} hari`}
    >
      <AlertCircle size={10} />
      {daysRemaining === 0 ? "Habis" : `${daysRemaining}hr`}
    </div>
  );
}
