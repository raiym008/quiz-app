# regex_parser.py
# ------------------------------------------------------------
# Мақсаты:
#   DOCX-тен алынған жолдарды (list[str]) қабылдап,
#   сұрақтар тізімін мына форматта қайтарады:
#   [
#     {
#       "question": "Сұрақ мәтіні",
#       "options": ["Вариант A", "Вариант B", ...],
#       "answer_index": 1,             # 0-based, болмаса None
#       "answer_label": "b",           # табылса
#       "answer_text": "Вариант B",    # табылса
#       "meta": { ... }                # қалауыңша
#     },
#     ...
#   ]
#
# Ерекшеліктер:
#  - Сұрақты "1.", "1)", "Вопрос 1.", "Сұрақ 1." т.б. үстінен таниды
#  - Нұсқаларды "a)", "a.", "A)", "1)" және "- ", "• " түрлерінен таниды
#  - Бір қатарда бірнеше нұсқа болса, бөліп шығарады
#  - Дұрыс жауапты мына үлгілерден табады:
#       "Дұрыс жауап: b", "Жауабы: 2", "Answer: A", "Correct: Paris"
#     және нұсқаның өзіндегі белгілерден:
#       "a) Text *", "b) Text (✓)", "b) [correct]"
#  - Нұсқалар жалғаспалы (multi-line) болса, соңғы нұсқаның артынан жалғайды
#  - "вопрос 1", "сұрақ 5" сияқты префикстерді сұрақтан алып тастайды
#
# Қолдану:
#   from regex_parser import parse_with_regex
#   data = parse_with_regex(lines)
#
# Ескерту:
#   Бұл — "қатаң ереже" ядросы. Күмәнді блоктар кейін ML-ге берілуі мүмкін.
# ------------------------------------------------------------

import re
from typing import List, Dict, Optional, Tuple

# --------- Қолданылатын regex-тер мен көмекші жиындар ---------

# Сұрақтың басталуы: "1.", "12)", "1 )", "Вопрос 3.", "Сұрақ 2)" т.б.
RE_QUESTION_START = re.compile(
    r"^\s*(?:"
    r"(?:(?:вопрос|сұрақ|question)\s*\d+\s*[\.\):-]?)|"   # 'Вопрос 1.' / 'Сұрақ 2)' / 'Question 3:'
    r"(?:\d+\s*[\.\)])"                                   # '1.' / '2)'
    r")\s*(?P<text>.+)$",
    re.IGNORECASE
)

# Нұсқа лейблдері: 'a)', 'a.', 'A)', 'б)', 'Ә)', '1)', '1.' т.б.
# Басы мен inline табуға арналған
LABEL_CHARS = "A-Za-zА-Яа-яӘәІіҢңҒғҮүҰұҚқӨө"
RE_OPTION_START = re.compile(
    rf"^\s*(?P<label>(?:[{LABEL_CHARS}])|\d{{1,2}})\s*[\.\)]\s+(?P<text>.+)$"
)

# Бір қатарда бірнеше нұсқа бар жағдайға арналған "finditer" үлгісі
RE_OPTION_INLINE = re.compile(
    rf"(?P<label>(?:[{LABEL_CHARS}])|\d{{1,2}})\s*[\.\)]\s+(?P<text>.+?)"
)

# Маркерсіз bullet (кейде нұсқа ретінде жазылады): "- text", "• text", "— text"
RE_BULLET_START = re.compile(r"^\s*[-•—]\s+(?P<text>.+)$")

# Дұрыс жауап: "Дұрыс жауап: b", "Жауабы: 2", "Answer: A", "Correct: Paris", "Правильный ответ: В"
RE_ANSWER_LINE = re.compile(
    r"(?i)\b(дұрыс\s*жауап|жауабы|дұрыс|answer|correct|правильн(?:ый)?\s*ответ|ответ)\b\s*[:\-]?\s*(?P<ans>.+)$"
)

# Нұсқа ішіндегі inline дұрыс белгі: "*", "(✓)", "[correct]" соңында/жанында
RE_INLINE_CORRECT_MARK = re.compile(r"(\*|\(✓\)|\[correct\]|\[true\]|\(true\))", re.IGNORECASE)

# Тазарту үшін
RE_PREFIX_WORD = re.compile(r"^\s*(?:вопрос|сұрақ|question)\s*\d*\s*[:\.\)-]*\s*", re.IGNORECASE)


# --------- Көмекші функциялар ---------

def _clean_question_text(s: str) -> str:
    # "Вопрос 1. " / "Сұрақ 2) " сияқты префикстерді кесеміз
    s = RE_PREFIX_WORD.sub("", s).strip()
    # Соңғы нүктені қалдыру/қалдырмау — талғам. Біз қалдыра береміз.
    return s

def _normalize_space(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()

def _strip_inline_correct_marks(s: str) -> Tuple[str, bool]:
    """Нұсқадан inline дұрыс белгіні алып тастап, is_correct=True/False қайтарады."""
    if RE_INLINE_CORRECT_MARK.search(s):
        s2 = RE_INLINE_CORRECT_MARK.sub("", s)
        return _normalize_space(s2), True
    return s, False

def _label_to_index_map(option_labels: List[str]) -> Dict[str, int]:
    """Лейблді индекске толық map. Латын/кирилл әріптері және сандар ескеріледі."""
    m = {}
    for i, lab in enumerate(option_labels):
        m[lab.lower()] = i
        # Егер сан болса, "1"→0 т.б. түрлендіру үшін
        if lab.isdigit():
            m[str(int(lab))] = i  # "01" емес "1" кілті де жүрсін
    return m

def _parse_answer_from_text(ans_raw: str, option_labels: List[str], options: List[str]) -> Tuple[Optional[int], Optional[str], Optional[str]]:
    """
    'ans_raw' мәтінінен жауапты шығарады:
      - егер 'b', 'A', '2' болса — лейбл арқылы
      - әйтпесе нақты мәтінмен салыстырып (exact/loose) табуға тырысады
    """
    ans = ans_raw.strip()
    # Егер жай бір әріп/сан болса:
    m = re.match(rf"^\s*((?:[{LABEL_CHARS}])|\d{{1,2}})\s*$", ans)
    if m:
        label = m.group(1)
        idx_map = _label_to_index_map(option_labels)
        idx = idx_map.get(label.lower())
        return (idx, label, options[idx] if idx is not None else None)

    # Егер "b) ..." сияқты болса — әріпті тартып алайық
    m = re.match(rf"^\s*((?:[{LABEL_CHARS}])|\d{{1,2}})\s*[\.\)]", ans)
    if m:
        label = m.group(1)
        idx_map = _label_to_index_map(option_labels)
        idx = idx_map.get(label.lower())
        return (idx, label, options[idx] if idx is not None else None)

    # Әйтпесе мәтінмен сәйкестік іздейміз (exact → loose)
    ans_norm = _normalize_space(ans).rstrip(".")
    # Exact
    for i, opt in enumerate(options):
        if _normalize_space(opt).rstrip(".").lower() == ans_norm.lower():
            return (i, None, options[i])
    # Loose: жауап мәтіні опцияның басына дәл келсе
    for i, opt in enumerate(options):
        if _normalize_space(opt).lower().startswith(ans_norm.lower()):
            return (i, None, options[i])

    return (None, None, None)

def _split_inline_options(line: str) -> List[Tuple[Optional[str], str]]:
    """
    Бір қатарда бірнеше нұсқа болса (мысалы: "a) One   b) Two   c) Three"),
    соларды бөліп береді: [(label, text), ...]
    Егер табылмаса — бос тізім.
    """
    # Тәсіл: барлық лейбл басталған орындарды тауып, аралықтарын бөлеміз
    # finditer арқылы индекстерді ұстап, келесі лейблге дейінгі мәтінді аламыз
    pattern = re.compile(rf"(?P<label>(?:[{LABEL_CHARS}])|\d{{1,2}})\s*[\.\)]\s+")
    matches = list(pattern.finditer(line))
    results = []
    if len(matches) <= 1:
        return results  # 0 немесе 1 лейбл → "inline бірнеше нұсқа" емес

    # Соңғысын қоса кесіп шығу
    for i, m in enumerate(matches):
        label = m.group("label")
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(line)
        text = line[start:end]
        results.append((label, _normalize_space(text)))
    return results


# --------- Негізгі парсер ---------

def parse_with_regex(lines: List[str]) -> List[Dict]:
    """
    DOCX-тен алынған жолдарды қабылдап, сұрақ/нұсқа/жауап структурасын қайтарады.
    """
    questions: List[Dict] = []
    current_q_text_parts: List[str] = []
    current_options: List[str] = []
    current_labels: List[Optional[str]] = []
    found_correct_label_indices: List[int] = []  # inline белгілер арқылы
    pending_answer_lines: List[str] = []

    def _finalize_current_block():
        """Ағымдағы сұрақ блогын аяқтап, questions тізіміне қосады."""
        nonlocal current_q_text_parts, current_options, current_labels, found_correct_label_indices, pending_answer_lines

        if not current_q_text_parts and not current_options:
            # Бос блок
            _reset_current()
            return

        q_text = _normalize_space(" ".join(current_q_text_parts))
        options = [_normalize_space(o) for o in current_options]

        # answer_index есептеу:
        answer_index = None
        answer_label = None
        answer_text = None

        # 1) Егер нұсқаларда inline дұрыс белгі болса — біріншіге приоритет
        if found_correct_label_indices:
            answer_index = found_correct_label_indices[0]
            answer_label = (current_labels[answer_index] or None)
            answer_text = options[answer_index]

        # 2) Әйтпесе, "Дұрыс жауап: ..." жолдарынан
        if answer_index is None and pending_answer_lines:
            # Бірнеше answer line болса — біріншісін ал
            ans_raw = pending_answer_lines[0]
            idx, lab, txt = _parse_answer_from_text(
                ans_raw,
                [lbl or "" for lbl in current_labels],
                options
            )
            answer_index, answer_label, answer_text = idx, lab, txt

        # Дайын блок
        questions.append({
            "question": q_text,
            "options": options,
            "answer_index": answer_index,
            "answer_label": answer_label,
            "answer_text": answer_text,
            "meta": {
                "labels": current_labels.copy(),
                "answer_lines": pending_answer_lines.copy()
            }
        })
        _reset_current()

    def _reset_current():
        """Ағымдағы блокты тазалау."""
        nonlocal current_q_text_parts, current_options, current_labels, found_correct_label_indices, pending_answer_lines
        current_q_text_parts = []
        current_options = []
        current_labels = []
        found_correct_label_indices = []
        pending_answer_lines = []

    def _start_new_question(text: str):
        """Жаңа сұрақ бастау (алдыңғысын finalize қылып)."""
        _finalize_current_block()
        current_q_text_parts.append(_clean_question_text(text))

    # Негізгі цикл
    for raw in lines:
        line = raw.strip()
        if not line:
            continue

        # 0) Егер бұл "Дұрыс жауап:" жолы болса — ағымдағы блокқа жазып қоямыз
        ans_m = RE_ANSWER_LINE.search(line)
        if ans_m and (current_q_text_parts or questions):
            pending_answer_lines.append(ans_m.group("ans"))
            continue

        # 1) Бұл жаңа сұрақтың басталуы ма?
        qm = RE_QUESTION_START.match(line)
        if qm:
            _start_new_question(qm.group("text"))
            # Мүмкін бұл қатарда нұсқалар да бар шығар — inline тексереміз
            inline_opts = _split_inline_options(line)
            if inline_opts:
                for lab, txt in inline_opts:
                    txt2, is_ok = _strip_inline_correct_marks(txt)
                    current_options.append(txt2)
                    current_labels.append(lab)
                    if is_ok:
                        found_correct_label_indices.append(len(current_options) - 1)
            continue

        # 2) Бұл қатар "a) ..." / "1) ..." үлгісіндегі НҰСҚА ма?
        om = RE_OPTION_START.match(line)
        if om:
            lab = om.group("label")
            txt = om.group("text")
            # Inline дұрыс белгі?
            txt2, is_ok = _strip_inline_correct_marks(txt)
            current_options.append(txt2)
            current_labels.append(lab)
            if is_ok:
                found_correct_label_indices.append(len(current_options) - 1)
            continue

        # 3) Бір қатарда бірнеше нұсқа (a) ... b) ... c) ...) бар ма?
        inline_opts2 = _split_inline_options(line)
        if inline_opts2:
            for lab, txt in inline_opts2:
                txt2, is_ok = _strip_inline_correct_marks(txt)
                current_options.append(txt2)
                current_labels.append(lab)
                if is_ok:
                    found_correct_label_indices.append(len(current_options) - 1)
            continue

        # 4) Маркерсіз bullet ("- ", "• ", "— ") нұсқа ма?
        bm = RE_BULLET_START.match(line)
        if bm:
            txt = bm.group("text")
            txt2, is_ok = _strip_inline_correct_marks(txt)
            current_options.append(txt2)
            current_labels.append(None)  # unlabeled
            if is_ok:
                found_correct_label_indices.append(len(current_options) - 1)
            continue

        # 5) Егер бізде нұсқалар жоқ болса — бұл сұрақтың жалғасы болуы мүмкін
        if current_q_text_parts and not current_options:
            current_q_text_parts.append(line)
            continue

        # 6) Егер соңғы нұсқа бар болса — бұл сол нұсқаның жалғасы (wrap)
        if current_options:
            # Соңғы нұсқаның соңына жалғаймыз
            last = current_options[-1] + " " + line
            current_options[-1] = _normalize_space(last)
            continue

        # 7) Әйтпесе, бұл жаңа сұрақ болуы мүмкін — сұрақ белгісі жоқ,
        #    бірақ бірінші жолдан бастап келе жатқан текст ретінде алайық.
        if not current_q_text_parts:
            _start_new_question(line)
        else:
            current_q_text_parts.append(line)

    # Соңғы блокты аяқтау
    _finalize_current_block()

    # Лейблдер None болған (bullet) опцияларға авто-лейбл қою (a,b,c...)
    for q in questions:
        if q["options"]:
            # Егер барлық labels None болса — авто әріп береміз
            labels = q["meta"]["labels"]
            if all(lab is None for lab in labels):
                new_labels = []
                for i in range(len(q["options"])):
                    new_labels.append(chr(ord('a') + i))
                q["meta"]["labels"] = new_labels

    return questions


# ------------------- Жылдам қолмен тексеру -------------------
if __name__ == "__main__":
    sample_lines = [
        "Вопрос 1. Қазақстанның астанасы қай қала?",
        "a) Астана *",
        "b) Алматы",
        "c) Шымкент",
        "Дұрыс жауап: a",
        "",
        "2) Төмендегілердің қайсысы сүтқоректі?",
        "a) Балық   b) Қоян (✓)   c) Бақа",
        "",
        "3. Бірнеше жолды сұрақ мәтіні осылай жалғасуы мүмкін,",
        "   мысалы, келесі қатарда.",
        "- Нұсқа 1",
        "- Нұсқа 2 [correct]",
        "- Нұсқа 3",
        "Answer: Нұсқа 2",
        "",
        "4) Inline options: a) Red   b) Blue   c) Green",
        "Correct: b",
        "",
        "Сұрақ 5) Нөмірсіз нұсқалар да болуы мүмкін",
        "• Бірінші",
        "• Екінші",
        "• Үшінші",
        "Жауабы: 2",
    ]

    parsed = parse_with_regex(sample_lines)
    from pprint import pprint
    pprint(parsed, width=120)
