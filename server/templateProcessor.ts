import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";
import { nanoid } from "nanoid";
import type { Question } from "./gemini";

const execFileAsync = promisify(execFile);

const __dirname  = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = join(__dirname, "scripts/inject_template.py");

export interface TemplateResult {
  examDocxBytes:   Buffer;
  examPdfBytes:    Buffer;
  answerDocxBytes: Buffer;
  answerPdfBytes:  Buffer;
}

export async function processTemplate(
  templateBytes: Buffer,
  questions:     Question[],
  discipline:    string,
  originalExt:   "doc" | "docx" = "docx",
  serie?:        string,
  turma?:        string,
): Promise<TemplateResult> {
  const workDir = join(tmpdir(), `exam_${nanoid()}`);
  await mkdir(workDir, { recursive: true });

  const uploadedPath  = join(workDir, `template.${originalExt}`);
  const templatePath  = join(workDir, "template.docx");
  const questionsPath = join(workDir, "questions.json");
  const examDocxPath  = join(workDir, "prova.docx");
  const answerDocxPath = join(workDir, "gabarito.docx");

  try {
    await writeFile(uploadedPath, templateBytes);
    await writeFile(questionsPath, JSON.stringify(questions), "utf-8");

    // .doc → .docx conversion (python-docx only reads .docx)
    if (originalExt === "doc") {
      await execFileAsync("libreoffice", [
        "--headless", "--convert-to", "docx",
        "--outdir", workDir, uploadedPath,
      ]);
    } else {
      // already .docx — just copy/rename
      const { copyFile } = await import("fs/promises");
      await copyFile(uploadedPath, templatePath);
    }

    const baseArgs = [SCRIPT_PATH, templatePath, questionsPath];
    const disciplineArgs = ["--discipline", discipline];
    const extraArgs: string[] = [];
    if (serie) extraArgs.push("--serie", serie);
    if (turma) extraArgs.push("--turma", turma);

    // Generate exam and answer docx in parallel
    await Promise.all([
      execFileAsync("python3", [...baseArgs, examDocxPath, ...disciplineArgs, ...extraArgs]),
      execFileAsync("python3", [...baseArgs, answerDocxPath, ...disciplineArgs, ...extraArgs, "--gabarito"]),
    ]);

    // Convert both to PDF via LibreOffice
    await execFileAsync("libreoffice", [
      "--headless", "--convert-to", "pdf",
      "--outdir", workDir,
      examDocxPath, answerDocxPath,
    ]);

    const [examDocxBytes, examPdfBytes, answerDocxBytes, answerPdfBytes] = await Promise.all([
      readFile(examDocxPath),
      readFile(join(workDir, "prova.pdf")),
      readFile(answerDocxPath),
      readFile(join(workDir, "gabarito.pdf")),
    ]);

    return { examDocxBytes, examPdfBytes, answerDocxBytes, answerPdfBytes };
  } finally {
    try {
      const { rm } = await import("fs/promises");
      await rm(workDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
}
