import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { nanoid } from "nanoid";
import type { Question } from "./gemini";

const execFileAsync = promisify(execFile);

const SCRIPT_PATH = join(dirname(new URL(import.meta.url).pathname), "scripts/inject_template.py");

interface TemplateResult {
  examDocxBytes: Buffer;
  examPdfBytes: Buffer;
  answerDocxBytes: Buffer;
  answerPdfBytes: Buffer;
}

async function ensureTmpDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

export async function processTemplate(
  templateBytes: Buffer,
  questions: Question[],
  discipline: string,
  originalExt = "docx"
): Promise<TemplateResult> {
  const workDir = join(tmpdir(), `exam_${nanoid()}`);
  await ensureTmpDir(workDir);

  const uploadedPath = join(workDir, `template.${originalExt}`);
  const templatePath = join(workDir, "template.docx");
  const questionsPath = join(workDir, "questions.json");
  const examDocxPath = join(workDir, "prova.docx");
  const answerDocxPath = join(workDir, "gabarito.docx");

  try {
    await writeFile(uploadedPath, templateBytes);
    await writeFile(questionsPath, JSON.stringify(questions), "utf-8");

    // .doc must be converted to .docx before python-docx can read it
    if (originalExt === "doc") {
      await execFileAsync("libreoffice", [
        "--headless",
        "--convert-to", "docx",
        "--outdir", workDir,
        uploadedPath,
      ]);
    }

    // Generate exam docx
    await execFileAsync("python3", [
      SCRIPT_PATH,
      templatePath,
      questionsPath,
      examDocxPath,
      "--discipline", discipline,
    ]);

    // Generate answer docx
    await execFileAsync("python3", [
      SCRIPT_PATH,
      templatePath,
      questionsPath,
      answerDocxPath,
      "--discipline", discipline,
      "--gabarito",
    ]);

    // Convert both to PDF via LibreOffice
    await execFileAsync("libreoffice", [
      "--headless",
      "--convert-to", "pdf",
      "--outdir", workDir,
      examDocxPath,
      answerDocxPath,
    ]);

    const examPdfPath = join(workDir, "prova.pdf");
    const answerPdfPath = join(workDir, "gabarito.pdf");

    const [examDocxBytes, examPdfBytes, answerDocxBytes, answerPdfBytes] = await Promise.all([
      readFile(examDocxPath),
      readFile(examPdfPath),
      readFile(answerDocxPath),
      readFile(answerPdfPath),
    ]);

    return { examDocxBytes, examPdfBytes, answerDocxBytes, answerPdfBytes };
  } finally {
    // Cleanup temp files (best effort)
    try {
      const { rm } = await import("fs/promises");
      await rm(workDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}
