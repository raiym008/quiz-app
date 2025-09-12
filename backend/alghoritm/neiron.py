# neiron.py
# ------------------------------------------------------------
# Мақсаты:
#   Regex-пен бөлінбей қалған немесе күмәнді жолдарды
#   "сұрақ/нұсқа/жауап" құрылымына эвристика арқылы топтастыру.
#
# Нәтиже форматы (regex_parser-пен үйлесімді):
#   [
#     {
#       "question": str,
#       "options": [str, ...],
#       "answer_index": Optional[int],
#       "answer_label": Optional[str],
#       "answer_text": Optional[str],
#       "meta": {
#          "labels": [Optional[str], ...],
#          "answer_lines": [str, ...],
#          "source": "neiron-heuristic"
#       }
#     },
#     ...
#   ]
#
# Ескерту:
#  - Бұл бастапқы эвристикалық ядро. Кейін дәл осы интерфейске
#    PyTorch моделін "drop-in replacement" етіп қоясың:
#      → classify_line(line) ішіне model.predict(...) ендіресің.
# ------------------------------------------------------------

from __future__ import annotations
from typing import List, Dict, Optional, Tuple
import re

# ----- Үлгілер -----

LABEL_CHARS = "A-Za-zА-Яа-яӘәІіҢңҒғҮүҰұҚқӨө"
RE_OPTION_LABELED = re.compile(rf"^\s*((?:[{LABEL_CHARS}])|\d{{1,2}})\s*[\.\)]\s+(?P<text>.+)$")
RE_BULLET = re.compile(r"^\s*[-•—]\s+(?P<text>.+)$")
RE_ANSWER_LINE = re.compile(
    r"(?i)\b(дұрыс\s*жауап|жауабы|дұрыс|answer|correct|правильн(?:ый)?\s*ответ|ответ)\b\s*[:\-]?\s*(?P<ans>.+)$"
)
RE_INLINE_CORRECT_MARK = re.compile(r"(\*|\(✓\)|\[correct\]|\[true\]|\(true\))", re.IGNORECASE)

# Бір қатарда бірнеше нұсқа болғанда (a) ... b) ... c) ...) кесуге арналған
RE_INLINE_LABEL = re.compile(rf"(?P<label>(?:[{LABEL_CHARS}])|\d{{1,2}})\s*[\.\)]\s+")

# Сұрақ индикаторлары (қазақ/орыс/ағылш.)
QUESTION_TOKENS = [
    # Kazakh
    "қалай", "қашан", "қайда", "қайсы", "қай", "қандай", "қанша", "неше", "неге", "не", "кім",
    # Russian
    "кто", "что", "сколько", "где", "когда", "почему", "зачем", "какой", "какая", "какие", "верно ли", "укажите", "выберите",
    # English
    "what", "who", "when", "where", "why", "how", "which", "select", "choose", "true or false"
]

# ----- Көмекші функциялар -----

def _normalize_space(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()

def _strip_inline_correct_marks(s: str) -> Tuple[str, bool]:
    if RE_INLINE_CORRECT_MARK.search(s):
        s2 = RE_INLINE_CORRECT_MARK.sub("", s)
        return _normalize_space(s2), True
    return s, False

def _split_inline_options(line: str) -> List[Tuple[Optional[str], str]]:
    """
    Бір қатарда бірнеше нұсқа болса, [(label, text), ...] түрінде бөледі.
    label None болуы да мүмкін (сирек).
    """
    matches = list(RE_INLINE_LABEL.finditer(line))
    if len(matches) <= 1:
        return []
    out: List[Tuple[Optional[str], str]] = []
    for i, m in enumerate(matches):
        label = m.group("label")
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(line)
        text = _normalize_space(line[start:end])
        out.append((label, text))
    return out

def _score_question(line: str) -> int:
    """Сұрақ болу ықтималдығын шамалап бағалау (балл)."""
    s = line.lower()
    score = 0
    if "?" in s or s.endswith("?"):
        score += 3
    # Кілт сөздер
    for tok in QUESTION_TOKENS:
        if tok in s:
            score += 1
    # Ұзындау сөйлемдер жиі сұрақ болады (бірақ шектен асырмайық)
    words = len(s.split())
    if words >= 6:
        score += 1
    # Явный опция белгісіне ұқсаса – азайтамыз
    if RE_OPTION_LABELED.match(line) or RE_BULLET.match(line):
        score -= 3
    return score

def _score_option(line: str) -> int:
    """Нұсқа болу ықтималдығын бағалау (балл)."""
    score = 0
    if RE_OPTION_LABELED.match(line):
        score += 4
    if RE_BULLET.match(line):
        score += 3
    # Қысқалау фразалар – жиі нұсқа
    words = len(line.split())
    if 1 <= words <= 15:
        score += 1
    # Сұрақ белгісі болса – нұсқа емес
    if "?" in line:
        score -= 2
    # Бір қатарда бірнеше лейбл көрінсе – inline нұсқалар
    if len(RE_INLINE_LABEL.findall(line)) >= 2:
        score += 3
    return score

def classify_line(line: str) -> str:
    """
    Эвристикалық класс: 'question' | 'option' | 'answer' | 'other'
    Кейін осы жерге ML модель шешімін қойсаң болады.
    """
    if RE_ANSWER_LINE.search(line):
        return "answer"
    q = _score_question(line)
    o = _score_option(line)
    if q >= o and q >= 2:
        return "question"
    if o > q and o >= 2:
        return "option"
    return "other"

# ----- Негізгі топтастыру логикасы -----

def refine_with_neiron(lines: List[str]) -> List[Dict]:
    """
    Жолдар тізімін эвристикамен топтастырады.
    Regex-пен бөлінбеген блоктарды "минималды қателесумен" сұрақ-жауапқа ашады.
    """
    out: List[Dict] = []

    current_q_parts: List[str] = []
    current_options: List[str] = []
    current_labels: List[Optional[str]] = []
    inline_correct_idxs: List[int] = []
    pending_answer_lines: List[str] = []

    def finalize():
        nonlocal current_q_parts, current_options, current_labels, inline_correct_idxs, pending_answer_lines
        if not current_q_parts and not current_options:
            reset()
            return

        q_text = _normalize_space(" ".join(current_q_parts)) if current_q_parts else ""
        options = [_normalize_space(o) for o in current_options]

        answer_index: Optional[int] = None
        answer_label: Optional[str] = None
        answer_text: Optional[str] = None

        if inline_correct_idxs:
            answer_index = inline_correct_idxs[0]
            answer_label = current_labels[answer_index] or None if 0 <= answer_index < len(current_labels) else None
            answer_text = options[answer_index] if 0 <= answer_index < len(options) else None

        if answer_index is None and pending_answer_lines:
            idx, lab, txt = _parse_answer_from_text(
                pending_answer_lines[0],
                [lbl or "" for lbl in current_labels],
                options
            )
            answer_index, answer_label, answer_text = idx, lab, txt

        out.append({
            "question": q_text,
            "options": options,
            "answer_index": answer_index,
            "answer_label": answer_label,
            "answer_text": answer_text,
            "meta": {
                "labels": current_labels.copy(),
                "answer_lines": pending_answer_lines.copy(),
                "source": "neiron-heuristic"
            }
        })
        reset()

    def reset():
        nonlocal current_q_parts, current_options, current_labels, inline_correct_idxs, pending_answer_lines
        current_q_parts = []
        current_options = []
        current_labels = []
        inline_correct_idxs = []
        pending_answer_lines = []

    def start_new_question(text: str):
        finalize()
        current_q_parts.append(text)

    # Негізгі айналым
    for raw in lines:
        line = _normalize_space(raw)
        if not line:
            continue

        # 1) Явный "Дұрыс жауап: ..." жолы
        am = RE_ANSWER_LINE.search(line)
        if am:
            pending_answer_lines.append(am.group("ans"))
            continue

        # 2) Классификация
        cls = classify_line(line)

        if cls == "question":
            # Бір қатарда inline нұсқалар бар болуы мүмкін
            inline_opts = _split_inline_options(line)
            if current_q_parts or current_options:
                # Алдыңғы блокты бітіріп, жаңасын бастаймыз
                start_new_question(line)
            else:
                start_new_question(line)

            # Егер сол қатардың ішінде бірнеше нұсқа болса — іле-шала қосамыз
            if inline_opts:
                for lab, txt in inline_opts:
                    txt2, ok = _strip_inline_correct_marks(txt)
                    current_options.append(txt2)
                    current_labels.append(lab)
                    if ok:
                        inline_correct_idxs.append(len(current_options) - 1)
            continue

        if cls == "option":
            # Лейблмен бе, буллет пе, әлде inline ме — бәрін ұстаймыз
            m_lab = RE_OPTION_LABELED.match(line)
            if m_lab:
                lab = m_lab.group(1)
                txt = m_lab.group("text")
                txt2, ok = _strip_inline_correct_marks(txt)
                if not current_q_parts:
                    # Егер сұрақ ашылмаса — алдыңғы мәтін жоқ, демек жаңа сұрақ басталды деп есептейміз
                    start_new_question("")  # бос сұрақ, кейін GUI-де түзетуге болады
                current_options.append(txt2)
                current_labels.append(lab)
                if ok:
                    inline_correct_idxs.append(len(current_options) - 1)
                continue

            m_b = RE_BULLET.match(line)
            if m_b:
                txt = m_b.group("text")
                txt2, ok = _strip_inline_correct_marks(txt)
                if not current_q_parts:
                    start_new_question("")
                current_options.append(txt2)
                current_labels.append(None)
                if ok:
                    inline_correct_idxs.append(len(current_options) - 1)
                continue

            # Бір қатарда бірнеше нұсқа
            multi = _split_inline_options(line)
            if multi:
                if not current_q_parts:
                    start_new_question("")
                for lab, txt in multi:
                    txt2, ok = _strip_inline_correct_marks(txt)
                    current_options.append(txt2)
                    current_labels.append(lab)
                    if ok:
                        inline_correct_idxs.append(len(current_options) - 1)
                continue

            # Әйтпесе — соңғы нұсқаның жалғасы болуы мүмкін
            if current_options:
                current_options[-1] = _normalize_space(current_options[-1] + " " + line)
            else:
                # Нұсқа сияқты, бірақ сұрақ жоқ → жаңа сұрақ ретінде сақтаймыз
                start_new_question(line)
            continue

        if cls == "other":
            # Егер сұрақ ашылған, нұсқа жоқ → сұрақ мәтінінің жалғасы
            if current_q_parts and not current_options:
                current_q_parts.append(line)
            elif current_options:
                # Соңғы нұсқаның жалғасы
                current_options[-1] = _normalize_space(current_options[-1] + " " + line)
            else:
                # Ештеңе ашылмаған — жаңа сұрақ бастай саламыз
                start_new_question(line)
            continue

    # Соңғы блок
    finalize()

    # Егер барлық labels None болса — авто a,b,c...
    for q in out:
        labels = q["meta"]["labels"]
        if q["options"] and all(l is None for l in labels):
            q["meta"]["labels"] = [chr(ord("a") + i) for i in range(len(q["options"]))]

    return out

# ----- Жауапты мәтіннен шығару (лейбл/мәтін салыстыру) -----

def _label_to_index_map(option_labels: List[str]) -> dict:
    m = {}
    for i, lab in enumerate(option_labels):
        low = lab.lower()
        m[low] = i
        if lab.isdigit():
            m[str(int(lab))] = i
    return m

def _parse_answer_from_text(ans_raw: str, option_labels: List[str], options: List[str]) -> Tuple[Optional[int], Optional[str], Optional[str]]:
    ans = ans_raw.strip()
    # Қарапайым лейбл
    m = re.match(rf"^\s*((?:[{LABEL_CHARS}])|\d{{1,2}})\s*$", ans)
    if m:
        label = m.group(1)
        idx = _label_to_index_map(option_labels).get(label.lower())
        return (idx, label, options[idx] if idx is not None else None)
    # "b) ..." түрі
    m = re.match(rf"^\s*((?:[{LABEL_CHARS}])|\d{{1,2}})\s*[\.\)]", ans)
    if m:
        label = m.group(1)
        idx = _label_to_index_map(option_labels).get(label.lower())
        return (idx, label, options[idx] if idx is not None else None)
    # Нақты мәтінмен сәйкестік (exact → prefix)
    ans_norm = _normalize_space(ans).rstrip(".").lower()
    for i, opt in enumerate(options):
        if _normalize_space(opt).rstrip(".").lower() == ans_norm:
            return (i, None, options[i])
    for i, opt in enumerate(options):
        if _normalize_space(opt).lower().startswith(ans_norm):
            return (i, None, options[i])
    return (None, None, None)

# ------------------- Жылдам қолмен тексеру -------------------
if __name__ == "__main__":
    sample = [
        "Қазақстанның астанасы қай қала",  # сұрақ белгісі жоқ, бірақ 'қай' бар
        "a) Астана *",
        "b) Алматы",
        "c) Шымкент",
        "Дұрыс жауап: a",
        "",
        "Екінші сұрақ мынадай болуы мүмкін бе?",
        "- Бірінші нұсқа",
        "- Екінші нұсқа [correct]",
        "- Үшінші нұсқа",
        "",
        "Үшінші сұрақ. a) Red  b) Blue  c) Green",
        "Answer: b",
        "",
        "Төртінші (ерекше формат) жол",
        "Мына жол сұрақтың жалғасы сияқты",
        "• Bullet A",
        "• Bullet B",
        "Жауабы: Bullet B",
    ]
    from pprint import pprint
    parsed = refine_with_neiron(sample)
    pprint(parsed, width=120)
