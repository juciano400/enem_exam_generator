#!/usr/bin/env python3
"""
inject_template.py — Injeta questões ENEM em um template .docx e converte para PDF.

Uso:
  python3 inject_template.py <template.docx> <questions.json> <output.docx> [--discipline "X"] [--count N]

O JSON de questões deve ter o formato:
[
  {
    "number": 1,
    "discipline": "Literatura",
    "context": "...",
    "statement": "...",
    "alternatives": [{"letter": "A", "text": "..."}, ...],
    "correctAnswer": "B",
    "explanation": "..."
  },
  ...
]
"""

import sys
import json
import copy
import os
import subprocess
import tempfile
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import re


def set_cell_text(cell, text: str, bold=False, font_size=10, color=None):
    """Substitui o texto de uma célula preservando a formatação básica."""
    for p in cell.paragraphs:
        for run in p.runs:
            run.text = ""
    # Usa o primeiro parágrafo
    p = cell.paragraphs[0] if cell.paragraphs else cell.add_paragraph()
    run = p.add_run(text)
    run.bold = bold
    run.font.size = Pt(font_size)
    if color:
        run.font.color.rgb = RGBColor(*color)


def add_question_paragraph(doc, text: str, bold=False, italic=False,
                             font_size=11, left_indent=0, space_before=0, space_after=4):
    """Adiciona um parágrafo de questão ao documento."""
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    if left_indent:
        p.paragraph_format.left_indent = Inches(left_indent)
    run = p.add_run(text)
    run.bold = bold
    run.italic = italic
    run.font.size = Pt(font_size)
    return p


def add_separator(doc):
    """Adiciona uma linha separadora entre questões."""
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    # Adiciona borda inferior via XML
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), '4')
    bottom.set(qn('w:space'), '1')
    bottom.set(qn('w:color'), 'CCCCCC')
    pBdr.append(bottom)
    pPr.append(pBdr)
    return p


def inject_questions(template_path: str, questions: list, output_path: str,
                     discipline: str = "", count: int = 0):
    doc = Document(template_path)

    # Atualiza campos da tabela de cabeçalho se existir
    if doc.tables:
        table = doc.tables[0]
        # Linha 0: DATA, TOTAL DE QUESTÕES, PESO, NOTA
        try:
            # Atualiza total de questões
            for ci in range(len(table.columns)):
                cell = table.cell(0, ci)
                if 'TOTAL DE QUESTÕES' in cell.text:
                    for p in cell.paragraphs:
                        for run in p.runs:
                            if 'TOTAL DE QUESTÕES' in run.text:
                                run.text = f'TOTAL DE QUESTÕES: {len(questions)}'
                            elif run.text.strip().isdigit():
                                run.text = ''
                    break
        except Exception:
            pass

        # Linha 2: DISCIPLINA
        try:
            for ci in range(len(table.columns)):
                cell = table.cell(2, ci)
                if 'COLOQUE A SUA DISCIPLINA AQUI' in cell.text or 'DISCIPLINA' in cell.text.upper():
                    for p in cell.paragraphs:
                        for run in p.runs:
                            if 'COLOQUE' in run.text or 'DISCIPLINA' in run.text.upper():
                                run.text = discipline.upper() if discipline else run.text
                    break
        except Exception:
            pass

    # Adiciona espaço antes das questões
    doc.add_paragraph()

    # Injeta cada questão
    for q in questions:
        num = q.get('number', '?')
        context = q.get('context', '').strip()
        statement = q.get('statement', '').strip()
        alternatives = q.get('alternatives', [])

        # Número da questão + enunciado (negrito)
        header_text = f"Questão {num}"
        p_header = doc.add_paragraph()
        p_header.paragraph_format.space_before = Pt(8)
        p_header.paragraph_format.space_after = Pt(2)
        run_num = p_header.add_run(f"{num}. ")
        run_num.bold = True
        run_num.font.size = Pt(11)
        run_num.font.color.rgb = RGBColor(0x1A, 0x3A, 0x6E)  # azul escuro

        # Contexto (se houver) — em itálico, recuado
        if context:
            p_ctx = doc.add_paragraph()
            p_ctx.paragraph_format.space_before = Pt(2)
            p_ctx.paragraph_format.space_after = Pt(4)
            p_ctx.paragraph_format.left_indent = Inches(0.3)
            # Linha vertical esquerda
            pPr = p_ctx._p.get_or_add_pPr()
            pBdr = OxmlElement('w:pBdr')
            left = OxmlElement('w:left')
            left.set(qn('w:val'), 'single')
            left.set(qn('w:sz'), '6')
            left.set(qn('w:space'), '4')
            left.set(qn('w:color'), '4472C4')
            pBdr.append(left)
            pPr.append(pBdr)
            run_ctx = p_ctx.add_run(context)
            run_ctx.italic = True
            run_ctx.font.size = Pt(10)
            run_ctx.font.color.rgb = RGBColor(0x44, 0x44, 0x55)

        # Enunciado
        p_stmt = doc.add_paragraph()
        p_stmt.paragraph_format.space_before = Pt(2)
        p_stmt.paragraph_format.space_after = Pt(6)
        p_stmt.paragraph_format.left_indent = Inches(0.2)
        run_stmt = p_stmt.add_run(statement)
        run_stmt.bold = True
        run_stmt.font.size = Pt(11)

        # Alternativas
        for alt in alternatives:
            letter = alt.get('letter', '?')
            text = alt.get('text', '').strip()
            p_alt = doc.add_paragraph()
            p_alt.paragraph_format.space_before = Pt(1)
            p_alt.paragraph_format.space_after = Pt(1)
            p_alt.paragraph_format.left_indent = Inches(0.4)
            run_letter = p_alt.add_run(f"({letter}) ")
            run_letter.bold = True
            run_letter.font.size = Pt(11)
            run_text = p_alt.add_run(text)
            run_text.font.size = Pt(11)

        # Separador
        add_separator(doc)

    doc.save(output_path)
    print(f"[OK] Documento salvo: {output_path}", file=sys.stderr)


def inject_gabarito(template_path: str, questions: list, output_path: str,
                    discipline: str = ""):
    """Gera o documento de gabarito usando o mesmo template."""
    doc = Document(template_path)

    # Atualiza cabeçalho
    if doc.tables:
        table = doc.tables[0]
        try:
            for ci in range(len(table.columns)):
                cell = table.cell(2, ci)
                if 'COLOQUE A SUA DISCIPLINA AQUI' in cell.text or 'DISCIPLINA' in cell.text.upper():
                    for p in cell.paragraphs:
                        for run in p.runs:
                            if 'COLOQUE' in run.text or 'DISCIPLINA' in run.text.upper():
                                run.text = f"{discipline.upper()} — GABARITO" if discipline else "GABARITO"
                    break
        except Exception:
            pass

    doc.add_paragraph()

    # Título do gabarito
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(4)
    p_title.paragraph_format.space_after = Pt(12)
    run_title = p_title.add_run("GABARITO E EXPLICAÇÕES")
    run_title.bold = True
    run_title.font.size = Pt(14)
    run_title.font.color.rgb = RGBColor(0x1A, 0x3A, 0x6E)
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # Resumo do gabarito em linha
    p_summary = doc.add_paragraph()
    p_summary.paragraph_format.space_after = Pt(12)
    p_summary.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for q in questions:
        run = p_summary.add_run(f"  {q['number']}:{q['correctAnswer']}  ")
        run.bold = True
        run.font.size = Pt(11)
        run.font.color.rgb = RGBColor(0x1A, 0x3A, 0x6E)

    add_separator(doc)

    # Detalhes por questão
    for q in questions:
        num = q.get('number', '?')
        statement = q.get('statement', '').strip()
        correct = q.get('correctAnswer', '?')
        explanation = q.get('explanation', '').strip()

        # Cabeçalho da questão
        p_h = doc.add_paragraph()
        p_h.paragraph_format.space_before = Pt(8)
        p_h.paragraph_format.space_after = Pt(2)
        run_n = p_h.add_run(f"Questão {num} ")
        run_n.bold = True
        run_n.font.size = Pt(11)
        run_n.font.color.rgb = RGBColor(0x1A, 0x3A, 0x6E)
        run_ans = p_h.add_run(f"→ Resposta: {correct}")
        run_ans.bold = True
        run_ans.font.size = Pt(11)
        run_ans.font.color.rgb = RGBColor(0x0A, 0x7A, 0x2A)  # verde

        # Enunciado resumido
        stmt_short = statement[:150] + "..." if len(statement) > 150 else statement
        p_stmt = doc.add_paragraph()
        p_stmt.paragraph_format.left_indent = Inches(0.2)
        p_stmt.paragraph_format.space_after = Pt(4)
        run_stmt = p_stmt.add_run(stmt_short)
        run_stmt.italic = True
        run_stmt.font.size = Pt(10)
        run_stmt.font.color.rgb = RGBColor(0x55, 0x55, 0x66)

        # Explicação
        p_exp_label = doc.add_paragraph()
        p_exp_label.paragraph_format.left_indent = Inches(0.2)
        p_exp_label.paragraph_format.space_after = Pt(2)
        run_label = p_exp_label.add_run("Explicação: ")
        run_label.bold = True
        run_label.font.size = Pt(10)

        p_exp = doc.add_paragraph()
        p_exp.paragraph_format.left_indent = Inches(0.3)
        p_exp.paragraph_format.space_after = Pt(4)
        run_exp = p_exp.add_run(explanation)
        run_exp.font.size = Pt(10)

        add_separator(doc)

    doc.save(output_path)
    print(f"[OK] Gabarito salvo: {output_path}", file=sys.stderr)


def convert_to_pdf(docx_path: str, pdf_dir: str) -> str:
    """Converte .docx para .pdf usando LibreOffice headless."""
    result = subprocess.run(
        ['libreoffice', '--headless', '--convert-to', 'pdf',
         '--outdir', pdf_dir, docx_path],
        capture_output=True, text=True, timeout=60
    )
    if result.returncode != 0:
        raise RuntimeError(f"LibreOffice error: {result.stderr}")
    base = os.path.splitext(os.path.basename(docx_path))[0]
    pdf_path = os.path.join(pdf_dir, base + '.pdf')
    if not os.path.exists(pdf_path):
        raise RuntimeError(f"PDF não encontrado em {pdf_path}")
    return pdf_path


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('template', help='Caminho do template .docx')
    parser.add_argument('questions_json', help='Caminho do JSON com questões')
    parser.add_argument('output_docx', help='Caminho de saída do .docx preenchido')
    parser.add_argument('--discipline', default='', help='Nome da disciplina')
    parser.add_argument('--gabarito', action='store_true', help='Gerar gabarito em vez da prova')
    parser.add_argument('--to-pdf', action='store_true', help='Converter para PDF após gerar')
    args = parser.parse_args()

    with open(args.questions_json, 'r', encoding='utf-8') as f:
        questions = json.load(f)

    if args.gabarito:
        inject_gabarito(args.template, questions, args.output_docx, args.discipline)
    else:
        inject_questions(args.template, questions, args.output_docx, args.discipline)

    if args.to_pdf:
        out_dir = os.path.dirname(os.path.abspath(args.output_docx))
        pdf_path = convert_to_pdf(args.output_docx, out_dir)
        print(pdf_path)
    else:
        print(args.output_docx)
