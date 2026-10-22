import { useEffect, useState } from "react";
import { Users, UserPlus, Trash2, Copy, Check, RefreshCw } from "lucide-react";
import { useToast } from "@/components/shared/Toast";
import { teacherRepo } from "@/repositories/dexie/teacher.repo";
import { db } from "@/repositories/dexie/db";
import type { Teacher } from "@/types/entities";
import { generateId, timestamp, inisial } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";
import { Tier } from "@/types/enums";

// Simple initial Guru CRUD. Admin adds teachers; link personal /g/<token> otomatis dibuat.
// Dashboard harian & rekap bulanan ada di halaman lain.
export function GuruPage() {
  const { school, teacher } = useApp();
  const { toast } = useToast();
  const [guruList, setGuruList] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newNama, setNewNama] = useState("");
  const [newNip, setNewNip] = useState("");
  const [newJabatan, setNewJabatan] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

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

  const handleAdd = async () => {
    if (!newNama.trim() || !school) { toast("Nama guru wajib"); return; }
    const now = timestamp();
    const g: Teacher = {
      id: generateId(),
      nama: newNama.trim(),
      email: "",
      sekolahId: school.id,
      tier: Tier.FREE,
      nip: newNip.trim() || undefined,
      jabatan: newJabatan.trim() || undefined,
      role: "guru",
      absenToken: crypto.randomUUID(),
      statusAktif: true,
      dibuatPada: now,
      diubahPada: now,
    };
    await db.teachers.put(g);
    setNewNama(""); setNewNip(""); setNewJabatan("");
    setShowAdd(false);
    toast(`✅ ${g.nama} ditambahkan`);
    load();
  };

  const handleDelete = async (g: Teacher) => {
    if (!confirm(`Hapus ${g.nama}?`)) return;
    await db.teachers.update(g.id, { statusAktif: false, diubahPada: timestamp() });
    toast(`${g.nama} dihapus`);
    load();
  };

  const handleCopyLink = async (g: Teacher) => {
    const url = `${window.location.origin}/g/${g.absenToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(g.id);
      setTimeout(() => setCopiedId(null), 1500);
      toast("Link disalin");
    } catch {
      toast(url);
    }
  };

  return (
    <div className="flex-1 px-[14px] pt-[14px] pb-[90px] lg:pb-4">
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
        <div className="flex items-center justify-between">
          <div className="text-[0.85rem] font-bold flex items-center gap-[6px]">
            <Users size={16} /> Daftar Guru ({guruList.length})
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="w-8 h-8 rounded-lg bg-[var(--input-bg)] flex items-center justify-center" aria-label="Refresh">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1 px-3 py-[7px] rounded-lg text-white font-bold text-[0.78rem]"
              style={{ background: "linear-gradient(135deg,#1e40af,#1e3a8a)" }}
            >
              <UserPlus size={14} /> Tambah
            </button>
          </div>
        </div>

        {showAdd && (
          <div className="mt-3 space-y-2">
            <input value={newNama} onChange={(e) => setNewNama(e.target.value)} placeholder="Nama guru" className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-[0.85rem]" />
            <input value={newNip} onChange={(e) => setNewNip(e.target.value)} placeholder="NIP (opsional)" className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-[0.85rem]" />
            <input value={newJabatan} onChange={(e) => setNewJabatan(e.target.value)} placeholder="Jabatan — mis. Guru Kelas 1 (opsional)" className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-[0.85rem]" />
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-lg border border-[var(--border)] text-[var(--text)] text-[0.82rem] font-bold">Batal</button>
              <button onClick={handleAdd} className="flex-1 py-2 rounded-lg text-white text-[0.82rem] font-bold" style={{ background: "linear-gradient(135deg,#1e40af,#1e3a8a)" }}>Simpan</button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {guruList.map((g) => (
          <div key={g.id} className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-[0.85rem]" style={{ background: "linear-gradient(135deg,#1e40af,#1e3a8a)" }}>
              {inisial(g.nama)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[var(--text)] text-[0.88rem] truncate">{g.nama}</div>
              <div className="text-[0.68rem] text-[var(--text-light)] truncate">
                {g.jabatan || "—"}{g.nip ? ` • ${g.nip}` : ""}
              </div>
            </div>
            <button onClick={() => handleCopyLink(g)} className="w-9 h-9 rounded-lg bg-[var(--input-bg)] flex items-center justify-center" aria-label="Copy link">
              {copiedId === g.id ? <Check size={16} className="text-[#16a34a]" /> : <Copy size={16} />}
            </button>
            <button onClick={() => handleDelete(g)} className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center" aria-label="Hapus">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {teacher && (
        <div className="text-[0.68rem] text-[var(--text-light)] mt-4 text-center">
          Admin: <b>{teacher.nama}</b> — share link QR/URL ke tiap guru lewat WhatsApp
        </div>
      )}
    </div>
  );
}
