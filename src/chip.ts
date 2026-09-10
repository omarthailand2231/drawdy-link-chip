// Builds the on-canvas chip as a plain native `text` element — real Drawdy text,
// so it's a first-class interactive element you can click. The full URL lives in
// the element's `meta`; the extension reads it on click and opens it.
//
// (An `image` element isn't clickable the way text is, and Drawdy's protocol has
// no way to embed an icon in text or group two elements — so the chip is text.)

import type { DrawdyElementSchema } from "@drawdy/driver-protocol";

export interface ChipConfig {
    /** Full, scheme-qualified URL to open. */
    url: string;
    /** Clean display label (see deriveLabel). */
    label: string;
    /** Text color. */
    fg: string;
    fontSize?: number;
}

export const DEFAULT_FONT_SIZE = 24;

/** Marker written into a chip's `meta` so clicks can be recognized as ours. */
export const CHIP_FLAG = "linkChip";

/** Rough on-canvas size of the label — the worker can't measure text. */
export function chipSize(cfg: ChipConfig): { width: number; height: number } {
    const fontSize = cfg.fontSize ?? DEFAULT_FONT_SIZE;
    return {
        width: Math.ceil(cfg.label.length * fontSize * 0.6) + 4,
        height: Math.ceil(fontSize * 1.25),
    };
}

/** The native `text` element ready for `command:scene:add-drawdy-elements`. */
export function buildChipElement(
    cfg: ChipConfig,
    drawdyElementId: string,
    x: number,
    y: number
): DrawdyElementSchema {
    const fontSize = cfg.fontSize ?? DEFAULT_FONT_SIZE;
    return {
        type: "text",
        drawdyElementId,
        x,
        y,
        text: cfg.label,
        fontSize,
        color: cfg.fg,
        meta: {
            [CHIP_FLAG]: true,
            url: cfg.url,
            label: cfg.label,
            fg: cfg.fg,
            fontSize,
        },
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
        fg: typeof meta.fg === "string" ? meta.fg : "#e8b7a0",
        fontSize:
            typeof meta.fontSize === "number" ? meta.fontSize : DEFAULT_FONT_SIZE,
    };
}
