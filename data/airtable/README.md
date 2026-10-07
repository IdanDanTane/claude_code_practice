# Airtable import guide

These CSV files hold the dashboard's data, ready to import into Airtable. They are generated from the same seeded data the dashboard shows (`js/data.js`), so the numbers match the live site exactly. Data date: **2026-10-07 09:00 UTC**.

| File | Airtable table | Records |
|------|----------------|---------|
| `1-regions.csv` | Regions | 3 |
| `2-warehouses.csv` | Warehouses | 6 |
| `3-carriers.csv` | Carriers | 5 |
| `4-products.csv` | Products | 80 |
| `5-inventory.csv` | Inventory | 480 |
| `6-orders.csv` | Orders | 11,678 |
| **Total** | | **12,252** (fits the Team plan's 50,000 records per base) |

Format: UTF-8, comma-separated, standard quoting. Numbers are plain (no `$`, no thousands separators). Date-times are ISO 8601 in UTC (e.g. `2026-10-07T09:00:00.000Z`); an empty date means "hasn't happened".

## How to import

**1. Download the files.** On GitHub, open each file in `data/airtable/` and click **Download raw file**. Or download the whole repo: **Code → Download ZIP**.

**2. Create the base from the first file.**
Airtable home → **Create** → **Import** → **CSV file** → upload `1-regions.csv`.
Rename the base to **Logistics Dashboard** and the table to **Regions**.

**3. Add the other tables, in this order:** warehouses → carriers → products → inventory → orders.
In the base: **+ Add or import** (next to the table tabs) → **CSV file** → choose the file → **Create a new table**. Name the tables **Warehouses**, **Carriers**, **Products**, **Inventory**, **Orders**.

**4. Check field types in the import preview.** Airtable guesses types; fix any that differ from the data dictionary below. The important ones:
- **Currency** (USD, 2 decimals): Unit cost, Order value, COGS, Shipping cost, Fulfillment cost
- **Number** (integer): Capacity, Qty, SLA days, On hand, On hand 30d ago, Days since receipt. **Number** (2 decimals): Daily demand
- **Date with time**, time zone **GMT/UTC**: Created at, Promised at, Shipped at, Delivered at, Cancelled at
- **Single select**: Category, Variant, Service level, Status, Customer

**5. Check record counts** against the table at the top. Orders should show 11,678.

**6. Optional: link the tables.** In Orders and Inventory, change **Region ID**, **Warehouse ID**, **Carrier ID** and **SKU** to **Link to another record**, pointing at Regions, Warehouses, Carriers and Products. Airtable matches the codes to each table's first column automatically. Do the same for Region ID in Warehouses. Then you can use lookups and rollups, e.g. stock value per warehouse.

> Keep the **field names unchanged**. The upcoming scheduled sync (Airtable → dashboard) will read these exact names.

## Data dictionary

### Regions
| Field | Type | Meaning |
|-------|------|---------|
| Region ID | Single line text (primary) | `NA`, `EMEA`, `APAC` |
| Region | Single line text | Display name |

### Warehouses
| Field | Type | Meaning |
|-------|------|---------|
| Warehouse ID | Single line text (primary) | `RNO`, `MEM`, `RTM`, `FRA`, `SIN`, `SYD` |
| Warehouse | Single line text | Name, e.g. Reno |
| City | Single line text | City, country/state |
| Region ID | Text → link to Regions | Region the site serves |
| Capacity | Number | Storage capacity (units) |

### Carriers
| Field | Type | Meaning |
|-------|------|---------|
| Carrier ID | Single line text (primary) | `NLX`, `MER`, `BLR`, `PSW`, `ATL` |
| Carrier | Single line text | Carrier name (fictional) |

### Products
| Field | Type | Meaning |
|-------|------|---------|
| SKU | Single line text (primary) | e.g. `CHG-101` (prefix = category) |
| Product | Single line text | e.g. 20W USB-C Wall Charger |
| Variant | Single select | Colour (White/Black/Silver) or screen size (6.1"/6.7") |
| Category | Single select | Chargers, Cables, Audio, Power Banks, Creator Gear, Mounts, Protection |
| Unit cost | Currency | Landed cost per unit (USD) |

### Inventory (one row per SKU per warehouse)
| Field | Type | Meaning |
|-------|------|---------|
| Position | Single line text (primary) | `SKU @ Warehouse`, e.g. `CHG-101 @ RNO` |
| SKU | Text → link to Products | |
| Warehouse ID | Text → link to Warehouses | |
| Region ID | Text → link to Regions | |
| On hand | Number | Units in stock now (0 = stockout) |
| On hand 30d ago | Number | Units in stock 30 days ago (for trend deltas) |
| Daily demand | Number (2 dp) | Average units/day ordered over the last 30 days |
| Days since receipt | Number | Age of the stock on hand (drives the stock-age chart) |
| Unit cost | Currency | Same as Products; kept here so stock value is a simple formula |

Suggested formulas: **Stock value** = `{On hand} * {Unit cost}`, **Days of supply** = `IF({Daily demand} > 0, {On hand} / {Daily demand})`.

### Orders (wholesale orders from retail partners)
| Field | Type | Meaning |
|-------|------|---------|
| Order ID | Single line text (primary) | e.g. `SO-410000` |
| Customer | Single select | Retail partner / marketplace |
| Region ID | Text → link to Regions | |
| Warehouse ID | Text → link to Warehouses | Shipping site |
| Carrier ID | Text → link to Carriers | |
| SKU | Text → link to Products | |
| Qty | Number | Units (packs of 5) |
| Order value | Currency | Revenue |
| COGS | Currency | Qty × unit cost |
| Shipping cost | Currency | Carrier charge |
| Fulfillment cost | Currency | Pick/pack cost |
| Service level | Single select | Express (2-day SLA) / Standard (5-day SLA) |
| SLA days | Number | 2 or 5 |
| Created at | Date with time (UTC) | Order placed |
| Promised at | Date with time (UTC) | Delivery promise = Created at + SLA days |
| Shipped at | Date with time (UTC) | Empty = not shipped yet |
| Delivered at | Date with time (UTC) | Empty = not delivered yet |
| Cancelled at | Date with time (UTC) | Empty = not cancelled |
| Status | Single select | Delivered / In transit / Not shipped / Cancelled, as of the data date |

## Regenerating
If the mock data changes, run this from the repo root and re-import:
```bash
node scripts/export-airtable.mjs
```
