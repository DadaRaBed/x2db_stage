"""
Verification des mises a jour GitHub et auto-update.
"""

import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from app_config import APP_NAME, APP_VERSION, GITHUB_API_LATEST
from paths import get_app_window


class UpdatesApi:
    def get_app_info(self):
        return {
            "success": True,
            "app_name": APP_NAME,
            "app_version": APP_VERSION,
            "developer_name": "DadaRaBed",
            "developer_email": "nanoonadjah3@gmail.com",
            "github_repo": "DadaRaBed/xl2db_stage",
            "python_version": sys.version.split()[0],
            "platform": sys.platform,
            "frozen": getattr(sys, "frozen", False),
        }

    @staticmethod
    def _has_internet(timeout: float = 3.0) -> bool:
        for host, port in (("8.8.8.8", 53), ("1.1.1.1", 53), ("github.com", 443)):
            try:
                socket.create_connection((host, port), timeout=timeout).close()
                return True
            except OSError:
                continue
        return False

    def check_for_updates(self):
        import urllib.request
        import urllib.error

        if not self._has_internet():
            return {
                "success": False,
                "no_internet": True,
                "message": "Connexion impossible : Pas de connexion internet ou reseau indisponible.",
            }

        try:
            req = urllib.request.Request(
                GITHUB_API_LATEST,
                headers={"User-Agent": f"{APP_NAME}/{APP_VERSION}"},
            )

            try:
                with urllib.request.urlopen(req, timeout=10) as response:
                    data = json.loads(response.read().decode("utf-8"))
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    return {
                        "success": True,
                        "up_to_date": True,
                        "current_version": APP_VERSION,
                        "latest_version": APP_VERSION,
                        "message": "Aucune version publiee sur GitHub pour le moment.",
                    }
                return {"success": False, "message": f"Erreur HTTP {e.code}."}
            except urllib.error.URLError:
                return {
                    "success": False,
                    "no_internet": True,
                    "message": "Connexion impossible : Pas de connexion internet ou reseau indisponible.",
                }

            latest_version = (data.get("tag_name") or "").lstrip("v").strip()
            if not latest_version:
                return {"success": False, "message": "Impossible de determiner la derniere version."}

            release_notes = data.get("body", "")
            published_at = data.get("published_at", "")
            html_url = data.get("html_url", "")

            download_url = html_url
            for asset in data.get("assets", []):
                name = asset.get("name", "").lower()
                if name.endswith(".exe") or name.endswith(".zip"):
                    download_url = asset.get("browser_download_url", html_url)
                    break

            def parse_version(v):
                try:
                    return tuple(int(x) for x in re.findall(r"\d+", v))
                except Exception:
                    return (0,)

            is_up_to_date = parse_version(latest_version) <= parse_version(APP_VERSION)

            return {
                "success": True,
                "up_to_date": is_up_to_date,
                "current_version": APP_VERSION,
                "latest_version": latest_version,
                "download_url": download_url,
                "release_notes": release_notes[:2000],
                "published_at": published_at,
                "html_url": html_url,
            }
        except Exception as e:
            return {"success": False, "message": f"Impossible de verifier les mises a jour : {e}"}

    def download_and_install_update(self, download_url: str):
        import urllib.request

        try:
            if not self._has_internet():
                return {
                    "success": False,
                    "no_internet": True,
                    "message": "Connexion impossible : Pas de connexion internet ou reseau indisponible.",
                }

            if not getattr(sys, "frozen", False):
                return {
                    "success": False,
                    "message": "La mise a jour auto n'est disponible qu'en mode .exe",
                }

            current_exe = sys.executable
            temp_dir = Path(tempfile.gettempdir())
            new_exe = temp_dir / "xl2db_new.exe"

            try:
                req = urllib.request.Request(
                    download_url,
                    headers={"User-Agent": f"{APP_NAME}/{APP_VERSION}"},
                )
                with urllib.request.urlopen(req, timeout=120) as response:
                    with open(new_exe, "wb") as f:
                        shutil.copyfileobj(response, f)
            except Exception as e:
                return {"success": False, "message": f"Echec du telechargement : {e}"}

            if not new_exe.exists() or new_exe.stat().st_size < 1_000_000:
                return {"success": False, "message": "Le fichier telecharge est invalide."}

            bat_file = temp_dir / "xl2db_update.bat"
            bat_content = f"""@echo off
chcp 65001 > nul
timeout /t 3 /nobreak > nul
:retry
move /y "{new_exe}" "{current_exe}" 2>nul
if errorlevel 1 (
    timeout /t 1 /nobreak > nul
    goto retry
)
start "" "{current_exe}"
del "%~f0"
"""
            with open(bat_file, "w", encoding="utf-8") as f:
                f.write(bat_content)

            try:
                subprocess.Popen(
                    ["cmd.exe", "/c", str(bat_file)],
                    creationflags=subprocess.CREATE_NO_WINDOW,
                    shell=False,
                )
            except Exception as e:
                return {"success": False, "message": f"Impossible de lancer le script : {e}"}

            time.sleep(0.5)
            os._exit(0)
        except Exception as e:
            return {"success": False, "message": f"Erreur lors de la mise a jour : {e}"}

    def open_url_in_browser(self, url: str):
        try:
            import webbrowser
            webbrowser.open(url)
            return {"success": True}
        except Exception as e:
            return {"success": False, "message": str(e)}