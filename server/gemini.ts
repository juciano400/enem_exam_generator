import { GoogleGenerativeAI } from "@google/generative-ai";

export interface Question {
  number: number;
  discipline: string;
  context?: string;
  statement: string;
  alternatives: {
    letter: "A" | "B" | "C" | "D" | "E";
    text: string;
  }[];
  correctAnswer: "A" | "B" | "C" | "D" | "E";
  explanation: string;
}

export interface GenerateQuestionsInput {
  discipline: string;
  questionCount: number;
  topics: string;
}

const DISCIPLINE_CONTEXT: Record<string, string> = {
  Literatura: "Literatura Brasileira e Portuguesa, análise literária, movimentos literários, interpretação de textos literários",
  Gramática: "Língua Portuguesa, gramática normativa, análise sintática, semântica, morfologia, ortografia, pontuação, concordância, regência",
  Arte: "Artes Visuais, Música, Teatro, Dança, história da arte, movimentos artísticos, linguagens artísticas",
  História: "História do Brasil e História Geral, fatos históricos, processos históricos, análise de documentos históricos",
  Sociologia: "Sociologia, teorias sociológicas, estrutura social, movimentos sociais, cultura, cidadania",
  Filosofia: "Filosofia, teorias filosóficas, ética, política, epistemologia, lógica, filósofos clássicos e contemporâneos",
};

export interface GenerateQuestionsFromMediaInput {
  mediaBase64: string;
  mimeType: string;
  questionCount: number;
  discipline: string;
}

export async function generateQuestionsFromMedia(
  input: GenerateQuestionsFromMediaInput
): Promise<Question[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const disciplineContext = DISCIPLINE_CONTEXT[input.discipline] || input.discipline;

  const prompt = `Você é um especialista em elaboração de questões no padrão ENEM (Exame Nacional do Ensino Médio) do Brasil.

Analise o conteúdo do material enviado (imagem ou PDF de páginas de livro/apostila) e gere exatamente ${input.questionCount} questões de múltipla escolha sobre ${input.discipline} (${disciplineContext}) baseadas exclusivamente no conteúdo desse material.

REGRAS OBRIGATÓRIAS:
1. As questões devem ser baseadas no conteúdo do material enviado
2. Cada questão deve seguir o padrão ENEM: contextualização, enunciado claro, 5 alternativas (A, B, C, D, E)
3. As questões devem exigir interpretação, análise crítica e raciocínio — não apenas memorização
4. Apenas UMA alternativa deve ser correta
5. As alternativas incorretas devem ser plausíveis (distratores bem elaborados)
6. A explicação deve ser detalhada, justificando por que a resposta correta está certa e as demais erradas

Retorne APENAS um JSON válido com o seguinte formato (sem markdown, sem texto extra):
{
  "questions": [
    {
      "number": 1,
      "discipline": "${input.discipline}",
      "context": "Trecho ou referência do material que embasa a questão",
      "statement": "Enunciado da questão",
      "alternatives": [
        { "letter": "A", "text": "Texto da alternativa A" },
        { "letter": "B", "text": "Texto da alternativa B" },
        { "letter": "C", "text": "Texto da alternativa C" },
        { "letter": "D", "text": "Texto da alternativa D" },
        { "letter": "E", "text": "Texto da alternativa E" }
      ],
      "correctAnswer": "A",
      "explanation": "Explicação detalhada da resposta correta e por que as demais estão erradas"
    }
  ]
}`;

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: input.mimeType,
        data: input.mediaBase64,
      },
    },
    prompt,
  ]);

  const text = result.response.text();
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return parsed.questions as Question[];
}

export async function generateQuestions(input: GenerateQuestionsInput): Promise<Question[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const disciplineContext = DISCIPLINE_CONTEXT[input.discipline] || input.discipline;

  const prompt = `Você é um especialista em elaboração de questões no padrão ENEM (Exame Nacional do Ensino Médio) do Brasil.

Gere exatamente ${input.questionCount} questões de múltipla escolha sobre ${input.discipline} (${disciplineContext}).

Conteúdos/assuntos a abordar: ${input.topics}

REGRAS OBRIGATÓRIAS:
1. Cada questão deve seguir rigorosamente o padrão ENEM: contextualização, enunciado claro, 5 alternativas (A, B, C, D, E)
2. As questões devem exigir interpretação, análise crítica e raciocínio — não apenas memorização
3. Apenas UMA alternativa deve ser correta
4. As alternativas incorretas devem ser plausíveis (distratores bem elaborados)
5. O contexto pode incluir textos, dados, citações ou situações-problema
6. A explicação deve ser detalhada, justificando por que a resposta correta está certa e as demais erradas

Retorne APENAS um JSON válido com o seguinte formato (sem markdown, sem texto extra):
{
  "questions": [
    {
      "number": 1,
      "discipline": "${input.discipline}",
      "context": "Texto de apoio ou contexto da questão (pode ser vazio se não houver)",
      "statement": "Enunciado da questão",
      "alternatives": [
        { "letter": "A", "text": "Texto da alternativa A" },
        { "letter": "B", "text": "Texto da alternativa B" },
        { "letter": "C", "text": "Texto da alternativa C" },
        { "letter": "D", "text": "Texto da alternativa D" },
        { "letter": "E", "text": "Texto da alternativa E" }
      ],
      "correctAnswer": "A",
      "explanation": "Explicação detalhada da resposta correta e por que as demais estão erradas"
    }
  ]
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Remove possíveis blocos markdown
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  const parsed = JSON.parse(cleaned);
  return parsed.questions as Question[];
}
