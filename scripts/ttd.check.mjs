// Jalankan: node --experimental-strip-types scripts/ttd.check.mjs
import assert from "node:assert/strict";
import { tanggalIndo, ttdBlok } from "../src/lib/ttd.ts";

assert.equal(tanggalIndo(new Date(2026, 9, 23)), "23 Oktober 2026");
assert.equal(tanggalIndo(new Date(2027, 0, 1)), "1 Januari 2027");
const school = { nama: "UPT SDN 01 Wonoharjo", ttd: { tempat: "Bumi Agung", tanggal: "2026-10-23" } };
const ks = { role: "ks", nama: "AHMAD SHALIHIN,S.Pd", nip: "19760515 200604 1 009" };
assert.deepEqual(ttdBlok(school, [ks]), {
  baris: ["Bumi Agung, 23 Oktober 2026", "Kepala UPT SDN 01 Wonoharjo"],
  nama: "AHMAD SHALIHIN,S.Pd",
  nip: "19760515 200604 1 009",
});
assert.equal(ttdBlok({ ...school, ttd: { aktif: false } }, [ks]), null);
console.log("ttd OK");
