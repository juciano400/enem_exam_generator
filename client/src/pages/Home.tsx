import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import ExamForm from "@/components/ExamForm";
import type { ExamFormValues } from "@/components/ExamForm";
import ExamResult from "@/components/ExamResult";
import type { Question } from "../../../server/gemini";

export interface ExamData {
  questions: Question[];
  examPdfUrl: string;
  answerPdfUrl: string;
  discipline: string;
  questionCount: number;
  topics: string;
  usedTemplate?: boolean;
}

export default function Home() {
  const [examData, setExamData] = useState<ExamData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingMode, setGeneratingMode] = useState<"enem" | "template">("enem");

  const generateMutation = trpc.exam.generate.useMutation({
    onSuccess: (data) => {
      setExamData(data as ExamData);
      setIsGenerating(false);
    },
    onError: (err) => {
      setIsGenerating(false);
      toast.error("Erro ao gerar a prova", {
        description: err.message || "Verifique sua conexão e tente novamente.",
      });
    },
  });

  async function generateWithTemplate(values: ExamFormValues) {
    if (!values.templateFile) return;
    const formData = new FormData();
    formData.append("template", values.templateFile);
    formData.append("discipline", values.discipline);
    formData.append("questionCount", String(values.questionCount));
    formData.append("topics", values.topics);

    try {
      const res = await fetch("/api/exam/generate-with-template", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Erro ao processar o template.");
      }
      setExamData(json as ExamData);
      setIsGenerating(false);
    } catch (err: unknown) {
      setIsGenerating(false);
      const message = err instanceof Error ? err.message : "Erro ao processar o template.";
      toast.error("Erro ao gerar a prova", { description: message });
    }
  }

  function handleGenerate(values: ExamFormValues) {
    setIsGenerating(true);
    setExamData(null);
    setGeneratingMode(values.useTemplate ? "template" : "enem");

    if (values.useTemplate && values.templateFile) {
      generateWithTemplate(values);
    } else {
      generateMutation.mutate({
        discipline: values.discipline,
        questionCount: values.questionCount,
        topics: values.topics,
      });
    }
  }

  function handleReset() {
    setExamData(null);
    setIsGenerating(false);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">E</span>
            </div>
            <div>
              <span
                className="text-sm font-semibold tracking-tight text-foreground"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                ENEM
              </span>
              <span className="text-sm text-muted-foreground ml-1.5 font-light tracking-wide">
                Gerador de Provas
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              Powered by Gemini
            </span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col">
        {!examData && !isGenerating && (
          <>
            {/* Hero */}
            <section className="max-w-5xl mx-auto px-6 pt-16 pb-12 w-full">
              <div className="max-w-2xl">
                <p className="text-xs font-medium tracking-widest text-primary/70 uppercase mb-4">
                  Elaboração Inteligente
                </p>
                <h1
                  className="text-4xl md:text-5xl font-bold text-foreground leading-tight mb-4"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Crie provas no padrão{" "}
                  <span className="text-primary italic">ENEM</span>{" "}
                  em segundos
                </h1>
                <p className="text-base text-muted-foreground leading-relaxed max-w-xl">
                  Informe a disciplina, os conteúdos e a quantidade de questões. A inteligência
                  artificial gera uma prova completa com gabarito e explicações, pronta para download
                  em PDF — no padrão ENEM ou no seu próprio template Word.
                </p>
              </div>

              {/* CTA */}
              <div className="mt-8 flex items-center gap-4">
                <a
                  href="#exam-form"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById("exam-form")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Gerar prova agora
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </a>
                <span className="text-xs text-muted-foreground">Gratuito · Sem cadastro</span>
              </div>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-2 mt-8">
                {["Literatura", "Gramática", "Arte", "História", "Sociologia", "Filosofia"].map(
                  (d) => (
                    <span
                      key={d}
                      className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground bg-card"
                    >
                      {d}
                    </span>
                  )
                )}
                <span className="text-xs px-3 py-1.5 rounded-full border border-amber-200 text-amber-700 bg-amber-50">
                  Template Word
                </span>
              </div>
            </section>

            {/* Divider */}
            <div className="max-w-5xl mx-auto px-6 w-full">
              <div className="border-t border-border/60" />
            </div>

            {/* Form */}
            <section id="exam-form" className="max-w-5xl mx-auto px-6 py-12 w-full">
              <ExamForm onGenerate={handleGenerate} />
            </section>
          </>
        )}

        {/* Loading state */}
        {isGenerating && (
          <div className="flex-1 flex flex-col items-center justify-center py-24 px-6">
            <div className="text-center max-w-sm">
              <div className="relative w-16 h-16 mx-auto mb-8">
                <div className="absolute inset-0 rounded-full border-2 border-border" />
                <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <div className="absolute inset-3 rounded-full bg-primary/10 flex items-center justify-center">
                  <span
                    className="text-primary text-lg"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    E
                  </span>
                </div>
              </div>
              <h2
                className="text-xl font-semibold text-foreground mb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {generatingMode === "template"
                  ? "Preenchendo seu template"
                  : "Elaborando sua prova"}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {generatingMode === "template"
                  ? "O Gemini está criando as questões e inserindo no seu modelo Word, preservando cabeçalho, logo e rodapé."
                  : "O Gemini está criando questões no padrão ENEM com contextualização, enunciados e alternativas. Isso pode levar alguns instantes."}
              </p>
              <div className="mt-6 flex justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Result */}
        {examData && !isGenerating && (
          <section className="max-w-5xl mx-auto px-6 py-12 w-full">
            <ExamResult data={examData} onReset={handleReset} />
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-6">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Gerador de Provas ENEM — Powered by Google Gemini
          </p>
          <p className="text-xs text-muted-foreground">
            As questões são geradas por IA e devem ser revisadas antes do uso oficial.
          </p>
        </div>
      </footer>
    </div>
  );
}
