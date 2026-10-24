import { BookOpen, ClipboardCheck, Upload, BarChart3, Database, Calendar, Settings } from "lucide-react";

const GUIDES = [
  {
    num: "1",
    icon: ClipboardCheck,
    title: "Presensi Harian",
    desc: "Buka menu Presensi. Kalau <b>Isi Hadir Otomatis</b> ON (di Pengaturan), semua siswa otomatis berstatus <b>Hadir</b>. Tap nama siswa yang <b>tidak hadir</b>, lalu pilih Sakit/Izin/Alpha. Data langsung tersimpan.",
  },
  {
    num: "2",
    icon: Settings,
    title: "Pengaturan Hari Aktif",
    desc: "Buka menu <b>Pengaturan</b> > <b>Hari Aktif</b>. Pilih <b>Senin - Jumat</b> (Sabtu & Minggu libur) atau <b>Senin - Sabtu</b> (hanya Minggu libur). Hari non-aktif ditandai merah di kalender dan tidak masuk presensi.",
  },
  {
    num: "3",
    icon: Upload,
    title: "Import Siswa dari Excel",
    desc: "Download template Excel dari menu Siswa. Isi kolom <b>Nama, NISN, Jenis Kelamin, Kelas</b> — lalu upload. Sistem membaca dan menampilkan pratinjau. Kolom <b>Kelas</b> otomatis membuat kelas baru (PRO).",
  },
  {
    num: "4",
    icon: BarChart3,
    title: "Rekap & Export Laporan",
    desc: "Buka menu Rekap — pilih <b>Bulanan</b> atau <b>Semester</b>. Lihat tabel ringkasan Hadir/Sakit/Izin/Alpha per siswa. Ekspor langsung ke <b>PDF</b> atau <b>Excel</b> untuk laporan ke kepala sekolah.",
  },
  {
    num: "5",
    icon: Calendar,
    title: "Kalender Akademik (PRO)",
    desc: "Buka menu Kalender. Versi PRO bisa <b>menandai Hari Libur</b> (merah) dan <b>Hari Penting</b> (biru) — seperti penerimaan rapor, ujian, atau perayaan sekolah. Kalender membantu merencanakan semester.",
  },
  {
    num: "6",
    icon: Database,
    title: "Backup & Restore Data",
    desc: "Buka menu Backup — klik <b>Buat Backup Lokal</b> untuk menyimpan data ke file. Simpan di HP atau Google Drive. Kalau ganti HP, <b>Restore</b> dari file yang sama. Versi PRO bisa backup ke cloud.",
  },
];

export function PetunjukPage() {
  return (
    <div className="flex-1 px-[14px] pt-[14px] pb-[calc(90px+var(--ticker-h,0px))] lg:pb-4">
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px]">
        <div className="text-[0.85rem] font-bold flex items-center gap-[8px] mb-4">
          <BookOpen size={18} className="text-[#2563eb]" /> Petunjuk Penggunaan
        </div>

        <div
          className="text-[0.8rem] text-[var(--text)] leading-[1.9] mb-4 p-[10px] rounded-lg"
          style={{
            background: "rgba(14,165,160,.08)",
            borderLeft: "4px solid #2563eb",
          }}
        >
          <b>Presensi Yuk | Guru</b> dirancang sesederhana mungkin. Guru bisa mengisi presensi <b>kurang dari 30 detik per kelas</b>, bisa online maupun offline.
        </div>

        <div className="flex flex-col gap-[10px]">
          {GUIDES.map((g) => (
            <div
              key={g.num}
              className="flex gap-3 items-start p-[10px] border border-[var(--border)] rounded-[9px] bg-[var(--input-bg)]"
            >
              <div className="text-[1.2rem] flex-shrink-0 font-bold text-[#2563eb]">
                {g.num}️⃣
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-[6px] mb-1">
                  <g.icon size={15} className="text-[#2563eb]" />
                  <b className="text-[0.82rem] text-[#2563eb]">{g.title}</b>
                </div>
                <div
                  className="text-[0.74rem] text-[var(--text)] leading-[1.7]"
                  dangerouslySetInnerHTML={{ __html: g.desc }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
