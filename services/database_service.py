import re
from typing import Any

from repositories.user_database_repository import (
    UserDatabaseRepository
)
from services.excel_service import ExcelService


class DatabaseService:
    def __init__(self):
        self.repository = UserDatabaseRepository()
        self.excel_service = ExcelService()

    def create_database(self, path: str) -> dict:
        try:
            database_info = self.repository.create_database(path)

            return {
                "success": True,
                "message": "Base SQLite créée avec succès.",
                "database": database_info
            }

        except (OSError, ValueError, TypeError) as error:
            return {
                "success": False,
                "message": str(error)
            }

    def open_database(self, path: str) -> dict:
        try:
            database_info = self.repository.open_database(path)

            return {
                "success": True,
                "message": "Base SQLite ouverte avec succès.",
                "database": database_info
            }

        except (OSError, ValueError, TypeError) as error:
            return {
                "success": False,
                "message": str(error)
            }

    def close_database(self) -> dict:
        try:
            self.repository.close_database()

            return {
                "success": True,
                "message": "Base SQLite fermée.",
                "database": self.get_database_info()
            }

        except (OSError, ValueError, TypeError) as error:
            return {
                "success": False,
                "message": str(error)
            }

    def get_database_info(self) -> dict:
        return self.repository.get_database_info()

    def get_excel_sheets(self, file_path: str) -> dict:
        """
        Retourne la liste des feuilles du fichier Excel sélectionné.
        """
        try:
            sheets = self.excel_service.get_sheets(file_path)

            return {
                "success": True,
                "sheets": sheets
            }

        except (
            OSError,
            ValueError,
            TypeError,
            RuntimeError
        ) as error:
            return {
                "success": False,
                "message": str(error),
                "sheets": []
            }

    def preview_excel_sheet(
        self,
        file_path: str,
        sheet_name: str,
        max_rows: int = 100
    ) -> dict:
        """
        Retourne un aperçu d'une feuille Excel sans importer ses données.
        """
        try:
            preview = self.excel_service.preview_sheet(
                file_path=file_path,
                sheet_name=sheet_name,
                max_rows=max_rows
            )

            return {
                "success": True,
                "preview": preview
            }

        except (
            OSError,
            ValueError,
            TypeError,
            RuntimeError
        ) as error:
            return {
                "success": False,
                "message": str(error),
                "preview": None
            }

    def import_excel_to_database(
        self,
        file_path: str,
        sheet_name: str,
        table_name: str
    ) -> dict:
        """
        Importe une feuille Excel dans une table SQLite.

        La première ligne de la feuille est utilisée comme ligne
        d'en-tête. Les lignes suivantes sont importées comme données.
        """
        try:
            path = self.excel_service.validate_file(file_path)

            if not sheet_name or not str(sheet_name).strip():
                raise ValueError(
                    "Aucune feuille Excel n'a été sélectionnée."
                )

            clean_table_name = self._clean_table_name(table_name)

            sheet_data = self.excel_service.read_sheet(
                str(path),
                str(sheet_name)
            )

            headers = sheet_data.get("headers", [])
            rows = sheet_data.get("rows", [])

            if not headers:
                raise ValueError(
                    "La feuille sélectionnée ne contient aucune colonne."
                )

            column_types = self.excel_service.infer_column_types(
                headers=headers,
                rows=rows
            )

            prepared_rows = self.excel_service.prepare_rows(
                rows=rows,
                types=column_types
            )

            schema = self.repository.import_table(
                table_name=clean_table_name,
                headers=headers,
                column_types=column_types,
                rows=prepared_rows
            )

            return {
                "success": True,
                "message": (
                    f"La feuille « {sheet_name} » a été importée "
                    f"dans la table « {clean_table_name} »."
                ),
                "table": {
                    "name": clean_table_name,
                    "columns": schema,
                    "row_count": len(prepared_rows)
                },
                "database": self.get_database_info()
            }

        except (
            OSError,
            ValueError,
            TypeError,
            RuntimeError
        ) as error:
            return {
                "success": False,
                "message": str(error)
            }

    def get_database_tables(self) -> dict:
        """
        Retourne les tables et leurs schémas, sans retourner les données.
        """
        try:
            tables = self.repository.get_all_table_schemas()

            return {
                "success": True,
                "tables": tables
            }

        except (
            OSError,
            ValueError,
            TypeError
        ) as error:
            return {
                "success": False,
                "message": str(error),
                "tables": []
            }

    def verify_table(self, table_name: str) -> dict:
        """
        Prépare la vérification d'une table pour la phase suivante.
        """
        try:
            clean_table_name = self._clean_table_name(table_name)

            result = self.repository.verify_table(
                clean_table_name
            )

            return {
                "success": True,
                "table": clean_table_name,
                "verification": result
            }

        except (
            OSError,
            ValueError,
            TypeError
        ) as error:
            return {
                "success": False,
                "message": str(error)
            }

    @staticmethod
    def _clean_table_name(table_name: str) -> str:
        if not table_name or not str(table_name).strip():
            raise ValueError(
                "Le nom de la table est obligatoire."
            )

        value = str(table_name).strip()

        value = re.sub(r"\s+", "_", value)
        value = re.sub(
            r"[^\wÀ-ÿ-]",
            "_",
            value,
            flags=re.UNICODE
        )
        value = re.sub(r"_+", "_", value)
        value = value.strip("_")

        if not value:
            raise ValueError(
                "Le nom de la table est invalide."
            )

        if value[0].isdigit():
            value = f"table_{value}"

        return value[:100]
