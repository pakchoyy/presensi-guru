import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/components/shared/Toast";
import { db } from "@/repositories/dexie/db";
import { academicYearRepo } from "@/repositories/dexie/academic-year.repo";
import type { AcademicCalendarEntry } from "@/types/entities";
import { CalendarEntryType, CalendarSource, Tier } from "@/types/enums";
import { isDayActive } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus, Trash2, Lock, Star, Eye, PenLine } from "lucide-react";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function KalenderPage() {
  const { teacher } = useApp();
  const { toast } = useToast();
  const isPRO = teacher?.tier === Tier.PRO;

  const [entries, setEntries] = useState<AcademicCalendarEntry[]>([]);
  const [ay, setAy] = useState<{ id: number; label: string } | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [editTarget, setEditTarget] = useState<AcademicCalendarEntry | null>(null);
  const [addForm, setAddForm] = useState(false);
  const [newLiburName, setNewLiburName] = useState("");
  const [entryType, setEntryType] = useState<CalendarEntryType>(CalendarEntryType.HARI_LIBUR);
  const [isEditMode, setIsEditMode] = useState(() => {
    const stored = localStorage.getItem("calendar_edit_mode");
    return stored === "true";
  });

  const loadEntries = useCallback(async () => {
    const a = await academicYearRepo.getActive();
    if (a) setAy({ id: a.id, label: a.label });
    const all = await db.calendarEntries.toArray();
    setEntries(all);
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  };

  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = (day: number) => `${currentYear}-${pad(currentMonth + 1)}-${pad(day)}`;

  const getEntries = (day: number) =>
    day ? entries.filter((e) => e.tanggal === dateStr(day)) : [];

  const isToday = (day: number) => {
    const t = new Date();
    return currentYear === t.getFullYear() && currentMonth === t.getMonth() && day === t.getDate();
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const handleAdd = async () => {
    const nama = newLiburName.trim();
    if (!nama) { toast("Isi nama dulu"); return; }
    if (!ay) return;

    const entry: AcademicCalendarEntry = {
      id: editTarget?.id || Date.now(),
      tahunAjaranId: ay.id,
      tanggal: editTarget?.tanggal || dateStr(new Date().getDate()),
      jenis: entryType,
      keterangan: nama,
      sumber: CalendarSource.KUSTOM,
    };

    if (editTarget?.id) {
      await db.calendarEntries.put(entry);
      toast("Entry diperbarui");
    } else {
      await db.calendarEntries.put(entry);
      toast("Entry ditambahkan");
    }
    setAddForm(false);
    setEditTarget(null);
    setNewLiburName("");
    await loadEntries();
  };

  const handleDelete = async (entry: AcademicCalendarEntry) => {
    if (entry.sumber === CalendarSource.BAWAAN) {
      toast("Entry bawaan tidak bisa dihapus");
      return;
    }
    // Validate entry.id before using it in Dexie query
    if (!entry.id) {
      toast("Invalid entry ID");
      return;
    }
    await db.calendarEntries.delete(entry.id);
    toast("Entry dihapus");
    setEditTarget(null);
    await loadEntries();
  };

  const handleDayClick = (day: number, dayEntries: AcademicCalendarEntry[]) => {
    if (!isPRO) return;
    
    // Mode Baca: hanya tampilkan info, tidak bisa edit
    if (!isEditMode) {
      if (dayEntries.length > 0) {
        const info = dayEntries.map(e => `${e.jenis === CalendarEntryType.HARI_LIBUR ? '🔴' : '🔵'} ${e.keterangan}`).join('\n');
        toast(info);
      }
      return;
    }
    
    // Mode Edit: bisa tambah/edit entry
    const existingKustom = dayEntries.find(e => e.sumber === CalendarSource.KUSTOM);
    if (existingKustom) {
      setEditTarget(existingKustom);
      setNewLiburName(existingKustom.keterangan || "");
      setEntryType(existingKustom.jenis);
      setAddForm(true);
    } else {
      const d = dateStr(day);
      setEditTarget({
        id: 0,
        tahunAjaranId: ay?.id || 0,
        tanggal: d,
        jenis: CalendarEntryType.HARI_LIBUR,
        keterangan: "",
        sumber: CalendarSource.KUSTOM,
      });
      setNewLiburName("");
      setEntryType(CalendarEntryType.HARI_LIBUR);
      setAddForm(true);
    }
  };

  const toggleEditMode = () => {
    const newMode = !isEditMode;
    setIsEditMode(newMode);
    localStorage.setItem("calendar_edit_mode", String(newMode));
    toast(newMode ? "Mode Edit: Klik tanggal untuk tambah/edit" : "Mode Baca: Klik tanggal untuk lihat info");
  };

  return (
    <div className="flex-1 px-[14px] pt-[14px] pb-[90px] lg:pb-4">
      {!isPRO && (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[10px] mb-3 flex items-center gap-2 text-[0.7rem] text-[var(--text-light)]">
          <Lock size={12} className="text-[#b45309]" />
          Kalender hanya bisa dilihat. <span className="font-semibold text-[#0d9488]">Upgrade ke PRO</span> untuk menambah/mengedit hari libur & hari penting.
        </div>
      )}

      {isPRO && (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[10px] mb-3 flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-[0.7rem] text-[var(--text)]">
              {isEditMode ? (
                <>
                  <PenLine size={13} className="text-[#0d9488]" />
                  <span><b className="text-[#0d9488]">Mode Edit:</b> Klik tanggal untuk tambah/edit event</span>
                </>
              ) : (
                <>
                  <Eye size={13} className="text-[var(--text-light)]" />
                  <span><b>Mode Baca:</b> Klik tanggal untuk lihat info</span>
                </>
              )}
            </div>
            {!isEditMode && (
              <div className="text-[0.65rem] text-[var(--text-light)] mt-1 ml-5">
                💡 Klik ikon pensil di kanan untuk menambah hari penting
              </div>
            )}
          </div>
          <button
            onClick={toggleEditMode}
            className="px-3 py-[6px] rounded-lg border-[1.5px] border-[var(--border)] text-[0.7rem] font-bold cursor-pointer flex items-center gap-1 bg-transparent hover:bg-[var(--input-bg)] transition-colors flex-shrink-0"
          >
            {isEditMode ? (
              <>
                <Eye size={12} />
                Baca
              </>
            ) : (
              <>
                <PenLine size={12} />
                Edit
              </>
            )}
          </button>
        </div>
      )}

      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px]">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="h-8 w-8 rounded-lg border-[1.5px] border-[var(--border)] text-[var(--text)] flex items-center justify-center bg-transparent cursor-pointer">
            <ChevronLeft size={16} />
          </button>
          <div className="text-[0.9rem] font-bold">{MONTHS[currentMonth]} {currentYear}</div>
          <button onClick={nextMonth} className="h-8 w-8 rounded-lg border-[1.5px] border-[var(--border)] text-[var(--text)] flex items-center justify-center bg-transparent cursor-pointer">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-[2px] text-center mb-2">
          {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((d, i) => {
            const isRed = !isDayActive(i);
            return (
              <div key={d} className={`text-[0.6rem] font-bold uppercase py-1 ${isRed ? "text-[#dc2626]" : "text-[var(--text-light)]"}`}>{d}</div>
            );
          })}
        </div>

        <div className="grid grid-cols-7 gap-[2px]">
          {days.map((day, i) => {
            const dayEntries = day ? getEntries(day) : [];
            const isWeekend = !isDayActive(i % 7);
            const todayClass = day && isToday(day);
            const liburEntry = dayEntries.find(e => e.jenis === CalendarEntryType.HARI_LIBUR);
            const pentingEntry = dayEntries.find(e => e.jenis === CalendarEntryType.HARI_PENTING);

            let bg = "";
            let textColor = "";
            if (liburEntry) {
              bg = "bg-[#fee2e2]";
              textColor = "text-[#dc2626] font-bold";
            } else if (pentingEntry) {
              bg = "bg-[#dbeafe]";
              textColor = "text-[#1d4ed8] font-bold";
            } else if (todayClass) {
              bg = "bg-[#0d9488]";
              textColor = "text-white font-bold";
            } else if (isWeekend) {
              textColor = "text-[#dc2626]";
            } else {
              textColor = "text-[var(--text)]";
            }

            return (
              <div
                key={i}
                onClick={() => day && handleDayClick(day, dayEntries)}
                className={`aspect-square flex flex-col items-center justify-center rounded-lg text-[0.7rem] transition-colors ${
                  !day ? "" :
                  bg || (isWeekend ? "" : isPRO ? "cursor-pointer hover:bg-[var(--input-bg)]" : "")
                } ${textColor}`}
                style={!bg && isWeekend ? { backgroundColor: "var(--input-bg)" } : undefined}
                title={liburEntry ? liburEntry.keterangan || "Hari Libur" : pentingEntry ? pentingEntry.keterangan || "Hari Penting" : isPRO ? (isEditMode ? "Klik untuk tambah/edit" : "Klik untuk lihat info") : undefined}
              >
                {day && <span>{day}</span>}
                {liburEntry && day && (
                  <span className="text-[0.45rem] leading-tight text-center px-[1px] truncate max-w-full">
                    {liburEntry.keterangan?.slice(0, 8)}
                  </span>
                )}
                {pentingEntry && day && (
                  <span className="text-[0.45rem] leading-tight text-center px-[1px] truncate max-w-full">
                    {pentingEntry.keterangan?.slice(0, 8)}
                  </span>
                )}
                {isPRO && isEditMode && day && !liburEntry && !pentingEntry && (
                  <span className="text-[0.45rem] text-[var(--text-light)]/40">+</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add/Edit Form (PRO only) */}
      {isPRO && addForm && (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mt-3">
          <div className="text-[0.78rem] font-bold mb-2">
            {editTarget?.id ? "Edit Kalender" : "Tambah ke Kalender"}
            {editTarget && <span className="text-[var(--text-light)] font-normal text-[0.7rem]"> — {editTarget.tanggal}</span>}
          </div>

          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setEntryType(CalendarEntryType.HARI_LIBUR)}
              className={`flex-1 py-[9px] rounded-[8px] text-[0.72rem] font-bold border-[1.5px] cursor-pointer ${
                entryType === CalendarEntryType.HARI_LIBUR
                  ? "border-[#dc2626] bg-[#fee2e2] text-[#dc2626]"
                  : "border-[var(--border)] bg-transparent text-[var(--text-light)]"
              }`}
            >
              Hari Libur
            </button>
            <button
              onClick={() => setEntryType(CalendarEntryType.HARI_PENTING)}
              className={`flex-1 py-[9px] rounded-[8px] text-[0.72rem] font-bold border-[1.5px] cursor-pointer ${
                entryType === CalendarEntryType.HARI_PENTING
                  ? "border-[#1d4ed8] bg-[#dbeafe] text-[#1d4ed8]"
                  : "border-[var(--border)] bg-transparent text-[var(--text-light)]"
              }`}
            >
              <Star size={12} className="inline mr-1" />
              Hari Penting
            </button>
          </div>

          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newLiburName}
              onChange={(e) => setNewLiburName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={entryType === CalendarEntryType.HARI_LIBUR ? "Nama hari libur (contoh: Ulang Tahun Sekolah)" : "Nama hari penting (contoh: Penerimaan Rapor)"}
              className="flex-1 px-[10px] py-[9px] border-[1.5px] border-[var(--border)] rounded-[8px] text-[0.82rem] bg-[var(--input-bg)] outline-none focus:border-[#0d9488] font-[inherit]"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="flex-1 flex items-center justify-center gap-[4px] py-[9px] rounded-[10px] text-white font-bold text-[0.78rem] cursor-pointer"
              style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488,#0f766e)" }}
            >
              <Plus size={14} /> {editTarget?.id ? "Simpan" : "Tambah"}
            </button>
            {editTarget?.id ? (
              <button
                onClick={() => handleDelete(editTarget)}
                className="flex-1 py-[9px] rounded-[10px] border-[1.5px] border-[#ef4444] text-[#ef4444] font-bold text-[0.78rem] bg-transparent cursor-pointer flex items-center justify-center gap-[4px]"
              >
                <Trash2 size={14} /> Hapus
              </button>
            ) : null}
            <button
              onClick={() => { setAddForm(false); setEditTarget(null); }}
              className="flex-1 py-[9px] rounded-[10px] border-[1.5px] border-[var(--border)] bg-[var(--card-bg)] text-[var(--text)] font-bold text-[0.78rem] cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px]">
        <div className="text-[0.75rem] font-bold mb-2">Keterangan</div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1 text-[0.7rem]">
            <div className="w-3 h-3 rounded bg-[#dc2626]" /> Hari Libur
          </div>
          <div className="flex items-center gap-1 text-[0.7rem]">
            <div className="w-3 h-3 rounded bg-[#1d4ed8]" /> Hari Penting
          </div>
          <div className="flex items-center gap-1 text-[0.7rem]">
            <div className="w-3 h-3 rounded bg-[#0d9488]" /> Hari Ini
          </div>
          <div className="flex items-center gap-1 text-[0.7rem]">
            <span className="text-[#dc2626] font-bold">Min</span> Minggu
          </div>
          {isPRO && (
            <div className="flex items-center gap-1 text-[0.7rem]">
              <span className="text-[0.5rem] text-[var(--text-light)]">Klik tanggal untuk tambah/edit</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
