/**
 * Lightweight monorepo hygiene checks (CI and local).
 * Fails fast on missing layout; verifies workspace packages resolve via npm.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const requiredPaths = [
  "README.md",
  "docs/README.md",
  "eslint.config.mjs",
  "package-lock.json",
  "package.json",
  "apps/web/package.json",
  "apps/api/package.json",
  "apps/api/.env.example",
  "apps/web/.env.example",
];

for (const rel of requiredPaths) {
  const abs = join(root, rel);
  if (!existsSync(abs)) {
    console.error(`repo-guard: missing required path: ${rel}`);
    process.exit(1);
  }
}

let pkg;
try {
  pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
} catch {
  console.error("repo-guard: could not parse root package.json");
  process.exit(1);
}

if (!Array.isArray(pkg.workspaces) || pkg.workspaces.length === 0) {
  console.error("repo-guard: root package.json must define a non-empty workspaces array");
  process.exit(1);
}

const workspacePackages = [
  "@amateur/api",
  "@amateur/web",
  "@amateur/shared-types",
  "@amateur/shared-config",
];

try {
  execSync(
    `npm ls ${workspacePackages.map((w) => `-w ${w}`).join(" ")} --depth=0`,
    { cwd: root, stdio: ["ignore", "ignore", "pipe"] },
  );
} catch (err) {
  const stderr = err instanceof Error && "stderr" in err && err.stderr ? String(err.stderr) : String(err);
  console.error(stderr);
  process.exit(1);
}

console.log("repo-guard: OK");
