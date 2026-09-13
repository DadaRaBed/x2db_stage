"""
Gestion de l'authentification utilisateur.
"""

from app_config import APP_NAME, APP_VERSION
from api.utils import release_resources


class AuthApi:
    def __init__(self, auth_service, password_reset_api=None):
        self._auth_service = auth_service
        self._password_reset = password_reset_api
        self.current_user = None

    # ============================================================
    # STATUT
    # ============================================================
    def get_auth_status(self):
        from repositories.system_database import user_count

        try:
            return {
                "success": True,
                "first_user_exists": user_count() > 0,
                "authenticated": self.current_user is not None,
                "user": self.current_user,
            }
        except Exception as e:
            return {
                "success": False,
                "first_user_exists": False,
                "authenticated": False,
                "user": None,
                "message": f"Impossible de verifier le statut : {e}",
            }

    # ============================================================
    # CREATION
    # ============================================================
    def create_first_user(self, pseudo: str, password: str, email: str = ""):
        try:
            return self._auth_service.create_first_user(pseudo, password, email)
        except Exception as e:
            return {
                "success": False,
                "message": f"Impossible de creer l'utilisateur : {e}",
            }

    # ============================================================
    # LOGIN / LOGOUT
    # ============================================================
    def login(self, pseudo: str, password: str):
        try:
            result = self._auth_service.login(pseudo, password)
            if result.get("success"):
                self.current_user = result.get("user")
            return result
        except Exception as e:
            return {
                "success": False,
                "message": f"Impossible de se connecter : {e}",
            }

    def logout(self, database_service, active_db_path, is_loading, loading_start_time):
        import time

        try:
            if active_db_path is not None:
                return {
                    "success": False,
                    "message": (
                        "Une base de donnees est encore ouverte. "
                        "Veuillez cliquer sur le bouton 'Terminer' pour fermer "
                        "la base avant de vous deconnecter."
                    ),
                    "error_type": "database_still_open",
                    "active_db_path": active_db_path,
                }

            if is_loading:
                elapsed = time.time() - (loading_start_time or time.time())
                if elapsed < 5:
                    return {
                        "success": False,
                        "message": "Une operation est en cours. Veuillez patienter.",
                        "error_type": "operation_in_progress",
                    }

            self.current_user = None
            try:
                database_service.close_database()
            except Exception:
                pass

            release_resources(0.15)
            return {"success": True, "message": "Deconnexion reussie."}
        except Exception:
            self.current_user = None
            return {"success": True, "message": "Deconnexion reussie."}

    # ============================================================
    # MOT DE PASSE OUBLIE
    # ============================================================
    def request_password_reset(self, email: str):
        if not self._password_reset:
            return {"success": False, "message": "Service indisponible."}
        return self._password_reset.request_password_reset(email)

    def verify_reset_code(self, user_id, code):
        if not self._password_reset:
            return {"success": False, "message": "Service indisponible."}
        return self._password_reset.verify_reset_code(user_id, code)

    def confirm_password_reset(self, user_id, code, new_password):
        if not self._password_reset:
            return {"success": False, "message": "Service indisponible."}
        return self._password_reset.confirm_password_reset(user_id, code, new_password)

    def get_codes_stats(self):
        if not self._password_reset:
            return {"success": False, "message": "Service indisponible."}
        return self._password_reset.get_codes_stats()

    # ============================================================
    # CGU
    # ============================================================
    def accept_cgu(self):
        if not self.current_user:
            return {"success": False, "message": "Aucun utilisateur connecte."}
        result = self._auth_service.accept_cgu(self.current_user["id"])
        if result.get("success"):
            self.current_user["cgu_accepted"] = True
        return result

    def get_cgu_status(self):
        if not self.current_user:
            return {"success": False, "accepted": False}
        try:
            from repositories.system_database import get_cgu_status as _get
            accepted = _get(self.current_user["id"])
            return {"success": True, "accepted": accepted}
        except Exception as e:
            return {"success": False, "accepted": False, "message": str(e)}