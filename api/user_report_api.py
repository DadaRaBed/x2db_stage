"""
Rapport automatique des utilisateurs (une seule fois par compte).
"""

import os
import smtplib
import sys
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app_config import (
    APP_NAME,
    APP_VERSION,
    DEVELOPER_EMAIL,
    USER_REPORT_ENABLED,
    USER_REPORT_TIMEOUT_SECONDS,
)


class UserReportApi:
    def __init__(self, auth_service=None):
        self._auth_service = auth_service

    def send_user_report_once(self, user_id: int):
        """Envoie un rapport au developpeur une seule fois par utilisateur."""
        try:
            if not USER_REPORT_ENABLED:
                return {"success": True, "sent": False, "message": "Rapport desactive."}

            from repositories.system_database import (
                get_unsent_users,
                get_user_by_id,
                mark_report_sent,
            )

            user = get_user_by_id(user_id)
            if not user:
                return {"success": False, "sent": False, "message": "Utilisateur introuvable."}

            unsent_ids = {u["id"] for u in get_unsent_users()}
            if user_id not in unsent_ids:
                return {"success": True, "sent": False, "message": "Rapport deja envoye."}

            if not self._has_internet():
                return {"success": True, "sent": False, "message": "Pas de connexion internet."}

            result = self._send_report_email(user)
            if not result.get("success"):
                return {"success": False, "sent": False, "message": result.get("message")}

            mark_report_sent(user_id)
            return {"success": True, "sent": True, "message": "Rapport envoye."}
        except Exception as e:
            return {"success": False, "sent": False, "message": str(e)}

    def _has_internet(self, timeout: float = None) -> bool:
        import socket
        if timeout is None:
            timeout = USER_REPORT_TIMEOUT_SECONDS
        for host, port in (("8.8.8.8", 53), ("1.1.1.1", 53), ("smtp.gmail.com", 587)):
            try:
                socket.create_connection((host, port), timeout=timeout).close()
                return True
            except OSError:
                continue
        return False

    def _send_report_email(self, user: dict):
        try:
            app_password = os.environ.get("GMAIL_APP_PASSWORD", "").strip()
            if not app_password:
                return {"success": False, "message": "GMAIL_APP_PASSWORD non configure."}

            from repositories.system_database import user_count

            subject = f"[{APP_NAME}] Nouvel utilisateur : {user['pseudo']}"
            body = (
                f"Nouvel utilisateur enregistre dans {APP_NAME}.\n\n"
                f"Pseudo      : {user['pseudo']}\n"
                f"Email       : {user.get('email') or '(non renseigne)'}\n"
                f"User ID     : {user['id']}\n"
                f"Date        : {user.get('created_at', '-')}\n\n"
                f"Total utilisateurs connus : {user_count()}\n"
                f"Version app : {APP_VERSION}\n"
                f"Plateforme  : {sys.platform}\n"
                f"Envoye le   : {datetime.now().isoformat()}\n"
            )

            msg = MIMEMultipart()
            msg["From"] = DEVELOPER_EMAIL
            msg["To"] = DEVELOPER_EMAIL
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain", "utf-8"))

            server = smtplib.SMTP("smtp.gmail.com", 587, timeout=15)
            server.starttls()
            server.login(DEVELOPER_EMAIL, app_password)
            server.send_message(msg)
            server.quit()

            return {"success": True, "message": "Email envoye."}
        except Exception as e:
            return {"success": False, "message": f"Erreur d'envoi : {e}"}