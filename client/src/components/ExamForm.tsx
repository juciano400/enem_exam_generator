import { useState } from "react";
import { Button } from "@/components/ui/button";
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

interface ExamFormProps {
  onGenerate: (values: {
    discipline: Discipline;
    questionCount: number;
    topics: string;
  }) => void;
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
  const [discipline, setDiscipline] = useState<Discipline | "">("");
  const [questionCount, setQuestionCount] = useState(10);
  const [topics, setTopics] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleDisciplineChange(value: string) {
    setDiscipline(value as Discipline);
    if (value && !topics) {
      setTopics(TOPIC_SUGGESTIONS[value as Discipline] || "");
    }
    setErrors((e) => ({ ...e, discipline: "" }));
  }

  function validate() {
    const newErrors: Record<string, string> = {};
    if (!discipline) newErrors.discipline = "Selecione uma disciplina";
    if (!topics.trim() || topics.trim().length < 5)
      newErrors.topics = "Descreva os conteúdos (mínimo 5 caracteres)";
    return newErrors;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onGenerate({ discipline: discipline as Discipline, questionCount, topics });
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-10">
      {/* Left column */}
      <div className="space-y-8">
        {/* Discipline */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">
            Disciplina
          </Label>
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
                <span className="font-medium text-foreground">{discipline}</span> no padrão ENEM
              </p>
              <p className="text-xs text-muted-foreground">
                2 PDFs gerados: prova + folha de resposta e gabarito com explicações
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
    </form>
  );
}
