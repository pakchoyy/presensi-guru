import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { LogOut, IdCard, KeyRound, Briefcase, School as SchoolIcon, Hash, UserRound, Eye, EyeOff } from "lucide-react";

export function GuruProfilPage({ onLogout }: { onLogout: () => void }) {
  const { teachers, guruSessionId, school } = useApp();
  const [lihatPin, setLihatPin] = useState(false);
  const guru = teachers.find((t) => t.id === guruSessionId);

  if (!guru) {
    return <div className="flex-1 p-8 text-center text-[var(--text-light)]">Sesi berakhir. Silakan masuk ulang.</div>;
  }

  const kode = guru.kodeLogin || guru.nip || String(guru.id);

  return (
    <div className="flex-1 px-[14px] pt-[14px] pb-[90px] lg:pb-4">
      {/* Hero */}
      <div
        className="rounded-2xl p-5 text-white relative overflow-hidden text-center"
        style={{ background: "var(--grad)", boxShadow: "var(--shadow-lg)" }}
      >
        <span className="header-orb" style={{ width: 140, height: 140, top: -40, right: -30 }} />
        <div className="relative">
          {/* Avatar ikon pegawai */}
          <div className="w-24 h-24 mx-auto rounded-full bg-white shadow-lg flex items-center justify-center overflow-hidden">
            <UserRound size={58} strokeWidth={1.6} className="text-[var(--brand)] translate-y-1" />
          </div>
          <div className="text-[1.15rem] font-extrabold mt-3">{guru.nama}</div>
          <div className="text-[0.78rem] opacity-90">{guru.jabatan || "Guru"}</div>
        </div>
      </div>

      {/* Detail */}
      <div className="mt-3 bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] overflow-hidden" style={{ boxShadow: "var(--shadow)" }}>
        <Row icon={<Hash size={16} />} label="Kode login" value={kode} mono />
        <Row icon={<IdCard size={16} />} label="NIP / NUPTK" value={guru.nip || "—"} mono={!!guru.nip} />
        <Row
          icon={<KeyRound size={16} />}
          label="PIN"
          value={guru.pin ? (lihatPin ? guru.pin : "••••") : "belum diset"}
          mono={!!guru.pin && lihatPin}
          action={
            guru.pin ? (
              <button
                onClick={() => setLihatPin((v) => !v)}
                className="text-[var(--text-light)] bg-transparent border-none p-0 flex items-center active:scale-95"
                aria-label={lihatPin ? "Sembunyikan PIN" : "Lihat PIN"}
              >
                {lihatPin ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            ) : undefined
          }
        />
        <Row icon={<Briefcase size={16} />} label="Peran" value={guru.role === "admin" ? "Operator / Kepala Sekolah" : "Guru"} />
        <Row icon={<SchoolIcon size={16} />} label="Sekolah" value={school?.nama || "—"} last />
      </div>

      <div className="text-[0.65rem] text-[var(--text-light)] text-center mt-3">
        Untuk mengubah data atau reset PIN, hubungi Ops / Kepala Sekolah.
      </div>

      <button
        onClick={onLogout}
        className="w-full mt-4 py-3 rounded-2xl border-[1.5px] border-[#ef4444] text-[#ef4444] font-bold text-[0.88rem] flex items-center justify-center gap-2 active:scale-95 bg-transparent"
      >
        <LogOut size={16} /> Keluar
      </button>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  mono,
  last,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  last?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${last ? "" : "border-b border-[var(--border)]"}`}>
      <span className="text-[var(--brand)] flex-shrink-0">{icon}</span>
      <span className="text-[0.75rem] text-[var(--text-light)] flex-1">{label}</span>
      <span className={`font-bold text-[var(--text)] text-[0.85rem] ${mono ? "font-mono" : ""}`}>{value}</span>
      {action}
    </div>
  );
}
