import { Tier } from "@/types/enums";

// Batas jumlah guru per paket.
export const MAX_GURU: Record<Tier, number> = { [Tier.FREE]: 5, [Tier.PLUS]: 10, [Tier.PRO]: Infinity };

export const isPaid = (tier?: string) => tier === Tier.PLUS || tier === Tier.PRO;
export const isPro = (tier?: string) => tier === Tier.PRO;
export const maxGuru = (tier?: string) => MAX_GURU[(tier as Tier) || Tier.FREE] ?? MAX_GURU[Tier.FREE];
export const asTier = (tier?: string | null) => (tier === Tier.PLUS ? Tier.PLUS : Tier.PRO);

// Masa coba PRO 30 hari (lokal) untuk akun FREE; cloud tetap ikut lisensi asli.
const INSTALL_DATE_KEY = "bgy_guru_install_date";
export const TRIAL_END_SEEN_KEY = "bgy_guru_trial_end_seen";

export function trialDaysRemaining(): number {
  const stored = parseInt(localStorage.getItem(INSTALL_DATE_KEY) || "0", 10);
  if (!stored) {
    localStorage.setItem(INSTALL_DATE_KEY, Date.now().toString());
    return 30;
  }
  return Math.max(0, 30 - Math.floor((Date.now() - stored) / 86400000));
}

export const isOnTrial = (tier?: string | null) => !isPaid(tier ?? undefined) && trialDaysRemaining() > 0;

export const effectiveTier = (tier?: string | null): Tier =>
  isPaid(tier ?? undefined) ? (tier as Tier) : trialDaysRemaining() > 0 ? Tier.PRO : Tier.FREE;
