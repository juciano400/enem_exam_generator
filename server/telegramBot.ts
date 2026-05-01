import TelegramBot from "node-telegram-bot-api";
import { generateQuestions } from "./gemini";
import { generateExamPDF, generateAnswerPDF } from "./pdfGenerator";

const DISCIPLINES = ["Literatura", "Gramática", "Arte", "História", "Sociologia", "Filosofia"] as const;
type Discipline = (typeof DISCIPLINES)[number];

const HELP_TEXT = `📚 *Gerador de Provas ENEM*

Comandos disponíveis:

/prova \\<disciplina\\> \\<quantidade\\> \\<conteúdos\\>
Gera uma prova completa e envia os PDFs.

*Exemplo:*
/prova História 10 Revolução Industrial e Imperialismo

*Disciplinas disponíveis:*
${DISCIPLINES.map((d) => `• ${d}`).join("\n")}

*Quantidade:* de 5 a 45 questões

/ajuda \\- exibe esta mensagem`;

function parseDiscipline(raw: string): Discipline | null {
  const normalized = raw.trim().toLowerCase();
  return (
    DISCIPLINES.find((d) => d.toLowerCase() === normalized) ?? null
  );
}

async function handleProva(
  bot: TelegramBot,
  chatId: number,
  args: string
): Promise<void> {
  const parts = args.trim().split(/\s+/);
  if (parts.length < 3) {
    await bot.sendMessage(
      chatId,
      "❌ Uso: /prova <disciplina> <quantidade> <conteúdos>\n\nExemplo:\n/prova História 10 Revolução Industrial",
      { parse_mode: "Markdown" }
    );
    return;
  }

  const rawDiscipline = parts[0];
  const rawCount = parts[1];
  const topics = parts.slice(2).join(" ").trim();

  const discipline = parseDiscipline(rawDiscipline);
  if (!discipline) {
    await bot.sendMessage(
      chatId,
      `❌ Disciplina inválida: *${rawDiscipline}*\n\nDisciplinas disponíveis:\n${DISCIPLINES.map((d) => `• ${d}`).join("\n")}`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  const questionCount = parseInt(rawCount, 10);
  if (isNaN(questionCount) || questionCount < 5 || questionCount > 45) {
    await bot.sendMessage(
      chatId,
      "❌ A quantidade de questões deve ser um número entre 5 e 45."
    );
    return;
  }

  if (topics.length < 5) {
    await bot.sendMessage(
      chatId,
      "❌ Informe os conteúdos/assuntos da prova (mínimo 5 caracteres)."
    );
    return;
  }

  const statusMsg = await bot.sendMessage(
    chatId,
    `⏳ Gerando prova de *${discipline}* com ${questionCount} questões sobre _${topics}_...\n\nAguarde, isso pode levar alguns instantes.`,
    { parse_mode: "Markdown" }
  );

  try {
    const questions = await generateQuestions({ discipline, questionCount, topics });

    const [examPdfBytes, answerPdfBytes] = await Promise.all([
      generateExamPDF(questions, discipline, topics),
      generateAnswerPDF(questions, discipline),
    ]);

    await bot.editMessageText(
      `✅ Prova gerada! Enviando PDFs...`,
      { chat_id: chatId, message_id: statusMsg.message_id }
    );

    const examFilename = `ENEM_${discipline}_${questionCount}q_prova.pdf`;
    const answerFilename = `ENEM_${discipline}_${questionCount}q_gabarito.pdf`;

    await bot.sendDocument(
      chatId,
      Buffer.from(examPdfBytes),
      { caption: `📄 *Prova* — ${discipline} | ${questionCount} questões`, parse_mode: "Markdown" },
      { filename: examFilename, contentType: "application/pdf" }
    );

    await bot.sendDocument(
      chatId,
      Buffer.from(answerPdfBytes),
      { caption: `📋 *Gabarito e Explicações* — ${discipline}`, parse_mode: "Markdown" },
      { filename: answerFilename, contentType: "application/pdf" }
    );
  } catch (err) {
    console.error("[TelegramBot] Error generating exam:", err);
    const message = err instanceof Error ? err.message : "Erro interno.";
    await bot.editMessageText(
      `❌ Erro ao gerar a prova: ${message}`,
      { chat_id: chatId, message_id: statusMsg.message_id }
    ).catch(() => {
      bot.sendMessage(chatId, `❌ Erro ao gerar a prova: ${message}`);
    });
  }
}

export function startTelegramBot(token: string): TelegramBot {
  const bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/start/, async (msg) => {
    await bot.sendMessage(msg.chat.id, HELP_TEXT, { parse_mode: "MarkdownV2" });
  });

  bot.onText(/\/ajuda/, async (msg) => {
    await bot.sendMessage(msg.chat.id, HELP_TEXT, { parse_mode: "MarkdownV2" });
  });

  bot.onText(/\/prova(?:\s+(.+))?/, async (msg, match) => {
    const args = match?.[1] ?? "";
    await handleProva(bot, msg.chat.id, args);
  });

  bot.on("polling_error", (err) => {
    console.error("[TelegramBot] Polling error:", err.message);
  });

  console.log("[TelegramBot] Bot started successfully.");
  return bot;
}
