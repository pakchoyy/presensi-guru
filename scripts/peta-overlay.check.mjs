// Jalankan: node --experimental-strip-types scripts/peta-overlay.check.mjs
import assert from "node:assert/strict";
import { metersPerPixel, offsetPx, pilihZoom } from "../src/lib/peta-overlay.ts";

assert.ok(Math.abs(metersPerPixel(-7, 17) - 1.186) < 0.01, "mpp lat -7 z17 ≈ 1.18");
// 30 m ke utara di z17 ≈ 25 px ke atas.
const o = offsetPx(-7, 110, -7 + 30 / 111320, 110, 17);
assert.ok(Math.abs(o.x) < 0.01 && Math.abs(o.y + 25.3) < 0.5, `offset ${JSON.stringify(o)}`);
// Radius 100 m di kotak 330×220: lingkaran harus muat (r ≤ 90 px).
const z = pilihZoom(-7, 110, 100, 330, 220, { lat: -7 + 30 / 111320, lng: 110 });
assert.ok(100 / metersPerPixel(-7, z) <= 90, `zoom ${z}`);
assert.equal(z, 17); // r ≈ 84 px di z17, z18 (≈169 px) tidak muat
console.log("peta-overlay OK, zoom", z);
