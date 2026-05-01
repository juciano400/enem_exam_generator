import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { generateQuestions } from "../gemini";
import { generateExamPDF, generateAnswerPDF } from "../pdfGenerator";
import { storagePut } from "../storage";
import { insertExam, updateExamPdfs, getRecentExams } from "../db";
import { nanoid } from "nanoid";

const DISCIPLINES = ["Literatura", "Gramática", "Arte", "História", "Sociologia", "Filosofia"] as const;

export const examRouter = router({
  generate: publicProcedure
    .input(
      z.object({
        discipline: z.enum(DISCIPLINES),
        questionCount: z.number().int().min(5).max(45),
        topics: z.string().min(5).max(500),
      })
    )
    .mutation(async ({ input }) => {
      // 1. Generate questions with Gemini
      const questions = await generateQuestions({
        discipline: input.discipline,
        questionCount: input.questionCount,
        topics: input.topics,
      });

      // 2. Generate PDFs
      const [examPdfBytes, answerPdfBytes] = await Promise.all([
        generateExamPDF(questions, input.discipline, input.topics),
        generateAnswerPDF(questions, input.discipline),
      ]);

      // 3. Upload PDFs to storage
      const examKey = `exams/${nanoid()}-prova.pdf`;
      const answerKey = `exams/${nanoid()}-gabarito.pdf`;

      const [examUpload, answerUpload] = await Promise.all([
        storagePut(examKey, Buffer.from(examPdfBytes), "application/pdf"),
        storagePut(answerKey, Buffer.from(answerPdfBytes), "application/pdf"),
      ]);

      // 4. Save to database
      try {
        const result = await insertExam({
          discipline: input.discipline,
          questionCount: input.questionCount,
          topics: input.topics,
          questions: questions as unknown as Record<string, unknown>[],
          examPdfKey: examUpload.key,
          answerPdfKey: answerUpload.key,
        });
        const insertId = (result as unknown as [{ insertId?: number }])[0]?.insertId ?? 0;
        if (insertId) {
          await updateExamPdfs(insertId, examUpload.key, answerUpload.key);
        }
      } catch (err) {
        console.error("[Exam] Failed to save to DB:", err);
        // Non-fatal: PDFs are already generated
      }

      return {
        questions,
        examPdfUrl: examUpload.url,
        answerPdfUrl: answerUpload.url,
        discipline: input.discipline,
        questionCount: questions.length,
        topics: input.topics,
      };
    }),

  recent: publicProcedure.query(async () => {
    return getRecentExams(6);
  }),
});
