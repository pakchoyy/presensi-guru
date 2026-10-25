import { BookOpen, ClipboardCheck, Users, Stethoscope, BarChart3, Database, Calendar, Settings } from "lucide-react";

const GUIDES = [
  {
    num: "★",
    icon: Settings,
    title: "Paket FREE, PLUS & PRO",
    desc: "Pengguna baru dapat <b>masa coba PRO 30 hari</b>. Setelah itu FREE (maks 5 guru, presensi selfie). <b>PLUS</b> maks 10 guru, cloud, logo sekolah. <b>PRO</b> guru tanpa batas, presensi dengan <b>GPS &amp; peta lokasi</b>, Kepala Sekolah memverifikasi izin. Lihat tabel lengkap di menu <b>Upgrade paket</b>.",
  },
  {
    num: "1",
    icon: Users,
    title: "Admin: Tambah Guru",
    desc: "Buka menu <b>Guru</b>. Tambah guru satu per satu atau lewat <b>Import Excel</b>. Tiap guru otomatis mendapat <b>Kode login</b> dan <b>PIN</b> — bagikan ke guru. Pilih peran <b>Guru</b> atau <b>Kepala Sekolah</b> (PRO).",
  },
  {
    num: "2",
    icon: ClipboardCheck,
    title: "Guru: Presensi Masuk & Pulang",
    desc: "Guru masuk lewat <b>Guru / Kepala Sekolah</b> dengan kode + PIN, lalu tap <b>Ambil Presensi Masuk</b> dan foto selfie. Di PRO, lokasi GPS dicek terhadap radius sekolah. Foto kurang bagus? <b>Ulangi</b> presensi — yang <b>terakhir</b> yang dihitung. Sore hari ambil <b>Presensi Pulang</b>.",
  },
  {
    num: "3",
    icon: Stethoscope,
    title: "Sakit / Izin",
    desc: "Di tab <b>Izin</b>, guru memilih tanggal awal–akhir, jenis (Sakit/Izin), keterangan, dan boleh melampirkan <b>foto</b> (surat dokter dll). Di PRO, <b>Kepala Sekolah</b> menyetujui atau menolak. Admin hanya bisa melihat.",
  },
  {
    num: "4",
    icon: Settings,
    title: "Jam, Hari Aktif & Lokasi",
    desc: "Di <b>Pengaturan</b> admin mengatur jam masuk/pulang, batas tepat waktu, dan <b>Hari Aktif</b> (Senin–Jumat / Senin–Sabtu / kustom). Di hari non-aktif atau libur kalender, presensi ditutup. Titik sekolah (PRO) diisi lewat <b>Gunakan lokasi saya sekarang</b> dan dicek di peta.",
  },
  {
    num: "5",
    icon: BarChart3,
    title: "Dashboard & Rekap",
    desc: "<b>Dashboard</b> menampilkan kehadiran semua guru hari ini (admin: hanya lihat; Kepala Sekolah: bisa ubah status). Menu <b>Rekap</b> merangkum Hadir/Terlambat/Sakit/Izin/Alpha per guru dan bisa diekspor ke <b>PDF</b> atau <b>Excel</b>.",
  },
  {
    num: "6",
    icon: Calendar,
    title: "Kalender Akademik",
    desc: "Buka menu Kalender. Paket PLUS/PRO (dan masa coba) bisa <b>menandai Hari Libur</b> (merah) dan <b>Hari Penting</b> (biru). Hari libur otomatis tidak dihitung di presensi dan rekap.",
  },
  {
    num: "7",
    icon: Database,
    title: "Backup & Restore Data",
    desc: "Buka menu Backup — <b>Buat Backup Lokal</b> menyimpan data ke file. Kalau ganti HP, <b>Restore</b> dari file yang sama. Paket berbayar juga bisa sinkron ke cloud.",
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
          <b>Presensi Yuk | Guru</b> dirancang sesederhana mungkin. Guru bisa mengisi presensi <b>kurang dari 30 detik</b>, bisa online maupun offline.
        </div>

        <div className="flex flex-col gap-[10px]">
          {GUIDES.map((g) => (
            <div
              key={g.num}
              className="flex gap-3 items-start p-[10px] border border-[var(--border)] rounded-[9px] bg-[var(--input-bg)]"
            >
              <div className="w-6 h-6 rounded-full bg-[#2563eb] text-white text-[0.72rem] font-bold flex items-center justify-center flex-shrink-0">
                {g.num}
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
