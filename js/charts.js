// Thin Chart.js wrappers that pull every color from the CSS design tokens.
/* global Chart */

let animate = true;
/** Turn chart animations off (e.g. while capturing a PDF) and back on. */
export function setAnimate(on) { animate = on; }

export function tokens() {
  const s = getComputedStyle(document.documentElement);
  const v = (n) => s.getPropertyValue(n).trim();
  return {
    font: v('--font'), text: v('--text'), text2: v('--text-2'), text3: v('--text-3'),
    hairline: v('--hairline'), surface: v('--surface'),
    blue: v('--blue'), green: v('--green-dot'), orange: v('--orange-dot'), red: v('--red-dot'),
    purple: v('--purple'), teal: v('--teal'), fill: v('--fill'),
  };
}

export function statusColor(t, s) {
  return { green: t.green, orange: t.orange, red: t.red, blue: t.blue }[s] || t.text3;
}

function base(t, { onClick, yFormat, xGrid = false, yGrid = true, tooltipFormat } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: animate ? { duration: 450, easing: 'easeOutQuart' } : false,
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: 4, right: 4 } },
    onClick: onClick ? (_e, els) => { if (els.length) onClick(els[0].index); } : undefined,
    onHover: onClick ? (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; } : undefined,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: t.surface, titleColor: t.text, bodyColor: t.text2,
        borderColor: t.hairline, borderWidth: 1, padding: 10, cornerRadius: 10,
        titleFont: { family: t.font, weight: '600', size: 13 }, bodyFont: { family: t.font, size: 12.5 },
        displayColors: false,
        callbacks: tooltipFormat ? { label: tooltipFormat } : {},
      },
    },
    scales: {
      x: {
        grid: { display: xGrid, color: t.hairline }, border: { display: false },
        ticks: { color: t.text3, font: { family: t.font, size: 11.5 }, maxRotation: 0, autoSkipPadding: 14 },
      },
      y: {
        grid: { display: yGrid, color: t.hairline }, border: { display: false },
        ticks: { color: t.text3, font: { family: t.font, size: 11.5 }, padding: 6, maxTicksLimit: 5, ...(yFormat ? { callback: yFormat } : {}) },
      },
    },
  };
}

/** Show a friendly message instead of an empty chart. Returns true when empty. */
function handleEmpty(canvas, isEmpty, msg = 'No data for this selection') {
  const box = canvas.parentElement;
  let el = box.querySelector('.empty');
  if (isEmpty) {
    Chart.getChart(canvas)?.destroy();
    canvas.style.display = 'none';
    if (!el) { el = document.createElement('div'); el.className = 'empty'; box.appendChild(el); }
    el.textContent = msg;
    return true;
  }
  canvas.style.display = '';
  el?.remove();
  return false;
}

function mount(canvas, config) {
  Chart.getChart(canvas)?.destroy();
  return new Chart(canvas, config);
}

export function lineChart(canvas, { labels, data, target, color, onClick, yFormat, yMin, yMax, tooltipFormat, emptyMsg }) {
  if (handleEmpty(canvas, !data.some((d) => d != null), emptyMsg)) return;
  const t = tokens();
  const c = color || t.blue;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.parentElement.clientHeight || 260);
  grad.addColorStop(0, c + '33');
  grad.addColorStop(1, c + '00');
  const datasets = [{
    data, borderColor: c, backgroundColor: grad, fill: true, tension: 0.35, borderWidth: 2.2,
    pointRadius: data.length > 40 ? 0 : 2.5, pointHoverRadius: 5, pointBackgroundColor: c, spanGaps: true,
  }];
  if (target != null) {
    datasets.push({
      data: labels.map(() => target), borderColor: t.text3, borderDash: [5, 5], borderWidth: 1.2,
      pointRadius: 0, pointHoverRadius: 0, fill: false,
    });
  }
  const opts = base(t, { onClick, yFormat, tooltipFormat });
  if (yMin != null) opts.scales.y.suggestedMin = yMin;
  if (yMax != null) opts.scales.y.suggestedMax = yMax;
  opts.plugins.tooltip.filter = (item) => item.datasetIndex === 0;
  mount(canvas, { type: 'line', data: { labels, datasets }, options: opts });
}

export function barChart(canvas, { labels, data, colors, horizontal, onClick, yFormat, tooltipFormat, emptyMsg }) {
  if (handleEmpty(canvas, !data.length || data.every((d) => !d), emptyMsg)) return;
  const t = tokens();
  const opts = base(t, { onClick, yFormat, tooltipFormat });
  if (horizontal) {
    opts.indexAxis = 'y';
    opts.scales.x.grid.display = true;
    opts.scales.y.grid.display = false;
    if (yFormat) opts.scales.x.ticks.callback = yFormat;
    delete opts.scales.y.ticks.callback;
    delete opts.scales.y.ticks.maxTicksLimit;
    opts.scales.x.ticks.maxTicksLimit = 5;
    opts.scales.x.ticks.precision = 0;
  } else {
    opts.scales.x.ticks.autoSkip = false;
    opts.scales.y.ticks.precision = 0;
  }
  opts.interaction = { mode: 'nearest', intersect: true, axis: horizontal ? 'y' : 'x' };
  mount(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: colors || t.blue, borderRadius: 6, borderSkipped: false, maxBarThickness: 34 }] },
    options: opts,
  });
}

export function doughnutChart(canvas, { labels, data, colors, onClick, tooltipFormat, emptyMsg }) {
  if (handleEmpty(canvas, !data.some((d) => d > 0), emptyMsg)) return;
  const t = tokens();
  mount(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: t.surface, borderWidth: 3, hoverOffset: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '68%',
      animation: animate ? { duration: 450 } : false,
      onClick: onClick ? (_e, els) => { if (els.length) onClick(els[0].index); } : undefined,
      onHover: onClick ? (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; } : undefined,
      plugins: {
        legend: { display: false }, // callers render a compact HTML legend that also shows values
        tooltip: {
          backgroundColor: t.surface, titleColor: t.text, bodyColor: t.text2, borderColor: t.hairline, borderWidth: 1,
          padding: 10, cornerRadius: 10, displayColors: false,
          callbacks: tooltipFormat ? { label: tooltipFormat } : {},
        },
      },
    },
  });
}
