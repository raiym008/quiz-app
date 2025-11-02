# quiz_parser.py
# DOCX → [{question, options, answer_index, meta}] қайтарушы қарапайым regex-парсер.
# Негізделген бұрынғы файлға, бірақ опция мен сұрақ анықтау жүйесі күшейтілді.

from __future__ import annotations
import re
from typing import List, Optional, Dict, Any
from docx2python import docx2python

# ───────────────────────────────────────────────────────────
# Regex үлгілер (жетілдірілген)
# ───────────────────────────────────────────────────────────

# 1) Нөмірленген: "1.", "1)", "(1)" — сұрақ басталуы
_QUESTION_NUM = re.compile(r'^\s*(?:\(?\d+\)?[\.\)]\s*)')

# 2) Маркерленген: "-", "•"
_QUESTION_BULLET = re.compile(r'^\s*[-•]\s+')

# 3) Q-тегтері: "Q:", "Q)", "Q."
_QUESTION_QTAG = re.compile(r'^\s*Q[\:\.\)]\s*', re.IGNORECASE)

# 4) Опциялар: "A)", "a)", "B)", "b)", "Ә)", т.б. — барлық әліпби қолдау
_LABEL_CLASS = r'A-Za-zА-Яа-яЁёӘәІіҢңҒғҮүҰұҚқҺһӨө'
_OPTION_BLOCK = re.compile(
    rf'(?:^|\s)([{_LABEL_CLASS}])\)\s*(.*?)(?=(?:\s[{_LABEL_CLASS}]\))|$)',
    re.DOTALL
)

# ───────────────────────────────────────────────────────────
# Көмекші функциялар
# ───────────────────────────────────────────────────────────

def _clean_text(text: str) -> str:
    """DOCX-тағы артық ентер мен бос орындарды ықшамдау."""
    text = (text or "").replace('\xa0', ' ')
    text = re.sub(r'\r\n?', '\n', text)
    text = re.sub(r'\n{2,}', '\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()


def _is_question_start(line: str) -> bool:
    """Берілген жол сұрақтың басталуы ма — соны анықтау."""
    if not line:
        return False
    s = line.strip()
    if s == "":
        return False
    if _QUESTION_NUM.match(s):
        return True
    if _QUESTION_BULLET.match(s):
        return True
    if _QUESTION_QTAG.match(s):
        return True
    # Егер сұрақ белгісімен аяқталып, опция болмаса — сұрақ
    if s.endswith("?") and not re.match(rf'^\s*[{_LABEL_CLASS}]\)', s):
        return True
    return False


# ───────────────────────────────────────────────────────────
# Негізгі парсер функциясы
# ───────────────────────────────────────────────────────────

def process_docx(docx_path: str, debug: bool = False) -> List[Dict[str, Any]]:
    """
    DOCX ішіндегі сұрақтар мен опцияларды анықтайды.
    Қайтарады: List[dict(question, options, answer_index=None, meta)]
    """
    document = docx2python(docx_path)
    raw_text = document.text
    text = _clean_text(raw_text)

    # Сұрақ блоктарына бөлу (1), 1., (1) және т.б.)
    pattern = r"(\d+[).])\s*(.+?)(?=(\d+[).])|$)"
    matches = re.findall(pattern, text, flags=re.DOTALL)

    blocks: List[dict] = []

    for _, block, _ in matches:
        block = block.strip()

        # 1️⃣ Сұрақ мәтінін анықтау
        q_split = re.split(rf'\s[{_LABEL_CLASS}]\)', block, maxsplit=1)
        question_text = q_split[0].strip()

        # 2️⃣ Опцияларды алу
        options_found = _OPTION_BLOCK.findall(block)
        formatted_options: List[str] = []
        for label, opt in options_found:
            clean_opt = opt.replace('\n', ' ').strip()
            formatted_options.append(f"{label}) {clean_opt}")

        # 3️⃣ Нәтиже тізіміне қосу
        blocks.append({
            "question": question_text,
            "options": formatted_options,
            "answer_index": None,
            "meta": {"source": "quiz_parser"}
        })

    if debug:
        print(f"[quiz_parser] Parsed {len(blocks)} questions from {docx_path}")

    return blocks
