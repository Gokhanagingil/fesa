/**
 * Wave 18 — Parent Portal v1.1 / Brand Admin v1.1.
 *
 * Pure-Node validator smoke for the club-updates layer. Mirrors the
 * normalization rules in
 *   apps/api/src/modules/club-update/club-update.service.ts
 * exactly so we can gate every CI run alongside the existing
 * tenant-branding and reporting smokes — no database required.
 */

const SAFE_URL = /^(https?:\/\/|\/)[^\s"'<>]+$/i;

function clamp(value, max) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function requiredClamp(value, max, field) {
  const next = clamp(value, max);
  if (!next) {
    throw new Error(`${field} is required`);
  }
  return next;
}

function normalizeUrl(value) {
  const trimmed = clamp(value, 512);
  if (!trimmed) return null;
  if (!SAFE_URL.test(trimmed)) {
    throw new Error('invalid url');
  }
  return trimmed;
}

function parseDate(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('invalid date');
  }
  return parsed;
}

function compareForDisplay(a, b, now) {
  const aPinned = a.pinnedUntil && a.pinnedUntil.getTime() > now.getTime() ? 1 : 0;
  const bPinned = b.pinnedUntil && b.pinnedUntil.getTime() > now.getTime() ? 1 : 0;
  if (aPinned !== bPinned) return bPinned - aPinned;
  const aWhen = (a.publishedAt ?? a.updatedAt).getTime();
  const bWhen = (b.publishedAt ?? b.updatedAt).getTime();
  return bWhen - aWhen;
}

function expect(condition, message) {
  if (!condition) {
    console.error(`club-updates: ${message}`);
    process.exit(1);
  }
}

// Title and body are required and trimmed.
let threw = false;
try {
  requiredClamp('   ', 140, 'Title');
} catch {
  threw = true;
}
expect(threw, 'rejects whitespace title');

expect(requiredClamp('  Spring camp ', 140, 'Title') === 'Spring camp', 'trims required value');
expect(clamp('Welcome family note', 8) === 'Welcome ', 'clamps optional fields');
expect(clamp(null, 10) === null, 'null clamps to null');

// Safe URL validation — same rules as branding, kept identical so staff
// don't have to learn two different link conventions.
expect(normalizeUrl('https://club.example/news/spring-camp') === 'https://club.example/news/spring-camp', 'accepts https');
expect(normalizeUrl('/portal/home') === '/portal/home', 'accepts repo-rooted path');
expect(normalizeUrl('') === null, 'empty string becomes null');

threw = false;
try {
  normalizeUrl('javascript:alert(1)');
} catch {
  threw = true;
}
expect(threw, 'rejects javascript: link');

threw = false;
try {
  normalizeUrl('mailto:hi@example.com');
} catch {
  threw = true;
}
expect(threw, 'rejects mailto link');

// Date parsing — only ISO-8601 like values are accepted.
expect(parseDate(null) === null, 'explicit null clears the date');
expect(parseDate(undefined) === undefined, 'undefined keeps the field untouched');
expect(parseDate('') === null, 'empty string clears the date');
const parsed = parseDate('2026-04-25T18:00:00Z');
expect(parsed instanceof Date && !Number.isNaN(parsed.getTime()), 'parses ISO datetime');

threw = false;
try {
  parseDate('not-a-date');
} catch {
  threw = true;
}
expect(threw, 'rejects non-date strings');

// Display ordering — pinned first, then by published-at desc.
const now = new Date('2026-04-15T12:00:00Z');
const list = [
  {
    id: 'old-pinned',
    pinnedUntil: new Date('2026-04-20T00:00:00Z'),
    publishedAt: new Date('2026-04-01T10:00:00Z'),
    updatedAt: new Date('2026-04-01T10:00:00Z'),
  },
  {
    id: 'new-unpinned',
    pinnedUntil: null,
    publishedAt: new Date('2026-04-14T10:00:00Z'),
    updatedAt: new Date('2026-04-14T10:00:00Z'),
  },
  {
    id: 'older-unpinned',
    pinnedUntil: null,
    publishedAt: new Date('2026-04-05T10:00:00Z'),
    updatedAt: new Date('2026-04-05T10:00:00Z'),
  },
];
list.sort((a, b) => compareForDisplay(a, b, now));
expect(list.map((row) => row.id).join(',') === 'old-pinned,new-unpinned,older-unpinned', 'pinned cards always sort first');

// Expired cards must drop out of the parent-facing visible slice.
const PARENT_LIMIT = 5;
const candidates = [
  { id: 'live', publishedAt: new Date('2026-04-10T10:00:00Z'), expiresAt: null },
  { id: 'future', publishedAt: new Date('2026-04-20T10:00:00Z'), expiresAt: null }, // not yet published from "now"
  { id: 'expired', publishedAt: new Date('2026-04-01T10:00:00Z'), expiresAt: new Date('2026-04-10T10:00:00Z') },
];
const visible = candidates
  .filter((row) => row.publishedAt && row.publishedAt.getTime() <= now.getTime())
  .filter((row) => !row.expiresAt || row.expiresAt.getTime() >= now.getTime())
  .slice(0, PARENT_LIMIT);
expect(visible.length === 1 && visible[0].id === 'live', 'parent-facing filter drops expired and future-dated cards');

console.log('club-updates: OK');
