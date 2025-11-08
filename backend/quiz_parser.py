# quiz_parser.py
# Біріктірілген нұсқа:
# 1) Жоғарғы бөліктен сұрақтар мен нұсқаларды regex арқылы бөліп алады.
# 2) Соңындағы кесте/блоктан "1)A" стиліндегі жауаптарды оқиды.
# 3) Әр сұраққа answer_index орнатады.

from __future__ import annotations
import re
from typing import List, Dict, Any, Optional
from docx2python import docx2python

# ──────────────────────────────────────────────
# Regex үлгілері (сұрақ/нұсқа үшін — бұрынғы дұрыс логика)
# ──────────────────────────────────────────────

# "1.", "1)", "(1)" сияқты нөмір
_QUESTION_BLOCK_RE = re.compile(r"(\d+[).])\s*(.+?)(?=(\d+[).])|$)", re.DOTALL)

# Барлық әліпби (латын + кирилл, қазақ әріптері)
_LABEL_CLASS = r'A-Za-zА-Яа-яЁёӘәІіҢңҒғҮүҰұҚқҺһӨө'

# "A) Мәтін", "Б) Мәтін" т.б. бір блок ішіндегі опциялар
_OPTION_BLOCK_RE = re.compile(
    rf'(?:^|\s)([{_LABEL_CLASS}])\)\s*(.*?)(?=(?:\s[{_LABEL_CLASS}]\))|$)',
    re.DOTALL
)

# ──────────────────────────────────────────────
# Regex (жауап кестесін оқу үшін — answers.py логикасы)
# ──────────────────────────────────────────────

# "1)A", "10) B" т.б. (бір жолда бірнешеу болуы мүмкін)
ANSWER_PAIR_RE = re.compile(r'(\d{1,3})\)\s*([A-D])', re.IGNORECASE)

# Таза "1)A" тұрған жол
ANSWER_LINE_RE = re.compile(r'^\s*(\d{1,3})\)\s*([A-D])\s*$')


# ──────────────────────────────────────────────
# Көмекші функциялар
# ──────────────────────────────────────────────

def _clean_text(text: str) -> str:
    text = (text or "").replace("\xa0", " ")
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"\n{2,}", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def _extract_lines_from_body(doc) -> List[str]:
    """
    doc.body ішіндегі барлық мәтінді сызықтық тізімге айналдырамыз.
    Кестелер де, абзацтар да ретін сақтайды.
    """
    lines: List[str] = []

    # docx2python.body: [page][table][row][cell]
    for first in doc.body:
        for second in first:
            for third in second:
                for cell in third:
                    if cell is None:
                        continue
                    text = str(cell)
                    parts = re.split(r'[\n\r\t]+', text)
                    for p in parts:
                        s = p.strip()
                        if s:
                            lines.append(s)

    return lines


def _detect_answer_start_index(lines: List[str]) -> int:
    """
    Жауаптар басталатын шамамен индексті табу.
    1) Бір жолда 2+ "N)A" болса → жауаптар осы жерден.
    2) Тізбектелген "N)A" жолдары (вертикаль) болса → сол жер.
    Табылмаса → len(lines) (жеке жауап блогы жоқ деп есептейміз).
    """
    n = len(lines)

    # Бір жолда бірнеше жұп
    for i, line in enumerate(lines):
        if len(ANSWER_PAIR_RE.findall(line)) >= 2:
            return i

    # Вертикалды тізім
    run_start: Optional[int] = None
    for i, line in enumerate(lines):
        if ANSWER_LINE_RE.match(line):
            if run_start is None:
                run_start = i
        else:
            if run_start is not None:
                if i - run_start >= 2:
                    return run_start
                run_start = None

    if run_start is not None and n - run_start >= 2:
        return run_start

    return n


def _parse_answers(lines: List[str], start: int, max_q: int) -> Dict[int, str]:
    """
    start..соңына дейінгі аймақтан "N)A" жауаптарын жинау.
    Тек 1..max_q диапазонын аламыз.
    """
    answers: Dict[int, str] = {}

    for line in lines[start:]:
        for num_str, letter in ANSWER_PAIR_RE.findall(line):
            num = int(num_str)
            if 1 <= num <= max_q:
                answers[num] = letter.upper()

    return answers


# ──────────────────────────────────────────────
# Негізгі біріктірілген парсер
# ──────────────────────────────────────────────

def process_docx(docx_path: str, debug: bool = False) -> List[Dict[str, Any]]:
    """
    Бір DOCX файлын оқиды:
      1) Толық текст арқылы сұрақтар мен нұсқаларды бөледі
         (quiz_parser-дағы дұрыс логика негізінде).
      2) doc.body арқылы кесте/блоктан "N)A" стильді жауаптарды оқиды.
      3) Нөмірі бойынша match жасап, answer_index-ті толтырады.

    Қайтарады:
      [
        {
          "number": int,
          "question": str,
          "options": [ "A) ...", "B) ...", ... ],
          "answer_index": Optional[int],
        },
        ...
      ]
    """
    doc = docx2python(docx_path)

    # 1️⃣ Сұрақтар мен нұсқаларды TEXT арқылы алу
    text = _clean_text(doc.text)
    matches = _QUESTION_BLOCK_RE.findall(text)

    questions: List[Dict[str, Any]] = []

    for num_str, block, _ in matches:
        block = (block or "").strip()
        if not block:
            continue

        # Сұрақ нөмірін алу ("1)" → 1)
        num_digits = re.findall(r'\d+', num_str)
        if num_digits:
            q_number = int(num_digits[0])
        else:
            q_number = len(questions) + 1  # fallback

        # Сұрақ мәтіні: бірінші опция басталғанға дейінгі бөлік
        q_split = re.split(rf'\s[{_LABEL_CLASS}]\)', block, maxsplit=1)
        question_text = q_split[0].strip()

        # Опциялар: блок ішіндегі A) .. B) .. т.б.
        options_found = _OPTION_BLOCK_RE.findall(block)
        formatted_options: List[str] = []
        for label, opt in options_found:
            clean_opt = re.sub(r'\s+', ' ', opt.replace('\n', ' ')).strip()
            if clean_opt:
                formatted_options.append(f"{label}) {clean_opt}")

        if not question_text or len(formatted_options) < 2:
            # Қоқысты өткізіп жібереміз
            continue

        questions.append(
            {
                "number": q_number,
                "question": question_text,
                "options": formatted_options,
                "answer_index": None,
            }
        )

    if not questions:
        if debug:
            print("[parser] Сұрақ табылмады. DOCX форматын тексер.")
        return []

    # 2️⃣ Жауаптарды BODY арқылы оқу (кестелерді қоса)
    lines = _extract_lines_from_body(doc)

    if debug:
        print("---- BODY LINES ----")
        for i, ln in enumerate(lines):
            print(f"{i:03}: {ln}")
        print("--------")

    ans_start = _detect_answer_start_index(lines)
    max_q = max(q["number"] for q in questions)
    answers = {}
    if ans_start < len(lines):
        answers = _parse_answers(lines, ans_start, max_q)

    # 3️⃣ Жауаптарды сұрақтарға байлау
    for q in questions:
        num = q["number"]
        letter = answers.get(num)
        if not letter:
            q["answer_index"] = None
            continue

        idx = None
        for i, opt in enumerate(q["options"]):
            if opt.lstrip().upper().startswith(f"{letter})"):
                idx = i
                break

        q["answer_index"] = idx

    if debug:
        print(f"[parser] Parsed {len(questions)} questions with answers from {docx_path}")
        for q in questions:
            print(q)

    return questions
