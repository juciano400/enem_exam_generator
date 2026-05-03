import TelegramBot from "node-telegram-bot-api";
import { generateQuestions, generateQuestionsFromMedia } from "./gemini";
import { generateExamPDF, generateAnswerPDF } from "./pdfGenerator";
import { processTemplate } from "./templateProcessor";

const DISCIPLINES = ["Literatura", "Gramática", "Arte", "História", "Sociologia", "Filosofia"] as const;
type Discipline = (typeof DISCIPLINES)[number];

const HELP_TEXT = `📚 *Gerador de Provas ENEM*

*Opção 1 — Por tema:*
/prova <disciplina> <quantidade> <conteúdos>
Exemplo: \`/prova História 10 Revolução Industrial\`
Com série/turma: \`/prova História 10 Revolução Industrial | 3ª série | Turma A\`

*Opção 2 — Por material (foto ou PDF):*
Envie uma foto ou PDF com a legenda:
\`<disciplina> <quantidade>\`
Com série/turma: \`História 10 | 3ª série | Turma A\`

*Opção 3 — Com template Word (.docx/.doc):*
Envie um arquivo .docx ou .doc com a legenda:
\`<disciplina> <quantidade> <conteúdos>\`
Com série/turma: \`História 10 Revolução Industrial | 3ª série | Turma A\`

*Disciplinas disponíveis:*
${DISCIPLINES.map((d) => `• ${d}`).join("\n")}

*Quantidade:* 5 a 45 questões

/ajuda — exibe esta mensagem`;

// ── Pending state maps ────────────────────────────────────────────────────────

interface PendingMedia {
  fileId: string;
  mimeType: string;
  expiresAt: number;
}

interface PendingTemplate {
  fileId: string;
  originalExt: "doc" | "docx";
  expiresAt: number;
}

const pendingMedia    = new Map<number, PendingMedia>();
const pendingTemplate = new Map<number, PendingTemplate>();
const PENDING_TTL_MS  = 5 * 60 * 1000; // 5 minutes

// ── Parsers ───────────────────────────────────────────────────────────────────

function parseDiscipline(raw: string): Discipline | null {
  const normalized = raw.trim().toLowerCase();
  return DISCIPLINES.find((d) => d.toLowerCase() === normalized) ?? null;
}

function parseDisciplineAndCount(
  text: string
): { discipline: Discipline; questionCount: number; serie?: string; turma?: string } | null {
  const [main, serieRaw, turmaRaw] = text.split("|").map((s) => s.trim());
  const parts = (main ?? "").trim().split(/\s+/);
  if (parts.length < 2) return null;
  const discipline = parseDiscipline(parts[0]);
  const questionCount = parseInt(parts[1], 10);
  if (!discipline || isNaN(questionCount) || questionCount < 5 || questionCount > 45) return null;
  return {
    discipline,
    questionCount,
    serie: serieRaw || undefined,
    turma: turmaRaw || undefined,
  };
}

function parseProvaArgs(text: string): {
  discipline: Discipline;
  questionCount: number;
  topics: string;
  serie?: string;
  turma?: string;
} | null {
  const [main, serieRaw, turmaRaw] = text.split("|").map((s) => s.trim());
  const parts = (main ?? "").trim().split(/\s+/);
  if (parts.length < 3) return null;
  const discipline = parseDiscipline(parts[0]);
  const questionCount = parseInt(parts[1], 10);
  if (!discipline || isNaN(questionCount) || questionCount < 5 || questionCount > 45) return null;
  const topics = parts.slice(2).join(" ").trim();
  if (topics.length < 5) return null;
  return {
    discipline,
    questionCount,
    topics,
    serie: serieRaw || undefined,
    turma: turmaRaw || undefined,
  };
}

// ── File download ─────────────────────────────────────────────────────────────

async function downloadFile(bot: TelegramBot, fileId: string): Promise<Buffer> {
  const fileLink = await bot.getFileLink(fileId);
  const res = await fetch(fileLink);
  if (!res.ok) throw new Error(`Falha ao baixar arquivo: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── Exam generators ───────────────────────────────────────────────────────────

async function generateAndSendExam(
  bot: TelegramBot,
  chatId: number,
  statusMsgId: number,
  discipline: Discipline,
  questionCount: number,
  source:
    | { type: "topics"; topics: string }
    | { type: "media"; fileId: string; mimeType: string },
  serie?: string,
  turma?: string
): Promise<void> {
  try {
    let questions;
    let sourceImageBuffer: Buffer | undefined;
    let sourceImageMime: string | undefined;

    if (source.type === "topics") {
      questions = await generateQuestions({ discipline, questionCount, topics: source.topics });
    } else {
      const buffer = await downloadFile(bot, source.fileId);
      questions = await generateQuestionsFromMedia({
        mediaBase64: buffer.toString("base64"),
        mimeType: source.mimeType,
        questionCount,
        discipline,
      });
      if (source.mimeType.startsWith("image/")) {
        sourceImageBuffer = buffer;
        sourceImageMime   = source.mimeType;
      }
    }

    const topicsLabel = source.type === "topics" ? source.topics : "Material enviado";

    const [examPdfBytes, answerPdfBytes] = await Promise.all([
      generateExamPDF(questions, discipline, topicsLabel, serie, turma, sourceImageBuffer, sourceImageMime),
      generateAnswerPDF(questions, discipline),
    ]);

    await bot.editMessageText("✅ Prova gerada! Enviando PDFs...", {
      chat_id: chatId,
      message_id: statusMsgId,
    });

    await bot.sendDocument(
      chatId,
      Buffer.from(examPdfBytes),
      { caption: `📄 *Prova* — ${discipline} | ${questionCount} questões`, parse_mode: "Markdown" },
      { filename: `ENEM_${discipline}_${questionCount}q_prova.pdf`, contentType: "application/pdf" }
    );

    await bot.sendDocument(
      chatId,
      Buffer.from(answerPdfBytes),
      { caption: `📋 *Gabarito e Explicações* — ${discipline}`, parse_mode: "Markdown" },
      { filename: `ENEM_${discipline}_${questionCount}q_gabarito.pdf`, contentType: "application/pdf" }
    );
  } catch (err) {
    console.error("[TelegramBot] Error generating exam:", err);
    const message = err instanceof Error ? err.message : "Erro interno.";
    await bot
      .editMessageText(`❌ Erro ao gerar a prova: ${message}`, {
        chat_id: chatId,
        message_id: statusMsgId,
      })
      .catch(() => bot.sendMessage(chatId, `❌ Erro ao gerar a prova: ${message}`));
  }
}

async function generateAndSendExamFromTemplate(
  bot: TelegramBot,
  chatId: number,
  statusMsgId: number,
  fileId: string,
  originalExt: "doc" | "docx",
  discipline: Discipline,
  questionCount: number,
  topics: string,
  serie?: string,
  turma?: string
): Promise<void> {
  try {
    const [templateBuffer, questions] = await Promise.all([
      downloadFile(bot, fileId),
      generateQuestions({ discipline, questionCount, topics }),
    ]);

    const { examPdfBytes, answerPdfBytes } = await processTemplate(
      templateBuffer,
      questions,
      discipline,
      originalExt
    );

    await bot.editMessageText("✅ Prova gerada com template! Enviando PDFs...", {
      chat_id: chatId,
      message_id: statusMsgId,
    });

    await bot.sendDocument(
      chatId,
      Buffer.from(examPdfBytes),
      { caption: `📄 *Prova (template)* — ${discipline} | ${questionCount} questões`, parse_mode: "Markdown" },
      { filename: `ENEM_${discipline}_${questionCount}q_prova.pdf`, contentType: "application/pdf" }
    );

    await bot.sendDocument(
      chatId,
      Buffer.from(answerPdfBytes),
      { caption: `📋 *Gabarito e Explicações* — ${discipline}`, parse_mode: "Markdown" },
      { filename: `ENEM_${discipline}_${questionCount}q_gabarito.pdf`, contentType: "application/pdf" }
    );
  } catch (err) {
    console.error("[TelegramBot] Error generating exam from template:", err);
    const message = err instanceof Error ? err.message : "Erro interno.";
    await bot
      .editMessageText(`❌ Erro ao processar template: ${message}`, {
        chat_id: chatId,
        message_id: statusMsgId,
      })
      .catch(() => bot.sendMessage(chatId, `❌ Erro ao processar template: ${message}`));
  }
}

// ── Command handlers ──────────────────────────────────────────────────────────

async function handleProvaCommand(
  bot: TelegramBot,
  chatId: number,
  args: string
): Promise<void> {
  const parsed = parseProvaArgs(args);

  if (!parsed) {
    const [main] = args.split("|");
    const parts = (main ?? "").trim().split(/\s+/);

    if (parts.length >= 1 && parts[0] && !parseDiscipline(parts[0])) {
      await bot.sendMessage(
        chatId,
        `❌ Disciplina inválida: *${parts[0]}*\n\nDisciplinas disponíveis:\n${DISCIPLINES.map((d) => `• ${d}`).join("\n")}`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    if (parts.length >= 2) {
      const count = parseInt(parts[1], 10);
      if (isNaN(count) || count < 5 || count > 45) {
        await bot.sendMessage(chatId, "❌ A quantidade deve ser um número entre 5 e 45.");
        return;
      }
    }

    await bot.sendMessage(
      chatId,
      "❌ Uso: `/prova <disciplina> <quantidade> <conteúdos>`\n\nExemplo:\n`/prova História 10 Revolução Industrial`\n`/prova História 10 Revolução Industrial | 3ª série | Turma A`",
      { parse_mode: "Markdown" }
    );
    return;
  }

  const statusMsg = await bot.sendMessage(
    chatId,
    `⏳ Gerando prova de *${parsed.discipline}* — ${parsed.questionCount} questões sobre _${parsed.topics}_...`,
    { parse_mode: "Markdown" }
  );

  await generateAndSendExam(
    bot, chatId, statusMsg.message_id,
    parsed.discipline, parsed.questionCount,
    { type: "topics", topics: parsed.topics },
    parsed.serie, parsed.turma
  );
}

async function handleMediaMessage(
  bot: TelegramBot,
  chatId: number,
  fileId: string,
  mimeType: string,
  caption: string | undefined
): Promise<void> {
  const parsed = caption ? parseDisciplineAndCount(caption) : null;

  if (parsed) {
    const statusMsg = await bot.sendMessage(
      chatId,
      `⏳ Analisando o material e gerando *${parsed.questionCount}* questões de *${parsed.discipline}*...`,
      { parse_mode: "Markdown" }
    );
    await generateAndSendExam(
      bot, chatId, statusMsg.message_id,
      parsed.discipline, parsed.questionCount,
      { type: "media", fileId, mimeType },
      parsed.serie, parsed.turma
    );
  } else {
    pendingMedia.set(chatId, { fileId, mimeType, expiresAt: Date.now() + PENDING_TTL_MS });
    await bot.sendMessage(
      chatId,
      `📎 Material recebido! Agora me diga a *disciplina* e a *quantidade de questões*:\n\nExemplo: \`História 10\`\nCom série/turma: \`História 10 | 3ª série | Turma A\`\n\nDisciplinas: ${DISCIPLINES.join(", ")}`,
      { parse_mode: "Markdown" }
    );
  }
}

async function handleTemplateDocument(
  bot: TelegramBot,
  chatId: number,
  fileId: string,
  originalExt: "doc" | "docx",
  caption: string | undefined
): Promise<void> {
  const parsed = caption ? parseProvaArgs(caption) : null;

  if (parsed) {
    const statusMsg = await bot.sendMessage(
      chatId,
      `⏳ Processando template e gerando *${parsed.questionCount}* questões de *${parsed.discipline}*...`,
      { parse_mode: "Markdown" }
    );
    await generateAndSendExamFromTemplate(
      bot, chatId, statusMsg.message_id,
      fileId, originalExt,
      parsed.discipline, parsed.questionCount, parsed.topics,
      parsed.serie, parsed.turma
    );
  } else {
    pendingTemplate.set(chatId, { fileId, originalExt, expiresAt: Date.now() + PENDING_TTL_MS });
    await bot.sendMessage(
      chatId,
      `📄 Template *.${originalExt}* recebido! Agora me diga a *disciplina*, *quantidade* e *conteúdos*:\n\nExemplo: \`História 10 Revolução Industrial\`\nCom série/turma: \`História 10 Revolução Industrial | 3ª série | Turma A\`\n\nDisciplinas: ${DISCIPLINES.join(", ")}`,
      { parse_mode: "Markdown" }
    );
  }
}

// ── Bot bootstrap ─────────────────────────────────────────────────────────────

export function startTelegramBot(token: string): TelegramBot {
  const bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/start/, async (msg) => {
    await bot.sendMessage(msg.chat.id, HELP_TEXT, { parse_mode: "Markdown" });
  });

  bot.onText(/\/ajuda/, async (msg) => {
    await bot.sendMessage(msg.chat.id, HELP_TEXT, { parse_mode: "Markdown" });
  });

  bot.onText(/\/prova(?:\s+(.+))?/, async (msg, match) => {
    await handleProvaCommand(bot, msg.chat.id, match?.[1] ?? "");
  });

  // Photo messages (compressed image)
  bot.on("photo", async (msg) => {
    if (!msg.photo || msg.photo.length === 0) return;
    const largest = msg.photo[msg.photo.length - 1];
    await handleMediaMessage(bot, msg.chat.id, largest.file_id, "image/jpeg", msg.caption);
  });

  // Document messages — PDF, image, or Word template
  bot.on("document", async (msg) => {
    const doc = msg.document;
    if (!doc) return;

    const mime = doc.mime_type ?? "";
    const name = doc.file_name ?? "";

    const isDocx =
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      name.toLowerCase().endsWith(".docx");
    const isDoc =
      mime === "application/msword" ||
      name.toLowerCase().endsWith(".doc");

    if (isDocx || isDoc) {
      const ext = isDoc && !name.toLowerCase().endsWith(".docx") ? "doc" : "docx";
      await handleTemplateDocument(bot, msg.chat.id, doc.file_id, ext, msg.caption);
      return;
    }

    const supported = mime === "application/pdf" || mime.startsWith("image/");
    if (!supported) {
      await bot.sendMessage(
        msg.chat.id,
        "❌ Formato não suportado. Envie uma *imagem*, *PDF*, ou arquivo *Word (.docx/.doc)*.",
        { parse_mode: "Markdown" }
      );
      return;
    }

    await handleMediaMessage(bot, msg.chat.id, doc.file_id, mime, msg.caption);
  });

  // Plain text — fulfil pending media or pending template request
  bot.on("text", async (msg) => {
    if (msg.text?.startsWith("/")) return;

    const chatId = msg.chat.id;
    const text   = msg.text ?? "";

    // Pending template takes priority if present
    const tmpl = pendingTemplate.get(chatId);
    if (tmpl) {
      if (tmpl.expiresAt < Date.now()) {
        pendingTemplate.delete(chatId);
        await bot.sendMessage(chatId, "⏰ O template expirou (5 min). Envie o arquivo .docx novamente.");
        return;
      }

      const parsed = parseProvaArgs(text);
      if (!parsed) {
        await bot.sendMessage(
          chatId,
          `❌ Formato inválido. Responda com: \`<disciplina> <quantidade> <conteúdos>\`\n\nExemplo: \`História 10 Revolução Industrial\`\n\nDisciplinas: ${DISCIPLINES.join(", ")}`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      pendingTemplate.delete(chatId);
      const statusMsg = await bot.sendMessage(
        chatId,
        `⏳ Processando template e gerando *${parsed.questionCount}* questões de *${parsed.discipline}*...`,
        { parse_mode: "Markdown" }
      );
      await generateAndSendExamFromTemplate(
        bot, chatId, statusMsg.message_id,
        tmpl.fileId, tmpl.originalExt,
        parsed.discipline, parsed.questionCount, parsed.topics,
        parsed.serie, parsed.turma
      );
      return;
    }

    // Pending media
    const pending = pendingMedia.get(chatId);
    if (!pending) return;

    if (pending.expiresAt < Date.now()) {
      pendingMedia.delete(chatId);
      await bot.sendMessage(chatId, "⏰ O material expirou (5 min). Envie a foto ou PDF novamente.");
      return;
    }

    const parsed = parseDisciplineAndCount(text);
    if (!parsed) {
      await bot.sendMessage(
        chatId,
        `❌ Formato inválido. Responda com: \`<disciplina> <quantidade>\`\n\nExemplo: \`História 10\`\nCom série/turma: \`História 10 | 3ª série | Turma A\`\n\nDisciplinas: ${DISCIPLINES.join(", ")}`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    pendingMedia.delete(chatId);
    const statusMsg = await bot.sendMessage(
      chatId,
      `⏳ Analisando o material e gerando *${parsed.questionCount}* questões de *${parsed.discipline}*...`,
      { parse_mode: "Markdown" }
    );
    await generateAndSendExam(
      bot, chatId, statusMsg.message_id,
      parsed.discipline, parsed.questionCount,
      { type: "media", fileId: pending.fileId, mimeType: pending.mimeType },
      parsed.serie, parsed.turma
    );
  });

  bot.on("polling_error", (err) => {
    console.error("[TelegramBot] Polling error:", err.message);
  });

  console.log("[TelegramBot] Bot started successfully.");
  return bot;
}
