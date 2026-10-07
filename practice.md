# Practice — how we work on this project

## Working rules
1. **Every change is committed and pushed** to `main` right away, so stakeholders can follow along on the live site.
2. **`spec.md` and `practice.md` are updated in the same commit** as the change that affects them. The spec describes _what_ the dashboard does; this file records _how_ we work and _what changed when_.
3. One logical change per commit, with a clear imperative message (e.g. `Add carrier scorecard`).
4. No build step. Plain HTML, CSS and JavaScript (ES modules). External libraries come from cdnjs only: Chart.js (always loaded), plus html2canvas and jsPDF (loaded lazily on first PDF export).
5. Mock data must stay **deterministic** (fixed seed), so screenshots and numbers are reproducible.
6. KPI math lives in pure functions in `js/kpis.js`. The UI never calculates business numbers itself.
7. **Every change must work in light AND dark mode, be readable, and be responsive on mobile and desktop.** Nothing is pushed until it passes the checklist below.
8.**Whenever `js/data.js` changes, re-run `node scripts/export-airtable.mjs`** and commit the regenerated `data/airtable/*.csv` in the same commit, so Airtable and the dashboard never drift. Airtable field names are a contract for the future sync; don't rename them.

## Definition of done (run for every change)
- [ ] **Light mode and dark mode**: check both, using the OS setting and the header toggle.
- [ ] **Widths**: phone (375px), tablet (768px), and desktop browser areas 1366×657, 1536×730, 1920×960 and 2560×1300. On desktop the page must **not scroll** (single-screen fit layout); only long tables may scroll inside their card.
- [ ] **No horizontal page scroll** at any width (`scrollWidth === clientWidth`), and no table overflowing its card.
- [ ] **No clipped or overlapping text**, and no text smaller than 11px.
- [ ] **Contrast**: every text/background token pair is ≥ 4.5:1 and status dots/bars are ≥ 3:1, in both themes. Re-run the contrast check whenever a color token changes.
- [ ] **Tap targets**: header controls are ≥ 32px tall on phones.
- [ ] **Drill-down sheets** open and are readable at phone and desktop width.
- [ ] **PDF export** still produces one clean 16:9 snapshot page (always light mode, fit layout) if the change touches layout. Check that pills and legends are not garbled.
- [ ] **No console errors.**
- [ ] The change-log row below says what was verified.

## Design conventions
- All colors, radii, shadows and fonts are CSS custom properties on `:root`. Dark values are defined twice: under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, and under `:root[data-theme="dark"]` for the manual toggle. Keep both blocks in sync. Never hard-code a color in a component.
- Avoid CSS color functions html2canvas cannot parse (e.g. `color-mix()`), or PDF export breaks. Use plain hex/rgba tokens.
- html2canvas also mis-renders text with negative letter-spacing and text inside `inline-flex` boxes. The export CSS neutralises both; new pill-like components need an inline-block rule under `body.exporting`.
- Anything that should look different in the PDF goes under `body.exporting` in `styles.css`. Phone-only layout rules are scoped with `body:not(.exporting)` so they never leak into a PDF exported from a phone.
- **Fit layout** (single-screen desktop): `html.fit` is set when `(min-width: 1200px) and (min-height: 620px)` matches. That query appears twice (the inline head script in `index.html` and `FIT_QUERY` in `app.js`); keep them identical. Fit rules live under `html.fit`; tablet/phone panel rules are scoped to `html:not(.fit)`. PDF export forces `.fit`, so it always gets the desktop layout.
- Use `hide-fit` for columns that don't fit the one-screen layout. Use the `label-short` / `delta-label` / `delta-note` pattern to trim text on smaller desktops, and keep the full text in a tooltip.
- Tables: on phones (≤640px) every `table.data` becomes stacked cards. The first cell is the card title, and other cells show their column name, taken from `data-label` (set by `labelTables()` in `app.js`). Give a cell `class="wide"` to span the full card width. Use `hide-sm` / `hide-md` to drop secondary columns at phone / tablet widths.
- Light-mode colors use Apple's accessible variants (e.g. blue `#0066cc`, text-2 `#515154`, text-3 `#6e6e73`), not the brighter stock system colors, which fail contrast on white.
- Status colors mean the same thing everywhere: green = on target, orange = watch, red = action, blue = neutral/accent.
- Numbers: `Intl.NumberFormat` with en-US locale. Percent to 1 decimal, currency to 2 decimals, counts with thousands separators.
- Every chart and tile must still work (and say so clearly) when a filter leaves no data.

## Repo layout
```
index.html        page shell
css/styles.css    design tokens + components
js/data.js        seeded mock data generator
js/kpis.js        pure KPI functions
js/charts.js      Chart.js wrappers
js/app.js         filters, rendering, drill-down, theme toggle, export wiring
js/export.js      PDF export (html2canvas + jsPDF, A4 landscape)
js/package.json   marks js/ as ES modules so Node can run KPI checks
scripts/export-airtable.mjs  writes data/airtable/*.csv from getData()
data/airtable/    CSVs for Airtable import + README (import steps, data dictionary)
.gitattributes    keeps the CSVs byte-exact (CRLF) in git
spec.md           product spec
practice.md       this file
```

## Change log
| Date | Change |
|------|--------|
| 2026-10-07 | Project kickoff. Wrote `spec.md`, `practice.md`, `README.md`. Decisions: mock data, GitHub Pages (public repo), English LTR, KPIs = SLA, at-risk orders, inventory health, cost & carriers, multi-region network, filters + drill-down, plain HTML/CSS/JS. |
| 2026-10-07 | Made repo public and enabled GitHub Pages (`main` / root). Live at https://idandantane.github.io/claude_code_practice/ |
| 2026-10-07 | Added Apple-style design tokens (`css/styles.css`, with light + dark mode) and the page shell (`index.html`): translucent header with filters, hero, sections for Service, At-risk, Inventory and Carriers, and the drill-down sheet. |
| 2026-10-07 | Added seeded mock data generator (`js/data.js`: ~11.7k orders over 180 days, 6 warehouses, 5 fictional carriers, 80 SKUs) and pure KPI functions (`js/kpis.js`). Built-in storylines: Atlas Parcel's reliability drops over the last 3 weeks; Singapore has stockouts and slow processing. Added `js/package.json` (`type: module`) so the same files run in Node for KPI sanity checks. |
| 2026-10-07 | Built v1 of the dashboard: `js/charts.js` (Chart.js wrappers themed from CSS tokens) and `js/app.js` (filters synced to the URL hash, 9 KPI tiles with deltas and status, generated executive summary, SLA trend, breaches by region/warehouse, at-risk table, inventory charts, carrier scorecard, weekly cost trend, drill-down sheet with order detail). Verified locally in light/dark mode and at 375px; no console errors. Spec updated with exact KPI definitions as built. |
| 2026-10-07 | Added **Export PDF** (`js/export.js`): a 3-page A4 landscape PDF of the current view, always light mode at a fixed desktop layout, with header/footer and page numbers. Added a **light/dark toggle** (sun/moon button, saved in localStorage, applied before first paint; default still follows the OS). Header now puts brand + actions on one row on narrower screens. Replaced `color-mix()` with a `--focus-ring` token (html2canvas can't parse it). Verified: toggle both ways + persistence after reload; PDF exported from both 800px and 375px viewports renders identically with no clipped columns. |
| 2026-10-07 | **New standing rule:** every change verified in light + dark, readable, responsive on mobile + desktop (Definition of done checklist added above). Ran a full audit and fixed what it found. **Contrast:** light-mode tertiary text, links, green text, pills and status dots failed WCAG; switched to Apple's accessible variants. In dark mode the red/blue pills and the white-on-blue button failed; fixed with new `--red`, `--blue` and `--btn-bg` tokens. All 18 pairs now pass in both themes. **Mobile:** every table overflowed at 375px (up to 292px); tables are now stacked labelled cards on phones, the at-risk list shows the top 5 (View all for the rest), section titles stack above subtitles, the header scrolls away instead of pinning, and header controls are ≥32px tall. **Tablet:** the at-risk table overflowed 162px; the Customer column is hidden at 641–1100px and chips wrap sooner. **PDF:** phone layout rules are scoped away from export; verified a PDF exported from a phone in dark mode is identical to desktop. Verified at 375 / 768 / 1440px in both themes, plus the drill-down sheets; no console errors. |
| 2026-10-07 | **Phone accessories data:** the catalog is now 80 SKUs (40 products × 2 variants) across Chargers, Cables, Audio (earphones/TWS), Power Banks, Creator Gear (selfie sticks, ring lights, gimbals), Mounts and Protection, with realistic unit costs. Customers are retail partners and orders are wholesale (5–100 units in packs of 5, ~$630 avg). Battery products stock out ~2.6× more often. Cost targets moved to $18/order and $13/shipment. **Single-screen desktop:** full-width 16:9 "fit" layout (summary row, 9-tile KPI strip, 12-column panel grid in two rows) with no page scrolling at ≥1200×620. Compact rules for smaller desktops: short labels, the comparison shown once, top two reason chips + "+N", subtitles moved to tooltips. Tablet: 2 columns; phone: 1 column. **PDF** is now a one-page 16:9 snapshot; fixed html2canvas garbling of pill and legend text (it mis-renders negative letter-spacing and text inside inline-flex boxes), so export uses letter-spacing 0 and inline-block pills. Tablet header controls are now touch-sized too. Verified: no page scroll and no truncation at 1366×657, 1536×730 (dark), 1920×960 and 2560×1300; tablet 768 (dark) and phone 375 (light) with no overflow, including drill-down sheets; PDF exported from phone in dark mode; no console errors. |
| 2026-10-07 | **Airtable export:** added `scripts/export-airtable.mjs`, which writes 6 CSVs to `data/airtable/` (Regions 3, Warehouses 6, Carriers 5, Products 80, Inventory 480, Orders 11,678; 12,252 records, within the Team plan's 50k/base), plus `data/airtable/README.md` with import steps and the data dictionary. Chosen format: CSV (UTF-8, one file per table), Airtable's native import. Verified with a strict RFC 4180 re-parse: column counts, unique IDs, all references resolve, ISO dates. KPIs recomputed from the CSVs (SLA 92.12%, 162 breaches, 26 at risk, $19.37/order, 17 stockouts, 40.6 days of supply) match the dashboard exactly. No UI change. The live sync is planned for a separate repo. |
