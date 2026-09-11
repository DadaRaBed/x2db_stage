"""
Utilitaires partages par les modules API.
"""

import gc
import os
import re
import sqlite3
import time
import unicodedata
from typing import Optional


def connect_db(db_path: str, row_factory=None):
    """
    Ouvre une connexion SQLite compatible multi-thread.

    pywebview execute les appels API dans un thread different du thread
    principal. Sans check_same_thread=False, SQLite leve l'erreur :
    'SQLite objects created in a thread can only be used in that same thread'.
    """
    conn = sqlite3.connect(db_path, check_same_thread=False, timeout=30.0)
    try:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
    except Exception:
        pass
    if row_factory is not None:
        conn.row_factory = row_factory
    return conn


def safe_close_connection(conn):
    """Ferme proprement une connexion SQLite avec checkpoint WAL."""
    if conn is None:
        return
    try:
        conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
    except Exception:
        pass
    try:
        conn.close()
    except Exception:
        pass


def release_resources(delay: float = 0.25):
    """Force le GC et laisse SQLite liberer les fichiers WAL/SHM."""
    try:
        gc.collect()
    except Exception:
        pass
    time.sleep(delay)


def clean_ascii(text) -> str:
    """
    Nettoie une chaine pour en faire un nom de table/colonne SQLite valide.
    """
    nfkd_form = unicodedata.normalize("NFKD", str(text))
    only_ascii = "".join([c for c in nfkd_form if not unicodedata.combining(c)])
    return re.sub(r"[^\w]", "_", only_ascii).lower().strip("_")