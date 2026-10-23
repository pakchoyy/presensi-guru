import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Tier } from "@/types/enums";

// Pengumuman dari admin (api/license?action=announcements). Diambil sekali per sesi;
// yang sudah ditutup disimpan di localStorage. "penting" tampil sebagai pop-up.
type Ann = { id: number; title: string; body: string; target: string; level: string; link_url: string | null; link_label: string | null };

const SEEN_KEY = "bgy_ann_seen";
const ACK_KEY = "bgy_ann_ack"; // pop-up "penting" sudah dibaca → selanjutnya tampil sebagai kartu
let cache: Promise<Ann[]> | null = null;

function fetchAnnouncements(): Promise<Ann[]> {
  if (!cache) {
    cache = fetch("/api/license?action=announcements")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => (Array.isArray(d.items) ? d.items : []))
      .catch(() => []);
  }
  return cache;
}

function readList(key: string): number[] {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}
const readSeen = () => readList(SEEN_KEY);

export function AnnouncementCard() {
  const { teacher } = useApp();
  const realTier = teacher?.tier;
  const [ann, setAnn] = useState<Ann | null>(null);
  const [acked, setAcked] = useState<number[]>(() => readList(ACK_KEY));

  useEffect(() => {
    const group = realTier === Tier.PRO ? "pro" : "free";
    const seen = readSeen();
    fetchAnnouncements().then((items) => {
      setAnn(items.find((a) => (a.target === "all" || a.target === group) && !seen.includes(a.id)) || null);
    });
  }, [realTier]);

  if (!ann) return null;

  const close = () => {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...readSeen(), ann.id].slice(-50))); } catch { /* ignore */ }
    setAnn(null);
  };

  const content = (
    <>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-[#0ea5a0]/15 text-[#0d7a8a]">
          <Megaphone size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[0.88rem] text-[var(--text)] leading-snug">{ann.title}</div>
          {ann.body && <div className="text-[0.8rem] text-[var(--text-light)] leading-relaxed mt-1 whitespace-pre-line">{ann.body}</div>}
        </div>
        <button onClick={close} aria-label="Tutup pengumuman" className="w-9 h-9 -mr-1 -mt-1 flex items-center justify-center rounded-lg text-[var(--text-light)] bg-transparent border-none cursor-pointer flex-shrink-0">
          <X size={18} />
        </button>
      </div>
      {ann.link_url && (
        <a href={ann.link_url} target="_blank" rel="noopener noreferrer" onClick={close}
          className="mt-3 flex items-center justify-center min-h-[42px] rounded-xl text-white font-bold text-[0.82rem] no-underline"
          style={{ background: "linear-gradient(135deg, #0ea5a0, #0d7a8a)" }}>
          {ann.link_label || "Buka"}
        </a>
      )}
    </>
  );

  if (ann.level === "penting" && !acked.includes(ann.id)) {
    const ack = () => {
      const next = [...acked, ann.id].slice(-50);
      try { localStorage.setItem(ACK_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      setAcked(next);
    };
    // Sengaja tidak tertutup lewat ketuk latar: hanya lewat tombol, supaya tidak terlewat sebelum dibaca.
    return (
      <div role="dialog" aria-modal="true" aria-label={ann.title} className="fixed inset-0 z-[650] flex items-center justify-center p-6 bg-black/45 animate-fade-in">
        <div className="w-full max-w-[360px] bg-[var(--card-bg)] rounded-3xl p-5" style={{ boxShadow: "0 20px 50px rgba(0,0,0,.3)" }}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-[#0ea5a0]/15 text-[#0d7a8a]">
              <Megaphone size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[0.95rem] text-[var(--text)] leading-snug">{ann.title}</div>
              {ann.body && <div className="text-[0.85rem] text-[var(--text-light)] leading-relaxed mt-1 whitespace-pre-line">{ann.body}</div>}
            </div>
          </div>
          <button onClick={ack} className="mt-4 w-full min-h-[46px] rounded-xl text-white font-bold text-[0.88rem] border-none cursor-pointer" style={{ background: "linear-gradient(135deg, #0ea5a0, #0d7a8a)" }}>
            Saya mengerti
          </button>
        </div>
      </div>
    );
  }

  return (
    <div role="status" className="mb-3 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-3" style={{ borderLeft: "4px solid #0ea5a0" }}>
      {content}
    </div>
  );
}
