"""
xl2db - Point d'entree de l'application.
"""

import sys

import webview

from paths import INDEX_FILE, get_icon_path, set_app_window
from app_config import APP_NAME, APP_VERSION
from api import Api


def main():
    """Initialise et lance l'application."""
    from repositories.system_database import initialize_database
    from services.config_service import ensure_config_file

    # 1. Initialiser system.db
    initialize_database()

    # 2.  Creer config.json s'il n'existe pas
    ensure_config_file()

    # 3. Creer l'API
    api = Api()

    # 3. Creer la fenetre
    window = webview.create_window(
        f"{APP_NAME} v{APP_VERSION}",
        str(INDEX_FILE),
        js_api=api,
        width=1280,
        height=800,
        resizable=True,
        fullscreen=False,
        maximized=True,
    )

    # 4.ENREGISTRER LA FENETRE DANS paths._APP_WINDOW
    #    (C'est cette ligne qui rend la fenetre disponible a l'API)
    set_app_window(window)
    
    webview.start()


if __name__ == "__main__":
    main()
