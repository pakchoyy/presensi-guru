import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { LogOut, Clock, IdCard, KeyRound, Briefcase, School as SchoolIcon, Hash, UserRound, Eye, EyeOff, Bell } from "lucide-react";
import { useToast } from "@/components/shared/Toast";
import type { KontrolPengingat } from "@/hooks/usePengingatAbsen";

export function GuruProfilPage({
  onLogout,
  reminder,
}: {
  onLogout: () => void;
  reminder?: KontrolPengingat;
}) {
  const { toast } = useToast();
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
        <Row icon={<SchoolIcon size={16} />} label="Sekolah" value={school?.nama || "—"} />
        <Row icon={<Clock size={16} />} label="Jam masuk" value={(school?.jamMasukStandar || "07:00").slice(0, 5)} />
        <Row icon={<Clock size={16} />} label="Jam pulang" value={(school?.jamPulangStandar || "13:00").slice(0, 5)} last />
      </div>

      {/* Pengingat absen */}
      {reminder && reminder.mode !== "unsupported" && (
        <div
          className="mt-3 bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-4"
          style={{ boxShadow: "var(--shadow)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-[var(--brand)] flex-shrink-0"><Bell size={16} /></span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[var(--text)] text-[0.85rem]">Pengingat presensi</div>
              <div className="text-[0.63rem] text-[var(--text-light)] mt-[1px]">
                {reminder.mode === "denied"
                  ? "Notifikasi diblokir — izinkan dulu lewat setelan browser."
                  : `Kalau dinyalakan, HP berbunyi 2x sehari: jam ${reminder.ingatMasuk} (5 menit sebelum batas presensi masuk) dan jam ${reminder.ingatPulang} (5 menit sebelum pulang). Tidak berbunyi kalau sudah presensi.`}
              </div>
            </div>
            <button
              onClick={async () => {
                if (reminder.mode === "push" || reminder.mode === "lokal") {
                  await reminder.matikan();
                  toast("Pengingat dimatikan", "info");
                  return;
                }
                const hasil = await reminder.nyalakan();
                if (hasil.mode === "push") toast("Pengingat aktif — jalan walau aplikasi ditutup", "success");
                else if (hasil.mode === "lokal") toast("Pengingat aktif (mode dalam aplikasi)", "success");
                else if (hasil.mode === "denied") toast("Izin notifikasi ditolak browser", "error");
                else toast("Pengingat gagal dinyalakan", "error");
              }}
              disabled={reminder.mode === "denied" || reminder.memuat}
              aria-label={
                reminder.mode === "push" || reminder.mode === "lokal"
                  ? "Matikan pengingat"
                  : "Nyalakan pengingat"
              }
              className={`relative w-11 h-6 rounded-full border-none flex-shrink-0 transition-colors disabled:opacity-40 ${
                reminder.mode === "push" || reminder.mode === "lokal"
                  ? "bg-[var(--brand)]"
                  : "bg-[var(--border)]"
              }`}
            >
              <span
                className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full bg-white transition-transform ${
                  reminder.mode === "push" || reminder.mode === "lokal"
                    ? "translate-x-5"
                    : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {reminder.mode === "push" && (
            <div className="text-[0.6rem] text-[var(--hadir)] mt-2 leading-snug font-semibold">
              Mode push aktif — pengingat tetap datang walau aplikasi ditutup.
            </div>
          )}
          {reminder.mode === "lokal" && (
            <div className="text-[0.6rem] text-[var(--text-light)] mt-2 leading-snug">
              Mode dalam aplikasi — pengingat hanya muncul selama aplikasi terbuka. Push belum bisa
              dipakai (akun Anda belum tersambung ke cloud).
            </div>
          )}
        </div>
      )}

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
