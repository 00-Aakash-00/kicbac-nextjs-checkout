import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sdkRoot = resolve(root, process.argv[2] ?? "../kicbac-js");
const required = new Set(["kicbac", "@kicbac/js", "@kicbac/react", "@kicbac/nextjs", "@kicbac/themes"]);

if (!existsSync(sdkRoot)) {
  throw new Error(`kicbac-js checkout not found: ${sdkRoot}`);
}

const overrides = {};
for (const packageDir of readdirSync(resolve(sdkRoot, "packages"))) {
  const dir = resolve(sdkRoot, "packages", packageDir);
  const manifestPath = resolve(dir, "package.json");
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!required.has(manifest.name)) continue;
  const tarball = readdirSync(dir)
    .filter((name) => name.endsWith(".tgz"))
    .map((name) => resolve(dir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  if (!tarball) {
    throw new Error(`No packed tarball found for ${manifest.name} in ${dir}`);
  }
  overrides[manifest.name] = `file:${tarball}`;
}

for (const name of required) {
  if (!overrides[name]) throw new Error(`Missing packed tarball for ${name}`);
}

const packagePath = resolve(root, "package.json");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
packageJson.pnpm = {
  ...(packageJson.pnpm ?? {}),
  overrides,
};
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
console.log("Wired local Kicbac tarballs into package.json pnpm.overrides.");
console.log("LOCAL ONLY: do not commit package.json overrides or generated pnpm-lock.yaml.");
