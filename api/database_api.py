"""
Gestion des bases de donnees : ouverture, fermeture, structure, CRUD.
"""

import os
import time
from pathlib import Path
from typing import Optional, Dict, Any, List

import pandas as pd

from paths import DATA_DIR
from api.utils import connect_db, safe_close_connection, release_resources


class DatabaseApi:
    def __init__(self, database_service):
        self._database_service = database_service
        self._active_db_path = None
        self._is_loading = False
        self._last_db_path = None
        self._loading_start_time = None

    # ============================================================
    # PROPRIETES
    # ============================================================
    @property
    def active_db_path(self):
        return self._active_db_path

    @active_db_path.setter
    def active_db_path(self, value):
        self._active_db_path = value

    @property
    def is_loading(self):
        return self._is_loading

    # ============================================================
    # GESTION DE LA BASE
    # ============================================================
    def get_database_info(self):
        try:
            return self._database_service.get_database_info()
        except Exception as e:
            return {
                "success": False,
                "message": f"Impossible de recuperer les informations : {e}",
            }

    def get_data_directory_databases(self):
        try:
            data_dir = DATA_DIR
            if not data_dir.exists() or not data_dir.is_dir():
                return {"success": True, "databases": []}

            databases = []
            for file_path in data_dir.glob("*.db"):
                if file_path.is_file() and file_path.name.lower() != "system.db":
                    size_kb = round(file_path.stat().st_size / 1024, 2)
                    databases.append({
                        "name": file_path.name,
                        "path": str(file_path.resolve()),
                        "size_kb": size_kb,
                    })

            return {"success": True, "databases": databases}
        except Exception as e:
            return {"success": False, "message": str(e), "databases": []}

    def _get_db_path(self, file_path: str = None) -> Optional[str]:
        if file_path:
            return file_path

        db_info = self._database_service.get_database_info()
        if db_info.get("success") and db_info.get("path"):
            return db_info["path"]

        return self._active_db_path

    def open_database(self, path: str):
        try:
            if self._is_loading:
                return {"success": False, "message": "Une operation est deja en cours."}

            if not path:
                return {"success": False, "message": "Le chemin est vide."}

            db_path = Path(path)
            if not db_path.is_absolute():
                db_path = DATA_DIR / db_path.name

            resolved_path = os.path.abspath(str(db_path))
            if not os.path.exists(resolved_path):
                return {
                    "success": False,
                    "message": f"La base de donnees n'existe pas : {resolved_path}",
                }

            if self._active_db_path == resolved_path:
                try:
                    self._database_service.close_database()
                except Exception:
                    pass
                self._active_db_path = None
                self._last_db_path = None
                release_resources(0.2)

            self._is_loading = True
            self._loading_start_time = time.time()

            if self._active_db_path and self._active_db_path != resolved_path:
                try:
                    self._database_service.close_database()
                except Exception:
                    pass
                self._active_db_path = None
                self._last_db_path = None
                release_resources(0.2)

            result = self._database_service.open_database(resolved_path)

            self._is_loading = False
            self._loading_start_time = None

            if result.get("success"):
                self._active_db_path = resolved_path
                self._last_db_path = resolved_path
                return result
            return result

        except Exception as e:
            self._is_loading = False
            self._loading_start_time = None
            return {
                "success": False,
                "message": f"Impossible d'ouvrir la base : {e}",
            }

    def open_database_path(self, path: str):
        return self.open_database(path)

    def close_database(self):
        try:
            self._active_db_path = None
            self._last_db_path = None
            self._is_loading = False
            self._loading_start_time = None
            try:
                result = self._database_service.close_database()
            except Exception:
                result = {"success": True, "message": "Base fermee."}
            release_resources(0.15)
            return result
        except Exception:
            self._active_db_path = None
            self._last_db_path = None
            self._is_loading = False
            return {"success": True, "message": "Base fermee."}

    def terminate_database(self):
        """Termine l'utilisation de la base active."""
        try:
            if self._is_loading:
                elapsed = time.time() - (self._loading_start_time or time.time())
                if elapsed < 5:
                    return {
                        "success": False,
                        "message": "Une operation est en cours. Veuillez patienter quelques secondes.",
                        "error_type": "operation_in_progress",
                    }
                else:
                    self._is_loading = False
                    self._loading_start_time = None

            if self._active_db_path is None:
                return {
                    "success": True,
                    "message": "Aucune base de donnees n'est actuellement ouverte.",
                    "already_closed": True,
                }

            db_name = os.path.basename(self._active_db_path)

            try:
                self._database_service.close_database()
            except Exception as e:
                print(f"[INFO] Fermeture base (thread different) : {e}")

            self._active_db_path = None
            self._last_db_path = None
            self._is_loading = False
            self._loading_start_time = None

            release_resources(0.3)

            return {
                "success": True,
                "message": f"Base de donnees '{db_name}' terminee avec succes. Vous pouvez maintenant vous deconnecter.",
                "closed_db": db_name,
            }
        except Exception:
            self._active_db_path = None
            self._last_db_path = None
            self._is_loading = False
            self._loading_start_time = None
            return {"success": True, "message": "Base de donnees terminee."}

    # ============================================================
    # SUPPRESSION DE BASE DE DONNEES
    # ============================================================
    def delete_database(self, db_path: str):
        try:
            if not db_path or not str(db_path).strip():
                return {"success": False, "message": "Le chemin est vide."}

            db_file = Path(db_path).resolve()

            try:
                db_file.relative_to(DATA_DIR.resolve())
            except ValueError:
                return {
                    "success": False,
                    "message": "Suppression refusee : la base doit se trouver dans le dossier data/.",
                }

            if not db_file.exists():
                return {"success": False, "message": "La base de donnees n'existe pas."}

            if db_file.name.lower() == "system.db":
                return {
                    "success": False,
                    "message": "Suppression interdite : 'system.db' contient les informations des utilisateurs.",
                }

            db_name = db_file.name

            if self._active_db_path and os.path.abspath(self._active_db_path) == str(db_file):
                try:
                    self._database_service.close_database()
                except Exception:
                    pass
                self._active_db_path = None
                self._last_db_path = None
                release_resources(0.2)

            time.sleep(0.25)

            deleted_files = []
            try:
                if db_file.exists():
                    os.remove(str(db_file))
                    deleted_files.append(db_name)
            except Exception as e:
                return {
                    "success": False,
                    "message": f"Impossible de supprimer '{db_name}' : {e}",
                }

            for suffix in ("-wal", "-shm", "-journal"):
                annex = Path(str(db_file) + suffix)
                if annex.exists():
                    try:
                        os.remove(str(annex))
                        deleted_files.append(annex.name)
                    except Exception:
                        pass

            return {
                "success": True,
                "message": f"Base de donnees '{db_name}' supprimee definitivement.",
                "deleted": deleted_files,
                "db_name": db_name,
            }
        except Exception as e:
            return {"success": False, "message": f"Erreur lors de la suppression : {e}"}

    # ============================================================
    # SUPPRESSION DE TABLE
    # ============================================================
    def delete_table(self, table_name: str, file_path: str = None):
        try:
            if not table_name or not str(table_name).strip():
                return {"success": False, "message": "Le nom de la table est requis."}

            db_path = self._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "Aucune base active."}

            safe_table = str(table_name).replace('"', '""')

            conn = connect_db(db_path)
            try:
                cursor = conn.cursor()

                cursor.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
                    (table_name,),
                )
                if not cursor.fetchone():
                    return {
                        "success": False,
                        "message": f"La table '{table_name}' n'existe pas.",
                    }

                if table_name.lower() in ("sqlite_sequence", "sqlite_master"):
                    return {
                        "success": False,
                        "message": "Suppression interdite : table systeme SQLite.",
                    }

                cursor.execute(f'DROP TABLE IF EXISTS "{safe_table}"')
                conn.commit()
            finally:
                safe_close_connection(conn)

            return {
                "success": True,
                "message": f"Table '{table_name}' supprimee avec succes.",
                "table_name": table_name,
            }
        except Exception as e:
            return {"success": False, "message": f"Erreur lors de la suppression : {e}"}

    # ============================================================
    # STRUCTURE
    # ============================================================
    def get_database_structure_matrix(self, file_path: str = None):
        conn = None
        try:
            db_path = self._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "Aucune base active.", "structure": {}}

            if not os.path.exists(db_path):
                return {
                    "success": False,
                    "message": f"La base n'existe pas : {db_path}",
                    "structure": {},
                }

            conn = connect_db(db_path)
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )
            tables = [row[0] for row in cursor.fetchall()]
            structure = {}

            for table_name in tables:
                escaped_table_name = table_name.replace('"', '""')
                cursor.execute(f'PRAGMA table_info("{escaped_table_name}")')
                columns = [column[1] for column in cursor.fetchall()]
                structure[table_name] = columns

            return {
                "success": True,
                "message": "Structure recuperee.",
                "structure": structure,
            }
        except Exception as error:
            return {
                "success": False,
                "message": f"Erreur : {str(error)}",
                "structure": {},
            }
        finally:
            safe_close_connection(conn)

    def get_database_table_names(self, file_path: str = None):
        conn = None
        try:
            db_path = self._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "Aucune base active.", "tables": []}

            conn = connect_db(db_path)
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
            )
            tables = [
                row[0] for row in cursor.fetchall() if row[0] != "sqlite_sequence"
            ]
            return {"success": True, "tables": tables}
        except Exception as e:
            return {"success": False, "message": str(e), "tables": []}
        finally:
            safe_close_connection(conn)

    def get_table_columns(self, table_name: str, file_path: str = None):
        conn = None
        try:
            db_path = self._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "Aucune base active.", "columns": []}

            conn = connect_db(db_path)
            cursor = conn.cursor()
            escaped_table_name = table_name.replace('"', '""')
            cursor.execute(f'PRAGMA table_info("{escaped_table_name}")')
            columns = [col[1] for col in cursor.fetchall()]
            return {"success": True, "columns": columns}
        except Exception as e:
            return {"success": False, "message": str(e), "columns": []}
        finally:
            safe_close_connection(conn)

    # ============================================================
    # DONNEES
    # ============================================================
    def get_table_rows(self, table_name: str, file_path: str = None, limit: int = 1000):
        conn = None
        try:
            db_path = self._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "Aucune base active.", "data": [], "total_count": 0}

            conn = connect_db(db_path)
            import sqlite3
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute(f'SELECT COUNT(*) FROM "{table_name}"')
            total_count = cursor.fetchone()[0]

            cursor.execute(f'SELECT * FROM "{table_name}" LIMIT {limit}')
            rows = [dict(row) for row in cursor.fetchall()]

            return {
                "success": True,
                "data": rows,
                "total_count": total_count,
                "returned_count": len(rows),
                "limit_applied": limit,
            }
        except Exception as e:
            return {"success": False, "message": str(e), "data": [], "total_count": 0}
        finally:
            safe_close_connection(conn)

    def get_distinct_values(self, table_name: str, column: str, file_path: str = None):
        conn = None
        try:
            db_path = self._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "Aucune base active.", "values": []}

            conn = connect_db(db_path)
            cursor = conn.cursor()

            safe_table = table_name.replace('"', '""')
            safe_col = column.replace('"', '""')

            cursor.execute(
                f'SELECT DISTINCT "{safe_col}" FROM "{safe_table}" '
                f'WHERE "{safe_col}" IS NOT NULL AND "{safe_col}" != "" '
                f'ORDER BY "{safe_col}" LIMIT 200'
            )
            values = [row[0] for row in cursor.fetchall()]

            return {"success": True, "values": values}
        except Exception as e:
            return {"success": False, "message": str(e), "values": []}
        finally:
            safe_close_connection(conn)

    # ============================================================
    # MODIFICATION
    # ============================================================
    def update_table_row(
        self, table_name: str, row_id: int, column: str, value: str, file_path: str = None
    ):
        conn = None
        try:
            db_path = self._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "Aucune base active."}

            conn = connect_db(db_path)
            cursor = conn.cursor()

            safe_table = table_name.replace('"', '""')
            safe_column = column.replace('"', '""')

            query = f'UPDATE "{safe_table}" SET "{safe_column}" = ? WHERE rowid = ?'
            cursor.execute(query, (value, row_id))
            conn.commit()

            if cursor.rowcount > 0:
                return {"success": True, "message": "Valeur modifiee avec succes."}
            return {"success": False, "message": "Aucune ligne modifiee."}
        except Exception as e:
            return {"success": False, "message": str(e)}
        finally:
            safe_close_connection(conn)

    def insert_table_row(
        self, table_name: str, values: Dict[str, str], file_path: str = None
    ):
        conn = None
        try:
            db_path = self._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "Aucune base active."}

            conn = connect_db(db_path)
            cursor = conn.cursor()

            safe_table = table_name.replace('"', '""')

            columns = []
            placeholders = []
            vals = []

            for col, val in values.items():
                safe_col = col.replace('"', '""')
                columns.append(f'"{safe_col}"')
                placeholders.append("?")
                vals.append(val)

            query = f'INSERT INTO "{safe_table}" ({", ".join(columns)}) VALUES ({", ".join(placeholders)})'
            cursor.execute(query, vals)
            conn.commit()
            new_id = cursor.lastrowid

            return {"success": True, "message": "Ligne ajoutee avec succes.", "row_id": new_id}
        except Exception as e:
            return {"success": False, "message": str(e)}
        finally:
            safe_close_connection(conn)

    def delete_table_row(self, table_name: str, row_id: int, file_path: str = None):
        conn = None
        try:
            db_path = self._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "Aucune base active."}

            conn = connect_db(db_path)
            cursor = conn.cursor()
            cursor.execute(f'DELETE FROM "{table_name}" WHERE rowid = ?', (row_id,))
            conn.commit()
            return {"success": True, "message": f"Ligne {row_id} supprimee."}
        except Exception as e:
            return {"success": False, "message": str(e)}
        finally:
            safe_close_connection(conn)

    # ============================================================
    # STATISTIQUES DE TABLE
    # ============================================================
    def get_table_statistics(self, table_name: str, file_path: str = None):
        conn = None
        try:
            db_path = self._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "Aucune base active.", "stats": {}}

            conn = connect_db(db_path)
            cursor = conn.cursor()

            cursor.execute(f'PRAGMA table_info("{table_name}")')
            columns_info = cursor.fetchall()
            columns = [col[1] for col in columns_info]

            stats = {}

            for col in columns:
                col_type = None
                for info in columns_info:
                    if info[1] == col:
                        col_type = info[2].upper()
                        break

                if col_type in ["INTEGER", "REAL", "FLOAT", "NUMERIC"]:
                    cursor.execute(
                        f'SELECT COUNT("{col}"), AVG("{col}"), MIN("{col}"), MAX("{col}"), SUM("{col}") '
                        f'FROM "{table_name}" WHERE "{col}" IS NOT NULL'
                    )
                    result = cursor.fetchone()
                    stats[col] = {
                        "type": "numerique",
                        "count": result[0] if result[0] is not None else 0,
                        "average": round(result[1], 2) if result[1] is not None else None,
                        "min": result[2] if result[2] is not None else None,
                        "max": result[3] if result[3] is not None else None,
                        "sum": round(result[4], 2) if result[4] is not None else None,
                    }
                else:
                    cursor.execute(
                        f'SELECT COUNT(DISTINCT "{col}"), COUNT("{col}") '
                        f'FROM "{table_name}" WHERE "{col}" IS NOT NULL'
                    )
                    distinct, total = cursor.fetchone()
                    stats[col] = {
                        "type": "texte",
                        "distinct_count": distinct if distinct is not None else 0,
                        "total_count": total if total is not None else 0,
                    }

            return {"success": True, "stats": stats, "columns": columns}
        except Exception as e:
            return {"success": False, "message": str(e), "stats": {}}
        finally:
            safe_close_connection(conn)

    def get_table_distribution(self, table_name: str, column: str, file_path: str = None):
        conn = None
        try:
            db_path = self._get_db_path(file_path)
            if not db_path:
                return {
                    "success": False,
                    "message": "Aucune base active.",
                    "distribution": [],
                }

            conn = connect_db(db_path)
            cursor = conn.cursor()

            cursor.execute(
                f'SELECT "{column}", COUNT(*) FROM "{table_name}" '
                f'WHERE "{column}" IS NOT NULL GROUP BY "{column}" '
                f'ORDER BY COUNT(*) DESC LIMIT 50'
            )
            distribution = [
                {"value": row[0], "count": row[1]} for row in cursor.fetchall()
            ]

            return {"success": True, "distribution": distribution}
        except Exception as e:
            return {"success": False, "message": str(e), "distribution": []}
        finally:
            safe_close_connection(conn)

    # ============================================================
    # REQUETES SQL AVANCEES
    # ============================================================
    def execute_custom_sql_operation(
        self,
        table_name: str,
        op_type: str,
        attribute: str = None,
        value: str = None,
        group_by: str = None,
        file_path: str = None,
    ):
        conn = None
        try:
            db_path = self._get_db_path(file_path)
            if not db_path:
                return {"success": False, "message": "Aucune base active.", "data": []}

            safe_table = table_name.replace('"', '""')
            safe_attr = attribute.replace('"', '""') if attribute else "*"
            safe_group = group_by.replace('"', '""') if group_by else None

            conn = connect_db(db_path)
            op = op_type.upper()

            query = ""
            params = ()

            if op == "SELECT_ALL":
                query = f'SELECT * FROM "{safe_table}" LIMIT 1000'
            elif op == "DISTINCT":
                if not attribute:
                    return {"success": False, "message": "Attribut requis pour DISTINCT.", "data": []}
                query = f'SELECT DISTINCT "{safe_attr}" FROM "{safe_table}"'
            elif op in ["MIN", "MAX", "COUNT", "SUM", "AVG"]:
                if not attribute and op != "COUNT":
                    return {"success": False, "message": f"Attribut requis pour {op}.", "data": []}
                target_col = f'"{safe_attr}"' if attribute else "*"
                query = f'SELECT {op}({target_col}) as result FROM "{safe_table}"'
            elif op == "WHERE_LIKE":
                if not attribute:
                    return {"success": False, "message": "Attribut requis pour WHERE / LIKE.", "data": []}
                query = f'SELECT * FROM "{safe_table}" WHERE "{safe_attr}" LIKE ?'
                params = (f"%{value if value else ''}%",)
            elif op == "GROUP_BY":
                if not safe_group:
                    return {"success": False, "message": "Champ de groupement requis.", "data": []}
                agg_col = f'"{safe_attr}"' if attribute else "*"
                query = (
                    f'SELECT "{safe_group}", COUNT({agg_col}) as total '
                    f'FROM "{safe_table}" GROUP BY "{safe_group}"'
                )
            else:
                query = f'SELECT * FROM "{safe_table}" LIMIT 1000'

            df = pd.read_sql_query(query, conn, params=params if params else None)

            for col in df.columns:
                if pd.api.types.is_datetime64_any_dtype(df[col]):
                    df[col] = df[col].dt.date

            return {"success": True, "data": df.fillna("").to_dict(orient="records")}
        except Exception as e:
            return {
                "success": False,
                "message": f"Erreur SQL : {str(e)}",
                "data": [],
            }
        finally:
            safe_close_connection(conn)

    # ============================================================
    # CREATION DE BASE
    # ============================================================
    def create_new_database(self, db_name: str, table_name: str):
        from api.utils import clean_ascii

        try:
            if not db_name or not db_name.strip():
                return {"success": False, "message": "Le nom de la base est requis."}

            if not table_name or not table_name.strip():
                return {"success": False, "message": "Le nom de la table est requis."}

            data_dir = DATA_DIR
            data_dir.mkdir(parents=True, exist_ok=True)

            safe_db_name = clean_ascii(db_name) or "nouvelle_base"
            safe_table_name = clean_ascii(table_name) or "nouvelle_table"

            db_filename = f"{safe_db_name}.db"
            db_path = data_dir / db_filename

            if os.path.exists(str(db_path)):
                return {
                    "success": False,
                    "message": f"Une base de donnees nommee '{db_filename}' existe deja. Veuillez choisir un autre nom.",
                }

            conn = connect_db(str(db_path))
            try:
                cursor = conn.cursor()
                cursor.execute(f'''
                    CREATE TABLE IF NOT EXISTS "{safe_table_name}" (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        cin TEXT, nom TEXT, commune TEXT, fkt TEXT, district TEXT,
                        region TEXT, filiation_menage TEXT, pole_de_developpement TEXT,
                        filieres TEXT, opr TEXT, h_f TEXT, categorisation_eaf TEXT,
                        variete TEXT, observation TEXT
                    )
                ''')
                conn.commit()
            finally:
                safe_close_connection(conn)

            return {
                "success": True,
                "message": f"Base de donnees '{db_filename}' creee avec succes.",
                "db_path": str(db_path),
                "db_name": db_filename,
                "table_name": safe_table_name,
            }
        except Exception as e:
            return {"success": False, "message": f"Erreur lors de la creation : {e}"}