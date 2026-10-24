import { useEffect, useState } from "react";
import { MAIN_SITE_URL } from "@/lib/constants";

type Msg = { text: string; cta: string; url: string };

const site = (path: string) => MAIN_SITE_URL.replace(/\/$/, "") + path;

// Alat lain di bantuguruyuk.web.id (alamat dicek langsung dari situsnya).
const BGY_TOOLS: Msg[] = [
  { text: "Buat soal dengan AI", cta: "Coba gratis →", url: site("/soal") },
  { text: "Prompt LKPD praktis", cta: "Buat LKPD →", url: site("/lkpd") },
  { text: "Modul ajar beres semalam", cta: "Mulai →", url: site("/modul-ajar") },
  { text: "Prompt game interaktif yuk", cta: "Coba →", url: "https://bmedia.bantuguruyuk.web.id/buat" },
  { text: "Katrol nilai dengan mudah", cta: "Coba →", url: site("/katrol-nilai") },
];

const INTERVAL_MS = 4500;

// Strip info alat BGY: di HP duduk di atas navbar (lihat BottomNav), di layar
// lebar di bawah header. Satu pesan bergantian (fade); ketuk badge untuk jeda.
export function Marquee() {
  const messages = BGY_TOOLS;
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % messages.length), INTERVAL_MS);
    return () => clearInterval(t);
  }, [paused, messages.length]);

  const m = messages[idx % messages.length];
  const cls = "ticker-fade flex-1 min-w-0 flex items-center justify-center gap-2 pl-2 pr-3 no-underline h-full";

  return (
    <div className="ticker-wrap">
      <button type="button" className="ticker-badge border-none cursor-pointer" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Lanjutkan info" : "Jeda info"}>
        Info
      </button>
      <a key={idx} href={m.url} target="_blank" rel="noopener noreferrer" className={cls} style={{ color: "#1e293b" }}>
        <span className="truncate font-semibold">{m.text}</span>
        <span className="flex-shrink-0 font-extrabold underline decoration-2">{m.cta}</span>
      </a>
    </div>
  );
}
