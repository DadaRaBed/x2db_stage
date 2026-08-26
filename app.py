from pathlib import Path
import re
import pandas as pd
import sqlite3
import webview
import json
import os
import unicodedata
import time
from typing import Optional, Dict, Any, List

from services.auth_service import AuthService
from services.database_service import DatabaseService
from services.excel_service import ExcelService

from repositories.system_database import initialize_database, user_count

BASE_DIR = Path(__file__).resolve().parent
INDEX_FILE = BASE_DIR / "web" / "index.html"

_APP_WINDOW = None


class Api:
    def __init__(self):
        self.current_user = None
        self._database_service = DatabaseService()
        self._auth_service = AuthService()
        self._excel_service = ExcelService()
        self._active_db_path = None

    # === AUTHENTIFICATION ===
    def get_auth_status(self):
        try:
            return {
                "success": True,
                "first_user_exists": user_count() > 0,
                "authenticated": self.current_user is not None,
                "user": self.current_user,
            }
        except Exception as e:
            return {
                "success": False,
                "first_user_exists": False,
                "authenticated": False,
                "user": None,
                "message": f"Unable to verify authentication status : {e}",
            }

    def create_first_user(self, pseudo: str, password: str):
        try:
            return self._auth_service.create_first_user(pseudo, password)
        except Exception as e:
            return {
                "success": False,
                "message": f"Unable to create user : {e}",
            }

    def login(self, pseudo: str, password: str):
        try:
            result = self._auth_service.login(pseudo, password)
            if result.get("success"):
                self.current_user = result.get("user")
            return result
        except Exception as e:
            return {
                "success": False,
                "message": f"Unable to login : {e}",
            }

    def logout(self):
        try:
            self.current_user = None
            self._database_service.close_database()
            self._active_db_path = None
            return {
                "success": True,
                "message": "Logout successful.",
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Unable to close database : {e}",
            }

    def quit_app(self):
        global _APP_WINDOW
        try:
            if _APP_WINDOW:
                _APP_WINDOW.destroy()
            os._exit(0)
        except Exception:
            os._exit(0)

    # === ACTIVITÉS ===
    def get_activities(self, limit: int = 5):
        try:
            log_file = BASE_DIR / "data" / "activity_log.json"
            if not log_file.exists():
                return {"success": True, "activities": []}
            
            with open(log_file, "r", encoding="utf-8") as f:
                activities = json.load(f)
            
            if not isinstance(activities, list):
                return {"success": True, "activities": []}
            
            activities.sort(key=lambda x: x.get("date", ""), reverse=True)
            return {"success": True, "activities": activities[:limit]}
        except Exception as e:
            return {"success": False, "message": str(e), "activities": []}

    def log_activity(self, action_text: str):
        try:
            log_file = BASE_DIR / "data" / "activity_log.json"
            log_file.parent.mkdir(parents=True, exist_ok=True)
            
            activities = []
            if log_file.exists():
                with open(log_file, "r", encoding="utf-8") as f:
                    try:
                        activities = json.load(f)
                    except json.JSONDecodeError:
                        activities = []
            
            if not isinstance(activities, list):
                activities = []
            
            activities.append({
                "text": action_text,
                "date": time.strftime("%Y-%m-%d %H:%M:%S"),
                "user": self.current_user.get("pseudo") if self.current_user else "Unknown"
            })
            
            if len(activities) > 100:
                activities = activities[-100:]
            
            with open(log_file, "w", encoding="utf-8") as f:
                json.dump(activities, f, ensure_ascii=False, indent=2)
            
            return {"success": True}
        except Exception as e:
            return {"success": False, "message": str(e)}

    # === GESTION DES BASES DE DONNÉES ===
    def get_database_info(self):
        try:
            return self._database_service.get_database_info()
        except Exception as e:
            return {
                "success": False,
                "message": f"Unable to retrieve database information : {e}",
            }

    def get_data_directory_databases(self):
        try:
            data_dir = BASE_DIR / "data"
            if not data_dir.exists() or not data_dir.is_dir():
                return {"success": True, "databases": []}

            databases = []
            for file_path in data_dir.glob("*.db"):
                if file_path.is_file() and file_path.name.lower() != "system.db":
                    size_kb = round(file_path.stat().st_size / 1024, 2)
                    databases.append({
                        "name": file_path.name,
                        "path": str(file_path.resolve()),
                        "size_kb": size_kb
                    })

            return {"success": True, "databases": databases}
        except Exception as e:
            return {"success": False, "message": str(e), "databases": []}

    def open_database(self, path: str):
        try:
            if not path:
                return {"success": False, "message": "Database path is empty."}
            
            db_path = Path(path)
            if not db_path.is_absolute():
                db_path = BASE_DIR / "data" / db_path.name

            resolved_path = os.path.abspath(str(db_path))
            if not os.path.exists(resolved_path):
                return {
                    "success": False,
                    "message": f"Database does not exist : {resolved_path}"
                }

            result = self._database_service.open_database(resolved_path)
            if result.get("success"):
                self._active_db_path = resolved_path
            return result
        except Exception as e:
            return {
                "success": False,
                "message": f"Unable to open database : {e}",
            }

    def open_database_path(self, path: str):
        return self.open_database(path)

    def close_database(self):
        try:
            self._active_db_path = None
            return self._database_service.close_database()
        except Exception as e:
            return {
                "success": False,
                "message": f"Unable to close database : {e}",
            }

    def _get_db_path(self, file_path: str = None) -> Optional[str]:
        if file_path:
            return file_path
        
        db_info = self._database_service.get_database_info()
        if db_info.get("success") and db_info.get("path"):
            return db_info["path"]
        
        return self._active_db_path

    # === STRUCTURE ET DONNÉES DES BASES ===
    def get_database_structure_matrix(self, file_path: str = None):
        conn = None
        try:
            db_path = self._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "No active database.", "structure": {}}

            if not os.path.exists(db_path):
                return {"success": False, "message": f"Database does not exist : {db_path}", "structure": {}}

            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
            tables = [row[0] for row in cursor.fetchall()]
            structure = {}

            for table_name in tables:
                escaped_table_name = table_name.replace('"', '""')
                cursor.execute(f'PRAGMA table_info("{escaped_table_name}")')
                columns = [column[1] for column in cursor.fetchall()]
                structure[table_name] = columns

            return {"success": True, "message": "Structure retrieved.", "structure": structure}
        except Exception as error:
            return {"success": False, "message": f"Error : {str(error)}", "structure": {}}
        finally:
            if conn is not None:
                conn.close()

    def get_database_table_names(self, file_path: str = None):
        try:
            db_path = self._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "No active database.", "tables": []}

            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
            tables = [row[0] for row in cursor.fetchall() if row[0] != 'sqlite_sequence']
            conn.close()
            return {"success": True, "tables": tables}
        except Exception as e:
            return {"success": False, "message": str(e), "tables": []}

    def get_table_rows(self, table_name: str, file_path: str = None):
        try:
            db_path = self._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "No active database.", "data": []}

            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(f'SELECT * FROM "{table_name}" LIMIT 500')
            rows = [dict(row) for row in cursor.fetchall()]
            conn.close()
            return {"success": True, "data": rows}
        except Exception as e:
            return {"success": False, "message": str(e), "data": []}

    def get_table_rows_filtered(self, table_name: str, columns: List[str], file_path: str = None):
        try:
            db_path = self._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "No active database.", "data": []}

            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cols_sql = ", ".join([f'"{c}"' for c in columns]) if columns else "*"
            cursor.execute(f'SELECT {cols_sql} FROM "{table_name}" LIMIT 500')
            rows = [dict(row) for row in cursor.fetchall()]
            conn.close()
            return {"success": True, "data": rows}
        except Exception as e:
            return {"success": False, "message": str(e), "data": []}

    def search_in_table(self, table_name: str, search_term: str, file_path: str = None):
        try:
            db_path = self._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "No active database.", "data": []}

            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute(f'PRAGMA table_info("{table_name}")')
            columns = [col[1] for col in cursor.fetchall()]
            
            conditions = " OR ".join([f'"{col}" LIKE ?' for col in columns])
            query = f'SELECT * FROM "{table_name}" WHERE {conditions}'
            params = [f"%{search_term}%" for _ in columns]
            
            cursor.execute(query, params)
            rows = [dict(row) for row in cursor.fetchall()]
            conn.close()
            return {"success": True, "data": rows}
        except Exception as e:
            return {"success": False, "message": str(e), "data": []}

       # === DOUBLONS ===
    def scan_table_duplicates(self, table_name: str, file_path: str = None):
        try:
            db_path = self._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "No active database.", "duplicates": []}

            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute(f'PRAGMA table_info("{table_name}")')
            columns = [col[1] for col in cursor.fetchall()]
            if not columns:
                conn.close()
                return {"success": True, "duplicates": []}

            cols_to_check = [c for c in columns if c.lower() != 'id']
            if not cols_to_check:
                cols_to_check = columns

            cols_str = ", ".join([f'"{c}"' for c in cols_to_check])
            
            query = f"""
                SELECT rowid, * FROM "{table_name}" 
                WHERE rowid NOT IN (
                    SELECT MIN(rowid) 
                    FROM "{table_name}" 
                    GROUP BY {cols_str}
                )
            """
            cursor.execute(query)
            rows = cursor.fetchall()
            
            duplicates = []
            for row in rows:
                row_dict = dict(row)
                
                conditions = []
                vals = []
                for c in cols_to_check:
                    val = row_dict.get(c)
                    if val is not None:
                        conditions.append(f'"{c}" = ?')
                        vals.append(val)
                    else:
                        conditions.append(f'"{c}" IS NULL')
                
                ref_query = f"""
                    SELECT rowid, * FROM "{table_name}" 
                    WHERE { " AND ".join(conditions) }
                    LIMIT 1
                """
                cursor.execute(ref_query, vals)
                ref_row = cursor.fetchone()
                
                ref_id = ref_row[0] if ref_row else None
                ref_data = dict(ref_row) if ref_row else {}

                duplicates.append({
                    "row_index": row_dict.get("rowid", row_dict.get("id", 1)),
                    "reference_id": ref_id,
                    "data": row_dict,
                    "reference_data": ref_data
                })

            conn.close()
            return {"success": True, "duplicates": duplicates}
        except Exception as e:
            return {"success": False, "message": str(e), "duplicates": []}

    # === DOUBLONS AVANCÉS ===
    def scan_table_duplicates_advanced(self, table_name: str, algorithm: str = "general", file_path: str = None):
        try:
            db_path = self._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "No active database.", "duplicates": []}

            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute(f'PRAGMA table_info("{table_name}")')
            columns = [col[1] for col in cursor.fetchall()]
            if not columns:
                conn.close()
                return {"success": True, "duplicates": []}

            if algorithm == "general":
                cols_to_check = [c for c in columns if c.lower() != 'id']
                if not cols_to_check:
                    cols_to_check = columns
                
                df = pd.read_sql_query(f'SELECT rowid, * FROM "{table_name}"', conn)
                conn.close()
                
                if df.empty:
                    return {"success": True, "duplicates": []}
                
                df['_hash_key'] = df[cols_to_check].fillna('').astype(str).apply(
                    lambda x: '|'.join(x.str.upper().str.strip()), axis=1
                )
                
                duplicate_mask = df.duplicated(subset=['_hash_key'], keep='first')
                duplicates = []
                
                if duplicate_mask.any():
                    grouped = df.groupby('_hash_key')
                    hash_to_first = {hash_val: group.iloc[0] for hash_val, group in grouped}
                    
                    for idx, row in df[duplicate_mask].iterrows():
                        hash_key = row['_hash_key']
                        ref_row = hash_to_first.get(hash_key)
                        
                        if ref_row is not None:
                            row_dict = self._convert_row_to_dict(row, columns)
                            ref_dict = self._convert_row_to_dict(ref_row, columns)
                            
                            duplicates.append({
                                "row_index": int(row['rowid']),
                                "reference_id": int(ref_row['rowid']),
                                "data": row_dict,
                                "reference_data": ref_dict,
                                "algorithm": "general"
                            })
                
                return {"success": True, "duplicates": duplicates, "algorithm": "general"}

            elif algorithm == "cin_nom":
                df = pd.read_sql_query(f'SELECT rowid, * FROM "{table_name}"', conn)
                conn.close()
                
                if df.empty:
                    return {"success": True, "duplicates": []}
                
                cin_col = None
                nom_col = None
                district_col = None
                commune_col = None
                localite_col = None
                
                cin_patterns = ['cin', 'nin', 'nif', 'id', 'num', 'numero', 'matricule']
                nom_patterns = ['nom', 'name', 'prenom', 'firstname', 'lastname', 'fullname', 'raison']
                district_patterns = ['district', 'dist', 'arrondissement']
                commune_patterns = ['commune', 'comm', 'ville', 'city']
                localite_patterns = ['localite', 'localite', 'lieu', 'village', 'fokontany']
                
                for col in columns:
                    col_lower = col.lower()
                    if not cin_col and any(p in col_lower for p in cin_patterns):
                        cin_col = col
                    if not nom_col and any(p in col_lower for p in nom_patterns):
                        nom_col = col
                    if not district_col and any(p in col_lower for p in district_patterns):
                        district_col = col
                    if not commune_col and any(p in col_lower for p in commune_patterns):
                        commune_col = col
                    if not localite_col and any(p in col_lower for p in localite_patterns):
                        localite_col = col
                
                if not cin_col and len(columns) > 0:
                    cin_col = columns[0]
                if not nom_col and len(columns) > 1:
                    nom_col = columns[1]
                
                if not cin_col or not nom_col:
                    return self.scan_table_duplicates_advanced(table_name, "general", file_path)
                
                df['_cin_clean'] = df[cin_col].fillna('').astype(str).str.upper().str.strip()
                df['_cin_clean'] = df['_cin_clean'].str.replace(r'[^A-Z0-9]', '', regex=True)
                df['_nom_clean'] = df[nom_col].fillna('').astype(str).str.upper().str.strip()
                
                if district_col:
                    df['_district_clean'] = df[district_col].fillna('').astype(str).str.upper().str.strip()
                else:
                    df['_district_clean'] = ''
                
                if commune_col:
                    df['_commune_clean'] = df[commune_col].fillna('').astype(str).str.upper().str.strip()
                else:
                    df['_commune_clean'] = ''
                
                if localite_col:
                    df['_localite_clean'] = df[localite_col].fillna('').astype(str).str.upper().str.strip()
                else:
                    df['_localite_clean'] = ''
                
                df = df[(df['_cin_clean'] != '') | (df['_nom_clean'] != '')]
                
                if df.empty:
                    return {"success": True, "duplicates": []}
                
                duplicates = []
                processed = set()
                
                rows_list = []
                for idx, row in df.iterrows():
                    row_data = {
                        'rowid': int(row['rowid']),
                        'cin': row['_cin_clean'],
                        'nom': row['_nom_clean'],
                        'district': row['_district_clean'],
                        'commune': row['_commune_clean'],
                        'localite': row['_localite_clean'],
                        'data': {k: row[k] for k in columns}
                    }
                    rows_list.append(row_data)
                
                # === GROUPE 1: DOUBLONS CIN ===
                cin_groups = {}
                for row in rows_list:
                    if row['cin'] and len(row['cin']) >= 3:
                        key = row['cin']
                        if key not in cin_groups:
                            cin_groups[key] = []
                        cin_groups[key].append(row)
                
                for cin_key, group in cin_groups.items():
                    if len(group) <= 1:
                        continue
                    
                    group_sorted = sorted(group, key=lambda x: x['nom'])
                    
                    for i in range(len(group_sorted)):
                        if group_sorted[i]['rowid'] in processed:
                            continue
                        
                        ref_row = group_sorted[i]
                        
                        for j in range(i + 1, len(group_sorted)):
                            if group_sorted[j]['rowid'] in processed:
                                continue
                            
                            dup_row = group_sorted[j]
                            
                            nom_match = self._fuzzy_match_optimized(ref_row['nom'], dup_row['nom'], 0.85)
                            
                            if nom_match:
                                row_dict = dup_row['data']
                                ref_dict = ref_row['data']
                                
                                duplicates.append({
                                    "row_index": dup_row['rowid'],
                                    "reference_id": ref_row['rowid'],
                                    "data": row_dict,
                                    "reference_data": ref_dict,
                                    "algorithm": "cin_nom_cin",
                                    "cin_col": cin_col,
                                    "nom_col": nom_col,
                                    "cin_value": dup_row['cin'],
                                    "nom_value": dup_row['nom'],
                                    "context": {
                                        "type": "CIN_IDENTICAL",
                                        "cin": cin_key,
                                        "nom_similarity": self._calculate_similarity(ref_row['nom'], dup_row['nom'])
                                    }
                                })
                                processed.add(dup_row['rowid'])
                
                # === GROUPE 2: DOUBLONS NOM + GÉOLOCALISATION ===
                geo_nom_groups = {}
                for row in rows_list:
                    if row['rowid'] in processed:
                        continue
                    
                    if not row['nom'] or len(row['nom']) < 3:
                        continue
                    
                    geo_key = f"{row['district']}|{row['commune']}" if row['district'] and row['commune'] else "||"
                    
                    if geo_key not in geo_nom_groups:
                        geo_nom_groups[geo_key] = []
                    geo_nom_groups[geo_key].append(row)
                
                for geo_key, group in geo_nom_groups.items():
                    if len(group) <= 1:
                        continue
                    
                    for i in range(len(group)):
                        if group[i]['rowid'] in processed:
                            continue
                        
                        ref_row = group[i]
                        
                        for j in range(i + 1, len(group)):
                            if group[j]['rowid'] in processed:
                                continue
                            
                            dup_row = group[j]
                            
                            nom_match = self._fuzzy_match_optimized(ref_row['nom'], dup_row['nom'], 0.85)
                            
                            if nom_match:
                                row_dict = dup_row['data']
                                ref_dict = ref_row['data']
                                
                                duplicates.append({
                                    "row_index": dup_row['rowid'],
                                    "reference_id": ref_row['rowid'],
                                    "data": row_dict,
                                    "reference_data": ref_dict,
                                    "algorithm": "cin_nom_geo",
                                    "cin_col": cin_col,
                                    "nom_col": nom_col,
                                    "cin_value": dup_row['cin'],
                                    "nom_value": dup_row['nom'],
                                    "context": {
                                        "type": "NOM_GEO",
                                        "district": dup_row['district'],
                                        "commune": dup_row['commune'],
                                        "nom_similarity": self._calculate_similarity(ref_row['nom'], dup_row['nom'])
                                    }
                                })
                                processed.add(dup_row['rowid'])
                
                return {"success": True, "duplicates": duplicates, "algorithm": "cin_nom"}

            else:
                conn.close()
                return {"success": True, "duplicates": []}

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"success": False, "message": str(e), "duplicates": []}

    def _convert_row_to_dict(self, row, columns):
        result = {}
        for k in columns:
            val = row.get(k)
            if val is None or pd.isna(val):
                result[k] = None
            elif hasattr(val, 'item'):
                try:
                    result[k] = val.item()
                except:
                    result[k] = str(val)
            elif isinstance(val, (int, float, str, bool)):
                result[k] = val
            else:
                result[k] = str(val)
        return result

    def _fuzzy_match_optimized(self, str1: str, str2: str, threshold: float = 0.85) -> bool:
        if not str1 and not str2:
            return True
        if not str1 or not str2:
            return False
        
        str1 = str1.upper().strip()
        str2 = str2.upper().strip()
        
        if str1 == str2:
            return True
        if str1 in str2 or str2 in str1:
            return True
        
        len1, len2 = len(str1), len(str2)
        if abs(len1 - len2) > max(len1, len2) * 0.4:
            return False
        
        shorter = str1 if len1 <= len2 else str2
        longer = str2 if len1 <= len2 else str1
        
        common = sum(1 for c in shorter if c in longer)
        ratio = common / max(len1, len2)
        
        return ratio >= threshold

    def _calculate_similarity(self, str1: str, str2: str) -> float:
        if not str1 or not str2:
            return 0.0
        if str1 == str2:
            return 1.0
        
        str1 = str1.upper().strip()
        str2 = str2.upper().strip()
        
        common = sum(1 for c in str1 if c in str2)
        max_len = max(len(str1), len(str2))
        if max_len == 0:
            return 0.0
        
        return common / max_len

    def delete_table_row(self, table_name: str, row_id: int, file_path: str = None):
        try:
            db_path = self._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "No active database."}

            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute(f'DELETE FROM "{table_name}" WHERE rowid = ?', (row_id,))
            conn.commit()
            conn.close()
            return {"success": True, "message": f"Row {row_id} deleted."}
        except Exception as e:
            return {"success": False, "message": str(e)}

    # === NETTOYAGE ===
    def clean_database_values(self, file_path: str = None):
        try:
            db_path = self._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "No active database."}

            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
            tables = [row[0] for row in cursor.fetchall() if row[0] != 'sqlite_sequence']

            for table in tables:
                df = pd.read_sql_query(f"SELECT * FROM [{table}]", conn)
                if df.empty:
                    continue
                for col in df.columns:
                    if pd.api.types.is_numeric_dtype(df[col]):
                        df[col] = df[col].fillna(0)
                    else:
                        df[col] = df[col].fillna("Not specified")
                df.to_sql(table, conn, if_exists="replace", index=False)

            conn.close()
            return {"success": True, "message": "Cleaning of NaN/Null values completed successfully !"}
        except Exception as e:
            return {"success": False, "message": str(e)}
   
   
   
    # === IMPORTATION EXCEL ===
    def select_excel_file(self):
        global _APP_WINDOW
        if _APP_WINDOW is None:
            return {
                "success": False,
                "message": "Application window is not available.",
            }
        try:
            result = _APP_WINDOW.create_file_dialog(
                webview.OPEN_DIALOG,
                file_types=(
                    "Excel Files (*.xls;*.xlsx)",
                    "Old Excel (*.xls)",
                    "Modern Excel (*.xlsx)",
                ),
            )
            if not result:
                return {
                    "success": False,
                    "message": "No file selected.",
                }
            return {
                "success": True,
                "file_path": str(result[0]),
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Unable to select Excel file : {e}",
            }

    def get_excel_sheets(self, file_path: str):
        try:
            if not file_path or not str(file_path).strip():
                return {
                    "success": False,
                    "message": "File path is required.",
                }
            sheets = self._excel_service.get_sheets(file_path)
            return {
                "success": True,
                "file_path": str(file_path),
                "sheets": sheets or [],
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Excel file is invalid or cannot be read : {e}",
                "sheets": [],
            }

    def preview_excel_sheet(self, file_path: str, sheet_name: str):
        try:
            if not file_path or not str(file_path).strip():
                return {"success": False, "message": "Excel file is required."}
            if not sheet_name or not str(sheet_name).strip():
                return {"success": False, "message": "Excel sheet is required."}

            preview = self._excel_service.preview_sheet(file_path, sheet_name, max_rows=1)
            headers = []
            if isinstance(preview, dict):
                headers = preview.get("headers", [])
                if not headers and "data" in preview and len(preview["data"]) > 0:
                    headers = preview["data"][0]
            return {
                "success": True,
                "headers": headers if isinstance(headers, list) else list(headers),
                "preview": preview.get("data", []) if isinstance(preview, dict) else []
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Unable to read Excel sheet : {e}",
            }

    def _clean_ascii(self, text) -> str:
        nfkd_form = unicodedata.normalize('NFKD', str(text))
        only_ascii = "".join([c for c in nfkd_form if not unicodedata.combining(c)])
        return re.sub(r"[^\w]", "_", only_ascii).lower().strip('_')

    def import_excel_to_database(self, file_path: str, sheet_name: str = None, table_name: str = None):
        try:
            if not file_path or not str(file_path).strip():
                return {"success": False, "message": "Excel file is required."}

            excel_path = Path(file_path)
            data_dir = BASE_DIR / "data"
            data_dir.mkdir(parents=True, exist_ok=True)

            safe_db_name = self._clean_ascii(excel_path.stem) or "database"
            db_filename = f"{safe_db_name}.db"
            db_path = data_dir / db_filename

            all_sheets = pd.read_excel(excel_path, sheet_name=None)
            conn = sqlite3.connect(str(db_path))
            tables_created = []
            total_rows = 0
            log_path = data_dir / "logs.txt"
            
            for current_sheet, df in all_sheets.items():
                if sheet_name and str(current_sheet) != str(sheet_name):
                    continue
                
                clean_table_name = table_name if (table_name and len(all_sheets) == 1) else (self._clean_ascii(str(current_sheet)) or "table")
                
                try:
                    df = df.dropna(how="all")
                    
                    if any(str(col).lower().startswith("unnamed") for col in df.columns):
                        if len(df) > 0:
                            new_headers = df.iloc[0].fillna("unknown_column").astype(str).tolist()
                            cleaned_headers = []
                            seen = {}
                            for h in new_headers:
                                h_clean = self._clean_ascii(h) or "col"
                                if h_clean in seen:
                                    seen[h_clean] += 1
                                    h_clean = f"{h_clean}_{seen[h_clean]}"
                                else:
                                    seen[h_clean] = 0
                                cleaned_headers.append(h_clean)
                            df.columns = cleaned_headers
                            df = df.drop(df.index[0])

                    for col in df.columns:
                        if pd.api.types.is_numeric_dtype(df[col]):
                            df[col] = df[col].fillna(0)
                        else:
                            df[col] = df[col].fillna("Not specified")

                    df.columns = [self._clean_ascii(str(col)) or "col" for col in df.columns]
                    df.to_sql(clean_table_name, conn, if_exists="replace", index=False)
                    tables_created.append(clean_table_name)
                    total_rows += len(df)
                except Exception as sheet_err:
                    err_msg = f"[IMPORT ERROR] Sheet '{current_sheet}': {str(sheet_err)}\n"
                    with open(log_path, "a", encoding="utf-8") as log_file:
                        log_file.write(err_msg)
                    continue

            conn.close()
            self.open_database(str(db_path))

            return {
                "success": True,
                "message": f"Import successful ! {len(tables_created)} table(s) created.",
                "tables": tables_created,
                "total_rows": total_rows,
                "db_path": str(db_path)
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Critical error during conversion : {e}",
            }

    # === EXPORTATION PDF ===
    def select_pdf_file(self):
        global _APP_WINDOW
        if _APP_WINDOW is None:
            return {
                "success": False,
                "message": "Application window is not available.",
            }
        try:
            result = _APP_WINDOW.create_file_dialog(
                webview.SAVE_DIALOG,
                file_types=("PDF Files (*.pdf)",),
                directory=os.path.expanduser("~/Documents")
            )
            
            if not result:
                return {
                    "success": False,
                    "message": "No file selected.",
                }
            
            if isinstance(result, (list, tuple)):
                file_path = str(result[0])
            else:
                file_path = str(result)
            
            if not file_path.lower().endswith('.pdf'):
                file_path += '.pdf'
            
            return {
                "success": True,
                "file_path": file_path,
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Unable to select PDF file : {e}",
            }

    def generate_pdf_from_html(self, output_path: str, html_content: str):
        try:
            output_path = str(output_path).strip()
            
            if output_path.startswith("('") or output_path.startswith('("'):
                import ast
                try:
                    parsed = ast.literal_eval(output_path)
                    if isinstance(parsed, (list, tuple)):
                        output_path = str(parsed[0])
                except:
                    output_path = output_path.replace("('", "").replace("')", "").replace('("', "").replace('")', "")
            
            output_dir = os.path.dirname(output_path)
            if output_dir and not os.path.exists(output_dir):
                os.makedirs(output_dir, exist_ok=True)
            
            # Améliorer le HTML pour un meilleur rendu PDF
            pdf_html = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Duplicates Report</title>
                <style>
                    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
                    body {{ 
                        font-family: 'DejaVu Sans', 'Arial', sans-serif; 
                        padding: 50px; 
                        color: #1a1a2e;
                        background: #ffffff;
                        font-size: 12px;
                    }}
                    .header {{
                        text-align: center;
                        padding-bottom: 30px;
                        border-bottom: 3px solid #4f46e5;
                        margin-bottom: 30px;
                    }}
                    .header h1 {{
                        color: #4f46e5;
                        font-size: 28px;
                        font-weight: 700;
                        letter-spacing: 1px;
                    }}
                    .header .subtitle {{
                        color: #666;
                        font-size: 14px;
                        margin-top: 8px;
                    }}
                    .info-grid {{
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 15px;
                        background: #f8fafc;
                        padding: 20px;
                        border-radius: 8px;
                        margin-bottom: 30px;
                        border: 1px solid #e2e8f0;
                    }}
                    .info-grid .item {{
                        display: flex;
                        flex-direction: column;
                    }}
                    .info-grid .label {{
                        font-weight: 600;
                        color: #4f46e5;
                        font-size: 11px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }}
                    .info-grid .value {{
                        font-size: 14px;
                        color: #1a1a2e;
                        margin-top: 2px;
                    }}
                    .summary {{
                        background: #e0e7ff;
                        padding: 15px 20px;
                        border-radius: 8px;
                        margin-bottom: 25px;
                        border-left: 4px solid #4f46e5;
                        font-weight: 600;
                        font-size: 16px;
                        color: #4f46e5;
                    }}
                    table {{
                        width: 100%;
                        border-collapse: collapse;
                        margin: 20px 0;
                        font-size: 10px;
                    }}
                    th {{
                        background: #4f46e5;
                        color: white;
                        padding: 10px 12px;
                        text-align: left;
                        font-weight: 600;
                        border: 1px solid #4f46e5;
                    }}
                    td {{
                        padding: 8px 12px;
                        border: 1px solid #e2e8f0;
                        vertical-align: top;
                        word-wrap: break-word;
                        max-width: 200px;
                    }}
                    tr:nth-child(even) {{
                        background: #f8fafc;
                    }}
                    tr:hover {{
                        background: #e0e7ff;
                    }}
                    .footer {{
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 1px solid #e2e8f0;
                        text-align: center;
                        color: #94a3b8;
                        font-size: 10px;
                    }}
                    @page {{
                        margin: 1.5cm;
                    }}
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Duplicates Report</h1>
                    <div class="subtitle">Data Manager - Expert Edition</div>
                </div>
                
                <div class="info-grid">
                    <div class="item">
                        <span class="label">Date</span>
                        <span class="value">{time.strftime('%d/%m/%Y at %H:%M:%S')}</span>
                    </div>
                    <div class="item">
                        <span class="label">Database</span>
                        <span class="value">{os.path.basename(output_path) if output_path else 'Not specified'}</span>
                    </div>
                    <div class="item">
                        <span class="label">Algorithm</span>
                        <span class="value">CIN + NOM + Geolocation</span>
                    </div>
                    <div class="item">
                        <span class="label">Total duplicates</span>
                        <span class="value" style="color: #ef4444; font-weight: 700;">{html_content.count('dup-col-doublon')}</span>
                    </div>
                </div>
                
                <div class="summary">
                    Results of duplicate detection
                </div>
            """
            
            table_match = re.search(r'<table[^>]*>(.*?)</table>', html_content, re.DOTALL)
            if table_match:
                table_html = table_match.group(0)
                table_html = table_html.replace('dup-col-doublon', 'col-cin')
                table_html = table_html.replace('dup-col-reference', 'col-nom')
                pdf_html += table_html
            
            pdf_html += """
                <div class="footer">
                    Report generated automatically by Data Manager - Expert Edition
                </div>
            </body>
            </html>
            """
            
            # Essayer avec weasyprint
            try:
                from weasyprint import HTML
                HTML(string=pdf_html).write_pdf(output_path)
                return {"success": True, "message": f"PDF generated successfully : {output_path}"}
            except ImportError:
                pass
            
            # Fallback sur pdfkit
            try:
                import pdfkit
                options = {
                    'page-size': 'A4',
                    'margin-top': '0.75in',
                    'margin-right': '0.75in',
                    'margin-bottom': '0.75in',
                    'margin-left': '0.75in',
                    'encoding': "UTF-8",
                    'no-outline': None,
                    'enable-local-file-access': None
                }
                pdfkit.from_string(pdf_html, output_path, options=options)
                return {"success": True, "message": f"PDF generated successfully : {output_path}"}
            except ImportError:
                return {"success": False, "message": "No PDF library available. Install weasyprint or pdfkit."}
                
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"success": False, "message": f"Error generating PDF : {e}"}

    # === REQUÊTES SQL AVANCÉES ===
    def execute_custom_sql_operation(self, table_name: str, op_type: str, 
                                     attribute: str = None, value: str = None, 
                                     group_by: str = None, file_path: str = None):
        try:
            db_path = self._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "No active database.", "data": []}

            safe_table = table_name.replace('"', '""')
            safe_attr = attribute.replace('"', '""') if attribute else "*"
            safe_group = group_by.replace('"', '""') if group_by else None

            conn = sqlite3.connect(db_path)
            op = op_type.upper()
            
            query = ""
            params = ()

            if op == "SELECT_ALL":
                query = f'SELECT * FROM "{safe_table}"'
            
            elif op == "DISTINCT":
                if not attribute:
                    return {"success": False, "message": "Attribute required for DISTINCT.", "data": []}
                query = f'SELECT DISTINCT "{safe_attr}" FROM "{safe_table}"'
            
            elif op in ["MIN", "MAX", "COUNT", "SUM", "AVG"]:
                if not attribute and op != "COUNT":
                    return {"success": False, "message": f"Attribute required for {op}.", "data": []}
                target_col = f'"{safe_attr}"' if attribute else "*"
                query = f'SELECT {op}({target_col}) as result FROM "{safe_table}"'
            
            elif op == "WHERE_LIKE":
                if not attribute:
                    return {"success": False, "message": "Attribute required for WHERE / LIKE.", "data": []}
                query = f'SELECT * FROM "{safe_table}" WHERE "{safe_attr}" LIKE ?'
                params = (f"%{value if value else ''}%",)
            
            elif op == "GROUP_BY":
                if not safe_group:
                    return {"success": False, "message": "Group by field required.", "data": []}
                agg_col = f'"{safe_attr}"' if attribute else "*"
                query = f'SELECT "{safe_group}", COUNT({agg_col}) as total FROM "{safe_table}" GROUP BY "{safe_group}"'
            
            else:
                query = f'SELECT * FROM "{safe_table}"'

            df = pd.read_sql_query(query, conn, params=params if params else None)
            conn.close()

            return {"success": True, "data": df.fillna("").to_dict(orient="records")}
        except Exception as e:
            return {"success": False, "message": f"SQL Error : {str(e)}", "data": []}

    # === EXPORTATION EXCEL ===
    def export_database_to_excel(self, output_excel_path: str, file_path: str = None):
        try:
            db_path = self._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "No active database."}

            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
            tables = [row[0] for row in cursor.fetchall() if row[0] != 'sqlite_sequence']

            with pd.ExcelWriter(output_excel_path, engine='openpyxl') as writer:
                for table in tables:
                    df = pd.read_sql_query(f'SELECT * FROM "{table}"', conn)
                    df.to_excel(writer, sheet_name=table[:31], index=False)

            conn.close()
            return {"success": True, "message": f"Export successful to {output_excel_path}"}
        except Exception as e:
            return {"success": False, "message": str(e)}


def main():
    global _APP_WINDOW
    initialize_database()
    api = Api()
    
    _APP_WINDOW = webview.create_window(
        "Data Manager - Expert Edition",
        str(INDEX_FILE),
        js_api=api,
        width=1280,
        height=800,
        resizable=True,
        fullscreen=False
    )
    webview.start()


if __name__ == "__main__":
    main()