import { useState } from "react";
import { CloudOff, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/components/shared/Toast";
import { OtpVerify } from "@/components/auth/OtpVerify";
import { adminCloud } from "@/services/multi-perangkat.service";

/** Dipasang wizard saat setup selesai: buka dialog simpan ke cloud sekali. */
export const CLOUD_PROMPT_KEY = "bgy_cloud_prompt_now";
const NUDGE_KEY = "bgy_cloud_nudge_hidden";
const today = () => new Date().toISOString().slice(0, 10);
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

/** Admin yang belum menghubungkan sekolah ke cloud: ajak simpan ke cloud. Bisa ditutup, muncul lagi besok. */
export function CloudNudge() {
  const { isAuthenticated, markDeviceOk } = useAuth();
  const { school, teacher } = useApp();
  const { toast } = useToast();
  const [hidden, setHidden] = useState(() => read(NUDGE_KEY) === today());
  const [open, setOpen] = useState(() => {
    if (!read(CLOUD_PROMPT_KEY)) return false;
    try { localStorage.removeItem(CLOUD_PROMPT_KEY); } catch { /* abaikan */ }
    return true;
  });

  if (isAuthenticated || read("bgy_demo_mode") === "1") return null;

  const tutup = () => {
    try { localStorage.setItem(NUDGE_KEY, today()); } catch { /* abaikan */ }
    setHidden(true);
  };

  return (
    <>
      {!hidden && (
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-[10px] border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-3 py-2">
          <CloudOff size={16} className="text-[#d97706] flex-shrink-0" />
          <div className="flex-1 text-[0.72rem] text-[var(--text)] leading-snug">
            Data kamu baru tersimpan di HP ini. Simpan ke cloud supaya aman & bisa dibuka di HP lain.
          </div>
          <button onClick={() => setOpen(true)} className="text-[0.72rem] font-bold text-white border-none rounded-[8px] px-3 py-[6px] cursor-pointer flex-shrink-0" style={{ background: "var(--grad)" }}>
            Simpan ke cloud
          </button>
          <button onClick={tutup} aria-label="Tutup pengingat" className="bg-transparent border-none text-[var(--text-light)] cursor-pointer p-1 flex-shrink-0">
            <X size={14} />
          </button>
        </div>
      )}
      {open && (
        <OtpVerify
          email={teacher?.email || ""}
          title="Simpan data ke cloud"
          editEmail
          laterLabel="Nanti saja"
          onConnected={async () => {
            setOpen(false);
            markDeviceOk();
            if (school) await adminCloud.daftarkanSekolah(school, teacher).catch(() => null);
            toast("Data sekolah tersimpan di cloud", "success");
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
