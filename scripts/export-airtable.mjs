// Export the dashboard's seeded data as CSV files for Airtable import.
// Run from the repo root:  node scripts/export-airtable.mjs
// Output: data/airtable/1-regions.csv … 6-orders.csv (UTF-8, CRLF, RFC 4180 quoting).
// Field names here are the contract for the future Airtable → dashboard sync; keep them stable.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getData } from '../js/data.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'data', 'airtable');
const data = getData();

const iso = (t) => (t == null ? '' : new Date(t).toISOString());
const money = (v) => v.toFixed(2);
const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function writeCsv(file, header, rows) {
  const lines = [header, ...rows].map((r) => r.map(cell).join(','));
  writeFileSync(join(outDir, file), lines.join('\r\n') + '\r\n', 'utf8');
  console.log(`${file.padEnd(18)} ${String(rows.length).padStart(6)} rows`);
}

function status(o) {
  if (o.cancelledAt != null && o.cancelledAt <= data.now) return 'Cancelled';
  if (o.deliveredAt != null) return 'Delivered';
  if (o.shippedAt != null) return 'In transit';
  return 'Not shipped';
}

mkdirSync(outDir, { recursive: true });

writeCsv('1-regions.csv', ['Region ID', 'Region'],
  data.regions.map((r) => [r.id, r.name]));

writeCsv('2-warehouses.csv', ['Warehouse ID', 'Warehouse', 'City', 'Region ID', 'Capacity'],
  data.warehouses.map((w) => [w.id, w.name, w.city, w.region, w.capacity]));

writeCsv('3-carriers.csv', ['Carrier ID', 'Carrier'],
  data.carriers.map((c) => [c.id, c.name]));

writeCsv('4-products.csv', ['SKU', 'Product', 'Variant', 'Category', 'Unit cost'],
  data.skus.map((k) => {
    const [product, variant = ''] = k.name.split(' · ');
    return [k.id, product, variant, k.category, money(k.unitCost)];
  }));

writeCsv('5-inventory.csv',
  ['Position', 'SKU', 'Warehouse ID', 'Region ID', 'On hand', 'On hand 30d ago', 'Daily demand', 'Days since receipt', 'Unit cost'],
  data.inventory.map((p) => [
    `${p.sku} @ ${p.warehouse}`, p.sku, p.warehouse, p.region,
    p.onHand, p.onHandPrev, p.dailyDemand.toFixed(2), p.ageDays, money(p.unitCost),
  ]));

writeCsv('6-orders.csv',
  ['Order ID', 'Customer', 'Region ID', 'Warehouse ID', 'Carrier ID', 'SKU', 'Qty', 'Order value', 'COGS',
    'Shipping cost', 'Fulfillment cost', 'Service level', 'SLA days', 'Created at', 'Promised at',
    'Shipped at', 'Delivered at', 'Cancelled at', 'Status'],
  data.orders.map((o) => [
    o.id, o.customer, o.region, o.warehouse, o.carrier, o.sku, o.qty,
    money(o.value), money(o.cogs), money(o.shippingCost), money(o.fulfillmentCost),
    o.express ? 'Express' : 'Standard', o.slaDays,
    iso(o.createdAt), iso(o.promisedAt), iso(o.shippedAt), iso(o.deliveredAt), iso(o.cancelledAt), status(o),
  ]));

console.log(`\nData as of ${iso(data.now)} → ${outDir}`);
