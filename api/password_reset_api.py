"""
Reinitialisation du mot de passe par code de validation local.

Etapes :
1. L'utilisateur saisit son email -> verification en BDD
2. Si OK, l'app affiche un code de validation (prochain code disponible)
3. L'utilisateur recopie le code -> verification
4. L'utilisateur choisit un nouveau mot de passe -> mise a jour
5. Le code est marque comme utilise
"""

from repositories.codes_repository import (
    ensure_codes_file,
    get_next_available_code,
    mark_code_used,
    is_code_available,
    get_stats,
)


class PasswordResetApi:
    def __init__(self, auth_service):
        self._auth_service = auth_service
        self._pending_user_id = None
        self._pending_code = None

    # ============================================================
    # ETAPE 1 : verification de l'email + generation du code
    # ============================================================
    def request_password_reset(self, email: str):
        """
        Verifie que l'email existe en BDD puis retourne un code de validation
        que l'UI affichera a l'utilisateur.
        """
        try:
            ensure_codes_file()

            # Verifier que l'email existe
            check = self._auth_service.check_email_exists(email)
            if not check.get("success"):
                return check

            # Recuperer un code disponible
            code = get_next_available_code()
            if not code:
                return {
                    "success": False,
                    "message": "Aucun code de validation disponible. Contactez le developpeur.",
                }

            # Sauvegarder en memoire (marque utilise seulement a la confirmation)
            self._pending_user_id = check["user_id"]
            self._pending_code = code

            return {
                "success": True,
                "user_id": check["user_id"],
                "pseudo": check["pseudo"],
                "code": code,  # <-- A AFFICHER DANS L'INTERFACE
                "message": "Email verifie. Voici votre code de validation.",
            }
        except Exception as e:
            return {"success": False, "message": f"Erreur : {e}"}

    # ============================================================
    # ETAPE 2 : verification du code saisi
    # ============================================================
    def verify_reset_code(self, user_id: int, code: str):
        try:
            if self._pending_user_id is None or self._pending_code is None:
                return {"success": False, "message": "Aucune demande en cours."}

            code = (code or "").strip().upper()
            if not code:
                return {"success": False, "message": "Veuillez saisir le code."}

            if code != self._pending_code:
                return {"success": False, "message": "Code de validation incorrect."}

            if not is_code_available(code):
                return {"success": False, "message": "Ce code a deja ete utilise."}

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
                mark_code_used(self._pending_code)
                self._pending_user_id = None
                self._pending_code = None
            return result
        except Exception as e:
            return {"success": False, "message": f"Erreur : {e}"}

    # ============================================================
    # STATISTIQUES
    # ============================================================
    def get_codes_stats(self):
        try:
            ensure_codes_file()
            return {"success": True, "stats": get_stats()}
        except Exception as e:
            return {"success": False, "message": str(e)}