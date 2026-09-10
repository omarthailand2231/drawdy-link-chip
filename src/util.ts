// Pure helpers: label derivation, URL normalizing, chip sizing, color math.
// No protocol imports — kept unit-testable and side-effect-free.

import type { IconKind } from "./icons";

/**
 * The clean label shown on the chip. Strips the scheme, a leading `www.`,
 * and any trailing slash; for GitHub it also drops the host so
 * `https://github.com/gastownhall/beads` reads as `gastownhall/beads`.
 */
export function deriveLabel(url: string): string {
    const noScheme = url.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
    const noWww = noScheme.replace(/^www\./i, "");
    const noSlash = noWww.replace(/\/+$/, "");
    return noSlash.replace(/^github\.com\//i, "") || noSlash;
}

/**
 * Pull the first URL-looking token out of arbitrary text (a selected text
 * element), or null. Handles `https://…`, `www.…`, and bare `domain.tld/…`.
 */
export function extractUrl(text: string): string | null {
    if (!text) return null;
    const t = text.trim();
    const strip = (s: string) => s.replace(/[.,);\]]+$/, "");
    let m = t.match(/\bhttps?:\/\/[^\s]+/i);
    if (m) return strip(m[0]);
    m = t.match(/\bwww\.[^\s]+/i);
    if (m) return strip(m[0]);
    m = t.match(
        /\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/[^\s]*)?/i
    );
    if (m) return strip(m[0]);
    return null;
}

/** What we actually open: guarantees a scheme so the browser navigates. */
export function normalizeUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) return "";
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
    if (/^mailto:/i.test(trimmed)) return trimmed;
    return "https://" + trimmed;
}

/** Best default icon for a URL — GitHub links get the GitHub mark. */
export function defaultIconFor(url: string): IconKind {
    return /(^|\/\/|\.)github\.com\b/i.test(url) ? "github" : "globe";
}

export interface ChipMetrics {
    width: number;
    height: number;
    fontSize: number;
    iconSize: number;
    padX: number;
    padY: number;
    gap: number;
    radius: number;
}

/**
 * Estimate the on-canvas box for a chip. The worker can't measure text, so we
 * approximate width from character count; a little slack keeps the label from
 * clipping. Sizes scale with `fontSize`.
 */
export function chipMetrics(
    label: string,
    hasIcon: boolean,
    fontSize = 16
): ChipMetrics {
    const iconSize = Math.round(fontSize * 1.15);
    const padX = Math.round(fontSize * 0.75);
    const padY = Math.round(fontSize * 0.55);
    const gap = Math.round(fontSize * 0.5);
    const radius = Math.round(fontSize * 0.7);
    // ~0.6em per glyph is a safe over-estimate for the default UI font.
    const textWidth = Math.ceil(label.length * fontSize * 0.6) + 6;
    const iconChunk = hasIcon ? iconSize + gap : 0;
    const width = padX * 2 + iconChunk + textWidth;
    const height = padY * 2 + Math.max(iconSize, Math.ceil(fontSize * 1.25));
    return { width, height, fontSize, iconSize, padX, padY, gap, radius };
}

/** Parse `#rgb`/`#rrggbb` to [r,g,b], or null if it isn't a hex color. */
function hexToRgb(hex: string): [number, number, number] | null {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return null;
    let h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Nudge a hex color toward white (amount > 0) or black (amount < 0), for the
 * hover state. Non-hex inputs (e.g. a CSS var) are returned unchanged.
 */
export function shade(hex: string, amount: number): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const t = amount < 0 ? 0 : 255;
    const p = Math.abs(amount);
    const mix = (c: number) => Math.round(c + (t - c) * p);
    const [r, g, b] = rgb.map(mix);
    return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}
