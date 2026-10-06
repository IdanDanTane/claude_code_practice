import { getData, DAY } from './data.js';
import * as K from './kpis.js';
import { lineChart, barChart, doughnutChart, tokens, statusColor } from './charts.js';

const data = getData();
const whById = Object.fromEntries(data.warehouses.map((w) => [w.id, w]));
const carrierById = Object.fromEntries(data.carriers.map((c) => [c.id, c]));
const regionById = Object.fromEntries(data.regions.map((r) => [r.id, r]));

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const dShort = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const dLong = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const dTime = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });

const fmt = {
  pct: (v) => (v == null ? '—' : `${nf1.format(v * 100)}%`),
  int: (v) => (v == null ? '—' : nf0.format(v)),
  one: (v) => (v == null ? '—' : nf1.format(v)),
  usd: (v) => (v == null ? '—' : usd.format(v)),
  usd0: (v) => (v == null ? '—' : usd0.format(v)),
  date: (t) => (t == null ? '—' : dShort.format(t)),
  dt: (t) => (t == null ? '—' : dTime.format(t)),
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function dueText(o, now) {
  const h = (o.promisedAt - now) / 3600000;
  if (h < 0) return `<span class="pill red">${nf1.format(-h / 24)}d overdue</span>`;
  if (h < 24) return `<span class="pill orange">Due in ${Math.max(1, Math.round(h))}h</span>`;
  return `<span class="muted">Due in ${nf1.format(h / 24)}d</span>`;
}
const REASON_COLOR = { 'Past promise': 'red', 'Out of stock': 'red', 'Carrier delay': 'orange', 'Tight window': 'orange', 'Low stock': 'orange', 'Not shipped': 'gray' };
const chips = (reasons) => `<div class="chips">${reasons.map((r) => `<span class="pill ${REASON_COLOR[r] || 'gray'}">${esc(r)}</span>`).join('')}</div>`;
function riskBar(score) {
  const s = score >= 85 ? 'red' : score >= 60 ? 'orange' : 'green';
  const c = statusColor(tokens(), s);
  return `<div class="riskbar"><div class="track"><div class="fill" style="width:${score}%;background:${c}"></div></div><b>${score}</b></div>`;
}
function orderStatus(o, now) {
  if (o.cancelledAt && o.cancelledAt <= now) return '<span class="pill gray">Cancelled</span>';
  if (o.deliveredAt) return o.deliveredAt <= o.promisedAt ? '<span class="pill green">On time</span>' : '<span class="pill red">Late</span>';
  if (o.shippedAt) return '<span class="pill blue">In transit</span>';
  return '<span class="pill orange">Not shipped</span>';
}

// ---------------------------------------------------------------------------
// Filter state (mirrored in the URL hash so a link reproduces the view)
// ---------------------------------------------------------------------------
const DEFAULTS = { days: 30, region: 'all', warehouse: 'all', carrier: 'all' };
let state = readHash();

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const s = { ...DEFAULTS };
  if ([7, 30, 90].includes(+p.get('p'))) s.days = +p.get('p');
  if (regionById[p.get('r')]) s.region = p.get('r');
  if (whById[p.get('w')]) s.warehouse = p.get('w');
  if (carrierById[p.get('c')]) s.carrier = p.get('c');
  if (s.warehouse !== 'all' && s.region !== 'all' && whById[s.warehouse].region !== s.region) s.warehouse = 'all';
  return s;
}
function writeHash() {
  const p = new URLSearchParams();
  if (state.days !== DEFAULTS.days) p.set('p', state.days);
  if (state.region !== 'all') p.set('r', state.region);
  if (state.warehouse !== 'all') p.set('w', state.warehouse);
  if (state.carrier !== 'all') p.set('c', state.carrier);
  const h = p.toString();
  history.replaceState(null, '', h ? `#${h}` : location.pathname + location.search);
}

const $ = (id) => document.getElementById(id);

function buildFilters() {
  const opt = (v, label, sel) => `<option value="${v}"${sel ? ' selected' : ''}>${esc(label)}</option>`;
  $('f-region').innerHTML = opt('all', 'All regions', state.region === 'all') +
    data.regions.map((r) => opt(r.id, r.name, state.region === r.id)).join('');
  const whs = data.warehouses.filter((w) => state.region === 'all' || w.region === state.region);
  $('f-warehouse').innerHTML = opt('all', 'All warehouses', state.warehouse === 'all') +
    whs.map((w) => opt(w.id, w.name, state.warehouse === w.id)).join('');
  $('f-carrier').innerHTML = opt('all', 'All carriers', state.carrier === 'all') +
    data.carriers.map((c) => opt(c.id, c.name, state.carrier === c.id)).join('');
  for (const b of $('f-period').querySelectorAll('button')) b.setAttribute('aria-pressed', String(+b.dataset.days === state.days));
}

function setState(patch) {
  state = { ...state, ...patch };
  if (patch.region && state.warehouse !== 'all' && whById[state.warehouse].region !== state.region && state.region !== 'all') state.warehouse = 'all';
  writeHash();
  buildFilters();
  render();
}

$('f-period').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setState({ days: +b.dataset.days }); });
$('f-region').addEventListener('change', (e) => setState({ region: e.target.value }));
$('f-warehouse').addEventListener('change', (e) => {
  const w = e.target.value;
  setState(w === 'all' ? { warehouse: w } : { warehouse: w, region: whById[w].region });
});
$('f-carrier').addEventListener('change', (e) => setState({ carrier: e.target.value }));
$('f-reset').addEventListener('click', () => setState({ ...DEFAULTS }));
window.addEventListener('hashchange', () => { state = readHash(); buildFilters(); render(); });

// ---------------------------------------------------------------------------
// Compute everything for the current filters
// ---------------------------------------------------------------------------
function compute() {
  const now = data.now;
  const P = K.periods(now, state.days);
  const orders = K.scopeOrders(data, state);
  const inv = K.scopeInventory(data, state);

  const slaCur = K.sla(orders, P.cur);
  const slaPrev = K.sla(orders, P.prev);
  const risk = K.riskAt(orders, data.orders, inv, now);
  const riskPrev = K.riskAt(orders, data.orders, inv, P.prev.end);
  const invCur = K.inventoryStats(inv);
  const invPrev = K.inventoryStats(inv, { prev: true });
  const costCur = K.cost(orders, P.cur);
  const costPrev = K.cost(orders, P.prev);
  const turnCur = K.turnover(orders, P.cur, invCur.value);
  const prevValue = inv.reduce((s, p) => s + p.onHandPrev * p.unitCost, 0);
  const turnPrev = K.turnover(orders, P.prev, prevValue);

  const pack = (list) => ({
    open: list.length,
    atRisk: list.filter((r) => r.atRisk),
    cancel: list.filter((r) => r.likelyCancel),
  });

  return {
    now, P, orders, inv,
    slaCur, slaPrev,
    risk: { list: risk, ...pack(risk) },
    riskPrev: pack(riskPrev),
    invCur, invPrev, turnCur, turnPrev,
    costCur, costPrev,
    daily: K.slaDaily(orders, P.cur),
    carriers: K.carrierScorecard(orders, data.carriers, P.cur),
    byWh: K.byWarehouse(inv, data.warehouses),
    aging: K.aging(inv),
    weekly: K.costWeekly(orders, now),
  };
}

// ---------------------------------------------------------------------------
// KPI tiles
// ---------------------------------------------------------------------------
function delta(cur, prev, { mode, goodUp, label }) {
  if (cur == null || prev == null) return { text: '', cls: 'flat' };
  let d, text;
  if (mode === 'pts') { d = (cur - prev) * 100; text = `${nf1.format(Math.abs(d))} pts`; }
  else if (mode === 'abs') { d = cur - prev; text = nf0.format(Math.abs(d)); }
  else if (mode === 'one') { d = cur - prev; text = nf1.format(Math.abs(d)); }
  else if (mode === 'usd') { d = cur - prev; text = usd.format(Math.abs(d)); }
  else { d = prev ? (cur - prev) / prev : 0; text = `${nf1.format(Math.abs(d) * 100)}%`; }
  const eps = mode === 'pct' ? 0.005 : mode === 'pts' ? 0.05 : 0.001;
  if (Math.abs(d) < eps) return { text: `No change ${label}`, cls: 'flat' };
  const up = d > 0;
  return { text: `${up ? '▲' : '▼'} ${text} ${label}`, cls: up === goodUp ? 'good' : 'bad' };
}

function kpiDefs(m) {
  const per = `vs prior ${state.days}D`;
  const rOpen = m.risk.open || 0;
  const share = (n) => (rOpen ? n / rOpen : null);
  return [
    {
      group: 'Service', items: [
        { id: 'sla', label: 'SLA compliance', value: fmt.pct(m.slaCur.pct), st: K.status('sla', m.slaCur.pct),
          delta: delta(m.slaCur.pct, m.slaPrev.pct, { mode: 'pts', goodUp: true, label: per }) },
        { id: 'breaches', label: 'SLA breaches', value: fmt.int(m.slaCur.breaches.length),
          sub: `of ${fmt.int(m.slaCur.due)} due`,
          st: K.status('breaches', m.slaCur.breaches.length, { prev: m.slaPrev.breaches.length }),
          delta: delta(m.slaCur.breaches.length, m.slaPrev.breaches.length, { mode: 'pct', goodUp: false, label: per }) },
        { id: 'risk', label: 'Orders at risk', value: fmt.int(m.risk.atRisk.length), sub: `of ${fmt.int(rOpen)} open`,
          st: K.status('risk', share(m.risk.atRisk.length)),
          delta: delta(m.risk.atRisk.length, m.riskPrev.atRisk.length, { mode: 'abs', goodUp: false, label: `vs ${state.days}D ago` }) },
        { id: 'cancel', label: 'Likely cancellations', value: fmt.int(m.risk.cancel.length),
          sub: fmt.usd0(m.risk.cancel.reduce((s, r) => s + r.order.value, 0)),
          st: K.status('cancel', share(m.risk.cancel.length)),
          delta: delta(m.risk.cancel.length, m.riskPrev.cancel.length, { mode: 'abs', goodUp: false, label: `vs ${state.days}D ago` }) },
      ],
    },
    {
      group: 'Inventory', items: [
        { id: 'stockouts', label: 'Stockout SKUs', value: fmt.int(m.invCur.stockouts), sub: 'SKU × site',
          st: K.status('stockouts', m.invCur.stockouts),
          delta: delta(m.invCur.stockouts, m.invPrev.stockouts, { mode: 'abs', goodUp: false, label: 'vs 30D ago' }) },
        { id: 'turnover', label: 'Inventory turnover', value: m.turnCur == null ? '—' : `${fmt.one(m.turnCur)}×`, sub: 'annualized',
          st: K.status('turnover', m.turnCur),
          delta: delta(m.turnCur, m.turnPrev, { mode: 'one', goodUp: true, label: per }) },
        { id: 'dos', label: 'Days of supply', value: fmt.one(m.invCur.dos), sub: 'target 20–45',
          st: K.status('dos', m.invCur.dos),
          delta: delta(m.invCur.dos, m.invPrev.dos, { mode: 'one', goodUp: m.invCur.dos < 20, label: 'vs 30D ago' }) },
      ],
    },
    {
      group: 'Cost', items: [
        { id: 'cpo', label: 'Cost per order', value: fmt.usd(m.costCur.perOrder), sub: `goal ${fmt.usd(K.TARGETS.costPerOrder)}`,
          st: K.status('cpo', m.costCur.perOrder),
          delta: delta(m.costCur.perOrder, m.costPrev.perOrder, { mode: 'usd', goodUp: false, label: per }) },
        { id: 'cps', label: 'Cost per shipment', value: fmt.usd(m.costCur.perShipment), sub: `goal ${fmt.usd(K.TARGETS.costPerShipment)}`,
          st: K.status('cps', m.costCur.perShipment),
          delta: delta(m.costCur.perShipment, m.costPrev.perShipment, { mode: 'usd', goodUp: false, label: per }) },
      ],
    },
  ];
}

const STATUS_LABEL = { green: 'On target', orange: 'Watch', red: 'Action needed', gray: 'No data', blue: '' };

function renderKpis(m) {
  const groups = kpiDefs(m);
  $('kpis').innerHTML = groups.map((g) => `
    <div class="kpi-group-label">${g.group}</div>
    <div class="kpi-grid">
      ${g.items.map((k) => `
        <button type="button" class="kpi" data-kpi="${k.id}" aria-label="${esc(k.label)}: ${esc(k.value)}. ${STATUS_LABEL[k.st]}. Open details">
          <div class="kpi-top">
            <span class="kpi-label">${esc(k.label)}</span>
            <span class="dot ${k.st}" title="${STATUS_LABEL[k.st]}"></span>
          </div>
          <div class="kpi-value">${esc(k.value)}${k.sub ? ` <small>${esc(k.sub)}</small>` : ''}</div>
          <div class="kpi-foot">
            <span class="delta ${k.delta.cls}">${esc(k.delta.text)}</span>
            <span class="kpi-chevron" aria-hidden="true" style="margin-left:auto">›</span>
          </div>
        </button>`).join('')}
    </div>`).join('');
  return groups.flatMap((g) => g.items);
}

$('kpis').addEventListener('click', (e) => {
  const b = e.target.closest('[data-kpi]');
  if (b) drill[b.dataset.kpi]?.();
});

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------
function scopeLabel() {
  const parts = [];
  if (state.warehouse !== 'all') parts.push(whById[state.warehouse].name);
  else if (state.region !== 'all') parts.push(regionById[state.region].name);
  else parts.push('Global network');
  if (state.carrier !== 'all') parts.push(carrierById[state.carrier].name);
  return parts.join(' · ');
}

function renderHero(m, tiles) {
  $('asof').textContent = `${scopeLabel()} · Data as of ${dLong.format(m.now)}`;
  const reds = tiles.filter((t) => t.st === 'red');
  const ambers = tiles.filter((t) => t.st === 'orange');
  const serviceRed = reds.some((t) => ['sla', 'risk', 'cancel'].includes(t.id));

  $('headline').textContent = serviceRed ? 'Service needs attention.' : reds.length ? 'Mostly on track, with exceptions.' : 'The network is on track.';

  const lines = [];
  if (m.slaCur.pct != null) {
    const gap = (m.slaCur.pct - K.TARGETS.sla) * 100;
    lines.push(`SLA compliance is ${fmt.pct(m.slaCur.pct)}, ${gap >= 0 ? `${nf1.format(gap)} pts above` : `${nf1.format(-gap)} pts below`} the 95% target.`);
  }
  if (m.risk.atRisk.length) {
    const byRegion = {};
    for (const r of m.risk.atRisk) byRegion[r.order.region] = (byRegion[r.order.region] || 0) + 1;
    const [topR, topN] = Object.entries(byRegion).sort((a, b) => b[1] - a[1])[0];
    const where = state.region === 'all' && Object.keys(byRegion).length > 1 ? `, ${Math.round((topN / m.risk.atRisk.length) * 100)}% of them in ${regionById[topR].name}` : '';
    lines.push(`${fmt.int(m.risk.atRisk.length)} open orders are at risk${where}.`);
  } else {
    lines.push('No open orders are currently at risk.');
  }
  const worst = [...m.carriers].filter((c) => c.due >= 20).sort((a, b) => a.onTimePct - b.onTimePct)[0];
  if (worst && state.carrier === 'all' && worst.onTimePct < K.TARGETS.sla) {
    lines.push(`${worst.carrier.name} is the weakest carrier at ${fmt.pct(worst.onTimePct)} on time.`);
  }
  if (m.invCur.stockouts) {
    const top = [...m.byWh].sort((a, b) => b.stockouts - a.stockouts)[0];
    lines.push(`${fmt.int(m.invCur.stockouts)} SKU positions are out of stock${top && top.stockouts && m.byWh.length > 1 ? `, led by ${top.warehouse.name} (${top.stockouts})` : ''}.`);
  }
  $('lede').textContent = lines.join(' ');

  const st = reds.length ? 'red' : ambers.length ? 'orange' : 'green';
  const parts = [];
  if (reds.length) parts.push(`${reds.length} need${reds.length === 1 ? 's' : ''} action`);
  if (ambers.length) parts.push(`${ambers.length} to watch`);
  const ok = tiles.length - reds.length - ambers.length;
  if (ok) parts.push(`${ok} on target`);
  $('headline-status').innerHTML = `<span class="headline-status pill ${st}"><span class="dot ${st}"></span>${parts.join(' · ')}</span>`;
}

// ---------------------------------------------------------------------------
// Charts + tables
// ---------------------------------------------------------------------------
function renderService(m) {
  const t = tokens();
  lineChart($('c-sla'), {
    labels: m.daily.map((d) => fmt.date(d.t)),
    data: m.daily.map((d) => (d.pct == null ? null : +(d.pct * 100).toFixed(1))),
    target: 95,
    yMin: 80, yMax: 100,
    yFormat: (v) => `${v}%`,
    tooltipFormat: (ctx) => {
      const d = m.daily[ctx.dataIndex];
      return `${fmt.pct(d.pct)} on time · ${d.late} late of ${d.due}`;
    },
    onClick: (i) => {
      const d = m.daily[i];
      const r = { start: d.t, end: d.t + DAY };
      openOrderList(`Breaches due ${dLong.format(d.t)}`, `${d.late} of ${d.due} orders due that day missed their promise`,
        m.slaCur.breaches.filter((o) => o.promisedAt >= r.start && o.promisedAt < r.end));
    },
  });

  // Breaches by region, or by warehouse when a region is selected.
  const byWh = state.region !== 'all' || state.warehouse !== 'all';
  const keys = byWh
    ? data.warehouses.filter((w) => (state.region === 'all' || w.region === state.region) && (state.warehouse === 'all' || w.id === state.warehouse)).map((w) => w.id)
    : data.regions.map((r) => r.id);
  const counts = keys.map((k) => m.slaCur.breaches.filter((o) => (byWh ? o.warehouse : o.region) === k).length);
  const palette = [t.blue, t.purple, t.teal, t.orange, t.green, t.red];
  barChart($('c-breach'), {
    labels: keys.map((k) => (byWh ? whById[k].name : regionById[k].name)),
    data: counts,
    colors: keys.map((_, i) => palette[i % palette.length]),
    emptyMsg: 'No breaches in this period',
    tooltipFormat: (ctx) => `${fmt.int(ctx.raw)} breaches`,
    onClick: (i) => {
      const k = keys[i];
      const name = byWh ? whById[k].name : regionById[k].name;
      openOrderList(`Breaches · ${name}`, `Orders due in the last ${state.days} days that missed their promise`,
        m.slaCur.breaches.filter((o) => (byWh ? o.warehouse : o.region) === k));
    },
  });
}

function renderRisk(m) {
  const top = m.risk.atRisk.slice(0, 10);
  const value = m.risk.atRisk.reduce((s, r) => s + r.order.value, 0);
  $('risk-summary').innerHTML = m.risk.atRisk.length
    ? `<b style="color:var(--text)">${fmt.int(m.risk.atRisk.length)}</b> at risk · ${fmt.usd0(value)} order value · <b style="color:var(--text)">${fmt.int(m.risk.cancel.length)}</b> likely to cancel`
    : 'No open orders at risk';
  $('risk-all').hidden = m.risk.atRisk.length <= 10;
  $('t-risk').innerHTML = top.length ? `
    <thead><tr>
      <th>Order</th><th class="hide-sm">Customer</th><th>Site</th><th class="hide-sm">Carrier</th><th>Promise</th><th>Risk</th><th>Why</th>
    </tr></thead>
    <tbody>${top.map((r) => `
      <tr class="clickable" data-order="${r.order.id}">
        <td class="mono">${r.order.id}</td>
        <td class="hide-sm">${esc(r.order.customer)}</td>
        <td>${esc(whById[r.order.warehouse].name)}</td>
        <td class="hide-sm">${esc(carrierById[r.order.carrier].name)}</td>
        <td>${dueText(r.order, m.now)}</td>
        <td>${riskBar(r.score)}</td>
        <td>${chips(r.reasons)}</td>
      </tr>`).join('')}
    </tbody>` : '<tbody><tr><td class="muted" style="padding:28px 10px;text-align:center">Nothing at risk for this selection 🎉</td></tr></tbody>';
}

function renderInventory(m) {
  const t = tokens();
  const rows = m.byWh;
  barChart($('c-stockout'), {
    labels: rows.map((r) => r.warehouse.name),
    data: rows.map((r) => r.stockouts),
    colors: rows.map((r) => statusColor(t, r.stockouts > 8 ? 'red' : r.stockouts > 2 ? 'orange' : 'green')),
    horizontal: true,
    emptyMsg: 'No stockouts 🎉',
    tooltipFormat: (ctx) => `${ctx.raw} SKUs out of stock`,
    onClick: (i) => openStockList(`Stockouts · ${rows[i].warehouse.name}`, 'SKUs at zero on hand with active demand', rows[i].outs),
  });

  const agingColors = [t.green, t.orange, t.red];
  doughnutChart($('c-aging'), {
    labels: m.aging.map((b) => b.label),
    data: m.aging.map((b) => Math.round(b.value)),
    colors: agingColors,
    tooltipFormat: (ctx) => {
      const total = m.aging.reduce((s, b) => s + b.value, 0);
      return `${fmt.usd0(ctx.raw)} · ${fmt.pct(total ? ctx.raw / total : 0)}`;
    },
    onClick: (i) => openStockList(`Stock aged ${m.aging[i].label}`, `${fmt.usd0(m.aging[i].value)} of inventory value`,
      [...m.aging[i].items].sort((a, b) => b.onHand * b.unitCost - a.onHand * a.unitCost)),
  });

  barChart($('c-dos'), {
    labels: rows.map((r) => r.warehouse.name),
    data: rows.map((r) => +(r.dos ?? 0).toFixed(1)),
    colors: rows.map((r) => statusColor(t, K.status('dos', r.dos))),
    horizontal: true,
    tooltipFormat: (ctx) => `${ctx.raw} days of supply`,
    onClick: (i) => openStockList(`Days of supply · ${rows[i].warehouse.name}`, 'All SKU positions, longest cover first',
      [...rows[i].items].sort((a, b) => dosOf(b) - dosOf(a))),
  });
}
const dosOf = (p) => (p.dailyDemand ? p.onHand / p.dailyDemand : p.onHand ? Infinity : 0);

function renderCarriers(m) {
  const t = tokens();
  $('t-carrier').innerHTML = m.carriers.length ? `
    <thead><tr><th>Carrier</th><th>On time</th><th class="num hide-sm">Shipments</th><th class="num">Cost / shipment</th><th class="num">Breach share</th></tr></thead>
    <tbody>${m.carriers.map((c) => {
      const st = K.status('sla', c.onTimePct);
      return `<tr class="clickable" data-carrier="${c.carrier.id}">
        <td><span class="dot ${st}" style="margin-right:8px"></span>${esc(c.carrier.name)}</td>
        <td><div style="display:flex;align-items:center;gap:10px"><b style="font-weight:600;width:52px">${fmt.pct(c.onTimePct)}</b>
          <div class="bar-inline" style="flex:1"><div style="width:${(c.onTimePct || 0) * 100}%;background:${statusColor(t, st)}"></div></div></div></td>
        <td class="num hide-sm">${fmt.int(c.shipped)}</td>
        <td class="num">${fmt.usd(c.perShipment)}</td>
        <td class="num">${fmt.pct(c.breachShare)}</td>
      </tr>`;
    }).join('')}</tbody>` : '<tbody><tr><td class="muted" style="padding:28px 10px;text-align:center">No shipments for this selection</td></tr></tbody>';

  lineChart($('c-cost'), {
    labels: m.weekly.map((w) => fmt.date(w.t)),
    data: m.weekly.map((w) => (w.perOrder == null ? null : +w.perOrder.toFixed(2))),
    target: K.TARGETS.costPerOrder,
    color: t.purple,
    yMin: K.TARGETS.costPerOrder - 1,
    yFormat: (v) => `$${v}`,
    tooltipFormat: (ctx) => `${fmt.usd(ctx.raw)} per order · ${fmt.int(m.weekly[ctx.dataIndex].orders)} orders`,
    onClick: (i) => {
      const w = m.weekly[i];
      openCostBreakdown(`Cost · week of ${fmt.date(w.t)}`, { start: w.t, end: w.t + 7 * DAY }, m.orders);
    },
  });
}

// ---------------------------------------------------------------------------
// Drill-down sheet
// ---------------------------------------------------------------------------
let lastFocus = null;
function openSheet(title, sub, html) {
  lastFocus = document.activeElement;
  $('sheet-title').textContent = title;
  $('sheet-sub').textContent = sub || '';
  $('sheet-body').innerHTML = html;
  $('sheet-body').scrollTop = 0;
  $('sheet').classList.add('open');
  $('sheet').setAttribute('aria-hidden', 'false');
  $('scrim').classList.add('open');
  document.body.style.overflow = 'hidden';
  $('sheet-close').focus();
}
function closeSheet() {
  $('sheet').classList.remove('open');
  $('sheet').setAttribute('aria-hidden', 'true');
  $('scrim').classList.remove('open');
  document.body.style.overflow = '';
  lastFocus?.focus?.();
}
$('sheet-close').addEventListener('click', closeSheet);
$('scrim').addEventListener('click', closeSheet);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('sheet').classList.contains('open')) closeSheet(); });

const MAX_ROWS = 300;
function capNote(n) { return n > MAX_ROWS ? `<p class="muted" style="font-size:13px;margin-top:12px">Showing the first ${MAX_ROWS} of ${fmt.int(n)}.</p>` : ''; }

function openOrderList(title, sub, list) {
  const now = data.now;
  const rows = [...list].sort((a, b) => b.promisedAt - a.promisedAt);
  const value = rows.reduce((s, o) => s + o.value, 0);
  openSheet(title, sub, rows.length ? `
    <div class="sheet-summary"><span><b>${fmt.int(rows.length)}</b> orders</span><span><b>${fmt.usd0(value)}</b> order value</span></div>
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Order</th><th class="hide-sm">Customer</th><th>Site</th><th class="hide-sm">Carrier</th><th>Promised</th><th>Status</th></tr></thead>
      <tbody>${rows.slice(0, MAX_ROWS).map((o) => `
        <tr class="clickable" data-order="${o.id}">
          <td class="mono">${o.id}</td><td class="hide-sm">${esc(o.customer)}</td><td>${esc(whById[o.warehouse].name)}</td>
          <td class="hide-sm">${esc(carrierById[o.carrier].name)}</td><td>${fmt.dt(o.promisedAt)}</td><td>${orderStatus(o, now)}</td>
        </tr>`).join('')}</tbody>
    </table></div>${capNote(rows.length)}` : '<div class="empty" style="height:200px">No orders</div>');
}

function openRiskList(title, sub, list) {
  const value = list.reduce((s, r) => s + r.order.value, 0);
  openSheet(title, sub, list.length ? `
    <div class="sheet-summary"><span><b>${fmt.int(list.length)}</b> orders</span><span><b>${fmt.usd0(value)}</b> order value</span></div>
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Order</th><th>Site</th><th class="hide-sm">Carrier</th><th>Promise</th><th>Risk</th><th>Why</th></tr></thead>
      <tbody>${list.slice(0, MAX_ROWS).map((r) => `
        <tr class="clickable" data-order="${r.order.id}">
          <td class="mono">${r.order.id}</td><td>${esc(whById[r.order.warehouse].name)}</td>
          <td class="hide-sm">${esc(carrierById[r.order.carrier].name)}</td><td>${dueText(r.order, data.now)}</td>
          <td>${riskBar(r.score)}</td><td>${chips(r.reasons)}</td>
        </tr>`).join('')}</tbody>
    </table></div>${capNote(list.length)}` : '<div class="empty" style="height:200px">Nothing at risk 🎉</div>');
}

function openStockList(title, sub, list) {
  const value = list.reduce((s, p) => s + p.onHand * p.unitCost, 0);
  openSheet(title, sub, list.length ? `
    <div class="sheet-summary"><span><b>${fmt.int(list.length)}</b> SKU positions</span><span><b>${fmt.usd0(value)}</b> on hand</span></div>
    <div class="table-wrap"><table class="data">
      <thead><tr><th>SKU</th><th>Product</th><th>Site</th><th class="num">On hand</th><th class="num hide-sm">Daily demand</th><th class="num">Days of supply</th><th class="num hide-sm">Age</th></tr></thead>
      <tbody>${list.slice(0, MAX_ROWS).map((p) => {
        const sku = data.skuById[p.sku];
        const dos = dosOf(p);
        return `<tr>
          <td class="mono">${p.sku}</td><td>${esc(sku.name)}<div class="muted" style="font-size:12px">${esc(sku.category)}</div></td>
          <td>${esc(whById[p.warehouse].name)}</td>
          <td class="num">${p.onHand === 0 ? '<span class="pill red">0</span>' : fmt.int(p.onHand)}</td>
          <td class="num hide-sm">${fmt.one(p.dailyDemand)}</td>
          <td class="num">${dos === Infinity ? '∞' : fmt.one(dos)}</td>
          <td class="num hide-sm">${p.onHand ? `${p.ageDays}d` : '—'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>${capNote(list.length)}` : '<div class="empty" style="height:200px">Nothing to show</div>');
}

function openCostBreakdown(title, range, orders) {
  const group = (keyFn, nameFn) => {
    const acc = {};
    for (const o of orders) {
      if (o.createdAt < range.start || o.createdAt >= range.end || o.cancelledAt) continue;
      const a = (acc[keyFn(o)] ||= { n: 0, ship: 0, ful: 0 });
      a.n++; a.ship += o.shippingCost; a.ful += o.fulfillmentCost;
    }
    return Object.entries(acc).map(([k, a]) => ({ name: nameFn(k), ...a, per: (a.ship + a.ful) / a.n })).sort((a, b) => b.per - a.per);
  };
  const table = (head, rows) => `
    <h3 style="margin:18px 0 6px;font-size:15px">${head}</h3>
    <div class="table-wrap"><table class="data">
      <thead><tr><th>${head.replace('By ', '')}</th><th class="num">Orders</th><th class="num">Shipping</th><th class="num">Fulfillment</th><th class="num">Cost / order</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${esc(r.name)}</td><td class="num">${fmt.int(r.n)}</td><td class="num">${fmt.usd0(r.ship)}</td><td class="num">${fmt.usd0(r.ful)}</td>
        <td class="num"><span class="pill ${K.status('cpo', r.per)}">${fmt.usd(r.per)}</span></td></tr>`).join('')}</tbody>
    </table></div>`;
  const byW = group((o) => o.warehouse, (k) => whById[k].name);
  const byC = group((o) => o.carrier, (k) => carrierById[k].name);
  const total = K.cost(orders, range);
  openSheet(title, `Shipping + fulfillment cost, target ${fmt.usd(K.TARGETS.costPerOrder)} per order`, total.orders ? `
    <div class="sheet-summary"><span><b>${fmt.int(total.orders)}</b> orders</span><span><b>${fmt.usd(total.perOrder)}</b> per order</span><span><b>${fmt.usd(total.perShipment)}</b> per shipment</span><span><b>${fmt.usd0(total.total)}</b> total</span></div>
    ${table('By warehouse', byW)}${table('By carrier', byC)}` : '<div class="empty" style="height:200px">No orders</div>');
}

function openOrder(id) {
  const o = data.orders.find((x) => x.id === id);
  if (!o) return;
  const sku = data.skuById[o.sku];
  const risk = current?.risk.list.find((r) => r.order.id === id);
  const cell = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
  openSheet(`Order ${o.id}`, `${o.customer} · ${o.express ? 'Express (2-day SLA)' : 'Standard (5-day SLA)'}`, `
    <div style="display:flex;gap:8px;align-items:center;margin-top:14px">${orderStatus(o, data.now)}${risk ? riskBar(risk.score) : ''}</div>
    ${risk ? `<div style="margin-top:10px">${chips(risk.reasons)}</div>` : ''}
    <dl class="detail-grid">
      ${cell('Product', `${esc(sku.name)} × ${o.qty}`)}
      ${cell('SKU', `<span class="mono">${o.sku}</span>`)}
      ${cell('Warehouse', esc(whById[o.warehouse].city))}
      ${cell('Carrier', esc(carrierById[o.carrier].name))}
      ${cell('Created', fmt.dt(o.createdAt))}
      ${cell('Promised', fmt.dt(o.promisedAt))}
      ${cell('Shipped', fmt.dt(o.shippedAt))}
      ${cell(o.cancelledAt ? 'Cancelled' : 'Delivered', fmt.dt(o.cancelledAt || o.deliveredAt))}
      ${cell('Order value', fmt.usd(o.value))}
      ${cell('Logistics cost', `${fmt.usd(o.shippingCost + o.fulfillmentCost)} <span class="muted" style="font-weight:400">(${fmt.usd(o.shippingCost)} ship)</span>`)}
    </dl>`);
}

document.addEventListener('click', (e) => {
  const r = e.target.closest('tr[data-order]');
  if (r) { openOrder(r.dataset.order); return; }
  const c = e.target.closest('tr[data-carrier]');
  if (c && current) {
    const id = c.dataset.carrier;
    openOrderList(`${carrierById[id].name} · breaches`, `Orders due in the last ${state.days} days that missed their promise`,
      current.slaCur.breaches.filter((o) => o.carrier === id));
  }
});
$('risk-all').addEventListener('click', () => current && drill.risk());

const drill = {
  sla: () => drill.breaches(),
  breaches: () => openOrderList('SLA breaches', `Orders due in the last ${state.days} days that missed their promise`, current.slaCur.breaches),
  risk: () => openRiskList('Orders at risk', `Open orders scoring ${K.TARGETS.riskThreshold}+ on delay risk`, current.risk.atRisk),
  cancel: () => openRiskList('Likely cancellations', `Risk ${K.TARGETS.cancelThreshold}+ or more than 3 days past promise`, current.risk.cancel),
  stockouts: () => openStockList('Stockouts', 'SKU positions at zero on hand with active demand', current.invCur.outs),
  turnover: () => openStockList('Slowest-moving stock', 'Positions with the longest cover hold turnover down',
    [...current.inv].filter((p) => p.onHand).sort((a, b) => dosOf(b) - dosOf(a))),
  dos: () => drill.turnover(),
  cpo: () => openCostBreakdown(`Cost · last ${state.days} days`, current.P.cur, current.orders),
  cps: () => drill.cpo(),
};

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
let current = null;
function render() {
  current = compute();
  const tiles = renderKpis(current);
  renderHero(current, tiles);
  renderService(current);
  renderRisk(current);
  renderInventory(current);
  renderCarriers(current);
}

if (window.Chart) {
  Chart.defaults.font.family = tokens().font;
}
buildFilters();
render();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
