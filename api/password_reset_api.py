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
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app_config import (
    APP_NAME,
    APP_VERSION,
    APP_EDITION,
    DEVELOPER_EMAIL,
    DEVELOPER_NAME,
)


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

            check = self._auth_service.check_email_exists(email)
            if not check.get("success"):
                return check

            code = f"{random.randint(0, 999999):06d}"

            self._pending_user_id = check["user_id"]
            self._pending_code = code
            self._pending_expires_at = (
                datetime.now(timezone.utc)
                + timedelta(minutes=self.CODE_VALIDITY_MINUTES)
            )

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
                    f"Un code de verification a ete envoye a {check['email']}. "
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
                return {"success": False, "message": "Code de verification incorrect."}

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

            # ============================================================
            # VERSION TEXTE (fallback pour les vieux clients mail)
            # ============================================================
            body_text = (
                f"Bonjour {pseudo},\n\n"
                f"Vous avez recemment demande la reinitialisation de votre mot de passe "
                f"pour votre compte {APP_NAME}.\n\n"
                f"Voici votre code de verification :\n\n"
                f"        {code}\n\n"
                f"Ce code est valable pendant {self.CODE_VALIDITY_MINUTES} minutes. "
                f"Pour des raisons de securite, ne communiquez ce code a personne.\n\n"
                f"Si vous n'etes pas a l'origine de cette demande, aucune action n'est "
                f"requise de votre part. Votre mot de passe actuel restera inchange.\n\n"
                f"Cordialement,\n\n"
                f"L'equipe {APP_NAME}\n"
                f"Service de securite des comptes\n"
            )

            # ============================================================
            # VERSION HTML STYLISEE
            # ============================================================
            body_html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>Reinitialisation de mot de passe</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f0f4f1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f0f4f1; padding: 40px 16px;">
    <tr>
      <td align="center">

        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 32px rgba(26, 77, 58, 0.08); overflow: hidden;">

          <!-- ======================== -->
          <!-- EN-TETE                  -->
          <!-- ======================== -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a4d3a 0%, #2d6b52 50%, #3d8b6a 100%); padding: 44px 40px 40px 40px; text-align: center;">

              <!-- Logo XL -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto 18px auto;">
                <tr>
                  <td align="center" valign="middle" style="width: 64px; height: 64px; background: rgba(255, 255, 255, 0.18); border-radius: 16px; text-align: center; font-size: 26px; font-weight: 700; color: #ffffff; letter-spacing: 1px; font-family: 'Segoe UI', Arial, sans-serif; border: 1px solid rgba(255, 255, 255, 0.25);">
                    XL
                  </td>
                </tr>
              </table>

              <!-- Nom de l'app -->
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">{APP_NAME}</h1>
              <p style="margin: 6px 0 0 0; color: rgba(255, 255, 255, 0.85); font-size: 13px; font-weight: 400; letter-spacing: 0.3px;">
                {APP_EDITION} &nbsp;·&nbsp; v{APP_VERSION}
              </p>

            </td>
          </tr>

          <!-- ======================== -->
          <!-- BANDEAU DE CONFIRMATION  -->
          <!-- ======================== -->
          <tr>
            <td style="padding: 0; background: #e8f3ef; border-bottom: 1px solid #d4e8e0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding: 14px 40px; text-align: center;">
                    <p style="margin: 0; color: #1a4d3a; font-size: 13px; font-weight: 600; letter-spacing: 0.4px;">
                      <span style="display: inline-block; width: 8px; height: 8px; background: #27ae60; border-radius: 50%; margin-right: 8px; vertical-align: middle;"></span>
                      Demande de reinitialisation recue
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ======================== -->
          <!-- CORPS DU MESSAGE         -->
          <!-- ======================== -->
          <tr>
            <td style="padding: 40px 40px 20px 40px;">

              <!-- Salutation -->
              <h2 style="margin: 0 0 20px 0; color: #1a1a2e; font-size: 22px; font-weight: 600; line-height: 1.3;">
                Bonjour {pseudo},
              </h2>

              <!-- Intro -->
              <p style="margin: 0 0 8px 0; color: #475569; font-size: 15px; line-height: 1.65;">
                Vous avez recemment demande la reinitialisation de votre mot de passe pour votre compte
                <strong style="color: #1a4d3a;">{APP_NAME}</strong>.
              </p>

              <p style="margin: 0 0 28px 0; color: #475569; font-size: 15px; line-height: 1.65;">
                Voici votre code de verification :
              </p>

              <!-- ======================== -->
              <!-- ENCADRE DU CODE          -->
              <!-- ======================== -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 28px 0;">
                <tr>
                  <td align="center" style="background: linear-gradient(180deg, #f8fafc 0%, #eef4f1 100%); border: 2px dashed #1a4d3a; border-radius: 14px; padding: 32px 20px 26px 20px;">

                    <p style="margin: 0 0 12px 0; color: #64748b; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">
                      Code de verification
                    </p>

                    <div style="font-family: 'Courier New', Courier, 'Lucida Console', monospace; font-size: 42px; font-weight: 700; letter-spacing: 14px; color: #1a4d3a; line-height: 1.1; padding-left: 14px; word-break: keep-all;">{code}</div>

                    <p style="margin: 14px 0 0 0; color: #94a3b8; font-size: 12px; font-weight: 500;">
                      A saisir dans l'application
                    </p>

                  </td>
                </tr>
              </table>

              <!-- ======================== -->
              <!-- BANDEAU D'ATTENTION      -->
              <!-- ======================== -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 28px 0;">
                <tr>
                  <td style="background: #fff8e6; border-left: 4px solid #f39c12; border-radius: 8px; padding: 16px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td valign="top" style="width: 24px; padding-right: 12px;">
                          <span style="font-size: 18px; line-height: 1;">⏱</span>
                        </td>
                        <td valign="top">
                          <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.6;">
                            Ce code est valable pendant <strong>{self.CODE_VALIDITY_MINUTES} minutes</strong>.
                            Pour des raisons de securite, <strong>ne communiquez ce code a personne</strong>.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- ======================== -->
              <!-- SECURITE / RASSURANCE    -->
              <!-- ======================== -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 20px 0;">
                <tr>
                  <td style="background: #f8fafc; border-radius: 8px; padding: 16px 20px; border: 1px solid #e2e8f0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td valign="top" style="width: 24px; padding-right: 12px;">
                          <span style="font-size: 16px; line-height: 1;">🛡</span>
                        </td>
                        <td valign="top">
                          <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6;">
                            Si vous n'etes pas a l'origine de cette demande, aucune action n'est requise de votre part.
                            Votre mot de passe actuel <strong style="color: #475569;">restera inchange</strong>.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Signature -->
              <p style="margin: 32px 0 0 0; color: #475569; font-size: 15px; line-height: 1.65;">
                Cordialement,
              </p>

              <p style="margin: 8px 0 0 0; color: #1a1a2e; font-size: 15px; line-height: 1.65;">
                <strong>L'equipe {APP_NAME}</strong><br>
                <span style="color: #94a3b8; font-size: 13px; font-weight: 400;">Service de securite des comptes</span>
              </p>

            </td>
          </tr>

          <!-- ======================== -->
          <!-- SEPARATEUR               -->
          <!-- ======================== -->
          <tr>
            <td style="padding: 8px 40px 0 40px;">
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0 0 0;">
            </td>
          </tr>

          <!-- ======================== -->
          <!-- INFOS TECHNIQUES         -->
          <!-- ======================== -->
          <tr>
            <td style="padding: 20px 40px 10px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding: 6px 0;">
                    <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                      <strong style="color: #64748b;">Destinataire :</strong> {email}
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                      <strong style="color: #64748b;">Envoye le :</strong> {datetime.now().strftime('%d/%m/%Y a %H:%M')}
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                      <strong style="color: #64748b;">Application :</strong> {APP_NAME} v{APP_VERSION} ({APP_EDITION})
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ======================== -->
          <!-- PIED DE PAGE             -->
          <!-- ======================== -->
          <tr>
            <td style="background: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px 0; color: #94a3b8; font-size: 11px; line-height: 1.6;">
                Cet email a ete envoye automatiquement. Merci de ne pas y repondre.
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px; line-height: 1.6;">
                <strong style="color: #64748b;">{APP_NAME}</strong> &nbsp;·&nbsp; Developpe par {DEVELOPER_NAME}
              </p>
              <p style="margin: 8px 0 0 0; color: #cbd5e1; font-size: 10px;">
                © {datetime.now().year} {DEVELOPER_NAME}. Tous droits reserves.
              </p>
            </td>
          </tr>

        </table>

        <!-- Mention legale sous la carte -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; margin-top: 20px;">
          <tr>
            <td style="padding: 0 20px; text-align: center;">
              <p style="margin: 0; color: #a0aec0; font-size: 11px; line-height: 1.5;">
                Vous recevez cet email car une demande de reinitialisation a ete effectuee sur votre compte.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>
"""

            # ============================================================
            # CONSTRUCTION ET ENVOI DU MESSAGE
            # ============================================================
            msg = MIMEMultipart("alternative")
            msg["From"] = f"{APP_NAME} <{DEVELOPER_EMAIL}>"
            msg["To"] = email
            msg["Subject"] = subject
            msg["Reply-To"] = DEVELOPER_EMAIL

            # Ordre IMPORTANT : texte d'abord, HTML ensuite
            # Le client mail affiche la derniere partie qu'il supporte
            msg.attach(MIMEText(body_text, "plain", "utf-8"))
            msg.attach(MIMEText(body_html, "html", "utf-8"))

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
