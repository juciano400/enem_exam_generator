import express from "express";
import multer from "multer";
import { generateQuestions } from "./gemini";
import { processTemplate } from "./templateProcessor";
import { storagePut } from "./storage";
import { insertExam, updateExamPdfs } from "./db";
import { nanoid } from "nanoid";

const router = express.Router();

// Memory storage — files are kept in memory as Buffer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (_req, file, cb) => {
    const isDocx =
      file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.originalname.toLowerCase().endsWith(".docx");
    const isDoc =
      file.mimetype === "application/msword" ||
      file.originalname.toLowerCase().endsWith(".doc");
    if (isDocx || isDoc) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos .doc ou .docx são aceitos como template."));
    }
  },
});

const DISCIPLINES = ["Literatura", "Gramática", "Arte", "História", "Sociologia", "Filosofia"];

router.post(
  "/api/exam/generate-with-template",
  upload.single("template"),
  async (req, res) => {
    try {
      const { discipline, questionCount, topics } = req.body as {
        discipline: string;
        questionCount: string;
        topics: string;
      };

      // Validate inputs
      if (!discipline || !DISCIPLINES.includes(discipline)) {
        res.status(400).json({ error: "Disciplina inválida." });
        return;
      }
      const count = parseInt(questionCount, 10);
      if (isNaN(count) || count < 5 || count > 45) {
        res.status(400).json({ error: "Quantidade de questões deve ser entre 5 e 45." });
        return;
      }
      if (!topics || topics.trim().length < 5) {
        res.status(400).json({ error: "Informe os conteúdos/assuntos da prova." });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "Arquivo de template .doc ou .docx é obrigatório." });
        return;
      }

      const originalExt = req.file.originalname.endsWith(".doc") ? "doc" : "docx";

      // 1. Generate questions with Gemini
      const questions = await generateQuestions({
        discipline,
        questionCount: count,
        topics: topics.trim(),
      });

      const originalExt = req.file.originalname.toLowerCase().endsWith(".doc") ? "doc" : "docx";

      // 2. Process template — inject questions and convert to PDF
      const { examPdfBytes, answerPdfBytes } = await processTemplate(
        req.file.buffer,
        questions,
        discipline,
        originalExt,
      );

      // 3. Upload PDFs to storage
      const examKey = `exams/${nanoid()}-template-prova.pdf`;
      const answerKey = `exams/${nanoid()}-template-gabarito.pdf`;

      const [examUpload, answerUpload] = await Promise.all([
        storagePut(examKey, examPdfBytes, "application/pdf"),
        storagePut(answerKey, answerPdfBytes, "application/pdf"),
      ]);

      // 4. Save to database (non-fatal)
      try {
        const result = await insertExam({
          discipline,
          questionCount: count,
          topics: topics.trim(),
          questions: questions as unknown as Record<string, unknown>[],
          examPdfKey: examUpload.key,
          answerPdfKey: answerUpload.key,
        });
        const insertId = (result as unknown as [{ insertId?: number }])[0]?.insertId ?? 0;
        if (insertId) {
          await updateExamPdfs(insertId, examUpload.key, answerUpload.key);
        }
      } catch (err) {
        console.error("[TemplateExam] Failed to save to DB:", err);
      }

      res.json({
        questions,
        examPdfUrl: examUpload.url,
        answerPdfUrl: answerUpload.url,
        discipline,
        questionCount: questions.length,
        topics: topics.trim(),
        usedTemplate: true,
      });
    } catch (err: unknown) {
      console.error("[TemplateExam] Error:", err);
      const message = err instanceof Error ? err.message : "Erro interno ao processar o template.";
      res.status(500).json({ error: message });
    }
  }
);

export function registerTemplateRoutes(app: express.Application) {
  app.use(router);
}
