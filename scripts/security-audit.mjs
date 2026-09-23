import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const allowedSheetJs =
  "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));

if (pkg.dependencies?.xlsx !== allowedSheetJs) {
  console.error(
    "Security gate: xlsx must remain pinned to the official SheetJS 0.20.3 tarball."
  );
  process.exit(1);
}

const audit = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["audit", "--omit=dev", "--json"],
  { encoding: "utf8" }
);

let report;
try {
  report = JSON.parse(audit.stdout || "{}");
} catch {
  console.error("Security gate: npm audit did not return valid JSON.");
  console.error(audit.stderr || audit.stdout);
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities ?? {};
const blocking = [];

for (const [name, finding] of Object.entries(vulnerabilities)) {
  const severity = String(finding?.severity ?? "").toLowerCase();
  if (severity !== "high" && severity !== "critical") continue;

  if (name === "xlsx") {
    continue;
  }

  blocking.push({
    name,
    severity,
    via: Array.isArray(finding?.via)
      ? finding.via
          .map((item) => (typeof item === "string" ? item : item?.title))
          .filter(Boolean)
      : []
  });
}

if (blocking.length) {
  console.error("Security gate: blocking production dependency vulnerabilities found:");
  for (const item of blocking) {
    console.error(
      `- ${item.name}: ${item.severity}${item.via.length ? ` · ${item.via.join("; ")}` : ""}`
    );
  }
  process.exit(1);
}

console.log(
  "Production dependency audit passed. SheetJS is pinned to the official patched 0.20.3 tarball; no other high/critical production advisories are present."
);
