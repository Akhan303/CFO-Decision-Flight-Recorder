import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const financePolicy = JSON.parse(readFileSync(new URL("../src/data/finance-policy.json", import.meta.url), "utf8"));
const files = [];
const walk = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name !== "release-manifest.json") files.push(path);
  }
};
walk(root);

const artifacts = files
  .map((file) => ({
    path: relative(root, file).replaceAll("\\", "/"),
    bytes: statSync(file).size,
    sha256: createHash("sha256").update(readFileSync(file)).digest("hex"),
  }))
  .sort((a, b) => a.path.localeCompare(b.path));

const manifest = {
  product: "CFO Decision Flight Recorder — Public Showcase",
  releaseVersion: packageJson.version,
  financeModelVersion: financePolicy.modelVersion,
  generatedAtUtc: new Date().toISOString(),
  distribution: {
    sourceMaps: false,
    minified: true,
    runtimeConnectivity: "None — self-contained static demonstration",
    dataClassification: "Synthetic Arcadia Industrial Automation demonstration data",
  },
  artifacts,
};

writeFileSync(join(root, "release-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Release manifest created for ${artifacts.length} hashed artifacts (${financePolicy.modelVersion}).`);
