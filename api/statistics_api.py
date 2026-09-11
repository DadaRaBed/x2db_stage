"""
Requêtes statistiques predefinies.
"""

from datetime import datetime

import pandas as pd

from api.utils import connect_db, safe_close_connection


class StatisticsApi:
    def __init__(self, database_api):
        self._database_api = database_api

    def execute_statistical_query(self, query_type: str, params=None, file_path: str = None):
        import sqlite3

        try:
            db_path = self._database_api._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "Aucune base active.", "data": []}

            if params is None:
                params = {}

            conn = connect_db(db_path)
            conn.row_factory = sqlite3.Row

            try:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
                )
                tables = [row[0] for row in cursor.fetchall() if row[0] not in ("sqlite_sequence",)]

                handlers = {
                    "femmes_par_tranche_age": self._femmes_par_tranche_age,
                    "personnes_par_lieu": self._personnes_par_lieu,
                    "superficie_par_personne": self._superficie_par_personne,
                    "hommes_femmes": self._hommes_femmes,
                    "personnes_par_filiere": self._personnes_par_filiere,
                    "personnes_par_commune": self._personnes_par_commune,
                    "personnes_par_categorisation": self._personnes_par_categorisation,
                    "age_moyen": self._age_moyen,
                    "superficie_totale": self._superficie_totale,
                }

                handler = handlers.get(query_type)
                if not handler:
                    return {
                        "success": False,
                        "message": f"Type de requete inconnu : {query_type}",
                        "data": [],
                    }

                data = handler(conn, tables, params)
                return {"success": True, "data": data, "query_type": query_type}
            finally:
                safe_close_connection(conn)
        except Exception as e:
            return {"success": False, "message": str(e), "data": []}

    # --- Handlers individuels ---
    def _femmes_par_tranche_age(self, conn, tables, params):
        age_min = int(params.get("age_min", 0))
        age_max = int(params.get("age_max", 100))
        buckets = {"0-14": 0, "15-24": 0, "25-34": 0, "35-44": 0, "45-54": 0, "55-64": 0, "65+": 0}
        current_year = datetime.now().year

        for table in tables:
            try:
                df = pd.read_sql_query(f'SELECT * FROM "{table}"', conn)
                if df.empty:
                    continue

                hf_col = annee_col = None
                for c in df.columns:
                    cl = c.lower()
                    if hf_col is None and cl in ("h_f", "hf", "sexe"):
                        hf_col = c
                    if annee_col is None and ("annee" in cl and "naissance" in cl):
                        annee_col = c

                if not hf_col or not annee_col:
                    continue

                for idx, row in df.iterrows():
                    hf = str(row[hf_col] or "").strip().upper()
                    if hf not in ("F", "FEMME", "FEMININ", "FEMALE", "2"):
                        continue

                    try:
                        annee = int(float(str(row[annee_col] or 0)))
                        if annee < 1900 or annee > current_year:
                            continue
                        age = current_year - annee
                    except Exception:
                        continue

                    if age < age_min or age > age_max:
                        continue

                    if age <= 14:
                        buckets["0-14"] += 1
                    elif age <= 24:
                        buckets["15-24"] += 1
                    elif age <= 34:
                        buckets["25-34"] += 1
                    elif age <= 44:
                        buckets["35-44"] += 1
                    elif age <= 54:
                        buckets["45-54"] += 1
                    elif age <= 64:
                        buckets["55-64"] += 1
                    else:
                        buckets["65+"] += 1
            except Exception:
                continue

        return [{"tranche_age": t, "nombre_femmes": n} for t, n in buckets.items()]

    def _personnes_par_lieu(self, conn, tables, params):
        lieu_type = params.get("lieu_type", "commune")
        counts = {}

        for table in tables:
            try:
                df = pd.read_sql_query(f'SELECT * FROM "{table}"', conn)
                if df.empty:
                    continue

                lieu_col = None
                for c in df.columns:
                    if lieu_type in c.lower():
                        lieu_col = c
                        break

                if not lieu_col:
                    continue

                for val in df[lieu_col]:
                    v = str(val or "").strip()
                    if v and v.lower() not in ("nan", "non specifie"):
                        counts[v] = counts.get(v, 0) + 1
            except Exception:
                continue

        sorted_counts = sorted(counts.items(), key=lambda x: -x[1])
        return [{"lieu": l, "nombre_personnes": n} for l, n in sorted_counts]

    def _superficie_par_personne(self, conn, tables, params):
        superficies = {}

        for table in tables:
            try:
                df = pd.read_sql_query(f'SELECT * FROM "{table}"', conn)
                if df.empty:
                    continue

                nom_col = cin_col = sup_col = None
                for c in df.columns:
                    cl = c.lower()
                    if "nom" in cl and not nom_col:
                        nom_col = c
                    if "cin" in cl and not cin_col:
                        cin_col = c
                    if any(k in cl for k in ["superficie", "superf", "surface"]) or cl == "ha":
                        sup_col = c

                if not sup_col:
                    continue

                for idx, row in df.iterrows():
                    key = (str(row.get(nom_col, "") or "").strip() + "|" +
                           str(row.get(cin_col, "") or "").strip())
                    try:
                        sup = float(str(row[sup_col] or 0).replace(",", "."))
                    except Exception:
                        sup = 0
                    superficies[key] = superficies.get(key, 0) + sup
            except Exception:
                continue

        sorted_sup = sorted(superficies.items(), key=lambda x: -x[1])
        result = []
        for key, sup in sorted_sup[:100]:
            parts = key.split("|")
            result.append({
                "nom": parts[0] if len(parts) > 0 else "",
                "cin": parts[1] if len(parts) > 1 else "",
                "superficie_totale": round(sup, 2),
            })
        return result

    def _hommes_femmes(self, conn, tables, params):
        counts = {"H": 0, "F": 0, "Autre": 0}

        for table in tables:
            try:
                df = pd.read_sql_query(f'SELECT * FROM "{table}"', conn)
                if df.empty:
                    continue

                hf_col = None
                for c in df.columns:
                    if c.lower() in ("h_f", "hf", "sexe"):
                        hf_col = c
                        break

                if not hf_col:
                    continue

                for val in df[hf_col]:
                    v = str(val or "").strip().upper()
                    if v in ("H", "HOMME", "MASCULIN", "MALE", "1"):
                        counts["H"] += 1
                    elif v in ("F", "FEMME", "FEMININ", "FEMALE", "2"):
                        counts["F"] += 1
                    elif v:
                        counts["Autre"] += 1
            except Exception:
                continue

        return [{"sexe": s, "nombre": n} for s, n in counts.items()]

    def _personnes_par_filiere(self, conn, tables, params):
        counts = {}
        for table in tables:
            try:
                df = pd.read_sql_query(f'SELECT * FROM "{table}"', conn)
                if df.empty:
                    continue
                fil_col = next((c for c in df.columns if "filiere" in c.lower()), None)
                if not fil_col:
                    continue
                for val in df[fil_col]:
                    v = str(val or "").strip()
                    if v and v.lower() != "nan":
                        counts[v] = counts.get(v, 0) + 1
            except Exception:
                continue
        sorted_c = sorted(counts.items(), key=lambda x: -x[1])
        return [{"filiere": f, "nombre_personnes": n} for f, n in sorted_c]

    def _personnes_par_commune(self, conn, tables, params):
        counts = {}
        for table in tables:
            try:
                df = pd.read_sql_query(f'SELECT * FROM "{table}"', conn)
                if df.empty:
                    continue
                comm_col = next((c for c in df.columns if "commune" in c.lower()), None)
                if not comm_col:
                    continue
                for val in df[comm_col]:
                    v = str(val or "").strip()
                    if v and v.lower() != "nan":
                        counts[v] = counts.get(v, 0) + 1
            except Exception:
                continue
        sorted_c = sorted(counts.items(), key=lambda x: -x[1])
        return [{"commune": c, "nombre_personnes": n} for c, n in sorted_c]

    def _personnes_par_categorisation(self, conn, tables, params):
        counts = {}
        for table in tables:
            try:
                df = pd.read_sql_query(f'SELECT * FROM "{table}"', conn)
                if df.empty:
                    continue
                cat_col = next(
                    (c for c in df.columns
                     if "categorisation" in c.lower() or "categoris" in c.lower()), None)
                if not cat_col:
                    continue
                for val in df[cat_col]:
                    v = str(val or "").strip()
                    if v and v.lower() != "nan":
                        counts[v] = counts.get(v, 0) + 1
            except Exception:
                continue
        sorted_c = sorted(counts.items(), key=lambda x: -x[1])
        return [{"categorisation": c, "nombre_personnes": n} for c, n in sorted_c]

    def _age_moyen(self, conn, tables, params):
        current_year = datetime.now().year
        total_age = 0
        count = 0

        for table in tables:
            try:
                df = pd.read_sql_query(f'SELECT * FROM "{table}"', conn)
                if df.empty:
                    continue
                annee_col = next(
                    (c for c in df.columns
                     if "annee" in c.lower() and "naissance" in c.lower()), None)
                if not annee_col:
                    continue
                for val in df[annee_col]:
                    try:
                        annee = int(float(str(val)))
                        if 1900 < annee <= current_year:
                            total_age += current_year - annee
                            count += 1
                    except Exception:
                        continue
            except Exception:
                continue

        avg = round(total_age / count, 1) if count > 0 else 0
        return [{"age_moyen": avg, "total_personnes": count}]

    def _superficie_totale(self, conn, tables, params):
        total = 0
        for table in tables:
            try:
                df = pd.read_sql_query(f'SELECT * FROM "{table}"', conn)
                if df.empty:
                    continue
                sup_col = next(
                    (c for c in df.columns
                     if any(k in c.lower() for k in ["superficie", "superf", "surface"])), None)
                if not sup_col:
                    continue
                for val in df[sup_col]:
                    try:
                        total += float(str(val).replace(",", "."))
                    except Exception:
                        continue
            except Exception:
                continue
        return [{"superficie_totale": round(total, 2)}]