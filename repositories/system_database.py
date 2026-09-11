from pathlib import Path
import sqlite3
import os
import sys


def _get_data_dir() -> Path:
    """
    Retourne le dossier data/ de facon PERSISTANTE.

    - Mode DEV : <projet>/data
    - Mode EXE : %APPDATA%/DataManager/data (Windows)
                 ~/.local/share/DataManager/data (Linux/macOS)

    Le dossier est cree automatiquement s'il n'existe pas.
    """
    if getattr(sys, "frozen", False):
        # Mode EXE PyInstaller : utiliser un dossier PERSISTANT
        if sys.platform == "win32":
            base = Path(os.environ.get("APPDATA", os.path.expanduser("~")))
        else:
            base = Path(os.path.expanduser("~/.local/share"))
        app_dir = base / "xl2db"
    else:
        # Mode DEV : dossier du projet
        app_dir = Path(__file__).resolve().parent.parent

    data_dir = app_dir / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


# Constantes globales
DATA_DIR = _get_data_dir()
SYSTEM_DATABASE = DATA_DIR / "system.db"


def get_connection() -> sqlite3.Connection:
    """
    Ouvre une connexion SQLite compatible multi-thread.

    check_same_thread=False est INDISPENSABLE car pywebview execute
    les appels API dans un thread different du thread principal.
    """
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(
        str(SYSTEM_DATABASE),
        check_same_thread=False,
        timeout=30.0,
    )
    connection.row_factory = sqlite3.Row

    # WAL pour meilleure concurrence lecture/ecriture
    try:
        connection.execute("PRAGMA journal_mode=WAL;")
        connection.execute("PRAGMA synchronous=NORMAL;")
    except Exception:
        pass

    return connection


def initialize_database() -> None:
    """Cree les tables users et action_history si elles n'existent pas."""
    connection = get_connection()

    try:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pseudo TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1
            )
            """
        )

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS action_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action TEXT NOT NULL,
                created_at TEXT NOT NULL,
                database_name TEXT,
                table_name TEXT,
                result TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
            """
        )

        connection.commit()
    finally:
        try:
            connection.close()
        except Exception:
            pass


def user_count() -> int:
    """Retourne le nombre d'utilisateurs enregistres."""
    try:
        connection = get_connection()
        try:
            result = connection.execute(
                "SELECT COUNT(*) AS total FROM users"
            ).fetchone()
            return result["total"] if result is not None else 0
        finally:
            try:
                connection.close()
            except Exception:
                pass
    except Exception:
        return 0