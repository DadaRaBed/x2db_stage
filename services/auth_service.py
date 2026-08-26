from datetime import datetime, timezone
import hashlib
import hmac
import secrets
import sqlite3

from repositories.system_database import get_connection


class AuthService:
    ITERATIONS = 300_000

    @staticmethod
    def _hash_password(password):
        salt = secrets.token_bytes(16)

        password_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            AuthService.ITERATIONS
        )

        return (
            f"pbkdf2_sha256$"
            f"{AuthService.ITERATIONS}$"
            f"{salt.hex()}$"
            f"{password_hash.hex()}"
        )

    @staticmethod
    def _verify_password(password, stored_password):
        try:
            algorithm, iterations, salt_hex, hash_hex = (
                stored_password.split("$")
            )

            if algorithm != "pbkdf2_sha256":
                return False

            calculated_hash = hashlib.pbkdf2_hmac(
                "sha256",
                password.encode("utf-8"),
                bytes.fromhex(salt_hex),
                int(iterations)
            )

            return hmac.compare_digest(
                calculated_hash.hex(),
                hash_hex
            )

        except (ValueError, TypeError):
            return False

    def create_first_user(self, pseudo, password):
        pseudo = pseudo.strip()

        if not pseudo:
            return {
                "success": False,
                "message": "Le pseudo est obligatoire."
            }

        if len(password) < 6:
            return {
                "success": False,
                "message": "Le mot de passe doit contenir au moins 6 caractères."
            }

        connection = get_connection()

        try:
            existing_user = connection.execute(
                "SELECT id FROM users LIMIT 1"
            ).fetchone()

            if existing_user:
                return {
                    "success": False,
                    "message": "Le premier utilisateur existe déjà."
                }

            created_at = datetime.now(timezone.utc).isoformat()
            hashed_password = self._hash_password(password)

            connection.execute(
                """
                INSERT INTO users
                    (pseudo, password, created_at, is_active)
                VALUES (?, ?, ?, 1)
                """,
                (pseudo, hashed_password, created_at)
            )

            connection.commit()

            return {
                "success": True,
                "message": "Utilisateur créé avec succès."
            }

        except sqlite3.IntegrityError:
            return {
                "success": False,
                "message": "Ce pseudo existe déjà."
            }

        finally:
            connection.close()

    def login(self, pseudo, password):
        connection = get_connection()

        user = connection.execute(
            """
            SELECT id, pseudo, password, is_active
            FROM users
            WHERE pseudo = ?
            """,
            (pseudo.strip(),)
        ).fetchone()

        connection.close()

        if not user or not user["is_active"]:
            return {
                "success": False,
                "message": "Pseudo ou mot de passe incorrect."
            }

        if not self._verify_password(password, user["password"]):
            return {
                "success": False,
                "message": "Pseudo ou mot de passe incorrect."
            }

        return {
            "success": True,
            "user": {
                "id": user["id"],
                "pseudo": user["pseudo"]
            }
        }
