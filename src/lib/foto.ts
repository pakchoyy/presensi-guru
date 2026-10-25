/** Kecilkan foto (kamera/galeri) jadi data URL JPEG: sisi terpanjang ≤ maks px, hemat penyimpanan & kuota. */
export function kompresFoto(file: File, maks = 800, kualitas = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const skala = Math.min(1, maks / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * skala);
      c.height = Math.round(img.height * skala);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", kualitas));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Foto tidak bisa dibaca")); };
    img.src = url;
  });
}
