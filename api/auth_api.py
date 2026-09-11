"""
Gestion de l'authentification utilisateur.
"""

from app_config import APP_NAME, APP_VERSION
from api.utils import release_resources


class AuthApi:
    def __init__(self, auth_service):
        self._auth_service = auth_service
        self.current_user = None

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
                "message": f"Impossible de verifier le statut d'authentification : {e}",
            }

    def create_first_user(self, pseudo: str, password: str):
        try:
            return self._auth_service.create_first_user(pseudo, password)
        except Exception as e:
            return {
                "success": False,
                "message": f"Impossible de creer l'utilisateur : {e}",
            }

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
        """
        Deconnexion. Retourne un dict avec error_type si impossible.
        """
        import time

        try:
            if active_db_path is not None:
                return {
                    "success": False,
                    "message": "Une base de donnees est encore ouverte. Veuillez cliquer sur le bouton 'Terminer' pour fermer la base avant de vous deconnecter.",
                    "error_type": "database_still_open",
                    "active_db_path": active_db_path,
                }

            if is_loading:
                elapsed = time.time() - (loading_start_time or time.time())
                if elapsed < 5:
                    return {
                        "success": False,
                        "message": "Une operation est en cours. Veuillez patienter avant de vous deconnecter.",
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