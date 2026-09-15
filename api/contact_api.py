"""
Envoi d'email de contact au developpeur.
"""

import os
import sys

from app_config import APP_NAME, APP_VERSION, DEVELOPER_EMAIL


class ContactApi:
    def send_contact_email(self, subject: str, body: str, user_email: str = ""):
        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart

            if not subject.strip():
                subject = f"[{APP_NAME}] Demande de contact"

            from services.config_service import get_gmail_app_password
            app_password = get_gmail_app_password()

            # Fallback mailto
            if not app_password:
                import urllib.parse
                import webbrowser

                mail_subject = urllib.parse.quote(subject)
                mail_body = urllib.parse.quote(body)
                mailto = f"mailto:{DEVELOPER_EMAIL}?subject={mail_subject}&body={mail_body}"
                webbrowser.open(mailto)
                return {
                    "success": True,
                    "method": "mailto",
                    "message": "Votre client de messagerie a ete ouvert.",
                }

            # SMTP Gmail
            smtp_user = DEVELOPER_EMAIL
            smtp_server = "smtp.gmail.com"
            smtp_port = 587

            msg = MIMEMultipart()
            msg["From"] = smtp_user
            msg["To"] = DEVELOPER_EMAIL
            msg["Subject"] = subject

            sender_info = f"\n\n---\nEnvoye depuis {APP_NAME} v{APP_VERSION}"
            if user_email.strip():
                sender_info += f"\nEmail de l'utilisateur : {user_email}"
            sender_info += f"\nPlateforme : {sys.platform}"

            msg.attach(MIMEText(body + sender_info, "plain", "utf-8"))

            server = smtplib.SMTP(smtp_server, smtp_port, timeout=15)
            server.starttls()
            server.login(smtp_user, app_password)
            server.send_message(msg)
            server.quit()

            return {
                "success": True,
                "method": "smtp",
                "message": "Email envoye avec succes au developpeur.",
            }
        except Exception as e:
            return {"success": False, "message": f"Erreur lors de l'envoi : {e}"}