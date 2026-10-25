import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/components/shared/Toast";
import { OtpVerify } from "@/components/auth/OtpVerify";
import { licenseService, type AffiliateDashboard, type AffiliateInfo } from "@/services/license.service";
import { cloudLoginService } from "@/services/cloud-login.service";
import { PageName, Tier } from "@/types/enums";
import { Gift, Copy, Share2, Lock, Wallet, Users, CalendarPlus, Coins, ShieldCheck, Mail, Loader2, X } from "lucide-react";

const APP_URL = "https://preguru.bantuguruyuk.web.id";
import { WA_ADMIN } from "@/lib/constants";
const DEFAULT_INFO: AffiliateInfo = {
  rewards: { PLUS: { commission: 1000, days: 12 }, PRO: { commission: 2500, days: 30 }, GURU_PLUS: { commission: 1500, days: 12 }, GURU_PRO: { commission: 3000, days: 30 } },
  minWithdraw: 20000,
  capPerSemester: 6,
};
const rp = (n: number) => "Rp" + n.toLocaleString("id-ID");
const tgl = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

export function AffiliatePage() {
  const { teacher, setActivePage } = useApp();
  const { toast } = useToast();
  const isPro = teacher?.tier === Tier.PRO;
  const [info, setInfo] = useState<AffiliateInfo>(DEFAULT_INFO);
  const [dash, setDash] = useState<AffiliateDashboard | null>(null);
  const [state, setState] = useState<"loading" | "need_verify" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [otp, setOtp] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  useEffect(() => {
    licenseService.getAffiliateInfo().then((i) => i && setInfo(i));
  }, []);

  const load = useCallback(async () => {
    if (!isPro) return;
    setState("loading");
    if (!(await cloudLoginService.verifiedEmail())) {
      setState("need_verify");
      return;
    }
    const res = await licenseService.getAffiliate();
    if (res.ok) {
      setDash(res.data);
      setInfo(res.data);
      setState("ready");
    } else if (res.code === "NO_SESSION") {
      setState("need_verify");
    } else {
      setError(res.error);
      setState("error");
    }
  }, [isPro]);

  useEffect(() => { load(); }, [load]);

  const link = dash ? `${APP_URL}/?ref=${dash.code}` : "";
  const pesan = dash
    ? `Saya pakai Presensi Yuk buat presensi guru, praktis banget. Coba gratis 30 hari: ${link}\nKalau upgrade, masukkan kode *${dash.code}* saat aktivasi ya.`
    : "";

  const g = { plus: info.rewards.GURU_PLUS ?? DEFAULT_INFO.rewards.GURU_PLUS!, pro: info.rewards.GURU_PRO ?? DEFAULT_INFO.rewards.GURU_PRO! };
  const steps = [
    "Berlangganan PRO, lalu buka halaman ini dan verifikasi email.",
    "Salin kode affiliate kamu atau bagikan lewat WhatsApp.",
    "Sekolah atau guru baru membeli PLUS/PRO dan memasukkan kodemu saat aktivasi, membuka link ajakanmu, atau mengisinya di Pengaturan paling lambat 7 hari setelah aktivasi.",
    `Kamu langsung dapat komisi + bonus masa aktif PRO. Pembeli PLUS: ${rp(g.plus.commission)} + ${g.plus.days} hari · Pembeli PRO: ${rp(g.pro.commission)} + ${g.pro.days} hari.`,
    `Saldo minimal ${rp(info.minWithdraw)} bisa ditarik. Tekan Tarik Dana, lalu admin memproses transfer lewat WhatsApp.`,
  ];

  return (
    <div className="flex-1 px-[14px] pt-[14px] pb-[calc(100px+var(--ticker-h,0px))] lg:pb-4">
      {/* Hero */}
      <div className="rounded-2xl p-4 mb-3 text-white" style={{ background: "linear-gradient(135deg, #0ea5a0, #0d7a8a 60%, #2d6a7f)" }}>
        <div className="flex items-center gap-2 text-[0.72rem] font-bold uppercase tracking-wider opacity-90">
          <Gift size={14} /> Program Affiliate
          <span className="ml-auto px-2 py-[2px] rounded-full bg-[#fbbf24] text-[#1e293b] text-[0.62rem]">KHUSUS PRO</span>
        </div>
        <div className="text-[1.15rem] font-extrabold leading-snug mt-2">Ajak guru lain pakai Presensi Yuk, dapat komisi & bonus masa aktif</div>
      </div>

      {/* Benefit */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Benefit icon={<Coins size={18} />} title={`${rp(g.plus.commission)} + ${g.plus.days} hari`} sub="tiap pembeli PLUS" />
        <Benefit icon={<CalendarPlus size={18} />} title={`${rp(g.pro.commission)} + ${g.pro.days} hari`} sub="tiap pembeli PRO" />
        <Benefit icon={<Wallet size={18} />} title={`Min. ${rp(info.minWithdraw)}`} sub="saldo bisa ditarik" />
        <Benefit icon={<Users size={18} />} title={`${info.capPerSemester}× / semester`} sub="maks. bonus per semester" />
      </div>
      <p className="text-[0.74rem] text-[var(--text-light)] -mt-1 mb-3">
        Kode & saldo yang sama juga berlaku di <b>Presensi Yuk | Siswa</b>: pembeli PLUS {rp(info.rewards.PLUS.commission)} + {info.rewards.PLUS.days} hari · PRO {rp(info.rewards.PRO.commission)} + {info.rewards.PRO.days} hari.
      </p>

      {/* Cara kerja */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
        <div className="text-[0.85rem] font-bold mb-2">Cara kerja</div>
        <ol className="m-0 p-0 list-none space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-2 text-[0.78rem] text-[var(--text)] leading-snug">
              <span className="w-5 h-5 flex-shrink-0 rounded-full bg-[#0ea5a0] text-white text-[0.65rem] font-bold flex items-center justify-center">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <p className="text-[0.68rem] text-[var(--text-light)] mt-3 mb-0">
          Komisi hanya untuk pembeli baru (belum pernah punya lisensi), tidak berlaku untuk diri sendiri, dan satu pembeli dihitung sekali.
        </p>
      </div>

      {/* Dashboard */}
      {!isPro ? (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[#f59e0b]/40 p-4 mb-3 text-center">
          <div className="w-11 h-11 mx-auto rounded-full bg-[#f59e0b]/15 text-[#d97706] flex items-center justify-center mb-2"><Lock size={20} /></div>
          <div className="text-[0.92rem] font-extrabold text-[var(--text)]">Khusus pelanggan PRO</div>
          <p className="text-[0.76rem] text-[var(--text-light)] mt-1 mb-3">Upgrade ke PRO untuk mendapat kode affiliate, komisi, dan bonus masa aktif. PRO juga bebas iklan.</p>
          <button onClick={() => setActivePage(PageName.UPGRADE)} className="w-full min-h-[46px] rounded-xl text-white font-bold text-[0.85rem] border-none cursor-pointer" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
            Lihat paket PRO
          </button>
        </div>
      ) : state === "loading" ? (
        <div className="h-40 rounded-xl bg-[var(--card-bg)] border border-[var(--border)] flex items-center justify-center text-[var(--text-light)]"><Loader2 className="animate-spin" size={20} /></div>
      ) : state === "need_verify" ? (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-4 mb-3 text-center">
          <div className="w-11 h-11 mx-auto rounded-full bg-[#0ea5a0]/15 text-[#0ea5a0] flex items-center justify-center mb-2"><ShieldCheck size={20} /></div>
          <div className="text-[0.9rem] font-extrabold text-[var(--text)]">Verifikasi email dulu</div>
          <p className="text-[0.76rem] text-[var(--text-light)] mt-1 mb-3">Supaya komisi tercatat atas namamu, masukkan kode yang dikirim ke email langgananmu.</p>
          <button onClick={() => setOtp(true)} className="w-full min-h-[46px] flex items-center justify-center gap-2 rounded-xl text-white font-bold text-[0.85rem] border-none cursor-pointer" style={{ background: "linear-gradient(135deg, #0ea5a0, #0d7a8a)" }}>
            <Mail size={16} /> Verifikasi email
          </button>
        </div>
      ) : state === "error" ? (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-4 mb-3 text-center text-[0.8rem] text-[var(--text-light)]">
          {error}
          <button onClick={load} className="block mx-auto mt-2 text-[#0ea5a0] font-bold bg-transparent border-none cursor-pointer">Coba lagi</button>
        </div>
      ) : dash && (
        <>
          {/* Kode */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
            <div className="text-[0.75rem] font-semibold text-[var(--text-light)] mb-2">Kode affiliate kamu</div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 font-mono font-extrabold tracking-[3px] text-[1.15rem] text-center py-[10px] rounded-lg bg-[var(--input-bg)] border border-dashed border-[var(--border)] text-[var(--text)]">
                {dash.code}
              </div>
              <button
                onClick={() => navigator.clipboard?.writeText(dash.code).then(() => toast("Kode disalin"))}
                aria-label="Salin kode"
                className="w-12 h-12 flex items-center justify-center rounded-lg border border-[var(--border)] bg-transparent text-[var(--text)] cursor-pointer"
              >
                <Copy size={17} />
              </button>
            </div>
            <button
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(pesan)}`, "_blank", "noopener")}
              className="w-full flex items-center justify-center gap-2 min-h-[46px] rounded-xl border-none text-white font-bold text-[0.85rem] cursor-pointer"
              style={{ background: "#16a34a" }}
            >
              <Share2 size={16} /> Bagikan lewat WhatsApp
            </button>
          </div>

          {/* Saldo */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
            <div className="grid grid-cols-3 gap-2 mb-3 text-center">
              <Stat label="Total komisi" value={rp(dash.earned)} />
              <Stat label="Pengguna" value={`${dash.referrals.length} orang`} />
              <Stat label="Bonus hari" value={`+${dash.referrals.reduce((n, r) => n + (r.days || 0), 0)} hari`} />
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[0.72rem] text-[var(--text-light)]">Saldo komisi</div>
                <div className="text-[1.5rem] font-extrabold text-[var(--text)] leading-tight">{rp(dash.saldo)}</div>
              </div>
              <div className="text-right text-[0.7rem] text-[var(--text-light)] leading-relaxed">
                <div>Total dicairkan <b className="text-[var(--text)]">{rp(dash.withdrawn)}</b></div>
                {dash.pending > 0 && <div>Diproses <b className="text-[#d97706]">{rp(dash.pending)}</b></div>}
              </div>
            </div>
            <div className="mt-3 h-[10px] rounded-full bg-[var(--input-bg)] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={dash.minWithdraw} aria-valuenow={Math.min(dash.saldo, dash.minWithdraw)}>
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, dash.minWithdraw ? (dash.saldo / dash.minWithdraw) * 100 : 100)}%`, background: "linear-gradient(90deg, #fbbf24, #f59e0b)" }} />
            </div>
            <div className="text-[0.7rem] text-[var(--text-light)] mt-1">
              {dash.saldo >= dash.minWithdraw
                ? "Saldo sudah bisa ditarik."
                : `${rp(dash.minWithdraw - dash.saldo)} lagi untuk bisa ditarik (min. ${rp(dash.minWithdraw)}).`}
            </div>
            <button
              onClick={() => setShowWithdraw(true)}
              disabled={dash.saldo < dash.minWithdraw || dash.saldo <= 0 || dash.hasPending}
              className="w-full mt-3 min-h-[46px] flex items-center justify-center gap-2 rounded-xl text-white font-bold text-[0.85rem] border-none cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
            >
              <Wallet size={16} /> {dash.hasPending ? "Penarikan sedang diproses" : "Tarik Dana"}
            </button>
          </div>

          {/* Pengguna */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-[14px] mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[0.85rem] font-bold">Pengguna dengan kodemu</div>
              <div className="text-[0.72rem] text-[var(--text-light)]">{dash.referrals.length} orang</div>
            </div>
            <div className="text-[0.68rem] text-[var(--text-light)] mb-2">Bonus semester ini: {dash.rewardsThisSemester} / {dash.capPerSemester}</div>
            {dash.referrals.length === 0 ? (
              <p className="text-[0.76rem] text-[var(--text-light)] m-0 py-3 text-center">Belum ada. Bagikan kodemu ke grup guru.</p>
            ) : (
              <ul className="m-0 p-0 list-none divide-y divide-[var(--border)]">
                {dash.referrals.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 py-[9px] text-[0.78rem]">
                    <span className="min-w-0">
                      <span className="block text-[var(--text)] font-medium truncate">{r.email}</span>
                      <span className="flex items-center gap-2 text-[var(--text-light)] text-[0.68rem]">
                        {r.tier && <span className="px-[6px] py-[1px] rounded-full bg-[#0ea5a0]/12 text-[#0ea5a0] font-bold">{r.product === "guru" ? "" : "Siswa "}{r.tier}</span>}
                        {tgl(r.at)}
                      </span>
                    </span>
                    <span className="flex-shrink-0 text-right leading-tight">
                      <span className="block font-extrabold text-[#16a34a]">+{rp(r.amount || 0)}</span>
                      <span className="text-[0.68rem] text-[var(--text-light)]">+{r.days || 0} hari</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {otp && (
        <OtpVerify
          email={teacher?.email || ""}
          title="Verifikasi email"
          onConnected={() => { setOtp(false); load(); }}
          onClose={() => setOtp(false)}
        />
      )}
      {showWithdraw && dash && (
        <WithdrawSheet
          dash={dash}
          defaultName={teacher?.nama || ""}
          onClose={() => setShowWithdraw(false)}
          onDone={() => { setShowWithdraw(false); load(); }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--input-bg)] px-1 py-2">
      <div className="text-[0.85rem] font-extrabold text-[var(--text)] leading-tight">{value}</div>
      <div className="text-[0.62rem] text-[var(--text-light)] mt-[2px]">{label}</div>
    </div>
  );
}

function Benefit({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-3">
      <div className="w-8 h-8 rounded-lg bg-[#f59e0b]/15 text-[#d97706] flex items-center justify-center mb-2">{icon}</div>
      <div className="text-[0.92rem] font-extrabold text-[var(--text)] leading-tight">{title}</div>
      <div className="text-[0.68rem] text-[var(--text-light)] leading-snug mt-[2px]">{sub}</div>
    </div>
  );
}

function WithdrawSheet({ dash, defaultName, onClose, onDone }: { dash: AffiliateDashboard; defaultName: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [nama, setNama] = useState(defaultName);
  const [tujuan, setTujuan] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (nama.trim().length < 2 || tujuan.trim().length < 5) {
      setError("Isi nama dan tujuan transfer, contoh: DANA 0812xxxx atau BRI 1234xxxx a.n. Nama");
      return;
    }
    setBusy(true);
    setError("");
    const res = await licenseService.requestWithdraw(nama.trim(), tujuan.trim());
    setBusy(false);
    if (!res.ok) {
      setError(res.error || "Gagal mengajukan penarikan");
      return;
    }
    const msg =
      `Halo Admin Presensi Yuk, saya mau tarik dana komisi affiliate.\n\n` +
      `Nama: ${nama.trim()}\nEmail: ${dash.email}\nKode affiliate: ${dash.code}\n` +
      `Nominal: Rp${(res.amount || dash.saldo).toLocaleString("id-ID")}\nTransfer ke: ${tujuan.trim()}`;
    window.open(`https://wa.me/${WA_ADMIN}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
    toast("Penarikan diajukan. Kirim pesan WhatsApp ke admin.");
    onDone();
  };

  const input = "w-full mt-1 mb-3 px-3 py-[11px] rounded-[10px] border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)] text-[0.88rem]";
  return (
    <div className="fixed inset-0 z-[900] bg-black/55 flex items-end lg:items-center justify-center p-2" onClick={busy ? undefined : onClose}>
      <div className="bg-[var(--card-bg)] w-full max-w-[420px] rounded-t-2xl lg:rounded-2xl px-4 pt-4 pb-5 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <div className="text-[1rem] font-extrabold text-[var(--text)]">Tarik Dana</div>
          <button onClick={onClose} aria-label="Tutup" className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--input-bg)] text-[var(--text-light)] border-none cursor-pointer"><X size={16} /></button>
        </div>
        <p className="text-[0.78rem] text-[var(--text-light)] mt-0 mb-3">Seluruh saldo <b className="text-[var(--text)]">Rp{dash.saldo.toLocaleString("id-ID")}</b> akan diajukan. Setelah itu WhatsApp admin terbuka dengan pesan siap kirim.</p>
        <label className="text-[0.72rem] font-semibold text-[var(--text-light)]">Nama penerima</label>
        <input value={nama} onChange={(e) => setNama(e.target.value)} maxLength={80} className={input} />
        <label className="text-[0.72rem] font-semibold text-[var(--text-light)]">Transfer ke (bank / e-wallet + nomor)</label>
        <input value={tujuan} onChange={(e) => setTujuan(e.target.value)} maxLength={160} placeholder="DANA 0812xxxx / BRI 1234xxxx" className={input} />
        {error && <div className="mb-3 text-[0.75rem] text-[#dc2626] bg-[#dc2626]/10 rounded-[8px] px-3 py-2">{error}</div>}
        <button onClick={submit} disabled={busy} className="w-full min-h-[48px] rounded-xl text-white font-bold text-[0.9rem] border-none cursor-pointer disabled:opacity-60" style={{ background: "#16a34a" }}>
          {busy ? "Mengajukan..." : "Ajukan & kirim ke WhatsApp admin"}
        </button>
      </div>
    </div>
  );
}
