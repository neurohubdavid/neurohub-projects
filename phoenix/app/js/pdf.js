// Draws a reflection document as a real, selectable-text A4 PDF on the device, with no server and no internet.
// Uses pdf-lib (MIT, bundled in app/vendor). Loaded only when a PDF is made, so it never slows the app down.
import { pdfBlocks, winAnsi, fmtLong } from './reports.js';

const A4 = [595.28, 841.89], M = 42, HEAD = 84;
const hex = (h, rgb) => { const n = parseInt(String(h).replace('#', ''), 16); return rgb((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };

/**
 * @returns {Promise<{bytes: Uint8Array, lost: number, pages: number}>} `lost` is how many characters could not be drawn
 *   (emoji and non-Latin scripts) and were replaced with "?".
 */
export async function makePdf(doc, report, { previous = null, logoBytes = null, lib = null } = {}) {
  const { PDFDocument, StandardFonts, rgb } = lib || await import('../vendor/pdf-lib.esm.min.js');
  const pdf = await PDFDocument.create();
  const reg = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold), ital = await pdf.embedFont(StandardFonts.HelveticaOblique);
  let lost = 0;
  const safe = (s) => { const r = winAnsi(s); lost += r.lost; return r.text; };
  const title = safe(doc.title);
  pdf.setTitle(`${doc.title}${report.name ? ' (' + report.name + ')' : ''}`);
  pdf.setAuthor('Phoenix, by NeuroHub Community');
  pdf.setSubject('Self-reflection, not a clinical assessment');
  pdf.setCreator('Phoenix');
  try { pdf.setLanguage('en-GB'); } catch { /* older versions */ }
  let logo = null;
  if (logoBytes) { try { logo = await pdf.embedJpg(logoBytes); } catch { logo = null; } }

  let page = null, y = 0;
  const grey = rgb(0.33, 0.31, 0.42), ink = rgb(0.09, 0.07, 0.12);
  const newPage = () => {
    page = pdf.addPage(A4);
    if (pdf.getPageCount() === 1) {
      page.drawRectangle({ x: 0, y: A4[1] - HEAD, width: A4[0], height: HEAD, color: rgb(0.04, 0.04, 0.04) });
      const stripe = ['#9B3FFF', '#5B9CF6', '#2ED8BE', '#F5C842', '#F5813A', '#FF6EB4'];
      stripe.forEach((c, i) => page.drawRectangle({ x: (A4[0] / 6) * i, y: A4[1] - 4, width: A4[0] / 6 + 1, height: 4, color: hex(c, rgb) }));
      if (logo) page.drawImage(logo, { x: M - 6, y: A4[1] - HEAD + 6, width: 72, height: 72 });
      page.drawText('SIX-POINT FRAMEWORK', { x: M + 76, y: A4[1] - 34, size: 8.5, font: bold, color: rgb(0.75, 0.6, 1) });
      const lines = wrap(title, bold, 19, A4[0] - M * 2 - 80);
      lines.slice(0, 2).forEach((l, i) => page.drawText(l, { x: M + 76, y: A4[1] - 56 - i * 22, size: 19, font: bold, color: rgb(1, 1, 1) }));
      y = A4[1] - HEAD - 22;
    } else y = A4[1] - M;
  };
  const wrap = (text, font, size, width) => {
    const out = [];
    for (const para of String(text).split('\n')) {
      if (!para.trim()) { out.push(''); continue; }
      let line = '';
      for (const word of para.split(/\s+/)) {
        let w = word;
        while (font.widthOfTextAtSize(w, size) > width) { // a single very long word: break it
          let k = w.length; while (k > 1 && font.widthOfTextAtSize(w.slice(0, k), size) > width) k--;
          if (line) { out.push(line); line = ''; }
          out.push(w.slice(0, k)); w = w.slice(k);
        }
        const test = line ? line + ' ' + w : w;
        if (font.widthOfTextAtSize(test, size) <= width) line = test; else { out.push(line); line = w; }
      }
      if (line) out.push(line);
    }
    return out;
  };
  const ensure = (h) => { if (!page || y - h < M + 22) newPage(); };
  const text = (s, { font = reg, size = 10.5, color = ink, indent = 0, gap = 1.35, width = A4[0] - M * 2 - indent } = {}) => {
    for (const l of wrap(safe(s), font, size, width)) { ensure(size * gap); page.drawText(l, { x: M + indent, y: y - size, size, font, color }); y -= size * gap; }
  };

  newPage();
  for (const b of pdfBlocks(doc, report, { previous })) {
    if (b.t === 'intro') { text(b.text, { size: 10, color: grey }); y -= 6; }
    else if (b.t === 'note') {
      const lines = wrap(safe(b.text), ital, 9.5, A4[0] - M * 2 - 20), h = lines.length * 13 + 14;
      ensure(h); page.drawRectangle({ x: M, y: y - h, width: A4[0] - M * 2, height: h, color: rgb(0.95, 0.94, 0.98), borderColor: rgb(0.85, 0.82, 0.93), borderWidth: 0.8 });
      lines.forEach((l, i) => page.drawText(l, { x: M + 10, y: y - 16 - i * 13, size: 9.5, font: ital, color: grey })); y -= h + 12;
    } else if (b.t === 'glance') {
      const rowH = 19, h = 24 + b.rows.length * rowH + 10;
      ensure(h); page.drawText(safe(b.title), { x: M, y: y - 12, size: 11, font: bold, color: ink }); y -= 26;
      for (const r of b.rows) {
        page.drawText(safe(r.label).slice(0, 40), { x: M, y: y - 11, size: 9.5, font: reg, color: ink });
        for (let i = 0; i < r.max; i++) page.drawRectangle({ x: M + 205 + i * 22, y: y - 13, width: 19, height: 13, color: r.value && i < r.value ? hex(r.color, rgb) : rgb(0.93, 0.93, 0.95), borderColor: rgb(0.8, 0.8, 0.85), borderWidth: 0.4 });
        page.drawText(r.value ? String(r.value) : '–', { x: M + 205 + r.max * 22 + 6, y: y - 11, size: 10, font: bold, color: ink });
        if (b.hasPrev && r.value && r.prev != null) { const d = r.value - r.prev; page.drawText(d === 0 ? 'no change' : `${d > 0 ? '+' : ''}${d}`, { x: M + 205 + r.max * 22 + 30, y: y - 11, size: 9, font: reg, color: d < 0 ? rgb(0.7, 0.15, 0.12) : d > 0 ? rgb(0.1, 0.5, 0.25) : grey }); }
        y -= rowH;
      }
      if (b.prevLabel) { page.drawText(safe(b.prevLabel), { x: M, y: y - 9, size: 8.5, font: ital, color: grey }); y -= 14; }
      y -= 8;
    } else if (b.t === 'section') {
      ensure(64); y -= 8;
      page.drawRectangle({ x: M, y: y - 17, width: 4, height: 19, color: hex(b.color, rgb) });
      page.drawText(safe(b.title).slice(0, 80), { x: M + 11, y: y - 13, size: 13, font: bold, color: hex(b.color, rgb) }); y -= 24;
      if (b.sub) { text(b.sub, { size: 9.5, font: ital, color: grey, indent: 11 }); y -= 2; }
    } else if (b.t === 'rating') {
      ensure(24); page.drawText(safe(`${b.label}: ${b.value} out of ${b.max}`), { x: M + 11, y: y - 10, size: 10, font: bold, color: ink });
      for (let i = 0; i < b.max; i++) page.drawRectangle({ x: M + 11 + 200 + i * 16, y: y - 11, width: 13, height: 11, color: i < b.value ? hex(b.color, rgb) : rgb(0.93, 0.93, 0.95), borderColor: rgb(0.8, 0.8, 0.85), borderWidth: 0.4 });
      y -= 22;
    } else if (b.t === 'qa') {
      const ql = wrap(safe(b.q), bold, 9.5, A4[0] - M * 2 - 11), al = wrap(safe(b.a), reg, 10.5, A4[0] - M * 2 - 11);
      ensure(ql.length * 12.5 + Math.min(al.length, 3) * 14.2 + 8);
      for (const l of ql) { ensure(13); page.drawText(l, { x: M + 11, y: y - 9.5, size: 9.5, font: bold, color: grey }); y -= 12.5; }
      for (const l of al) { ensure(15); page.drawText(l, { x: M + 11, y: y - 10.5, size: 10.5, font: reg, color: ink }); y -= 14.2; }
      if (b.draft) { ensure(12); page.drawText('drafted by Phoenix, not yet checked', { x: M + 11, y: y - 8, size: 8, font: ital, color: rgb(0.7, 0.4, 0.05) }); y -= 11; }
      y -= 7;
    } else if (b.t === 'help') {
      const lines = wrap(safe(b.text), reg, 9.5, A4[0] - M * 2 - 20), h = lines.length * 13 + 14;
      y -= 8; ensure(h); page.drawRectangle({ x: M, y: y - h, width: A4[0] - M * 2, height: h, color: rgb(1, 0.95, 0.94), borderColor: rgb(0.9, 0.7, 0.68), borderWidth: 0.8 });
      lines.forEach((l, i) => page.drawText(l, { x: M + 10, y: y - 16 - i * 13, size: 9.5, font: reg, color: ink })); y -= h;
    }
  }
  if (lost) { y -= 10; text(`Note: ${lost} character${lost === 1 ? '' : 's'} (for example emoji or a non-Latin alphabet) could not be shown in this PDF and appear as “?”. Use “Print or save as PDF” in Phoenix to keep every character.`, { size: 8.5, font: ital, color: grey }); }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 34 }, end: { x: A4[0] - M, y: 34 }, thickness: 0.5, color: rgb(0.8, 0.78, 0.85) });
    p.drawText('Made with Phoenix, a free neuro-affirming AI assistant by NeuroHub Community. Not a clinical assessment or diagnosis.', { x: M, y: 22, size: 7.5, font: reg, color: grey });
    p.drawText(`Page ${i + 1} of ${pages.length}`, { x: A4[0] - M - 48, y: 22, size: 7.5, font: reg, color: grey });
  });
  const bytes = await pdf.save();
  return { bytes, lost, pages: pages.length };
}
export { fmtLong };
