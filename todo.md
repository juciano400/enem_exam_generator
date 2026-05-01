# ENEM Exam Generator - TODO

## Backend
- [x] Schema do banco: tabela `exams` para histórico de provas geradas
- [x] Migration e aplicação do schema no banco
- [x] Secret GEMINI_API_KEY configurado via webdev_request_secrets
- [x] Instalar dependência `pdf-lib` e `@google/generative-ai` no projeto
- [x] Procedure `exam.generate`: recebe disciplina, quantidade e conteúdos, chama Gemini e retorna questões estruturadas
- [x] Procedure `exam.generatePDF`: gera PDF da prova (enunciados + alternativas + folha de resposta)
- [x] Procedure `exam.generateAnswerPDF`: gera PDF do gabarito com explicações
- [x] Salvar prova gerada no banco (histórico)

## Frontend
- [x] Design system: paleta elegante, tipografia refinada (fonte serif para títulos, sans para corpo)
- [x] Página Home: hero minimalista com CTA para gerar prova
- [x] Formulário de geração: disciplina (select), quantidade (slider/input), conteúdos (textarea)
- [x] Estado de loading com animação elegante durante geração
- [x] Tela de resultado: cards de download (PDF Prova e PDF Gabarito)
- [x] Responsividade mobile

## Qualidade
- [x] Testes vitest para procedure de geração
- [x] Tratamento de erros (Gemini indisponível, limite de questões, etc.)
