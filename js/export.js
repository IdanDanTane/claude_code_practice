// PDF export: captures dashboard sections with html2canvas and lays them out on
// A4 landscape pages with jsPDF. Libraries load on first use only.
/* global html2canvas, jspdf */

const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
];

let libsReady = null;
function loadLibs() {
  libsReady ||= Promise.all(LIBS.map((src) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  }))).catch((e) => { libsReady = null; throw e; });
  return libsReady;
}

const PAGE = { w: 297, h: 210, margin: 12, top: 22, bottom: 14, gap: 5 }; // mm, A4 landscape

/**
 * @param {object} opts
 * @param {HTMLElement[][]} opts.pages  groups of elements; each group becomes one page
 * @param {string} opts.title
 * @param {string} opts.subtitle        scope + period, shown under the title
 * @param {string} opts.asOf            right-aligned header note
 * @param {string} opts.filename
 * @param {string} opts.background      page background color (hex)
 */
export async function exportPdf({ pages, title, subtitle, asOf, filename, background = '#f5f5f7' }) {
  await loadLibs();
  const { jsPDF } = jspdf;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const contentW = PAGE.w - PAGE.margin * 2;
  const contentH = PAGE.h - PAGE.top - PAGE.bottom;
  const exportedAt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());

  for (let p = 0; p < pages.length; p++) {
    if (p > 0) pdf.addPage();
    pdf.setFillColor(background);
    pdf.rect(0, 0, PAGE.w, PAGE.h, 'F');

    // Header
    pdf.setTextColor('#1d1d1f');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text(title, PAGE.margin, 12);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor('#6e6e73');
    pdf.text(subtitle, PAGE.margin, 17);
    pdf.text(asOf, PAGE.w - PAGE.margin, 12, { align: 'right' });
    pdf.text(`Exported ${exportedAt}`, PAGE.w - PAGE.margin, 17, { align: 'right' });

    // Capture this page's sections
    const shots = [];
    for (const el of pages[p]) {
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: background, logging: false, useCORS: true });
      shots.push({ canvas, ratio: canvas.height / canvas.width });
    }

    // Fit to width; shrink uniformly if the stack is taller than the page.
    const gaps = PAGE.gap * (shots.length - 1);
    const naturalH = shots.reduce((s, x) => s + x.ratio * contentW, 0);
    const scale = Math.min(1, (contentH - gaps) / naturalH);
    const w = contentW * scale;
    const x = PAGE.margin + (contentW - w) / 2;
    let y = PAGE.top;
    for (const s of shots) {
      const h = s.ratio * w;
      pdf.addImage(s.canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, w, h, undefined, 'FAST');
      y += h + PAGE.gap;
    }

    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor('#86868b');
    pdf.text('Mock data · idandantane.github.io/claude_code_practice', PAGE.margin, PAGE.h - 7);
    pdf.text(`Page ${p + 1} of ${pages.length}`, PAGE.w - PAGE.margin, PAGE.h - 7, { align: 'right' });
  }

  pdf.save(filename);
}
