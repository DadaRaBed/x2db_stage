from datetime import datetime, timezone
import hashlib
import hmac
import secrets
import sqlite3

from repositories.system_database import (
    get_connection,
    set_cgu_accepted,
)
from app_config import MIN_PASSWORD_LENGTH


class AuthService:
    ITERATIONS = 300_000

    # ============================================================
    # HASHAGE
    # ============================================================
    @staticmethod
    def _hash_password(password):
        salt = secrets.token_bytes(16)

        password_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            AuthService.ITERATIONS,
        )

        return (
            f"pbkdf2_sha256$"
            f"{AuthService.ITERATIONS}$"
            f"{salt.hex()}$"
            f"{password_hash.hex()}"
        )

    @staticmethod
    def hash_password(password: str) -> str:
        return AuthService._hash_password(password)

    @staticmethod
    def _verify_password(password, stored_password):
        try:
            algorithm, iterations, salt_hex, hash_hex = stored_password.split("$")
            if algorithm != "pbkdf2_sha256":
                return False
            calculated_hash = hashlib.pbkdf2_hmac(
                "sha256",
                password.encode("utf-8"),
                bytes.fromhex(salt_hex),
                int(iterations),
            )
            return hmac.compare_digest(calculated_hash.hex(), hash_hex)
        except (ValueError, TypeError):
            return False

    # ============================================================
    # CREATION
    # ============================================================
    def create_first_user(self, pseudo, password, email=""):
        pseudo = (pseudo or "").strip()
        email = (email or "").strip()

        if not pseudo:
            return {"success": False, "message": "Le pseudo est obligatoire."}

        if len(password) < MIN_PASSWORD_LENGTH:
            return {
                "success": False,
                "message": f"Le mot de passe doit contenir au moins {MIN_PASSWORD_LENGTH} caracteres.",
            }

        connection = get_connection()
        try:
            existing_user = connection.execute(
                "SELECT id FROM users LIMIT 1"
            ).fetchone()

            if existing_user:
                return {"success": False, "message": "Le premier utilisateur existe deja."}

            created_at = datetime.now(timezone.utc).isoformat()
            hashed_password = self._hash_password(password)

            connection.execute(
                """
                INSERT INTO users
                    (pseudo, password, email, created_at, is_active, cgu_accepted)
                VALUES (?, ?, ?, ?, 1, 0)
                """,
                (pseudo, hashed_password, email, created_at),
            )
            connection.commit()
            return {"success": True, "message": "Utilisateur cree avec succes."}
        except sqlite3.IntegrityError:
            return {"success": False, "message": "Ce pseudo existe deja."}
        finally:
            connection.close()

    # ============================================================
    # LOGIN
    # ============================================================
    def login(self, pseudo, password):
        connection = get_connection()
        try:
            user = connection.execute(
                """
                SELECT id, pseudo, password, email, is_active, cgu_accepted
                FROM users WHERE pseudo = ?
                """,
                ((pseudo or "").strip(),),
            ).fetchone()
        finally:
            connection.close()

        if not user or not user["is_active"]:
            return {"success": False, "message": "Pseudo ou mot de passe incorrect."}

        if not self._verify_password(password, user["password"]):
            return {"success": False, "message": "Pseudo ou mot de passe incorrect."}

        return {
            "success": True,
            "user": {
                "id": user["id"],
                "pseudo": user["pseudo"],
                "email": user["email"] or "",
                "cgu_accepted": bool(user["cgu_accepted"]),
            },
        }

    # ============================================================
    # MOT DE PASSE OUBLIE
    # ============================================================
    def check_email_exists(self, email: str):
        """Verifie qu'un email est bien enregistre dans la base."""
        from repositories.system_database import get_user_by_email

        email = (email or "").strip()
        if not email:
            return {"success": False, "message": "Veuillez saisir votre email."}

        user = get_user_by_email(email)
        if not user:
            return {
                "success": False,
                "message": "Aucun compte associe a cet email.",
            }

        return {
            "success": True,
            "user_id": user["id"],
            "pseudo": user["pseudo"],
            "email": user["email"],
        }

    def reset_password(self, user_id: int, new_password: str):
        from repositories.system_database import update_password

        if len(new_password or "") < MIN_PASSWORD_LENGTH:
            return {
                "success": False,
                "message": f"Le mot de passe doit contenir au moins {MIN_PASSWORD_LENGTH} caracteres.",
            }

        hashed = self._hash_password(new_password)
        update_password(user_id, hashed)
        return {"success": True, "message": "Mot de passe reinitialise avec succes."}

    # ============================================================
    # CGU
    # ============================================================
    def accept_cgu(self, user_id: int):
        try:
            set_cgu_accepted(user_id, datetime.now(timezone.utc).isoformat())
            return {"success": True, "message": "CGU acceptees."}
        except Exception as e:
            return {"success": False, "message": str(e)}