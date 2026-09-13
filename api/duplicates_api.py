"""
Recherche et suppression de doublons.
"""

import time
from typing import Dict, Any, List

import pandas as pd

from api.utils import connect_db, safe_close_connection


class DuplicatesApi:
    def __init__(self, database_api):
        self._database_api = database_api

    # ============================================================
    # POINT D'ENTREE UNIQUE
    # ============================================================
    def scan_table_duplicates_advanced(
        self, table_name: str, algorithm: str = "general", file_path: str = None
    ):
        import sqlite3

        conn = None
        try:
            db_path = self._database_api._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "Aucune base active.", "duplicates": []}

            conn = connect_db(db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute(f'PRAGMA table_info("{table_name}")')
            columns = [col[1] for col in cursor.fetchall()]
            if not columns:
                return {"success": True, "duplicates": []}

            # Dispatch selon l'algorithme
            if algorithm == "general":
                return self._scan_general(conn, table_name, columns)
            elif algorithm == "cin_nom":
                return self._scan_cin_nom(conn, table_name, columns)
            elif algorithm == "cin_nom_only":
                return self._scan_cin_nom_only(conn, table_name, columns)
            elif algorithm == "cin_nom_annee_commune_fkt":
                return self._scan_cin_nom_annee_commune_fkt(conn, table_name, columns)
            else:
                return {"success": True, "duplicates": []}
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"success": False, "message": str(e), "duplicates": []}
        finally:
            safe_close_connection(conn)

    # ============================================================
    # ALGO 1 : GENERAL (toutes les colonnes)
    # ============================================================
    def _scan_general(self, conn, table_name, columns):
        cols_to_check = [c for c in columns if c.lower() != "id"] or columns

        df = pd.read_sql_query(
            f'SELECT rowid AS __sqlite_rowid__, * FROM "{table_name}"', conn,
        )
        if df.empty:
            return {"success": True, "duplicates": [], "algorithm": "general"}

        df["_hash_key"] = (
            df[cols_to_check].fillna("").astype(str)
            .apply(lambda x: "|".join(x.str.upper().str.strip()), axis=1)
        )

        duplicate_mask = df.duplicated(subset=["_hash_key"], keep="first")
        duplicates = []

        if duplicate_mask.any():
            grouped = df.groupby("_hash_key")
            hash_to_first = {hv: g.iloc[0] for hv, g in grouped}

            for idx, row in df[duplicate_mask].iterrows():
                hash_key = row["_hash_key"]
                ref_row = hash_to_first.get(hash_key)
                if ref_row is not None:
                    duplicates.append({
                        "row_index": int(row["__sqlite_rowid__"]),
                        "reference_id": int(ref_row["__sqlite_rowid__"]),
                        "data": self._convert_row_to_dict(row, columns),
                        "reference_data": self._convert_row_to_dict(ref_row, columns),
                        "algorithm": "general",
                    })

        return {"success": True, "duplicates": duplicates, "algorithm": "general"}

    # ============================================================
    # ALGO 2 : CIN + NOM + COMMUNE + FKT
    # ============================================================
    def _scan_cin_nom(self, conn, table_name, columns):
        """
        Detecte les doublons sur 4 criteres :
        CIN + NOM + COMMUNE + FKT

        Tous les 4 champs doivent etre remplis et identiques.
        """
        df = pd.read_sql_query(
            f'SELECT rowid AS __sqlite_rowid__, * FROM "{table_name}"', conn,
        )
        if df.empty:
            return {"success": True, "duplicates": [], "algorithm": "cin_nom"}

        # --- Detection des colonnes ---
        cin_col = None
        nom_col = None
        commune_col = None
        fkt_col = None

        cin_patterns = ["cin", "nin", "nif", "id_personne", "num", "numero", "matricule"]
        nom_patterns = ["nom", "name", "prenom", "firstname", "lastname", "fullname", "raison"]
        commune_patterns = ["commune", "comm", "ville", "city"]
        fkt_patterns = ["fkt", "fokontany", "localite", "lieu", "village"]

        for col in columns:
            cl = col.lower()
            if not cin_col and any(p in cl for p in cin_patterns):
                cin_col = col
            if not nom_col and any(p in cl for p in nom_patterns):
                nom_col = col
            if not commune_col and any(p in cl for p in commune_patterns):
                commune_col = col
            if not fkt_col and any(p in cl for p in fkt_patterns):
                fkt_col = col

        # --- Verifications ---
        if not cin_col or not nom_col:
            return {
                "success": True,
                "duplicates": [],
                "algorithm": "cin_nom",
                "message": "Colonnes CIN ou NOM non trouvees",
            }

        if not commune_col:
            return {
                "success": True,
                "duplicates": [],
                "algorithm": "cin_nom",
                "message": "Colonne COMMUNE non trouvee",
            }

        if not fkt_col:
            return {
                "success": True,
                "duplicates": [],
                "algorithm": "cin_nom",
                "message": "Colonne FKT non trouvee",
            }

        # --- Nettoyage ---
        df["_cin_clean"] = df[cin_col].fillna("").astype(str).str.upper().str.strip()
        df["_cin_clean"] = df["_cin_clean"].str.replace(r"[^A-Z0-9]", "", regex=True)
        df["_nom_clean"] = df[nom_col].fillna("").astype(str).str.upper().str.strip()
        df["_commune_clean"] = df[commune_col].fillna("").astype(str).str.upper().str.strip()
        df["_fkt_clean"] = df[fkt_col].fillna("").astype(str).str.upper().str.strip()

        df = df[(df["_cin_clean"] != "") | (df["_nom_clean"] != "")].copy()
        if df.empty:
            return {"success": True, "duplicates": [], "algorithm": "cin_nom"}

        # --- Construire les lignes ---
        rows_list = []
        for idx, row in df.iterrows():
            rows_list.append({
                "rowid": int(row["__sqlite_rowid__"]),
                "cin": row["_cin_clean"],
                "nom": row["_nom_clean"],
                "commune": row["_commune_clean"],
                "fkt": row["_fkt_clean"],
                "data": {k: row[k] for k in columns if k in row.index},
            })

        # --- Groupement par (CIN, NOM, COMMUNE, FKT) ---
        composite_groups = {}
        for row in rows_list:
            if (row["cin"] and len(row["cin"]) >= 3 and row["nom"]
                    and row["commune"] and row["fkt"]):
                key = f"{row['cin']}|{row['nom']}|{row['commune']}|{row['fkt']}"
                composite_groups.setdefault(key, []).append(row)

        # --- Construction des doublons ---
        duplicates = []
        processed = set()

        for composite_key, group in composite_groups.items():
            if len(group) <= 1:
                continue

            ref_row = group[0]
            ref_id = ref_row["rowid"]
            parts = composite_key.split("|")

            for row in group[1:]:
                if row["rowid"] in processed:
                    continue
                duplicates.append({
                    "row_index": row["rowid"],
                    "reference_id": ref_id,
                    "data": row["data"],
                    "reference_data": ref_row["data"],
                    "algorithm": "cin_nom_complet",
                    "cin_col": cin_col,
                    "nom_col": nom_col,
                    "commune_col": commune_col,
                    "fkt_col": fkt_col,
                    "cin_value": row["cin"],
                    "nom_value": row["nom"],
                    "commune_value": row["commune"],
                    "fkt_value": row["fkt"],
                    "context": {
                        "type": "CIN_NOM_COMMUNE_FKT",
                        "cin": parts[0] if len(parts) > 0 else "",
                        "nom": parts[1] if len(parts) > 1 else "",
                        "commune": parts[2] if len(parts) > 2 else "",
                        "fkt": parts[3] if len(parts) > 3 else "",
                    },
                })
                processed.add(row["rowid"])

        return {"success": True, "duplicates": duplicates, "algorithm": "cin_nom"}

    # ============================================================
    # ALGO 3 : CIN + NOM + ANNEE DE NAISSANCE
    # ============================================================
    def _scan_cin_nom_only(self, conn, table_name, columns):
        """
        Detecte les doublons sur la base du CIN + NOM + ANNEE DE NAISSANCE.

        Regles :
        - Le CIN doit etre rempli (>= 3 caracteres)
        - Le NOM doit etre rempli
        - L'annee de naissance doit etre remplie et valide
        - Cle unique = CIN + NOM + ANNEE_NAISSANCE
        """
        df = pd.read_sql_query(
            f'SELECT rowid AS __sqlite_rowid__, * FROM "{table_name}"', conn,
        )
        if df.empty:
            return {"success": True, "duplicates": [], "algorithm": "cin_nom_only"}

        # --- Detection des colonnes ---
        cin_col = None
        nom_col = None
        annee_col = None

        cin_patterns = ["cin", "nin", "nif", "id_personne", "num", "numero", "matricule"]
        nom_patterns = ["nom", "name", "prenom", "firstname", "lastname", "fullname", "raison"]
        annee_patterns = ["annee", "année", "naissance", "birth", "date_naiss", "date_naissance", "annee_naiss"]

        for col in columns:
            cl = col.lower()

            if not cin_col and any(p in cl for p in cin_patterns):
                cin_col = col
            if not nom_col and any(p in cl for p in nom_patterns):
                nom_col = col
            if not annee_col and any(p in cl for p in annee_patterns):
                annee_col = col

        # --- Verification des colonnes obligatoires ---
        if not cin_col:
            return {
                "success": True,
                "duplicates": [],
                "algorithm": "cin_nom_only",
                "message": "Colonne CIN non trouvee",
            }

        if not nom_col:
            return {
                "success": True,
                "duplicates": [],
                "algorithm": "cin_nom_only",
                "message": "Colonne NOM non trouvee",
            }

        if not annee_col:
            return {
                "success": True,
                "duplicates": [],
                "algorithm": "cin_nom_only",
                "message": "Colonne ANNEE DE NAISSANCE non trouvee",
            }

        # --- Nettoyage ---
        df["_cin_clean"] = df[cin_col].fillna("").astype(str).str.upper().str.strip()
        df["_cin_clean"] = df["_cin_clean"].str.replace(r"[^A-Z0-9]", "", regex=True)
        df["_nom_clean"] = df[nom_col].fillna("").astype(str).str.upper().str.strip()

        # Normaliser l'annee : extraire uniquement les 4 chiffres
        def normalize_annee(val):
            if val is None or pd.isna(val):
                return ""
            import re as _re
            s = str(val).strip()
            match = _re.search(r"\d{4}", s)
            if match:
                try:
                    y = int(match.group(0))
                    if 1900 <= y <= 2100:
                        return match.group(0)
                except Exception:
                    pass
            return ""

        df["_annee_clean"] = df[annee_col].apply(normalize_annee)

        # --- Filtrer les lignes valides ---
        df = df[
            (df["_cin_clean"] != "") &
            (df["_cin_clean"].str.len() >= 3) &
            (df["_nom_clean"] != "") &
            (df["_annee_clean"] != "")
        ].copy()

        if df.empty:
            return {"success": True, "duplicates": [], "algorithm": "cin_nom_only"}

        # --- Construire les lignes ---
        rows_list = []
        for idx, row in df.iterrows():
            rows_list.append({
                "rowid": int(row["__sqlite_rowid__"]),
                "cin": row["_cin_clean"],
                "nom": row["_nom_clean"],
                "annee": row["_annee_clean"],
                "data": {k: row[k] for k in columns if k in row.index},
            })

        # --- Groupement par (CIN, NOM, ANNEE) ---
        groups = {}
        for row in rows_list:
            key = f"{row['cin']}|{row['nom']}|{row['annee']}"
            groups.setdefault(key, []).append(row)

        # --- Construction des doublons ---
        duplicates = []
        processed = set()

        for composite_key, group in groups.items():
            if len(group) <= 1:
                continue

            ref_row = group[0]
            ref_id = ref_row["rowid"]
            parts = composite_key.split("|")

            for row in group[1:]:
                if row["rowid"] in processed:
                    continue
                duplicates.append({
                    "row_index": row["rowid"],
                    "reference_id": ref_id,
                    "data": row["data"],
                    "reference_data": ref_row["data"],
                    "algorithm": "cin_nom_only",
                    "cin_col": cin_col,
                    "nom_col": nom_col,
                    "annee_col": annee_col,
                    "cin_value": row["cin"],
                    "nom_value": row["nom"],
                    "annee_value": row["annee"],
                    "context": {
                        "type": "CIN_NOM_ANNEE",
                        "cin": parts[0] if len(parts) > 0 else "",
                        "nom": parts[1] if len(parts) > 1 else "",
                        "annee": parts[2] if len(parts) > 2 else "",
                    },
                })
                processed.add(row["rowid"])

        return {"success": True, "duplicates": duplicates, "algorithm": "cin_nom_only"}

    # ============================================================
    # ALGO 4 : CIN + NOM + ANNEE + COMMUNE + FKT (strict)
    # ============================================================
    def _scan_cin_nom_annee_commune_fkt(self, conn, table_name, columns):
        """
        Detecte les doublons stricts sur 5 criteres :
        CIN + NOM + ANNEE DE NAISSANCE + COMMUNE + FKT

        Tous les 5 champs doivent etre remplis et identiques.
        """
        df = pd.read_sql_query(
            f'SELECT rowid AS __sqlite_rowid__, * FROM "{table_name}"', conn,
        )
        if df.empty:
            return {"success": True, "duplicates": [], "algorithm": "cin_nom_annee_commune_fkt"}

        # --- Detection des colonnes ---
        cin_col = None
        nom_col = None
        commune_col = None
        fkt_col = None
        annee_col = None

        cin_patterns = ["cin", "nin", "nif", "id_personne", "num", "numero", "matricule"]
        nom_patterns = ["nom", "name", "prenom", "firstname", "lastname", "fullname", "raison"]
        commune_patterns = ["commune", "comm", "ville", "city"]
        fkt_patterns = ["fkt", "fokontany", "localite", "lieu", "village"]
        annee_patterns = ["annee", "année", "naissance", "birth", "date_naiss", "date_naissance"]

        for col in columns:
            cl = col.lower()
            if not cin_col and any(p in cl for p in cin_patterns):
                cin_col = col
            if not nom_col and any(p in cl for p in nom_patterns):
                nom_col = col
            if not commune_col and any(p in cl for p in commune_patterns):
                commune_col = col
            if not fkt_col and any(p in cl for p in fkt_patterns):
                fkt_col = col
            if not annee_col and any(p in cl for p in annee_patterns):
                annee_col = col

        if not all([cin_col, nom_col, commune_col, fkt_col, annee_col]):
            return {
                "success": True,
                "duplicates": [],
                "algorithm": "cin_nom_annee_commune_fkt",
                "message": "Certaines colonnes sont manquantes (CIN, NOM, COMMUNE, FKT, ANNEE)",
            }

        # --- Nettoyage ---
        df["_cin_clean"] = df[cin_col].fillna("").astype(str).str.upper().str.strip()
        df["_cin_clean"] = df["_cin_clean"].str.replace(r"[^A-Z0-9]", "", regex=True)
        df["_nom_clean"] = df[nom_col].fillna("").astype(str).str.upper().str.strip()
        df["_commune_clean"] = df[commune_col].fillna("").astype(str).str.upper().str.strip()
        df["_fkt_clean"] = df[fkt_col].fillna("").astype(str).str.upper().str.strip()

        def normalize_annee(val):
            if val is None or pd.isna(val):
                return ""
            import re as _re
            match = _re.search(r"\d{4}", str(val))
            if match:
                try:
                    y = int(match.group(0))
                    if 1900 <= y <= 2100:
                        return match.group(0)
                except Exception:
                    pass
            return ""

        df["_annee_clean"] = df[annee_col].apply(normalize_annee)

        # --- Filtrer : tous les 5 champs remplis ---
        df = df[
            (df["_cin_clean"] != "") &
            (df["_cin_clean"].str.len() >= 3) &
            (df["_nom_clean"] != "") &
            (df["_commune_clean"] != "") &
            (df["_fkt_clean"] != "") &
            (df["_annee_clean"] != "")
        ].copy()

        if df.empty:
            return {"success": True, "duplicates": [], "algorithm": "cin_nom_annee_commune_fkt"}

        # --- Construire les lignes ---
        rows_list = []
        for idx, row in df.iterrows():
            rows_list.append({
                "rowid": int(row["__sqlite_rowid__"]),
                "cin": row["_cin_clean"],
                "nom": row["_nom_clean"],
                "commune": row["_commune_clean"],
                "fkt": row["_fkt_clean"],
                "annee": row["_annee_clean"],
                "data": {k: row[k] for k in columns if k in row.index},
            })

        # --- Grouper par cle 5 champs ---
        groups = {}
        for row in rows_list:
            key = f"{row['cin']}|{row['nom']}|{row['annee']}|{row['commune']}|{row['fkt']}"
            groups.setdefault(key, []).append(row)

        duplicates = []
        processed = set()

        for composite_key, group in groups.items():
            if len(group) <= 1:
                continue
            ref_row = group[0]
            ref_id = ref_row["rowid"]
            parts = composite_key.split("|")

            for row in group[1:]:
                if row["rowid"] in processed:
                    continue
                duplicates.append({
                    "row_index": row["rowid"],
                    "reference_id": ref_id,
                    "data": row["data"],
                    "reference_data": ref_row["data"],
                    "algorithm": "cin_nom_annee_commune_fkt",
                    "cin_col": cin_col,
                    "nom_col": nom_col,
                    "commune_col": commune_col,
                    "fkt_col": fkt_col,
                    "annee_col": annee_col,
                    "context": {
                        "type": "CIN_NOM_ANNEE_COMMUNE_FKT",
                        "cin": parts[0] if len(parts) > 0 else "",
                        "nom": parts[1] if len(parts) > 1 else "",
                        "annee": parts[2] if len(parts) > 2 else "",
                        "commune": parts[3] if len(parts) > 3 else "",
                        "fkt": parts[4] if len(parts) > 4 else "",
                    },
                })
                processed.add(row["rowid"])

        return {"success": True, "duplicates": duplicates, "algorithm": "cin_nom_annee_commune_fkt"}

    # ============================================================
    # CONVERSION
    # ============================================================
    def _convert_row_to_dict(self, row, columns):
        result = {}
        for k in columns:
            val = row.get(k)
            if val is None or pd.isna(val):
                result[k] = None
            elif hasattr(val, "item"):
                try:
                    result[k] = val.item()
                except Exception:
                    result[k] = str(val)
            elif isinstance(val, (int, float, str, bool)):
                result[k] = val
            else:
                result[k] = str(val)
        return result

    # ============================================================
    # SUPPRESSION EN LOT
    # ============================================================
    def delete_duplicates_batch(self, duplicates: List[Dict[str, Any]], file_path: str = None):
        start_time = time.time()

        try:
            db_path = self._database_api._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "Aucune base active."}

            if not duplicates:
                return {"success": True, "total": 0, "deleted": 0, "errors": 0}

            grouped: Dict[str, List[int]] = {}
            for dup in duplicates:
                table_name = dup.get("tableName") or dup.get("table")
                row_index = dup.get("row_index")
                if not table_name or row_index is None:
                    continue
                try:
                    grouped.setdefault(table_name, []).append(int(row_index))
                except (ValueError, TypeError):
                    continue

            if not grouped:
                return {
                    "success": False,
                    "message": "Aucun doublon valide a supprimer.",
                    "total": len(duplicates), "deleted": 0, "errors": len(duplicates),
                }

            conn = connect_db(db_path)
            details = {}
            total_deleted = 0
            total_errors = 0

            try:
                cursor = conn.cursor()
                try:
                    cursor.execute("PRAGMA synchronous=OFF;")
                    cursor.execute("PRAGMA journal_mode=MEMORY;")
                    cursor.execute("PRAGMA temp_store=MEMORY;")
                except Exception:
                    pass

                cursor.execute("BEGIN TRANSACTION;")

                for table_name, row_ids in grouped.items():
                    if not row_ids:
                        continue
                    safe_table = str(table_name).replace('"', '""')
                    deleted_for_table = 0

                    cursor.execute(
                        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                        (table_name,),
                    )
                    if not cursor.fetchone():
                        total_errors += len(row_ids)
                        continue

                    BATCH_SIZE = 500
                    for i in range(0, len(row_ids), BATCH_SIZE):
                        batch = row_ids[i:i + BATCH_SIZE]
                        try:
                            placeholders = ",".join("?" * len(batch))
                            cursor.execute(
                                f'DELETE FROM "{safe_table}" WHERE rowid IN ({placeholders})',
                                batch,
                            )
                            deleted_for_table += cursor.rowcount
                        except Exception as e:
                            print(f"[WARN] Erreur batch table '{table_name}': {e}")
                            total_errors += len(batch)

                    details[table_name] = deleted_for_table
                    total_deleted += deleted_for_table

                cursor.execute("COMMIT;")
                try:
                    cursor.execute("PRAGMA synchronous=NORMAL;")
                    cursor.execute("PRAGMA journal_mode=WAL;")
                except Exception:
                    pass
            except Exception as e:
                try:
                    conn.execute("ROLLBACK;")
                except Exception:
                    pass
                raise e
            finally:
                safe_close_connection(conn)

            return {
                "success": True,
                "total": len(duplicates),
                "deleted": total_deleted,
                "errors": total_errors,
                "elapsed_seconds": round(time.time() - start_time, 2),
                "details": details,
            }
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "message": f"Erreur lors de la suppression en lot : {e}",
                "total": len(duplicates) if duplicates else 0,
                "deleted": 0, "errors": len(duplicates) if duplicates else 0,
            }

    # ============================================================
    # NETTOYAGE
    # ============================================================
    def clean_database_values(self, file_path: str = None):
        conn = None
        try:
            db_path = self._database_api._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "Aucune base active."}

            conn = connect_db(db_path)
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
            )
            tables = [row[0] for row in cursor.fetchall() if row[0] != "sqlite_sequence"]

            if not tables:
                return {"success": False, "message": "Aucune table dans cette base."}

            cleaned_tables = []
            total_cells_cleaned = 0

            for table in tables:
                try:
                    df = pd.read_sql_query(f'SELECT * FROM "{table}"', conn)
                    if df.empty:
                        continue

                    cells_cleaned_before = df.isna().sum().sum()

                    for col in df.columns:
                        if pd.api.types.is_numeric_dtype(df[col]):
                            df[col] = df[col].fillna(0)
                        else:
                            df[col] = df[col].fillna("Non specifie")

                    df.to_sql(table, conn, if_exists="replace", index=False)
                    cleaned_tables.append(table)
                    total_cells_cleaned += int(cells_cleaned_before)
                except Exception as e:
                    print(f"[WARN] Erreur nettoyage table '{table}' : {e}")
                    continue

            return {
                "success": True,
                "message": (
                    f"Nettoyage termine : {len(cleaned_tables)} table(s) traitee(s), "
                    f"{total_cells_cleaned} cellule(s) vide(s) remplacee(s)."
                ),
                "cleaned_tables": cleaned_tables,
                "total_cells_cleaned": total_cells_cleaned,
            }
        except Exception as e:
            return {"success": False, "message": f"Erreur lors du nettoyage : {e}"}
        finally:
            safe_close_connection(conn)