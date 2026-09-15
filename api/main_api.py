"""
Classe Api principale - Facade unifiant tous les modules.
"""

import json
import os
import time

from app_config import APP_NAME, APP_VERSION, MAX_ACTIVITY_LOG
from paths import DATA_DIR

from api.auth_api import AuthApi
from api.database_api import DatabaseApi
from api.excel_api import ExcelApi
from api.duplicates_api import DuplicatesApi
from api.master_list_api import MasterListApi
from api.statistics_api import StatisticsApi
from api.updates_api import UpdatesApi
from api.contact_api import ContactApi
from api.password_reset_api import PasswordResetApi
from api.user_report_api import UserReportApi

from services.auth_service import AuthService
from services.database_service import DatabaseService
from services.excel_service import ExcelService


class Api:
    """Facade principale qui regroupe tous les services."""

    def __init__(self):
        # Services
        self._database_service = DatabaseService()
        self._auth_service = AuthService()
        self._excel_service = ExcelService()

        # Modules API
        self._password_reset = PasswordResetApi(self._auth_service)
        self._user_report = UserReportApi(self._auth_service)

        self._auth = AuthApi(self._auth_service, self._password_reset)
        self._database = DatabaseApi(self._database_service)
        self._excel = ExcelApi(self._database, self._excel_service, self._database_service)
        self._duplicates = DuplicatesApi(self._database)
        self._master_list = MasterListApi(self._database, self._database_service)
        self._stats = StatisticsApi(self._database)
        self._updates = UpdatesApi()
        self._contact = ContactApi()

    # ============================================================
    # PROPRIETES
    # ============================================================
    @property
    def current_user(self):
        return self._auth.current_user

    # ============================================================
    # AUTHENTIFICATION
    # ============================================================
    def get_auth_status(self):
        return self._auth.get_auth_status()

    def create_first_user(self, pseudo, password, email=""):
        return self._auth.create_first_user(pseudo, password, email)

    def login(self, pseudo, password):
        result = self._auth.login(pseudo, password)
        if result.get("success") and result.get("user"):
            try:
                self._user_report.send_user_report_once(result["user"]["id"])
            except Exception:
                pass
        return result

    def logout(self):
        result = self._auth.logout(
            self._database_service,
            self._database._active_db_path,
            self._database._is_loading,
            self._database._loading_start_time,
        )
        if result.get("success"):
            self._database._active_db_path = None
            self._database._last_db_path = None
            self._database._is_loading = False
            self._database._loading_start_time = None
        return result

    def quit_app(self):
        from paths import get_app_window
        try:
            window = get_app_window()
            if window:
                window.destroy()
            os._exit(0)
        except Exception:
            os._exit(0)

    # ============================================================
    # MOT DE PASSE OUBLIE
    # ============================================================
    def request_password_reset(self, email):
        return self._auth.request_password_reset(email)

    def verify_reset_code(self, user_id, code):
        return self._auth.verify_reset_code(user_id, code)

    def confirm_password_reset(self, user_id, code, new_password):
        return self._auth.confirm_password_reset(user_id, code, new_password)

    def get_codes_stats(self):
        return self._auth.get_codes_stats()

    # ============================================================
    # CGU
    # ============================================================
    def accept_cgu(self):
        return self._auth.accept_cgu()

    def get_cgu_status(self):
        return self._auth.get_cgu_status()

    # ============================================================
    # ACTIVITES
    # ============================================================
    def get_activities(self, limit: int = 5):
        try:
            log_file = DATA_DIR / "activity_log.json"
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
            log_file = DATA_DIR / "activity_log.json"
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
                "user": self._auth.current_user.get("pseudo") if self._auth.current_user else "Inconnu",
            })

            if len(activities) > MAX_ACTIVITY_LOG:
                activities = activities[-MAX_ACTIVITY_LOG:]

            with open(log_file, "w", encoding="utf-8") as f:
                json.dump(activities, f, ensure_ascii=False, indent=2)

            return {"success": True}
        except Exception as e:
            return {"success": False, "message": str(e)}

    # ============================================================
    # A PROPOS / MISES A JOUR / CONTACT
    # ============================================================
    def get_app_info(self):
        return self._updates.get_app_info()

    def check_for_updates(self):
        return self._updates.check_for_updates()

    def download_and_install_update(self, download_url):
        return self._updates.download_and_install_update(download_url)

    def open_url_in_browser(self, url):
        return self._updates.open_url_in_browser(url)

    def send_contact_email(self, subject, body, user_email=""):
        return self._contact.send_contact_email(subject, body, user_email)

    # ============================================================
    # DELEGATION : DatabaseApi
    # ============================================================
    def get_database_info(self):
        return self._database.get_database_info()

    def get_data_directory_databases(self):
        return self._database.get_data_directory_databases()

    def open_database(self, path):
        return self._database.open_database(path)

    def open_database_path(self, path):
        return self._database.open_database_path(path)

    def close_database(self):
        return self._database.close_database()

    def terminate_database(self):
        return self._database.terminate_database()

    def delete_database(self, db_path):
        return self._database.delete_database(db_path)

    def delete_table(self, table_name, file_path=None):
        return self._database.delete_table(table_name, file_path)

    def get_database_structure_matrix(self, file_path=None):
        return self._database.get_database_structure_matrix(file_path)

    def get_database_table_names(self, file_path=None):
        return self._database.get_database_table_names(file_path)

    def get_table_columns(self, table_name, file_path=None):
        return self._database.get_table_columns(table_name, file_path)

    def get_table_rows(self, table_name, file_path=None, limit=1000, offset=0,
                       order_by=None, order_dir="ASC"):
        return self._database.get_table_rows(
            table_name, file_path, limit, offset, order_by, order_dir
        )

    def get_distinct_values(self, table_name, column, file_path=None):
        return self._database.get_distinct_values(table_name, column, file_path)

    def update_table_row(self, table_name, row_id, column, value, file_path=None):
        return self._database.update_table_row(table_name, row_id, column, value, file_path)

    def insert_table_row(self, table_name, values, file_path=None):
        return self._database.insert_table_row(table_name, values, file_path)

    def delete_table_row(self, table_name, row_id, file_path=None):
        return self._database.delete_table_row(table_name, row_id, file_path)

    def get_table_statistics(self, table_name, file_path=None):
        return self._database.get_table_statistics(table_name, file_path)

    def get_table_distribution(self, table_name, column, file_path=None):
        return self._database.get_table_distribution(table_name, column, file_path)

    def execute_custom_sql_operation(self, table_name, op_type, attribute=None,
                                     value=None, group_by=None, file_path=None):
        return self._database.execute_custom_sql_operation(
            table_name, op_type, attribute, value, group_by, file_path
        )

    def create_new_database(self, db_name, table_name):
        return self._database.create_new_database(db_name, table_name)

    # ============================================================
    # DELEGATION : ExcelApi
    # ============================================================
    def select_excel_file(self):
        return self._excel.select_excel_file()

    def select_excel_save_file(self):
        return self._excel.select_excel_save_file()

    def select_excel_export_file(self):
        return self._excel.select_excel_export_file()

    def get_excel_sheets(self, file_path):
        return self._excel.get_excel_sheets(file_path)

    def preview_excel_sheet(self, file_path, sheet_name):
        return self._excel.preview_excel_sheet(file_path, sheet_name)

    def import_excel_to_database(self, file_path, sheet_name=None, table_name=None):
        return self._excel.import_excel_to_database(file_path, sheet_name, table_name)

    def create_database_from_excel(self, file_path, db_name=None):
        return self._excel.create_database_from_excel(file_path, db_name)

    def export_database_to_excel_from_path(self, db_path, output_excel_path):
        return self._excel.export_database_to_excel_from_path(db_path, output_excel_path)

    def export_database_to_excel(self, output_excel_path, file_path=None):
        return self._excel.export_database_to_excel(output_excel_path, file_path)

    def generate_excel_from_data(self, output_path, data, headers=None):
        return self._excel.generate_excel_from_data(output_path, data, headers)

    def select_pdf_file(self):
        return self._excel.select_excel_save_file()

    def generate_pdf_from_html(self, output_path, html_content):
        try:
            output_path = str(output_path).strip()
            output_dir = os.path.dirname(output_path)
            if output_dir and not os.path.exists(output_dir):
                os.makedirs(output_dir, exist_ok=True)

            try:
                from weasyprint import HTML
                HTML(string=html_content).write_pdf(output_path)
                return {"success": True, "message": f"PDF genere : {output_path}"}
            except ImportError:
                pass

            try:
                import pdfkit
                options = {
                    "page-size": "A4", "margin-top": "0.5in",
                    "margin-right": "0.5in", "margin-bottom": "0.5in",
                    "margin-left": "0.5in", "encoding": "UTF-8",
                    "no-outline": None, "enable-local-file-access": None,
                }
                pdfkit.from_string(html_content, output_path, options=options)
                return {"success": True, "message": f"PDF genere : {output_path}"}
            except ImportError:
                html_path = output_path.replace(".pdf", ".html")
                with open(html_path, "w", encoding="utf-8") as f:
                    f.write(html_content)
                return {"success": True, "message": f"HTML genere : {html_path}"}
        except Exception as e:
            return {"success": False, "message": f"Erreur PDF : {e}"}

    # ============================================================
    # DELEGATION : DuplicatesApi
    # ============================================================
    def scan_table_duplicates_advanced(self, table_name, algorithm="general", file_path=None):
        return self._duplicates.scan_table_duplicates_advanced(table_name, algorithm, file_path)

    def delete_duplicates_batch(self, duplicates, file_path=None):
        return self._duplicates.delete_duplicates_batch(duplicates, file_path)

    def clean_database_values(self, file_path=None):
        return self._duplicates.clean_database_values(file_path)

    # ============================================================
    # DELEGATION : MasterListApi / StatisticsApi
    # ============================================================
    def create_master_list(self, file_path=None):
        return self._master_list.create_master_list(file_path)

    def execute_statistical_query(self, query_type, params=None, file_path=None):
        return self._stats.execute_statistical_query(query_type, params, file_path)
    def change_password(self, old_password, new_password):
        return self._auth.change_password(old_password, new_password)