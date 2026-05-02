import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
import type { Question } from "./gemini";

// ── A4 page ───────────────────────────────────────────────────────────────────
const PW = 595.28;
const PH = 841.89;

// ── Layout ────────────────────────────────────────────────────────────────────
const M = 38;                              // side margin
const HDR = 46;                            // header bar height
const COL_GAP = 16;                        // gap between the two question columns
const COL_W = (PW - M * 2 - COL_GAP) / 2; // ~251.64 per column
const COL_L = M;                           // left column x
const COL_R = M + COL_W + COL_GAP;        // right column x
const TOP_Y = PH - HDR - 10;              // usable Y right below header
const BOT_Y = M + 6;                      // bottom margin Y
const MAX_H = TOP_Y - BOT_Y;             // full column height

// ── Colours ───────────────────────────────────────────────────────────────────
const BLUE  = rgb(0.09, 0.23, 0.53);
const BLUEM = rgb(0.70, 0.78, 0.96);      // muted blue (header text)
const BLACK = rgb(0.06, 0.06, 0.08);
const DARK  = rgb(0.26, 0.26, 0.28);
const MID   = rgb(0.46, 0.46, 0.48);
const LGRAY = rgb(0.83, 0.83, 0.86);
const VLGRAY= rgb(0.95, 0.95, 0.96);
const WHITE = rgb(1, 1, 1);
const GREEN = rgb(0.08, 0.46, 0.18);

// ── Font sizes ────────────────────────────────────────────────────────────────
const SZ_TTL  = 21;
const SZ_DISC = 11;
const SZ_INFO =  8;
const SZ_QNUM =  9;
const SZ_CTX  =  8.5;
const SZ_STMT =  9.5;
const SZ_ALT  =  9;
const SZ_SMRY =  8;
const SZ_EXP  =  9;

// ── Text wrap ─────────────────────────────────────────────────────────────────
function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  if (!text?.trim()) return [""];
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = trial;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

// ── Per-page header ───────────────────────────────────────────────────────────
function drawHdr(page: PDFPage, f: PDFFont, fb: PDFFont, disc: string, pn: number): void {
  // Blue bar
  page.drawRectangle({ x: 0, y: PH - HDR, width: PW, height: HDR, color: BLUE });

  // "ENEM" logotype
  page.drawText("ENEM", { x: M, y: PH - 29, size: 16, font: fb, color: WHITE });

  // Thin vertical rule
  page.drawLine({
    start: { x: M + 54, y: PH - 12 },
    end:   { x: M + 54, y: PH - 36 },
    thickness: 0.5, color: BLUEM,
  });

  // Discipline
  page.drawText("SIMULADO", { x: M + 62, y: PH - 18, size: 6.5, font: f, color: BLUEM });
  page.drawText(disc.toUpperCase(), { x: M + 62, y: PH - 29, size: 9.5, font: fb, color: WHITE });

  // Page number (right)
  const pg = String(pn);
  const pgW = fb.widthOfTextAtSize(pg, 14);
  page.drawText(pg, { x: PW - M - pgW, y: PH - 31, size: 14, font: fb, color: BLUEM });

  // Bottom accent line
  page.drawRectangle({ x: 0, y: PH - HDR, width: PW, height: 2, color: rgb(0.07, 0.18, 0.42) });
}

// ── Column state ──────────────────────────────────────────────────────────────
interface St {
  doc:  PDFDocument;
  f:    PDFFont;
  fb:   PDFFont;
  disc: string;
  page: PDFPage;
  pn:   number;
  ly:   number;   // left col current y
  ry:   number;   // right col current y
  col:  0 | 1;
}

const cx = (s: St) => s.col === 0 ? COL_L : COL_R;
const cy = (s: St) => s.col === 0 ? s.ly : s.ry;
const sy = (s: St, y: number) => { if (s.col === 0) s.ly = y; else s.ry = y; };

async function nextCol(s: St): Promise<void> {
  if (s.col === 0) {
    s.col = 1;
  } else {
    s.pn++;
    const p = s.doc.addPage([PW, PH]);
    drawHdr(p, s.f, s.fb, s.disc, s.pn);
    s.page = p;
    s.ly = s.ry = TOP_Y;
    s.col = 0;
  }
}

// ── Question height estimate (to decide column/page breaks) ──────────────────
function estH(q: Question, f: PDFFont, fb: PDFFont): number {
  let h = 8 + 19 + 6; // gap + badge + gap below badge

  if (q.context?.trim()) {
    const n = wrap(q.context, f, SZ_CTX, COL_W - 22).length;
    h += n * SZ_CTX * 1.45 + 16;
  }

  h += 4 + wrap(q.statement, fb, SZ_STMT, COL_W - 6).length * SZ_STMT * 1.45 + 6;

  for (const alt of q.alternatives) {
    h += wrap(alt.text, f, SZ_ALT, COL_W - 24).length * SZ_ALT * 1.45 + 3;
  }

  h += 14; // bottom separator + gap
  return h;
}

// ── Draw one question into the current column ─────────────────────────────────
function drawQ(s: St, q: Question): void {
  const x = cx(s);
  let y = cy(s) - 8;

  // ── Number badge ──────────────────────────────────────────────────────
  const bW = 30, bH = 17;
  s.page.drawRectangle({ x, y: y - bH, width: bW, height: bH, color: BLUE });
  const ns = String(q.number);
  const nW = s.fb.widthOfTextAtSize(ns, SZ_QNUM);
  s.page.drawText(ns, {
    x: x + (bW - nW) / 2, y: y - bH + 4,
    size: SZ_QNUM, font: s.fb, color: WHITE,
  });
  y -= bH + 6;

  // ── Context / texto de apoio ──────────────────────────────────────────
  if (q.context?.trim()) {
    const lines = wrap(q.context, s.f, SZ_CTX, COL_W - 20);
    const boxH  = lines.length * SZ_CTX * 1.45 + 14;

    // light background
    s.page.drawRectangle({ x, y: y - boxH, width: COL_W, height: boxH, color: VLGRAY });
    // left blue accent
    s.page.drawRectangle({ x, y: y - boxH, width: 3,     height: boxH, color: BLUE });

    let ty = y - 8;
    for (const line of lines) {
      s.page.drawText(line, { x: x + 9, y: ty, size: SZ_CTX, font: s.f, color: DARK });
      ty -= SZ_CTX * 1.45;
    }
    y -= boxH + 8;
  }

  // ── Statement ─────────────────────────────────────────────────────────
  y -= 2;
  const sLines = wrap(q.statement, s.fb, SZ_STMT, COL_W - 4);
  for (const line of sLines) {
    s.page.drawText(line, { x: x + 2, y, size: SZ_STMT, font: s.fb, color: BLACK });
    y -= SZ_STMT * 1.45;
  }
  y -= 6;

  // ── Alternatives with circle bubbles ─────────────────────────────────
  for (const alt of q.alternatives) {
    const aLines = wrap(alt.text, s.f, SZ_ALT, COL_W - 24);

    // Unfilled circle with blue border
    const cr  = 5;
    const bx  = x + 6;
    const by  = y - 3.5;
    s.page.drawCircle({ x: bx, y: by, size: cr, color: WHITE, borderColor: BLUE, borderWidth: 0.65 });

    // Letter inside circle
    const lW = s.fb.widthOfTextAtSize(alt.letter, 6);
    s.page.drawText(alt.letter, {
      x: bx - lW / 2, y: by - 3,
      size: 6, font: s.fb, color: BLUE,
    });

    // Text lines (first line aligns with circle, rest indent)
    for (let i = 0; i < aLines.length; i++) {
      s.page.drawText(aLines[i], {
        x: x + 17, y: y - i * (SZ_ALT * 1.45),
        size: SZ_ALT, font: s.f, color: BLACK,
      });
    }
    y -= aLines.length * SZ_ALT * 1.45 + 3;
  }

  // ── Thin separator ────────────────────────────────────────────────────
  y -= 6;
  s.page.drawLine({
    start: { x, y }, end: { x: x + COL_W, y },
    thickness: 0.35, color: LGRAY,
  });
  y -= 6;

  sy(s, y);
}

// ── Answer-sheet grid (folha de respostas) ────────────────────────────────────
function drawAnswerSheet(
  page: PDFPage,
  f: PDFFont, fb: PDFFont,
  questions: Question[],
  startY: number,
  serie?: string, turma?: string,
): void {
  let y = startY;
  const LETTERS = ["A", "B", "C", "D", "E"];

  page.drawText("FOLHA DE RESPOSTAS", {
    x: M, y, size: 16, font: fb, color: BLUE,
  });
  y -= 18;
  page.drawText("Preencha apenas uma bolinha por questão.", {
    x: M, y, size: 8, font: f, color: MID,
  });
  y -= 20;

  // Row 1: Nome + Data
  const w1 = (PW - M * 2) * 0.63, w2 = (PW - M * 2) * 0.33;
  page.drawRectangle({ x: M,          y: y - 20, width: w1, height: 20, color: VLGRAY });
  page.drawText("Nome:", { x: M + 8,  y: y - 13, size: 8.5, font: fb, color: DARK });
  page.drawRectangle({ x: M + w1 + 4, y: y - 20, width: w2, height: 20, color: VLGRAY });
  page.drawText("Data:", { x: M + w1 + 12, y: y - 13, size: 8.5, font: fb, color: DARK });
  y -= 26;

  // Row 2: Série + Turma
  const ws = (PW - M * 2) * 0.45, wt = (PW - M * 2) * 0.51;
  page.drawRectangle({ x: M,          y: y - 20, width: ws, height: 20, color: VLGRAY });
  page.drawText("Série:", { x: M + 8, y: y - 13, size: 8.5, font: fb, color: DARK });
  if (serie) page.drawText(serie, { x: M + 40,   y: y - 13, size: 8.5, font: f, color: BLACK });
  page.drawRectangle({ x: M + ws + 4, y: y - 20, width: wt, height: 20, color: VLGRAY });
  page.drawText("Turma:", { x: M + ws + 12, y: y - 13, size: 8.5, font: fb, color: DARK });
  if (turma) page.drawText(turma, { x: M + ws + 52, y: y - 13, size: 8.5, font: f, color: BLACK });
  y -= 32;

  // Question bubbles grid — 3 columns of up to 15 questions each
  const PER_COL = 15;
  const ROW_H  = 22;
  const NUM_G_COLS = Math.min(3, Math.ceil(questions.length / PER_COL));
  const G_COL_W = (PW - M * 2) / NUM_G_COLS;

  for (let i = 0; i < questions.length; i++) {
    const gc  = Math.floor(i / PER_COL);
    const gr  = i % PER_COL;
    const gx  = M + gc * G_COL_W;
    const gy  = y - gr * ROW_H;

    // Row background (alternating)
    if (gr % 2 === 0) {
      page.drawRectangle({ x: gx, y: gy - ROW_H + 2, width: G_COL_W - 4, height: ROW_H - 2, color: VLGRAY });
    }

    // Question number
    page.drawText(String(questions[i].number), {
      x: gx + 5, y: gy - 13, size: 8.5, font: fb, color: BLUE,
    });

    // 5 bubbles
    LETTERS.forEach((l, li) => {
      const bx = gx + 26 + li * 19;
      const by = gy - 11;
      page.drawCircle({ x: bx, y: by, size: 6, color: WHITE, borderColor: LGRAY, borderWidth: 0.7 });
      const lW = f.widthOfTextAtSize(l, 6.5);
      page.drawText(l, { x: bx - lW / 2, y: by - 3.5, size: 6.5, font: f, color: MID });
    });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC: generate exam PDF (2-column, ENEM layout)
// ═════════════════════════════════════════════════════════════════════════════
export async function generateExamPDF(
  questions:         Question[],
  discipline:        string,
  topics:            string,
  serie?:            string,
  turma?:            string,
  sourceImageBuffer?: Buffer,
  sourceImageMime?:   string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const f   = await doc.embedFont(StandardFonts.Helvetica);
  const fb  = await doc.embedFont(StandardFonts.HelveticaBold);

  const page1 = doc.addPage([PW, PH]);
  drawHdr(page1, f, fb, discipline, 1);

  const s: St = { doc, f, fb, disc: discipline, page: page1, pn: 1, ly: TOP_Y, ry: TOP_Y, col: 0 };

  // ── Title section (full width, above the two columns) ────────────────
  let y = TOP_Y - 12;

  page1.drawText("SIMULADO ENEM", { x: M, y, size: SZ_TTL, font: fb, color: BLUE });

  if (serie || turma) {
    const tag = [serie && `Série: ${serie}`, turma && `Turma: ${turma}`].filter(Boolean).join("   ");
    const tw  = f.widthOfTextAtSize(tag, 8);
    page1.drawText(tag, { x: PW - M - tw, y: y + 1, size: 8, font: f, color: MID });
  }
  y -= 20;

  page1.drawText(discipline.toUpperCase(), { x: M, y, size: SZ_DISC, font: fb, color: DARK });
  y -= 15;

  const topicLines = wrap(`Conteúdos: ${topics}`, f, SZ_INFO, PW - M * 2 - 8);
  for (const tl of topicLines) {
    page1.drawText(tl, { x: M, y, size: SZ_INFO, font: f, color: MID });
    y -= SZ_INFO * 1.4;
  }
  y -= 6;

  // Info strip
  page1.drawRectangle({ x: M, y: y - 20, width: PW - M * 2, height: 20, color: VLGRAY });
  page1.drawText(
    `${questions.length} questões  ·  Tempo sugerido: ${questions.length * 3} minutos  ·  Leia atentamente cada questão`,
    { x: M + 10, y: y - 13, size: 7.5, font: f, color: DARK },
  );
  y -= 28;

  // Optional source image (from Telegram photo)
  if (sourceImageBuffer) {
    try {
      const img = sourceImageMime?.includes("png")
        ? await doc.embedPng(sourceImageBuffer)
        : await doc.embedJpg(sourceImageBuffer);

      const maxW = PW - M * 2, maxH = 200;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const iw = img.width * scale, ih = img.height * scale;

      page1.drawText("Material de apoio:", { x: M, y, size: 7.5, font: fb, color: MID });
      y -= 8;
      page1.drawImage(img, { x: M + (maxW - iw) / 2, y: y - ih, width: iw, height: ih });
      y -= ih + 12;
    } catch { /* skip on encoding error */ }
  }

  // Separator before questions
  page1.drawLine({
    start: { x: M, y }, end: { x: PW - M, y },
    thickness: 0.4, color: LGRAY,
  });
  y -= 12;

  // Two-column start
  s.ly = y; s.ry = y; s.col = 0;

  // ── Draw questions in two columns ─────────────────────────────────────
  for (const q of questions) {
    const h = estH(q, f, fb);
    if (h < MAX_H && cy(s) - h < BOT_Y) await nextCol(s);
    drawQ(s, q);
  }

  // ── Answer sheet on a new page ────────────────────────────────────────
  s.pn++;
  const ansPage = doc.addPage([PW, PH]);
  drawHdr(ansPage, f, fb, discipline, s.pn);
  drawAnswerSheet(ansPage, f, fb, questions, TOP_Y - 10, serie, turma);

  return doc.save();
}

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC: generate answer-key PDF (single column, explanations)
// ═════════════════════════════════════════════════════════════════════════════
export async function generateAnswerPDF(
  questions: Question[],
  discipline: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const f   = await doc.embedFont(StandardFonts.Helvetica);
  const fb  = await doc.embedFont(StandardFonts.HelveticaBold);

  let pn   = 1;
  let page = doc.addPage([PW, PH]);
  drawHdr(page, f, fb, discipline, pn);
  let y = TOP_Y;

  const ensureY = (needed: number) => {
    if (y - needed < BOT_Y) {
      pn++;
      page = doc.addPage([PW, PH]);
      drawHdr(page, f, fb, discipline, pn);
      y = TOP_Y;
    }
  };

  // Title
  y -= 12;
  page.drawText("GABARITO E EXPLICAÇÕES", { x: M, y, size: 18, font: fb, color: BLUE });
  y -= 18;
  page.drawText(discipline.toUpperCase(), { x: M, y, size: 10, font: fb, color: DARK });
  y -= 18;
  page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.4, color: LGRAY });
  y -= 18;

  // Summary grid (10 per row)
  page.drawText("RESUMO DO GABARITO", { x: M, y, size: 8.5, font: fb, color: DARK });
  y -= 14;

  const GCOLS = 10;
  const CW    = Math.floor((PW - M * 2) / GCOLS);
  const CH    = 24;

  for (let i = 0; i < questions.length; i++) {
    const gc = i % GCOLS;
    const gr = Math.floor(i / GCOLS);
    const gx = M + gc * CW;
    const gy = y - gr * (CH + 2);
    page.drawRectangle({ x: gx, y: gy - CH, width: CW - 2, height: CH, color: VLGRAY });
    page.drawText(String(questions[i].number),        { x: gx + 4, y: gy - 9,  size: SZ_SMRY, font: f,  color: MID  });
    page.drawText(questions[i].correctAnswer,          { x: gx + 4, y: gy - 19, size: 11,      font: fb, color: BLUE });
  }

  const summaryRows = Math.ceil(questions.length / GCOLS);
  y -= summaryRows * (CH + 2) + 18;
  page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.4, color: LGRAY });
  y -= 18;

  // Per-question explanations
  for (const q of questions) {
    const expLines  = wrap(q.explanation, f, SZ_EXP, PW - M * 2 - 16);
    const stmtLines = wrap(q.statement,   f, 8.5,    PW - M * 2 - 16);
    ensureY(Math.min(28 + stmtLines.slice(0, 3).length * 12 + 14 + 20, MAX_H * 0.5));

    y -= 4;
    // Question header bar
    page.drawRectangle({ x: M, y: y - 20, width: PW - M * 2, height: 20, color: VLGRAY });
    page.drawText(`QUESTÃO ${q.number}`, {
      x: M + 10, y: y - 13, size: 9, font: fb, color: BLUE,
    });
    const gLabel = `Gabarito: ${q.correctAnswer}`;
    const gW = fb.widthOfTextAtSize(gLabel, 9);
    page.drawText(gLabel, {
      x: PW - M - gW - 10, y: y - 13, size: 9, font: fb, color: GREEN,
    });
    y -= 26;

    // Statement (up to 3 lines)
    for (const line of stmtLines.slice(0, 3)) {
      page.drawText(line, { x: M + 6, y, size: 8.5, font: f, color: DARK });
      y -= 12;
    }
    if (stmtLines.length > 3) {
      page.drawText("...", { x: M + 6, y, size: 8.5, font: f, color: MID });
      y -= 12;
    }
    y -= 4;

    // Explanation
    page.drawText("Explicação:", { x: M + 6, y, size: 8.5, font: fb, color: DARK });
    y -= 13;
    for (const line of expLines) {
      ensureY(14);
      page.drawText(line, { x: M + 10, y, size: SZ_EXP, font: f, color: BLACK });
      y -= 13;
    }

    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.35, color: LGRAY });
    y -= 10;
  }

  return doc.save();
}
