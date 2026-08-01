"""Sanitization for CRM/preference free-text fields (Phase 33, D-06/D-07).

Applied TWICE per field per the locked "double-gate" decision: once at
write time (crm_import_service.py / admin_personalization.py) and again at
prompt-injection time (prompt_builder.build_personalization_section) --
defense-in-depth against prompt injection (OWASP LLM01) and PII leakage,
without a second LLM-based review pass (D-06 explicitly rules that out).
"""

import re

_CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_PROMPT_DELIMITER_PATTERN = re.compile(r"```|<\|.*?\|>|\[INST\]|\[/INST\]", re.IGNORECASE)
_INJECTION_PATTERN = re.compile(
    r"(?i)(ignore\s+(all\s+)?previous\s+instructions|disregard\s+(all\s+)?(the\s+)?above|"
    r"system\s*:|you\s+are\s+now|new\s+instructions\s*:|forget\s+(everything|all)\s+(above|before))"
)
# Order matters: 18-digit ID card BEFORE the looser 16-19-digit bank-card pattern,
# so an ID number is fully consumed/redacted first and never partially re-matched
# as a residual bank-card digit run.
#
# Digit patterns use digit-only lookaround `(?<!\d)`/`(?!\d)` instead of `\b`:
# Python's `\b` treats CJK characters as word characters, so a digit run directly
# adjacent to Chinese text (e.g. "联系电话13812345678", no space) would NOT have a
# `\b` boundary and silently fail to match. Digit-only lookaround still prevents
# matching a sub-run of a longer digit sequence, without depending on CJK/ASCII
# word-char semantics.
_PII_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("id_card", re.compile(r"(?<!\d)\d{17}[\dXx](?!\d)")),
    ("bank_card", re.compile(r"(?<!\d)\d{16,19}(?!\d)")),
    ("phone", re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)")),
    ("email", re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")),
]


def sanitize_field(value: str | None, max_length: int = 500) -> str:
    """First/second gate for short business fields (customer_name, company,
    role, contact_person, preference category/value): strip control chars,
    prompt delimiters, and known injection phrases; truncate to max_length."""
    if not value:
        return ""
    cleaned = _CONTROL_CHAR_PATTERN.sub("", value)
    cleaned = _PROMPT_DELIMITER_PATTERN.sub("", cleaned)
    cleaned = _INJECTION_PATTERN.sub("[FILTERED]", cleaned)
    return cleaned.strip()[:max_length]


def sanitize_free_text_with_pii(value: str | None, max_length: int = 2000) -> str:
    """Gate for free-text fields (crm_notes): sanitize_field() rules PLUS
    regex PII redaction (ID card / bank card / phone / email) per D-07 --
    business content itself is allowed through, only recognizable PII is
    replaced with a placeholder."""
    cleaned = sanitize_field(value, max_length)
    for label, pattern in _PII_PATTERNS:
        cleaned = pattern.sub(f"[{label.upper()}_REDACTED]", cleaned)
    return cleaned
