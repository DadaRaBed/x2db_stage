"""
Reinitialisation du mot de passe par code envoye par email (SMTP Gmail).

Flux :
1. L'utilisateur saisit son email
2. Le backend genere un code a 6 chiffres et l'envoie par email
3. L'utilisateur recopie le code recu
4. Il choisit un nouveau mot de passe
"""

import os
import random
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app_config import APP_NAME, APP_VERSION, DEVELOPER_EMAIL


class PasswordResetApi:
    CODE_VALIDITY_MINUTES = 15

    def __init__(self, auth_service):
        self._auth_service = auth_service
        self._pending_user_id = None
        self._pending_code = None
        self._pending_expires_at = None

    # ============================================================
    # ETAPE 1 : demande de reinitialisation
    # ============================================================
    def request_password_reset(self, email: str):
        try:
            email = (email or "").strip()
            if not email:
                return {"success": False, "message": "Veuillez saisir votre email."}

            # Verifier que l'email existe en BDD
            check = self._auth_service.check_email_exists(email)
            if not check.get("success"):
                return check

            # Generer un code a 6 chiffres
            code = f"{random.randint(0, 999999):06d}"

            # Sauvegarder en memoire avec expiration
            self._pending_user_id = check["user_id"]
            self._pending_code = code
            self._pending_expires_at = (
                datetime.now(timezone.utc)
                + timedelta(minutes=self.CODE_VALIDITY_MINUTES)
            )

            # Envoyer par email
            send_result = self._send_code_email(
                email=check["email"],
                pseudo=check["pseudo"],
                code=code,
            )
            if not send_result.get("success"):
                return {
                    "success": False,
                    "message": send_result.get("message", "Impossible d'envoyer le code."),
                }

            return {
                "success": True,
                "user_id": check["user_id"],
                "pseudo": check["pseudo"],
                "message": (
                    f"Un code de validation a ete envoye a {check['email']}. "
                    f"Verifiez votre boite de reception (et vos spams)."
                ),
            }
        except Exception as e:
            return {"success": False, "message": f"Erreur : {e}"}

    # ============================================================
    # ETAPE 2 : verification du code
    # ============================================================
    def verify_reset_code(self, user_id: int, code: str):
        try:
            if self._pending_user_id is None or self._pending_code is None:
                return {"success": False, "message": "Aucune demande en cours."}

            code = (code or "").strip()
            if not code:
                return {"success": False, "message": "Veuillez saisir le code."}

            if code != self._pending_code:
                return {"success": False, "message": "Code de validation incorrect."}

            if self._pending_expires_at and datetime.now(timezone.utc) > self._pending_expires_at:
                return {"success": False, "message": "Code expire. Veuillez refaire la demande."}

            return {"success": True, "message": "Code valide."}
        except Exception as e:
            return {"success": False, "message": f"Erreur : {e}"}

    # ============================================================
    # ETAPE 3 : nouveau mot de passe
    # ============================================================
    def confirm_password_reset(self, user_id: int, code: str, new_password: str):
        try:
            verify = self.verify_reset_code(user_id, code)
            if not verify.get("success"):
                return verify

            result = self._auth_service.reset_password(user_id, new_password)
            if result.get("success"):
                self._pending_user_id = None
                self._pending_code = None
                self._pending_expires_at = None
            return result
        except Exception as e:
            return {"success": False, "message": f"Erreur : {e}"}

    # ============================================================
    # ENVOI EMAIL
    # ============================================================
    def _send_code_email(self, email: str, pseudo: str, code: str):
        try:
            app_password = os.environ.get("GMAIL_APP_PASSWORD", "").strip()
            if not app_password:
                return {
                    "success": False,
                    "message": (
                        "Le service d'envoi d'email n'est pas configure. "
                        "Contactez le developpeur."
                    ),
                }

            subject = f"[{APP_NAME}] Reinitialisation de votre mot de passe"
            body = (
                f"Bonjour {pseudo},\n\n"
                f"Vous avez demande la reinitialisation de votre mot de passe {APP_NAME}.\n\n"
                f"Votre code de validation est :\n\n"
                f"        {code}\n\n"
                f"Ce code est valable pendant {self.CODE_VALIDITY_MINUTES} minutes.\n\n"
                f"Si vous n'etes pas a l'origine de cette demande, ignorez cet email.\n"
                f"Votre mot de passe restera inchange.\n\n"
                f"Cordialement,\n"
                f"L'equipe {APP_NAME} v{APP_VERSION}\n"
            )

            msg = MIMEMultipart()
            msg["From"] = f"{APP_NAME} <{DEVELOPER_EMAIL}>"
            msg["To"] = email
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain", "utf-8"))

            server = smtplib.SMTP("smtp.gmail.com", 587, timeout=15)
            server.starttls()
            server.login(DEVELOPER_EMAIL, app_password)
            server.send_message(msg)
            server.quit()

            return {"success": True, "message": "Email envoye."}
        except smtplib.SMTPAuthenticationError:
            return {
                "success": False,
                "message": (
                    "Erreur d'authentification SMTP. "
                    "Verifiez le mot de passe d'application Gmail."
                ),
            }
        except Exception as e:
            return {"success": False, "message": f"Erreur d'envoi : {e}"}
