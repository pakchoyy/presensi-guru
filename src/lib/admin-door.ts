// Pintu admin tersembunyi: ketuk judul 5x dalam 4 detik. Halaman admin ada di Presensi Siswa
// (dipakai bersama), gerbang sebenarnya di server (OTP + email admin).
const taps: number[] = [];
export function tapAdminDoor() {
  const now = Date.now();
  taps.push(now);
  while (taps.length && now - taps[0] > 4000) taps.shift();
  if (taps.length >= 5) {
    taps.length = 0;
    window.location.assign("https://presiswa.bantuguruyuk.web.id/admin?product=guru");
  }
}
