// Draws the "wellbeing and identity over time" report as a PDF, in the admin's browser (nothing is uploaded anywhere).
// Input is the group-level report from /api/admin/report, so no individual's scores can appear in it.
export async function makeReportPdf(report, { lib = null, logoBytes = null } = {}) {
  const { PDFDocument, StandardFonts, rgb } = lib || await import('./pdf-lib.esm.min.js');
  const pdf = await PDFDocument.create();
  const reg = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold), ital = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const A4 = [595.28, 841.89], M = 44, W = A4[0] - M * 2;
  const ink = rgb(0.09, 0.07, 0.12), grey = rgb(0.35, 0.33, 0.44), rose = rgb(0.88, 0.11, 0.28), violet = rgb(0.43, 0.21, 0.84), line = rgb(0.85, 0.83, 0.9);
  const clean = (s) => String(s ?? '').replace(/−/g, '-').replace(/[–—]/g, '-').replace(/[^\n\x20-\x7E\xA0-\xFF‘’“”…•]/g, '');
  pdf.setTitle('Phoenix: wellbeing and identity over time'); pdf.setAuthor('NeuroHub Community Ltd'); pdf.setSubject('Group-level, anonymous, from check-ins people chose to share'); try { pdf.setLanguage('en-GB'); } catch { /* older versions */ }
  let logo = null; if (logoBytes) { try { logo = await pdf.embedPng(logoBytes); } catch { logo = null; } }
  let page = null, y = 0;
  const newPage = () => { page = pdf.addPage(A4); y = A4[1] - M; };
  const ensure = (h) => { if (!page || y - h < M + 24) newPage(); };
  const wrap = (text, font, size, width) => {
    const out = [];
    for (const para of clean(text).split('\n')) {
      let cur = ''; for (const word of para.split(/\s+/).filter(Boolean)) { const test = cur ? cur + ' ' + word : word; if (font.widthOfTextAtSize(test, size) <= width) cur = test; else { out.push(cur); cur = word; } }
      out.push(cur);
    }
    return out;
  };
  const text = (s, { font = reg, size = 10.5, color = ink, indent = 0, gap = 1.4, after = 0 } = {}) => { for (const l of wrap(s, font, size, W - indent)) { ensure(size * gap); page.drawText(l, { x: M + indent, y: y - size, size, font, color }); y -= size * gap; } y -= after; };
  const h2 = (s) => { ensure(40); y -= 8; page.drawText(clean(s), { x: M, y: y - 14, size: 14, font: bold, color: ink }); y -= 22; };

  // ---- cover band
  newPage();
  page.drawRectangle({ x: 0, y: A4[1] - 96, width: A4[0], height: 96, color: rgb(0.04, 0.04, 0.04) });
  ['#9B3FFF', '#5B9CF6', '#2ED8BE', '#F5C842', '#F5813A', '#FF6EB4'].forEach((c, i) => { const n = parseInt(c.slice(1), 16); page.drawRectangle({ x: (A4[0] / 6) * i, y: A4[1] - 4, width: A4[0] / 6 + 1, height: 4, color: rgb((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255) }); });
  if (logo) page.drawImage(logo, { x: M - 4, y: A4[1] - 88, width: 76, height: 76 });
  page.drawText('PHOENIX  |  NEUROHUB COMMUNITY', { x: M + 84, y: A4[1] - 34, size: 8.5, font: bold, color: rgb(0.75, 0.6, 1) });
  page.drawText('Wellbeing and identity over time', { x: M + 84, y: A4[1] - 58, size: 21, font: bold, color: rgb(1, 1, 1) });
  page.drawText(clean(`Group report from check-ins people chose to share. Generated ${new Date(report.generated).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`), { x: M + 84, y: A4[1] - 78, size: 9, font: reg, color: rgb(0.8, 0.78, 0.86) });
  y = A4[1] - 96 - 20;

  // ---- at a glance
  const s = report.sample, kp = [[s.devices == null ? 'n/a' : String(s.devices), 'devices that have used Phoenix'], [String(s.participants), 'people sharing check-ins'], [String(s.checkins), 'check-ins shared'], [String(report.change ? report.change.n : 0), 'shared over a week or more']];
  kp.forEach(([n, l], i) => { const bw = (W - 24) / 4, bx = M + i * (bw + 8); page.drawRectangle({ x: bx, y: y - 52, width: bw, height: 52, borderColor: line, borderWidth: 1, color: rgb(0.98, 0.97, 1) }); page.drawText(clean(n), { x: bx + 8, y: y - 26, size: 20, font: bold, color: violet }); wrap(l, reg, 8, bw - 14).slice(0, 2).forEach((ln, j) => page.drawText(ln, { x: bx + 8, y: y - 38 - j * 9.5, size: 8, font: reg, color: grey })); });
  y -= 68;

  h2('What the numbers show');
  for (const hl of report.headlines) { ensure(30); page.drawCircle({ x: M + 4, y: y - 6, size: 2.2, color: violet }); text(hl, { indent: 14, after: 4 }); }

  // ---- charts
  const chart = (title, points, xLabel, sub) => { // points: [{label, a, b, n}] where a = wellbeing, b = identity (null when hidden)
    ensure(230); y -= 6; page.drawText(clean(title), { x: M, y: y - 12, size: 11.5, font: bold, color: ink }); y -= 18;
    if (sub) { text(sub, { size: 8.5, color: grey, after: 2 }); }
    const L = M + 24, R = M + W - 8, T = y - 6, H = 150, B = T - H, n = points.length;
    const X = (i) => L + (n <= 1 ? (R - L) / 2 : (i / (n - 1)) * (R - L)), Y = (v) => B + ((v - 1) / 4) * H;
    for (let v = 1; v <= 5; v++) { page.drawLine({ start: { x: L, y: Y(v) }, end: { x: R, y: Y(v) }, thickness: 0.5, color: line }); page.drawText(String(v), { x: L - 12, y: Y(v) - 3, size: 8, font: reg, color: grey }); }
    const draw = (key, color, w) => { const pts = points.map((p, i) => [i, p[key]]).filter((p) => p[1] != null); for (let i = 1; i < pts.length; i++) page.drawLine({ start: { x: X(pts[i - 1][0]), y: Y(pts[i - 1][1]) }, end: { x: X(pts[i][0]), y: Y(pts[i][1]) }, thickness: w, color }); for (const p of pts) page.drawCircle({ x: X(p[0]), y: Y(p[1]), size: w + 0.8, color }); };
    draw('a', ink, 2); draw('b', rose, 2);
    points.forEach((p, i) => { if (n <= 14 || i % 2 === 0) { page.drawText(clean(p.label), { x: X(i) - 6, y: B - 11, size: 7, font: reg, color: grey }); if (p.n != null) page.drawText(clean(String(p.n)), { x: X(i) - 3, y: B - 20, size: 6.5, font: ital, color: grey }); } });
    page.drawText(clean(xLabel), { x: L, y: B - 32, size: 7.5, font: ital, color: grey });
    page.drawLine({ start: { x: R - 150, y: T - 2 }, end: { x: R - 130, y: T - 2 }, thickness: 2, color: ink }); page.drawText('Overall wellbeing', { x: R - 126, y: T - 5, size: 8, font: reg, color: ink });
    page.drawLine({ start: { x: R - 150, y: T - 14 }, end: { x: R - 130, y: T - 14 }, thickness: 2, color: rose }); page.drawText('Identity and autonomy', { x: R - 126, y: T - 17, size: 8, font: reg, color: ink });
    y = B - 44;
  };
  const shownTenure = report.tenure.filter((w) => w.means);
  if (shownTenure.length >= 2) chart('Wellbeing and identity by weeks of using Phoenix', shownTenure.map((w) => ({ label: 'w' + (w.k + 1), a: w.means[0], b: w.means[5], n: w.n })), 'Weeks since each person\'s own first check-in (scores 1 to 5; the small number under each week is how many people it is based on)');
  else { h2('Wellbeing and identity by weeks of using Phoenix'); text(`Not shown yet: at least ${report.minN} people need to have shared over several weeks.`, { color: grey, after: 6 }); }
  const shownWeekly = report.weekly.filter((w) => w.means);
  if (shownWeekly.length >= 2) chart('Group average by calendar week', shownWeekly.map((w) => ({ label: String(w.week).slice(5), a: w.means[0], b: w.means[5], n: w.n })), 'Week starting (month-day). The small number is how many people shared that week.');

  // ---- tables
  const table = (head, rows, widths) => {
    ensure(20 + rows.length * 16); const xs = widths.reduce((acc, w, i) => (acc.push((acc[i - 1] ?? M) + (i ? widths[i - 1] : 0)), acc), []);
    xs.length = 0; let cx = M; for (const w of widths) { xs.push(cx); cx += w; }
    page.drawRectangle({ x: M, y: y - 16, width: W, height: 16, color: rgb(0.95, 0.93, 0.99) });
    head.forEach((h, i) => page.drawText(clean(h), { x: xs[i] + 4, y: y - 12, size: 8.5, font: bold, color: ink })); y -= 16;
    for (const r of rows) { ensure(16); r.forEach((c, i) => page.drawText(clean(c), { x: xs[i] + 4, y: y - 11, size: 9, font: i === 0 ? bold : reg, color: ink })); page.drawLine({ start: { x: M, y: y - 15 }, end: { x: M + W, y: y - 15 }, thickness: 0.4, color: line }); y -= 16; }
    y -= 6;
  };
  const f1 = (v) => (v == null ? '-' : (Math.round(v * 10) / 10).toFixed(1)), sg = (v) => (v == null ? '-' : (v > 0 ? '+' : '') + (Math.round(v * 10) / 10).toFixed(1));
  h2('Change from first to latest check-in');
  if (report.change) { const c = report.change; text(`${c.n} people who shared over at least a week, on average ${c.meanDays} days apart.`, { size: 9, color: grey, after: 2 }); table(['Area', 'First', 'Latest', 'Change', 'Higher', 'Same', 'Lower'], report.names.map((nm, i) => [nm, f1(c.firstMean[i]), f1(c.latestMean[i]), sg(c.delta[i]), String(c.improved[i]), String(c.n - c.improved[i] - c.declined[i]), String(c.declined[i])]), [170, 52, 52, 55, 55, 55, 55]); }
  else text(`Shown once at least ${report.minN} people have shared over a week or more.`, { color: grey, after: 4 });
  h2('Change by how often people checked in');
  table(['Group', 'People', 'Wellbeing change', 'Identity change'], report.usage.map((b) => [b.label, String(b.n), b.delta ? `${f1(b.first[0])} to ${f1(b.latest[0])} (${sg(b.delta[0])})` : 'hidden (too few people)', b.delta ? `${f1(b.first[5])} to ${f1(b.latest[5])} (${sg(b.delta[5])})` : 'hidden (too few people)']), [140, 60, 155, 155]);
  if (shownTenure.length) { h2('Numbers behind the first chart'); table(['Week of using Phoenix', 'People', 'Overall wellbeing', 'Identity and autonomy'], shownTenure.map((w) => ['Week ' + (w.k + 1), String(w.n), f1(w.means[0]), f1(w.means[5])]), [150, 70, 140, 150]); }

  h2('How to read this report');
  for (const n of report.notes) { ensure(26); page.drawCircle({ x: M + 4, y: y - 6, size: 1.8, color: grey }); text(n, { indent: 14, size: 9.5, color: grey, after: 3 }); }

  const pages = pdf.getPages();
  pages.forEach((p, i) => { p.drawLine({ start: { x: M, y: 34 }, end: { x: A4[0] - M, y: 34 }, thickness: 0.5, color: line }); p.drawText('Confidential: for NeuroHub Community Ltd use. Group-level and anonymous. Made from check-ins people chose to share.', { x: M, y: 22, size: 7.5, font: reg, color: grey }); p.drawText(`Page ${i + 1} of ${pages.length}`, { x: A4[0] - M - 48, y: 22, size: 7.5, font: reg, color: grey }); });
  return { bytes: await pdf.save(), pages: pages.length };
}
