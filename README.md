# Link Chips — a Drawdy extension

Clickable **link-chip stickers** on the Drawdy canvas: a logo (GitHub mark or a
generic globe) + a clean label (`https://github.com/gastownhall/beads` shows as
**`gastownhall/beads`**), in colors you pick. Click a chip to open its URL.

`driverId: drawdy.link-chip` · permissions: `dom`, `scene`, `storage`.

## Use it

**Press the GitHub action button** (added to Drawdy's UI):
- With a **link-text element selected** → the customizer opens prefilled with that URL; confirm to **replace the text with a chip**.
- With a **chip selected** → edit it.
- With **nothing selected** → add a new chip from scratch.

The customizer offers: URL, auto-derived label, icon (GitHub mark / globe / none), **icon+text color**, **background color** — including a **transparent** variant — with a live preview.

Also on **right-click → Link chip**: Add / Edit selected / Open selected.

**Clicking a chip** opens its URL in a new tab.

Each chip stores its URL + style in the element's `meta`, so it's self-describing — the extension reads a click target's meta to know where it points; nothing to keep in sync, and chips survive reloads.

## Develop

```bash
npm install
npm run dev          # Vite on http://localhost:5173 (regenerates HTML assets first)
```
Then in Drawdy, on a **local** board: `⌘K` → **Add extension dev server** → `localhost:5173`. Saves hot-reload.

```bash
npm run build        # -> dist/drawdy-link-chip.drawdyx  (the installable extension)
npm run typecheck
```

## Layout

```
manifest.json        driverId, permissions
src/index.ts         the driver: menus, click-to-open, form + open flows
src/chip.ts          builds the `component` chip element (+ reads it back from meta)
src/icons.ts         GitHub + globe SVG builders (AUTO-GENERATED from the source SVG)
src/util.ts          label stripping, URL normalize, chip sizing, color shading
assets/form.html     the create/edit form webview (source)
assets/opener.html   the "open in new tab" bridge webview (source)
src/form-html.ts     ┐ AUTO-GENERATED from assets/*.html by scripts/gen-assets.mjs
src/opener-html.ts   ┘ (runs automatically on predev/prebuild)
```
`build.ts`, `bundle.ts`, `vite-plugin-drawdy.ts` are the starter's build harness — untouched.

> Editing `assets/*.html` mid-`dev`: run `npm run gen` (or restart `dev`) to re-bake them into the bundle.

## Known caveat — opening the tab

Drivers run in a sandboxed worker with no way to open an external URL directly, so
opening goes through a tiny **opener webview** that calls `window.open`. Browsers
may block a popup that isn't tied to a click *inside that frame*, so the opener
also shows an **Open in new tab** button (always works) and a **Copy URL** fallback.
If your setup blocks the auto-open, that button is the one-tap path. (This is the
one behavior that can't be verified outside a running Drawdy — see how it lands.)
