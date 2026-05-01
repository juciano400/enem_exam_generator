import { Button } from "@/components/ui/button";
import type { ExamData } from "@/pages/Home";

interface ExamResultProps {
  data: ExamData;
  onReset: () => void;
}

export default function ExamResult({ data, onReset }: ExamResultProps) {
  function handleDownload(url: string, filename: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const examFilename = `ENEM_${data.discipline}_${data.questionCount}questoes_prova.pdf`;
  const answerFilename = `ENEM_${data.discipline}_${data.questionCount}questoes_gabarito.pdf`;

  return (
    <div className="space-y-10">
      {/* Success header */}
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-green-50 border border-green-200 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg
            className="w-5 h-5 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Prova gerada com sucesso
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {data.questionCount} questões de{" "}
            <span className="font-medium text-foreground">{data.discipline}</span> no padrão ENEM.
            Faça o download dos PDFs abaixo.
          </p>
        </div>
      </div>

      {/* PDF Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Exam PDF */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-5 hover:border-primary/30 transition-colors">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-6 h-6 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Prova Completa</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Todos os enunciados, alternativas (A–E) e folha de resposta em branco para
                preenchimento.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
              {data.questionCount} questões de múltipla escolha
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
              Folha de resposta incluída
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
              Padrão visual ENEM
            </div>
          </div>

          <Button
            className="w-full h-10 text-sm bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => handleDownload(data.examPdfUrl, examFilename)}
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Baixar Prova (PDF)
          </Button>
        </div>

        {/* Answer PDF */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-5 hover:border-primary/30 transition-colors">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-6 h-6 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Gabarito e Explicações</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Respostas corretas com justificativas detalhadas de cada questão para estudo e
                revisão.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Gabarito completo (A–E)
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Explicação detalhada por questão
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Resumo visual das respostas
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full h-10 text-sm border-border hover:border-primary/40 hover:bg-primary/5"
            onClick={() => handleDownload(data.answerPdfUrl, answerFilename)}
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Baixar Gabarito (PDF)
          </Button>
        </div>
      </div>

      {/* Question preview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3
            className="text-base font-semibold text-foreground"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Pré-visualização das questões
          </h3>
          <span className="text-xs text-muted-foreground">
            {data.questions.length} questões geradas
          </span>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {data.questions.map((q) => (
            <div
              key={q.number}
              className="rounded-lg border border-border bg-card p-4 space-y-3"
            >
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {q.number}
                </span>
                <div className="flex-1 min-w-0">
                  {q.context && (
                    <p className="text-xs text-muted-foreground italic leading-relaxed mb-2 border-l-2 border-border pl-3">
                      {q.context.length > 200 ? q.context.slice(0, 200) + "..." : q.context}
                    </p>
                  )}
                  <p className="text-sm text-foreground leading-relaxed font-medium">
                    {q.statement.length > 180 ? q.statement.slice(0, 180) + "..." : q.statement}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-1 pl-9">
                {q.alternatives.map((alt) => (
                  <div key={alt.letter} className="flex items-start gap-2">
                    <span
                      className={`text-xs font-bold w-4 flex-shrink-0 mt-0.5 ${
                        alt.letter === q.correctAnswer
                          ? "text-green-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      {alt.letter}
                    </span>
                    <p
                      className={`text-xs leading-relaxed ${
                        alt.letter === q.correctAnswer
                          ? "text-foreground font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      {alt.text.length > 120 ? alt.text.slice(0, 120) + "..." : alt.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reset */}
      <div className="pt-4 border-t border-border/60 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Quer gerar uma nova prova com configurações diferentes?
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="text-xs border-border hover:border-primary/40"
        >
          Nova Prova
        </Button>
      </div>
    </div>
  );
}
