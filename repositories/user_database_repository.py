from pathlib import Path
import sqlite3


class UserDatabaseRepository:
    ALLOWED_EXTENSIONS = {".sqlite", ".sqlite3", ".db"}
    ALLOWED_COLUMN_TYPES = {"INTEGER", "REAL", "TEXT"}

    def __init__(self):
        self.connection = None
        self.database_path = None

    def create_database(self, path):
        database_path = Path(path).expanduser().resolve()

        if database_path.suffix.lower() != ".sqlite":
            raise ValueError(
                "Une nouvelle base doit utiliser l'extension .sqlite."
            )

        database_path.parent.mkdir(parents=True, exist_ok=True)

        connection = sqlite3.connect(database_path)
        connection.row_factory = sqlite3.Row

        self._replace_connection(connection, database_path)

        return self.get_database_info()

    def open_database(self, path):
        database_path = Path(path).expanduser().resolve()

        if database_path.suffix.lower() not in self.ALLOWED_EXTENSIONS:
            raise ValueError(
                "Extension non prise en charge. "
                "Utilisez .sqlite, .sqlite3 ou .db."
            )

        if not database_path.exists():
            raise FileNotFoundError(
                "Le fichier sélectionné n'existe pas."
            )

        if not database_path.is_file():
            raise ValueError(
                "Le chemin sélectionné n'est pas un fichier."
            )

        connection = None

        try:
            connection = sqlite3.connect(database_path)
            connection.row_factory = sqlite3.Row

            result = connection.execute(
                "PRAGMA quick_check"
            ).fetchone()

            if not result or result[0] != "ok":
                raise ValueError(
                    "Le fichier sélectionné n'est pas une base SQLite valide."
                )

        except sqlite3.DatabaseError as error:
            if connection is not None:
                connection.close()

            raise ValueError(
                "Le fichier sélectionné n'est pas une base SQLite valide."
            ) from error
        except ValueError:
            if connection is not None:
                connection.close()

            raise

        self._replace_connection(connection, database_path)

        return self.get_database_info()

    def close_database(self):
        if self.connection is not None:
            self.connection.close()

        self.connection = None
        self.database_path = None

    def get_database_info(self):
        if self.connection is None or self.database_path is None:
            return {
                "open": False,
                "path": None,
                "name": None,
                "tables": []
            }

        tables = self.connection.execute(
            """
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
              AND name NOT LIKE 'sqlite_%'
            ORDER BY name
            """
        ).fetchall()

        return {
            "open": True,
            "path": str(self.database_path),
            "name": self.database_path.name,
            "tables": [table["name"] for table in tables]
        }

    def import_table(self, table_name, headers, column_types, rows):
        """
        Crée une table et importe les lignes fournies dans une transaction.

        Args:
            table_name: Nom de la table SQLite.
            headers: Liste des noms de colonnes.
            column_types: Types SQLite correspondants : TEXT, INTEGER ou REAL.
            rows: Iterable de lignes, chaque ligne étant une liste ou un tuple.

        Returns:
            Le schéma SQLite de la table créée.
        """
        self._ensure_connection()

        if not isinstance(headers, (list, tuple)) or not headers:
            raise ValueError(
                "La feuille Excel ne contient aucune colonne."
            )

        if not isinstance(column_types, (list, tuple)):
            raise ValueError(
                "Les types de colonnes doivent être fournis sous forme de liste."
            )

        if len(headers) != len(column_types):
            raise ValueError(
                "Le nombre de colonnes et de types est incohérent."
            )

        normalized_headers = [
            self._validate_identifier(header, "colonne")
            for header in headers
        ]

        if len(set(normalized_headers)) != len(normalized_headers):
            raise ValueError(
                "Les noms de colonnes doivent être uniques."
            )

        normalized_table_name = self._validate_identifier(
            table_name,
            "table"
        )

        normalized_types = []

        for column_type in column_types:
            normalized_type = str(column_type).strip().upper()

            if normalized_type not in self.ALLOWED_COLUMN_TYPES:
                raise ValueError(
                    f"Type SQLite non autorisé : {column_type}"
                )

            normalized_types.append(normalized_type)

        normalized_rows = []

        for row in rows:
            if not isinstance(row, (list, tuple)):
                row = list(row)

            if len(row) != len(normalized_headers):
                raise ValueError(
                    "Une ligne contient un nombre de valeurs incohérent."
                )

            normalized_rows.append(tuple(row))

        quoted_table_name = self._quote_identifier(normalized_table_name)

        column_definitions = ", ".join(
            (
                f"{self._quote_identifier(header)} {column_type}"
                for header, column_type in zip(
                    normalized_headers,
                    normalized_types
                )
            )
        )

        quoted_columns = ", ".join(
            self._quote_identifier(header)
            for header in normalized_headers
        )

        placeholders = ", ".join(
            "?" for _ in normalized_headers
        )

        create_sql = f"""
            CREATE TABLE {quoted_table_name} (
                {column_definitions}
            )
        """

        insert_sql = f"""
            INSERT INTO {quoted_table_name}
            ({quoted_columns})
            VALUES ({placeholders})
        """

        try:
            self.connection.execute(create_sql)

            if normalized_rows:
                self.connection.executemany(
                    insert_sql,
                    normalized_rows
                )

            self.connection.commit()

        except sqlite3.DatabaseError:
            self.connection.rollback()
            raise
        except Exception:
            self.connection.rollback()
            raise

        return self.get_table_schema(normalized_table_name)

    def get_table_schema(self, table_name):
        self._ensure_connection()

        normalized_table_name = self._validate_identifier(
            table_name,
            "table"
        )

        table_exists = self.connection.execute(
            """
            SELECT 1
            FROM sqlite_master
            WHERE type = 'table'
              AND name = ?
            """,
            (normalized_table_name,)
        ).fetchone()

        if table_exists is None:
            raise ValueError(
                f"Table inconnue : {normalized_table_name}"
            )

        rows = self.connection.execute(
            f"""
                PRAGMA table_info(
                    {self._quote_identifier(normalized_table_name)}
                )
            """
        ).fetchall()

        return [
            {
                "name": row["name"],
                "type": row["type"],
                "not_null": bool(row["notnull"]),
                "primary_key": bool(row["pk"])
            }
            for row in rows
        ]

    def get_all_table_schemas(self):
        self._ensure_connection()

        table_names = self.get_database_info()["tables"]

        return [
            {
                "name": table_name,
                "columns": self.get_table_schema(table_name)
            }
            for table_name in table_names
        ]

    def _replace_connection(self, connection, database_path):
        self.close_database()

        self.connection = connection
        self.database_path = database_path

    def _ensure_connection(self):
        if self.connection is None:
            raise ValueError("Aucune base SQLite n'est ouverte.")

    def _validate_identifier(self, identifier, identifier_type):
        if identifier is None:
            raise ValueError(
                f"Le nom de {identifier_type} ne peut pas être vide."
            )

        value = str(identifier).strip()

        if not value:
            raise ValueError(
                f"Le nom de {identifier_type} ne peut pas être vide."
            )

        if "\x00" in value:
            raise ValueError(
                f"Le nom de {identifier_type} est invalide."
            )

        return value

    def _quote_identifier(self, identifier):
        value = self._validate_identifier(identifier, "l'identifiant SQL")
        return '"' + value.replace('"', '""') + '"'
