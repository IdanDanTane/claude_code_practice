# Practice — how we work on this project

## Working rules
1. **Every change is committed and pushed** to `main` right away, so stakeholders can follow along on the live site.
2. **`spec.md` and `practice.md` are updated in the same commit** as the change that affects them. The spec describes _what_ the dashboard does; this file records _how_ we work and _what changed when_.
3. One logical change per commit, with a clear imperative message (e.g. `Add carrier scorecard`).
4. No build step. Plain HTML, CSS and JavaScript (ES modules). External libraries come from cdnjs only: Chart.js (always loaded), plus html2canvas and jsPDF (loaded lazily on first PDF export).
5. Mock data must stay **deterministic** (fixed seed), so screenshots and numbers are reproducible.
6. KPI math lives in pure functions in `js/kpis.js`. The UI never calculates business numbers itself.

## Design conventions
- All colors, radii, shadows and fonts are CSS custom properties on `:root`. Dark values are defined twice: under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, and under `:root[data-theme="dark"]` for the manual toggle. Keep both blocks in sync. Never hard-code a color in a component.
- Avoid CSS color functions html2canvas cannot parse (e.g. `color-mix()`), or PDF export breaks. Use plain hex/rgba tokens.
- Anything that should look different in the PDF goes under `body.exporting` in `styles.css`.
- Status colors mean the same thing everywhere: green = on target, orange = watch, red = action, blue = neutral/accent.
- Numbers: `Intl.NumberFormat` with en-US locale. Percent to 1 decimal, currency to 2 decimals, counts with thousands separators.
- Every chart and tile must still work (and say so clearly) when a filter leaves no data.
- Check at 375px width and in dark mode before pushing a UI change.

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
