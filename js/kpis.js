// Pure KPI functions. Inputs are plain data; no DOM access here.
import { DAY } from './data.js';

export const TARGETS = {
  sla: 0.95,
  costPerOrder: 18.0,
  costPerShipment: 13.0,
  dosLow: 20,
  dosHigh: 45,
  riskThreshold: 60,
  cancelThreshold: 85,
};

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------
export function scopeOrders(data, f) {
  return data.orders.filter((o) =>
    (f.region === 'all' || o.region === f.region) &&
    (f.warehouse === 'all' || o.warehouse === f.warehouse) &&
    (f.carrier === 'all' || o.carrier === f.carrier));
}

export function scopeInventory(data, f) {
  return data.inventory.filter((p) =>
    (f.region === 'all' || p.region === f.region) &&
    (f.warehouse === 'all' || p.warehouse === f.warehouse));
}

/** Current period and the equal-length period before it. */
export function periods(now, days) {
  return {
    cur: { start: now - days * DAY, end: now },
    prev: { start: now - 2 * days * DAY, end: now - days * DAY },
  };
}

const inRange = (t, r) => t != null && t >= r.start && t < r.end;
const isCancelledBy = (o, t) => o.cancelledAt != null && o.cancelledAt <= t;
const isDeliveredBy = (o, t) => o.deliveredAt != null && o.deliveredAt <= t;
const isShippedBy = (o, t) => o.shippedAt != null && o.shippedAt <= t;

// ---------------------------------------------------------------------------
// Service / SLA
// ---------------------------------------------------------------------------
/**
 * Orders due (promisedAt) in range, judged as of `range.end`.
 * On time = delivered no later than the promise. Everything else due is a breach.
 */
export function sla(orders, range) {
  const due = [];
  const breaches = [];
  for (const o of orders) {
    if (!inRange(o.promisedAt, range) || isCancelledBy(o, range.end)) continue;
    due.push(o);
    const onTime = o.deliveredAt != null && o.deliveredAt <= o.promisedAt;
    if (!onTime) breaches.push(o);
  }
  return {
    due: due.length,
    onTime: due.length - breaches.length,
    breaches,
    pct: due.length ? (due.length - breaches.length) / due.length : null,
  };
}

export function slaDaily(orders, range) {
  const days = Math.round((range.end - range.start) / DAY);
  const buckets = Array.from({ length: days }, (_, i) => ({ t: range.start + i * DAY, due: 0, late: 0 }));
  for (const o of orders) {
    if (!inRange(o.promisedAt, range) || isCancelledBy(o, range.end)) continue;
    const i = Math.floor((o.promisedAt - range.start) / DAY);
    if (!buckets[i]) continue;
    buckets[i].due++;
    if (!(o.deliveredAt != null && o.deliveredAt <= o.promisedAt)) buckets[i].late++;
  }
  return buckets.map((b) => ({ ...b, pct: b.due ? (b.due - b.late) / b.due : null }));
}

// ---------------------------------------------------------------------------
// Risk scoring for open orders
// ---------------------------------------------------------------------------
/** Late-delivery rate per carrier over the 30 days before `t`. */
export function carrierLateRates(orders, t) {
  const acc = {};
  for (const o of orders) {
    if (!isDeliveredBy(o, t) || o.deliveredAt < t - 30 * DAY) continue;
    const a = (acc[o.carrier] ||= { n: 0, late: 0 });
    a.n++;
    if (o.deliveredAt > o.promisedAt) a.late++;
  }
  return Object.fromEntries(Object.entries(acc).map(([k, a]) => [k, a.n ? a.late / a.n : 0]));
}

/**
 * Score every order that is open (created, not delivered, not cancelled) at time `t`.
 * `allOrders` feeds carrier late rates so they reflect the whole network.
 */
export function riskAt(orders, allOrders, inventory, t) {
  const lateRates = carrierLateRates(allOrders, t);
  const stock = new Map(inventory.map((p) => [`${p.sku}|${p.warehouse}`, p]));
  const out = [];
  for (const o of orders) {
    if (o.createdAt > t || isDeliveredBy(o, t) || isCancelledBy(o, t)) continue;
    const shipped = isShippedBy(o, t);
    const window = o.promisedAt - o.createdAt;
    const remaining = o.promisedAt - t;
    const reasons = [];

    let time;
    if (remaining < 0) { time = 40; reasons.push('Past promise'); }
    else {
      time = 40 * Math.pow(1 - remaining / window, 1.6);
      if (time >= 22) reasons.push('Tight window');
    }

    const late = lateRates[o.carrier] || 0;
    const carrier = Math.min(25, (late / 0.25) * 25);
    if (carrier >= 12) reasons.push('Carrier delay');

    let stockPts = 0;
    if (!shipped) {
      const pos = stock.get(`${o.sku}|${o.warehouse}`);
      if (pos && pos.onHand === 0) { stockPts = 25; reasons.push('Out of stock'); }
      else if (pos && pos.onHand < o.qty) { stockPts = 15; reasons.push('Low stock'); }
    }

    let unshipped = 0;
    if (!shipped && t - o.createdAt > DAY) { unshipped = 10; reasons.push('Not shipped'); }

    const score = Math.round(Math.min(100, time + carrier + stockPts + unshipped));
    const overdueDays = remaining < 0 ? -remaining / DAY : 0;
    out.push({
      order: o, score, reasons, shipped, overdueDays,
      atRisk: score >= TARGETS.riskThreshold,
      likelyCancel: score >= TARGETS.cancelThreshold || overdueDays > 3,
    });
  }
  return out.sort((a, b) => b.score - a.score || b.overdueDays - a.overdueDays);
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------
export function inventoryStats(inventory, { prev = false } = {}) {
  let value = 0, units = 0, demand = 0, stockouts = 0;
  const outs = [];
  for (const p of inventory) {
    const onHand = prev ? p.onHandPrev : p.onHand;
    value += onHand * p.unitCost;
    units += onHand;
    demand += p.dailyDemand;
    if (onHand === 0 && p.dailyDemand > 0) { stockouts++; outs.push(p); }
  }
  return { value, units, demand, stockouts, outs, dos: demand ? units / demand : null };
}

/** Annualized COGS of orders shipped in range ÷ current inventory value. */
export function turnover(orders, range, inventoryValue) {
  let cogs = 0;
  for (const o of orders) if (inRange(o.shippedAt, range)) cogs += o.cogs;
  const days = (range.end - range.start) / DAY;
  return inventoryValue ? (cogs * 365 / days) / inventoryValue : null;
}

export const AGE_BUCKETS = [
  { id: 'fresh', label: '0–30 days', test: (d) => d <= 30 },
  { id: 'mid', label: '31–90 days', test: (d) => d > 30 && d <= 90 },
  { id: 'old', label: '90+ days', test: (d) => d > 90 },
];

export function aging(inventory) {
  const totals = AGE_BUCKETS.map((b) => ({ ...b, value: 0, items: [] }));
  for (const p of inventory) {
    if (!p.onHand) continue;
    const b = totals.find((x) => x.test(p.ageDays));
    b.value += p.onHand * p.unitCost;
    b.items.push(p);
  }
  return totals;
}

export function byWarehouse(inventory, warehouses) {
  return warehouses.map((w) => {
    const items = inventory.filter((p) => p.warehouse === w.id);
    return { warehouse: w, items, ...inventoryStats(items) };
  }).filter((r) => r.items.length);
}

// ---------------------------------------------------------------------------
// Cost
// ---------------------------------------------------------------------------
export function cost(orders, range) {
  let n = 0, ship = 0, fulfil = 0, shipped = 0, shipCost = 0;
  for (const o of orders) {
    if (inRange(o.createdAt, range) && !o.cancelledAt) { n++; ship += o.shippingCost; fulfil += o.fulfillmentCost; }
    if (inRange(o.shippedAt, range)) { shipped++; shipCost += o.shippingCost; }
  }
  return {
    orders: n,
    perOrder: n ? (ship + fulfil) / n : null,
    shipped,
    perShipment: shipped ? shipCost / shipped : null,
    total: ship + fulfil,
  };
}

export function costWeekly(orders, now, weeks = 13) {
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const r = { start: now - (i + 1) * 7 * DAY, end: now - i * 7 * DAY };
    out.push({ t: r.start, ...cost(orders, r) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Carriers
// ---------------------------------------------------------------------------
export function carrierScorecard(orders, carriers, range) {
  const totalBreaches = sla(orders, range).breaches.length || 1;
  return carriers.map((c) => {
    const mine = orders.filter((o) => o.carrier === c.id);
    const s = sla(mine, range);
    const k = cost(mine, range);
    return {
      carrier: c,
      due: s.due,
      onTimePct: s.pct,
      breaches: s.breaches,
      breachShare: s.breaches.length / totalBreaches,
      perShipment: k.perShipment,
      shipped: k.shipped,
    };
  }).filter((r) => r.due > 0)
    .sort((a, b) => (b.onTimePct ?? -1) - (a.onTimePct ?? -1));
}

// ---------------------------------------------------------------------------
// Status thresholds (spec §5)
// ---------------------------------------------------------------------------
export function status(kpi, v, ctx = {}) {
  if (v == null || Number.isNaN(v)) return 'gray';
  switch (kpi) {
    case 'sla': return v >= 0.95 ? 'green' : v >= 0.9 ? 'orange' : 'red';
    case 'breaches': {
      if (ctx.prev == null) return 'gray';
      const ch = ctx.prev ? (v - ctx.prev) / ctx.prev : (v > 0 ? 1 : 0);
      return ch <= -0.05 ? 'green' : ch < 0.05 ? 'orange' : 'red';
    }
    case 'risk': return v <= 0.03 ? 'green' : v <= 0.07 ? 'orange' : 'red';
    case 'cancel': return v <= 0.01 ? 'green' : v <= 0.03 ? 'orange' : 'red';
    case 'stockouts': return v <= 2 ? 'green' : v <= 8 ? 'orange' : 'red';
    case 'turnover': return v >= 8 ? 'green' : v >= 5 ? 'orange' : 'red';
    case 'dos': return v >= 20 && v <= 45 ? 'green' : v >= 10 && v <= 60 ? 'orange' : 'red';
    case 'cpo': return v <= TARGETS.costPerOrder ? 'green' : v <= TARGETS.costPerOrder * 1.1 ? 'orange' : 'red';
    case 'cps': return v <= TARGETS.costPerShipment ? 'green' : v <= TARGETS.costPerShipment * 1.1 ? 'orange' : 'red';
    default: return 'blue';
  }
}
