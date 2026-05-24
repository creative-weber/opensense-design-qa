/**
 * Manual smoke-test for ODQA-039 — @opendesign-qa/compare scaffold.
 *
 * Run from the repo root:
 *   node packages/compare/manual-test.mjs
 *
 * Prerequisites: pnpm --filter @opendesign-qa/compare build
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { diff, CompareError } from "./dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "manual-test-out");
mkdirSync(OUT_DIR, { recursive: true });

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✅  ${label}`);
  passed++;
}
function fail(label, err) {
  console.error(`  ❌  ${label}`);
  console.error(`      ${err?.message ?? err}`);
  failed++;
}

/** Build a solid-colour PNG buffer. */
async function solidPng(w, h, r, g, b) {
  return sharp({
    create: { width: w, height: h, channels: 4, background: { r, g, b, alpha: 255 } },
  })
    .png()
    .toBuffer();
}

console.log("\n=== ODQA-039 Manual Test — @opendesign-qa/compare ===\n");

// ─── Test 1: identical images → zero mismatch ───────────────────────────────
try {
  const img = await solidPng(40, 40, 255, 0, 0);
  const result = await diff(img, img);

  if (result.mismatchCount !== 0) throw new Error(`Expected 0 mismatches, got ${result.mismatchCount}`);
  if (result.mismatchRatio !== 0) throw new Error(`Expected ratio 0, got ${result.mismatchRatio}`);
  if (result.width !== 40 || result.height !== 40) throw new Error(`Unexpected dimensions ${result.width}×${result.height}`);

  writeFileSync(join(OUT_DIR, "01-identical-diff.png"), result.diffBuffer);
  ok("Identical images → mismatchCount=0, mismatchRatio=0 (diff saved as 01-identical-diff.png)");
} catch (e) {
  fail("Identical images", e);
}

// ─── Test 2: red vs blue → high mismatch ────────────────────────────────────
try {
  const red  = await solidPng(40, 40, 255, 0,   0);
  const blue = await solidPng(40, 40,   0, 0, 255);
  const result = await diff(red, blue);

  if (result.mismatchCount === 0) throw new Error("Expected non-zero mismatches");
  if (result.mismatchRatio <= 0 || result.mismatchRatio > 1) throw new Error(`Ratio out of range: ${result.mismatchRatio}`);

  writeFileSync(join(OUT_DIR, "02-red-vs-blue-diff.png"), result.diffBuffer);
  ok(`Red vs blue → mismatchCount=${result.mismatchCount}, ratio=${result.mismatchRatio.toFixed(4)} (diff saved as 02-red-vs-blue-diff.png)`);
} catch (e) {
  fail("Red vs blue", e);
}

// ─── Test 3: different dimensions → resized to largest canvas ────────────────
// Use different colours so the upscaled small image (green) differs from the
// large image (blue), making the mismatch visually obvious in the diff PNG.
try {
  const small = await solidPng(20, 20,   0, 200,   0); // green 20×20
  const large = await solidPng(40, 40,   0,   0, 200); // blue  40×40
  const result = await diff(small, large);

  if (result.width !== 40 || result.height !== 40) throw new Error(`Expected 40×40, got ${result.width}×${result.height}`);
  if (result.mismatchCount === 0) throw new Error("Expected mismatches between green and blue");

  writeFileSync(join(OUT_DIR, "03-size-mismatch-diff.png"), result.diffBuffer);
  ok(`Different sizes (20×20 green vs 40×40 blue) → normalised to 40×40, mismatchCount=${result.mismatchCount} (diff saved as 03-size-mismatch-diff.png)`);
} catch (e) {
  fail("Different sizes", e);
}

// ─── Test 4: high threshold ignores minor colour difference ──────────────────
try {
  const a = await solidPng(20, 20, 200, 100, 100);
  const b = await solidPng(20, 20, 205, 100, 100); // only 5/255 shift in red

  const strict  = await diff(a, b, { threshold: 0.01 });
  const lenient = await diff(a, b, { threshold: 0.5  });

  if (strict.mismatchCount < lenient.mismatchCount) {
    throw new Error(`Strict (${strict.mismatchCount}) < lenient (${lenient.mismatchCount}) — threshold not respected`);
  }
  ok(`Threshold respected — strict=${strict.mismatchCount} mismatches, lenient=${lenient.mismatchCount} mismatches`);
} catch (e) {
  fail("Threshold option", e);
}

// ─── Test 5: empty buffer throws CompareError ────────────────────────────────
try {
  const valid = await solidPng(10, 10, 0, 0, 0);
  let threw = false;
  try {
    await diff(Buffer.alloc(0), valid);
  } catch (err) {
    threw = true;
    if (!(err instanceof CompareError)) throw new Error(`Expected CompareError, got ${err?.constructor?.name}`);
  }
  if (!threw) throw new Error("Expected an error but none was thrown");
  ok("Empty buffer throws CompareError");
} catch (e) {
  fail("Empty buffer → CompareError", e);
}

// ─── Test 6: diffBuffer is a valid PNG ───────────────────────────────────────
try {
  const img = await solidPng(10, 10, 50, 100, 150);
  const { diffBuffer } = await diff(img, img);

  // PNG magic: 89 50 4E 47
  if (diffBuffer[0] !== 0x89 || diffBuffer[1] !== 0x50 || diffBuffer[2] !== 0x4e || diffBuffer[3] !== 0x47) {
    throw new Error(`Not a PNG (first bytes: ${[...diffBuffer.slice(0,4)].map(b => b.toString(16)).join(' ')})`);
  }
  ok("diffBuffer contains a valid PNG (magic bytes verified)");
} catch (e) {
  fail("diffBuffer is PNG", e);
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(52)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`\nDiff images written to: ${OUT_DIR}`);
  process.exit(1);
}
console.log(`\nDiff images written to: ${OUT_DIR}`);
console.log("ODQA-039 manual test complete ✅");
