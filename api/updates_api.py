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
from paths import get_app_window, DATA_DIR


class UpdatesApi:
    def get_app_info(self):
        return {
            "success": True,
            "app_name": APP_NAME,
            "app_version": APP_VERSION,
            "developer_name": "DadaRaBed",
            "developer_email": "nanoonadjah3@gmail.com",
            "github_repo": "DadaRaBed/x2db_stage",
            "python_version": sys.version.split()[0],
            "platform": sys.platform,
            "frozen": getattr(sys, "frozen", False),
        }

    # ============================================================
    # VERIFICATION DE LA CONNEXION INTERNET
    # ============================================================
    @staticmethod
    def _has_internet(timeout: float = 3.0) -> bool:
        for host, port in (("8.8.8.8", 53), ("1.1.1.1", 53), ("github.com", 443)):
            try:
                socket.create_connection((host, port), timeout=timeout).close()
                return True
            except OSError:
                continue
        return False

    # ============================================================
    # VERIFICATION DES MISES A JOUR
    # ============================================================
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

    # ============================================================
    # HELPERS POUR LA NOTIFICATION POST-MAJ
    # ============================================================
    @staticmethod
    def _update_flag_path() -> Path:
        """Chemin du fichier drapeau indiquant une MAJ reussie."""
        return DATA_DIR / ".update_success"

    @staticmethod
    def _create_update_flag(new_version: str) -> None:
        """Cree le fichier drapeau avec la nouvelle version."""
        try:
            flag = UpdatesApi._update_flag_path()
            flag.parent.mkdir(parents=True, exist_ok=True)
            with open(flag, "w", encoding="utf-8") as f:
                json.dump({
                    "success": True,
                    "new_version": new_version,
                    "completed_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "from_version": APP_VERSION,
                }, f)
            print(f"[UPDATE] Drapeau cree : {flag}")
        except Exception as e:
            print(f"[UPDATE] Erreur creation drapeau : {e}")

    def check_pending_update_notification(self):
        """
        Verifie si une MAJ vient d'etre terminee.
        Retourne {success: True, just_updated: bool, new_version: str, from_version: str}
        et SUPPRIME le drapeau apres lecture.
        """
        try:
            flag = self._update_flag_path()
            if not flag.exists():
                return {"success": True, "just_updated": False}

            with open(flag, "r", encoding="utf-8") as f:
                data = json.load(f)

            # Supprimer le drapeau apres lecture
            try:
                flag.unlink()
            except Exception:
                pass

            return {
                "success": True,
                "just_updated": True,
                "new_version": data.get("new_version", ""),
                "from_version": data.get("from_version", ""),
                "completed_at": data.get("completed_at", ""),
            }
        except Exception as e:
            print(f"[UPDATE] Erreur lecture drapeau : {e}")
            return {"success": True, "just_updated": False}

    # ============================================================
    # TELECHARGEMENT ET INSTALLATION
    # ============================================================
    def download_and_install_update(self, download_url: str):
        """
        Telecharge et installe la mise a jour via script PowerShell.
        Fonctionne sur Windows uniquement (mode .exe).
        """
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

            current_exe = Path(sys.executable).resolve()
            temp_dir = Path(tempfile.gettempdir()).resolve()
            new_exe = temp_dir / "xl2db_new.exe"

            print(f"[UPDATE] EXE actuel : {current_exe}")
            print(f"[UPDATE] Temp dir  : {temp_dir}")
            print(f"[UPDATE] Nouvel exe : {new_exe}")

            # 1. Telecharger la nouvelle version
            try:
                req = urllib.request.Request(
                    download_url,
                    headers={"User-Agent": f"{APP_NAME}/{APP_VERSION}"},
                )
                with urllib.request.urlopen(req, timeout=180) as response:
                    with open(new_exe, "wb") as f:
                        shutil.copyfileobj(response, f)
                print(f"[UPDATE] Telechargement OK : {new_exe.stat().st_size} octets")
            except Exception as e:
                return {"success": False, "message": f"Echec du telechargement : {e}"}

            # 2. Verifier le fichier telecharge
            if not new_exe.exists():
                return {"success": False, "message": "Le fichier telecharge n'existe pas."}

            file_size = new_exe.stat().st_size
            if file_size < 1_000_000:
                return {
                    "success": False,
                    "message": f"Le fichier telecharge est invalide ({file_size} octets, minimum 1 Mo).",
                }

            # 3. Creer un drapeau de MAJ AVANT le remplacement
            # (l'app en cours d'execution va ecrire ce drapeau)
            self._create_update_flag("nouvelle_version")
            print("[UPDATE] Drapeau de MAJ cree")

            # 4. Creer le script PowerShell robuste
            ps_file = temp_dir / "xl2db_update.ps1"

            # Utiliser des singles quotes dans PowerShell pour eviter l'interpretation
            # On echappe les ' dans les chemins
            new_exe_ps = str(new_exe).replace("'", "''")
            old_exe_ps = str(current_exe).replace("'", "''")
            flag_path_ps = str(self._update_flag_path()).replace("'", "''")

            ps_content = f"""# Script de mise a jour xl2db
$ErrorActionPreference = 'SilentlyContinue'

$newExe = '{new_exe_ps}'
$oldExe = '{old_exe_ps}'
$flagPath = '{flag_path_ps}'

Write-Host "[UPDATE] Attente de la fermeture de l'application..."
Start-Sleep -Seconds 3

# Attendre que l'ancien exe soit deverrouille (jusqu'a 30 secondes)
$attempts = 0
$maxAttempts = 30
$success = $false

while ($attempts -lt $maxAttempts -and -not $success) {{
    $attempts++

    # Verifier que le nouvel exe existe toujours
    if (-not (Test-Path -LiteralPath $newExe)) {{
        Write-Host "[UPDATE] ERREUR : Le nouvel exe n'existe plus."
        break
    }}

    # Tenter le remplacement
    try {{
        # Supprimer l'ancien exe s'il existe
        if (Test-Path -LiteralPath $oldExe) {{
            Remove-Item -LiteralPath $oldExe -Force -ErrorAction Stop
        }}

        # Deplacer le nouveau vers l'ancien emplacement
        Move-Item -LiteralPath $newExe -Destination $oldExe -Force -ErrorAction Stop

        # Verifier que le nouveau fichier est en place
        if (Test-Path -LiteralPath $oldExe) {{
            $success = $true
            Write-Host "[UPDATE] Remplacement reussi (tentative $attempts)"
        }}
    }}
    catch {{
        Write-Host "[UPDATE] Tentative $attempts echouee : $($_.Exception.Message)"
        Start-Sleep -Seconds 1
    }}
}}

if ($success) {{
    # Ecrire un fichier de confirmation de MAJ
    try {{
        $confirmationData = @{{
            success = $true
            completed_at = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
            new_version = 'nouvelle_version'
        }} | ConvertTo-Json

        Set-Content -LiteralPath $flagPath -Value $confirmationData -Encoding UTF8
        Write-Host "[UPDATE] Confirmation ecrite dans $flagPath"
    }}
    catch {{
        Write-Host "[UPDATE] Impossible d'ecrire la confirmation : $($_.Exception.Message)"
    }}

    Write-Host "[UPDATE] Redemarrage de l'application..."
    Start-Sleep -Seconds 1

    # Relancer l'application
    try {{
        Start-Process -FilePath $oldExe
        Write-Host "[UPDATE] Application relancee"
    }}
    catch {{
        Write-Host "[UPDATE] Impossible de relancer l'app : $($_.Exception.Message)"
    }}
}} else {{
    Write-Host "[UPDATE] ECHEC de la mise a jour apres $maxAttempts tentatives."
}}

# Nettoyer le script lui-meme (suppression differee)
Start-Sleep -Seconds 2
Remove-Item -LiteralPath $MyInvocation.MyCommand.Path -Force -ErrorAction SilentlyContinue
"""

            with open(ps_file, "w", encoding="utf-8-sig") as f:
                f.write(ps_content)

            print(f"[UPDATE] Script PowerShell cree : {ps_file}")

            # 5. Lancer le script PowerShell en arriere-plan
            try:
                creation_flags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
                creation_flags |= subprocess.DETACHED_PROCESS if sys.platform == "win32" else 0

                subprocess.Popen(
                    [
                        "powershell.exe",
                        "-WindowStyle", "Hidden",
                        "-ExecutionPolicy", "Bypass",
                        "-File", str(ps_file),
                    ],
                    creationflags=creation_flags,
                    shell=False,
                    close_fds=True,
                )
                print("[UPDATE] Script PowerShell lance")
            except Exception as e:
                return {"success": False, "message": f"Impossible de lancer le script : {e}"}

            # 6. Fermer l'app immediatement pour liberer le fichier
            time.sleep(1)
            print("[UPDATE] Fermeture de l'application...")
            os._exit(0)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"success": False, "message": f"Erreur lors de la mise a jour : {e}"}

    # ============================================================
    # OUVERTURE URL
    # ============================================================
    def open_url_in_browser(self, url: str):
        try:
            import webbrowser
            webbrowser.open(url)
            return {"success": True}
        except Exception as e:
            return {"success": False, "message": str(e)}