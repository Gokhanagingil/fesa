import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const localeDir = path.join(root, 'apps', 'web', 'src', 'i18n', 'locales');
const referenceLocale = 'en';
const comparedLocales = ['tr'];

function flattenKeys(input, prefix = '') {
  if (Array.isArray(input)) {
    return input.flatMap((value, index) => flattenKeys(value, `${prefix}[${index}]`));
  }

  if (input && typeof input === 'object') {
    return Object.entries(input).flatMap(([key, value]) =>
      flattenKeys(value, prefix ? `${prefix}.${key}` : key),
    );
  }

  return [prefix];
}

async function loadLocale(locale) {
  const filePath = path.join(localeDir, locale, 'common.json');
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function diffKeys(referenceKeys, targetKeys) {
  const referenceOnly = referenceKeys.filter((key) => !targetKeys.includes(key));
  const targetOnly = targetKeys.filter((key) => !referenceKeys.includes(key));
  return { referenceOnly, targetOnly };
}

async function main() {
  const reference = await loadLocale(referenceLocale);
  const referenceKeys = flattenKeys(reference).sort();

  let failed = false;

  for (const locale of comparedLocales) {
    const current = await loadLocale(locale);
    const localeKeys = flattenKeys(current).sort();
    const { referenceOnly, targetOnly } = diffKeys(referenceKeys, localeKeys);

    if (referenceOnly.length === 0 && targetOnly.length === 0) {
      continue;
    }

    failed = true;
    console.error(`Locale parity mismatch: ${referenceLocale} vs ${locale}`);

    if (referenceOnly.length > 0) {
      console.error(`  Missing in ${locale}:`);
      referenceOnly.forEach((key) => console.error(`    - ${key}`));
    }

    if (targetOnly.length > 0) {
      console.error(`  Extra in ${locale}:`);
      targetOnly.forEach((key) => console.error(`    + ${key}`));
    }
  }

  if (failed) {
    process.exitCode = 1;
    return;
  }

  console.log('Locale parity OK');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
