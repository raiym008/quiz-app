# errors.py
# Easy жобасының барлық қателерін бір жерден басқару

ERROR_MESSAGES = {
    # ---- AUTH ----
    "invalid_credentials": "Қолданушы аты немесе құпиясөз қате.",
    "user_not_found": "Мұндай қолданушы табылмады.",
    "email_not_verified": "Email расталмаған.",
    "token_expired": "Сессия уақыты аяқталды. Қайта кіріңіз.",
    "unauthorized": "Бұл әрекетті орындау үшін жүйеге кіру қажет.",

    # ---- DATABASE / SUPABASE ----
    "database_error": "Дерекқор қатесі. Кейінірек қайталап көріңіз.",
    "supabase_error": "Сервермен байланыс сәтсіз аяқталды.",
    "row_not_found": "Дерек табылмады.",
    "permission_denied": "Бұл ресурсқа рұқсат жоқ.",

    # ---- CREDITS (МҮМКІНДІК) ----
    "no_credits": "Мүмкіндік жеткіліксіз. DOCX импорттау үшін 1 мүмкіндік керек.",
    "insufficient_balance": "Мүмкіндік саны жеткіліксіз.",
    "credit_load_failed": "Мүмкіндіктерді жүктеу сәтсіз аяқталды.",

    # ---- DOCX / FILE PARSER ----
    "file_missing": "Файл таңдалмаған.",
    "file_too_large": "Файл көлемі тым үлкен. 20MB-тан аспау керек.",
    "file_type_not_allowed": "Тек .docx файл қабылданады.",
    "docx_invalid_format": "DOCX файлы дұрыс емес.",
    "docx_parse_error": "Файлды өңдеу кезінде қате шықты.",
    "docx_no_questions": "Сұрақ табылмады. Форматты тексеріңіз.",

    # ---- SUBJECT / TOPIC / QUIZ ----
    "subject_exists": "Бұл пән сізде бұрыннан бар.",
    "subject_not_found": "Пән табылмады.",
    "topic_exists": "Бұл тақырып бұрын қосылған.",
    "topic_not_found": "Тақырып табылмады.",
    "quiz_not_found": "Сұрақ табылмады.",
    "quiz_invalid": "Сұрақ немесе нұсқалар дұрыс емес.",

    # ---- NETWORK ----
    "network_error": "Желіде ақау пайда болды. Интернет байланысын тексеріңіз.",
    "ssl_error": "Қауіпсіз байланыс орнату мүмкін болмады.",

    # ---- DEFAULT ----
    "unknown_error": "Күтпеген қате пайда болды. Кейінірек қайталап көріңіз.",
}


def map_error(detail: str) -> str:
    """
    detail ішіндегі мәтіннен жалпы қате кодын анықтайды.
    """
    d = detail.lower()

    # SSL / Network
    if "sslv3" in d or "ssl" in d:
        return ERROR_MESSAGES["ssl_error"]

    # Supabase
    if "supabase" in d or "connection" in d:
        return ERROR_MESSAGES["supabase_error"]

    # Token issues
    if "token" in d or "jwt" in d:
        return ERROR_MESSAGES["token_expired"]

    # Credits
    if "credit" in d and "жеткіліксіз" in d:
        return ERROR_MESSAGES["no_credits"]

    # DOCX
    if "docx" in d:
        if "сұрақ" in d:
            return ERROR_MESSAGES["docx_no_questions"]
        return ERROR_MESSAGES["docx_parse_error"]

    # Default
    return ERROR_MESSAGES["unknown_error"]
