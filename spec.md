# Logistics & Warehouse Executive Dashboard — Spec

_Last updated: 2026-10-07 (v1 built)_

## 1. Purpose
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
- Light canvas `#f5f5f7`, white cards, 18px radius, soft layered shadows, generous whitespace.
- Translucent sticky header (`backdrop-filter: blur`).
- Apple system colors for status: green `#34c759` (on target), orange `#ff9500` (watch), red `#ff3b30` (action), blue `#0071e3` (neutral/accent).
- Automatic dark mode following the OS setting.
- Large numerals and quiet labels. No chart junk: thin gridlines, no 3D, minimal legends.
- Responsive down to phone width (375px).

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

Network: 6 warehouses (Reno, Memphis, Rotterdam, Frankfurt, Singapore, Sydney), 5 fictional carriers, 80 SKUs, ~11,700 orders over 180 days (~65/day with weekly seasonality and mild growth).

The data includes deliberate storylines so the dashboard has something to say: Atlas Parcel's reliability drops sharply over the last 3 weeks, and the APAC sites (Singapore, Sydney) have stockouts that leave orders stuck and unshipped.

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

Cost targets: cost per order **$14.00**, cost per shipment **$9.50**.

## 6. At-risk scoring (open orders)
Applies to open orders (see §5). Score 0–100, the sum of:
- **Time pressure** (0–40): `40 × (elapsed share of the SLA window)^1.6`. Past promise = 40.
- **Carrier risk** (0–25): the carrier's late rate over the last 30 days, scaled.
- **Stock risk** (0–25, unshipped orders only): the SKU at the shipping warehouse is out (25) or below the order qty (15).
- **Not yet shipped past cutoff** (0–10): the order is still unshipped more than 1 day after creation.

Reason chips show the top contributors: _Past promise_, _Tight window_, _Carrier delay_, _Out of stock_, _Low stock_, _Not shipped_.

## 7. Layout
1. **Header**: translucent sticky bar with filters (period 7/30/90 days, region, warehouse, carrier) and a reset button.
   **Hero**: scope + "Data as of" date, a one-line verdict (e.g. "Service needs attention."), a generated plain-English summary of the biggest issues, and a status pill counting tiles that need action, need watching, or are on target.
2. **KPI tiles**: grid of 9 tiles grouped as _Service_ (SLA %, breaches, at risk, likely cancellations), _Inventory_ (stockouts, turnover, days of supply) and _Cost_ (cost/order, cost/shipment).
3. **Service**: SLA compliance trend (daily line vs the 95% target) and breaches by region (bar).
4. **At-risk orders**: summary line (count, order value, likely cancellations) and a top-10 table with risk score bar and reason chips. "View all" opens the drill-down.
5. **Inventory health**: stockouts by warehouse (horizontal bar), stock aging by inventory value (0–30 / 31–90 / 90+ days, doughnut), days of supply by warehouse (horizontal bar, colored by the 20–45 target band).
6. **Carriers & cost**: carrier scorecard ranked by on-time % (shipments, cost per shipment, share of breaches, status dot), plus weekly cost per order for the last 13 weeks against the $14 target.

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

## 9. Hosting
Static site served by **GitHub Pages** from the `main` branch root of `IdanDanTane/claude_code_practice` (public repo). Every push redeploys automatically.

Live URL: https://idandantane.github.io/claude_code_practice/

## 10. Out of scope (for now)
Authentication, live data connection, editing data, alert notifications, exports.
