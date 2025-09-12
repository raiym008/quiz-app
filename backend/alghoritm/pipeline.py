# pipeline.py
# ------------------------------------------------------------
# Мақсаты:
#   .docx файлдан жолдарды шығарып (docx_parse),
#   regex-пен парсинг жасап (regex_parser),
#   күмәнді/ақау блоктар болса — эвристика/нейронмен толықтырып (neiron),
#   ЕКІНШІ КЕЗЕҢ: "Сақтау" басылғанда DB-ға жазуға дайын құрылым қайтару.
#
# Орнату:
#   pip install python-docx
#
# Қолдану (консольден):
#   python pipeline.py path/to/file.docx
#
# FastAPI ішінде:
#   from alghoritm.pipeline import process_docx, save_to_db
#   parsed = process_docx("temp.docx")
#   # UI-де көрсетіп, тек "Сақтау" басылса:
#   save_to_db(parsed, db_adapter=<ваш адаптер немесе сессия>)
# ------------------------------------------------------------

from __future__ import annotations
from typing import List, Dict, Optional, Tuple
import math
import json
import re

from .docx_parse import extract_text
from .regex_parser import parse_with_regex
from .neiron import refine_with_neiron

# -------------------- Сапаны бағалау эвристикалары --------------------

def _normalize_space(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()

def _tokenize(s: str) -> List[str]:
    s = _normalize_space(s).lower()
    s = re.sub(r"[^a-zа-яё0-9ңғүұқөһіӘәІіҢңҒғҮүҰұҚқӨө\s\-\_]", " ", s, flags=re.IGNORECASE)
    return [t for t in s.split() if t]

def _jaccard(a: str, b: str) -> float:
    ta, tb = set(_tokenize(a)), set(_tokenize(b))
    if not ta and not tb:
        return 1.0
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    union = len(ta | tb)
    return inter / union if union else 0.0

def evaluate_block_quality(block: Dict) -> Tuple[int, List[str]]:
    """
    Блок сапасын 0..100 аралығында бағалау және ақаулар тізімі.
    Жоғары балл — жақсы.
    """
    issues: List[str] = []
    score = 0

    q = _normalize_space(block.get("question", ""))
    opts: List[str] = [ _normalize_space(o) for o in (block.get("options") or []) ]
    ans_idx = block.get("answer_index", None)

    # 1) Сұрақ мәтіні
    if q:
        score += min(20, len(q))  # қысқа болса да +, ұзын болса — көбірек
        if "?" in q:
            score += 5
    else:
        issues.append("question_empty")
        score -= 10

    # 2) Нұсқалар саны
    if len(opts) >= 4:
        score += 40
    elif len(opts) == 3:
        score += 30
    elif len(opts) == 2:
        score += 15
        issues.append("too_few_options")
    elif len(opts) == 1:
        score += 5
        issues.append("too_few_options")
    else:
        issues.append("no_options")
        score -= 20

    # 3) Нұсқалардың сапасы (өте ұзын не тым қысқа емес)
    if opts:
        avg_len = sum(len(o) for o in opts) / len(opts)
        if 2 <= avg_len <= 120:
            score += 10
        else:
            issues.append("options_awkward_length")

    # 4) Жауап бар-жоғы (міндет емес, бірақ плюс)
    if ans_idx is not None and isinstance(ans_idx, int) and 0 <= ans_idx < len(opts):
        score += 15
    else:
        issues.append("no_answer_detected")

    # 5) Дубликат нұсқалар болса — аз өлшем
    if len(opts) != len(set(opts)):
        issues.append("duplicate_options")
        score -= 5

    # 6) Формат ұқсастығы (лейблдер бар ма дегенді meta-дан көруге болады)
    meta = block.get("meta") or {}
    labels = meta.get("labels") or []
    if labels and any(l is not None for l in labels):
        score += 5  # лейблдер бар — плюс

    # Шектеп қою
    score = max(0, min(100, score))
    return score, issues

def is_good_block(block: Dict, min_score: int = 50) -> bool:
    score, issues = evaluate_block_quality(block)
    # Егер нұсқа мүлдем жоқ болса — қабылдамаймыз
    if "no_options" in issues:
        return False
    return score >= min_score

# -------------------- Блоктарды біріктіру логикасы --------------------

def merge_blocks(regex_blocks: List[Dict], neiron_blocks: List[Dict]) -> List[Dict]:
    """
    Екі тізімді біріктіреді:
      - regex жақсы болса — regex-ті аламыз
      - regex әлсіз болса — сол позициядағы немесе келесідегі neiron блокпен алмастырамыз
      - соңында артық жақсы neiron блоктар болса, оларды да қосамыз (дубликат емес болса)
    """
    final: List[Dict] = []

    # Көмекші: блокқа "source" белгісін қойып қояйық
    def mark_source(block: Dict, src: str) -> Dict:
        meta = block.get("meta") or {}
        meta["source"] = src
        block["meta"] = meta
        return block

    # Екеуін параллель жүріп көреміз
    i, j = 0, 0
    while i < len(regex_blocks) or j < len(neiron_blocks):
        rb = regex_blocks[i] if i < len(regex_blocks) else None
        nb = neiron_blocks[j] if j < len(neiron_blocks) else None

        if rb is not None and nb is not None:
            # Ұқсастығын қараймыз (сұрақ мәтіні бойынша)
            sim = _jaccard(rb.get("question", ""), nb.get("question", ""))
            rb_good = is_good_block(rb)
            nb_good = is_good_block(nb)

            if rb_good and (sim >= 0.3 or not nb_good):
                final.append(mark_source(rb, "regex"))
                i += 1
                j += 1 if sim >= 0.3 else 0
            elif nb_good:
                final.append(mark_source(nb, "neiron"))
                i += 1 if sim >= 0.3 else 0
                j += 1
            else:
                # Екеуі де күмәнді — regex-ті аламыз, бірақ белгі қалдырамыз
                rb = mark_source(rb, "regex-weak")
                scr, iss = evaluate_block_quality(rb)
                rb["meta"]["quality"] = {"score": scr, "issues": iss}
                final.append(rb)
                i += 1
                j += 1 if sim >= 0.3 else 0

        elif rb is not None:
            # Тек regex қалды
            if is_good_block(rb, min_score=45):
                final.append(mark_source(rb, "regex"))
            else:
                # өте әлсіз болса да, қалдырамыз — UI-де редакциялау үшін
                rb = mark_source(rb, "regex-weak")
                scr, iss = evaluate_block_quality(rb)
                rb["meta"]["quality"] = {"score": scr, "issues": iss}
                final.append(rb)
            i += 1

        elif nb is not None:
            # Тек neiron қалды
            if is_good_block(nb, min_score=45):
                final.append(mark_source(nb, "neiron"))
            else:
                nb = mark_source(nb, "neiron-weak")
                scr, iss = evaluate_block_quality(nb)
                nb["meta"]["quality"] = {"score": scr, "issues": iss}
                final.append(nb)
            j += 1

    # Дубликат сұрақтарды алып тастау (жақын ұқсастарды сүзу)
    deduped: List[Dict] = []
    for blk in final:
        if not deduped:
            deduped.append(blk)
            continue
        sim_prev = _jaccard(deduped[-1].get("question", ""), blk.get("question", ""))
        if sim_prev >= 0.9 and len(blk.get("options", [])) == len(deduped[-1].get("options", [])):
            # шамамен бірдей — өткізіп жібереміз
            continue
        deduped.append(blk)

    return deduped

# -------------------- Негізгі API --------------------

def process_docx(docx_path: str, debug: bool = False) -> List[Dict]:
    """
    .docx → гибрид парсинг → blocks (list[dict])
    UI-де көрсетіп, қолданушы "Сақтау" дегенде ғана DB-ға жіберіледі.
    """
    # 1) DOCX → lines
    lines = extract_text(docx_path)

    # 2) Regex pass
    regex_blocks = parse_with_regex(lines)

    # 3) Нейрон/эвристика pass
    #    Егер regex өте жақсы болса да, neiron бізге fallback/көмек ретінде керек.
    neiron_blocks = refine_with_neiron(lines)

    # 4) Біріктіру
    merged = merge_blocks(regex_blocks, neiron_blocks)

    # 5) Debug (қаласаң — JSON-ды тек уақытша тексеру үшін жазып алуға болады)
    if debug:
        try:
            dbg = {
                "lines": lines,
                "regex_blocks": regex_blocks,
                "neiron_blocks": neiron_blocks,
                "merged": merged,
            }
            with open("debug_parsed.json", "w", encoding="utf-8") as f:
                json.dump(dbg, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    return merged

# -------------------- DB-ға сақтау интерфейсі --------------------

def save_to_db(parsed_data: List[Dict], db_adapter=None) -> None:
    """
    Тек "Сақтау" басылғанда шақырылады.
    Мұнда нақты DB логикасын енгізесің.
    Екі жол ұсындым:
      A) db_adapter — өзің жазған объект (мыс: SQLAlchemy session holder),
         онда төмендегідей методтар бар:
             - create_question(text) -> question_id
             - create_option(question_id, text, is_correct=False)
         Немесе бірден create_question_with_options(...)
      B) Осы функция ішіне тікелей SQLAlchemy кодын енгізіп аласың.
    Қазір — Stub. Төменде псевдокод қалдырдым.
    """
    if db_adapter is None:
        # Егер адаптер берілмесе — бұл жерде ештеңе істемейміз.
        # FastAPI ішінен нақты adapter-мен қайта шақырылады.
        raise NotImplementedError(
            "save_to_db: db_adapter берілмеген. "
            "Өзіңнің database қабатыңды қос немесе осы функцияны нақтыла."
        )

    # ---- ПСЕВДОКОД ҮЛГІСІ (қажетіне қарай бейімде):
    #
    # for block in parsed_data:
    #     q_text = (block.get("question") or "").strip()
    #     if not q_text:
    #         continue
    #     q_id = db_adapter.create_question(q_text)
    #
    #     options = block.get("options") or []
    #     ans_idx = block.get("answer_index")
    #     for i, opt_text in enumerate(options):
    #         is_corr = (ans_idx is not None and i == ans_idx)
    #         db_adapter.create_option(q_id, opt_text, is_correct=is_corr)
    #
    # db_adapter.commit()
    #
    # ---- ТАРАП:
    # - Егер сенде Quiz/Topic байланысы болса, алдымен Quiz құрып,
    #   әр сұрақты сол Quiz-ге байлап сақтайсың.

# -------------------- Қолмен тексеруге арналған main --------------------

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Пайдалану: python -m alghoritm.pipeline <path/to/file.docx> [--debug]")
        sys.exit(1)
    path = sys.argv[1]
    debug = "--debug" in sys.argv[2:]
    result = process_docx(path, debug=debug)
    # Қысқа қорытынды шығару
    print(f"Барлығы: {len(result)} сұрақ блоктары")
    good = sum(1 for b in result if is_good_block(b))
    print(f"  Жақсы блоктар: {good}")
    weak = len(result) - good
    print(f"  Әлсіз блоктар: {weak}")
    # Бір-екі блокты көрнекі шығару
    for i, blk in enumerate(result[:3], 1):
        src = (blk.get("meta") or {}).get("source", "?")
        print(f"\n[{i}] source={src}")
        print("Q:", blk.get("question"))
        for j, o in enumerate(blk.get("options") or []):
            mark = " (✓)" if blk.get("answer_index") == j else ""
            print(f"  {j+1}) {o}{mark}")
