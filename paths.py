"""
Gestion des chemins selon le mode d'execution (DEV vs EXE PyInstaller).
"""

import os
import sys
from pathlib import Path
from typing import Optional


def get_app_data_dir() -> Path:
    """
    Retourne le dossier ou stocker les donnees utilisateur (persistant).

    - Mode EXE PyInstaller : %APPDATA%/xl2db/data (Windows)
                             ~/.local/share/xl2db/data (Linux/macOS)
    - Mode DEV             : <projet>/data

    Le dossier est cree automatiquement s'il n'existe pas.
    """
    if getattr(sys, "frozen", False):
        if sys.platform == "win32":
            base = Path(os.environ.get("APPDATA", os.path.expanduser("~")))
        else:
            base = Path(os.path.expanduser("~/.local/share"))
        app_dir = base / "xl2db"
    else:
        app_dir = Path(__file__).resolve().parent

    data_dir = app_dir / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def get_resource_path(relative_path: str) -> Path:
    """
    Retourne le chemin vers une ressource embarquee (web/index.html...).

    - Mode EXE : _MEIPASS (dossier temporaire PyInstaller) ou dossier de l'exe
    - Mode DEV : dossier du projet
    """
    if getattr(sys, "frozen", False):
        base = Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    else:
        base = Path(__file__).resolve().parent
    return base / relative_path


def get_icon_path() -> Optional[str]:
    """Retourne le chemin vers l'icone selon le mode (dev/exe)."""
    if getattr(sys, "frozen", False):
        base = Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    else:
        base = Path(__file__).resolve().parent

    icon = base / "assets" / "icons" / "icon.ico"
    if icon.exists():
        return str(icon)
    return None


# ============================================================
# CONSTANTES GLOBALES
# ============================================================
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = get_app_data_dir()
INDEX_FILE = get_resource_path("web/index.html")

_APP_WINDOW = None


def set_app_window(window):
    """Enregistre la fenetre principale pour usage global."""
    global _APP_WINDOW
    _APP_WINDOW = window


def get_app_window():
    """Retourne la fenetre principale."""
    return _APP_WINDOW