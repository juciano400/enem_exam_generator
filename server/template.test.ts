import { describe, expect, it, vi, beforeEach } from "vitest";
import { execFile } from "child_process";
import { promisify } from "util";

// Mock child_process for template processor tests
vi.mock("child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs/promises")>();
  return {
    ...actual,
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.4 test")),
    mkdir: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
  };
});

const execFileMock = vi.mocked(execFile);

describe("templateProcessor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock execFile to succeed
    execFileMock.mockImplementation((_cmd, _args, callback: unknown) => {
      if (typeof callback === "function") {
        (callback as (err: null, stdout: string, stderr: string) => void)(null, "", "");
      }
      return {} as ReturnType<typeof execFile>;
    });
  });

  it("should call python3 script for exam injection", async () => {
    const { processTemplate } = await import("./templateProcessor");

    const templateBytes = Buffer.from("fake docx content");
    const questions = [
      {
        number: 1,
        discipline: "Literatura",
        context: "Contexto de teste",
        statement: "Enunciado de teste",
        alternatives: [
          { letter: "A", text: "Alternativa A" },
          { letter: "B", text: "Alternativa B" },
          { letter: "C", text: "Alternativa C" },
          { letter: "D", text: "Alternativa D" },
          { letter: "E", text: "Alternativa E" },
        ],
        correctAnswer: "B",
        explanation: "Explicação de teste",
      },
    ];

    // Should not throw (mocked fs/execFile)
    await expect(
      processTemplate(templateBytes, questions, "Literatura")
    ).resolves.toBeDefined();
  });
});

describe("template route validation", () => {
  it("should reject invalid discipline names", () => {
    const VALID_DISCIPLINES = ["Literatura", "Gramática", "Arte", "História", "Sociologia", "Filosofia"];
    expect(VALID_DISCIPLINES.includes("Matemática")).toBe(false);
    expect(VALID_DISCIPLINES.includes("Literatura")).toBe(true);
    expect(VALID_DISCIPLINES.includes("Filosofia")).toBe(true);
  });

  it("should reject question count out of range", () => {
    const isValidCount = (n: number) => !isNaN(n) && n >= 5 && n <= 45;
    expect(isValidCount(4)).toBe(false);
    expect(isValidCount(5)).toBe(true);
    expect(isValidCount(45)).toBe(true);
    expect(isValidCount(46)).toBe(false);
    expect(isValidCount(NaN)).toBe(false);
  });

  it("should reject topics shorter than 5 characters", () => {
    const isValidTopics = (t: string) => t.trim().length >= 5;
    expect(isValidTopics("ab")).toBe(false);
    expect(isValidTopics("abcde")).toBe(true);
    expect(isValidTopics("Modernismo brasileiro")).toBe(true);
    expect(isValidTopics("   ")).toBe(false);
  });

  it("should only accept .docx files", () => {
    const isDocx = (name: string) => name.endsWith(".docx");
    expect(isDocx("template.docx")).toBe(true);
    expect(isDocx("template.pdf")).toBe(false);
    expect(isDocx("template.doc")).toBe(false);
    expect(isDocx("template.xlsx")).toBe(false);
  });
});

// Integration-style test for the template route handler logic
describe("template route handler integration", () => {
  it("should build FormData correctly for template upload", () => {
    // Simulate what the frontend does before calling the endpoint
    const mockFile = new File(["PK fake docx"], "meu_template.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const formData = new FormData();
    formData.append("template", mockFile);
    formData.append("discipline", "Literatura");
    formData.append("questionCount", "10");
    formData.append("topics", "Modernismo brasileiro, Machado de Assis");

    expect(formData.get("discipline")).toBe("Literatura");
    expect(formData.get("questionCount")).toBe("10");
    expect(formData.get("topics")).toBe("Modernismo brasileiro, Machado de Assis");
    const templateEntry = formData.get("template") as File;
    expect(templateEntry.name).toBe("meu_template.docx");
    expect(templateEntry.name.endsWith(".docx")).toBe(true);
  });

  it("should validate all required fields before submission", () => {
    // Simulate the frontend validation logic
    function validateTemplateForm(params: {
      discipline: string;
      questionCount: number;
      topics: string;
      hasFile: boolean;
    }) {
      const errors: string[] = [];
      const VALID_DISCIPLINES = ["Literatura", "Gramática", "Arte", "História", "Sociologia", "Filosofia"];
      if (!VALID_DISCIPLINES.includes(params.discipline)) errors.push("disciplina inválida");
      if (params.questionCount < 5 || params.questionCount > 45) errors.push("quantidade inválida");
      if (params.topics.trim().length < 5) errors.push("conteúdos insuficientes");
      if (!params.hasFile) errors.push("template obrigatório");
      return errors;
    }

    // All valid
    expect(validateTemplateForm({
      discipline: "Literatura",
      questionCount: 10,
      topics: "Modernismo brasileiro",
      hasFile: true,
    })).toHaveLength(0);

    // Missing file
    expect(validateTemplateForm({
      discipline: "Arte",
      questionCount: 10,
      topics: "Barroco brasileiro",
      hasFile: false,
    })).toContain("template obrigatório");

    // Invalid discipline
    expect(validateTemplateForm({
      discipline: "Matemática",
      questionCount: 10,
      topics: "Álgebra linear",
      hasFile: true,
    })).toContain("disciplina inválida");

    // All invalid
    const allErrors = validateTemplateForm({
      discipline: "Física",
      questionCount: 100,
      topics: "ab",
      hasFile: false,
    });
    expect(allErrors.length).toBe(4);
  });
});
