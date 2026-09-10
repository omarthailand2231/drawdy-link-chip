// Link Chips — a Drawdy driver.
//
// Adds clickable "link chip" stickers to the canvas: a logo + a clean label
// (e.g. `gastownhall/beads`) in a rounded pill, in colors you choose. Clicking
// a chip opens its URL in a new tab.
//
// Flow map:
//   context menu "Link chip"
//     ├─ Add link chip…        → form webview → add a `component` chip
//     ├─ Edit selected chip…   → form webview (prefilled) → replace the chip
//     └─ Open selected chip ↗  → open its URL
//   click a chip on the canvas → subscription:scene:click → open its URL
//
// Each chip stores { linkChip, url, label, colors } in its element `meta`, so a
// chip is self-describing: any click target's meta tells us where it points,
// with no driver-side registry to keep in sync.

import type {
    DriverCommandIssuer,
    DriverModule,
    DriverSubscriptionEvent,
    ModuleStyling,
} from "@drawdy/driver-protocol";
import { githubSvg } from "./icons";
import {
    buildChipElement,
    chipConfigFromMeta,
    chipSize,
    DEFAULT_FONT_SIZE,
    type ChipConfig,
} from "./chip";
import { deriveLabel, extractUrl, normalizeUrl } from "./util";
import { FORM_HTML } from "./form-html";
import { OPENER_HTML } from "./opener-html";

// ── identity / plumbing ────────────────────────────────────────────────────
let issue: DriverCommandIssuer;
let generateId: () => string;
let driverId: string;
let styling: ModuleStyling;
let requestSeq = 0;
const nextRequestId = () => String(requestSeq++);

const MENU_ROOT = "link-chip:root";
const MENU_ADD = "link-chip:add";
const MENU_EDIT = "link-chip:edit";
const MENU_OPEN = "link-chip:open";
const FORM_ID = "link-chip:form";
const OPENER_ID = "link-chip:opener";
const ACTION_ID = "link-chip:action";
const KV_DEFAULTS = "defaults";

// ── per-session state ───────────────────────────────────────────────────────
const chipConfigById = new Map<string, ChipConfig>(); // known chips
const notChip = new Set<string>(); // ids we've checked that aren't chips
const subscribedWebviews = new Set<string>();
let pendingFormInit: unknown = null; // sent once the form webview says "ready"
let pendingOpen: unknown = null; // sent once the opener webview says "ready"
let lastShiftMs = 0; // scene:click carries no modifiers; we track Shift separately
const SHIFT_WINDOW_MS = 1500;

// Any thrown/rejected issue is swallowed to a null response; callers branch on
// res.error, and a dead command must never take down onEvent.
type AnyRes = { res: { error?: unknown; value?: any } };
async function call(req: any): Promise<AnyRes | null> {
    try {
        return (await issue(req)) as unknown as AnyRes;
    } catch {
        return null;
    }
}
const ok = (r: AnyRes | null): r is AnyRes & { res: { value: any } } =>
    !!r && !r.res.error;

// ── activate ────────────────────────────────────────────────────────────────
export const activate: DriverModule["activate"] = async (ctx) => {
    issue = ctx.issueCommand;
    generateId = ctx.generateId;
    driverId = ctx.manifest.driverId;
    styling = ctx.styling;

    await call({
        type: "command:context-menu:add",
        driverId,
        requestId: nextRequestId(),
        req: {
            menuId: MENU_ROOT,
            menuTitle: "Link chip",
            children: [
                { menuId: MENU_ADD, menuTitle: "Add link chip…" },
                { menuId: MENU_EDIT, menuTitle: "Edit selected chip…" },
                { menuId: MENU_OPEN, menuTitle: "Open selected chip ↗" },
            ],
        },
    });

    for (const menuId of [MENU_ADD, MENU_EDIT, MENU_OPEN]) {
        await call({
            type: "subscription:context-menu:clicked",
            driverId,
            requestId: nextRequestId(),
            req: { menuId },
        });
    }

    await call({
        type: "subscription:scene:click",
        driverId,
        requestId: nextRequestId(),
        req: {},
    });

    // The GitHub action button — the visible entry point. Select a link and
    // press it to turn the text into a chip (with the customizer for options).
    await createActionButton();
    await call({
        type: "subscription:dom:element-clicked",
        driverId,
        requestId: nextRequestId(),
        req: { domElementId: ACTION_ID },
    });

    await call({
        type: "subscription:dom:theme-changed",
        driverId,
        requestId: nextRequestId(),
    });

    // Shift isn't reported on scene:click, so track it via control-keys and
    // treat a click within SHIFT_WINDOW_MS of a Shift event as shift+click.
    await call({
        type: "subscription:keyboard:control-keys",
        driverId,
        requestId: nextRequestId(),
    });

    // Register webview listeners up front; harmless if the webviews don't exist
    // yet, and re-ensured after each create in case the host requires it.
    await ensureWebviewSub(FORM_ID);
    await ensureWebviewSub(OPENER_ID);
};

// ── event dispatch ────────────────────────────────────────────────────────
export const onEvent: DriverModule["onEvent"] = async (
    event: DriverSubscriptionEvent
) => {
    switch (event.type) {
        case "subscription:context-menu:clicked": {
            const id = (event.body as { menuId: string }).menuId;
            if (id === MENU_ADD) await openForm("create");
            else if (id === MENU_EDIT) await editSelected();
            else if (id === MENU_OPEN) await openSelected();
            return;
        }
        case "subscription:scene:click": {
            const ids = (event.body as { drawdyElementIds: string[] })
                .drawdyElementIds;
            const shift = Date.now() - lastShiftMs < SHIFT_WINDOW_MS;
            await handleChipClick(ids, shift);
            return;
        }
        case "subscription:keyboard:control-keys": {
            if ((event.body as { shift?: boolean }).shift) {
                lastShiftMs = Date.now();
            }
            return;
        }
        case "subscription:dom:element-clicked": {
            const id = (event.body as { domElementId: string }).domElementId;
            if (id === ACTION_ID) await onActionPressed();
            return;
        }
        case "subscription:webview:message": {
            const body = event.body as { webviewDomId: string; message: any };
            await handleWebviewMessage(body.webviewDomId, body.message);
            return;
        }
        case "subscription:dom:theme-changed": {
            styling = (event.body as { styling: ModuleStyling }).styling;
            await createActionButton(); // refresh the icon color for the new theme
            return;
        }
    }
};

// ── webview messaging ────────────────────────────────────────────────────
async function ensureWebviewSub(webviewDomId: string): Promise<void> {
    if (subscribedWebviews.has(webviewDomId)) return;
    const r = await call({
        type: "subscription:webview:message",
        driverId,
        requestId: nextRequestId(),
        req: { webviewDomId },
    });
    if (ok(r)) subscribedWebviews.add(webviewDomId);
}

async function handleWebviewMessage(
    webviewDomId: string,
    message: any
): Promise<void> {
    const kind = message && message.kind;
    if (webviewDomId === FORM_ID) {
        if (kind === "ready") {
            if (pendingFormInit) await postTo(FORM_ID, pendingFormInit);
        } else if (kind === "submit") {
            await handleSubmit(message);
        } else if (kind === "cancel") {
            await hide(FORM_ID);
            pendingFormInit = null;
        }
    } else if (webviewDomId === OPENER_ID) {
        if (kind === "ready") {
            if (pendingOpen) await postTo(OPENER_ID, pendingOpen);
        } else if (kind === "opened" || kind === "close") {
            await hide(OPENER_ID);
            pendingOpen = null;
        }
    }
}

async function postTo(webviewDomId: string, message: unknown): Promise<void> {
    await call({
        type: "command:webview:post-message",
        driverId,
        requestId: nextRequestId(),
        req: { webviewDomId, message },
    });
}

async function hide(webviewDomId: string): Promise<void> {
    await call({
        type: "command:webview:hide",
        driverId,
        requestId: nextRequestId(),
        req: { webviewDomId },
    });
}

// ── the GitHub action button ───────────────────────────────────────────────
async function createActionButton(): Promise<void> {
    const color = styling?.foreground || "#f3f2f4";
    await call({
        type: "command:dom:create-action-button",
        driverId,
        requestId: nextRequestId(),
        req: { domElementId: ACTION_ID, svg: githubSvg(color, 20) },
    });
}

/**
 * Pressed the GitHub button. In priority order:
 *   1. a selected text element containing a URL → open the customizer to turn
 *      that text into a chip (replacing it),
 *   2. a selected chip → edit it,
 *   3. nothing suitable → open the blank "add" form.
 */
async function onActionPressed(): Promise<void> {
    const ids = await currentSelection();
    if (ids.length) {
        const r = await call({
            type: "command:scene:get-drawdy-elements",
            driverId,
            requestId: nextRequestId(),
            req: {
                properties: ["type", "text", "meta", "x", "y"],
                drawdyElementIds: ids,
            },
        });
        const els: any[] = ok(r) ? r.res.value.drawdyElements ?? [] : [];

        for (const el of els) {
            if (el.type === "text" && typeof el.text === "string") {
                const url = extractUrl(el.text);
                if (url) {
                    await openForm(
                        "linkify",
                        { url: normalizeUrl(url) },
                        String(el.id)
                    );
                    return;
                }
            }
        }
        for (const el of els) {
            const cfg = chipConfigFromMeta(el.meta);
            if (cfg) {
                await openForm("edit", cfg, String(el.id));
                return;
            }
        }
    }
    await openForm("create");
}

// ── the create / edit form ─────────────────────────────────────────────────
async function openForm(
    mode: "create" | "edit" | "linkify",
    prefill?: Partial<ChipConfig>,
    editId?: string
): Promise<void> {
    const defaults = mode === "edit" ? null : await loadDefaults();
    pendingFormInit = {
        kind: "init",
        mode,
        editId: editId ?? null,
        styling,
        prefill: {
            url: prefill?.url ?? "",
            label: prefill?.label ?? "",
            fg: prefill?.fg ?? defaults?.fg ?? "#e8b7a0",
        },
    };
    await call({
        type: "command:webview:create",
        driverId,
        requestId: nextRequestId(),
        req: { webviewDomId: FORM_ID, htmlContent: FORM_HTML },
    });
    await ensureWebviewSub(FORM_ID);
}

async function handleSubmit(msg: any): Promise<void> {
    const url = normalizeUrl(String(msg.url ?? ""));
    if (!url) {
        await hide(FORM_ID);
        return;
    }
    const label = String(msg.label ?? "").trim() || deriveLabel(url);
    const fg = String(msg.fg ?? "#e8b7a0");
    const cfg: ChipConfig = { url, label, fg, fontSize: DEFAULT_FONT_SIZE };

    void saveDefaults({ fg });

    let x: number, y: number;
    if (msg.editId) {
        // edit a chip, or linkify a selected text element: drop the original and
        // place the new chip where it was.
        const pos = await chipPosition(String(msg.editId));
        x = pos.x;
        y = pos.y;
        await call({
            type: "command:scene:remove-drawdy-elements",
            driverId,
            requestId: nextRequestId(),
            req: { drawdyElementIds: [String(msg.editId)] },
        });
        chipConfigById.delete(String(msg.editId));
    } else {
        const { width, height } = chipSize(cfg);
        const c = await viewportCenter();
        x = c.x - width / 2;
        y = c.y - height / 2;
    }

    const id = generateId();
    const r = await call({
        type: "command:scene:add-drawdy-elements",
        driverId,
        requestId: nextRequestId(),
        req: { elements: [buildChipElement(cfg, id, x, y)] },
    });

    await hide(FORM_ID);
    pendingFormInit = null;

    if (!ok(r)) return; // scene permission denied, etc. — nothing placed
    chipConfigById.set(id, cfg);
    notChip.delete(id);
    await call({
        type: "command:scene:set-selection",
        driverId,
        requestId: nextRequestId(),
        req: { drawdyElementIds: [id] },
    });
}

// ── open a chip ───────────────────────────────────────────────────────────
async function handleChipClick(ids: string[], shift: boolean): Promise<void> {
    for (const id of ids) {
        const cfg = await resolveChip(id);
        if (cfg) {
            await openUrl(cfg.url, cfg.label, shift); // shift+click → open directly
            return; // open the topmost chip only
        }
    }
}

async function openSelected(): Promise<void> {
    const ids = await currentSelection();
    for (const id of ids) {
        const cfg = await resolveChip(id);
        if (cfg) {
            await openUrl(cfg.url, cfg.label);
            return;
        }
    }
}

async function editSelected(): Promise<void> {
    const ids = await currentSelection();
    for (const id of ids) {
        const cfg = await resolveChip(id);
        if (cfg) {
            await openForm("edit", cfg, id);
            return;
        }
    }
}

async function openUrl(
    url: string,
    label: string,
    direct = false
): Promise<void> {
    // direct (shift+click): the opener tries window.open and closes silently on
    // success, only falling back to the card if the browser blocks it.
    pendingOpen = { kind: "open", url, label, styling, direct };
    await call({
        type: "command:webview:create",
        driverId,
        requestId: nextRequestId(),
        req: { webviewDomId: OPENER_ID, htmlContent: OPENER_HTML },
    });
    await ensureWebviewSub(OPENER_ID);
}

// ── scene lookups ───────────────────────────────────────────────────────────
/** Resolve a scene element id to its ChipConfig, or null if it isn't a chip. */
async function resolveChip(id: string): Promise<ChipConfig | null> {
    const cached = chipConfigById.get(id);
    if (cached) return cached;
    if (notChip.has(id)) return null;

    const r = await call({
        type: "command:scene:get-drawdy-elements",
        driverId,
        requestId: nextRequestId(),
        req: { properties: ["meta"], drawdyElementIds: [id] },
    });
    if (!ok(r)) return null;
    const el = (r.res.value.drawdyElements ?? [])[0];
    const cfg = chipConfigFromMeta(el?.meta);
    if (cfg) {
        chipConfigById.set(id, cfg);
        return cfg;
    }
    notChip.add(id);
    return null;
}

async function currentSelection(): Promise<string[]> {
    const r = await call({
        type: "command:scene:get-current-selected-drawdy-elements",
        driverId,
        requestId: nextRequestId(),
    });
    return ok(r) ? (r.res.value.drawdyElementIds ?? []) : [];
}

async function chipPosition(id: string): Promise<{ x: number; y: number }> {
    const r = await call({
        type: "command:scene:get-drawdy-elements",
        driverId,
        requestId: nextRequestId(),
        req: { properties: ["x", "y"], drawdyElementIds: [id] },
    });
    const el = ok(r) ? (r.res.value.drawdyElements ?? [])[0] : undefined;
    if (el && typeof el.x === "number" && typeof el.y === "number") {
        return { x: el.x, y: el.y };
    }
    return viewportCenter();
}

async function viewportCenter(): Promise<{ x: number; y: number }> {
    const r = await call({
        type: "command:camera:get-viewport-rect",
        driverId,
        requestId: nextRequestId(),
    });
    if (ok(r) && r.res.value.rect) {
        const { x, y, width, height } = r.res.value.rect;
        return { x: x + width / 2, y: y + height / 2 };
    }
    return { x: 0, y: 0 };
}

// ── remembered defaults (best-effort; storage may be denied) ────────────────
async function loadDefaults(): Promise<Partial<ChipConfig> | null> {
    const r = await call({
        type: "command:kv-storage:get",
        driverId,
        requestId: nextRequestId(),
        req: { key: KV_DEFAULTS },
    });
    if (!ok(r)) return null;
    const g = r.res.value.got;
    return g ? (g as Partial<ChipConfig>) : null;
}

async function saveDefaults(d: { fg: string }): Promise<void> {
    await call({
        type: "command:kv-storage:set",
        driverId,
        requestId: nextRequestId(),
        req: { key: KV_DEFAULTS, payload: d },
    });
}
