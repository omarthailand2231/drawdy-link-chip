// Builds the on-canvas chip as a SINGLE native `image` element: the logo and
// the label are baked into one SVG. This renders for everyone — no extension
// needed to display it — and is one element, so there's nothing to group.
//
// Only the URL + style live in the element's `meta`, so the extension (when
// present) can read a clicked chip's meta and open it. Without the extension the
// chip still shows; it just isn't clickable — Drawdy's protocol exposes no native
// link, so a driver can't make it natively openable.

import type { DrawdyElementSchema } from "@drawdy/driver-protocol";
import { iconNested, svgDataUri, type IconKind } from "./icons";
import { escapeXml } from "./util";

export interface ChipConfig {
    /** Full, scheme-qualified URL to open. */
    url: string;
    /** Clean display label (see deriveLabel). */
    label: string;
    iconKind: IconKind;
    /** Icon + text color (the one accent). */
    fg: string;
    fontSize?: number;
}

/** Marker written into a chip's `meta` so clicks can be recognized as ours. */
export const CHIP_FLAG = "linkChip";

const FONT =
    "ui-sans-serif,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** The composite SVG (logo + label) and its intrinsic size in canvas units. */
export function buildChipSvg(cfg: ChipConfig): {
    svg: string;
    width: number;
    height: number;
} {
    const fontSize = cfg.fontSize ?? 16;
    const hasIcon = cfg.iconKind !== "none";
    const iconSize = Math.round(fontSize * 1.15);
    const gap = hasIcon ? Math.round(fontSize * 0.5) : 0;
    const height = Math.round(fontSize * 1.5);
    // The worker can't measure text; over-estimate width so the label never
    // clips (extra width is just transparent space on a bg-less chip).
    const textWidth = Math.ceil(cfg.label.length * fontSize * 0.62) + 8;
    const iconChunk = hasIcon ? iconSize + gap : 0;
    const width = iconChunk + textWidth;

    const icon = hasIcon
        ? iconNested(
              cfg.iconKind,
              cfg.fg,
              0,
              Math.round((height - iconSize) / 2),
              iconSize
          )
        : "";
    const text =
        `<text x="${iconChunk}" y="${height / 2}" dominant-baseline="central" ` +
        `font-family="${FONT}" font-size="${fontSize}" font-weight="600" ` +
        `fill="${cfg.fg}">${escapeXml(cfg.label)}</text>`;

    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
        `viewBox="0 0 ${width} ${height}">${icon}${text}</svg>`;

    return { svg, width, height };
}

/** The full native `image` element ready for `command:scene:add-drawdy-elements`. */
export function buildChipElement(
    cfg: ChipConfig,
    drawdyElementId: string,
    x: number,
    y: number
): DrawdyElementSchema {
    const { svg, width, height } = buildChipSvg(cfg);
    return {
        type: "image",
        drawdyElementId,
        x,
        y,
        width,
        height,
        meta: {
            [CHIP_FLAG]: true,
            url: cfg.url,
            label: cfg.label,
            iconKind: cfg.iconKind,
            fg: cfg.fg,
            fontSize: cfg.fontSize ?? 16,
        },
        url: svgDataUri(svg),
    };
}

/** Reconstruct a ChipConfig from a chip element's stored `meta`. */
export function chipConfigFromMeta(
    meta: Record<string, unknown> | undefined
): ChipConfig | null {
    if (!meta || meta[CHIP_FLAG] !== true) return null;
    const url = typeof meta.url === "string" ? meta.url : "";
    if (!url) return null;
    return {
        url,
        label: typeof meta.label === "string" ? meta.label : url,
        iconKind: (meta.iconKind as IconKind) ?? "globe",
        fg: typeof meta.fg === "string" ? meta.fg : "#e8b7a0",
        fontSize: typeof meta.fontSize === "number" ? meta.fontSize : 16,
    };
}
