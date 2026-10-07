# Logistics & Warehouse Executive Dashboard — Spec

_Last updated: 2026-10-07 (v1.4: Airtable CSV export)_

## 1. Purpose
The business is a **phone accessories brand** (chargers, cables, earphones/TWS, power banks, creator gear such as selfie sticks and ring lights, mounts, cases and screen protectors) that ships wholesale orders to retail partners from six warehouses.

Give the COO and CEO one glanceable page that answers three questions:
1. **Are we keeping our promises?** (SLA compliance and breaches)
2. **What is about to go wrong?** (orders at risk of being delayed or cancelled)
3. **Is the network healthy and efficient?** (inventory health, cost, carrier performance)

## 2. Audience
| User | Needs |
|------|-------|
| CEO  | Headline health in under 10 seconds. Trend direction. Where the money and the risk sit. |
| COO  | Same headline, plus drill-down into regions, warehouses, carriers and the specific orders behind a number. |

The dashboard is read-only. Viewers are not expected to edit data.

## 3. Design language
Apple-inspired (Apple Human Interface Guidelines feel):
- System font stack (`-apple-system, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif`).
- Light canvas `#f5f5f7`, white cards, rounded corners, soft layered shadows. Uses the **full screen width**.
- Translucent sticky header (`backdrop-filter: blur`).
- Apple system colors for status: green (on target), orange (watch), red (action), blue (neutral/accent). Light mode uses Apple's **accessible** variants (e.g. blue `#0066cc`, status dots `#2a9d4a` / `#d67a00` / `#e8291e`), so every text pair meets WCAG AA (≥ 4.5:1) and every status mark is ≥ 3:1, in both themes.
- Light and dark mode. By default it follows the OS setting. A sun/moon button in the header switches it manually, and the choice is remembered in this browser.
- Large numerals and quiet labels. No chart junk: thin gridlines, no 3D, minimal legends.
- Responsive from phone (375px) to large desktop, and readable in both themes at every width:
  - **Desktop, single screen (≥ 1200px wide and ≥ 620px tall):** the whole dashboard fits one 16:9 screen with **no page scrolling** (the "fit" layout, see §7). Panels stretch to share the available height; long tables scroll inside their own card. Verified at 1366×657, 1536×730, 1920×960 and 2560×1300 browser areas.
    - Below 1680px wide, tiles use short labels (e.g. "Likely cancels", "Cost / order"), the "vs prior 30D" comparison moves from each tile into the summary line, and the carrier on-time bars are hidden (the status dot remains). Full text stays in tooltips.
    - Below 2000px wide, the small panels show only their title; the subtitle is the title's tooltip.
  - **Tablet (641–1199px):** scrolling 2-column layout; the at-risk and carrier tables span both columns; tables show the top two reason chips plus "+N"; the Customer column is hidden up to 1100px (it's in the drill-down).
  - **Phone (≤ 640px):** one column; two KPI tiles per row; the header scrolls away instead of pinning; every table becomes stacked cards with labelled fields (no sideways scrolling); the at-risk list shows the top 5 with "View all" for the rest.
  - Header controls are ≥ 32px tall on tablets, phones and any touch screen.

## 4. Data
Realistic **mock data** is generated in the browser by a seeded generator (`js/data.js`). The seed is fixed, so the numbers are stable across reloads. A real WMS/ERP feed can replace it later by producing the same shapes.

**"Today" for the dataset is fixed at 2026-10-07.** Orders span the previous 180 days, so "previous period" deltas always have data.

### Entities
| Entity | Fields |
|--------|--------|
| Region | `id`, `name` (North America, EMEA, APAC) |
| Warehouse | `id`, `name`, `city`, `region`, `capacity` |
| Carrier | `id`, `name`, `reliability` (hidden driver of on-time rate), `costIndex` |
| SKU | `id`, `name`, `category`, `unitCost`, `onHand[warehouse]`, `dailyDemand[warehouse]`, `lastReceived[warehouse]` |
| Order | `id`, `customer`, `warehouse`, `region`, `carrier`, `sku`, `qty`, `value`, `shippingCost`, `fulfillmentCost`, `createdAt`, `promisedAt`, `shippedAt?`, `deliveredAt?`, `status` (`open`, `shipped`, `delivered`, `cancelled`), `slaDays` (2 express / 5 standard) |

Network: 6 warehouses (Reno, Memphis, Rotterdam, Frankfurt, Singapore, Sydney), 5 fictional carriers, ~11,700 orders over 180 days (~65/day with weekly seasonality and mild growth).

**Catalog: 80 SKUs**, 40 products × 2 variants (colour, or screen size for protection), with realistic unit costs:
| Category | Prefix | Products (unit cost range) |
|----------|--------|----------------------------|
| Chargers | CHG | 20W / 35W / 65W GaN wall chargers, wireless pad, 3-in-1 magnetic stand, car charger ($3.80–$17.50) |
| Cables | CBL | USB-C↔C 1m/2m, USB-C↔Lightning, braided 3m, USB-A↔C, magnetic ($1.10–$3.20) |
| Audio | AUD | wired earphones (USB-C / 3.5mm), TWS earbuds, TWS ANC, TWS sport, Bluetooth neckband ($2.20–$18.50) |
| Power Banks | PWR | 5,000 / 10,000 / 20,000mAh PD, magnetic 10,000mAh, slim 5,000mAh ($5.60–$14.20) |
| Creator Gear | CRT | selfie stick tripod, Bluetooth selfie stick, 10" and 18" ring lights, clip-on fill light, 3-axis gimbal, mini tripod ($2.80–$26.00) |
| Mounts | MNT | magnetic car mount, vent mount, bike mount, grip stand ($0.90–$4.30) |
| Protection | PRT | clear / silicone / rugged cases, tempered-glass and privacy screen protectors, camera lens protector ($0.60–$3.40) |

Cables and protection sell the most units; creator gear the least. Customers are ~24 fictional retail partners and marketplaces. Orders are **wholesale**: 5–100 units in packs of 5 (about 40 units and ~$630 per order on average), priced at roughly 2.2–3.2× unit cost. Inventory on hand is about $0.7M.

The data includes deliberate storylines so the dashboard has something to say: Atlas Parcel's reliability drops sharply over the last 3 weeks; the APAC sites (Singapore, Sydney) have stockouts that leave orders stuck and unshipped; and **battery products (power banks, TWS earbuds) run out of stock about 2.6× more often** than other categories, reflecting lithium air-freight limits.

## 5. KPIs
All KPIs respect the active filters. Inventory KPIs ignore the carrier filter, since stock is not carrier-specific. Every tile shows **value, a delta and a status color**. Flow KPIs compare against the previous equal-length period. Snapshot KPIs (at risk, cancellations) compare against the same calculation run N days ago. Inventory snapshots compare against 30 days ago.

"Open" means created, not yet delivered and not cancelled. That includes orders already in transit.

| KPI | Definition | Green | Amber | Red |
|-----|-----------|-------|-------|-----|
| **SLA compliance %** | Orders **due** in the period (`promisedAt` in range, not cancelled) delivered on or before `promisedAt` ÷ orders due | ≥ 95% | 90–95% | < 90% |
| **SLA breaches** | Orders due in the period that were delivered late or are still undelivered | ↓ ≥5% vs prior | within ±5% | ↑ ≥5% |
| **Orders at risk** | Open orders with risk score ≥ 60 (see §6) | ≤ 3% of open | 3–7% | > 7% |
| **Likely cancellations** | Open orders with risk score ≥ 85, or past promise by > 3 days | ≤ 1% | 1–3% | > 3% |
| **Stockout SKUs** | SKU×warehouse pairs with `onHand = 0` while there is demand | 0–2 | 3–8 | > 8 |
| **Inventory turnover** | Annualized COGS of orders shipped in period ÷ current inventory value | ≥ 8× | 5–8× | < 5× |
| **Days of supply** | Inventory on hand ÷ average daily demand (network weighted) | 20–45 | 10–20 or 45–60 | < 10 or > 60 |
| **Cost per order** | (shipping + fulfillment cost) ÷ orders | ≤ target | ≤ target +10% | > target +10% |
| **Cost per shipment** | Shipping cost ÷ shipped orders | ≤ target | ≤ target +10% | > target +10% |

Cost targets (wholesale parcels/pallets): cost per order **$18.00**, cost per shipment **$13.00**.

## 6. At-risk scoring (open orders)
Applies to open orders (see §5). Score 0–100, the sum of:
- **Time pressure** (0–40): `40 × (elapsed share of the SLA window)^1.6`. Past promise = 40.
- **Carrier risk** (0–25): the carrier's late rate over the last 30 days, scaled.
- **Stock risk** (0–25, unshipped orders only): the SKU at the shipping warehouse is out (25) or below the order qty (15).
- **Not yet shipped past cutoff** (0–10): the order is still unshipped more than 1 day after creation.

Reason chips show the top contributors: _Past promise_, _Tight window_, _Carrier delay_, _Out of stock_, _Low stock_, _Not shipped_.

## 7. Layout
Desktop is a single screen, top to bottom:
1. **Header** (sticky): filters (period 7/30/90 days, region, warehouse, carrier), reset, light/dark toggle and **Export PDF**.
2. **Summary row**: scope + "Data as of" date, a one-line verdict (e.g. "Service needs attention."), a generated plain-English summary of the biggest issues (max 2 lines), and a status pill counting tiles that need action / watching / on target.
3. **KPI strip**: all 9 tiles in one row, grouped _Service_ (SLA %, breaches, at risk, likely cancellations) · _Inventory_ (stockouts, turnover, days of supply) · _Cost_ (cost/order, cost/shipment).
4. **Panels**, a 12-column grid in two rows that share the remaining height:

| Row | Panels (columns out of 12) |
|-----|-----------------------------|
| 1 | SLA compliance trend (4) · Breaches by region (2) · Orders at risk (6) |
| 2 | Stockouts by warehouse (2) · Stock age (2) · Days of supply (2) · Carrier scorecard (4) · Cost per order (2) |

- **SLA compliance**: daily on-time line vs the 95% target.
- **Breaches by region**: bars labelled NA / EMEA / APAC (by warehouse when a region is selected).
- **Orders at risk**: summary (count, order value, likely cancellations) + top 10 with risk bar and the top two reason chips (+N for the rest). "View all" opens the drill-down.
- **Stockouts**: by warehouse. **Stock age**: inventory value by 0–30 / 31–90 / 90+ days, with an inline legend showing each share. **Days of supply**: by warehouse, colored by the 20–45 band.
- **Carrier scorecard**: ranked by on-time %, cost per shipment, share of breaches, status dot (shipment counts are in the drill-down on desktop).
- **Cost per order**: weekly, last 13 weeks, against the $18 target.

Tablet and phone show the same panels in a scrolling 2- or 1-column layout (see §3).

## 8. Interactions
- Changing a filter re-computes everything on the client (no reload).
- Selecting a region narrows the warehouse dropdown.
- Clicking a KPI tile, a chart point/bar/segment or a table row opens a **drill-down sheet** that slides in from the right. Close it with ✕, Esc or a backdrop click.
  - SLA tiles, SLA chart day, region bar, carrier row → the breached orders behind it.
  - At risk / likely cancellations → scored open orders with reasons.
  - Stockouts, stock age, days of supply, turnover → SKU positions (on hand, daily demand, days of supply, age).
  - Cost tiles, weekly cost point → cost breakdown by warehouse and by carrier.
  - Any order row → order detail (timeline, product, cost, risk reasons).
- Filters are reflected in the URL hash, so a link reproduces the view.

## 8a. PDF export
- **Export PDF** downloads a **one-page** A4 landscape PDF: the same single-screen snapshot as the desktop view, with the active filters applied.
- The page has a header (title, scope + period, data date, export timestamp) and a footer (source note, page number).
- It is always rendered in **light mode** on a fixed 16:9 canvas (1600×900), so it looks the same whether exported from a phone, a tablet or a desktop, or in dark mode.
- While capturing, letter-spacing is reset to 0 and pills/legend items render as inline-block, because html2canvas garbles text with negative tracking or inside inline-flex boxes.
- File name: `logistics-overview-<data date>-<scope>-<period>d.pdf`, e.g. `logistics-overview-2026-10-07-global-network-30d.pdf`.
- Built client-side with html2canvas + jsPDF from cdnjs, loaded only the first time someone exports.

## 8b. Data export (Airtable)
First step toward live data: the dashboard's dataset is exported as **one CSV per table** for import into an Airtable base ("Logistics Dashboard", Team plan, 50,000 records per base).

- Generated by `node scripts/export-airtable.mjs` from the same seeded `getData()` the dashboard uses, so the numbers match exactly. Verified: SLA %, breaches, at-risk count, cost per order, stockouts and days of supply recomputed from the CSV rows equal the dashboard's values.
- Files in `data/airtable/`: Regions (3), Warehouses (6), Carriers (5), Products (80), Inventory (480 SKU × warehouse positions), Orders (11,678). 12,252 records in total.
- Format: UTF-8, CRLF, RFC 4180 quoting, plain numbers, ISO 8601 UTC date-times (empty = not happened).
- Only real-world fields are exported. Simulation drivers (carrier reliability/cost index, SKU popularity, target days of supply, stockout flags) stay out.
- Import steps and the data dictionary (field → Airtable type → meaning) are in `data/airtable/README.md`.
- **The field names are the contract** for the planned scheduled sync (Airtable → dashboard JSON snapshot), which will be built in a separate repository. Don't rename them.

## 9. Hosting
Static site served by **GitHub Pages** from the `main` branch root of `IdanDanTane/claude_code_practice` (public repo). Every push redeploys automatically.

Live URL: https://idandantane.github.io/claude_code_practice/

## 10. Out of scope (for now)
Authentication, the live Airtable → dashboard sync (planned in a separate repo), editing data, alert notifications, in-app CSV/Excel exports, scheduled PDF delivery.
