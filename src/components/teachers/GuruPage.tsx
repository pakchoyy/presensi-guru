import { useEffect, useRef, useState } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  Copy,
  Pencil,
  KeyRound,
  Share2,
  X,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/components/shared/Toast";
import { teacherRepo } from "@/repositories/dexie/teacher.repo";
import { db } from "@/repositories/dexie/db";
import type { Teacher } from "@/types/entities";
import { generateId, timestamp, inisial, randomPin, randomKode } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { Tier } from "@/types/enums";
import { guruCloudService } from "@/services/guru-cloud.service";

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
  const [fNip, setFNip] = useState("");
  const [fKode, setFKode] = useState("");   // kode login G-XXXX saat tanpa NIP
  const [fPin, setFPin] = useState("");
  const [fJabatan, setFJabatan] = useState("");
  const [fRole, setFRole] = useState<"guru" | "admin">("guru");
  const [punyaNip, setPunyaNip] = useState(false);

  const [shareDialog, setShareDialog] = useState<{ nama: string; kode: string; pin: string; nip?: string } | null>(null);

  const genKodeUnik = (): string => {
    let candidate = randomKode();
    let tries = 0;
    while (kodeDipakai(candidate) && tries < 50) { candidate = randomKode(); tries++; }
    return candidate;
  };

  // Kode login yang akan dipakai & ditampilkan di form.
  const resolvedKode = punyaNip ? (fNip.trim() || "(ketik NIP)") : (fKode || "—");

  const resetForm = () => {
    setEditId(null);
    setFNama("");
    setFNip("");
    setFKode("");
    setFPin("");
    setFJabatan("");
    setFRole("guru");
    setPunyaNip(false);
  };

  // Buka form Tambah guru baru (sekalian generate kode + PIN awal supaya terlihat).
  const openTambah = () => {
    resetForm();
    setFKode(genKodeUnik());
    setFPin(randomPin(4));
    setShowAdd(true);
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

    // Kode login: kalau punya NIP → pakai NIP; kalau tidak → kode G-XXXX (fKode).
    const nipInput = punyaNip ? fNip.trim() : "";
    let kode: string;
    if (nipInput) {
      if (kodeDipakai(nipInput, editId ?? undefined)) {
        toast("NIP sudah dipakai guru lain", "error");
        return;
      }
      kode = nipInput;
    } else {
      kode = fKode.trim() || genKodeUnik();
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
        nip: nipInput || undefined,
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
            nip: nipInput || undefined,
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
        nip: nipInput || undefined,
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
    setFNip(g.nip || "");
    setPunyaNip(!!g.nip);
    setFKode(g.kodeLogin || g.nip || genKodeUnik());
    setFPin(g.pin || "");
    setFJabatan(g.jabatan || "");
    setFRole((g.role as "guru" | "admin") || "guru");
    setShowAdd(true);
    // scroll ke atas supaya form kelihatan
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (g: Teacher) => {
    if (!confirm(`Hapus ${g.nama}?`)) return;
    await db.teachers.update(g.id, { statusAktif: false, diubahPada: timestamp() });
    toast(`${g.nama} dihapus`, "info");
    await load();
    await refreshTeachers();
  };

  // ── Import Excel ────────────────────────────────────────────────
  const excelInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const rows = [
      ["Nama", "Jabatan", "NIP", "PIN"],
      ["Budi Santoso", "Guru Kelas 1", "198001012005011001", "1234"],
      ["Siti Aminah", "Guru Kelas 2", "", "5678"],
      ["Ahmad (tanpa NIP)", "Guru Mapel", "", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 24 }, { wch: 20 }, { wch: 22 }, { wch: 8 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Guru");
    XLSX.writeFile(wb, "template_import_guru.xlsx");
    toast("Template diunduh — isi kolom Nama (wajib)", "success");
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = ""; // reset supaya bisa pilih file sama lagi
    if (!file || !school) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      if (data.length === 0) { toast("File kosong", "error"); return; }

      // ambil kolom fleksibel (case-insensitive)
      const pick = (row: Record<string, unknown>, keys: string[]): string => {
        for (const k of Object.keys(row)) {
          if (keys.includes(k.trim().toLowerCase())) return String(row[k] ?? "").trim();
        }
        return "";
      };

      let ok = 0, skip = 0, cloudOk = 0, cloudGagal = 0;
      // Kalau admin login + online, guru hasil import ikut diprovision ke cloud
      // supaya bisa login mandiri dari HP lain.
      const keCloud = isAuthenticated && navigator.onLine && (await guruCloudService.isReady());
      const cloudIds: Record<number, string> = {};
      const now = timestamp();
      const existingCodes = new Set(guruList.flatMap((g) => [g.kodeLogin, g.nip].filter(Boolean) as string[]));
      const genUnik = (): string => {
        let c = randomKode();
        while (existingCodes.has(c)) c = randomKode();
        existingCodes.add(c);
        return c;
      };

      for (const row of data) {
        const nama = pick(row, ["nama", "name", "nama lengkap"]);
        if (!nama) { skip++; continue; }
        const jabatan = pick(row, ["jabatan", "jabatan (opsional)"]);
        const nipRaw = pick(row, ["nip", "nip / nuptk", "nip/nuptk", "nuptk"]);
        const pinRaw = pick(row, ["pin"]).replace(/\D/g, "").slice(0, 6);
        const nip = nipRaw || undefined;
        let kode = nipRaw;
        if (!kode) kode = genUnik();
        else existingCodes.add(kode);
        const pin = /^\d{4,6}$/.test(pinRaw) ? pinRaw : randomPin(4);

        const localId = generateId();
        let cloudUserId: string | undefined;
        let kodeFinal = kode;
        let pinFinal = pin;
        if (keCloud) {
          try {
            const res = await guruCloudService.createAccount({
              nama,
              sekolah_id: school.id,
              kode_login: kode,
              pin,
              nip,
              jabatan: jabatan || undefined,
              role: "guru",
              local_id: localId,
            });
            cloudUserId = res.user_id;
            kodeFinal = res.kode_login;
            pinFinal = res.pin;
            cloudIds[localId] = res.user_id;
            cloudOk++;
          } catch {
            // Gagal di cloud → tetap simpan lokal, dilaporkan di akhir.
            cloudGagal++;
          }
        }

        await db.teachers.put({
          id: localId,
          nama,
          email: cloudUserId ? `${kodeFinal}@guru.local` : "",
          sekolahId: school.id,
          tier: Tier.FREE,
          nip,
          kodeLogin: kodeFinal,
          pin: pinFinal,
          jabatan: jabatan || undefined,
          role: "guru",
          absenToken: crypto.randomUUID(),
          statusAktif: true,
          dibuatPada: now,
          diubahPada: now,
        });
        ok++;
      }
      if (Object.keys(cloudIds).length > 0) {
        setCloudUserIdMap((m) => ({ ...m, ...cloudIds }));
      }
      const bagianCloud = keCloud ? ` · cloud: ${cloudOk} ok${cloudGagal ? `, ${cloudGagal} gagal (tersimpan lokal)` : ""}` : "";
      toast(
        `${ok} guru diimpor${skip ? `, ${skip} dilewati (nama kosong)` : ""}${bagianCloud}`,
        ok ? "success" : "info"
      );
      await load();
      await refreshTeachers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(`Gagal baca Excel: ${msg}`, "error");
    }
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
          <button
            onClick={() => { if (showAdd) { resetForm(); setShowAdd(false); } else { openTambah(); } }}
            className="flex items-center gap-1 px-3 py-[8px] rounded-xl text-white font-bold text-[0.78rem] active:scale-95"
            style={{ background: "var(--grad)" }}
          >
            {showAdd ? <X size={14} /> : <UserPlus size={14} />}
            {showAdd ? "Batal" : "Tambah"}
          </button>
        </div>

        {/* Import Excel */}
        {!showAdd && (
          <div className="flex gap-2 mt-3">
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImportExcel}
              className="hidden"
            />
            <button
              onClick={() => excelInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-[6px] py-[9px] rounded-xl border-[1.5px] border-[#16a34a] text-[#16a34a] font-bold text-[0.76rem] bg-transparent active:scale-95"
            >
              <FileSpreadsheet size={14} /> Import Excel
            </button>
            <button
              onClick={downloadTemplate}
              className="flex items-center justify-center gap-[6px] px-3 py-[9px] rounded-xl border-[1.5px] border-[var(--border)] text-[var(--text-light)] font-bold text-[0.76rem] bg-transparent active:scale-95"
            >
              <Download size={14} /> Template
            </button>
          </div>
        )}

        {showAdd && (
          <div className="mt-3 space-y-3 animate-slide-down">
            <Field label="Nama lengkap *">
              <input
                value={fNama}
                onChange={(e) => setFNama(e.target.value)}
                placeholder="Mis. Budi Santoso"
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[0.9rem] outline-none focus:border-[var(--brand)]"
              />
            </Field>
            <Field label="Jabatan (opsional)">
              <input
                value={fJabatan}
                onChange={(e) => setFJabatan(e.target.value)}
                placeholder="Mis. Guru Kelas 1 / Kepala Sekolah"
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[0.9rem] outline-none focus:border-[var(--brand)]"
              />
            </Field>

            {/* Kotak: Akun Login Guru */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] p-3 space-y-3">
              <div className="text-[0.72rem] font-extrabold text-[var(--brand-strong)] flex items-center gap-1">
                <KeyRound size={13} /> Akun Login Guru
              </div>

              {/* Toggle: Punya NIP? */}
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-[0.8rem] font-semibold text-[var(--text)]">Guru punya NIP?</div>
                  <div className="text-[0.6rem] text-[var(--text-light)]">
                    {punyaNip ? "Kode login = NIP" : "Kode login dibuatkan otomatis (G-XXXX)"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const v = !punyaNip;
                    setPunyaNip(v);
                    if (!v) {
                      // Matikan NIP → kode login HARUS kode otomatis G-XXXX.
                      // (kalau fKode masih sisa NIP, buat yang baru)
                      setFNip("");
                      if (!/^G-\d{4}$/.test(fKode.trim())) setFKode(genKodeUnik());
                    }
                  }}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 border-none cursor-pointer ${punyaNip ? "bg-[var(--brand)]" : "bg-[var(--border)]"}`}
                  aria-label="Toggle punya NIP"
                >
                  <span className={`absolute top-[2px] left-[2px] w-5 h-5 rounded-full bg-white shadow transition-transform ${punyaNip ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              {punyaNip && (
                <input
                  value={fNip}
                  onChange={(e) => setFNip(e.target.value)}
                  placeholder="Ketik NIP / NUPTK"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] text-[0.88rem] outline-none focus:border-[var(--brand)]"
                />
              )}

              {/* Kode login — ditampilkan langsung di atas PIN */}
              <div className="flex items-center justify-between bg-[var(--card-bg)] border border-[var(--border)] rounded-xl px-3 py-2">
                <span className="text-[0.68rem] font-bold text-[var(--text-light)] uppercase tracking-wide">Kode login</span>
                <span className="font-mono font-extrabold text-[var(--brand-strong)] text-[0.95rem]">{resolvedKode}</span>
              </div>

              {/* PIN sejajar tombol Reset PIN */}
              <div>
                <label className="block text-[0.68rem] font-bold text-[var(--text-light)] mb-1 uppercase tracking-wide">PIN (4-6 digit)</label>
                <div className="flex items-stretch gap-2">
                  <input
                    value={fPin}
                    onChange={(e) => setFPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Kosong = otomatis"
                    inputMode="numeric"
                    className="flex-1 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] text-[0.88rem] outline-none focus:border-[var(--brand)] tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={() => setFPin(randomPin(4))}
                    className="px-3 rounded-xl text-white text-[0.75rem] font-bold flex items-center gap-1 active:scale-95"
                    style={{ background: "var(--grad)" }}
                  >
                    <KeyRound size={13} /> Reset PIN
                  </button>
                </div>
              </div>

              {/* Salin info login — hanya saat edit (guru sudah ada) */}
              {editId && (
                <button
                  type="button"
                  onClick={() => { const g = guruList.find((x) => x.id === editId); if (g) handleCopyLogin(g); }}
                  className="w-full py-2 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] text-[var(--brand)] text-[0.78rem] font-bold flex items-center justify-center gap-2 active:scale-95"
                >
                  <Share2 size={14} /> Salin info login (kode + PIN)
                </button>
              )}
            </div>

            <Field label="Peran">
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
              onClick={() => handleEdit(g)}
              className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-3 flex items-center gap-3 cursor-pointer hover:border-[var(--brand)] transition-colors"
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
                <IconBtn label="Edit" color="var(--brand)" onClick={(e) => { e.stopPropagation(); handleEdit(g); }}>
                  <Pencil size={15} />
                </IconBtn>
                <IconBtn label="Hapus" color="#dc2626" onClick={(e) => { e.stopPropagation(); handleDelete(g); }}>
                  <Trash2 size={15} />
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
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-9 h-9 rounded-lg bg-[var(--input-bg)] flex items-center justify-center active:scale-95"
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
