"""
Creation des listes meres.

La liste mere contient TOUTES les personnes de TOUTES les tables,
sans dedoublonnage, avec tracabilite de la source.

Attributs cibles :
- region
- district
- commune
- fkt
- nom_et_prenoms
- sexe (h_f, h, sexe, genre, sexe___homme_et_femme)
- filieres (filiere / filieres / Filière / FILIERE ...)
- cin
- annee_de_naissance (sans heure : 1980, pas 1980-01-01 00:00:00)
- categorisation_eaf (ou eaf)
- filiation_menages
- opr (ou nom_opr)
- observation = nom de la table source

Export Excel : dates sans heure + champs normalises.
"""

import os
import re
import unicodedata
import pandas as pd

from api.utils import connect_db, safe_close_connection, release_resources


# ============================================================
# DICTIONNAIRE DE VALEURS CANONIQUES (listes meres)
# ============================================================
# Cle = forme NORMALISEE (minuscule, sans accent, sans 's' final)
# Valeur = forme OFFICIELLE a garder dans la master_list
VALEURS_CANONIQUES = {
    "sexe": {
        "h": "H",
        "homme": "H",
        "masculin": "H",
        "m": "H",
        "f": "F",
        "femme": "F",
        "feminin": "F",
        "hf": "H/F",
    },
    "filieres": {
        "filiere": "Filière",
        "informatique": "Informatique",
        "gestion": "Gestion",
        "comptabilite": "Comptabilité",
        "droit": "Droit",
        "medecine": "Médecine",
        # ajouter d'autres variantes au besoin
    },
    "categorisation_eaf": {
        "eaf": "EAF",
        "categorisation_eaf": "EAF",
        "categorisation": "EAF",
    },
    "filiation_menages": {
        "filiation": "Filiation",
        "filiation_menage": "Filiation",
        "filiation_menages": "Filiation",
    },
}


class MasterListApi:
    def __init__(self, database_api, database_service):
        self._database_api = database_api
        self._database_service = database_service

    # ============================================================
    # NORMALISATION GENERIQUE
    # ============================================================
    @staticmethod
    def _supprimer_accents(texte: str) -> str:
        """Enleve les accents : 'Filière' -> 'Filiere'."""
        return "".join(
            c for c in unicodedata.normalize("NFD", texte)
            if unicodedata.category(c) != "Mn"
        )

    @classmethod
    def _normaliser_texte(cls, valeur) -> str:
        """
        Normalise un texte pour comparaison :
        - minuscules
        - sans accents
        - sans espaces superflus
        - sans 's' final (pluriel simple)
        """
        if valeur is None:
            return ""
        s = str(valeur).strip().lower()
        if s in ("nan", "none", "null", ""):
            return ""
        s = cls._supprimer_accents(s)
        s = re.sub(r"\s+", " ", s)
        if s.endswith("s") and len(s) > 3:
            s = s[:-1]
        return s

    @classmethod
    def _normaliser_champ(cls, valeur, champ: str) -> str:
        """
        Normalise une valeur categorielle et la remplace par sa
        forme canonique si elle existe dans VALEURS_CANONIQUES.
        """
        if valeur is None:
            return ""
        s = str(valeur).strip()
        if s.upper() in ("NAN", "NONE", "NULL", ""):
            return ""

        cle = cls._normaliser_texte(s)
        if not cle:
            return ""

        mapping = VALEURS_CANONIQUES.get(champ, {})
        if cle in mapping:
            return mapping[cle]

        # fallback : on garde la valeur d'origine, proprement capitalisee
        return s

    @staticmethod
    def _norm(v):
        """Normalise une valeur en chaine propre (sans NaN)."""
        if v is None:
            return ""
        s = str(v).strip()
        if s.upper() in ("NAN", "NONE", "NULL"):
            return ""
        return s

    @staticmethod
    def _norm_annee(v):
        """
        Normalise une annee de naissance en 4 chiffres SANS heure.

        Accepte :
        - 1980 (int)
        - 1980.0 (float)
        - "1980" (str)
        - "1980.0" (str)
        - "01/01/1980" (str avec date)
        - "1980-05-15 00:00:00" (datetime pandas)
        - "1.98E+03" (notation scientifique)
        - pd.Timestamp("1980-01-01")
        - ""

        Retourne une chaine de 4 chiffres ou "".
        """
        if v is None:
            return ""

        # NaN pandas
        try:
            if pd.isna(v):
                return ""
        except Exception:
            pass

        s = str(v).strip()
        if s.upper() in ("NAN", "NONE", "NULL", ""):
            return ""

        # Cas Timestamp / datetime -> on prend l'annee
        try:
            ts = pd.to_datetime(s, errors="coerce")
            if not pd.isna(ts):
                year = ts.year
                if 1900 <= year <= 2100:
                    return str(year)
        except Exception:
            pass

        # Cas notation scientifique (1.98E+03)
        if "E+" in s.upper() or "E-" in s.upper():
            try:
                num = float(s)
                year = int(num)
                if 1900 <= year <= 2100:
                    return str(year)
            except Exception:
                pass

        # Cas float (1980.0)
        try:
            num = float(s)
            if num == int(num):  # pas de decimales
                year = int(num)
                if 1900 <= year <= 2100:
                    return str(year)
        except Exception:
            pass

        # Cas chaine avec 4 chiffres consecutifs (dates, texte)
        match = re.search(r"\b(19|20)\d{2}\b", s)
        if match:
            year = int(match.group(0))
            if 1900 <= year <= 2100:
                return str(year)

        # Fallback : chercher 4 chiffres n'importe ou
        match = re.search(r"\d{4}", s)
        if match:
            try:
                year = int(match.group(0))
                if 1900 <= year <= 2100:
                    return str(year)
            except Exception:
                pass

        return ""

    # ============================================================
    # DETECTION DES COLONNES
    # ============================================================
    def _detect_columns(self, df):
        """
        Detecte les colonnes utiles dans un DataFrame.

        Corrige : utilise des 'if' independants au lieu d'une chaine
        de 'elif' (sinon une seule colonne peut etre assignee par tour
        et certaines variantes ne sont jamais vues).
        """
        mapping = {
            "region": None,
            "district": None,
            "commune": None,
            "fkt": None,
            "nom_et_prenoms": None,
            "sexe": None,
            "filieres": None,
            "cin": None,
            "annee_de_naissance": None,
            "categorisation_eaf": None,
            "filiation_menages": None,
            "opr": None,
        }

        # Variantes acceptees pour 'nom_et_prenoms' (strict)
        NOM_ET_PRENOMS_VARIANTS = {
            "nom_et_prenoms",
            "nom_et_prenom",
            "noms_et_prenoms",
            "noms_et_prenom",
            "nom_prenoms",
            "nom_prenom",
        }

        # Variantes pour filieres (on accepte singulier ET pluriel)
        FILIERES_VARIANTS = {
            "filieres", "filiere", "filiere_", "filière", "filières",
            "filiere_etude", "filiere_etudes",
        }

        # Variantes pour sexe
        SEXE_VARIANTS = {
            "h_f", "hf", "h", "sexe", "genre",
            "sexe_homme_et_femme", "sexe_homme_femme",
            "sexe_h", "sexe_f",
        }

        for c in df.columns:
            cl = c.lower().strip()
            # Normaliser : retirer espaces/tirets multiples
            cl_norm = cl.replace(" ", "_").replace("-", "_")
            while "__" in cl_norm:
                cl_norm = cl_norm.replace("__", "_")
            cl_norm = cl_norm.strip("_")

            # --- Region ---
            if mapping["region"] is None and cl_norm == "region":
                mapping["region"] = c

            # --- District ---
            if mapping["district"] is None and cl_norm == "district":
                mapping["district"] = c

            # --- Commune ---
            if mapping["commune"] is None and cl_norm == "commune":
                mapping["commune"] = c

            # --- FKT (fkt ou fokontany) ---
            if mapping["fkt"] is None and cl_norm in ("fkt", "fokontany"):
                mapping["fkt"] = c

            # --- Nom et prenoms (STRICT) ---
            if mapping["nom_et_prenoms"] is None and cl_norm in NOM_ET_PRENOMS_VARIANTS:
                mapping["nom_et_prenoms"] = c

            # --- Sexe ---
            if mapping["sexe"] is None and (
                cl_norm in SEXE_VARIANTS or cl_norm.startswith("sexe_")
            ):
                mapping["sexe"] = c

            # --- Filieres (singulier ET pluriel, avec/sans accent) ---
            if mapping["filieres"] is None:
                cl_sans_accent = self._supprimer_accents(cl_norm)
                if cl_sans_accent in ("filieres", "filiere"):
                    mapping["filieres"] = c

            # --- CIN ---
            if mapping["cin"] is None and cl_norm in ("cin", "nin"):
                mapping["cin"] = c

            # --- Annee de naissance ---
            if mapping["annee_de_naissance"] is None and cl_norm in (
                "annee_de_naissance",
                "annee_naissance",
                "annee_naiss",
                "date_naissance",
                "date_de_naissance",
            ):
                mapping["annee_de_naissance"] = c

            # --- Categorisation EAF ---
            if mapping["categorisation_eaf"] is None and cl_norm in (
                "categorisation_eaf", "categorisation", "eaf"
            ):
                mapping["categorisation_eaf"] = c

            # --- Filiation menages ---
            if mapping["filiation_menages"] is None and cl_norm in (
                "filiation_menages", "filiation_menage", "filiation"
            ):
                mapping["filiation_menages"] = c

            # --- OPR (opr ou nom_opr) ---
            if mapping["opr"] is None and cl_norm in ("opr", "nom_opr"):
                mapping["opr"] = c

        return mapping

    # ============================================================
    # CREATION DE LA LISTE MERE
    # ============================================================
    def create_master_list(self, file_path: str = None):
        """
        Cree la table 'listes_meres' dans la base active.

        Structure de 'listes_meres' :
        - id
        - region
        - district
        - commune
        - fkt
        - nom_et_prenoms
        - sexe
        - filieres
        - cin
        - annee_de_naissance
        - categorisation_eaf
        - filiation_menages
        - opr
        - observation  (= nom de la table source)
        """
        try:
            db_path = self._database_api._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "Aucune base active."}

            # Fermer la connexion eventuellement ouverte
            try:
                self._database_service.close_database()
            except Exception:
                pass
            release_resources(0.15)

            conn = connect_db(db_path)
            try:
                cursor = conn.cursor()

                # Recuperer toutes les tables sauf systeme et listes_meres
                cursor.execute(
                    "SELECT name FROM sqlite_master "
                    "WHERE type='table' AND name NOT LIKE 'sqlite_%';"
                )
                tables = [
                    row[0] for row in cursor.fetchall()
                    if row[0] not in ("sqlite_sequence", "listes_meres")
                ]

                if not tables:
                    return {"success": False, "message": "Aucune table dans cette base."}

                tables = sorted(tables)

                all_persons = []
                total_lignes_lues = 0
                total_noms_vides_ignores = 0
                detected_columns_summary = {}

                for table in tables:
                    try:
                        df = pd.read_sql_query(f'SELECT * FROM "{table}"', conn)
                        if df.empty:
                            continue

                        total_lignes_lues += len(df)

                        # Detecter les colonnes
                        cols = self._detect_columns(df)
                        detected_columns_summary[table] = {
                            k: v for k, v in cols.items() if v is not None
                        }

                        # Parcourir chaque ligne
                        for idx, row in df.iterrows():
                            nom_val = (
                                self._norm(row.get(cols["nom_et_prenoms"], ""))
                                if cols["nom_et_prenoms"] else ""
                            )

                            # Ignorer les lignes sans nom
                            if not nom_val:
                                total_noms_vides_ignores += 1
                                continue

                            person = {
                                "region": self._norm(row.get(cols["region"], "")) if cols["region"] else "",
                                "district": self._norm(row.get(cols["district"], "")) if cols["district"] else "",
                                "commune": self._norm(row.get(cols["commune"], "")) if cols["commune"] else "",
                                "fkt": self._norm(row.get(cols["fkt"], "")) if cols["fkt"] else "",
                                "nom_et_prenoms": nom_val,
                                "sexe": self._normaliser_champ(
                                    row.get(cols["sexe"], ""), "sexe"
                                ) if cols["sexe"] else "",
                                "filieres": self._normaliser_champ(
                                    row.get(cols["filieres"], ""), "filieres"
                                ) if cols["filieres"] else "",
                                "cin": self._norm(row.get(cols["cin"], "")) if cols["cin"] else "",
                                "annee_de_naissance": self._norm_annee(
                                    row.get(cols["annee_de_naissance"], "")
                                ) if cols["annee_de_naissance"] else "",
                                "categorisation_eaf": self._normaliser_champ(
                                    row.get(cols["categorisation_eaf"], ""), "categorisation_eaf"
                                ) if cols["categorisation_eaf"] else "",
                                "filiation_menages": self._normaliser_champ(
                                    row.get(cols["filiation_menages"], ""), "filiation_menages"
                                ) if cols["filiation_menages"] else "",
                                "opr": self._norm(row.get(cols["opr"], "")) if cols["opr"] else "",
                                "observation": table,  # Nom de la table source
                            }

                            all_persons.append(person)

                    except Exception as e:
                        print(f"[WARN] Erreur lecture table '{table}' : {e}")
                        continue

                if not all_persons:
                    return {
                        "success": False,
                        "message": "Aucune personne valide trouvee.",
                    }

                # Afficher un resume des colonnes detectees (debug)
                print("[INFO] Colonnes detectees par table :")
                for tname, tcols in detected_columns_summary.items():
                    print(f"  - {tname} : {tcols}")

                # Supprimer l'ancienne table listes_meres si elle existe
                cursor.execute('DROP TABLE IF EXISTS "listes_meres"')

                # Creer la nouvelle table
                cursor.execute('''
                    CREATE TABLE "listes_meres" (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        region TEXT,
                        district TEXT,
                        commune TEXT,
                        fkt TEXT,
                        nom_et_prenoms TEXT,
                        sexe TEXT,
                        filieres TEXT,
                        cin TEXT,
                        annee_de_naissance TEXT,
                        categorisation_eaf TEXT,
                        filiation_menages TEXT,
                        opr TEXT,
                        observation TEXT
                    )
                ''')

                # Inserer toutes les personnes
                for p in all_persons:
                    cursor.execute('''
                        INSERT INTO "listes_meres"
                        (region, district, commune, fkt, nom_et_prenoms,
                         sexe, filieres, cin, annee_de_naissance,
                         categorisation_eaf, filiation_menages, opr, observation)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        p["region"],
                        p["district"],
                        p["commune"],
                        p["fkt"],
                        p["nom_et_prenoms"],
                        p["sexe"],
                        p["filieres"],
                        p["cin"],
                        p["annee_de_naissance"],
                        p["categorisation_eaf"],
                        p["filiation_menages"],
                        p["opr"],
                        p["observation"],
                    ))

                conn.commit()

            finally:
                safe_close_connection(conn)

            S = len(all_persons)
            N = total_lignes_lues

            return {
                "success": True,
                "message": (
                    f"Liste mere creee avec {S} personne(s). "
                    f"[{N} lignes lues, "
                    f"{total_noms_vides_ignores} noms vides ignores]"
                ),
                "total_persons": S,
                "tables_scanned": len(tables),
                "total_lignes_lues": N,
                "total_noms_vides_ignores": total_noms_vides_ignores,
                "detected_columns": detected_columns_summary,
            }

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"success": False, "message": f"Erreur lors de la creation : {e}"}

    # ============================================================
    # EXPORT EXCEL DE LA LISTE MERE
    # ============================================================
    def export_master_list_to_excel(self, excel_path: str, file_path: str = None):
        """
        Exporte la table 'listes_meres' vers un fichier Excel propre :
        - annee_de_naissance : texte 4 chiffres (ex: "1980", pas de date)
        - sexe, filieres, categorisation_eaf, filiation_menages :
          valeurs canoniques (deja normalisees en base)

        Retourne un dict {"success": bool, "message": str, "path": str}
        """
        try:
            db_path = self._database_api._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "Aucune base active."}

            try:
                self._database_service.close_database()
            except Exception:
                pass
            release_resources(0.15)

            conn = connect_db(db_path)
            try:
                df = pd.read_sql_query('SELECT * FROM "listes_meres"', conn)
            finally:
                safe_close_connection(conn)

            if df.empty:
                return {"success": False, "message": "La table 'listes_meres' est vide."}

            # S'assurer que annee_de_naissance reste du TEXTE 4 chiffres
            if "annee_de_naissance" in df.columns:
                df["annee_de_naissance"] = df["annee_de_naissance"].apply(
                    lambda v: self._norm_annee(v)
                )

            # Re-normaliser les champs categoriels au cas ou
            for champ in ("sexe", "filieres", "categorisation_eaf", "filiation_menages"):
                if champ in df.columns:
                    df[champ] = df[champ].apply(
                        lambda v: self._normaliser_champ(v, champ)
                    )

            # Export Excel
            with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
                df.to_excel(writer, index=False, sheet_name="listes_meres")

                # Forcer le format TEXTE sur annee_de_naissance
                # (empeche Excel d'afficher "1 980" ou "1980-01-01")
                worksheet = writer.sheets["listes_meres"]
                if "annee_de_naissance" in df.columns:
                    col_idx = list(df.columns).index("annee_de_naissance") + 1
                    for row in range(2, len(df) + 2):
                        cell = worksheet.cell(row=row, column=col_idx)
                        cell.number_format = "@"  # format texte

            print(f"[INFO] Master list exportee : {excel_path}")

            return {
                "success": True,
                "message": f"Export Excel reussi : {len(df)} ligne(s).",
                "path": excel_path,
                "rows": len(df),
            }

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"success": False, "message": f"Erreur export Excel : {e}"}