# Logistics & Warehouse Executive Dashboard — Spec

_Last updated: 2026-10-07_

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

Network: 6 warehouses (2 per region), 5 carriers, ~120 SKUs, ~4,000 orders.

## 5. KPIs
All KPIs respect the active filters. Every tile shows **value, delta vs the previous equal-length period, and a status color**.

| KPI | Definition | Green | Amber | Red |
|-----|-----------|-------|-------|-----|
| **SLA compliance %** | Delivered orders with `deliveredAt ≤ promisedAt` ÷ delivered orders in period | ≥ 95% | 90–95% | < 90% |
| **SLA breaches** | Delivered late + open orders already past `promisedAt` | trend ↓ | flat | trend ↑ |
| **Orders at risk** | Open orders with risk score ≥ 60 (see §6) | ≤ 3% of open | 3–7% | > 7% |
| **Likely cancellations** | Open orders with risk score ≥ 85, or past promise by > 3 days | ≤ 1% | 1–3% | > 3% |
| **Stockout SKUs** | SKU×warehouse pairs with `onHand = 0` while there is demand | 0–2 | 3–8 | > 8 |
| **Inventory turnover** | Annualized COGS shipped ÷ average inventory value | ≥ 8× | 5–8× | < 5× |
| **Days of supply** | Inventory on hand ÷ average daily demand (network weighted) | 20–45 | 10–20 or 45–60 | < 10 or > 60 |
| **Cost per order** | (shipping + fulfillment cost) ÷ orders | ≤ target | ≤ target +10% | > target +10% |
| **Cost per shipment** | Shipping cost ÷ shipped orders | ≤ target | ≤ target +10% | > target +10% |

Cost targets: cost per order **$14.00**, cost per shipment **$9.50**.

## 6. At-risk scoring (open orders)
Score 0–100, the sum of:
- **Time pressure** (0–40): how close `now` is to `promisedAt` relative to the SLA window. Past promise = 40.
- **Carrier risk** (0–25): the carrier's late rate over the last 30 days, scaled.
- **Stock risk** (0–25): the SKU at the shipping warehouse is out (25) or below the order qty (15).
- **Not yet shipped past cutoff** (0–10): the order is still unshipped more than 1 day after creation.

Reason chips show the top contributors: _Past promise_, _Tight window_, _Carrier delay_, _Out of stock_, _Low stock_, _Not shipped_.

## 7. Layout
1. **Header**: title, "Data as of" timestamp, filters (period 7/30/90 days, region, warehouse, carrier) and a reset button.
2. **KPI tiles**: grid of 9 tiles grouped as _Service_ (SLA %, breaches, at risk, likely cancellations), _Inventory_ (stockouts, turnover, days of supply) and _Cost_ (cost/order, cost/shipment).
3. **Service**: SLA compliance trend (daily line vs the 95% target) and breaches by region (bar).
4. **At-risk orders**: top 10 table with risk score bar and reason chips. "View all" opens the drill-down.
5. **Inventory health**: stockouts by warehouse (bar), stock aging buckets (0–30 / 31–90 / 90+ days, doughnut), days of supply by warehouse.
6. **Carrier scorecard**: table ranked by on-time %, showing cost per shipment, breach share and a status dot.

## 8. Interactions
- Changing a filter re-computes everything on the client (no reload).
- Selecting a region narrows the warehouse dropdown.
- Clicking a KPI tile, a chart bar or a table row opens a **drill-down sheet** that slides in from the right and lists the underlying orders/SKUs. Close it with ✕, Esc or a backdrop click.
- Filters are reflected in the URL hash, so a link reproduces the view.

## 9. Hosting
Static site served by **GitHub Pages** from the `main` branch root of `IdanDanTane/claude_code_practice` (public repo). Every push redeploys automatically.

Live URL: https://idandantane.github.io/claude_code_practice/

## 10. Out of scope (for now)
Authentication, live data connection, editing data, alert notifications, exports.
