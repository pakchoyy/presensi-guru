import { MAIN_SITE_URL } from "@/lib/constants";

const MESSAGES = [
  "Mau buat soal dalam lima menit?",
  "Butuh prompt LKPD menarik?",
  "Mau buat modul kokurikuler hitungan menit?",
  "Yuk cobain semuanya di ",
];

export function Marquee() {
  const duplicated = [...MESSAGES, ...MESSAGES];

  return (
    <div className="ticker-wrap w-full">
      <div className="ticker-badge">INFO</div>
      <div className="ticker-track">
        <div className="ticker-content">
          {duplicated.map((msg, i) => (
            <span key={i} className="ticker-msg inline-flex items-center leading-none">
              {msg}
              {msg.includes("Yuk cobain") && (
                <a
                  href={MAIN_SITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline decoration-2 hover:decoration-[3px] transition-all inline-flex items-center leading-none"
                  style={{ color: '#1e293b' }}
                >
                  bantuguruyuk.web.id
                </a>
              )}
              {msg.includes("Yuk cobain") && " ✨"}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
