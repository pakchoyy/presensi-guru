import { Tier } from "@/types/enums";

// Batas jumlah guru per paket.
export const MAX_GURU: Record<Tier, number> = { [Tier.FREE]: 5, [Tier.PLUS]: 15, [Tier.PRO]: Infinity };

export const isPaid = (tier?: string) => tier === Tier.PLUS || tier === Tier.PRO;
export const isPro = (tier?: string) => tier === Tier.PRO;
export const maxGuru = (tier?: string) => MAX_GURU[(tier as Tier) || Tier.FREE] ?? MAX_GURU[Tier.FREE];
export const asTier = (tier?: string | null) => (tier === Tier.PLUS ? Tier.PLUS : Tier.PRO);
