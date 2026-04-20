/**
 * Wave 17 — Parent Access & Portal Foundation + Tenant Branding Foundation v1.
 *
 * Pure-Node validator smoke for the brand normalization rules used by
 * `TenantBrandingService.updateBranding`. Runs without a database so it can
 * gate every CI run alongside the existing reporting/whatsapp smokes.
 *
 * Mirrors the rules in
 *   apps/api/src/modules/tenant/tenant-branding.service.ts
 * exactly. Keeping a small, dependency-free copy here lets us validate the
 * "branded shell, controlled product core" contract on every PR without
 * spinning up Nest.
 */

const HEX_COLOR = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const SAFE_URL = /^(https?:\/\/|\/)[^\s"'<>]+$/i;

function normalizeColor(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (!HEX_COLOR.test(trimmed)) {
    throw new Error('invalid color');
  }
  return trimmed.toLowerCase();
}

function normalizeUrl(value, max) {
  if (value == null) return null;
  const trimmed = String(value).trim().slice(0, max);
  if (!trimmed) return null;
  if (!SAFE_URL.test(trimmed)) {
    throw new Error('invalid url');
  }
  return trimmed;
}

function clamp(value, max) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function expect(condition, message) {
  if (!condition) {
    console.error(`tenant-branding: ${message}`);
    process.exit(1);
  }
}

// Color normalization
expect(normalizeColor('#0D4A3C') === '#0d4a3c', 'lowercases hex color');
expect(normalizeColor('#000000ff') === '#000000ff', 'allows 8-char hex');
expect(normalizeColor('') === null, 'empty becomes null');
expect(normalizeColor(null) === null, 'null stays null');

let threw = false;
try {
  normalizeColor('blue');
} catch {
  threw = true;
}
expect(threw, 'rejects non-hex color');

threw = false;
try {
  normalizeColor('javascript:alert(1)');
} catch {
  threw = true;
}
expect(threw, 'rejects javascript: in color');

// URL normalization
expect(normalizeUrl('https://example.com/logo.png', 200) === 'https://example.com/logo.png', 'accepts https');
expect(normalizeUrl('/uploads/logo.png', 200) === '/uploads/logo.png', 'accepts relative path');

threw = false;
try {
  normalizeUrl('javascript:alert(1)', 200);
} catch {
  threw = true;
}
expect(threw, 'rejects javascript: url');

threw = false;
try {
  normalizeUrl('data:image/png;base64,xxx', 200);
} catch {
  threw = true;
}
expect(threw, 'rejects data: url');

threw = false;
try {
  normalizeUrl('ftp://example.com/logo.png', 200);
} catch {
  threw = true;
}
expect(threw, 'rejects ftp url');

// Clamp
expect(clamp('   ', 10) === null, 'whitespace clamps to null');
expect(clamp('abcdefghijklmnop', 5) === 'abcde', 'clamps long values');

console.log('tenant-branding: OK');
