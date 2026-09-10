// WIP scaffolding — pick a runner (node:test or vitest) and wire into CI.
import { deriveLabel, normalizeUrl, extractUrl } from "../src/util";

const cases: Array<[string, string]> = [
    ["https://github.com/gastownhall/beads", "gastownhall/beads"],
    ["https://www.github.com/torvalds/linux/", "torvalds/linux"],
    ["github.com/foo/bar", "foo/bar"],
    ["https://drawdy.io/docs", "drawdy.io/docs"],
];
for (const [input, want] of cases) {
    const got = deriveLabel(input);
    if (got !== want) throw new Error(`deriveLabel(${input}) = ${got}, want ${want}`);
}
if (normalizeUrl("github.com/x") !== "https://github.com/x") throw new Error("normalizeUrl scheme");
if (extractUrl("see https://a.com/b ok") !== "https://a.com/b") throw new Error("extractUrl");
console.log("ok");
