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

The customizer offers: URL, auto-derived label, and **text color**, with a live preview.

Also on **right-click → Link chip**: Add / Edit selected / Open selected.

**Clicking a chip** opens its URL in a new tab; **shift+click** opens it directly.

## What a chip is

A chip is a **plain native `text` element** — real Drawdy text, so it's a
first-class element you can click. The full URL + style live in the element's
`meta`, which is how the extension recognizes a chip and opens it on click.

No baked-in logo: a `text` element can't contain an image, and DDP has no way to
group two elements — so the chip is text you style with a color. (A separate logo
`image` beside it is possible, but it wouldn't be one clickable unit.)

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

## Known limitations

**Opening without the extension.** Drawdy's protocol exposes no native element
hyperlink (and no grouping), so a driver can't make a chip natively clickable.
A chip *renders* for everyone, but only viewers **with the extension** can click it
to open. There's no way around this until DDP adds a link property.

**Opening the tab.** Even with the extension, a sandboxed driver can't open a URL
directly, so opening goes through a tiny **opener webview** that calls
`window.open`. Browsers may block a popup that isn't tied to a click *inside that
frame*, so the opener also shows an **Open in new tab** button (always works) and a
**Copy URL** fallback. **Shift+click** attempts a silent direct open and only shows
the card if blocked.
