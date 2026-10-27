// Jalankan: node --experimental-strip-types scripts/rekap-kolektif.check.mjs
import assert from "node:assert/strict";
import { ringkasKode } from "../src/lib/rekap-kolektif.ts";

const r = ringkasKode(["H", "T", "PC", "LA", "S", "I", "A", "-"]);
assert.deepEqual(r, { hari: 7, hadir: 3, terlambat: 1, sakit: 1, izin: 1, alpa: 1, persen: 57 });
assert.equal(ringkasKode([]).persen, 0);
assert.equal(ringkasKode(["-", "-"]).hari, 0);
console.log("rekap-kolektif OK");
