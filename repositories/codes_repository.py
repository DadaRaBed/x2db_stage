"""
Gestion des codes de validation a usage unique stockes dans un fichier local.

Fichiers utilises :
- data/validation_codes.txt       : tous les codes disponibles (1 par ligne)
- data/validation_codes_used.txt  : codes deja utilises (1 par ligne)

Au premier demarrage, 1000 codes sont generes automatiquement.
"""

import random
import string
from pathlib import Path
from typing import Optional

from paths import DATA_DIR


CODES_FILE = DATA_DIR / "validation_codes.txt"
USED_CODES_FILE = DATA_DIR / "validation_codes_used.txt"
DEFAULT_CODE_COUNT = 1000


def _generate_code() -> str:
    """Genere un code au format XXXX-XXXX-XXXX."""
    alphabet = string.ascii_uppercase + string.digits
    parts = []
    for _ in range(3):
        part = "".join(random.choices(alphabet, k=4))
        parts.append(part)
    return "-".join(parts)


def ensure_codes_file(count: int = DEFAULT_CODE_COUNT) -> int:
    """
    Cree le fichier de codes s'il n'existe pas.
    Retourne le nombre de codes disponibles.
    """
    CODES_FILE.parent.mkdir(parents=True, exist_ok=True)

    if not CODES_FILE.exists():
        codes = set()
        while len(codes) < count:
            codes.add(_generate_code())
        with open(CODES_FILE, "w", encoding="utf-8") as f:
            for code in sorted(codes):
                f.write(code + "\n")

    if not USED_CODES_FILE.exists():
        USED_CODES_FILE.touch()

    return count_available_codes()


def _load_used_codes() -> set:
    """Retourne l'ensemble des codes deja utilises."""
    if not USED_CODES_FILE.exists():
        return set()
    try:
        with open(USED_CODES_FILE, "r", encoding="utf-8") as f:
            return {line.strip().upper() for line in f if line.strip()}
    except Exception:
        return set()


def _load_all_codes() -> list:
    """Retourne la liste de tous les codes du fichier."""
    if not CODES_FILE.exists():
        return []
    try:
        with open(CODES_FILE, "r", encoding="utf-8") as f:
            return [line.strip().upper() for line in f if line.strip()]
    except Exception:
        return []


def count_available_codes() -> int:
    """Retourne le nombre de codes non utilises."""
    all_codes = _load_all_codes()
    used = _load_used_codes()
    return len([c for c in all_codes if c not in used])


def get_next_available_code() -> Optional[str]:
    """
    Retourne le prochain code disponible (non utilise).
    Ne le marque PAS comme utilise (il faut appeler mark_code_used).
    """
    all_codes = _load_all_codes()
    used = _load_used_codes()
    for code in all_codes:
        if code not in used:
            return code
    return None


def mark_code_used(code: str) -> bool:
    """Marque un code comme utilise. Retourne True si succes."""
    code = (code or "").strip().upper()
    if not code:
        return False

    all_codes = set(_load_all_codes())
    if code not in all_codes:
        return False

    used = _load_used_codes()
    if code in used:
        return False

    try:
        with open(USED_CODES_FILE, "a", encoding="utf-8") as f:
            f.write(code + "\n")
        return True
    except Exception:
        return False


def is_code_available(code: str) -> bool:
    """Verifie qu'un code existe et n'est pas encore utilise."""
    code = (code or "").strip().upper()
    if not code:
        return False
    all_codes = set(_load_all_codes())
    if code not in all_codes:
        return False
    used = _load_used_codes()
    return code not in used


def get_stats() -> dict:
    """Retourne des statistiques sur les codes."""
    all_codes = _load_all_codes()
    used = _load_used_codes()
    return {
        "total": len(all_codes),
        "used": len(used),
        "available": len([c for c in all_codes if c not in used]),
    }