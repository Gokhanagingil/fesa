#!/usr/bin/env node
/**
 * Pure-Node regression guard for the NestJS API module graph.
 *
 * Why this exists:
 *   The Wave 22 / Wave 23 Billing & Licensing work made it easy to
 *   accidentally widen module-level coupling between AuthModule,
 *   TenantModule and LicensingModule, which produced a real circular
 *   dependency:
 *
 *     TenantModule -> LicensingModule -> AuthModule -> TenantModule
 *
 *   Nest reports this at runtime as:
 *     "Nest cannot create the AuthModule instance.
 *      The module at index [N] of the AuthModule 'imports' array is
 *      undefined."
 *
 *   That failure is caught only when the API actually boots. This
 *   validator catches the same shape statically by walking every
 *   `*.module.ts` file under apps/api/src/modules and parsing the
 *   relative `imports: [...]` of each `@Module({...})` declaration.
 *
 * What it checks:
 *   1. Every relative module import resolves to an existing
 *      `*.module.ts` file. (Catches "module at index [N] is undefined"
 *      caused by typos / refactors / barrel-export mistakes.)
 *   2. The directed graph of (module -> imported modules) has no
 *      cycles. (Catches the exact class of bug that broke boot.)
 *   3. Specific anti-patterns we have already paid for once and never
 *      want to regress:
 *        - TenantModule must not import LicensingModule.
 *        - AuthModule must not import LicensingModule.
 *
 * Run from the repo root:
 *   node scripts/api-module-graph.test.mjs
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const modulesRoot = path.join(repoRoot, 'apps', 'api', 'src', 'modules');
const failures = [];

function fail(message) {
  failures.push(message);
}

async function listModuleFiles(rootDir) {
  const out = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
      } else if (entry.isFile() && entry.name.endsWith('.module.ts')) {
        out.push(abs);
      }
    }
  }
  return out.sort();
}

function moduleClassName(source) {
  const match = source.match(/export\s+class\s+([A-Z][A-Za-z0-9_]*Module)\b/);
  return match ? match[1] : null;
}

function collectRelativeModuleImports(source) {
  const imports = new Map();
  const importRegex = /import\s*\{\s*([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(source))) {
    const specifiers = match[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/\s+as\s+.+$/, '').trim());
    const from = match[2];
    if (!from.startsWith('.')) continue;
    if (!from.endsWith('.module')) continue;
    for (const specifier of specifiers) {
      if (/^[A-Z][A-Za-z0-9_]*Module$/.test(specifier)) {
        imports.set(specifier, from);
      }
    }
  }
  return imports;
}

function extractModuleImportsArray(source) {
  const decoratorIndex = source.indexOf('@Module(');
  if (decoratorIndex === -1) return [];
  const open = source.indexOf('{', decoratorIndex);
  if (open === -1) return [];

  let depth = 0;
  let close = -1;
  for (let i = open; i < source.length; i++) {
    const char = source[i];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close === -1) return [];
  const body = source.slice(open + 1, close);

  const importsKeyMatch = body.match(/imports\s*:\s*\[/);
  if (!importsKeyMatch) return [];
  const importsStart = body.indexOf('[', importsKeyMatch.index);
  let bracketDepth = 0;
  let importsEnd = -1;
  for (let i = importsStart; i < body.length; i++) {
    const char = body[i];
    if (char === '[') bracketDepth += 1;
    else if (char === ']') {
      bracketDepth -= 1;
      if (bracketDepth === 0) {
        importsEnd = i;
        break;
      }
    }
  }
  if (importsEnd === -1) return [];
  const importsBody = body.slice(importsStart + 1, importsEnd);

  return Array.from(importsBody.matchAll(/\b([A-Z][A-Za-z0-9_]*Module)\b/g))
    .map((m) => m[1]);
}

function resolveImportPath(currentFile, importSpecifier) {
  if (!importSpecifier.startsWith('.')) return null;
  const baseDir = path.dirname(currentFile);
  return path.resolve(baseDir, `${importSpecifier}.ts`);
}

function detectCycles(graph) {
  const cycles = [];
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map();
  for (const node of graph.keys()) color.set(node, WHITE);

  function visit(node, stack) {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      const c = color.get(next);
      if (c === GRAY) {
        const cycleStart = stack.indexOf(next);
        cycles.push([...stack.slice(cycleStart), next]);
      } else if (c === WHITE) {
        visit(next, stack);
      }
    }
    stack.pop();
    color.set(node, BLACK);
  }

  for (const node of graph.keys()) {
    if (color.get(node) === WHITE) {
      visit(node, []);
    }
  }
  return cycles;
}

async function main() {
  const moduleFiles = await listModuleFiles(modulesRoot);
  if (moduleFiles.length === 0) {
    fail(`No *.module.ts files found under ${modulesRoot}.`);
  }

  const classToFile = new Map();
  const fileToClass = new Map();
  const fileToImportedFiles = new Map();
  const fileToImportedSpecifiers = new Map();

  for (const file of moduleFiles) {
    const source = await readFile(file, 'utf8');
    const className = moduleClassName(source);
    if (!className) {
      fail(`${path.relative(repoRoot, file)}: no exported *Module class found.`);
      continue;
    }
    if (classToFile.has(className)) {
      fail(`Duplicate module class ${className} in ${path.relative(repoRoot, file)} and ${path.relative(repoRoot, classToFile.get(className))}.`);
    }
    classToFile.set(className, file);
    fileToClass.set(file, className);

    const relativeImports = collectRelativeModuleImports(source);
    const referenced = extractModuleImportsArray(source);

    const resolvedFiles = new Set();
    const resolvedSpecifiers = new Set();
    for (const ref of referenced) {
      const specifier = relativeImports.get(ref);
      if (!specifier) {
        continue;
      }
      const resolved = resolveImportPath(file, specifier);
      if (!resolved) continue;
      resolvedSpecifiers.add(ref);
      resolvedFiles.add(resolved);
    }

    fileToImportedFiles.set(file, resolvedFiles);
    fileToImportedSpecifiers.set(file, { referenced, resolvedSpecifiers });
  }

  for (const [file, files] of fileToImportedFiles.entries()) {
    for (const target of files) {
      if (!fileToClass.has(target)) {
        fail(
          `${path.relative(repoRoot, file)}: imports a relative module that does not resolve to a known *.module.ts file (${path.relative(repoRoot, target)}). This is the runtime "module at index [N] is undefined" failure shape.`,
        );
      }
    }
  }

  const graph = new Map();
  for (const [file, targetFiles] of fileToImportedFiles.entries()) {
    const fromClass = fileToClass.get(file);
    const targets = new Set();
    for (const targetFile of targetFiles) {
      const toClass = fileToClass.get(targetFile);
      if (toClass) targets.add(toClass);
    }
    graph.set(fromClass, targets);
  }
  for (const cls of classToFile.keys()) {
    if (!graph.has(cls)) graph.set(cls, new Set());
  }

  const cycles = detectCycles(graph);
  for (const cycle of cycles) {
    fail(
      `Circular module dependency detected: ${cycle.join(' -> ')}. This will cause Nest to report "module at index [N] is undefined" at boot.`,
    );
  }

  function disallow(fromClass, toClass, why) {
    const file = classToFile.get(fromClass);
    if (!file) return;
    const refs = fileToImportedSpecifiers.get(file)?.resolvedSpecifiers;
    if (refs?.has(toClass)) {
      fail(`${fromClass} must not import ${toClass}: ${why}`);
    }
  }

  disallow(
    'TenantModule',
    'LicensingModule',
    'creates a TenantModule -> LicensingModule -> AuthModule -> TenantModule cycle. LicensingModule is @Global() so its providers are injectable without a module-level import.',
  );
  disallow(
    'AuthModule',
    'LicensingModule',
    'AuthModule sits below LicensingModule in the dependency direction; importing it back would form a cycle.',
  );

  if (failures.length === 0) {
    console.log('api:module-graph OK — no cycles, no undefined module imports, no banned edges.');
    process.exit(0);
  }

  console.error('api:module-graph FAILED:');
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
