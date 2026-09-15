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
- filieres
- cin
- annee_de_naissance
- categorisation_eaf (ou eaf)
- filiation_menages
- opr (ou nom_opr)
- observation = nom de la table source
"""

import pandas as pd

from api.utils import connect_db, safe_close_connection, release_resources


class MasterListApi:
    def __init__(self, database_api, database_service):
        self._database_api = database_api
        self._database_service = database_service

    # ============================================================
    # DETECTION DES COLONNES
    # ============================================================
    def _detect_columns(self, df):
        """
        Detecte les colonnes utiles dans un DataFrame en fonction
        des noms specifiques demandes.

        Retourne un dict :
        {
            "region": <nom_colonne> or None,
            "district": ...,
            "commune": ...,
            "fkt": ...,
            "nom_et_prenoms": ...,   # STRICT : uniquement 'nom_et_prenoms' et variantes
            "sexe": ...,   (h_f / h / sexe / genre / sexe___homme_et_femme)
            "filieres": ...,
            "cin": ...,
            "annee_de_naissance": ...,
            "categorisation_eaf": ...,  (categorisation_eaf / eaf)
            "filiation_menages": ...,
            "opr": ...,   (opr / nom_opr)
        }
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
            "nom_et_prenoms_",
            "nom_et_prenoms__",
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
            elif mapping["district"] is None and cl_norm == "district":
                mapping["district"] = c

            # --- Commune ---
            elif mapping["commune"] is None and cl_norm == "commune":
                mapping["commune"] = c

            # --- FKT (fkt ou fokontany) ---
            elif mapping["fkt"] is None and (
                cl_norm == "fkt" or cl_norm == "fokontany"
            ):
                mapping["fkt"] = c

            # --- Nom et prenoms (STRICT) ---
            elif mapping["nom_et_prenoms"] is None and (
                cl_norm in NOM_ET_PRENOMS_VARIANTS
            ):
                mapping["nom_et_prenoms"] = c

            # --- Sexe : h_f, h, sexe, genre, sexe___homme_et_femme ---
            elif mapping["sexe"] is None and (
                cl_norm in ("h_f", "hf", "h", "sexe", "genre")
                or cl_norm == "sexe_homme_et_femme"
                or cl_norm == "sexe_homme_femme"
                or cl_norm.startswith("sexe_")
            ):
                mapping["sexe"] = c

            # --- Filieres ---
            elif mapping["filieres"] is None and cl_norm == "filieres":
                mapping["filieres"] = c

            # --- CIN ---
            elif mapping["cin"] is None and (
                cl_norm == "cin" or cl_norm == "nin"
            ):
                mapping["cin"] = c

            # --- Annee de naissance ---
            elif mapping["annee_de_naissance"] is None and (
                cl_norm in (
                    "annee_de_naissance",
                    "annee_naissance",
                    "annee_naiss",
                    "date_naissance",
                    "date_de_naissance",
                )
            ):
                mapping["annee_de_naissance"] = c

            # --- Categorisation EAF ---
            elif mapping["categorisation_eaf"] is None and (
                cl_norm in ("categorisation_eaf", "categorisation", "eaf")
            ):
                mapping["categorisation_eaf"] = c

            # --- Filiation menages ---
            elif mapping["filiation_menages"] is None and (
                cl_norm in ("filiation_menages", "filiation_menage", "filiation")
            ):
                mapping["filiation_menages"] = c

            # --- OPR (opr ou nom_opr) ---
            elif mapping["opr"] is None and (
                cl_norm == "opr" or cl_norm == "nom_opr"
            ):
                mapping["opr"] = c

        return mapping    # ============================================================
    # NORMALISATION
    # ============================================================
    @staticmethod
    def _norm(v):
        """Normalise une valeur en chaine propre."""
        if v is None:
            return ""
        s = str(v).strip()
        if s.upper() in ("NAN", "NONE", "NULL"):
            return ""
        return s

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
                                "sexe": self._norm(row.get(cols["sexe"], "")) if cols["sexe"] else "",
                                "filieres": self._norm(row.get(cols["filieres"], "")) if cols["filieres"] else "",
                                "cin": self._norm(row.get(cols["cin"], "")) if cols["cin"] else "",
                                "annee_de_naissance": self._norm_annee(row.get(cols["annee_de_naissance"], "")) if cols["annee_de_naissance"] else "",
                                "categorisation_eaf": self._norm(row.get(cols["categorisation_eaf"], "")) if cols["categorisation_eaf"] else "",
                                "filiation_menages": self._norm(row.get(cols["filiation_menages"], "")) if cols["filiation_menages"] else "",
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
   
    @staticmethod
    def _norm_annee(v):
        """
        Normalise une annee de naissance en 4 chiffres.
        
        Accepte :
        - 1980 (int)
        - 1980.0 (float)
        - "1980" (str)
        - "1980.0" (str)
        - "01/01/1980" (str avec date)
        - "1980-05-15"
        - "1.98E+03" (notation scientifique)
        - ""
        
        Retourne une chaine de 4 chiffres ou "".
        """
        if v is None:
            return ""
        
        # Verifier NaN (Pandas)
        try:
            import pandas as pd
            if pd.isna(v):
                return ""
        except Exception:
            pass
        
        s = str(v).strip()
        if s.upper() in ("NAN", "NONE", "NULL", ""):
            return ""
        
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
        import re as _re
        match = _re.search(r"\b(19|20)\d{2}\b", s)
        if match:
            year = int(match.group(0))
            if 1900 <= year <= 2100:
                return str(year)
        
        # Fallback : chercher 4 chiffres n'importe ou
        match = _re.search(r"\d{4}", s)
        if match:
            try:
                year = int(match.group(0))
                if 1900 <= year <= 2100:
                    return str(year)
            except Exception:
                pass
        
        return ""        

