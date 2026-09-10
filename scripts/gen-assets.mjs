// Bakes assets/*.html into importable TS string modules.
// Run via `npm run gen` (also chained into `npm run build`).
// Authoring the webview HTML as real .html files avoids escaping regexes/backticks
// by hand; JSON.stringify produces a safe string literal.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const targets = [
    { html: "assets/form.html", ts: "src/form-html.ts", name: "FORM_HTML" },
    { html: "assets/opener.html", ts: "src/opener-html.ts", name: "OPENER_HTML" },
];

for (const t of targets) {
    const html = readFileSync(join(root, t.html), "utf8");
    const out =
        `// AUTO-GENERATED from ${t.html} by scripts/gen-assets.mjs. Do not edit by hand.\n` +
        `export const ${t.name} = ${JSON.stringify(html)};\n`;
    writeFileSync(join(root, t.ts), out);
    console.log(`wrote ${t.ts} (${out.length} bytes) from ${t.html}`);
}
