// Builds the on-canvas chip. A chip is a `component` scene element: a live
// DomElementSchema (icon + label in a rounded row) that pans and zooms with the
// board. Its URL and style live in `meta` so a chip is fully self-describing —
// any session can read a click target's meta and know where it points.

import type {
    Dimension,
    DomElementSchema,
    DrawdyElementSchema,
} from "@drawdy/driver-protocol";
import { iconSvg, svgDataUri, type IconKind } from "./icons";
import { chipMetrics, shade } from "./util";

export interface ChipConfig {
    /** Full, scheme-qualified URL to open. */
    url: string;
    /** Clean display label (see deriveLabel). */
    label: string;
    iconKind: IconKind;
    /** Icon + text color (the accent). */
    fg: string;
    /** Pill background color. */
    bg: string;
    fontSize?: number;
}

/** Marker written into a chip's `meta` so clicks can be recognized as ours. */
export const CHIP_FLAG = "linkChip";

const px = (n: number): Dimension => [n, "px"];
const pct = (n: number): Dimension => [n, "%"];

function chipSchema(cfg: ChipConfig): DomElementSchema {
    const hasIcon = cfg.iconKind !== "none";
    const m = chipMetrics(cfg.label, hasIcon, cfg.fontSize ?? 16);
    const children: DomElementSchema[] = [];

    const svg = iconSvg(cfg.iconKind, cfg.fg, m.iconSize);
    if (svg) {
        children.push({
            type: "image",
            domId: "chip-icon",
            child: svgDataUri(svg), // data URI: raw SVG string won't load as an <img>

            styles: {
                width: px(m.iconSize),
                height: px(m.iconSize),
                pointerEvents: "none", // let clicks fall through to the chip
            },
        });
    }
    children.push({
        type: "text",
        domId: "chip-label",
        child: cfg.label,
        styles: {
            color: cfg.fg,
            fontSize: px(m.fontSize),
            fontWeight: "semibold",
            pointerEvents: "none",
        },
    });

    const transparent = cfg.bg === "transparent" || cfg.bg === "none";
    const bg = transparent ? "transparent" : cfg.bg;
    const border = transparent ? "transparent" : shade(cfg.bg, 0.14);
    const hoverBg = transparent ? "rgba(255,255,255,0.08)" : shade(cfg.bg, 0.08);

    return {
        type: "row",
        domId: "chip-root",
        styles: {
            width: pct(100),
            height: pct(100),
            backgroundColor: bg,
            borderColor: border,
            borderType: "solid",
            borderWidth: px(1),
            borderRadius: px(m.radius),
            padding: px(m.padY), // horizontal inset comes from centering slack
            gap: m.gap,
            mainAxisAlignment: "center",
            crossAxisAlignment: "center",
            overflow: "hidden",
            cursor: "pointer",
            hover: { backgroundColor: hoverBg },
        },
        children,
    };
}

/** The full `component` element ready for `command:scene:add-drawdy-elements`. */
export function buildChipElement(
    cfg: ChipConfig,
    drawdyElementId: string,
    x: number,
    y: number
): DrawdyElementSchema {
    const hasIcon = cfg.iconKind !== "none";
    const m = chipMetrics(cfg.label, hasIcon, cfg.fontSize ?? 16);
    return {
        type: "component",
        drawdyElementId,
        x,
        y,
        width: m.width,
        height: m.height,
        meta: {
            [CHIP_FLAG]: true,
            url: cfg.url,
            label: cfg.label,
            iconKind: cfg.iconKind,
            fg: cfg.fg,
            bg: cfg.bg,
            fontSize: cfg.fontSize ?? 16,
        },
        schema: chipSchema(cfg),
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
        bg: typeof meta.bg === "string" ? meta.bg : "#1f1a17",
        fontSize: typeof meta.fontSize === "number" ? meta.fontSize : 16,
    };
}
