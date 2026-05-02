import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

const DISCIPLINES = [
  "Literatura",
  "Gramática",
  "Arte",
  "História",
  "Sociologia",
  "Filosofia",
] as const;

type Discipline = (typeof DISCIPLINES)[number];

export interface ExamFormValues {
  discipline: Discipline;
  questionCount: number;
  topics: string;
  serie?: string;
  turma?: string;
  templateFile?: File;
  useTemplate: boolean;
}

interface ExamFormProps {
  onGenerate: (values: ExamFormValues) => void;
}

const TOPIC_SUGGESTIONS: Record<Discipline, string> = {
  Literatura: "Modernismo brasileiro, Machado de Assis, Realismo, poesia concreta",
  Gramática: "Concordância verbal e nominal, regência, pontuação, análise sintática",
  Arte: "Arte moderna brasileira, Semana de 22, Barroco, impressionismo",
  História: "Ditadura Militar, Era Vargas, Independência do Brasil, Segunda Guerra Mundial",
  Sociologia: "Movimentos sociais, desigualdade social, cultura e identidade, cidadania",
  Filosofia: "Ética de Aristóteles, Iluminismo, existencialismo, filosofia política",
};

export default function ExamForm({ onGenerate }: ExamFormProps) {
  const [mode, setMode] = useState<"enem" | "template">("enem");
  const [discipline, setDiscipline] = useState<Discipline | "">("");
  const [questionCount, setQuestionCount] = useState(10);
  const [topics, setTopics] = useState("");
  const [serie, setSerie] = useState("");
  const [turma, setTurma] = useState("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDisciplineChange(value: string) {
    setDiscipline(value as Discipline);
    if (value && !topics) {
      setTopics(TOPIC_SUGGESTIONS[value as Discipline] || "");
    }
    setErrors((e) => ({ ...e, discipline: "" }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".docx")) {
      setErrors((err) => ({ ...err, template: "Apenas arquivos .docx são aceitos." }));
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setErrors((err) => ({ ...err, template: "O arquivo deve ter no máximo 20 MB." }));
      return;
    }
    setTemplateFile(file);
    setErrors((err) => ({ ...err, template: "" }));
  }

  function handleDropZoneClick() {
    fileInputRef.current?.click();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".docx")) {
      setErrors((err) => ({ ...err, template: "Apenas arquivos .docx são aceitos." }));
      return;
    }
    setTemplateFile(file);
    setErrors((err) => ({ ...err, template: "" }));
  }

  function validate() {
    const newErrors: Record<string, string> = {};
    if (!discipline) newErrors.discipline = "Selecione uma disciplina";
    if (!topics.trim() || topics.trim().length < 5)
      newErrors.topics = "Descreva os conteúdos (mínimo 5 caracteres)";
    if (mode === "template" && !templateFile)
      newErrors.template = "Faça o upload do seu template .docx";
    return newErrors;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onGenerate({
      discipline: discipline as Discipline,
      questionCount,
      topics,
      serie: serie.trim() || undefined,
      turma: turma.trim() || undefined,
      templateFile: templateFile ?? undefined,
      useTemplate: mode === "template",
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Mode toggle */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-foreground">Formato da prova</Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode("enem")}
            className={`relative rounded-xl border p-4 text-left transition-all ${
              mode === "enem"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-card hover:border-primary/30"
            }`}
          >
            {mode === "enem" && (
              <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary" />
            )}
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-4 h-4 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Padrão ENEM</p>
                <p className="text-xs text-muted-foreground">Layout oficial gerado automaticamente</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMode("template")}
            className={`relative rounded-xl border p-4 text-left transition-all ${
              mode === "template"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-card hover:border-primary/30"
            }`}
          >
            {mode === "template" && (
              <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary" />
            )}
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-4 h-4 text-amber-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Meu Template</p>
                <p className="text-xs text-muted-foreground">Use seu modelo .docx personalizado</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Template upload (only when mode === "template") */}
      {mode === "template" && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Template Word (.docx)
          </Label>
          <div
            onClick={handleDropZoneClick}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className={`relative rounded-xl border-2 border-dashed cursor-pointer transition-colors p-6 text-center ${
              errors.template
                ? "border-destructive bg-destructive/5"
                : templateFile
                ? "border-primary/50 bg-primary/5"
                : "border-border hover:border-primary/40 hover:bg-muted/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
              className="hidden"
            />
            {templateFile ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">{templateFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(templateFile.size / 1024).toFixed(0)} KB · Clique para trocar
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTemplateFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mx-auto">
                  <svg
                    className="w-5 h-5 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                    />
                  </svg>
                </div>
                <p className="text-sm text-foreground font-medium">
                  Arraste o arquivo ou clique para selecionar
                </p>
                <p className="text-xs text-muted-foreground">
                  Formato .docx · Máximo 20 MB · Cabeçalho, logo e rodapé serão preservados
                </p>
              </div>
            )}
          </div>
          {errors.template && (
            <p className="text-xs text-destructive">{errors.template}</p>
          )}
        </div>
      )}

      {/* Main fields grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Left column */}
        <div className="space-y-8">
          {/* Discipline */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Disciplina</Label>
            <Select value={discipline} onValueChange={handleDisciplineChange}>
              <SelectTrigger
                className={`h-11 bg-card border-border text-foreground ${
                  errors.discipline ? "border-destructive" : ""
                }`}
              >
                <SelectValue placeholder="Selecione a disciplina..." />
              </SelectTrigger>
              <SelectContent>
                {DISCIPLINES.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.discipline && (
              <p className="text-xs text-destructive">{errors.discipline}</p>
            )}
          </div>

          {/* Question count */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-foreground">
                Quantidade de questões
              </Label>
              <span
                className="text-2xl font-bold text-primary tabular-nums"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {questionCount}
              </span>
            </div>
            <Slider
              min={5}
              max={45}
              step={5}
              value={[questionCount]}
              onValueChange={([v]) => setQuestionCount(v)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>5 questões</span>
              <span>45 questões</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 20, 45].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setQuestionCount(n)}
                  className={`text-xs py-1.5 rounded-md border transition-colors ${
                    questionCount === n
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Série / Turma */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                Série <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                value={serie}
                onChange={(e) => setSerie(e.target.value)}
                placeholder="Ex: 3ª série"
                maxLength={50}
                className="h-10 bg-card border-border text-foreground placeholder:text-muted-foreground/60"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                Turma <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                value={turma}
                onChange={(e) => setTurma(e.target.value)}
                placeholder="Ex: Turma A"
                maxLength={50}
                className="h-10 bg-card border-border text-foreground placeholder:text-muted-foreground/60"
              />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-8">
          {/* Topics */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              Conteúdos e assuntos
            </Label>
            <Textarea
              value={topics}
              onChange={(e) => {
                setTopics(e.target.value);
                setErrors((err) => ({ ...err, topics: "" }));
              }}
              placeholder="Ex: Modernismo brasileiro, Semana de Arte Moderna de 1922, principais autores e obras..."
              className={`min-h-[140px] bg-card border-border text-foreground placeholder:text-muted-foreground/60 resize-none leading-relaxed ${
                errors.topics ? "border-destructive" : ""
              }`}
            />
            {errors.topics ? (
              <p className="text-xs text-destructive">{errors.topics}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Seja específico para obter questões mais precisas e contextualizadas.
              </p>
            )}
          </div>

          {/* Summary + Submit */}
          <div className="space-y-4">
            {discipline && (
              <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-1">
                <p className="text-xs font-medium text-foreground">Resumo da prova</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{questionCount} questões</span> de{" "}
                  <span className="font-medium text-foreground">{discipline}</span>
                  {mode === "enem" ? " · padrão ENEM" : " · template personalizado"}
                </p>
                <p className="text-xs text-muted-foreground">
                  2 PDFs: prova{mode === "template" ? " no seu template" : ""} + gabarito com explicações
                </p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Gerar Prova
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
