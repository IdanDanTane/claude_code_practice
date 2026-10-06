// Deterministic mock data for the logistics dashboard.
// Fixed seed + fixed "now" so every load (and every viewer) sees the same numbers.

export const DAY = 86400000;
export const NOW = Date.UTC(2026, 9, 7, 9, 0); // 2026-10-07 09:00 UTC
const HISTORY_DAYS = 180;
const SEED = 20261007;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const REGIONS = [
  { id: 'NA', name: 'North America', share: 0.45 },
  { id: 'EMEA', name: 'EMEA', share: 0.33 },
  { id: 'APAC', name: 'APAC', share: 0.22 },
];

export const WAREHOUSES = [
  { id: 'RNO', name: 'Reno', city: 'Reno, NV', region: 'NA', share: 0.55, capacity: 42000 },
  { id: 'MEM', name: 'Memphis', city: 'Memphis, TN', region: 'NA', share: 0.45, capacity: 36000 },
  { id: 'RTM', name: 'Rotterdam', city: 'Rotterdam, NL', region: 'EMEA', share: 0.6, capacity: 38000 },
  { id: 'FRA', name: 'Frankfurt', city: 'Frankfurt, DE', region: 'EMEA', share: 0.4, capacity: 24000 },
  { id: 'SIN', name: 'Singapore', city: 'Singapore, SG', region: 'APAC', share: 0.55, capacity: 26000 },
  { id: 'SYD', name: 'Sydney', city: 'Sydney, AU', region: 'APAC', share: 0.45, capacity: 18000 },
];

// Fictional carriers. `reliability` = chance a shipment avoids a delay event.
export const CARRIERS = [
  { id: 'NLX', name: 'Northline Express', reliability: 0.97, costIndex: 1.18 },
  { id: 'MER', name: 'Meridian Freight', reliability: 0.955, costIndex: 1.02 },
  { id: 'BLR', name: 'BlueRoute', reliability: 0.935, costIndex: 0.93 },
  { id: 'PSW', name: 'Pacific Swift', reliability: 0.925, costIndex: 0.9 },
  { id: 'ATL', name: 'Atlas Parcel', reliability: 0.91, costIndex: 0.8 },
];

const CARRIER_MIX = {
  NA: { NLX: 0.35, MER: 0.3, BLR: 0.25, ATL: 0.1 },
  EMEA: { MER: 0.35, BLR: 0.3, NLX: 0.2, PSW: 0.15 },
  APAC: { PSW: 0.4, ATL: 0.35, MER: 0.25 },
};

const CATEGORIES = {
  Electronics: { nouns: ['Wireless Earbuds', 'Smart Speaker', 'USB-C Hub', 'Tablet Stand', 'Charging Dock', 'Webcam', 'Portable SSD', 'Keyboard', 'Monitor Arm', 'Power Bank'], cost: [18, 240] },
  Home: { nouns: ['Air Purifier', 'Desk Lamp', 'Coffee Grinder', 'Kettle', 'Throw Blanket', 'Storage Bin', 'Wall Clock', 'Diffuser'], cost: [9, 160] },
  Apparel: { nouns: ['Rain Jacket', 'Running Shoe', 'Merino Tee', 'Fleece Hoodie', 'Travel Backpack', 'Cap'], cost: [8, 95] },
  Health: { nouns: ['Yoga Mat', 'Water Bottle', 'Fitness Band', 'Massage Gun', 'Scale'], cost: [6, 130] },
  Office: { nouns: ['Notebook Set', 'Desk Organizer', 'Ergo Chair Cushion', 'Pen Pack', 'Laptop Sleeve'], cost: [4, 70] },
};
const ADJ = ['Pro', 'Air', 'Mini', 'Max', 'Lite', 'Plus', 'Studio', 'Go', 'One', 'Classic'];

const CUSTOMERS = [
  'Halcyon Retail', 'Brightwater Co.', 'Northfield Stores', 'Cobalt & Pine', 'Lumen Outfitters', 'Vantage Home',
  'Orchard Lane', 'Summit Supply', 'Kestrel Goods', 'Harbor & Main', 'Juniper Market', 'Atlas Living',
  'Riverstone', 'Marlow & Finch', 'Bluebell Trading', 'Copperleaf', 'Evergreen Direct', 'Silverline Retail',
  'Meadowbrook', 'Ironwood Co.', 'Sable Street', 'Westgate Stores', 'Pinecrest', 'Saltmarsh Goods',
  'Tidewater Supply', 'Foxglove', 'Granite Peak', 'Larkspur & Co.', 'Oakhurst', 'Redfern Retail',
];

let cache = null;

export function getData() {
  if (!cache) cache = generate();
  return cache;
}

function generate() {
  const rnd = mulberry32(SEED);
  const between = (a, b) => a + (b - a) * rnd();
  const int = (a, b) => Math.floor(between(a, b + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const weighted = (map) => {
    let r = rnd();
    for (const [k, w] of Object.entries(map)) { if ((r -= w) <= 0) return k; }
    return Object.keys(map)[0];
  };

  // ---- SKUs -------------------------------------------------------------
  const skus = [];
  const usedNames = new Set();
  let n = 0;
  while (skus.length < 80) {
    const cat = pick(Object.keys(CATEGORIES));
    const def = CATEGORIES[cat];
    const name = `${pick(def.nouns)} ${pick(ADJ)}`;
    if (usedNames.has(name)) continue;
    usedNames.add(name);
    n++;
    skus.push({
      id: `SKU-${String(1000 + n * 7)}`,
      name,
      category: cat,
      unitCost: Math.round(between(def.cost[0], def.cost[1]) * 100) / 100,
      popularity: Math.pow(rnd(), 2.2) + 0.03, // long-tail demand
    });
  }
  const popTotal = skus.reduce((s, k) => s + k.popularity, 0);
  const skuWeights = Object.fromEntries(skus.map((k) => [k.id, k.popularity / popTotal]));
  const skuById = Object.fromEntries(skus.map((k) => [k.id, k]));

  // ---- Inventory positions (decided before orders so stockouts shape the order history)
  const inventory = [];
  const invKey = (sku, wh) => `${sku}|${wh}`;
  const invMap = new Map();
  for (const wh of WAREHOUSES) {
    // Singapore is the planted problem site: more stockouts.
    const stockoutRate = wh.id === 'SIN' ? 0.13 : wh.id === 'SYD' ? 0.05 : 0.025;
    for (const sku of skus) {
      const r = rnd();
      const stockout = r < stockoutRate;
      const overstock = !stockout && r > 0.89;
      const pos = {
        sku: sku.id, warehouse: wh.id, region: wh.region,
        stockout,
        stockoutSince: stockout ? NOW - between(2, 24) * DAY : null,
        targetDos: overstock ? between(95, 210) : between(12, 50),
        ageDays: overstock ? int(91, 320) : (rnd() < 0.62 ? int(1, 30) : int(31, 90)),
        onHand: 0, onHandPrev: 0, dailyDemand: 0,
      };
      inventory.push(pos);
      invMap.set(invKey(sku.id, wh.id), pos);
    }
  }

  // ---- Orders -------------------------------------------------------------
  const orders = [];
  const whByRegion = Object.fromEntries(REGIONS.map((r) => [r.id, WAREHOUSES.filter((w) => w.region === r.id)]));
  const regionShares = Object.fromEntries(REGIONS.map((r) => [r.id, r.share]));
  const carrierById = Object.fromEntries(CARRIERS.map((c) => [c.id, c]));
  const startDay = NOW - HISTORY_DAYS * DAY;
  let seq = 410000;

  for (let d = 0; d <= HISTORY_DAYS; d++) {
    const dayStart = Math.floor((startDay + d * DAY) / DAY) * DAY;
    const dow = new Date(dayStart).getUTCDay();
    const dowF = dow === 0 ? 0.6 : dow === 6 ? 0.72 : 1.06;
    const growth = 1 + d * 0.0012;
    const count = Math.round(62 * dowF * growth * between(0.9, 1.1));
    const daysAgo = (NOW - dayStart) / DAY;

    for (let i = 0; i < count; i++) {
      const createdAt = dayStart + between(6, 22) * 3600000;
      if (createdAt > NOW) continue;
      const region = weighted(regionShares);
      const whs = whByRegion[region];
      const wh = rnd() < whs[0].share ? whs[0] : whs[1];
      const sku = skuById[weighted(skuWeights)];
      const carrier = carrierById[weighted(CARRIER_MIX[region])];
      const express = rnd() < 0.26;
      const slaDays = express ? 2 : 5;
      const qty = Math.max(1, Math.round(Math.pow(rnd(), 2) * 8));
      const promisedAt = createdAt + slaDays * DAY;
      const pos = invMap.get(invKey(sku.id, wh.id));

      // Warehouse processing time (days). Singapore struggles in the last two weeks.
      let ship = between(0.15, 0.9);
      if (wh.id === 'SIN' && daysAgo < 15 && rnd() < 0.3) ship += between(0.6, 2.2);
      if (rnd() < 0.02) ship += between(1, 3);

      // Atlas Parcel has deteriorated over the last three weeks.
      let reliability = carrier.reliability;
      if (carrier.id === 'ATL' && daysAgo < 22) reliability = 0.72;
      let transit = express ? between(0.5, 1.0) : between(1.4, 3.3);
      if (region === 'APAC' && !express) transit += between(0, 0.5);
      if (rnd() > reliability) transit += between(1.2, 4.5);

      let shippedAt = createdAt + ship * DAY;
      let deliveredAt = shippedAt + transit * DAY;
      let cancelledAt = null;

      // Orders for an out-of-stock SKU created after the stockout began are stuck.
      if (pos.stockout && createdAt > pos.stockoutSince) {
        shippedAt = null; deliveredAt = null;
        // Customers cancel some of these after a few days of waiting.
        if (NOW - createdAt > 6 * DAY && rnd() < 0.55) cancelledAt = createdAt + between(5, 8) * DAY;
      } else if (rnd() < 0.011) {
        shippedAt = null; deliveredAt = null;
        cancelledAt = createdAt + between(0.1, 2) * DAY;
      }
      if (cancelledAt && cancelledAt > NOW) cancelledAt = null;
      if (shippedAt && shippedAt > NOW) { shippedAt = null; deliveredAt = null; }
      if (deliveredAt && deliveredAt > NOW) deliveredAt = null;

      const zone = region === 'APAC' ? 1.18 : region === 'EMEA' ? 1.04 : 1;
      const shippingCost = round2((express ? 13.2 : 7.4) * carrier.costIndex * zone * (1 + (qty - 1) * 0.06) * between(0.88, 1.12));
      const fulfillmentCost = round2((3.6 + qty * 0.45) * (wh.id === 'SIN' ? 1.12 : 1) * between(0.9, 1.1));

      orders.push({
        id: `SO-${seq++}`,
        customer: pick(CUSTOMERS),
        region, warehouse: wh.id, carrier: carrier.id, sku: sku.id,
        qty, value: round2(qty * sku.unitCost * between(1.45, 1.9)),
        cogs: round2(qty * sku.unitCost),
        shippingCost, fulfillmentCost,
        express, slaDays,
        createdAt, promisedAt, shippedAt, deliveredAt, cancelledAt,
      });
    }
  }

  // ---- Settle inventory levels from actual demand over the last 30 days
  const demand = new Map();
  for (const o of orders) {
    if (o.createdAt < NOW - 30 * DAY) continue;
    const k = invKey(o.sku, o.warehouse);
    demand.set(k, (demand.get(k) || 0) + o.qty);
  }
  for (const pos of inventory) {
    pos.dailyDemand = (demand.get(invKey(pos.sku, pos.warehouse)) || 0) / 30;
    const base = Math.max(pos.dailyDemand, 0.05);
    pos.onHand = pos.stockout ? 0 : Math.max(1, Math.round(base * pos.targetDos));
    if (pos.stockout) {
      pos.onHandPrev = pos.stockoutSince > NOW - 30 * DAY ? Math.round(base * between(4, 18)) : 0;
    } else {
      pos.onHandPrev = rnd() < 0.018 ? 0 : Math.round(pos.onHand * between(0.85, 1.22));
    }
    pos.unitCost = skuById[pos.sku].unitCost;
  }

  return {
    now: NOW,
    regions: REGIONS,
    warehouses: WAREHOUSES,
    carriers: CARRIERS,
    skus,
    skuById,
    inventory,
    orders,
  };
}

function round2(x) { return Math.round(x * 100) / 100; }
