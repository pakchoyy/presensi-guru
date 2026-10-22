import { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  KeyRound,
  Share2,
  X,
} from "lucide-react";
import { useToast } from "@/components/shared/Toast";
import { teacherRepo } from "@/repositories/dexie/teacher.repo";
import { db } from "@/repositories/dexie/db";
import type { Teacher } from "@/types/entities";
import { generateId, timestamp, inisial } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { Tier } from "@/types/enums";
import { guruCloudService } from "@/services/guru-cloud.service";

function randomPin(len: 4 | 6 = 4): string {
  let out = "";
  for (let i = 0; i < len; i++) out += Math.floor(Math.random() * 10).toString();
  return out;
}

function randomKode(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `G-${n}`;
}

export function GuruPage() {
  const { school, teacher, refreshTeachers } = useApp();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [guruList, setGuruList] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [cloudUserIdMap, setCloudUserIdMap] = useState<Record<number, string>>({});

  // form state
  const [fNama, setFNama] = useState("");
  const [fKode, setFKode] = useState("");
  const [fNip, setFNip] = useState("");
  const [fPin, setFPin] = useState("");
  const [fJabatan, setFJabatan] = useState("");
  const [fRole, setFRole] = useState<"guru" | "admin">("guru");

  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [shareDialog, setShareDialog] = useState<{ nama: string; kode: string; pin: string; nip?: string } | null>(null);

  const resetForm = () => {
    setEditId(null);
    setFNama("");
    setFKode("");
    setFNip("");
    setFPin("");
    setFJabatan("");
    setFRole("guru");
  };

  const load = async () => {
    setLoading(true);
    try {
      const all = await teacherRepo.list();
      setGuruList(all.filter((g) => g.statusAktif !== false));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const kodeDipakai = (kode: string, exceptId?: number) =>
    guruList.some((g) => g.id !== exceptId && (g.kodeLogin === kode || g.nip === kode));

  const handleSave = async () => {
    if (!fNama.trim() || !school) {
      toast("Nama guru wajib", "error");
      return;
    }
    const now = timestamp();

    // Kode login: ambil input; kalau kosong, generate baru yang belum dipakai.
    let kode = fKode.trim();
    if (!kode) {
      // Prioritas: NIP > auto generate
      if (fNip.trim()) kode = fNip.trim();
      else {
        let candidate = randomKode();
        let tries = 0;
        while (kodeDipakai(candidate) && tries < 50) {
          candidate = randomKode();
          tries++;
        }
        kode = candidate;
      }
    } else if (kodeDipakai(kode, editId ?? undefined)) {
      toast("Nomor / Kode sudah dipakai guru lain", "error");
      return;
    }

    // PIN: kalau kosong → generate 4 digit
    const pin = fPin.trim() || randomPin(4);
    if (!/^\d{4,6}$/.test(pin)) {
      toast("PIN harus 4-6 digit angka", "error");
      return;
    }

    if (editId) {
      const existing = guruList.find((g) => g.id === editId);
      if (!existing) return;
      const updated: Teacher = {
        ...existing,
        nama: fNama.trim(),
        nip: fNip.trim() || undefined,
        kodeLogin: kode,
        pin,
        jabatan: fJabatan.trim() || undefined,
        role: fRole,
        diubahPada: now,
      };
      await db.teachers.put(updated);
      toast(`Guru ${updated.nama} diperbarui`, "success");
    } else {
      const localId = generateId();
      // CLOUD-FIRST: kalau admin login + online, provision via Edge Function
      // supaya guru bisa login mandiri lewat NIP+PIN. Fallback Dexie saat
      // offline / mode coba.
      let cloudUserId: string | undefined;
      let kodeFinal = kode;
      let pinFinal = pin;
      if (isAuthenticated && navigator.onLine) {
        try {
          const res = await guruCloudService.createAccount({
            nama: fNama.trim(),
            sekolah_id: school.id,
            kode_login: kode,
            pin,
            nip: fNip.trim() || undefined,
            jabatan: fJabatan.trim() || undefined,
            role: fRole,
            local_id: localId,
          });
          cloudUserId = res.user_id;
          kodeFinal = res.kode_login;
          pinFinal = res.pin;
          toast("Akun guru dibuat di cloud", "success");
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          toast(`Cloud gagal (${msg}) — simpan lokal saja`, "info");
        }
      }

      const g: Teacher = {
        id: localId,
        nama: fNama.trim(),
        email: cloudUserId ? `${kodeFinal}@guru.local` : "",
        sekolahId: school.id,
        tier: Tier.FREE,
        nip: fNip.trim() || undefined,
        kodeLogin: kodeFinal,
        pin: pinFinal,
        jabatan: fJabatan.trim() || undefined,
        role: fRole,
        absenToken: crypto.randomUUID(),
        statusAktif: true,
        dibuatPada: now,
        diubahPada: now,
      };
      await db.teachers.put(g);
      if (cloudUserId) {
        setCloudUserIdMap((m) => ({ ...m, [g.id]: cloudUserId! }));
      }
      toast(`${g.nama} ditambahkan`, "success");
      setShareDialog({ nama: g.nama, kode: kodeFinal, pin: pinFinal, nip: g.nip });
    }

    resetForm();
    setShowAdd(false);
    await load();
    await refreshTeachers();
  };

  const handleEdit = (g: Teacher) => {
    setEditId(g.id);
    setFNama(g.nama);
    setFKode(g.kodeLogin || "");
    setFNip(g.nip || "");
    setFPin(g.pin || "");
    setFJabatan(g.jabatan || "");
    setFRole((g.role as "guru" | "admin") || "guru");
    setShowAdd(true);
  };

  const handleDelete = async (g: Teacher) => {
    if (!confirm(`Hapus ${g.nama}?`)) return;
    await db.teachers.update(g.id, { statusAktif: false, diubahPada: timestamp() });
    toast(`${g.nama} dihapus`, "info");
    await load();
    await refreshTeachers();
  };

  const handleResetPin = async (g: Teacher) => {
    let pin = randomPin(4);
    // Reset di cloud dulu kalau online + ada user_id cloud yang dikenal.
    const cloudUserId = cloudUserIdMap[g.id];
    if (isAuthenticated && navigator.onLine && cloudUserId) {
      try {
        const res = await guruCloudService.resetPin(cloudUserId, pin);
        pin = res.new_pin;
        toast("PIN cloud di-reset", "success");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast(`Cloud reset gagal (${msg}) — reset lokal saja`, "info");
      }
    }
    await db.teachers.update(g.id, { pin, diubahPada: timestamp() });
    toast(`PIN baru untuk ${g.nama}: ${pin}`, "success");
    setShareDialog({ nama: g.nama, kode: g.kodeLogin || g.nip || String(g.id), pin, nip: g.nip });
    await load();
  };

  const handleCopyLogin = async (g: Teacher) => {
    const kode = g.kodeLogin || g.nip || String(g.id);
    const text = `Login Presensi Yuk — ${g.nama}\nKode: ${kode}\nPIN: ${g.pin || "(belum diset)"}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(g.id);
      setTimeout(() => setCopiedId(null), 1500);
      toast("Info login disalin", "success");
    } catch {
      toast(text, "info");
    }
  };

  return (
    <div className="flex-1 px-[14px] pt-[14px] pb-[90px] lg:pb-4">
      <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-[14px] mb-3" style={{ boxShadow: "var(--shadow)" }}>
        <div className="flex items-center justify-between">
          <div className="text-[0.9rem] font-extrabold flex items-center gap-[6px] text-[var(--text)]">
            <Users size={16} /> Daftar Guru <span className="text-[var(--text-light)] font-semibold">({guruList.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="w-9 h-9 rounded-xl bg-[var(--input-bg)] flex items-center justify-center active:scale-95"
              aria-label="Refresh"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => { if (showAdd) { resetForm(); } setShowAdd(!showAdd); }}
              className="flex items-center gap-1 px-3 py-[8px] rounded-xl text-white font-bold text-[0.78rem] active:scale-95"
              style={{ background: "var(--grad)" }}
            >
              {showAdd ? <X size={14} /> : <UserPlus size={14} />}
              {showAdd ? "Batal" : "Tambah"}
            </button>
          </div>
        </div>

        {showAdd && (
          <div className="mt-3 space-y-2 animate-slide-down">
            <Field label="Nama lengkap *">
              <input
                value={fNama}
                onChange={(e) => setFNama(e.target.value)}
                placeholder="Mis. Budi Santoso"
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[0.9rem] outline-none focus:border-[var(--brand)]"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Nomor NIP / NUPTK (opsional)">
                <input
                  value={fNip}
                  onChange={(e) => setFNip(e.target.value)}
                  placeholder="Opsional"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[0.88rem] outline-none focus:border-[var(--brand)]"
                />
              </Field>
              <Field label="Jabatan (opsional)">
                <input
                  value={fJabatan}
                  onChange={(e) => setFJabatan(e.target.value)}
                  placeholder="Guru Kelas 1 / dsb."
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[0.88rem] outline-none focus:border-[var(--brand)]"
                />
              </Field>
            </div>

            <Field
              label="Kode login (opsional)"
              hint="Kosongkan untuk dibuatkan otomatis (G-XXXX). Kalau NIP di-isi, kode login = NIP."
            >
              <input
                value={fKode}
                onChange={(e) => setFKode(e.target.value)}
                placeholder="Otomatis bila kosong"
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[0.88rem] outline-none focus:border-[var(--brand)]"
              />
            </Field>

            <div className="grid grid-cols-[1fr,auto] gap-2 items-end">
              <Field label="PIN (4-6 digit)" hint="Kosongkan untuk dibuatkan otomatis 4 digit.">
                <input
                  value={fPin}
                  onChange={(e) => setFPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Otomatis bila kosong"
                  inputMode="numeric"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[0.88rem] outline-none focus:border-[var(--brand)] tracking-widest"
                />
              </Field>
              <button
                type="button"
                onClick={() => setFPin(randomPin(4))}
                className="h-[38px] px-3 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-[0.75rem] font-bold flex items-center gap-1 active:scale-95"
              >
                <KeyRound size={13} /> Buatkan
              </button>
            </div>

            <Field label="Jabatan Peran">
              <select
                value={fRole}
                onChange={(e) => setFRole(e.target.value as "guru" | "admin")}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[0.88rem] outline-none focus:border-[var(--brand)]"
              >
                <option value="guru">Guru</option>
                <option value="admin">Operator / Kepala Sekolah</option>
              </select>
            </Field>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { resetForm(); setShowAdd(false); }}
                className="flex-1 py-2 rounded-xl border border-[var(--border)] text-[var(--text)] text-[0.82rem] font-bold"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2 rounded-xl text-white text-[0.82rem] font-bold"
                style={{ background: "var(--grad)" }}
              >
                {editId ? "Simpan Perubahan" : "Simpan"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {guruList.map((g) => {
          const kode = g.kodeLogin || g.nip || "—";
          return (
            <div
              key={g.id}
              className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-3 flex items-center gap-3"
              style={{ boxShadow: "var(--shadow)" }}
            >
              <div
                className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-[0.85rem]"
                style={{ background: "var(--grad)" }}
              >
                {inisial(g.nama)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[var(--text)] text-[0.9rem] truncate">{g.nama}</div>
                <div className="text-[0.65rem] text-[var(--text-light)] truncate">
                  {g.jabatan || "—"}{g.nip ? ` • ${g.nip}` : ""}
                </div>
                <div className="text-[0.6rem] text-[var(--text-light)] mt-[2px] flex items-center gap-2 flex-wrap">
                  <span className="font-mono bg-[var(--input-bg)] px-[6px] py-[1px] rounded">
                    Kode: {kode}
                  </span>
                  <span className="font-mono bg-[var(--input-bg)] px-[6px] py-[1px] rounded">
                    PIN: {g.pin ? "••••" : "belum"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <IconBtn label="Reset PIN" color="#f59e0b" onClick={() => handleResetPin(g)}>
                  <KeyRound size={14} />
                </IconBtn>
                <IconBtn label="Share login" color="var(--brand)" onClick={() => handleCopyLogin(g)}>
                  {copiedId === g.id ? <Check size={14} /> : <Share2 size={14} />}
                </IconBtn>
                <IconBtn label="Edit" color="#64748b" onClick={() => handleEdit(g)}>
                  <Copy size={14} />
                </IconBtn>
                <IconBtn label="Hapus" color="#dc2626" onClick={() => handleDelete(g)}>
                  <Trash2 size={14} />
                </IconBtn>
              </div>
            </div>
          );
        })}
      </div>

      {teacher && (
        <div className="text-[0.68rem] text-[var(--text-light)] mt-4 text-center">
          Admin aktif: <b>{teacher.nama}</b> ·{" "}
          {isAuthenticated ? (
            <span className="text-[var(--brand)] font-bold">Cloud ON</span>
          ) : (
            <span className="text-[var(--text-light)]">Cloud OFF (lokal)</span>
          )}
          <br />
          Bagikan kode & PIN ke setiap guru lewat WhatsApp.
        </div>
      )}

      {shareDialog && <ShareDialog info={shareDialog} onClose={() => setShareDialog(null)} />}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[0.68rem] font-bold text-[var(--text-light)] mb-1 uppercase tracking-wide">
        {label}
      </label>
      {children}
      {hint && <div className="text-[0.62rem] text-[var(--text-light)] mt-1">{hint}</div>}
    </div>
  );
}

function IconBtn({
  label,
  color,
  onClick,
  children,
}: {
  label: string;
  color: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 rounded-lg bg-[var(--input-bg)] flex items-center justify-center active:scale-95"
      aria-label={label}
      title={label}
      style={{ color }}
    >
      {children}
    </button>
  );
}

function ShareDialog({
  info,
  onClose,
}: {
  info: { nama: string; kode: string; pin: string; nip?: string };
  onClose: () => void;
}) {
  const { toast } = useToast();
  const text = `Login Presensi Yuk — ${info.nama}\nKode: ${info.kode}\nPIN: ${info.pin}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Info login disalin", "success");
    } catch {
      toast(text, "info");
    }
  };
  return (
    <div className="fixed inset-0 z-[800] bg-black/55 flex items-end sm:items-center justify-center p-4 animate-fade-in">
      <div className="bg-[var(--card-bg)] rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-5 animate-slide-up" style={{ boxShadow: "var(--shadow-lg)" }}>
        <div className="flex items-center justify-between mb-2">
          <div className="font-extrabold text-[var(--text)]">Login untuk {info.nama}</div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-[var(--input-bg)] flex items-center justify-center">
            <X size={14} />
          </button>
        </div>
        <div className="text-[0.75rem] text-[var(--text-light)] mb-3">
          Bagikan kode &amp; PIN ini ke guru supaya bisa login mandiri di halaman Presensi.
        </div>
        <div className="space-y-2 mb-3">
          <KV label="Kode login" val={info.kode} />
          <KV label="PIN" val={info.pin} mono />
          {info.nip && <KV label="NIP" val={info.nip} />}
        </div>
        <button
          onClick={copy}
          className="w-full py-3 rounded-xl text-white font-bold text-[0.88rem] flex items-center justify-center gap-2"
          style={{ background: "var(--grad)" }}
        >
          <Copy size={14} /> Salin ke clipboard
        </button>
      </div>
    </div>
  );
}

function KV({ label, val, mono }: { label: string; val: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-[var(--input-bg)] border border-[var(--border)] rounded-xl px-3 py-2">
      <div className="text-[0.68rem] text-[var(--text-light)] uppercase tracking-wide">{label}</div>
      <div className={`font-extrabold text-[var(--text)] ${mono ? "font-mono tracking-widest" : ""}`}>{val}</div>
    </div>
  );
}
