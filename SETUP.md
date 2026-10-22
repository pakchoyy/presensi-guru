# Setup Presensi Guru — Langkah 1x saja

Panduan ini khusus setup pertama kali, dari repo kosong → aplikasi hidup di `presguru.bantuguruyuk.web.id`.

Total waktu estimasi: **15–20 menit**.

---

## ✅ Pre-check

Pastikan sudah punya:
- [x] Repo GitHub: `pakchoyy/presensi-guru` (sudah ada)
- [ ] Akses dashboard Vercel (akun yang sudah pernah deploy presensi-siswa)
- [ ] Akses dashboard Supabase (project yang dipakai presensi-siswa)
- [ ] Akses `kreacy.my.id` (untuk bikin produk lisensi baru)

---

## 1. Vercel — Import project (3 menit)

1. Buka https://vercel.com/new
2. Pilih **Import Git Repository** → cari `pakchoyy/presensi-guru` → klik **Import**
3. **Framework Preset**: biar Vercel auto-detect **Vite** (biasanya langsung kena)
4. **Build Command**: `npm run build` (default sudah benar)
5. **Output Directory**: `dist` (default sudah benar)
6. **Environment Variables** — ini bagian penting. Buka tab baru → masuk ke project `presensi-siswa` di Vercel → Settings → Environment Variables → copy 3 variable berikut (klik mata 👁️ untuk reveal value):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

   Paste ke 3 field di import PresGuru. Target: **Production, Preview, Development** (centang semua).

7. Klik **Deploy** → tunggu ±2 menit sampai hijau.

Deploy pertama akan **sukses** build-wise, tapi fitur sync/clockin belum jalan karena SQL migration belum apply. Lanjut langkah 2.

---

## 2. Supabase — Apply SQL migration (2 menit)

1. Buka Supabase dashboard → project yang sama dengan presensi-siswa
2. **SQL Editor** → **New Query**
3. Buka file `supabase/migrations/00200_presensi_guru.sql` di repo PresGuru (atau di local clone) → copy seluruh isinya
4. Paste ke SQL Editor → **Run**

Yang akan dibuat:
- `ALTER TABLE licenses ADD COLUMN product` (default 'siswa' untuk existing)
- `ALTER TABLE cloud_schools ADD COLUMN lat, lng, radius_meter, jam_masuk_standar, jam_pulang_standar, toleransi_terlambat_menit`
- `CREATE TABLE cloud_guru_teachers`
- `CREATE TABLE cloud_guru_attendance`
- Index + RLS policies

Verifikasi: pergi ke **Table Editor** → cari `cloud_guru_teachers` dan `cloud_guru_attendance` → harus muncul (kosong).

---

## 3. Supabase — Create storage bucket (1 menit)

1. Masih di Supabase dashboard → **Storage** (sidebar kiri)
2. **New bucket** → nama: **`teacher-selfies`** → **Private**: ON → klik **Create**
3. Klik bucket `teacher-selfies` → **Policies** tab → **Create policy**:
   - **Policy name**: `allow service role all`
   - **Policy definition** (SQL):
     ```sql
     ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
     ```
   - **Operations**: centang semua (SELECT, INSERT, UPDATE, DELETE)
   - **Save**

Bucket siap. `api/clockin.js` akan upload selfie ke sini dengan service_role key.

**(Opsional)** Kalau mau foto bisa diakses browser tanpa signed URL (misalnya untuk dashboard admin lihat thumbnail), ganti bucket jadi **Public**. Lebih mudah tapi URL fotonya exposed.

---

## 4. Domain — Hubungkan subdomain (3 menit)

1. Di project PresGuru Vercel → **Settings** → **Domains**
2. Tambah: `presguru.bantuguruyuk.web.id` → **Add**
3. Vercel kasih instruksi DNS record. Biasanya:
   - Type: `CNAME`
   - Name: `presguru`
   - Value: `cname.vercel-dns.com`
4. Buka DNS provider `bantuguruyuk.web.id` (misal Cloudflare / Niagahoster / Rumahweb) → tambah record di atas → **Save**
5. Balik ke Vercel → tunggu ±1 menit → status jadi hijau ✅

---

## 5. Kreacy — Buat produk lisensi (5 menit)

1. Buka https://kreacy.my.id → login akun admin
2. **Produk Baru**:
   - Nama: **Bantu Guru Yuk — Presensi Guru PRO**
   - Harga: **Rp 15.000** / tahun
   - Deskripsi: 1 akun admin kelola unlimited guru, cloud sync multi-device, backup harian, laporan PDF/Excel dengan logo sekolah
   - Setelah bayar: generate kode `BGY-PG-XXXXXXXX` (format sama kayak PS)
3. Copy URL produk (misal: `https://kreacy.my.id/produk/<slug-baru>`)
4. Update di 2 file source code:
   - `src/components/pro/UpgradePage.tsx` baris ~175 (ganti `kreacy.my.id/produk/8nonq6ro` → URL baru)
   - `src/components/pro/PengaturanPage.tsx` baris ~1301 (sama)
5. Push ke GitHub → auto-redeploy

---

## 6. Icon app baru (opsional, bisa nanti)

Sekarang icon masih sama dengan presensi-siswa (`guru-cibisd2.png`). Supaya nggak tertukar di home screen HP:

1. Design icon baru warna navy (bisa pakai Canva / Figma / Midjourney / ChatGPT image gen). Ukuran 512x512 PNG.
2. Save sebagai `public/guru-presguru.png` (overwrite yang placeholder)
3. Push → PWA auto-update icon di HP yang install

---

## 7. Test end-to-end (5 menit)

Sekarang buka `https://presguru.bantuguruyuk.web.id` di HP:

1. **Setup wizard**: nama sekolah + jenjang → nama admin + email → tahun ajaran → lokasi sekolah (tap "Ambil Lokasi Saat Ini", izinkan GPS) + radius 100m + jam masuk 07:00 + toleransi 15 menit
2. **Tambah guru**: menu Guru → tombol **+** → isi nama + NIP → simpan. Sistem auto-generate `absenToken`.
3. **Copy link personal**: di daftar guru, tap guru → tombol **Copy Link** → kirim via WA ke HP guru itu
4. **Simulasi guru absen**: buka link `/g/<token>` di HP guru (atau tab incognito):
   - Nama guru + jam realtime muncul
   - Tap **Datang** → izinkan GPS → kamera depan menyala → tap tombol capture → preview → **Simpan**
   - Status muncul: "Masuk 07:03 — Tepat Waktu ✓" dengan animasi hijau
   - Record masuk ke Supabase `cloud_guru_attendance` ✅
5. **Admin cek**: refresh dashboard → status guru itu jadi "Hadir" (centang hijau), ada thumbnail selfie
6. **Pulang**: sore buka link lagi → tombol otomatis jadi **Pulang** → ulangi flow
7. **Rekap**: menu Rekap → pilih guru + bulan ini → tabel muncul → tombol **Export PDF** / **Excel** → download berhasil
8. **PRO**: menu Pengaturan → section PRO → aktivasi kode `BGY-PG-XXXX` → tier berubah ke PRO, limit guru hilang

---

## 🎯 Done

Kalau 7 langkah di atas semua ✅, PresGuru siap dipromosikan.

Share di grup WA guru pakai copy-text di `UPDATE-GROUP.md` (atau tulis sendiri).

---

## 🐛 Troubleshooting

**Deploy Vercel gagal** → cek Build Logs. Biasanya: env var typo, atau Supabase SQL belum di-apply (api/clockin dan sync akan error 500).

**GPS tidak muncul** → HP guru harus di HTTPS (otomatis dari Vercel) + izinkan Location dari browser settings. Chrome Android: gembok ikon → Permissions → Location → Allow.

**Camera selfie tidak muncul** → sama: HTTPS + Permission Camera → Allow. iOS: wajib pakai Safari (Chrome iOS tidak support getUserMedia pada mode PWA home screen di iOS lama).

**Status FAR muncul tapi guru di sekolah** → GPS Android kadang drift 50-200m. Set radius minimal **150m** untuk toleransi. Atau pakai HP dengan GPS yang akurat (bukan tablet).

**Selfie gagal upload** → cek Supabase Storage bucket `teacher-selfies` ada, policies service_role ada. Juga cek Vercel log `api/clockin` untuk pesan error.
