"""
Gestion de la configuration sensible (mot de passe Gmail).

Fonctionnalites :
- Creation automatique du fichier config.json au premier lancement
- Chiffrement du mot de passe avec Fernet (AES 128 + HMAC)
- Cle de chiffrement stockee separement dans un fichier .key
- Migration transparente : supporte les anciens config.json en clair

Ordre de recherche du mot de passe :
1. Variable d'environnement GMAIL_APP_PASSWORD
2. Fichier config.json (dechiffre)
3. Fichier .env (legacy, deconseille)
4. Valeur embarquee dans app_config.py (fallback final)
"""

import json
import os
import stat
import sys
from pathlib import Path
from typing import Optional

# Import differe pour eviter les erreurs si cryptography n'est pas installe
try:
    from cryptography.fernet import Fernet, InvalidToken
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False


CONFIG_FILENAME = "config.json"
KEY_FILENAME = ".key"


# ============================================================
# CHEMINS
# ============================================================
def _get_app_data_dir() -> Path:
    """Retourne le dossier de donnees persistant (identique a paths.py)."""
    if getattr(sys, "frozen", False):
        if sys.platform == "win32":
            base = Path(os.environ.get("APPDATA", os.path.expanduser("~")))
        else:
            base = Path(os.path.expanduser("~/.local/share"))
        app_dir = base / "xl2db"
    else:
        app_dir = Path(__file__).resolve().parent.parent

    data_dir = app_dir / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def _get_exe_dir() -> Path:
    """Retourne le dossier de l'exe (mode frozen) ou du projet (mode DEV)."""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent
    return Path(__file__).resolve().parent.parent


def get_config_path() -> Path:
    return _get_app_data_dir() / CONFIG_FILENAME


def get_key_path() -> Path:
    return _get_app_data_dir() / KEY_FILENAME


# ============================================================
# GESTION DE LA CLE DE CHIFFREMENT
# ============================================================
def _load_or_create_key() -> Optional[bytes]:
    """Charge la cle de chiffrement, ou la cree si elle n'existe pas."""
    if not CRYPTO_AVAILABLE:
        return None

    key_path = get_key_path()

    if key_path.exists():
        try:
            with open(key_path, "rb") as f:
                key = f.read().strip()
            # Valider que la cle est utilisable
            Fernet(key)
            return key
        except Exception as e:
            print(f"[CONFIG] Cle invalide, regeneration : {e}")

    # Generer une nouvelle cle
    try:
        new_key = Fernet.generate_key()
        with open(key_path, "wb") as f:
            f.write(new_key)

        # Restreindre les permissions (Unix uniquement)
        if sys.platform != "win32":
            try:
                os.chmod(key_path, stat.S_IRUSR | stat.S_IWUSR)  # 600
            except Exception:
                pass

        print(f"[CONFIG] Nouvelle cle generee : {key_path}")
        return new_key
    except Exception as e:
        print(f"[CONFIG] Impossible de creer la cle : {e}")
        return None


def _encrypt(plaintext: str) -> str:
    """Chiffre une chaine. Retourne un prefixe 'enc:' + base64."""
    if not CRYPTO_AVAILABLE or not plaintext:
        return plaintext

    key = _load_or_create_key()
    if not key:
        return plaintext

    try:
        f = Fernet(key)
        token = f.encrypt(plaintext.encode("utf-8"))
        return "enc:" + token.decode("ascii")
    except Exception as e:
        print(f"[CONFIG] Erreur chiffrement : {e}")
        return plaintext


def _decrypt(value: str) -> str:
    """Dechiffre une chaine si elle commence par 'enc:'."""
    if not value:
        return ""

    if not value.startswith("enc:"):
        # Valeur en clair (ancien format) → retourner tel quel
        return value

    if not CRYPTO_AVAILABLE:
        print("[CONFIG] cryptography non installe, impossible de dechiffrer")
        return ""

    key = _load_or_create_key()
    if not key:
        return ""

    try:
        f = Fernet(key)
        token = value[4:].encode("ascii")
        return f.decrypt(token).decode("utf-8")
    except InvalidToken:
        print("[CONFIG] Token invalide (mauvaise cle ou fichier corrompu)")
        return ""
    except Exception as e:
        print(f"[CONFIG] Erreur dechiffrement : {e}")
        return ""


# ============================================================
# INITIALISATION DU FICHIER DE CONFIG
# ============================================================
def ensure_config_file() -> bool:
    """
    Cree config.json s'il n'existe pas.
    Retourne True si le fichier existe (ou a ete cree).
    """
    config_path = get_config_path()

    if config_path.exists():
        return True

    try:
        default_config = {
            "version": 1,
            "gmail_app_password": "",
            "created_at": _now_iso(),
            "encrypted": CRYPTO_AVAILABLE,
        }

        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(default_config, f, indent=2, ensure_ascii=False)

        # Restreindre les permissions (Unix)
        if sys.platform != "win32":
            try:
                os.chmod(config_path, stat.S_IRUSR | stat.S_IWUSR)  # 600
            except Exception:
                pass

        # Creer aussi la cle au premier lancement
        if CRYPTO_AVAILABLE:
            _load_or_create_key()

        print(f"[CONFIG] Fichier cree : {config_path}")
        return True
    except Exception as e:
        print(f"[CONFIG] Impossible de creer config.json : {e}")
        return False


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


# ============================================================
# LECTURE / ECRITURE
# ============================================================
def _load_config() -> dict:
    """Charge le contenu de config.json (raw, non dechiffre)."""
    config_path = get_config_path()
    if not config_path.exists():
        return {}
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"[CONFIG] config.json corrompu : {e}")
        return {}
    except Exception as e:
        print(f"[CONFIG] Erreur lecture config : {e}")
        return {}


def _save_config(data: dict) -> bool:
    """Sauvegarde le contenu dans config.json."""
    config_path = get_config_path()
    try:
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"[CONFIG] Erreur sauvegarde : {e}")
        return False


# ============================================================
# API PUBLIQUE
# ============================================================
def get_gmail_app_password() -> str:
    """
    Recupere le mot de passe Gmail depuis plusieurs sources, dans l'ordre :
    1. Variable d'environnement GMAIL_APP_PASSWORD
    2. config.json (dechiffre)
    3. Fichier .env a cote de l'exe (legacy)
    4. app_config.GMAIL_APP_PASSWORD (fallback final)
    """
    # 1. Variable d'environnement
    env_value = os.environ.get("GMAIL_APP_PASSWORD", "").strip()
    if env_value:
        print("[CONFIG] Mot de passe trouve dans l'environnement")
        return env_value

    # 2. config.json
    data = _load_config()
    raw = data.get("gmail_app_password", "")
    if raw:
        decrypted = _decrypt(raw)
        if decrypted:
            print("[CONFIG] Mot de passe trouve dans config.json")
            return decrypted.strip()

    # 3. .env
    try:
        env_file = _get_exe_dir() / ".env"
        if env_file.exists():
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("GMAIL_APP_PASSWORD="):
                        value = line.split("=", 1)[1].strip().strip('"').strip("'")
                        if value:
                            print(f"[CONFIG] Mot de passe trouve dans {env_file}")
                            return value
    except Exception:
        pass

    # 4. app_config.py
    try:
        from app_config import GMAIL_APP_PASSWORD as EMBEDDED
        if EMBEDDED and EMBEDDED.strip():
            print("[CONFIG] Mot de passe trouve dans app_config.py")
            return EMBEDDED.strip()
    except (ImportError, AttributeError):
        pass

    print("[CONFIG] Aucun mot de passe Gmail configure")
    return ""


def save_gmail_app_password(password: str) -> bool:
    """
    Sauvegarde le mot de passe Gmail (chiffre) dans config.json.
    Cree le fichier s'il n'existe pas.
    """
    ensure_config_file()

    data = _load_config()
    data.setdefault("version", 1)
    data.setdefault("created_at", _now_iso())
    data["encrypted"] = CRYPTO_AVAILABLE
    data["updated_at"] = _now_iso()
    data["gmail_app_password"] = _encrypt(password.strip())

    return _save_config(data)


def clear_gmail_app_password() -> bool:
    """Efface le mot de passe Gmail du fichier config.json."""
    data = _load_config()
    data["gmail_app_password"] = ""
    data["updated_at"] = _now_iso()
    return _save_config(data)


def get_config_status() -> dict:
    """
    Retourne l'etat de la configuration.
    Utile pour afficher dans une interface d'administration.
    """
    config_path = get_config_path()
    key_path = get_key_path()

    data = _load_config()
    raw = data.get("gmail_app_password", "")
    decrypted = _decrypt(raw) if raw else ""

    return {
        "config_exists": config_path.exists(),
        "config_path": str(config_path),
        "key_exists": key_path.exists(),
        "key_path": str(key_path),
        "crypto_available": CRYPTO_AVAILABLE,
        "has_password": bool(decrypted),
        "password_encrypted": raw.startswith("enc:") if raw else False,
        "env_var_set": bool(os.environ.get("GMAIL_APP_PASSWORD", "").strip()),
    }