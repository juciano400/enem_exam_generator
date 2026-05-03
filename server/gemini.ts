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

function extractQuestions(text: string): Question[] {
  // Strip markdown fences
  let cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  // Extract the outermost JSON object if there's surrounding text
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) cleaned = match[0];

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed.questions)) throw new Error("Campo 'questions' ausente ou inválido");
  return parsed.questions as Question[];
}

export async function generateQuestionsFromMedia(
  input: GenerateQuestionsFromMediaInput
): Promise<Question[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" } as any,
  });

  const disciplineContext = DISCIPLINE_CONTEXT[input.discipline] || input.discipline;

  const prompt = `Você é um professor examinador sênior do ENEM (Exame Nacional do Ensino Médio) do Brasil, com expertise em ${input.discipline} (${disciplineContext}).

Analise DETALHADAMENTE o material enviado (imagem ou PDF de livro/apostila) e elabore EXATAMENTE ${input.questionCount} questões de múltipla escolha baseadas nos conceitos, trechos e conteúdos presentes nesse material.

CRITÉRIOS DE QUALIDADE OBRIGATÓRIOS:

▸ TEXTO DE APOIO (campo "context"):
  - Extraia ou adapte trechos reais do material enviado
  - Use dados, citações, definições ou situações presentes no conteúdo
  - O contexto deve ser indispensável para responder a questão (não decorativo)
  - Mínimo de 2 frases completas

▸ ENUNCIADO (campo "statement"):
  - Use verbos de raciocínio: analise, identifique, relacione, compare, explique, deduza, infira
  - Formule como situação-problema ou pedido de análise — nunca "O que é X?"
  - O enunciado deve ser diretamente dependente do texto de apoio

▸ ALTERNATIVAS (5 por questão — A a E):
  - Apenas UMA correta; quatro distratores plausíveis e tecnicamente elaborados
  - Distratores devem representar equívocos conceituais reais ou generalizações indevidas
  - Comprimento similar entre todas as alternativas (evitar dicas visuais)
  - Proibido: "todas as anteriores", "nenhuma das anteriores", alternativas absurdas

▸ DIFICULDADE: 40% médias, 60% difíceis — nenhuma questão de memorização pura

▸ EXPLICAÇÃO (campo "explanation"):
  - Por que a resposta correta está certa (fundamentação teórica)
  - Por que cada distrator está errado (análise individual dos erros)

Retorne APENAS JSON válido (sem markdown, sem texto extra):
{
  "questions": [
    {
      "number": 1,
      "discipline": "${input.discipline}",
      "context": "Trecho ou situação extraída do material que embasa a questão",
      "statement": "Enunciado que exige análise ou interpretação",
      "alternatives": [
        { "letter": "A", "text": "Alternativa A" },
        { "letter": "B", "text": "Alternativa B" },
        { "letter": "C", "text": "Alternativa C" },
        { "letter": "D", "text": "Alternativa D" },
        { "letter": "E", "text": "Alternativa E" }
      ],
      "correctAnswer": "A",
      "explanation": "Justificativa completa da resposta correta e análise dos distratores"
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

  return extractQuestions(result.response.text());
}

export async function generateQuestions(input: GenerateQuestionsInput): Promise<Question[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" } as any,
  });

  const disciplineContext = DISCIPLINE_CONTEXT[input.discipline] || input.discipline;

  const prompt = `Você é um professor examinador sênior do ENEM (Exame Nacional do Ensino Médio) do Brasil, com especialização em ${input.discipline} (${disciplineContext}).

Elabore EXATAMENTE ${input.questionCount} questões de múltipla escolha no padrão ENEM sobre os seguintes conteúdos: ${input.topics}

CRITÉRIOS DE QUALIDADE OBRIGATÓRIOS:

▸ TEXTO DE APOIO (campo "context") — OBRIGATÓRIO em todas as questões:
  Escolha UM dos seguintes formatos conforme o conteúdo:
  • Trecho literário, filosófico, sociológico ou histórico (com autor e obra entre parênteses)
  • Dado estatístico real, porcentagem ou índice com fonte
  • Notícia ou reportagem resumida com tema atual e relevante
  • Citação de lei, decreto ou documento oficial
  • Situação-problema do cotidiano que contextualiza o conceito
  O contexto deve ser INDISPENSÁVEL para resolver a questão — nunca decorativo.

▸ ENUNCIADO (campo "statement"):
  • Use verbos de ordem superior: analise, relacione, compare, identifique, infira, deduza, avalie, interprete
  • Formule como situação-problema ou pedido de análise crítica
  • Proibido perguntas diretas do tipo "O que é X?" ou "Quem foi Y?"
  • O enunciado deve conectar o texto de apoio ao conceito cobrado

▸ ALTERNATIVAS (A a E — 5 por questão):
  • UMA correta; quatro distratores tecnicamente elaborados
  • Distratores = erros conceituais reais, generalizações indevidas ou confusões terminológicas
  • Todas com comprimento similar (evitar dicas visuais)
  • Proibido: "todas as anteriores", "nenhuma das anteriores", alternativas absurdas ou claramente erradas

▸ DIFICULDADE: 30% médias, 70% difíceis — zero questões de memorização pura

▸ EXPLICAÇÃO (campo "explanation") — mínimo 3 frases:
  • Fundamente teoricamente por que a resposta correta está certa
  • Explique individualmente o erro de cada distrator
  • Relacione com o conteúdo cobrado

Retorne APENAS JSON válido (sem markdown, sem texto extra):
{
  "questions": [
    {
      "number": 1,
      "discipline": "${input.discipline}",
      "context": "Texto de apoio rico e relevante",
      "statement": "Enunciado que exige análise crítica ou raciocínio",
      "alternatives": [
        { "letter": "A", "text": "Alternativa A" },
        { "letter": "B", "text": "Alternativa B" },
        { "letter": "C", "text": "Alternativa C" },
        { "letter": "D", "text": "Alternativa D" },
        { "letter": "E", "text": "Alternativa E" }
      ],
      "correctAnswer": "A",
      "explanation": "Justificativa completa da resposta correta e análise de cada distrator"
    }
  ]
}`;

  const result = await model.generateContent(prompt);
  return extractQuestions(result.response.text());
}
