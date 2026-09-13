from pathlib import Path
import sqlite3
import os
import sys


def _get_data_dir() -> Path:
    """Retourne le dossier data/ de facon PERSISTANTE."""
    if getattr(sys, "frozen", False):
        if sys.platform == "win32":
            base = Path(os.environ.get("APPDATA", os.path.expanduser("~")))
        else:
            base = Path(os.path.expanduser("~/.local/share"))
        app_dir = base / "xl2db"
    else:
        app_dir = Path(__file__).resolve().parent.parent

    data_dir = app_dir / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


DATA_DIR = _get_data_dir()
SYSTEM_DATABASE = DATA_DIR / "system.db"


def get_connection() -> sqlite3.Connection:
    """Ouvre une connexion SQLite compatible multi-thread."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(
        str(SYSTEM_DATABASE),
        check_same_thread=False,
        timeout=30.0,
    )
    connection.row_factory = sqlite3.Row

    try:
        connection.execute("PRAGMA journal_mode=WAL;")
        connection.execute("PRAGMA synchronous=NORMAL;")
    except Exception:
        pass

    return connection


def _column_exists(connection, table: str, column: str) -> bool:
    try:
        rows = connection.execute(f"PRAGMA table_info({table})").fetchall()
        return any(row["name"] == column for row in rows)
    except Exception:
        return False


def _migrate_users_table(connection) -> None:
    """Ajoute les colonnes manquantes aux bases existantes (idempotent)."""
    migrations = {
        "email": "ALTER TABLE users ADD COLUMN email TEXT",
        "cgu_accepted": "ALTER TABLE users ADD COLUMN cgu_accepted INTEGER NOT NULL DEFAULT 0",
        "cgu_accepted_at": "ALTER TABLE users ADD COLUMN cgu_accepted_at TEXT",
        "report_sent": "ALTER TABLE users ADD COLUMN report_sent INTEGER NOT NULL DEFAULT 0",
    }
    for column, sql in migrations.items():
        if not _column_exists(connection, "users", column):
            try:
                connection.execute(sql)
            except Exception:
                pass


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
                email TEXT,
                created_at TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                cgu_accepted INTEGER NOT NULL DEFAULT 0,
                cgu_accepted_at TEXT,
                report_sent INTEGER NOT NULL DEFAULT 0
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

        _migrate_users_table(connection)
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


# ============================================================
# HELPERS UTILISATEURS
# ============================================================
def get_user_by_email(email: str):
    """Retourne l'utilisateur associe a un email, ou None."""
    if not email:
        return None
    try:
        connection = get_connection()
        try:
            row = connection.execute(
                "SELECT id, pseudo, email FROM users WHERE lower(email) = lower(?) LIMIT 1",
                (email.strip(),),
            ).fetchone()
            return dict(row) if row else None
        finally:
            connection.close()
    except Exception:
        return None


def get_user_by_id(user_id: int):
    try:
        connection = get_connection()
        try:
            row = connection.execute(
                "SELECT id, pseudo, email, created_at FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
            return dict(row) if row else None
        finally:
            connection.close()
    except Exception:
        return None


def update_password(user_id: int, hashed_password: str) -> None:
    connection = get_connection()
    try:
        connection.execute(
            "UPDATE users SET password = ? WHERE id = ?",
            (hashed_password, user_id),
        )
        connection.commit()
    finally:
        connection.close()


def set_user_email(user_id: int, email: str) -> None:
    connection = get_connection()
    try:
        connection.execute(
            "UPDATE users SET email = ? WHERE id = ?",
            (email.strip(), user_id),
        )
        connection.commit()
    finally:
        connection.close()


def mark_report_sent(user_id: int) -> None:
    connection = get_connection()
    try:
        connection.execute(
            "UPDATE users SET report_sent = 1 WHERE id = ?", (user_id,)
        )
        connection.commit()
    finally:
        connection.close()


def get_unsent_users():
    connection = get_connection()
    try:
        rows = connection.execute(
            "SELECT id, pseudo, email, created_at FROM users WHERE report_sent = 0"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        connection.close()


def set_cgu_accepted(user_id: int, accepted_at: str) -> None:
    connection = get_connection()
    try:
        connection.execute(
            "UPDATE users SET cgu_accepted = 1, cgu_accepted_at = ? WHERE id = ?",
            (accepted_at, user_id),
        )
        connection.commit()
    finally:
        connection.close()


def get_cgu_status(user_id: int) -> bool:
    connection = get_connection()
    try:
        row = connection.execute(
            "SELECT cgu_accepted FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        return bool(row and row["cgu_accepted"])
    finally:
        connection.close()