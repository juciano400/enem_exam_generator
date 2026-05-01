import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
import type { Question } from "./gemini";

const COLORS = {
  black: rgb(0.05, 0.05, 0.08),
  darkGray: rgb(0.25, 0.25, 0.28),
  mediumGray: rgb(0.5, 0.5, 0.52),
  lightGray: rgb(0.88, 0.88, 0.9),
  veryLightGray: rgb(0.96, 0.96, 0.97),
  blue: rgb(0.1, 0.25, 0.55),
  white: rgb(1, 1, 1),
  answerBubble: rgb(0.92, 0.92, 0.95),
};

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89; // A4
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

interface DrawContext {
  page: PDFPage;
  font: PDFFont;
  boldFont: PDFFont;
  y: number;
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function drawWrappedText(
  ctx: DrawContext,
  text: string,
  x: number,
  maxWidth: number,
  fontSize: number,
  useBold = false,
  color = COLORS.black,
  lineHeight = 1.5
): number {
  const font = useBold ? ctx.boldFont : ctx.font;
  const lines = wrapText(text, font, fontSize, maxWidth);
  for (const line of lines) {
    ctx.page.drawText(line, { x, y: ctx.y, size: fontSize, font, color });
    ctx.y -= fontSize * lineHeight;
  }
  return ctx.y;
}

async function addNewPage(doc: PDFDocument, font: PDFFont, boldFont: PDFFont): Promise<DrawContext> {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  return { page, font, boldFont, y: PAGE_HEIGHT - MARGIN };
}

function drawPageHeader(ctx: DrawContext, discipline: string, pageNum: number, totalPages: number) {
  // Top bar
  ctx.page.drawRectangle({
    x: 0, y: PAGE_HEIGHT - 36,
    width: PAGE_WIDTH, height: 36,
    color: COLORS.blue,
  });
  ctx.page.drawText("ENEM", {
    x: MARGIN, y: PAGE_HEIGHT - 24,
    size: 13, font: ctx.boldFont, color: COLORS.white,
  });
  ctx.page.drawText(`${discipline.toUpperCase()}`, {
    x: MARGIN + 55, y: PAGE_HEIGHT - 24,
    size: 11, font: ctx.font, color: rgb(0.8, 0.85, 1),
  });
  ctx.page.drawText(`Página ${pageNum}`, {
    x: PAGE_WIDTH - MARGIN - 60, y: PAGE_HEIGHT - 24,
    size: 9, font: ctx.font, color: rgb(0.7, 0.75, 0.9),
  });
  ctx.y = PAGE_HEIGHT - 56;
}

function drawSeparator(ctx: DrawContext) {
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_WIDTH - MARGIN, y: ctx.y },
    thickness: 0.5,
    color: COLORS.lightGray,
  });
  ctx.y -= 12;
}

export async function generateExamPDF(
  questions: Question[],
  discipline: string,
  topics: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  let pageNum = 1;
  let ctx = await addNewPage(doc, font, boldFont);
  drawPageHeader(ctx, discipline, pageNum, 1);

  // Title section
  ctx.y -= 8;
  ctx.page.drawText("SIMULADO ENEM", {
    x: MARGIN, y: ctx.y,
    size: 22, font: boldFont, color: COLORS.blue,
  });
  ctx.y -= 28;
  ctx.page.drawText(discipline.toUpperCase(), {
    x: MARGIN, y: ctx.y,
    size: 14, font: boldFont, color: COLORS.darkGray,
  });
  ctx.y -= 20;

  // Topics line
  const topicsText = `Conteúdos: ${topics}`;
  drawWrappedText(ctx, topicsText, MARGIN, CONTENT_WIDTH, 9, false, COLORS.mediumGray, 1.4);
  ctx.y -= 8;

  drawSeparator(ctx);

  // Info box
  ctx.page.drawRectangle({
    x: MARGIN, y: ctx.y - 28,
    width: CONTENT_WIDTH, height: 28,
    color: COLORS.veryLightGray,
  });
  ctx.page.drawText(`Total de questões: ${questions.length}   |   Tempo sugerido: ${questions.length * 3} minutos   |   Cada questão vale 1 ponto`, {
    x: MARGIN + 10, y: ctx.y - 18,
    size: 9, font: font, color: COLORS.darkGray,
  });
  ctx.y -= 44;

  // Questions
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    // Check if need new page (estimate: at least 120px per question)
    if (ctx.y < 150) {
      pageNum++;
      ctx = await addNewPage(doc, font, boldFont);
      drawPageHeader(ctx, discipline, pageNum, 1);
    }

    ctx.y -= 10;

    // Question number badge
    ctx.page.drawRectangle({
      x: MARGIN, y: ctx.y - 18,
      width: 26, height: 20,
      color: COLORS.blue,
    });
    ctx.page.drawText(`${q.number}`, {
      x: MARGIN + (q.number >= 10 ? 5 : 9), y: ctx.y - 13,
      size: 10, font: boldFont, color: COLORS.white,
    });

    // Context
    if (q.context && q.context.trim()) {
      ctx.y -= 4;
      const contextLines = wrapText(q.context, font, 9, CONTENT_WIDTH - 36);
      const boxHeight = contextLines.length * 13 + 16;

      ctx.page.drawRectangle({
        x: MARGIN + 32, y: ctx.y - boxHeight,
        width: CONTENT_WIDTH - 32, height: boxHeight,
        color: COLORS.veryLightGray,
      });

      ctx.y -= 10;
      for (const line of contextLines) {
        if (ctx.y < 100) {
          pageNum++;
          ctx = await addNewPage(doc, font, boldFont);
          drawPageHeader(ctx, discipline, pageNum, 1);
        }
        ctx.page.drawText(line, {
          x: MARGIN + 40, y: ctx.y,
          size: 9, font: font, color: COLORS.darkGray,
        });
        ctx.y -= 13;
      }
      ctx.y -= 8;
    } else {
      ctx.y -= 20;
    }

    // Statement
    const stmtLines = wrapText(q.statement, boldFont, 10, CONTENT_WIDTH - 36);
    for (const line of stmtLines) {
      if (ctx.y < 100) {
        pageNum++;
        ctx = await addNewPage(doc, font, boldFont);
        drawPageHeader(ctx, discipline, pageNum, 1);
      }
      ctx.page.drawText(line, {
        x: MARGIN + 32, y: ctx.y,
        size: 10, font: boldFont, color: COLORS.black,
      });
      ctx.y -= 15;
    }
    ctx.y -= 6;

    // Alternatives
    for (const alt of q.alternatives) {
      if (ctx.y < 80) {
        pageNum++;
        ctx = await addNewPage(doc, font, boldFont);
        drawPageHeader(ctx, discipline, pageNum, 1);
      }

      // Letter circle
      ctx.page.drawCircle({
        x: MARGIN + 42, y: ctx.y - 4,
        size: 8,
        color: COLORS.answerBubble,
      });
      ctx.page.drawText(alt.letter, {
        x: MARGIN + 38, y: ctx.y - 8,
        size: 9, font: boldFont, color: COLORS.darkGray,
      });

      const altLines = wrapText(alt.text, font, 10, CONTENT_WIDTH - 60);
      for (let li = 0; li < altLines.length; li++) {
        ctx.page.drawText(altLines[li], {
          x: MARGIN + 56, y: ctx.y - (li * 14),
          size: 10, font: font, color: COLORS.black,
        });
      }
      ctx.y -= altLines.length * 14 + 4;
    }

    ctx.y -= 8;
    drawSeparator(ctx);
  }

  // Answer sheet
  pageNum++;
  ctx = await addNewPage(doc, font, boldFont);
  drawPageHeader(ctx, discipline, pageNum, 1);

  ctx.y -= 10;
  ctx.page.drawText("FOLHA DE RESPOSTAS", {
    x: MARGIN, y: ctx.y,
    size: 16, font: boldFont, color: COLORS.blue,
  });
  ctx.y -= 24;
  ctx.page.drawText("Marque com um X a alternativa correta para cada questão.", {
    x: MARGIN, y: ctx.y,
    size: 10, font: font, color: COLORS.mediumGray,
  });
  ctx.y -= 30;

  // Name/date fields
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 22, width: CONTENT_WIDTH * 0.65, height: 22, color: COLORS.veryLightGray });
  ctx.page.drawText("Nome:", { x: MARGIN + 8, y: ctx.y - 14, size: 9, font: boldFont, color: COLORS.darkGray });
  ctx.page.drawRectangle({ x: MARGIN + CONTENT_WIDTH * 0.67, y: ctx.y - 22, width: CONTENT_WIDTH * 0.33, height: 22, color: COLORS.veryLightGray });
  ctx.page.drawText("Data:", { x: MARGIN + CONTENT_WIDTH * 0.67 + 8, y: ctx.y - 14, size: 9, font: boldFont, color: COLORS.darkGray });
  ctx.y -= 40;

  // Answer grid
  const cols = 5;
  const cellW = 80;
  const cellH = 28;
  const gridX = MARGIN + (CONTENT_WIDTH - cols * cellW) / 2;

  for (let i = 0; i < questions.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gridX + col * cellW;
    const y = ctx.y - row * (cellH + 6);

    if (y < MARGIN + 60) break;

    ctx.page.drawRectangle({ x, y: y - cellH, width: cellW - 4, height: cellH, color: COLORS.veryLightGray });
    ctx.page.drawText(`${i + 1}`, { x: x + 6, y: y - 17, size: 10, font: boldFont, color: COLORS.blue });

    const letters = ["A", "B", "C", "D", "E"];
    letters.forEach((l, li) => {
      ctx.page.drawCircle({ x: x + 26 + li * 10, y: y - 14, size: 5, color: COLORS.answerBubble });
      ctx.page.drawText(l, { x: x + 23 + li * 10, y: y - 17, size: 7, font: font, color: COLORS.darkGray });
    });
  }

  return doc.save();
}

export async function generateAnswerPDF(
  questions: Question[],
  discipline: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  let pageNum = 1;
  let ctx = await addNewPage(doc, font, boldFont);
  drawPageHeader(ctx, discipline, pageNum, 1);

  ctx.y -= 8;
  ctx.page.drawText("GABARITO E EXPLICAÇÕES", {
    x: MARGIN, y: ctx.y,
    size: 20, font: boldFont, color: COLORS.blue,
  });
  ctx.y -= 26;
  ctx.page.drawText(discipline.toUpperCase(), {
    x: MARGIN, y: ctx.y,
    size: 12, font: boldFont, color: COLORS.darkGray,
  });
  ctx.y -= 24;
  drawSeparator(ctx);

  // Summary grid
  ctx.page.drawText("RESUMO DO GABARITO", {
    x: MARGIN, y: ctx.y,
    size: 11, font: boldFont, color: COLORS.darkGray,
  });
  ctx.y -= 20;

  const gridCols = 10;
  const cellW = Math.floor(CONTENT_WIDTH / gridCols);
  const cellH = 24;

  for (let i = 0; i < questions.length; i++) {
    const col = i % gridCols;
    const row = Math.floor(i / gridCols);
    const x = MARGIN + col * cellW;
    const y = ctx.y - row * (cellH + 4);

    ctx.page.drawRectangle({ x, y: y - cellH, width: cellW - 2, height: cellH, color: COLORS.veryLightGray });
    ctx.page.drawText(`${i + 1}`, { x: x + 4, y: y - 10, size: 8, font: font, color: COLORS.mediumGray });
    ctx.page.drawText(questions[i].correctAnswer, { x: x + 4, y: y - 20, size: 11, font: boldFont, color: COLORS.blue });
  }

  const summaryRows = Math.ceil(questions.length / gridCols);
  ctx.y -= summaryRows * (cellH + 4) + 24;
  drawSeparator(ctx);

  // Detailed explanations
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    if (ctx.y < 160) {
      pageNum++;
      ctx = await addNewPage(doc, font, boldFont);
      drawPageHeader(ctx, discipline, pageNum, 1);
    }

    ctx.y -= 8;

    // Question header
    ctx.page.drawRectangle({
      x: MARGIN, y: ctx.y - 22,
      width: CONTENT_WIDTH, height: 22,
      color: COLORS.veryLightGray,
    });
    ctx.page.drawText(`QUESTÃO ${q.number}`, {
      x: MARGIN + 10, y: ctx.y - 15,
      size: 10, font: boldFont, color: COLORS.blue,
    });
    ctx.page.drawText(`Resposta correta: ${q.correctAnswer}`, {
      x: PAGE_WIDTH - MARGIN - 120, y: ctx.y - 15,
      size: 10, font: boldFont, color: rgb(0.1, 0.5, 0.2),
    });
    ctx.y -= 30;

    // Statement (brief)
    const stmtLines = wrapText(q.statement, font, 9, CONTENT_WIDTH - 10);
    for (const line of stmtLines.slice(0, 3)) {
      ctx.page.drawText(line, {
        x: MARGIN + 6, y: ctx.y,
        size: 9, font: font, color: COLORS.darkGray,
      });
      ctx.y -= 13;
    }
    if (stmtLines.length > 3) {
      ctx.page.drawText("...", { x: MARGIN + 6, y: ctx.y, size: 9, font: font, color: COLORS.mediumGray });
      ctx.y -= 13;
    }
    ctx.y -= 6;

    // Explanation
    ctx.page.drawText("Explicação:", {
      x: MARGIN + 6, y: ctx.y,
      size: 9, font: boldFont, color: COLORS.black,
    });
    ctx.y -= 14;

    const expLines = wrapText(q.explanation, font, 9, CONTENT_WIDTH - 16);
    for (const line of expLines) {
      if (ctx.y < 80) {
        pageNum++;
        ctx = await addNewPage(doc, font, boldFont);
        drawPageHeader(ctx, discipline, pageNum, 1);
      }
      ctx.page.drawText(line, {
        x: MARGIN + 10, y: ctx.y,
        size: 9, font: font, color: COLORS.darkGray,
      });
      ctx.y -= 13;
    }

    ctx.y -= 8;
    drawSeparator(ctx);
  }

  return doc.save();
}
