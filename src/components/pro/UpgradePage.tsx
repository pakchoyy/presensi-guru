import { useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { PRO_PRICE } from "@/lib/constants";
import { licenseService } from "@/services/license.service";
import { licenseRepo } from "@/repositories/dexie/license.repo";
import { syncService } from "@/services/sync.service";
import type { License } from "@/types/entities";
import { ArrowUpCircle, Check, MessageCircle, Crown, ShieldCheck, Mail, Loader2 } from "lucide-react";
import { useToast } from "@/components/shared/Toast";
import { teacherRepo } from "@/repositories/dexie/teacher.repo";
import { Tier } from "@/types/enums";
import { generateId } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
// react-confetti dropped untuk mengurangi deps — kalau mau nyalakan lagi, re-install
const Confetti: React.FC<any> = () => null;
import { PageName } from "@/types/enums";

export function UpgradePage() {
  const { teacher, refreshTeacher, setActivePage } = useApp();
  const { toast } = useToast();
  const isPRO = teacher?.tier === "PRO";
  const manfaat = licenseService.getManfaat();

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

      if (licenseData) {
        const now = Date.now();
        const expiry = licenseData.tanggal_berakhir || (now + 365 * 24 * 60 * 60 * 1000);
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
          tier: Tier.PRO,
          email: normalizedEmail,
        });

        await refreshTeacher();

        localStorage.setItem("presensi_cloud_email", normalizedEmail);

        toast("✅ Email terverifikasi! Kamu sekarang PRO 🎉");
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
        const { data: profile } = await supabase
          .from("profiles")
          .select("tier")
          .eq("email", normalizedEmail)
          .maybeSingle();

        if (profile && profile.tier === "PRO") {
          const now = Date.now();
          const license: License = {
            id: generateId(),
            guruId: teacher.id,
            emailAktivasi: normalizedEmail,
            kodeLisensi: "EMAIL-VERIFIED",
            tanggalAktivasi: now,
            tanggalBerakhir: now + 365 * 24 * 60 * 60 * 1000,
            statusLisensi: "Aktif",
          };
          await licenseRepo.save(license);
          await teacherRepo.update(teacher.id, { ...teacher, tier: Tier.PRO, email: normalizedEmail });
          await refreshTeacher();

          localStorage.setItem("presensi_cloud_email", normalizedEmail);

          toast("✅ Email terverifikasi! Kamu sekarang PRO 🎉");
          setShowConfetti(true);

          syncService.initialUpload(normalizedEmail).catch(() => {});

          setTimeout(() => {
            setShowConfetti(false);
            window.location.reload();
          }, 3000);
        } else {
          setErrorMessage("Email belum terdaftar sebagai PRO. Silakan hubungi admin via WhatsApp.");
        }
      }
    } catch (error) {
      console.error("Check email error:", error);
      setErrorMessage("Gagal mengecek email. Periksa koneksi internet dan coba lagi.");
    } finally {
      setChecking(false);
    }
  };

  if (isPRO) {
    return (
      <div className="flex-1 px-[14px] pt-[14px] pb-[130px] lg:pb-4">
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
    <div className="flex-1 px-[14px] pt-[14px] pb-[130px] lg:pb-4">
      <div className="bg-gradient-to-br from-[#2563eb] to-[#1e40af] rounded-2xl p-6 mb-3 text-white text-center">
        <ArrowUpCircle size={48} className="mx-auto mb-3 opacity-90" />
        <h2 className="text-[1.3rem] font-extrabold mb-2">Upgrade ke PRO</h2>
        <p className="text-[0.85rem] opacity-90 mb-3">
          Semua fitur premium, selamanya
        </p>
        <div className="text-[2.5rem] font-extrabold mb-4">{PRO_PRICE}</div>
        <a
          href="https://kreacy.my.id/produk/8nonq6ro"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block w-full max-w-[280px] py-3 rounded-xl bg-white text-[#2563eb] font-extrabold text-[0.95rem] no-underline hover:bg-white/90 transition-all"
        >
          🛒 Beli Sekarang
        </a>
        <button
          onClick={handleWA}
          className="w-full max-w-[280px] mt-2 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-white/30 text-white font-bold text-[0.85rem] hover:bg-white/10 transition-all bg-transparent cursor-pointer mx-auto"
        >
          <MessageCircle size={16} />
          <span>Atau Chat WhatsApp</span>
        </button>
      </div>

      <div className="bg-[rgba(14,165,160,0.08)] border-2 border-[#2563eb] rounded-xl p-4 mb-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-10 h-10 rounded-full bg-[#2563eb] flex items-center justify-center">
            <Mail size={20} className="text-white" />
          </div>
          <div>
            <div className="text-[0.9rem] font-extrabold text-[var(--text)]">
              Sudah Beli PRO?
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

      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-4 mb-3">
        <div className="text-[0.85rem] font-bold mb-3 flex items-center gap-2">
          <Crown size={16} className="text-[#f59e0b]" />
          Fitur PRO
        </div>
        
        <div className="space-y-2">
          {manfaat.map((m, i) => (
            <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-[var(--input-bg)] transition-colors">
              <div className="w-6 h-6 rounded-full bg-[#16a34a]/10 flex items-center justify-center flex-shrink-0 mt-[1px]">
                <Check size={14} className="text-[#16a34a]" />
              </div>
              <span className="text-[0.78rem] text-[var(--text)] leading-relaxed">{m}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px]">
        <div className="text-[0.78rem] font-bold flex items-center gap-[6px] mb-2">
          <ShieldCheck size={14} className="text-[#2563eb]" /> Perbandingan
        </div>
        <div className="grid grid-cols-2 gap-2 text-[0.7rem]">
          <div className="bg-[var(--input-bg)] rounded-lg p-2">
            <div className="font-bold mb-1">FREE</div>
            <div className="text-[var(--text-light)] leading-[1.6]">
              • 1 kelas<br />• 12 siswa<br />• Offline<br />• Rekap & export
            </div>
          </div>
          <div className="bg-[rgba(14,165,160,0.06)] rounded-lg p-2 border border-[#2563eb]/20">
            <div className="font-bold text-[#2563eb] mb-1">PRO</div>
            <div className="text-[var(--text-light)] leading-[1.6]">
              • Unlimited kelas<br />• Unlimited siswa<br />• Cloud sync<br />• Multi device
            </div>
          </div>
        </div>
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
