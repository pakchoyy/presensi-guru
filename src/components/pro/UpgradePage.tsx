import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { PRO_PRICE, PLUS_PRICE, KREACY_PLUS_URL, KREACY_PRO_URL, LICENSE_DURATION_DAYS, DAY_MS } from "@/lib/constants";
import { isPro, asTier, isOnTrial, trialDaysRemaining } from "@/lib/features";
import { licenseService } from "@/services/license.service";
import { licenseRepo } from "@/repositories/dexie/license.repo";
import { syncService } from "@/services/sync.service";
import type { License } from "@/types/entities";
import { Check, MessageCircle, Crown, ShieldCheck, Mail, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/components/shared/Toast";
import { teacherRepo } from "@/repositories/dexie/teacher.repo";
import { generateId } from "@/lib/utils";
// react-confetti dropped untuk mengurangi deps — kalau mau nyalakan lagi, re-install
const Confetti: React.FC<any> = () => null;
import { PageName, Tier } from "@/types/enums";

const COMPARE_ROWS: [string, string, string, string][] = [
  ["Jumlah guru", "5", "10", "∞"],
  ["Peta lokasi absen", "—", "—", "✓"],
  ["HP admin (cloud)", "—", "1", "3"],
  ["Absen GPS + selfie", "✓", "✓", "✓"],
  ["Rekap & pengingat", "✓", "✓", "✓"],
  ["Kepala Sekolah verifikasi izin", "—", "—", "✓"],
  ["Logo sekolah di laporan", "—", "—", "✓"],
  ["Program Affiliate", "—", "—", "✓"],
  ["Bebas iklan", "—", "—", "✓"],
];

export function UpgradePage() {
  const { teacher, refreshTeacher, setActivePage } = useApp();
  const { toast } = useToast();
  const isPRO = isPro(teacher?.tier);

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const validateEmail = (email: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setEmailError("Email tidak boleh kosong");
      return false;
    }
    if (!regex.test(email)) {
      setEmailError("Format email tidak valid");
      return false;
    }
    setEmailError("");
    return true;
  };

  const handleWA = () => {
    const msg = encodeURIComponent(
      "Halo Pak Choyy, saya mau beli lisensi PRO Presensi Yuk | Guru\nEmail: " + (teacher?.email || email || "")
    );
    window.open(`https://wa.me/6289530713597?text=${msg}`, "_blank");
  };

  const handleCheckEmail = async () => {
    setErrorMessage("");

    if (!validateEmail(email)) {
      return;
    }

    if (!teacher) {
      setErrorMessage("Data guru tidak ditemukan");
      return;
    }

    setChecking(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      const lookup = await licenseService.lookupByEmail(normalizedEmail);
      const licenseData = lookup.found ? { tanggal_berakhir: lookup.tanggalBerakhir } : null;
      const tier = asTier(lookup.tier);

      if (licenseData) {
        const now = Date.now();
        const expiry = licenseData.tanggal_berakhir || (now + LICENSE_DURATION_DAYS * DAY_MS);
        const license: License = {
          id: generateId(),
          guruId: teacher.id,
          emailAktivasi: normalizedEmail,
          kodeLisensi: "EMAIL-VERIFIED",
          tanggalAktivasi: now,
          tanggalBerakhir: expiry,
          statusLisensi: "Aktif",
        };
        await licenseRepo.save(license);

        await teacherRepo.update(teacher.id, {
          ...teacher,
          tier,
          email: normalizedEmail,
        });

        await refreshTeacher();

        localStorage.setItem("presensi_cloud_email", normalizedEmail);

        toast(`✅ Email terverifikasi! Kamu sekarang ${tier} 🎉`);
        setErrorMessage("");
        setShowConfetti(true);

        // Trigger initial upload to cloud
        syncService.initialUpload(normalizedEmail).catch(() => {});

        // Reload after confetti to activate cloud sync
        setTimeout(() => {
          setShowConfetti(false);
          window.location.reload();
        }, 3000);
      } else {
        setErrorMessage("Email belum terdaftar sebagai PLUS/PRO. Silakan hubungi admin via WhatsApp.");
      }
    } catch (error) {
      console.error("Check email error:", error);
      setErrorMessage("Gagal mengecek email. Periksa koneksi internet dan coba lagi.");
    } finally {
      setChecking(false);
    }
  };

  const tier = isPro(teacher?.tier) ? Tier.PRO : teacher?.tier === Tier.PLUS ? Tier.PLUS : Tier.FREE;

  if (isPRO) {
    return (
      <div className="flex-1 px-[14px] pt-[14px] pb-[calc(130px+var(--ticker-h,0px))] lg:pb-4">
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] text-center">
          <div className="text-[2rem] mb-2">👑</div>
          <div className="text-[0.9rem] font-bold text-[#f59e0b] mb-1">Kamu sudah PRO!</div>
          <p className="text-[0.75rem] text-[var(--text-light)]">
            Semua fitur premium sudah terbuka. Buka <b>Pengaturan</b> untuk info lisensi.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 px-[14px] pt-[14px] pb-[calc(130px+var(--ticker-h,0px))] lg:pb-4">
      {/* Hero */}
      <div className="rounded-2xl p-5 mb-3 text-white" style={{ background: "var(--grad)" }}>
        <h2 className="text-[1.35rem] font-extrabold leading-tight mb-1">Pilih paket yang pas buat sekolahmu</h2>
        <p className="text-[0.78rem] opacity-85 leading-relaxed mb-3">Bayar per semester (6 bulan). Tidak ada tagihan otomatis.</p>
        <div className="inline-flex items-center gap-[6px] px-[10px] py-[5px] rounded-full text-[0.72rem] font-bold border border-white/30 bg-white/15">
          Kamu sekarang: {tier}
          {isOnTrial(teacher?.tier) && <span className="opacity-80">· Coba PRO {trialDaysRemaining()} hari lagi</span>}
        </div>
      </div>

      {/* Tabel pembanding */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl mb-3 overflow-hidden">
        <table className="w-full text-[0.7rem] text-[var(--text)]">
          <thead>
            <tr className="bg-[var(--input-bg)]">
              <th className="text-left font-bold px-3 py-2">Fitur</th>
              <th className="font-bold px-1 py-2 text-[#64748b]">FREE</th>
              <th className="font-bold px-1 py-2 text-[#2563eb]">PLUS</th>
              <th className="font-bold px-1 py-2 text-[#d97706]">PRO</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map(([label, f, p, r]) => (
              <tr key={label} className="border-t border-[var(--border)]">
                <td className="px-3 py-[6px] text-[var(--text-light)]">{label}</td>
                <td className="text-center px-1">{f}</td>
                <td className="text-center px-1">{p}</td>
                <td className="text-center px-1 font-semibold">{r}</td>
              </tr>
            ))}
            <tr className="border-t border-[var(--border)] bg-[var(--input-bg)]">
              <td className="px-3 py-[6px] font-bold">Harga / semester</td>
              <td className="text-center px-1">Gratis</td>
              <td className="text-center px-1">{PLUS_PRICE.replace("/semester", "")}</td>
              <td className="text-center px-1 font-bold">{PRO_PRICE.replace("/semester", "")}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <TierCard
        name="FREE"
        tagline="Gratis selamanya — 30 hari pertama coba PRO"
        price={null}
        bullets={["Maks 5 guru", "Absen GPS + selfie", "Rekap & pengingat"]}
        accentColor="#64748b"
        isCurrent={tier === Tier.FREE}
        muted={tier !== Tier.FREE}
        cta={null}
      />
      <TierCard
        name="PLUS"
        tagline="Buat sekolah kecil"
        price={PLUS_PRICE}
        perMonth="cuma ±Rp4.500/bulan"
        bullets={["Maks 10 guru", "1 HP admin (data aman di cloud)", "Absen GPS + selfie", "Rekap & pengingat"]}
        accentColor="#2563eb"
        isCurrent={tier === Tier.PLUS}
        muted={false}
        cta={tier === Tier.PLUS
          ? { label: "Sedang Dipakai ✓", href: null, disabled: true, color: "#2563eb" }
          : { label: `Beli PLUS ${PLUS_PRICE.replace("/semester", "")}`, href: KREACY_PLUS_URL, disabled: false, color: "#2563eb" }}
      />
      <TierCard
        name="PRO"
        tagline="Semua di PLUS, plus:"
        price={PRO_PRICE}
        perMonth="cuma ±Rp8.500/bulan"
        bullets={["Guru tanpa batas", "3 HP admin", "Peta lokasi absen", "Kepala Sekolah verifikasi izin", "Logo sekolah di laporan", "Program Affiliate", "Bebas iklan"]}
        accentColor="#f59e0b"
        isCurrent={false}
        muted={false}
        recommended
        cta={{ label: `Beli PRO ${PRO_PRICE.replace("/semester", "")}`, href: KREACY_PRO_URL, disabled: false, color: "#f59e0b" }}
        showCrown
      />

      <div className="rounded-xl p-4 mb-3 border border-[#f59e0b]/40 bg-[rgba(245,158,11,0.08)]">
        <div className="text-[0.9rem] font-extrabold text-[var(--text)] mb-1">
          Cuma ±Rp8.500 sebulan untuk semua guru tanpa batas.
        </div>
        <p className="text-[0.74rem] text-[var(--text-light)] leading-relaxed">
          Absen guru tercatat rapi dengan GPS + selfie, izin disetujui Kepala Sekolah dari HP, dan data aman di cloud
          (tidak hilang kalau HP rusak). Bayar sekali per semester.
        </p>
      </div>

      <div className="flex items-start gap-2 bg-[var(--input-bg)] rounded-xl p-3 mb-3 text-[0.7rem] text-[var(--text-light)] leading-relaxed">
        <ShieldCheck size={15} className="text-[#2563eb] flex-shrink-0 mt-[1px]" />
        <div>Pembayaran satu kali per semester, tidak auto-renew.</div>
      </div>

      <button
        onClick={handleWA}
        className="w-full mb-3 flex items-center justify-center gap-2 py-3 rounded-xl border border-[var(--border)] text-[var(--text)] font-bold text-[0.85rem] bg-[var(--card-bg)] cursor-pointer"
      >
        <MessageCircle size={16} /> Tanya dulu via WhatsApp
      </button>

      <div className="bg-[rgba(14,165,160,0.08)] border-2 border-[#2563eb] rounded-xl p-4 mb-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-10 h-10 rounded-full bg-[#2563eb] flex items-center justify-center">
            <Mail size={20} className="text-white" />
          </div>
          <div>
            <div className="text-[0.9rem] font-extrabold text-[var(--text)]">
              Sudah beli PLUS/PRO?
            </div>
            <div className="text-[0.7rem] text-[var(--text-light)]">
              Verifikasi email untuk aktivasi
            </div>
          </div>
        </div>
        
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailError("");
            setErrorMessage("");
          }}
          placeholder="email@example.com"
          className={`w-full px-4 py-3 rounded-lg border-2 bg-white text-[0.85rem] mb-1 outline-none ${
            emailError ? "border-red-500" : "border-[#2563eb]/30 focus:border-[#2563eb]"
          }`}
        />
        
        {emailError && (
          <p className="text-[0.7rem] text-red-500 mb-2">{emailError}</p>
        )}
        
        <button
          onClick={handleCheckEmail}
          disabled={checking}
          className="w-full py-3 rounded-lg font-bold text-[0.9rem] text-white border-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mt-2"
          style={{ background: checking ? "#999" : "linear-gradient(135deg,#3b82f6,#2563eb)" }}
        >
          {checking && <Loader2 size={16} className="animate-spin" />}
          {checking ? "Mengecek Email..." : "✅ Verifikasi Email"}
        </button>
        
        {errorMessage && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-[0.75rem] text-red-600 dark:text-red-400 mb-2">
              {errorMessage}
            </p>
            <button
              onClick={handleWA}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-[0.75rem] font-bold transition-colors cursor-pointer border-none"
            >
              <MessageCircle size={14} />
              Hubungi Admin via WhatsApp
            </button>
          </div>
        )}
      </div>

      {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={500}
        />
      )}
    </div>
  );
}

interface CTA {
  label: string;
  href: string | null;
  disabled: boolean;
  color: string;
}

function TierCard(props: {
  name: string;
  tagline: string;
  price: string | null;
  perMonth?: string;
  bullets: string[];
  accentColor: string;
  isCurrent: boolean;
  muted: boolean;
  recommended?: boolean;
  cta: CTA | null;
  showCrown?: boolean;
}) {
  const { name, tagline, price, perMonth, bullets, accentColor, isCurrent, muted, recommended, cta, showCrown } = props;
  return (
    <div
      className="relative rounded-2xl p-4 mb-3"
      style={{
        background: "var(--card-bg)",
        border: recommended ? `2px solid ${accentColor}` : "1px solid var(--border)",
        opacity: muted ? 0.6 : 1,
        boxShadow: recommended ? `0 4px 20px ${accentColor}30` : "none",
      }}
    >
      {(recommended || isCurrent) && (
        <div
          className="absolute -top-[11px] left-4 flex items-center gap-[4px] px-[10px] py-[3px] rounded-full text-[0.65rem] font-extrabold text-white"
          style={{ background: recommended ? `linear-gradient(135deg, ${accentColor}, #d97706)` : accentColor }}
        >
          {recommended ? <><Sparkles size={11} /> Rekomendasi</> : "Paket Kamu"}
        </div>
      )}
      <div className="flex items-center gap-2 mb-1">
        {showCrown && <Crown size={16} style={{ color: accentColor }} />}
        <div className="text-[1.1rem] font-extrabold" style={{ color: accentColor }}>{name}</div>
      </div>
      <p className="text-[0.74rem] text-[var(--text-light)] mb-3 leading-snug">{tagline}</p>
      {price && (
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-[1.75rem] font-extrabold text-[var(--text)]">{price.split("/")[0]}</span>
          <span className="text-[0.78rem] text-[var(--text-light)]">/semester</span>
        </div>
      )}
      {perMonth && <p className="text-[0.7rem] font-bold mb-3" style={{ color: accentColor }}>{perMonth}</p>}
      {!price && <div className="mb-3" />}
      <ul className="space-y-[7px] mb-4">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-[0.78rem] text-[var(--text)] leading-snug">
            <Check size={15} className="flex-shrink-0 mt-[2px]" style={{ color: accentColor }} />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      {cta && (cta.disabled ? (
        <button disabled className="w-full py-[11px] rounded-xl font-bold text-[0.85rem] border-[1.5px] cursor-not-allowed opacity-70"
          style={{ borderColor: cta.color, color: cta.color, background: "transparent" }}>
          {cta.label}
        </button>
      ) : (
        <a href={cta.href!} target="_blank" rel="noopener noreferrer"
          className="block w-full text-center py-[11px] rounded-xl font-bold text-[0.85rem] text-white no-underline"
          style={{ background: `linear-gradient(135deg, ${cta.color}, ${cta.color}dd)` }}>
          {cta.label}
        </a>
      ))}
    </div>
  );
}
