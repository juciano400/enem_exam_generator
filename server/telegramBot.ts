import TelegramBot from "node-telegram-bot-api";
import { generateQuestions, generateQuestionsFromMedia } from "./gemini";
import { generateExamPDF, generateAnswerPDF } from "./pdfGenerator";

const DISCIPLINES = ["Literatura", "Gramática", "Arte", "História", "Sociologia", "Filosofia"] as const;
type Discipline = (typeof DISCIPLINES)[number];

const HELP_TEXT = `📚 *Gerador de Provas ENEM*

*Opção 1 — Por tema:*
/prova <disciplina> <quantidade> <conteúdos>
Exemplo: \`/prova História 10 Revolução Industrial\`

*Opção 2 — Por material (foto ou PDF):*
Envie uma foto ou PDF de páginas do livro/apostila com a legenda:
\`<disciplina> <quantidade>\`
Exemplo de legenda: \`História 10\`

*Disciplinas disponíveis:*
${DISCIPLINES.map((d) => `• ${d}`).join("\n")}

*Quantidade:* 5 a 45 questões

/ajuda — exibe esta mensagem`;

// Pending media waiting for discipline+count reply
interface PendingMedia {
  fileId: string;
  mimeType: string;
  expiresAt: number;
}

const pendingMedia = new Map<number, PendingMedia>();
const PENDING_TTL_MS = 5 * 60 * 1000; // 5 minutes

function parseDiscipline(raw: string): Discipline | null {
  const normalized = raw.trim().toLowerCase();
  return DISCIPLINES.find((d) => d.toLowerCase() === normalized) ?? null;
}

function parseDisciplineAndCount(
  text: string
): { discipline: Discipline; questionCount: number } | null {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const discipline = parseDiscipline(parts[0]);
  const questionCount = parseInt(parts[1], 10);
  if (!discipline || isNaN(questionCount) || questionCount < 5 || questionCount > 45) return null;
  return { discipline, questionCount };
}

async function downloadFile(bot: TelegramBot, fileId: string): Promise<Buffer> {
  const fileLink = await bot.getFileLink(fileId);
  const res = await fetch(fileLink);
  if (!res.ok) throw new Error(`Falha ao baixar arquivo: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function generateAndSendExam(
  bot: TelegramBot,
  chatId: number,
  statusMsgId: number,
  discipline: Discipline,
  questionCount: number,
  source:
    | { type: "topics"; topics: string }
    | { type: "media"; fileId: string; mimeType: string }
): Promise<void> {
  try {
    let questions;

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
    }

    const topicsLabel =
      source.type === "topics" ? source.topics : "Material enviado";

    const [examPdfBytes, answerPdfBytes] = await Promise.all([
      generateExamPDF(questions, discipline, topicsLabel),
      generateAnswerPDF(questions, discipline),
    ]);

    await bot.editMessageText("✅ Prova gerada! Enviando PDFs...", {
      chat_id: chatId,
      message_id: statusMsgId,
    });

    const examFilename = `ENEM_${discipline}_${questionCount}q_prova.pdf`;
    const answerFilename = `ENEM_${discipline}_${questionCount}q_gabarito.pdf`;

    await bot.sendDocument(
      chatId,
      Buffer.from(examPdfBytes),
      {
        caption: `📄 *Prova* — ${discipline} | ${questionCount} questões`,
        parse_mode: "Markdown",
      },
      { filename: examFilename, contentType: "application/pdf" }
    );

    await bot.sendDocument(
      chatId,
      Buffer.from(answerPdfBytes),
      {
        caption: `📋 *Gabarito e Explicações* — ${discipline}`,
        parse_mode: "Markdown",
      },
      { filename: answerFilename, contentType: "application/pdf" }
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

async function handleProvaCommand(
  bot: TelegramBot,
  chatId: number,
  args: string
): Promise<void> {
  const parts = args.trim().split(/\s+/);
  if (parts.length < 3) {
    await bot.sendMessage(
      chatId,
      "❌ Uso: `/prova <disciplina> <quantidade> <conteúdos>`\n\nExemplo:\n`/prova História 10 Revolução Industrial`",
      { parse_mode: "Markdown" }
    );
    return;
  }

  const discipline = parseDiscipline(parts[0]);
  if (!discipline) {
    await bot.sendMessage(
      chatId,
      `❌ Disciplina inválida: *${parts[0]}*\n\nDisciplinas disponíveis:\n${DISCIPLINES.map((d) => `• ${d}`).join("\n")}`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  const questionCount = parseInt(parts[1], 10);
  if (isNaN(questionCount) || questionCount < 5 || questionCount > 45) {
    await bot.sendMessage(chatId, "❌ A quantidade deve ser um número entre 5 e 45.");
    return;
  }

  const topics = parts.slice(2).join(" ").trim();
  if (topics.length < 5) {
    await bot.sendMessage(chatId, "❌ Informe os conteúdos/assuntos (mínimo 5 caracteres).");
    return;
  }

  const statusMsg = await bot.sendMessage(
    chatId,
    `⏳ Gerando prova de *${discipline}* — ${questionCount} questões sobre _${topics}_...`,
    { parse_mode: "Markdown" }
  );

  await generateAndSendExam(bot, chatId, statusMsg.message_id, discipline, questionCount, {
    type: "topics",
    topics,
  });
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
      bot,
      chatId,
      statusMsg.message_id,
      parsed.discipline,
      parsed.questionCount,
      { type: "media", fileId, mimeType }
    );
  } else {
    pendingMedia.set(chatId, { fileId, mimeType, expiresAt: Date.now() + PENDING_TTL_MS });
    await bot.sendMessage(
      chatId,
      `📎 Material recebido! Agora me diga a *disciplina* e a *quantidade de questões*:\n\nExemplo: \`História 10\`\n\nDisciplinas: ${DISCIPLINES.join(", ")}`,
      { parse_mode: "Markdown" }
    );
  }
}

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
    const largest = msg.photo[msg.photo.length - 1]; // highest resolution
    await handleMediaMessage(bot, msg.chat.id, largest.file_id, "image/jpeg", msg.caption);
  });

  // Document messages (PDF or image sent as file)
  bot.on("document", async (msg) => {
    const doc = msg.document;
    if (!doc) return;

    const mime = doc.mime_type ?? "";
    const supported = mime === "application/pdf" || mime.startsWith("image/");

    if (!supported) {
      await bot.sendMessage(
        msg.chat.id,
        "❌ Formato não suportado. Envie uma *imagem* (foto ou arquivo) ou um *PDF*.",
        { parse_mode: "Markdown" }
      );
      return;
    }

    await handleMediaMessage(bot, msg.chat.id, doc.file_id, mime, msg.caption);
  });

  // Plain text reply — fulfil pending media request
  bot.on("text", async (msg) => {
    if (msg.text?.startsWith("/")) return;

    const pending = pendingMedia.get(msg.chat.id);
    if (!pending) return;

    if (pending.expiresAt < Date.now()) {
      pendingMedia.delete(msg.chat.id);
      await bot.sendMessage(
        msg.chat.id,
        "⏰ O material expirou (5 min). Envie a foto ou PDF novamente."
      );
      return;
    }

    const parsed = parseDisciplineAndCount(msg.text ?? "");
    if (!parsed) {
      await bot.sendMessage(
        msg.chat.id,
        `❌ Formato inválido. Responda com: \`<disciplina> <quantidade>\`\n\nExemplo: \`História 10\`\n\nDisciplinas: ${DISCIPLINES.join(", ")}`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    pendingMedia.delete(msg.chat.id);

    const statusMsg = await bot.sendMessage(
      msg.chat.id,
      `⏳ Analisando o material e gerando *${parsed.questionCount}* questões de *${parsed.discipline}*...`,
      { parse_mode: "Markdown" }
    );

    await generateAndSendExam(
      bot,
      msg.chat.id,
      statusMsg.message_id,
      parsed.discipline,
      parsed.questionCount,
      { type: "media", fileId: pending.fileId, mimeType: pending.mimeType }
    );
  });

  bot.on("polling_error", (err) => {
    console.error("[TelegramBot] Polling error:", err.message);
  });

  console.log("[TelegramBot] Bot started successfully.");
  return bot;
}
