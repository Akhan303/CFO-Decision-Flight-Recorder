import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const allowedExtensions = new Set([".html", ".js", ".css", ".json", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".ico", ".woff", ".woff2"]);
const forbiddenPatterns = [
  [/palantirfoundry\.com/i, "private Foundry URL"],
  [/\bFinanceAIP\b/i, "private namespace name"],
  [/@osdk|\bosdk\b/i, "OSDK reference"],
  [/VITE_FOUNDRY|FOUNDRY_CLIENT/i, "Foundry environment configuration"],
  [/ri\.(ontology|compass|code-repository|functions|foundry-main)\./i, "private resource identifier"],
  [/client_secret|access_token|refresh_token|private_key/i, "credential marker"],
  [/sourceMappingURL=/i, "source-map reference"],
];

const files = [];
const walk = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else files.push(path);
  }
};
walk(root);

const errors = [];
for (const file of files) {
  const name = relative(root, file).replaceAll("\\", "/");
  const extension = extname(file).toLowerCase();
  if (!allowedExtensions.has(extension)) errors.push(`${name}: unexpected deployment artifact type`);
  if (extension === ".map") errors.push(`${name}: source map must not be published`);
  if ([".html", ".js", ".css", ".json", ".svg"].includes(extension)) {
    const contents = readFileSync(file, "utf8");
    for (const [pattern, label] of forbiddenPatterns) {
      if (pattern.test(contents)) errors.push(`${name}: contains ${label}`);
    }
  }
}

if (!files.some((file) => file.endsWith("index.html"))) errors.push("dist/index.html is missing");
if (!files.some((file) => extname(file) === ".js")) errors.push("compiled JavaScript bundle is missing");
if (!files.some((file) => extname(file) === ".css")) errors.push("compiled CSS bundle is missing");

const manifestPath = join(root, "release-manifest.json");
const manifest = files.includes(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : undefined;
if (!manifest) {
  errors.push("release-manifest.json is missing");
} else {
  if (manifest.financeModelVersion !== "FIN-SCENARIO-v1") errors.push("release manifest has the wrong finance model version");
  if (manifest.distribution?.sourceMaps !== false || manifest.distribution?.minified !== true) errors.push("release manifest distribution policy is invalid");
  const hashedFiles = files.filter((file) => file !== manifestPath);
  if (manifest.artifacts?.length !== hashedFiles.length) errors.push("release manifest artifact count does not match dist");
  for (const artifact of manifest.artifacts ?? []) {
    const file = join(root, artifact.path);
    if (!hashedFiles.includes(file)) {
      errors.push(`${artifact.path}: manifest references a missing artifact`);
      continue;
    }
    const digest = createHash("sha256").update(readFileSync(file)).digest("hex");
    if (digest !== artifact.sha256 || statSync(file).size !== artifact.bytes) errors.push(`${artifact.path}: checksum or byte count mismatch`);
  }
}

if (errors.length) {
  console.error(`Distribution validation failed (${errors.length})\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

const bytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
console.log(`Distribution validation passed: ${files.length} browser artifacts, ${bytes} bytes, verified manifest, no source maps or private-platform markers.`);
