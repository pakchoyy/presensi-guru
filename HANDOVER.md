# Presensi Guru (PresGuru) — Hand-over

Fork siap dari **Presensi Siswa**. Scratchpad: `./` (saat ini: `/tmp/claude-0/-home-user-presensi-siswa/900cad66-d76e-5041-8f62-9e397387e020/scratchpad/presensi-guru/`).

**Build status**: ✅ `tsc --noEmit` clean, ✅ `vite build` sukses (660 kB JS, 37 kB CSS).

---

## ✅ Yang SUDAH JALAN (bisa dipakai langsung)

### Branding
- `package.json` → `bgy-presensi-guru`, deps QR/confetti sudah di-drop
- `public/manifest.json` + `index.html` → nama/warna navy (`#1e40af`), icon placeholder `guru-presguru.png` (sama dengan siswa; mesti diganti)
- Theme CSS: semua warna teal `#0ea5a0`/`#0d7a8a`/`#2d6a7f` di-replace ke navy `#1e40af`/`#1e3a8a`/`#172554` (29 file otomatis)

### Entities & DB
- `src/types/entities.ts` — hapus Student/Classroom/AttendanceSession/AttendanceRecord. School dapat field `lat/lng/radiusMeter/jamMasukStandar/jamPulangStandar/toleransiTerlambatMenit`. Teacher dapat `absenToken/role/jabatan/nip/statusAktif`. **Baru**: `TeacherAttendance`.
- `src/repositories/dexie/db.ts` — DB `bgy_presensi_guru_db` dengan 1 schema version baru, tabel: schools, teachers, academicYears, teacherAttendance, calendarEntries, licenses, backupMeta, tombstones
- `src/types/enums.ts` — tambah `ClockInStatus` (ONTIME/LATE/FAR). PageName enum di-rename: `DASHBOARD`/`GURU` (bukan PRESENSI/SISWA)

### Core Service
- `src/lib/geo.ts` — Haversine distance helper
- `src/hooks/useGeolocation.ts` — hook request GPS dengan handling permission/timeout
- `src/repositories/dexie/teacher-attendance.repo.ts` — CRUD lokal
- `src/services/teacher-attendance.service.ts` — `clockIn()`/`clockOut()` dengan hitung status (ONTIME/LATE/FAR) pakai jam standar + radius

### UI Siap Pakai
- **`src/components/attendance/SelfieCamera.tsx`** — modal full-screen pakai `getUserMedia` facingMode user, preview + capture → Blob
- **`src/components/attendance/AbsenGuruPage.tsx`** — halaman utama guru route `/g/<token>`. Flow lengkap: fetch info → tombol Datang/Pulang → GPS → selfie → POST `/api/clockin` → tampil status. Jam realtime.
- `src/components/teachers/GuruPage.tsx` — admin CRUD daftar guru + copy link personal `/g/<token>`
- `src/components/attendance/DashboardHarianPage.tsx` — tabel status semua guru hari ini (sudah/belum masuk, pulang, warna indikator)
- `src/components/wizard/WizardSetup.tsx` — 4-step wizard baru: Sekolah → Admin → Tahun Ajaran → **Lokasi & Jam Sekolah** (map ambil GPS + slider radius)

### API Endpoints
- **`api/clockin.js`** — GET `?token=X` return guru+sekolah+status hari ini. POST multipart (token, action, lat, lng, selfie) → upload selfie ke bucket `teacher-selfies` + simpan record ke `cloud_guru_attendance` + hitung status via Haversine. Multipart parser inline (no extra dep).
- `api/license.js` — tweak: filter `product='guru'`, pesan error kalau user coba pakai kode siswa. Prefix kode `BGY-PG-XXXX`.

### Sync Service
- `src/services/sync.service.ts` — `SYNC_TABLES` dan `CLOUD_TABLE_MAP` di-update ke tabel baru:
  - `schools` → `cloud_schools` (share dengan siswa)
  - `teachers` → `cloud_guru_teachers` (**baru**)
  - `academicYears` → `cloud_academic_years` (share)
  - `teacherAttendance` → `cloud_guru_attendance` (**baru**)
  - `calendarEntries` → `cloud_calendar_entries` (share)
- `convertLocalToCloud()` punya case `teacherAttendance` lengkap

### SQL Migration
- `supabase/migrations/00200_presensi_guru.sql` — single file berisi:
  - `ALTER TABLE licenses ADD COLUMN product` + backfill + check constraint
  - `ALTER TABLE cloud_schools` tambah kolom lokasi + jam standar
  - `CREATE TABLE cloud_guru_teachers` + RLS policies + index
  - `CREATE TABLE cloud_guru_attendance` + RLS + unique constraint `(user_id, guru_id, tanggal)`
  - Komentar reminder untuk create bucket `teacher-selfies` manual

---

## ⚠️ Yang masih STUB (perlu dilengkapi)

| File | Status | TODO |
|------|--------|------|
| `src/services/export.service.ts` | Stub | Rework PDF/Excel dengan kolom: Tanggal/JamMasuk/JamPulang/Durasi/StatusMasuk/StatusHari. Reuse jsPDF+autotable pattern dari `../presensi-siswa/src/services/export.service.ts` |
| `src/services/import.service.ts` | Stub | Import daftar guru dari Excel (nama, nip, jabatan) |
| `src/components/reports/RekapPage.tsx` | Stub | Pilih guru + bulan → tampil tabel + tombol export PDF/Excel |
| `src/components/pro/PengaturanPage.tsx` | Belum disentuh | Hapus block "Mode Presensi" (QR/PJJ/AutoHadir), tambah section "Lokasi Sekolah" (edit lat/lng/radius/jam standar). Reference `src/components/wizard/WizardSetup.tsx` untuk UI picker lokasi |
| Selfie photo view | Belum | Dashboard admin perlu klik selfie thumbnail → zoom modal |

---

## 📋 Langkah User (Pak Choy)

### 1. Create repo di GitHub
Buka github.com → New repository → nama **`presensi-guru`** → private atau public, kosongan.

### 2. Push dari scratchpad
```bash
cd /tmp/claude-0/-home-user-presensi-siswa/900cad66-d76e-5041-8f62-9e397387e020/scratchpad/presensi-guru
git init
git add -A
git commit -m "Initial fork from presensi-siswa for PresGuru"
git branch -M main
git remote add origin https://github.com/pakchoyy/presensi-guru.git
git push -u origin main
```

### 3. Setup Vercel
- Buka vercel.com → New Project → import repo `pakchoyy/presensi-guru`
- Build command default (`vite build`), framework = Vite
- **Env variables** (copy persis dari project presensi-siswa):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (untuk `api/clockin.js` dan `api/license.js`)
- Domain: tambah custom domain `presguru.bantuguruyuk.web.id` → set CNAME di DNS

### 4. Apply SQL migration di Supabase
- Buka Supabase Dashboard project yang eksisting (yang dipakai Presensi Siswa)
- SQL Editor → paste isi `supabase/migrations/00200_presensi_guru.sql` → Run
- Verifikasi: tabel `cloud_guru_teachers` & `cloud_guru_attendance` muncul, kolom `product` di `licenses` ada

### 5. Create Storage bucket manual
- Supabase Dashboard → Storage → New bucket → name: `teacher-selfies` → **Private**
- (Tidak perlu policy tambahan — service_role bypass RLS; `api/clockin.js` yang upload)

### 6. Setup kode lisensi baru
- Tabel `licenses`: insert kode baru dengan prefix `BGY-PG-xxxxx` dan kolom `product='guru'`
- Produk kreacy.my.id baru: buat produk dengan harga Rp15.000/tahun, slug baru (bukan `8nonq6ro`). Update link di `src/components/pro/UpgradePage.tsx` dan `PengaturanPage.tsx`.

### 7. Icon baru
- Ganti `public/guru-presguru.png` dengan icon biru navy 512x512 PNG (saat ini masih placeholder sama dengan siswa). Rename juga `public/guru-cibisd2.png` (sisa fallback) kalau mau.

---

## 🧪 Verifikasi End-to-End

1. Buka domain production → wizard setup muncul → isi 4 langkah → selesai
2. Masuk ke menu Guru → tambah 2-3 guru → copy link
3. Buka link `/g/<token>` di HP → tombol "Datang" muncul
4. Tap "Datang" → izinkan GPS → izinkan kamera → ambil selfie → confirm → status "Masuk 07:XX — Tepat Waktu/Terlambat"
5. Sore buka link lagi → tombol "Pulang" → sama flow → status "Pulang 13:XX"
6. Admin buka Dashboard → lihat 3 guru hari ini dengan status warna + jam
7. Status FAR: pindah jauh dari koordinat sekolah → tap Datang → "Di Luar Radius"

---

## 🧭 Catatan Penting

- **Supabase project**: SAME dengan presensi-siswa. Tabel baru (`cloud_guru_*`) hidup bareng tabel siswa (`cloud_students`, `cloud_classrooms`, dll). Satu akun user bisa pakai dua produk.
- **PRO terpisah**: email yang sudah PRO Siswa tetap FREE di Guru sampai beli lagi. Query lisensi filter `product`.
- **DB lokal (Dexie)**: beda dari presensi-siswa — nama DB `bgy_presensi_guru_db` (biar install dual-app di 1 browser aman).
- **Rute `/g/<token>`** di `src/App.tsx` sudah dihandle: deteksi via `window.location.pathname` match `/^\/g\/([^/]+)/`.
- **File yang dihapus**: `src/components/students/`, `src/components/attendance/{PresensiPage,QrScanner,AbsenSiswaPage,StudentRow,StatusSheet}`, `src/components/import/`, `src/lib/qr-card.ts`, `src/repositories/dexie/{student,classroom,attendance}.repo.ts`, `src/services/attendance.service.ts`, `api/absen.js`
