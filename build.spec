# -*- mode: python ; coding: utf-8 -*-
"""
Fichier de configuration PyInstaller pour xl2db - Expert Edition.

Utilisation :
    pyinstaller build.spec              # mode onedir (recommande)
    pyinstaller build.spec -- --onefile # mode onefile (un seul .exe)

Le resultat se trouve dans dist/.
"""

import sys
import os
from pathlib import Path

# ============================================================
# CHEMINS DU PROJET
# ============================================================
PROJECT_ROOT = Path(SPECPATH).resolve()
MAIN_SCRIPT = str(PROJECT_ROOT / "app.py")
APP_NAME = "xl2db"

# ============================================================
# ICONE DE L'APPLICATION
# ============================================================
if sys.platform == "win32":
    ICON_PATH = str(PROJECT_ROOT / "assets" / "icons" / "icon.ico")
elif sys.platform == "darwin":
    ICON_PATH = str(PROJECT_ROOT / "assets" / "icons" / "icon.icns")
else:
    ICON_PATH = str(PROJECT_ROOT / "assets" / "icons" / "icon.png")

if not Path(ICON_PATH).exists():
    print(f"[SPEC] ATTENTION : icone introuvable -> {ICON_PATH}")
    print(f"[SPEC] L'executable n'aura pas d'icone personnalisee.")
    ICON_PATH = None
else:
    print(f"[SPEC] Icone utilisee : {ICON_PATH}")

# ============================================================
# DETECTION DES RESSOURCES A EMBARQUER
# ============================================================
datas = []

# --- Dossier web/ (index.html, css, js, fontawesome) ---
web_dir = PROJECT_ROOT / "web"
if web_dir.exists() and web_dir.is_dir():
    for root, dirs, files in os.walk(web_dir):
        for file in files:
            file_path = Path(root) / file
            rel_dir = file_path.parent.relative_to(PROJECT_ROOT)
            datas.append((str(file_path), str(rel_dir)))

# --- Dossier assets/ (icones, images, etc.) ---
assets_dir = PROJECT_ROOT / "assets"
if assets_dir.exists() and assets_dir.is_dir():
    for root, dirs, files in os.walk(assets_dir):
        for file in files:
            file_path = Path(root) / file
            rel_dir = file_path.parent.relative_to(PROJECT_ROOT)
            datas.append((str(file_path), str(rel_dir)))

# --- Autres ressources eventuelles ---
extra_resources = [
    # (PROJECT_ROOT / "config.json", "."),
]
for src, dst in extra_resources:
    if src.exists():
        datas.append((str(src), dst))

print(f"[SPEC] {len(datas)} fichier(s) de ressources a embarquer")

# ============================================================
# IMPORTS CACHES (hidden imports)
# ============================================================
hiddenimports = [
    # --- Modules internes du projet ---
    "services",
    "services.auth_service",
    "services.database_service",
    "services.excel_service",
    "repositories",
    "repositories.system_database",

    # --- Interface web ---
    "webview",
    "webview.platforms.qt",
    "webview.platforms.gtk",
    "webview.platforms.cocoa",
    "webview.platforms.winforms",
    "webview.platforms.edgechromium",
    "webview.platforms.mshtml",

    # --- Manipulation de donnees ---
    "pandas",
    "pandas._libs",
    "pandas._libs.tslibs",
    "pandas._libs.tslibs.base",
    "pandas._libs.tslibs.conversion",
    "pandas._libs.tslibs.parsing",
    "pandas._libs.tslibs.timestamps",
    "numpy",
    "numpy.core",
    "numpy.core._multiarray_umath",

    # --- Excel ---
    "openpyxl",
    "openpyxl.styles",
    "openpyxl.utils",
    "xlrd",
    "xlsxwriter",

    # --- PDF ---
    "weasyprint",
    "pdfkit",

    # --- Securite ---
    "bcrypt",

    # --- Autres ---
    "sqlite3",
    "json",
    "unicodedata",
    "datetime",
    "typing",
    "pathlib",
    "re",
    "gc",
    "os",
    "sys",
    "time",
    "smtplib",
    "email",
    "email.mime.text",
    "email.mime.multipart",
    "urllib",
    "urllib.request",
    "urllib.error",
    "urllib.parse",
    "webbrowser",
]

# ============================================================
# EXCLUSIONS (pour reduire la taille)
# ============================================================
excludes = [
    "pytest",
    "unittest",
    "doctest",
    "test",
    "tests",

    "tkinter",
    "PyQt6",
    "PySide2",
    "PySide6",
    "wx",
    "matplotlib",

    "scipy",
    "sklearn",
    "IPython",
    "jupyter",
    "notebook",
    "nbformat",
    "nbconvert",

    "pydoc",
    "pdb",
    "setuptools",
    "pip",
    "wheel",
]

# ============================================================
# DETECTION DU MODE (onefile vs onedir)
# ============================================================
ONE_FILE_MODE = "--onefile" in sys.argv
if ONE_FILE_MODE:
    print("[SPEC] Mode ONEFILE active (un seul .exe)")
else:
    print("[SPEC] Mode ONEDIR active (dossier avec plusieurs fichiers)")

# ============================================================
# ANALYSE DU SCRIPT PRINCIPAL
# ============================================================
a = Analysis(
    [MAIN_SCRIPT],
    pathex=[str(PROJECT_ROOT)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

# ============================================================
# CONSTRUCTION DE L'EXECUTABLE
# ============================================================
if ONE_FILE_MODE:
    exe = EXE(
        pyz,
        a.scripts,
        a.binaries,
        a.zipfiles,
        a.datas,
        [],
        name=APP_NAME,
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=True,
        upx_exclude=[],
        runtime_tmpdir=None,
        console=False,
        disable_windowed_traceback=False,
        argv_emulation=False,
        target_arch=None,
        codesign_identity=None,
        entitlements_file=None,
        icon=ICON_PATH,
    )
else:
    exe = EXE(
        pyz,
        a.scripts,
        [],
        exclude_binaries=True,
        name=APP_NAME,
        debug=False,
        bootloader_ignore_signals=False,
        strip=False,
        upx=True,
        console=False,
        disable_windowed_traceback=False,
        argv_emulation=False,
        target_arch=None,
        codesign_identity=None,
        entitlements_file=None,
        icon=ICON_PATH,
    )

    coll = COLLECT(
        exe,
        a.binaries,
        a.zipfiles,
        a.datas,
        strip=False,
        upx=True,
        upx_exclude=[],
        name=APP_NAME,
    )

# ============================================================
# MODE MACOS (.app) - decommentez si besoin
# ============================================================
# if sys.platform == "darwin":
#     app = BUNDLE(
#         coll if not ONE_FILE_MODE else exe,
#         name=f"{APP_NAME}.app",
#         icon=ICON_PATH,
#         bundle_identifier=f"com.datarabed.{APP_NAME}",
#         info_plist={
#             "CFBundleName": APP_NAME,
#             "CFBundleDisplayName": APP_NAME,
#             "CFBundleVersion": "1.0.0",
#             "CFBundleShortVersionString": "1.0.0",
#             "NSHighResolutionCapable": True,
#         },
#     )