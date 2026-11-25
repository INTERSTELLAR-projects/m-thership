// Cheat-sheet PDF: built as text with jsPDF (sharp, small, searchable), uploaded to storage and kept on the CallPrep.
import { jsPDF } from "jspdf";
import { base44 } from "@/api/base44Client";
import { fmtWhen, whoOf } from "./api";

const s = (v) => (v == null ? "" : String(v)).trim();
const arr = (v) => (Array.isArray(v) ? v : []);

export function buildPdf(cp) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = 0;
  const bar = (top) => {
    const steps = 40; const w = W / steps;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const g = top ? Math.round(60 + t * 110) : Math.round(170 - t * 110);
      doc.setFillColor(255, g, 0); doc.rect(i * w, top ? 0 : H - 5, w + 1, 5, "F");
    }
  };
  const header = () => {
    bar(true);
    doc.setFillColor(11, 10, 9); doc.rect(0, 5, W, 64, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("INTERSTELLAR", M, 34);
    doc.setTextColor(255, 106, 0); doc.text("™", M + doc.getTextWidth("INTERSTELLAR") + 1, 30);
    doc.setTextColor(154, 148, 142); doc.setFont("courier", "normal"); doc.setFontSize(8.5);
    doc.text(`+ CALL PREP · ${whoOf(cp).toUpperCase()}`, M, 54);
    bar(false);
    y = 100;
  };
  const ensure = (h) => { if (y + h > H - 50) { doc.addPage(); header(); } };
  const wrap = (txt, size, width) => { doc.setFontSize(size); return doc.splitTextToSize(txt, width); };
  const heading = (t) => {
    ensure(34);
    y += 8;
    doc.setFont("courier", "bold"); doc.setFontSize(9); doc.setTextColor(255, 60, 0);
    doc.text(t.toUpperCase(), M, y); y += 6;
    doc.setDrawColor(255, 106, 0); doc.setLineWidth(1); doc.line(M, y, M + 28, y); y += 14;
  };
  const bullets = (items, { box = false, color = [20, 17, 15] } = {}) => {
    items.forEach((it) => {
      const lines = wrap(s(it), 10.5, W - M * 2 - 18);
      ensure(lines.length * 14 + 4);
      doc.setFont("helvetica", "normal"); doc.setTextColor(...color);
      if (box) { doc.setDrawColor(150, 140, 130); doc.setLineWidth(0.7); doc.rect(M, y - 8, 8, 8); }
      else { doc.setFillColor(255, 106, 0); doc.circle(M + 3, y - 3.5, 2, "F"); }
      doc.text(lines, M + 16, y); y += lines.length * 14 + 3;
    });
  };

  header();
  doc.setTextColor(20, 17, 15); doc.setFont("helvetica", "bold");
  const tl = wrap(s(cp.title) || "Call prep", 22, W - M * 2);
  doc.text(tl, M, y); y += tl.length * 26;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(94, 88, 83);
  doc.text([whoOf(cp), s(cp.contact_name), cp.scheduled_for ? fmtWhen(cp.scheduled_for) : ""].filter(Boolean).join("  ·  "), M, y); y += 18;
  if (s(cp.goal)) {
    const gl = wrap(s(cp.goal), 11.5, W - M * 2 - 16);
    ensure(gl.length * 15 + 16);
    doc.setFillColor(255, 243, 235); doc.rect(M, y - 4, W - M * 2, gl.length * 15 + 12, "F");
    doc.setFillColor(255, 106, 0); doc.rect(M, y - 4, 3, gl.length * 15 + 12, "F");
    doc.setTextColor(20, 17, 15); doc.setFont("helvetica", "bold"); doc.text(gl, M + 12, y + 9); y += gl.length * 15 + 20;
  }
  if (arr(cp.remember).length) { heading("Don't forget"); bullets(cp.remember); }
  if (arr(cp.background).length) { heading("Where things stand"); bullets(cp.background, { color: [60, 55, 50] }); }
  if (arr(cp.agenda).length) {
    heading("Talk about");
    cp.agenda.forEach((a) => {
      const pts = arr(a.talking_points);
      ensure(18 + pts.length * 14);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20, 17, 15);
      doc.text(s(a.topic), M, y); y += 15;
      bullets(pts, { color: [60, 55, 50] });
      if (s(a.decision_needed)) { const dl = wrap(`Decide: ${s(a.decision_needed)}`, 10, W - M * 2 - 16); ensure(dl.length * 13); doc.setTextColor(200, 70, 0); doc.text(dl, M + 16, y); y += dl.length * 13 + 4; }
      y += 4;
    });
  }
  if (arr(cp.show).length) { heading("Show"); bullets(cp.show); }
  const qa = arr(cp.qa).length ? cp.qa : arr(cp.agenda).flatMap((a) => arr(a.questions).map((q) => ({ q })));
  if (qa.length) {
    heading("Ask");
    qa.forEach((x) => {
      const ql = wrap(s(x.q), 10.5, W - M * 2 - 18);
      const al = s(x.answer) ? wrap(s(x.answer), 10, W - M * 2 - 30) : [];
      ensure(ql.length * 14 + (al.length ? al.length * 13 + 6 : 22));
      doc.setDrawColor(150, 140, 130); doc.setLineWidth(0.7); doc.rect(M, y - 8, 8, 8);
      doc.setFont("helvetica", "normal"); doc.setTextColor(20, 17, 15); doc.setFontSize(10.5); doc.text(ql, M + 16, y); y += ql.length * 14;
      if (al.length) { doc.setFont("helvetica", "italic"); doc.setTextColor(120, 60, 10); doc.setFontSize(10); doc.text(al, M + 28, y); y += al.length * 13 + 6; }
      else { doc.setDrawColor(215, 208, 200); doc.line(M + 28, y + 4, W - M, y + 4); y += 18; }
    });
  }
  if (arr(cp.asks_from_client).length) { heading(`Get from ${s(cp.contact_name) || whoOf(cp)}`); bullets(cp.asks_from_client, { box: true }); }
  if (arr(cp.follow_ups).length) { heading("Open from last call"); bullets(cp.follow_ups, { box: true }); }
  if (arr(cp.risks).length) { heading("Watch for"); bullets(cp.risks, { color: [60, 55, 50] }); }
  if (arr(cp.conflicts).length) { heading("Check first"); bullets(cp.conflicts, { color: [160, 60, 0] }); }
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFont("courier", "normal"); doc.setFontSize(8); doc.setTextColor(140, 132, 126);
    doc.text("Interstellar. The Future of Business.", M, H - 22);
    doc.text(`${i} / ${n}`, W - M, H - 22, { align: "right" });
  }
  return doc;
}

export function pdfName(cp) {
  const slug = `${whoOf(cp)} ${s(cp.title) || "call prep"}`.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  const d = new Date().toISOString().slice(0, 10);
  return `${slug}-${d}.pdf`;
}

// Builds the PDF, uploads it, returns the pdfs entry. Also triggers a download in the browser.
export async function savePdf(cp) {
  const doc = buildPdf(cp);
  const name = pdfName(cp);
  const blob = doc.output("blob");
  const file = new File([blob], name, { type: "application/pdf" });
  const up = await base44.integrations.Core.UploadFile({ file });
  const url = up?.file_url || up?.data?.file_url;
  if (!url) throw new Error("Upload failed");
  try { doc.save(name); } catch { /* download blocked; it's still saved */ }
  return { name, url, kind: "generated", created_at: new Date().toISOString() };
}

export async function uploadPdf(file) {
  const up = await base44.integrations.Core.UploadFile({ file });
  const url = up?.file_url || up?.data?.file_url;
  if (!url) throw new Error("Upload failed");
  return { name: file.name, url, kind: "uploaded", created_at: new Date().toISOString() };
}
