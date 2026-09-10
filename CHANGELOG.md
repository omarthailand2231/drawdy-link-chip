# Changelog

## 0.3.0
- **Chips are now a plain native `text` element** (was a baked SVG image) — real Drawdy text is a first-class clickable element, so click-to-open works. URL + style live in `meta`.
- Customizer is now URL, label, and **text color** only (icon removed — a text element can't contain an image, and DDP can't group elements).

## 0.2.0
- **Chips are now a single native `image` element** (logo + label baked into one SVG) instead of a driver-rendered `component` — so they render for everyone, with or without the extension, and are one element (no grouping).
- Fixed on-canvas icon not rendering (SVG must be a data URI, not a raw string).
- Customizer simplified to **text & icon color only** (background/transparent removed).
- Honest limitation documented: DDP has no native hyperlink, so non-extension viewers can see a chip but can't click-open it.

## 0.1.0
- Clickable link-chip stickers on the canvas (component elements): logo + clean label.
- GitHub action button: turn a selected link-text into a chip.
- Right-click menu: add / edit / open.
- Customizer webview: URL, auto label, icon (GitHub / globe / none), icon+text and background colors, **transparent** background variant, live preview.
- Click a chip to open its URL; **shift+click** opens directly.
- Labels strip scheme/host (`https://github.com/a/b` → `a/b`).
