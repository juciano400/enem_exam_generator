import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock external dependencies before importing the router
vi.mock("./gemini", () => ({
  generateQuestions: vi.fn().mockResolvedValue([
    {
      number: 1,
      discipline: "Literatura",
      context: "Texto de apoio sobre Machado de Assis",
      statement: "Qual é a principal característica do Realismo brasileiro?",
      alternatives: [
        { letter: "A", text: "Idealização da natureza e do amor" },
        { letter: "B", text: "Crítica social e análise psicológica dos personagens" },
        { letter: "C", text: "Exaltação do nacionalismo e do herói" },
        { letter: "D", text: "Fuga da realidade e misticismo" },
        { letter: "E", text: "Valorização do passado medieval" },
      ],
      correctAnswer: "B",
      explanation: "O Realismo brasileiro, representado por Machado de Assis, caracteriza-se pela crítica social e análise psicológica aprofundada dos personagens.",
    },
  ]),
}));

vi.mock("./pdfGenerator", () => ({
  generateExamPDF: vi.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70])), // %PDF
  generateAnswerPDF: vi.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70])),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({
    key: "exams/test-key.pdf",
    url: "/manus-storage/exams/test-key.pdf",
  }),
}));

vi.mock("./db", () => ({
  insertExam: vi.fn().mockResolvedValue([{ insertId: 1 }]),
  updateExamPdfs: vi.fn().mockResolvedValue(undefined),
  getRecentExams: vi.fn().mockResolvedValue([]),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("exam.generate", () => {
  it("should generate questions and return PDF URLs", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.exam.generate({
      discipline: "Literatura",
      questionCount: 5,
      topics: "Machado de Assis, Realismo brasileiro",
    });

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].discipline).toBe("Literatura");
    expect(result.questions[0].correctAnswer).toBe("B");
    expect(result.examPdfUrl).toMatch(/manus-storage/);
    expect(result.answerPdfUrl).toMatch(/manus-storage/);
    expect(result.discipline).toBe("Literatura");
  });

  it("should reject invalid discipline", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.exam.generate({
        discipline: "Matemática" as "Literatura",
        questionCount: 10,
        topics: "Álgebra",
      })
    ).rejects.toThrow();
  });

  it("should reject questionCount below minimum", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.exam.generate({
        discipline: "História",
        questionCount: 2,
        topics: "Era Vargas",
      })
    ).rejects.toThrow();
  });

  it("should reject questionCount above maximum", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.exam.generate({
        discipline: "Filosofia",
        questionCount: 50,
        topics: "Ética",
      })
    ).rejects.toThrow();
  });

  it("should reject empty topics", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.exam.generate({
        discipline: "Arte",
        questionCount: 10,
        topics: "ab",
      })
    ).rejects.toThrow();
  });
});

describe("exam.recent", () => {
  it("should return recent exams list", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.exam.recent();
    expect(Array.isArray(result)).toBe(true);
  });
});
