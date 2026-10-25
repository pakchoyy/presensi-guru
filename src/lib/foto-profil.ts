import { useEffect, useState } from "react";

// Foto profil disimpan LOKAL di perangkat ini (belum ke cloud), satu per guru.
const kunci = (id: number) => `bgy_foto_profil_${id}`;
const EVENT = "bgy_foto_profil";

export function getFotoProfil(id?: number | null): string | null {
  try { return id != null ? localStorage.getItem(kunci(id)) : null; } catch { return null; }
}

export function setFotoProfil(id: number, dataUrl: string | null) {
  try {
    if (dataUrl) localStorage.setItem(kunci(id), dataUrl);
    else localStorage.removeItem(kunci(id));
    window.dispatchEvent(new Event(EVENT));
  } catch { /* penyimpanan penuh/diblokir: foto tidak tersimpan */ }
}

export function useFotoProfil(id?: number | null): string | null {
  const [foto, setFoto] = useState(() => getFotoProfil(id));
  useEffect(() => {
    setFoto(getFotoProfil(id));
    const baca = () => setFoto(getFotoProfil(id));
    window.addEventListener(EVENT, baca);
    return () => window.removeEventListener(EVENT, baca);
  }, [id]);
  return foto;
}
