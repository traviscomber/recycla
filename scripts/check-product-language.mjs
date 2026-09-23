import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const roots = ["src", "db", "docs"];
const extraFiles = ["README.md", "DESIGN.md"];
const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".sql", ".md", ".json", ".csv"]);
const forbidden = [
  { label: "demo", pattern: /\bdemo\b/i },
  { label: "mock", pattern: /\bmock(?:ed|ing|s)?\b/i },
  { label: "MVP", pattern: /\bmvp\b/i },
  { label: "cliente piloto", pattern: /\bcliente\s+piloto\b/i }
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (extensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

const files = [];
for (const root of roots) files.push(...(await walk(root)));
files.push(...extraFiles);

const violations = [];
for (const file of files) {
  const content = await readFile(file, "utf8");
  const lines = content.split("\n");
  lines.forEach((line, index) => {
    for (const rule of forbidden) {
      if (rule.pattern.test(line)) {
        violations.push({
          file: relative(process.cwd(), file),
          line: index + 1,
          rule: rule.label,
          text: line.trim()
        });
      }
    }
  });
}

if (violations.length) {
  console.error("Synthetic/prototype language is not allowed in Recycla OS:");
  for (const item of violations) {
    console.error(`- ${item.file}:${item.line} [${item.rule}] ${item.text}`);
  }
  process.exit(1);
}

console.log(`Product-language guard passed across ${files.length} files.`);
