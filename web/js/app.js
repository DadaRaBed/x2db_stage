// === CONSTANTES ET SÉLECTEURS ===
const setupView = document.querySelector("#setup-view");
const loginView = document.querySelector("#login-view");
const dashboardView = document.querySelector("#dashboard-view");
const excelImportView = document.querySelector("#excel-import-view");
const existingDbView = document.querySelector("#existing-db-view");
const manipulateView = document.querySelector("#manipulate-view");

const setupForm = document.querySelector("#setup-form");
const loginForm = document.querySelector("#login-form");
const logoutButton = document.querySelector("#logout-button");
const menuButton = document.querySelector("#menu-button");
const userMenu = document.querySelector("#user-menu");

const importExcelButton = document.querySelector("#import-excel-button");
const selectExcelFileButton = document.querySelector(
  "#select-excel-file-button",
);
const backToDashboardButton = document.querySelector(
  "#back-to-dashboard-button",
);

const selectedExcelFileElement = document.querySelector("#selected-excel-file");
const excelSheetContainer = document.querySelector("#excel-sheet-container");
const excelSheetSelect = document.querySelector("#excel-sheet-select");
const toggleShowSheetsCheckbox = document.querySelector("#toggle-show-sheets");
const excelPreviewContainer = document.querySelector(
  "#excel-preview-container",
);
const excelPreview = document.querySelector("#excel-preview");
const excelPreviewCount = document.querySelector("#excel-preview-count");
const excelImportActions = document.querySelector("#excel-import-actions");
const excelTableNameInput = document.querySelector("#excel-table-name");
const importButton = document.querySelector(
  "#import-excel-into-database-button",
);

// === ÉTAT GLOBAL ===
let appInitialized = false;
let apiReadyPromise = null;
let selectedExcelFilePath = "";
let selectedExcelSheetName = "";
let importInProgress = false;
let duplicateScanCancelled = false;
let currentLoggedInUser = null;
let currentDbPath = null;

// === UTILITAIRES ===
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showView(viewElement) {
  const allViews = document.querySelectorAll(
    "#setup-view, #login-view, #dashboard-view, #excel-import-view, #existing-db-view, #manipulate-view",
  );
  allViews.forEach((view) => {
    if (view) {
      view.classList.add("hidden");
      view.style.display = "none";
    }
  });
  if (viewElement) {
    viewElement.classList.remove("hidden");
    viewElement.style.display = "block";
  }
}

function showMessage(selector, message, success = false) {
  const element = document.querySelector(selector);
  if (!element) return;
  element.textContent = message;
  element.classList.remove("success", "error");
  if (message) {
    element.classList.add(success ? "success" : "error");
  }
}

function showNotification(message, success = true) {
  const container = document.querySelector("#notification-container");
  if (!container) return;
  const notification = document.createElement("div");
  notification.className = success
    ? "notification notification-success"
    : "notification notification-error";
  notification.textContent = message;
  container.appendChild(notification);
  setTimeout(() => notification.remove(), 4000);
}

function showNotificationWithProgress(message, percentage, success = true) {
  const container = document.querySelector("#notification-container");
  if (!container) return;

  let notif = document.getElementById("active-process-notification");
  if (!notif) {
    notif = document.createElement("div");
    notif.id = "active-process-notification";
    container.appendChild(notif);
  }

  notif.className = success
    ? "notification notification-success"
    : "notification notification-error";
  notif.style.display = "block";
  notif.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px;">${escapeHtml(message)}</div>
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; opacity: 0.9; margin-bottom: 4px;">
            <span>Progress : ${Math.round(percentage)}%</span>
        </div>
        <div style="width: 100%; background: rgba(255,255,255,0.3); height: 6px; border-radius: 3px; overflow: hidden;">
            <div style="width: ${Math.min(100, percentage)}%; background: #ffffff; height: 100%; transition: width 0.2s ease;"></div>
        </div>
    `;

  if (percentage >= 100) {
    setTimeout(() => {
      notif.style.display = "none";
      notif.remove();
    }, 2000);
  }
}

function getInitials(pseudo) {
  const value = String(pseudo || "").trim();
  return value ? value.slice(0, 2).toUpperCase() : "?";
}

function isApiReady() {
  const api = window.pywebview?.api;
  return Boolean(
    api &&
    typeof api.get_auth_status === "function" &&
    typeof api.create_first_user === "function" &&
    typeof api.login === "function" &&
    typeof api.logout === "function",
  );
}

function waitForApi() {
  if (isApiReady()) return Promise.resolve();
  if (apiReadyPromise) return apiReadyPromise;

  apiReadyPromise = new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      if (isApiReady()) {
        resolve();
        return;
      }
      attempts += 1;
      if (attempts >= 100) {
        reject(new Error("API pywebview unavailable."));
        return;
      }
      setTimeout(check, 100);
    };
    check();
  });
  return apiReadyPromise;
}

// === GESTION DU THÈME ===
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("app_theme", theme);
}

// === SAUVEGARDE ET RESTAURATION DE LA BASE ===
function saveCurrentDbState() {
  const selectEl = document.getElementById("db-file-select");
  if (selectEl && selectEl.value) {
    currentDbPath = selectEl.value;
    sessionStorage.setItem("current_db_path", selectEl.value);
    sessionStorage.setItem(
      "current_db_name",
      selectEl.options[selectEl.selectedIndex]?.text || "",
    );
  }
}

function restoreDbState() {
  const savedPath = sessionStorage.getItem("current_db_path");
  if (savedPath) {
    currentDbPath = savedPath;
    const selectEl = document.getElementById("db-file-select");
    if (selectEl) {
      selectEl.value = savedPath;
      const label = document.getElementById("selected-db-path-label");
      const name =
        sessionStorage.getItem("current_db_name") || savedPath.split("/").pop();
      if (label) label.textContent = name;
    }
    const toggleChecked = document.getElementById(
      "toggle-show-tables-list",
    )?.checked;
    if (toggleChecked) {
      loadDatabaseDetails(savedPath);
    }
    return true;
  }
  return false;
}

// === GESTION DE LA SESSION ===
function showDashboard(user) {
  if (!user) {
    showView(loginView);
    return;
  }
  currentLoggedInUser = user;
  window.lastLoggedInUser = user;
  sessionStorage.setItem("session_active", "true");
  showView(dashboardView);

  const pseudo = user.pseudo || "";
  const greeting = document.querySelector("#welcome-message");
  const menuPseudos = document.querySelectorAll(
    "#menu-pseudo, .menu-pseudo-alt",
  );
  const menuAvatars = document.querySelectorAll(
    "#menu-avatar, .menu-avatar-alt",
  );

  if (greeting) greeting.textContent = `Hello, ${pseudo}`;
  menuPseudos.forEach((el) => {
    if (el) el.textContent = pseudo;
  });
  menuAvatars.forEach((el) => {
    if (el) el.textContent = getInitials(pseudo);
  });

  refreshDatabaseStatus();
  loadUserActivities();
}

function goToDashboard() {
  saveCurrentDbState();

  if (window.lastLoggedInUser) {
    showDashboard(window.lastLoggedInUser);
  } else {
    showView(dashboardView);
    refreshDatabaseStatus();
  }

  setTimeout(() => {
    restoreDbState();
    const resultsContainer = document.querySelector("#db-results-container");
    if (resultsContainer && !resultsContainer.classList.contains("hidden")) {
      // Keep results visible
    }
  }, 100);
}

function goToExistingDb() {
  saveCurrentDbState();

  showView(existingDbView);
  loadDataDirectoryDatabases();

  setTimeout(() => {
    restoreDbState();
  }, 200);
}

// === INITIALISATION ===
async function initializeApp() {
  if (appInitialized) return;
  try {
    await waitForApi();
    const status = await window.pywebview.api.get_auth_status();
    appInitialized = true;
    const sessionActive = sessionStorage.getItem("session_active");

    if (!status.first_user_exists) {
      showView(setupView);
    } else if (!status.authenticated && sessionActive !== "true") {
      showView(loginView);
    } else {
      if (status.authenticated) {
        showDashboard(status.user);
      } else {
        showDashboard({ pseudo: "User" });
      }
    }
  } catch (error) {
    console.error(error);
    showView(loginView);
    showMessage(
      "#login-message",
      "Unable to communicate with the application.",
    );
  }
}

// === IMPORTATION EXCEL ===
function updateImportButtonState() {
  const tableName = excelTableNameInput?.value.trim() || "";
  const valid = Boolean(
    selectedExcelFilePath && tableName && !importInProgress,
  );
  if (importButton) {
    importButton.disabled = !valid;
  }
}

function resetExcelImportView() {
  selectedExcelFilePath = "";
  selectedExcelSheetName = "";
  importInProgress = false;
  if (selectedExcelFileElement)
    selectedExcelFileElement.textContent = "No file selected";
  if (excelSheetContainer) excelSheetContainer.classList.add("hidden");
  if (excelSheetSelect) {
    excelSheetSelect.innerHTML = '<option value="">Select a sheet</option>';
    excelSheetSelect.disabled = true;
  }
  excelPreviewContainer?.classList.add("hidden");
  if (excelPreview) excelPreview.replaceChildren();
  if (excelPreviewCount) excelPreviewCount.textContent = "";
  excelImportActions?.classList.add("hidden");
  if (excelTableNameInput) excelTableNameInput.value = "";
  showMessage("#excel-import-message", "");
  updateImportButtonState();
}

async function selectExcelFile() {
  try {
    await waitForApi();
    const result = await window.pywebview.api.select_excel_file();
    if (!result?.success) {
      if (result?.message !== "No file selected.") {
        showMessage(
          "#excel-import-message",
          result?.message || "Unable to select file.",
        );
      }
      return;
    }
    selectedExcelFilePath = result.file_path;
    selectedExcelSheetName = "";
    selectedExcelFileElement.textContent = selectedExcelFilePath;

    const fileName = selectedExcelFilePath
      .split("/")
      .pop()
      .split("\\")
      .pop()
      .split(".")[0];
    if (excelTableNameInput) {
      excelTableNameInput.value = fileName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_");
    }
    await loadExcelSheets();
    updateImportButtonState();
  } catch (error) {
    console.error(error);
    showMessage("#excel-import-message", "Unable to select Excel file.");
  }
}

async function loadExcelSheets() {
  const result = await window.pywebview.api.get_excel_sheets(
    selectedExcelFilePath,
  );
  if (!result?.success || !Array.isArray(result.sheets)) {
    showMessage(
      "#excel-import-message",
      result?.message || "Unable to read Excel sheets.",
    );
    return;
  }
  excelSheetSelect.innerHTML =
    '<option value="">Select a sheet (optional)</option>';
  result.sheets.forEach((sheet) => {
    const option = document.createElement("option");
    option.value = sheet;
    option.textContent = sheet;
    excelSheetSelect.appendChild(option);
  });
  excelSheetContainer.classList.remove("hidden");
  excelSheetSelect.disabled = false;
  if (result.sheets.length === 1) {
    excelSheetSelect.value = result.sheets[0];
    await loadExcelPreview(result.sheets[0]);
  }
  updateImportButtonState();
}

async function loadExcelPreview(sheetName) {
  if (toggleShowSheetsCheckbox && !toggleShowSheetsCheckbox.checked) {
    excelPreviewContainer?.classList.add("hidden");
    return;
  }

  if (!selectedExcelFilePath || !sheetName) return;
  try {
    const result = await window.pywebview.api.preview_excel_sheet(
      selectedExcelFilePath,
      sheetName,
    );
    if (!result?.success) {
      showMessage(
        "#excel-import-message",
        result?.message || "Unable to generate preview.",
      );
      return;
    }
    selectedExcelSheetName = sheetName;
    let headers = result.headers;
    if (!headers && result.preview && result.preview.length > 0) {
      headers = result.preview[0];
    }
    renderExcelPreview(headers);
    updateImportButtonState();
  } catch (error) {
    console.error(error);
    showMessage("#excel-import-message", "Unable to read selected sheet.");
  }
}

function renderExcelPreview(headers) {
  if (toggleShowSheetsCheckbox && !toggleShowSheetsCheckbox.checked) {
    excelPreviewContainer.classList.add("hidden");
    return;
  }

  excelPreview.replaceChildren();
  excelPreviewContainer.classList.remove("hidden");
  let headersArray = headers;
  if (headersArray && !Array.isArray(headersArray)) {
    headersArray = Object.values(headersArray);
  }
  if (!Array.isArray(headersArray) || headersArray.length === 0) {
    excelPreviewCount.textContent = "No columns detected";
    excelImportActions.classList.add("hidden");
    updateImportButtonState();
    return;
  }
  const listContainer = document.createElement("div");
  listContainer.className = "columns-list-container";
  listContainer.style.display = "flex";
  listContainer.style.flexWrap = "wrap";
  listContainer.style.gap = "8px";
  listContainer.style.padding = "10px 0";

  headersArray.forEach((header) => {
    const badge = document.createElement("span");
    badge.className = "column-badge";
    badge.textContent = String(
      header !== null && header !== undefined ? header : "Unnamed column",
    );
    badge.style.background = "var(--bg-secondary, #e0e7ff)";
    badge.style.color = "var(--text-color, #3730a3)";
    badge.style.padding = "6px 12px";
    badge.style.borderRadius = "6px";
    badge.style.fontSize = "0.9rem";
    badge.style.fontWeight = "600";
    listContainer.appendChild(badge);
  });
  excelPreview.appendChild(listContainer);
  excelPreviewCount.textContent = `${headersArray.length} column(s) identified`;
  excelImportActions.classList.remove("hidden");
  updateImportButtonState();
}

async function importExcelIntoDatabase() {
  if (!selectedExcelFilePath) {
    showMessage("#excel-import-message", "Please select an Excel file.");
    return;
  }
  const tableName = excelTableNameInput.value.trim();
  if (!tableName) {
    showMessage("#excel-import-message", "Please enter a table name.");
    excelTableNameInput.focus();
    return;
  }
  importInProgress = true;
  updateImportButtonState();
  if (selectExcelFileButton) selectExcelFileButton.disabled = true;
  if (excelSheetSelect) excelSheetSelect.disabled = true;
  if (excelTableNameInput) excelTableNameInput.disabled = true;

  let progress = 5;
  showNotificationWithProgress(
    "Import and SQLite conversion in progress...",
    progress,
    true,
  );

  const progressInterval = setInterval(() => {
    progress = Math.min(95, progress + (95 - progress) * 0.1);
    showNotificationWithProgress(
      "Import and SQLite conversion in progress...",
      progress,
      true,
    );
  }, 500);

  try {
    const result = await window.pywebview.api.import_excel_to_database(
      selectedExcelFilePath,
      selectedExcelSheetName || null,
      tableName,
    );
    clearInterval(progressInterval);
    showNotificationWithProgress(
      "Conversion completed successfully !",
      100,
      true,
    );

    if (!result?.success) {
      showMessage("#excel-import-message", result?.message || "Import failed.");
      return;
    }
    showMessage(
      "#excel-import-message",
      result.message || "File converted successfully.",
      true,
    );
    excelImportActions?.classList.add("hidden");

    setTimeout(() => {
      goToExistingDb();
      if (result.db_path) {
        const dbFileSelect = document.getElementById("db-file-select");
        if (dbFileSelect) {
          dbFileSelect.value = result.db_path;
          dbFileSelect.dispatchEvent(new Event("change"));
        }
      }
    }, 900);
  } catch (error) {
    clearInterval(progressInterval);
    console.error(error);
    showMessage("#excel-import-message", "Unable to perform conversion.");
  } finally {
    importInProgress = false;
    if (selectExcelFileButton) selectExcelFileButton.disabled = false;
    if (excelSheetSelect) excelSheetSelect.disabled = false;
    if (excelTableNameInput) excelTableNameInput.disabled = false;
    updateImportButtonState();
  }
}

// === AFFICHAGE DES BASES DE DONNÉES ===
async function refreshDatabaseStatus() {
  try {
    await waitForApi();
    const info = await window.pywebview.api.get_database_info();
    if (!info?.success) return;
    document
      .querySelector("#database-status-section")
      ?.classList.remove("hidden");
    const name = document.querySelector("#current-database-name");
    const path = document.querySelector("#current-database-path");
    if (name)
      name.textContent =
        info.name || info.database_name || info.filename || "SQLite Database";
    if (path) path.textContent = info.path || info.database_path || "—";

    const structRes =
      await window.pywebview.api.get_database_structure_matrix();
    if (structRes?.success) {
      renderDatabaseStructureMatrix(
        structRes.structure || {},
        document.querySelector("#database-tables-container"),
      );
    }
  } catch (error) {
    console.error("Error during refresh:", error);
  }
}

function renderDatabaseStructureMatrix(structure, containerElement) {
  if (!containerElement) return;
  containerElement.replaceChildren();
  const tables = Object.keys(structure);
  if (tables.length === 0) {
    containerElement.textContent = "No tables in this database.";
    return;
  }

  const listWrapper = document.createElement("div");
  listWrapper.style.display = "flex";
  listWrapper.style.flexDirection = "column";
  listWrapper.style.gap = "0.75rem";
  listWrapper.style.padding = "0.5rem 0";

  tables.forEach((tableName) => {
    const columns = structure[tableName] || [];
    const tableGroupEl = document.createElement("div");
    tableGroupEl.style.display = "flex";
    tableGroupEl.style.flexDirection = "column";
    tableGroupEl.style.gap = "0.5rem";

    const tableButton = document.createElement("button");
    tableButton.type = "button";
    tableButton.className = "button button-primary";
    tableButton.style.display = "flex";
    tableButton.style.justifyContent = "space-between";
    tableButton.style.alignItems = "center";
    tableButton.style.width = "100%";
    tableButton.style.padding = "0.75rem 1rem";
    tableButton.style.textAlign = "left";
    tableButton.style.borderRadius = "6px";
    tableButton.style.cursor = "pointer";

    const titleSpan = document.createElement("span");
    titleSpan.innerHTML = `<i class="fas fa-table" style="margin-right: 8px;"></i> ${escapeHtml(tableName)} <small style="opacity: 0.8; font-weight: normal;">(${columns.length} attributes)</small>`;

    const arrowSpan = document.createElement("i");
    arrowSpan.className = "fas fa-chevron-down";

    tableButton.appendChild(titleSpan);
    tableButton.appendChild(arrowSpan);

    const attrsContainer = document.createElement("div");
    attrsContainer.style.display = "none";
    attrsContainer.style.flexWrap = "wrap";
    attrsContainer.style.gap = "6px";
    attrsContainer.style.padding = "0.75rem";
    attrsContainer.style.background = "var(--card-bg, #f9f9f9)";
    attrsContainer.style.border = "1px solid var(--border-color, #ddd)";
    attrsContainer.style.borderRadius = "6px";

    if (columns.length === 0) {
      const emptySpan = document.createElement("small");
      emptySpan.textContent = "No attributes";
      emptySpan.style.color = "var(--text-color, gray)";
      attrsContainer.appendChild(emptySpan);
    } else {
      columns.forEach((attr) => {
        const attrPill = document.createElement("span");
        attrPill.textContent = attr;
        attrPill.style.background = "var(--bg-secondary, #eef2f7)";
        attrPill.style.color = "var(--text-color, #333)";
        attrPill.style.padding = "4px 10px";
        attrPill.style.borderRadius = "4px";
        attrPill.style.fontSize = "0.85rem";
        attrPill.style.border = "1px solid var(--border-color, #e2e8f0)";
        attrsContainer.appendChild(attrPill);
      });
    }

    tableButton.addEventListener("click", () => {
      const isHidden = attrsContainer.style.display === "none";
      attrsContainer.style.display = isHidden ? "flex" : "none";
      arrowSpan.className = isHidden
        ? "fas fa-chevron-up"
        : "fas fa-chevron-down";
    });

    tableGroupEl.appendChild(tableButton);
    tableGroupEl.appendChild(attrsContainer);
    listWrapper.appendChild(tableGroupEl);
  });

  containerElement.appendChild(listWrapper);
}

async function loadDatabaseDetails(filePath) {
  const container = document.querySelector(
    "#database-tables-container-existing",
  );
  const actionsPanel = document.getElementById("db-actions-panel");
  if (!container) return;

  container.classList.remove("hidden");
  container.innerHTML = "<p>Loading table structure...</p>";

  try {
    await waitForApi();
    const structRes =
      await window.pywebview.api.get_database_structure_matrix(filePath);
    if (structRes && structRes.success === true && structRes.structure) {
      const tables = Object.keys(structRes.structure);
      if (tables.length === 0) {
        container.innerHTML = "<p>The database contains no user tables.</p>";
      } else {
        renderDatabaseStructureMatrix(structRes.structure, container);
      }
      if (actionsPanel) actionsPanel.classList.remove("hidden");
    } else {
      container.innerHTML = `<p style="color: red;">${escapeHtml(structRes?.message || "Loading error.")}</p>`;
    }
  } catch (error) {
    console.error("Error loading database:", error);
    container.innerHTML = `<p style="color: red;">Error : ${escapeHtml(error.message)}</p>`;
  }
}

async function loadDataDirectoryDatabases() {
  const selectEl = document.getElementById("db-file-select");
  const container = document.getElementById("db-selection-container");
  if (!selectEl) return;

  try {
    await waitForApi();
    const res = await window.pywebview.api.get_data_directory_databases();
    if (res && res.success && res.databases.length > 0) {
      selectEl.innerHTML =
        '<option value="">-- Select an existing database --</option>';
      res.databases.forEach((db) => {
        const opt = document.createElement("option");
        opt.value = db.path;
        opt.textContent = `${db.name} (${db.size_kb} KB)`;
        selectEl.appendChild(opt);
      });
      if (container) container.classList.remove("hidden");
    } else {
      if (container) container.classList.add("hidden");
    }
  } catch (e) {
    console.error("Error listing databases from data folder:", e);
  }
}

// === ACTIVITÉS UTILISATEUR ===
async function loadUserActivities() {
  try {
    await waitForApi();
    const res = await window.pywebview.api.get_activities(5);
    const activityList = document.querySelector("#activity-list");
    const emptyState = document.querySelector("#empty-activity-state");
    const emptyLabel = document.querySelector("#empty-activity-label");

    if (res && res.success && res.activities && res.activities.length > 0) {
      if (emptyState) emptyState.classList.add("hidden");
      if (emptyLabel) emptyLabel.classList.add("hidden");
      if (activityList) {
        activityList.classList.remove("hidden");
        activityList.innerHTML = res.activities
          .map(
            (act) => `
                            <div class="activity-item" style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border-color, #eee);">
                                <span>
                                    <i class="fas fa-history" style="margin-right: 8px; color: var(--primary-color, #4f46e5);"></i> 
                                    ${escapeHtml(act.text)}
                                    <small style="color: var(--text-muted, gray); margin-left: 8px; font-weight: 400;">
                                        (${escapeHtml(act.user || "User")})
                                    </small>
                                </span>
                                <small style="color: var(--text-muted, gray); white-space: nowrap;">${escapeHtml(act.date)}</small>
                            </div>
                        `,
          )
          .join("");
      }
    } else {
      if (activityList) activityList.classList.add("hidden");
      if (emptyState) emptyState.classList.remove("hidden");
      if (emptyLabel) emptyLabel.classList.remove("hidden");
    }
  } catch (e) {
    console.error("Error loading activity:", e);
  }
}

async function logUserAction(actionText) {
  try {
    await waitForApi();
    if (window.pywebview?.api?.log_activity) {
      await window.pywebview.api.log_activity(actionText);
      loadUserActivities();
    }
  } catch (err) {
    console.error("Error logging action:", err);
  }
}

// === MANIPULATION DES DONNÉES ===
// === MANIPULATION DES DONNÉES - VERSION CORRIGÉE ===
async function initManipulatePage() {
  const tableSelect = document.querySelector("#manipulate-table-select");
  const btnSelectTable = document.querySelector("#btn-manipulate-select-table");
  const resultsContainer = document.querySelector(
    "#manipulate-results-table-container",
  );
  const countSpan = document.querySelector("#manipulate-response-count");
  const searchInput = document.querySelector("#manipulate-search-input");
  const btnExecuteSearch = document.querySelector("#btn-execute-search");
  const filtersArea = document.querySelector("#manipulate-filters-area");
  const operationsArea = document.querySelector("#manipulate-operations-area");
  const searchBarArea = document.querySelector("#manipulate-search-bar-area");

  const btnManipulateDb = document.querySelector("#btn-manipulate-db");
  if (btnManipulateDb) {
    btnManipulateDb.onclick = async () => {
      saveCurrentDbState();
      showView(manipulateView);
      await loadManipulateTables();
      setTimeout(() => restoreDbState(), 100);
    };
  }

  if (!tableSelect) return;
  await loadManipulateTables();

  let currentSelectedTable = "";
  let currentData = [];
  let currentFilteredData = [];

  // === VALIDER LA TABLE ===
  if (btnSelectTable) {
    btnSelectTable.onclick = async () => {
      currentSelectedTable = tableSelect.value;
      if (!currentSelectedTable) {
        showNotification("Veuillez sélectionner une table.", false);
        return;
      }
      showNotification(`Table ${currentSelectedTable} sélectionnée.`, true);

      await loadTableDataFull(
        currentSelectedTable,
        resultsContainer,
        countSpan,
      );
      const data = await getTableData(currentSelectedTable);
      if (data) {
        currentData = data;
        currentFilteredData = data;
      }

      searchInput.value = "";
      if (filtersArea) {
        filtersArea.classList.add("hidden");
        filtersArea.style.display = "none";
      }
      if (operationsArea) {
        operationsArea.classList.add("hidden");
        operationsArea.style.display = "none";
      }
      if (searchBarArea) {
        searchBarArea.classList.add("hidden");
        searchBarArea.style.display = "none";
      }
    };
  }

  async function getTableData(tableName) {
    try {
      const selectEl = document.getElementById("db-file-select");
      const activeDbPath = selectEl ? selectEl.value : null;
      const res = await window.pywebview.api.get_table_rows(
        tableName,
        activeDbPath,
      );
      if (res && res.success) {
        return res.data;
      }
      return null;
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  function displayData(dataArray, container, countSpan) {
    if (!container) return;
    if (!dataArray || dataArray.length === 0) {
      container.innerHTML = "<p>Aucune donnée trouvée.</p>";
      if (countSpan) countSpan.textContent = "0";
      return;
    }

    if (countSpan) countSpan.textContent = dataArray.length;

    const keys = Object.keys(dataArray[0]);
    let html = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; background: var(--bg-container, #fff); color: var(--text-color, #000);">
                <thead style="position: sticky; top: 0; background: var(--bg-secondary, #f1f5f9); z-index: 2;">
                    <tr style="border-bottom: 2px solid #cbd5e1;">
                        ${keys.map((k) => `<th style="padding: 10px; border-right: 1px solid #e2e8f0; text-align: left;">${escapeHtml(k)}</th>`).join("")}
                    </tr>
                </thead>
                <tbody>
        `;

    dataArray.forEach((row) => {
      html += `<tr style="border-bottom: 1px solid #e2e8f0;">`;
      keys.forEach((k) => {
        html += `<td style="padding: 8px 10px; border-right: 1px solid #e2e8f0;">${escapeHtml(row[k])}</td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  // === RECHERCHE ===
  if (btnExecuteSearch) {
    btnExecuteSearch.onclick = async () => {
      const val = searchInput?.value.trim();
      if (!currentSelectedTable) {
        showNotification("Veuillez d'abord sélectionner une table.", false);
        return;
      }

      if (!val) {
        displayData(currentData, resultsContainer, countSpan);
        currentFilteredData = currentData;
        return;
      }

      try {
        const filtered = currentData.filter((row) => {
          return Object.values(row).some((value) =>
            String(value).toUpperCase().includes(val.toUpperCase()),
          );
        });

        if (filtered.length === 0) {
          showNotification(
            "Aucun résultat trouvé pour cette recherche.",
            false,
          );
        } else {
          showNotification(`${filtered.length} résultat(s) trouvé(s).`, true);
        }

        displayData(filtered, resultsContainer, countSpan);
        currentFilteredData = filtered;
      } catch (err) {
        console.error(err);
        showNotification("Erreur lors de la recherche.", false);
      }
    };
  }

  // === BOUTON RECHERCHE (TOGGLE) ===
  const btnSearch = document.querySelector("#btn-manipulate-search");
  if (btnSearch) {
    btnSearch.onclick = function () {
      if (!currentSelectedTable) {
        showNotification("Veuillez d'abord sélectionner une table.", false);
        return;
      }

      // Toggle de la barre de recherche
      const isVisible =
        searchBarArea && !searchBarArea.classList.contains("hidden");
      if (isVisible) {
        searchBarArea.classList.add("hidden");
        searchBarArea.style.display = "none";
        // Réinitialiser l'état du bouton
        this.style.background = "";
        this.style.color = "";
        return;
      }

      // Cacher les autres zones
      if (filtersArea) {
        filtersArea.classList.add("hidden");
        filtersArea.style.display = "none";
      }
      if (operationsArea) {
        operationsArea.classList.add("hidden");
        operationsArea.style.display = "none";
      }

      // Afficher la recherche
      searchBarArea.classList.remove("hidden");
      searchBarArea.style.display = "flex";
      searchInput.focus();

      // Mettre en évidence le bouton
      this.style.background = "var(--primary, #4f46e5)";
      this.style.color = "white";
    };
  }

  // === FILTRES (TOGGLE) ===
  const btnFilters = document.querySelector("#btn-manipulate-filters");
  if (btnFilters) {
    btnFilters.onclick = async function () {
      if (!currentSelectedTable) {
        showNotification("Veuillez d'abord sélectionner une table.", false);
        return;
      }

      // Toggle des filtres
      const isVisible =
        filtersArea && !filtersArea.classList.contains("hidden");
      if (isVisible) {
        filtersArea.classList.add("hidden");
        filtersArea.style.display = "none";
        this.style.background = "";
        this.style.color = "";
        return;
      }

      // Cacher les autres zones
      if (searchBarArea) {
        searchBarArea.classList.add("hidden");
        searchBarArea.style.display = "none";
        const searchBtn = document.querySelector("#btn-manipulate-search");
        if (searchBtn) {
          searchBtn.style.background = "";
          searchBtn.style.color = "";
        }
      }
      if (operationsArea) {
        operationsArea.classList.add("hidden");
        operationsArea.style.display = "none";
        const opBtn = document.querySelector("#btn-manipulate-operations");
        if (opBtn) {
          opBtn.style.background = "";
          opBtn.style.color = "";
        }
      }

      try {
        const selectEl = document.getElementById("db-file-select");
        const activeDbPath = selectEl ? selectEl.value : null;
        const struct =
          await window.pywebview.api.get_database_structure_matrix(
            activeDbPath,
          );
        const columns = struct.structure[currentSelectedTable] || [];

        if (filtersArea) {
          filtersArea.classList.remove("hidden");
          filtersArea.style.display = "block";
          filtersArea.innerHTML = `
                        <h4 style="margin-bottom: 8px; color: var(--text-color); font-weight: bold;">
                            <i class="fas fa-filter"></i> Filtrer les colonnes à afficher :
                        </h4>
                        <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center;" id="filter-checkboxes"></div>
                        <div style="margin-top: 10px; display: flex; gap: 10px; flex-wrap: wrap;">
                            <button id="btn-apply-filters" class="button button-primary" style="padding: 0.5rem 1.5rem;">
                                <i class="fas fa-check"></i> Appliquer les filtres
                            </button>
                            <button id="btn-reset-filters" class="secondary-button" style="padding: 0.5rem 1.5rem;">
                                <i class="fas fa-undo"></i> Réinitialiser
                            </button>
                            <button id="btn-close-filters" class="secondary-button" style="padding: 0.5rem 1.5rem; background: #6c757d; color: white;">
                                <i class="fas fa-times"></i> Fermer
                            </button>
                        </div>
                    `;
          const boxContainer = filtersArea.querySelector("#filter-checkboxes");

          columns.forEach((col) => {
            const label = document.createElement("label");
            label.style.cssText =
              "display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; background: var(--bg-secondary, #e2e8f0); border-radius: 6px; cursor: pointer; font-weight: 600; color: var(--text-color, #111); border: 1px solid var(--border-color, #cbd5e1);";
            label.innerHTML = `
                            <input type="checkbox" class="col-filter-chk" value="${col}" checked style="width: 22px; height: 22px; cursor: pointer;" /> 
                            <span>${escapeHtml(col)}</span>
                        `;
            boxContainer.appendChild(label);
          });

          // Appliquer les filtres
          const applyBtn = filtersArea.querySelector("#btn-apply-filters");
          applyBtn.onclick = () => {
            const activeCols = Array.from(
              filtersArea.querySelectorAll(".col-filter-chk:checked"),
            ).map((c) => c.value);

            if (activeCols.length === 0) {
              showNotification("Sélectionnez au moins une colonne.", false);
              return;
            }

            const filteredData = currentFilteredData.map((row) => {
              const newRow = {};
              activeCols.forEach((col) => {
                newRow[col] = row[col];
              });
              return newRow;
            });

            displayData(filteredData, resultsContainer, countSpan);
            showNotification(
              `Affichage de ${activeCols.length} colonne(s).`,
              true,
            );
          };

          // Réinitialiser les filtres
          const resetBtn = filtersArea.querySelector("#btn-reset-filters");
          resetBtn.onclick = () => {
            filtersArea.querySelectorAll(".col-filter-chk").forEach((chk) => {
              chk.checked = true;
            });
            displayData(currentFilteredData, resultsContainer, countSpan);
            showNotification("Filtres réinitialisés.", true);
          };

          // Bouton Fermer
          const closeBtn = filtersArea.querySelector("#btn-close-filters");
          closeBtn.onclick = () => {
            filtersArea.classList.add("hidden");
            filtersArea.style.display = "none";
            btnFilters.style.background = "";
            btnFilters.style.color = "";
          };

          // Mettre en évidence le bouton
          this.style.background = "var(--primary, #4f46e5)";
          this.style.color = "white";
        }
      } catch (e) {
        console.error(e);
        showNotification("Erreur lors du chargement des colonnes.", false);
      }
    };
  }

  // === OPÉRATIONS SQL (TOGGLE) ===
  const btnOperations = document.querySelector("#btn-manipulate-operations");
  if (btnOperations) {
    btnOperations.onclick = async function () {
      if (!currentSelectedTable) {
        showNotification("Veuillez d'abord sélectionner une table.", false);
        return;
      }

      // Toggle des opérations
      const isVisible =
        operationsArea && !operationsArea.classList.contains("hidden");
      if (isVisible) {
        operationsArea.classList.add("hidden");
        operationsArea.style.display = "none";
        this.style.background = "";
        this.style.color = "";
        return;
      }

      // Cacher les autres zones
      if (searchBarArea) {
        searchBarArea.classList.add("hidden");
        searchBarArea.style.display = "none";
        const searchBtn = document.querySelector("#btn-manipulate-search");
        if (searchBtn) {
          searchBtn.style.background = "";
          searchBtn.style.color = "";
        }
      }
      if (filtersArea) {
        filtersArea.classList.add("hidden");
        filtersArea.style.display = "none";
        const filterBtn = document.querySelector("#btn-manipulate-filters");
        if (filterBtn) {
          filterBtn.style.background = "";
          filterBtn.style.color = "";
        }
      }

      // Afficher les opérations
      operationsArea.classList.remove("hidden");
      operationsArea.style.display = "flex";
      await initAdvancedQuerySelects(currentSelectedTable);

      // Mettre en évidence le bouton
      this.style.background = "var(--primary, #4f46e5)";
      this.style.color = "white";

      // Faire défiler jusqu'aux opérations
      setTimeout(() => {
        operationsArea.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    };
  }

  // === EXÉCUTION DES OPÉRATIONS SQL ===
  const btnExecuteOp = document.getElementById("btn-execute-operation");
  if (btnExecuteOp) {
    btnExecuteOp.addEventListener("click", async () => {
      if (!currentSelectedTable) {
        showNotification("Veuillez d'abord sélectionner une table.", false);
        return;
      }

      const opType =
        document.getElementById("selected-operation-type")?.value ||
        "SELECT_ALL";
      const attribute = document.getElementById("op-attribute-select")?.value;
      const value = document.getElementById("op-value-input")?.value;
      const groupBy = document.getElementById("op-groupby-select")?.value;

      const opNames = {
        SELECT_ALL: "Voir tout",
        DISTINCT: "Valeurs uniques",
        MIN: "Minimum",
        MAX: "Maximum",
        COUNT: "Compter",
        SUM: "Somme",
        AVG: "Moyenne",
        WHERE_LIKE: "Rechercher",
        GROUP_BY: "Grouper",
      };

      try {
        await waitForApi();
        const selectEl = document.getElementById("db-file-select");
        const activeDbPath = selectEl ? selectEl.value : null;

        showNotificationWithProgress(
          `Exécution de "${opNames[opType] || opType}"...`,
          30,
          true,
        );

        const res = await window.pywebview.api.execute_custom_sql_operation(
          currentSelectedTable,
          opType,
          attribute,
          value,
          groupBy,
          activeDbPath,
        );

        showNotificationWithProgress("Opération terminée", 100, true);

        if (res?.success) {
          currentData = res.data;
          currentFilteredData = res.data;

          displayData(res.data, resultsContainer, countSpan);
          showNotification(
            `${opNames[opType] || opType} exécutée : ${res.data.length} résultat(s).`,
            true,
          );
          logUserAction(`Exécution de ${opType} sur ${currentSelectedTable}`);
        } else {
          showNotification(
            res?.message || "Erreur lors de l'exécution.",
            false,
          );
        }
      } catch (err) {
        console.error(err);
        showNotification("Erreur de communication avec l'API.", false);
      }
    });
  }

  // === RESET DES OPÉRATIONS ===
  const btnResetOp = document.getElementById("btn-reset-operation");
  if (btnResetOp) {
    btnResetOp.addEventListener("click", () => {
      document.getElementById("selected-operation-type").value = "SELECT_ALL";
      document.getElementById("op-attribute-select").value = "";
      document.getElementById("op-value-input").value = "";
      document.getElementById("op-groupby-select").value = "";

      document.querySelectorAll(".op-btn").forEach((b) => {
        b.style.background = "";
        b.style.color = "";
      });
      const firstOpBtn = document.querySelector(
        '.op-btn[data-op="SELECT_ALL"]',
      );
      if (firstOpBtn) {
        firstOpBtn.style.background = "var(--primary-color, #4f46e5)";
        firstOpBtn.style.color = "#ffffff";
      }

      if (currentSelectedTable) {
        loadTableDataFull(currentSelectedTable, resultsContainer, countSpan);
      }

      showNotification("Formulaire réinitialisé.", true);
    });
  }
}

async function loadManipulateTables() {
  const tableSelect = document.querySelector("#manipulate-table-select");
  if (!tableSelect) return;
  try {
    await waitForApi();

    let activeDbPath = sessionStorage.getItem("current_db_path");
    if (!activeDbPath) {
      const selectEl = document.getElementById("db-file-select");
      activeDbPath = selectEl ? selectEl.value : null;
    }

    const tablesRes =
      await window.pywebview.api.get_database_table_names(activeDbPath);

    if (tablesRes && tablesRes.success) {
      tableSelect.innerHTML = '<option value="">-- Choose a table --</option>';
      tablesRes.tables.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = t;
        tableSelect.appendChild(opt);
      });
    }
  } catch (e) {
    console.error("Error loading manipulation tables", e);
  }
}

async function initAdvancedQuerySelects(tableName) {
  const attrSelect = document.querySelector("#op-attribute-select");
  const groupSelect = document.querySelector("#op-groupby-select");

  try {
    let activeDbPath = sessionStorage.getItem("current_db_path");
    if (!activeDbPath) {
      const selectEl = document.getElementById("db-file-select");
      activeDbPath = selectEl ? selectEl.value : null;
    }

    const structRes =
      await window.pywebview.api.get_database_structure_matrix(activeDbPath);
    const columns = structRes.structure[tableName] || [];

    if (attrSelect) {
      attrSelect.innerHTML = '<option value="">-- All columns (*) --</option>';
      columns.forEach((col) => {
        const opt = document.createElement("option");
        opt.value = col;
        opt.textContent = col;
        attrSelect.appendChild(opt);
      });
    }

    if (groupSelect) {
      groupSelect.innerHTML = '<option value="">-- None --</option>';
      columns.forEach((col) => {
        const opt = document.createElement("option");
        opt.value = col;
        opt.textContent = col;
        groupSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("Error loading attributes:", err);
  }
}

async function loadTableDataFull(tableName, container, countSpan) {
  const selectEl = document.getElementById("db-file-select");
  const activeDbPath = selectEl ? selectEl.value : null;
  const res = await window.pywebview.api.get_table_rows(
    tableName,
    activeDbPath,
  );
  if (res && res.success) {
    displayData(res.data, container, countSpan);
  }
}

function displayData(dataArray, container, countSpan) {
  if (!container) return;
  if (!dataArray || dataArray.length === 0) {
    container.innerHTML = "<p>No data found.</p>";
    if (countSpan) countSpan.textContent = "0";
    return;
  }

  if (countSpan) countSpan.textContent = dataArray.length;

  const keys = Object.keys(dataArray[0]);
  let html = `
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; background: var(--bg-container, #fff); color: var(--text-color, #000);">
            <thead style="position: sticky; top: 0; background: var(--bg-secondary, #f1f5f9); z-index: 2;">
                <tr style="border-bottom: 2px solid #cbd5e1;">
                    ${keys.map((k) => `<th style="padding: 10px; border-right: 1px solid #e2e8f0; text-align: left;">${escapeHtml(k)}</th>`).join("")}
                </tr>
            </thead>
            <tbody>
    `;

  dataArray.forEach((row) => {
    html += `<tr style="border-bottom: 1px solid #e2e8f0;">`;
    keys.forEach((k) => {
      html += `<td style="padding: 8px 10px; border-right: 1px solid #e2e8f0;">${escapeHtml(row[k])}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

// === EXPORT PDF DES DOUBLONS ===
async function exportDuplicatesToPDF() {
  try {
    const resultsContent = document.querySelector("#db-results-content");
    if (
      !resultsContent ||
      !resultsContent.innerHTML.trim() ||
      resultsContent.innerHTML.includes("No duplicates")
    ) {
      showNotification("No duplicate results to export.", false);
      return;
    }

    const table = resultsContent.querySelector("table");
    if (!table) {
      showNotification("No data table to export.", false);
      return;
    }

    const result = await window.pywebview.api.select_pdf_file();
    if (!result || !result.success) {
      if (result?.message !== "No file selected.") {
        showNotification(result?.message || "Error selecting file.", false);
      }
      return;
    }

    let filePath = result.file_path;
    if (filePath.startsWith("('") || filePath.startsWith('("')) {
      try {
        const parsed = JSON.parse(filePath.replace(/'/g, '"'));
        if (Array.isArray(parsed)) {
          filePath = parsed[0];
        }
      } catch {
        filePath = filePath
          .replace(/^\(\'/, "")
          .replace(/\'\)$/, "")
          .replace(/^\("/, "")
          .replace(/"\)$/, "");
      }
    }

    let htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Duplicates Report</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
                    h1 { color: #4f46e5; border-bottom: 3px solid #4f46e5; padding-bottom: 10px; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
                    th { background: #4f46e5; color: white; padding: 10px; text-align: left; }
                    td { padding: 8px 10px; border-bottom: 1px solid #ddd; }
                    tr:nth-child(even) { background: #f8fafc; }
                    .header-info { margin-bottom: 20px; color: #666; }
                    .footer { margin-top: 40px; color: #999; font-size: 11px; border-top: 1px solid #eee; padding-top: 20px; }
                </style>
            </head>
            <body>
                <h1>Duplicates Report</h1>
                <div class="header-info">
                    <p><strong>Date :</strong> ${new Date().toLocaleString()}</p>
                    <p><strong>Database :</strong> ${document.getElementById("selected-db-path-label")?.textContent || "Not specified"}</p>
                    <p><strong>Algorithm :</strong> ${document.querySelector("#dup-scan-status")?.textContent?.includes("CIN") ? "CIN + NOM" : "General"}</p>
                    <p><strong>Total duplicates :</strong> ${table.querySelectorAll("tbody tr").length}</p>
                </div>
        `;

    const tableClone = table.cloneNode(true);

    const headerRow = tableClone.querySelector("thead tr");
    if (headerRow) {
      const firstTh = headerRow.querySelector("th");
      if (
        firstTh &&
        (firstTh.textContent.trim() === "🗑️" ||
          firstTh.textContent.trim() === "Suppr.")
      ) {
        firstTh.remove();
      }
    }

    tableClone.querySelectorAll("tbody tr").forEach((row) => {
      const firstTd = row.querySelector("td");
      if (firstTd && firstTd.querySelector('input[type="checkbox"]')) {
        firstTd.remove();
      }
    });

    htmlContent += tableClone.outerHTML;
    htmlContent += `
                <div class="footer">
                    Report generated automatically by Data Manager - Expert Edition
                </div>
            </body>
            </html>
        `;

    showNotificationWithProgress("Generating PDF...", 50, true);
    const pdfResult = await window.pywebview.api.generate_pdf_from_html(
      filePath,
      htmlContent,
    );
    showNotificationWithProgress("PDF generated successfully !", 100, true);

    if (pdfResult && pdfResult.success) {
      showNotification(`PDF saved : ${filePath}`, true);
      logUserAction(`Export PDF of duplicates : ${filePath}`);
    } else {
      showNotification(pdfResult?.message || "Error generating PDF.", false);
    }
  } catch (error) {
    console.error("Error exporting PDF:", error);
    showNotification("Error exporting PDF.", false);
  }
}

// === DOUBLONS - ACTIONS ADMIN ===
function initAdminActions() {
  const btnCheckDups = document.querySelector("#btn-check-duplicates");
  const btnCancelDups = document.querySelector("#btn-cancel-dups");
  const btnSelectAll = document.querySelector("#btn-select-all-dups");
  const btnDeleteDups = document.querySelector("#btn-delete-selected-dups");
  const btnSaveDups = document.querySelector("#btn-save-dups");
  const btnExpandDups = document.querySelector("#btn-expand-dups");
  const btnExpandManipulate = document.querySelector("#btn-expand-manipulate");
  const btnClean = document.querySelector("#btn-clean-db");
  const btnExport = document.querySelector("#btn-export-excel");
  const btnExportPDF = document.querySelector("#btn-export-dups-pdf");

  if (btnExportPDF) {
    btnExportPDF.addEventListener("click", exportDuplicatesToPDF);
  }

  // === SCAN DOUBLONS AVEC ALGORITHMES ===
  if (btnCheckDups) {
    btnCheckDups.addEventListener("click", async () => {
      const container = document.querySelector("#db-results-container");
      const content = document.querySelector("#db-results-content");
      const toolbar = document.querySelector("#duplicate-actions-toolbar");

      container.classList.remove("hidden");
      toolbar.classList.remove("hidden");
      if (btnExpandDups) btnExpandDups.classList.remove("hidden");

      content.innerHTML = `
                <div class="dup-algorithm-selector">
                    <label class="active">
                        <input type="radio" name="dup-algorithm" value="general" checked />
                        General (all columns)
                    </label>
                    <label>
                        <input type="radio" name="dup-algorithm" value="cin_nom" />
                        CIN + NOM (similarity search)
                    </label>
                    <button id="btn-run-dup-scan" class="button button-primary" style="margin-left: auto; padding: 0.4rem 1.2rem;">
                        <i class="fas fa-play"></i> Run analysis
                    </button>
                </div>
                <div id="dup-scan-status" style="padding: 0.5rem; color: var(--text-muted, #64748b);">Select an algorithm and click "Run analysis"</div>
                <div id="dup-results-body"></div>
            `;

      const radioButtons = content.querySelectorAll(
        'input[name="dup-algorithm"]',
      );
      const labels = content.querySelectorAll(".dup-algorithm-selector label");

      radioButtons.forEach((radio, index) => {
        radio.addEventListener("change", () => {
          labels.forEach((l, i) => {
            l.style.borderColor =
              i === index ? "var(--primary, #4f46e5)" : "transparent";
            l.style.background =
              i === index ? "rgba(79, 70, 229, 0.08)" : "transparent";
          });
        });
      });

      const runBtn = content.querySelector("#btn-run-dup-scan");
      runBtn.addEventListener("click", async function () {
        const selectedAlgo =
          content.querySelector('input[name="dup-algorithm"]:checked')?.value ||
          "general";
        const resultsBody = content.querySelector("#dup-results-body");
        const statusDiv = content.querySelector("#dup-scan-status");

        resultsBody.innerHTML =
          '<p style="color: var(--text-muted, #64748b);">Analysis in progress...</p>';
        statusDiv.textContent = `Analysis with "${selectedAlgo === "general" ? "General" : "CIN + NOM"}" algorithm...`;
        duplicateScanCancelled = false;

        try {
          await waitForApi();
          const selectEl = document.getElementById("db-file-select");
          const activeDbPath = selectEl ? selectEl.value : null;

          const tablesRes =
            await window.pywebview.api.get_database_table_names(activeDbPath);
          if (
            !tablesRes ||
            !tablesRes.success ||
            tablesRes.tables.length === 0
          ) {
            resultsBody.innerHTML = "<p>No tables found in this database.</p>";
            return;
          }

          const tables = tablesRes.tables;
          let allDuplicates = [];

          for (let i = 0; i < tables.length; i++) {
            if (duplicateScanCancelled) break;
            const currentTable = tables[i];
            const pct = Math.round(((i + 1) / tables.length) * 100);

            showNotificationWithProgress(
              `Analyzing duplicates (${selectedAlgo === "general" ? "General" : "CIN+NOM"}) : ${currentTable} (${i + 1}/${tables.length})`,
              pct,
              true,
            );

            const scanRes =
              await window.pywebview.api.scan_table_duplicates_advanced(
                currentTable,
                selectedAlgo,
                activeDbPath,
              );

            if (duplicateScanCancelled) break;
            if (scanRes && scanRes.success && scanRes.duplicates) {
              scanRes.duplicates.forEach((dup) => {
                allDuplicates.push({ ...dup, tableName: currentTable });
              });
            }
          }

          if (duplicateScanCancelled) return;
          showNotificationWithProgress("Analysis completed", 100, true);

          if (allDuplicates.length === 0) {
            resultsBody.innerHTML =
              "<p style='color: var(--success, #10b981);'>No duplicates found.</p>";
            toolbar.classList.add("hidden");
            if (btnExpandDups) btnExpandDups.classList.add("hidden");
          } else {
            showNotification(
              `${allDuplicates.length} duplicate(s) found.`,
              true,
            );
            statusDiv.textContent = `${allDuplicates.length} duplicate(s) identified with "${selectedAlgo === "general" ? "General" : "CIN + NOM"}" algorithm`;

            let html = `
                            <div style="margin-bottom: 12px; font-weight: bold; color: var(--primary-color, #4f46e5);">
                                ${allDuplicates.length} duplicate(s) identified
                                ${selectedAlgo === "cin_nom" ? "(CIN + NOM similarity analysis)" : "(General analysis on all columns)"}
                            </div>
                            <div class="duplicates-table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th style="width: 50px; text-align: center;">Delete</th>
                                            <th>Table</th>
                                            <th style="min-width: 150px;">Duplicate</th>
                                            <th style="min-width: 150px;">Reference</th>
                                            <th style="min-width: 250px;">Comparative details</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                        `;

            allDuplicates.forEach((dup, idx) => {
              const tableName = escapeHtml(dup.tableName || dup.table);
              const rowIndex = escapeHtml(dup.row_index);
              const refId = escapeHtml(dup.reference_id);

              let dupDetails = Object.entries(dup.data || {})
                .filter(([k]) => k !== "rowid")
                .map(
                  ([k, v]) =>
                    `<strong>${escapeHtml(k)}</strong>: ${escapeHtml(v)}`,
                )
                .join(" | ");

              let refDetails = dup.reference_data
                ? Object.entries(dup.reference_data)
                    .filter(([k]) => k !== "rowid")
                    .map(
                      ([k, v]) =>
                        `<strong>${escapeHtml(k)}</strong>: ${escapeHtml(v)}`,
                    )
                    .join(" | ")
                : "<em>Identical data</em>";

              let dupLabel = `ID #${rowIndex}`;
              let refLabel = `ID #${refId}`;

              if (dup.algorithm === "cin_nom" && dup.cin_col && dup.nom_col) {
                dupLabel = `${escapeHtml(dup.cin_col)}=${escapeHtml(dup.cin_value)} | ${escapeHtml(dup.nom_col)}=${escapeHtml(dup.nom_value)}`;
              }

              html += `
                                <tr style="border-bottom: 1px solid var(--border-color, #e2e8f0); background: ${idx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.015)"};">
                                    <td style="text-align: center; width: 50px; padding: 0.5rem 0.8rem;">
                                        <input type="checkbox" class="dup-checkbox" 
                                               data-index="${idx}" 
                                               data-table="${tableName}" 
                                               data-rowid="${rowIndex}" 
                                               checked 
                                               style="width: 20px; height: 20px; cursor: pointer;" />
                                    </td>
                                    <td style="font-weight: 600; white-space: nowrap; padding: 0.5rem 0.8rem;">${tableName}</td>
                                    <td class="dup-col-doublon" style="color: #e74c3c; font-weight: 600; background: rgba(231, 76, 60, 0.05); padding: 0.5rem 0.8rem; max-width: 200px; word-break: break-word;">
                                        <div style="font-weight: 600; font-size: 0.8rem;">${dupLabel}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-muted, #64748b);">${dupDetails.substring(0, 100)}${dupDetails.length > 100 ? "..." : ""}</div>
                                    </td>
                                    <td class="dup-col-reference" style="color: #27ae60; font-weight: 600; background: rgba(39, 174, 96, 0.05); padding: 0.5rem 0.8rem; max-width: 200px; word-break: break-word;">
                                        <div style="font-weight: 600; font-size: 0.8rem;">${refLabel}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-muted, #64748b);">${refDetails.substring(0, 100)}${refDetails.length > 100 ? "..." : ""}</div>
                                    </td>
                                    <td style="font-size: 0.8rem; min-width: 250px; padding: 0.5rem 0.8rem; word-break: break-word;">
                                        <div style="color: #e74c3c;"><strong>Duplicate:</strong> ${dupDetails}</div>
                                        <div style="color: #27ae60; margin-top: 4px;"><strong>Reference:</strong> ${refDetails}</div>
                                    </td>
                                </tr>
                            `;
            });

            html += `
                                    </tbody>
                                </table>
                            </div>
                        `;

            resultsBody.innerHTML = html;

            document.querySelectorAll(".dup-checkbox").forEach((chk) => {
              chk.addEventListener("change", updateSelectAllButton);
            });
          }
        } catch (err) {
          console.error("Error scanning duplicates:", err);
          resultsBody.innerHTML =
            "<p style='color: var(--error, #ef4444);'>Communication error with server.</p>";
        }
      });
    });
  }

  function updateSelectAllButton() {
    const checkboxes = document.querySelectorAll(".dup-checkbox");
    const selectAllBtn = document.querySelector("#btn-select-all-dups");
    if (!selectAllBtn || checkboxes.length === 0) return;

    const checked = Array.from(checkboxes).filter((chk) => chk.checked).length;
    const total = checkboxes.length;

    if (checked === total) {
      selectAllBtn.textContent = "Deselect all";
    } else if (checked === 0) {
      selectAllBtn.textContent = "Select all";
    } else {
      selectAllBtn.textContent = `Select all (${checked}/${total})`;
    }
  }

  if (btnCancelDups) {
    btnCancelDups.addEventListener("click", () => {
      duplicateScanCancelled = true;
      const content = document.querySelector("#db-results-content");
      const toolbar = document.querySelector("#duplicate-actions-toolbar");
      if (content)
        content.innerHTML = "<p style='color: orange;'>Analysis cancelled.</p>";
      if (toolbar) toolbar.classList.add("hidden");
      if (btnExpandDups) btnExpandDups.classList.add("hidden");
    });
  }

  if (btnSelectAll) {
    btnSelectAll.addEventListener("click", () => {
      const checkboxes = document.querySelectorAll(".dup-checkbox");
      if (checkboxes.length === 0) return;
      const allChecked = Array.from(checkboxes).every((chk) => chk.checked);

      checkboxes.forEach((chk) => {
        chk.checked = !allChecked;
      });
      btnSelectAll.textContent = allChecked ? "Select all" : "Deselect all";
    });
  }

  if (btnDeleteDups) {
    btnDeleteDups.addEventListener("click", async () => {
      const checkedBoxes = document.querySelectorAll(".dup-checkbox:checked");
      if (checkedBoxes.length === 0) {
        alert("Please select at least one duplicate to delete.");
        return;
      }
      if (
        !confirm(
          `Warning: you are about to permanently delete ${checkedBoxes.length} duplicate(s) while preserving original rows. Continue ?`,
        )
      )
        return;

      try {
        await waitForApi();
        let successCount = 0;
        const selectEl = document.getElementById("db-file-select");
        const activeDbPath = selectEl ? selectEl.value : null;

        for (const chk of checkedBoxes) {
          const tableName = chk.getAttribute("data-table");
          const rowIndex = chk.getAttribute("data-rowid");
          if (window.pywebview?.api?.delete_table_row) {
            const res = await window.pywebview.api.delete_table_row(
              tableName,
              rowIndex,
              activeDbPath,
            );
            if (res && res.success) successCount++;
          }
        }
        showNotification(
          `${successCount} duplicate(s) deleted successfully.`,
          true,
        );
        logUserAction(`Deletion of ${successCount} duplicates`);
        document.querySelector("#db-results-container").classList.add("hidden");
        if (btnExpandDups) btnExpandDups.classList.add("hidden");
      } catch (err) {
        console.error("Error deleting:", err);
      }
    });
  }

  if (btnSaveDups) {
    btnSaveDups.addEventListener("click", async () => {
      showNotification("Duplicate actions saved successfully.", true);
      logUserAction("Saving duplicate actions");
    });
  }

  if (btnClean) {
    btnClean.addEventListener("click", async () => {
      if (confirm("Replace all empty, NaN or Null values with defaults ?")) {
        try {
          await waitForApi();
          const selectEl = document.getElementById("db-file-select");
          const activeDbPath = selectEl ? selectEl.value : null;
          const res =
            await window.pywebview.api.clean_database_values(activeDbPath);
          alert(res?.message || "Cleaning completed.");
          logUserAction("Database cleaning executed");
        } catch (e) {
          console.error("Error cleaning:", e);
        }
      }
    });
  }

  if (btnExport) {
    btnExport.addEventListener("click", async () => {
      try {
        await waitForApi();
        const saveRes = await window.pywebview.api.select_excel_file();
        if (saveRes && saveRes.success) {
          const selectEl = document.getElementById("db-file-select");
          const activeDbPath = selectEl ? selectEl.value : null;

          showNotificationWithProgress("Exporting to Excel...", 30, true);
          const res = await window.pywebview.api.export_database_to_excel(
            saveRes.file_path,
            activeDbPath,
          );
          showNotificationWithProgress("Export completed", 100, true);

          alert(res?.message || "Export successful.");
          logUserAction("Export database to Excel");
        }
      } catch (e) {
        console.error("Error exporting:", e);
      }
    });
  }

  if (btnExpandDups) {
    btnExpandDups.addEventListener("click", () => {
      const contentElem = document.querySelector("#db-results-content");
      if (
        !contentElem ||
        !contentElem.innerHTML.trim() ||
        contentElem.innerHTML.includes("No duplicates")
      ) {
        alert("Please run a valid duplicate analysis first.");
        return;
      }
      openFullScreenModal(
        "Advanced Duplicate Management - Expanded View",
        contentElem.innerHTML,
      );
    });
  }

  if (btnExpandManipulate) {
    btnExpandManipulate.addEventListener("click", () => {
      const container = document.querySelector(
        "#manipulate-results-table-container",
      );
      if (!container || !container.querySelector("table")) {
        alert("No result table to expand.");
        return;
      }
      openFullScreenModal(
        "Data Manipulation - Full Screen Expanded View",
        container.innerHTML,
      );
    });
  }
}

// === REQUÊTES SQL INTERACTIVES ===
function initSqlOperations() {
  document.querySelectorAll(".op-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".op-btn").forEach((b) => {
        b.style.background = "";
        b.style.color = "";
      });
      e.target.style.background = "var(--primary-color, #4f46e5)";
      e.target.style.color = "#ffffff";
      const opType = e.target.getAttribute("data-op");
      document.getElementById("selected-operation-type").value = opType;
    });
  });

  const btnExecuteOp = document.getElementById("btn-execute-operation");
  if (btnExecuteOp) {
    btnExecuteOp.addEventListener("click", async () => {
      const tableName = document.getElementById(
        "manipulate-table-select",
      )?.value;
      const opType =
        document.getElementById("selected-operation-type")?.value ||
        "SELECT_ALL";
      const attribute = document.getElementById("op-attribute-select")?.value;
      const value = document.getElementById("op-value-input")?.value;
      const groupBy = document.getElementById("op-groupby-select")?.value;

      if (!tableName) {
        showNotification("Please select and validate a table first.", false);
        return;
      }

      try {
        await waitForApi();
        const selectEl = document.getElementById("db-file-select");
        const activeDbPath = selectEl ? selectEl.value : null;

        const res = await window.pywebview.api.execute_custom_sql_operation(
          tableName,
          opType,
          attribute,
          value,
          groupBy,
          activeDbPath,
        );
        if (res?.success) {
          displayData(
            res.data,
            document.querySelector("#manipulate-results-table-container"),
            document.querySelector("#manipulate-response-count"),
          );
          showNotification(`SQL query (${opType}) executed successfully.`);
          logUserAction(`Execution of query ${opType} on ${tableName}`);
        } else {
          showNotification(res?.message || "Error executing SQL query.", false);
        }
      } catch (err) {
        console.error(err);
        showNotification("Communication error with API.", false);
      }
    });
  }

  const btnResetOp = document.getElementById("btn-reset-operation");
  if (btnResetOp) {
    btnResetOp.addEventListener("click", () => {
      const hiddenOpType = document.getElementById("selected-operation-type");
      if (hiddenOpType) hiddenOpType.value = "SELECT_ALL";

      document.querySelectorAll(".op-btn").forEach((b) => {
        b.style.background = "";
        b.style.color = "";
      });
      const firstOpBtn = document.querySelector(
        '.op-btn[data-op="SELECT_ALL"]',
      );
      if (firstOpBtn) {
        firstOpBtn.style.background = "var(--primary-color, #4f46e5)";
        firstOpBtn.style.color = "#ffffff";
      }

      const attrSelect = document.getElementById("op-attribute-select");
      if (attrSelect) attrSelect.value = "";

      const valueInput = document.getElementById("op-value-input");
      if (valueInput) valueInput.value = "";

      const groupSelect = document.getElementById("op-groupby-select");
      if (groupSelect) groupSelect.value = "";

      showNotification("Query form reset.", true);
    });
  }
}

// === MODAL PLEIN ÉCRAN ===
function openFullScreenModal(titleText, htmlContent) {
  let modalOverlay = document.getElementById("fullscreen-modal-overlay");
  if (!modalOverlay) {
    modalOverlay = document.createElement("div");
    modalOverlay.id = "fullscreen-modal-overlay";
    modalOverlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(10px);
            z-index: 99999; display: flex; justify-content: center; align-items: center; padding: 20px;
        `;
    modalOverlay.innerHTML = `
            <div style="background: var(--card-bg, #ffffff); color: var(--text-color, #111); width: 100vw; height: 100vh; border-radius: 0; display: flex; flex-direction: column; overflow: hidden;">
                <div style="padding: 16px 24px; border-bottom: 1px solid var(--border-color, #e2e8f0); display: flex; justify-content: space-between; align-items: center; background: var(--bg-secondary, #f8fafc);">
                    <h2 id="modal-title-text" style="margin: 0; font-size: 1.4rem; display: flex; align-items: center; gap: 12px;"><i class="fas fa-expand"></i> <span></span></h2>
                    <button type="button" id="close-fullscreen-modal" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: var(--text-color);">&times;</button>
                </div>
                <div id="fullscreen-modal-body" style="padding: 24px; overflow-y: auto; flex: 1;"></div>
                <div style="padding: 14px 24px; border-top: 1px solid var(--border-color, #e2e8f0); background: var(--bg-secondary, #f8fafc); display: flex; justify-content: flex-end;">
                    <button type="button" class="secondary-button" id="modal-btn-fermer" style="padding: 10px 20px;">Close</button>
                </div>
            </div>
        `;
    document.body.appendChild(modalOverlay);

    const closeModal = () => {
      modalOverlay.style.display = "none";
    };
    document.getElementById("close-fullscreen-modal").onclick = closeModal;
    document.getElementById("modal-btn-fermer").onclick = closeModal;
  }

  document
    .getElementById("modal-title-text")
    .querySelector("span").textContent = titleText;
  document.getElementById("fullscreen-modal-body").innerHTML = htmlContent;
  modalOverlay.style.display = "flex";
}

// === ÉVÉNEMENTS PRINCIPAUX ===
document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("app_theme") || "light";
  applyTheme(savedTheme);

  initializeApp();
  initManipulatePage();
  initAdminActions();
  initSqlOperations();

  if (setupForm) {
    setupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const pseudo = document.querySelector("#setup-pseudo")?.value.trim();
      const password = document.querySelector("#setup-password")?.value;
      if (!pseudo || !password) {
        showMessage("#setup-message", "Please fill in all fields.");
        return;
      }
      try {
        await waitForApi();
        const result = await window.pywebview.api.create_first_user(
          pseudo,
          password,
        );
        showMessage(
          "#setup-message",
          result.message || "Operation completed.",
          result.success,
        );
        if (result.success) {
          setupForm.reset();
          setTimeout(() => showView(loginView), 800);
        }
      } catch (error) {
        console.error(error);
        showMessage(
          "#setup-message",
          "Unable to communicate with the application.",
        );
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const pseudo = document.querySelector("#login-pseudo")?.value.trim();
      const password = document.querySelector("#login-password")?.value;
      if (!pseudo || !password) {
        showMessage("#login-message", "Please fill in all fields.");
        return;
      }
      try {
        await waitForApi();
        const result = await window.pywebview.api.login(pseudo, password);
        if (!result?.success) {
          showMessage(
            "#login-message",
            result?.message || "Incorrect credentials.",
          );
          return;
        }
        loginForm.reset();
        showDashboard(result.user);
      } catch (error) {
        console.error(error);
        showMessage(
          "#login-message",
          "Unable to communicate with the application.",
        );
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      try {
        await waitForApi();
        await window.pywebview.api.logout();
        sessionStorage.removeItem("session_active");
        userMenu?.classList.add("hidden");
        menuButton?.setAttribute("aria-expanded", "false");
        showView(loginView);
      } catch (error) {
        console.error(error);
      }
    });
  }

  document.querySelectorAll(".quit-global-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        if (window.pywebview?.api?.quit_app) {
          await window.pywebview.api.quit_app();
        } else {
          window.close();
        }
      } catch (e) {
        console.error("Error closing:", e);
      }
    });
  });

  document.querySelectorAll(".menu-container").forEach((container) => {
    const button = container.querySelector(".menu-button, #menu-button");
    const menu = container.querySelector(".user-menu");
    if (button && menu) {
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);
      newButton.addEventListener("click", (event) => {
        event.stopPropagation();
        document.querySelectorAll(".user-menu").forEach((m) => {
          if (m !== menu) m.classList.add("hidden");
        });
        menu.classList.toggle("hidden");
      });
    }
  });

  document.addEventListener("click", (event) => {
    document.querySelectorAll(".user-menu").forEach((menu) => {
      const container = menu.closest(".menu-container");
      if (container && !container.contains(event.target)) {
        menu.classList.add("hidden");
      }
    });
  });

  document.addEventListener("click", (e) => {
    const themeBtn = e.target.closest(".theme-global-btn, .theme-toggle-btn");
    if (themeBtn) {
      const currentTheme =
        document.documentElement.getAttribute("data-theme") || "light";
      const newTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(newTheme);
    }
  });

  importExcelButton?.addEventListener("click", () => {
    resetExcelImportView();
    showView(excelImportView);
  });

  backToDashboardButton?.addEventListener("click", () => {
    showView(dashboardView);
    refreshDatabaseStatus();
  });

  selectExcelFileButton?.addEventListener("click", selectExcelFile);
  excelSheetSelect?.addEventListener("change", () => {
    loadExcelPreview(excelSheetSelect.value);
  });

  toggleShowSheetsCheckbox?.addEventListener("change", () => {
    if (toggleShowSheetsCheckbox.checked && excelSheetSelect.value) {
      loadExcelPreview(excelSheetSelect.value);
    } else {
      excelPreviewContainer?.classList.add("hidden");
    }
  });

  excelTableNameInput?.addEventListener("input", updateImportButtonState);
  importButton?.addEventListener("click", importExcelIntoDatabase);

  const dbFileSelect = document.getElementById("db-file-select");
  if (dbFileSelect) {
    dbFileSelect.addEventListener("change", async (event) => {
      const filePath = event.target.value;
      if (!filePath) return;
      const fileName = filePath.split("/").pop().split("\\").pop();
      const label = document.getElementById("selected-db-path-label");
      if (label) {
        label.textContent = fileName;
        label.style.color = "var(--text-color)";
      }
      try {
        await waitForApi();
        await window.pywebview.api.open_database_path(filePath);
        logUserAction(`Opening database : ${fileName}`);

        const toggleChecked = document.getElementById(
          "toggle-show-tables-list",
        )?.checked;
        if (toggleChecked) {
          await loadDatabaseDetails(filePath);
        } else {
          const container = document.querySelector(
            "#database-tables-container-existing",
          );
          if (container) container.classList.add("hidden");
        }
      } catch (err) {
        console.error("Error opening database:", err);
      }
    });
  }

  const toggleTablesCheckbox = document.getElementById(
    "toggle-show-tables-list",
  );
  const tablesContainerExisting = document.getElementById(
    "database-tables-container-existing",
  );
  if (toggleTablesCheckbox && tablesContainerExisting) {
    toggleTablesCheckbox.checked = false;
    tablesContainerExisting.classList.add("hidden");

    toggleTablesCheckbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        tablesContainerExisting.classList.remove("hidden");
        const selectEl = document.getElementById("db-file-select");
        if (selectEl && selectEl.value) {
          loadDatabaseDetails(selectEl.value);
        }
      } else {
        tablesContainerExisting.classList.add("hidden");
      }
    });
  }
});

// === GESTION DE LA LANGUE ===
// === GESTION DE LA LANGUE ===
let currentLanguage = "fr";

// Traductions
const translations = {
  fr: {
    welcome: "Bonjour",
    dashboard: "Tableau de bord",
    import_excel: "Importer un fichier Excel",
    import_desc: "Convertir un fichier Excel en base de données.",
    open_db: "Travailler avec une base existante",
    open_desc: "Ouvrir et manipuler une base de données existante.",
    home: "Accueil",
    logout: "Se déconnecter",
    quit: "Quitter",
    theme: "Changer de thème",
    language: "Langue",
    french: "Français",
    english: "English",
    connected: "Connecté",
    active_session: "Session active",
    no_database: "Aucune base",
    no_activity: "Aucune action récente",
    database: "Base de données",
    active_db: "Base active",
    location: "Emplacement",
    name: "Nom",
    recent_actions: "Dernières actions",
    activity: "Activité",
    tools: "Outils de gestion",
    find_duplicates: "Trouver les doublons",
    clean_data: "Nettoyer les données",
    manipulate: "Manipuler les données",
    export_excel: "Exporter vers Excel",
    select_file: "Sélectionner un fichier Excel",
    no_file: "Aucun fichier sélectionné",
    convert: "Convertir en base de données",
    table_name: "Nom de la table dans la base",
    columns: "Colonnes détectées",
    sheet: "Feuille Excel",
    results: "Résultats",
    duplicates: "Doublons",
    delete: "Supprimer",
    save: "Enregistrer",
    cancel: "Annuler",
    export_pdf: "Exporter PDF",
    select_all: "Tout sélectionner",
    deselect_all: "Tout désélectionner",
    expand: "Agrandir",
    search: "Rechercher",
    filter: "Filtrer les colonnes",
    sql_queries: "Requêtes SQL",
    execute: "Exécuter",
    reset: "Réinitialiser",
    results_count: "Nombre de résultats",
    no_data: "Aucune donnée trouvée.",
    select_table: "Veuillez sélectionner une table.",
    loading: "Chargement...",
    first_start: "Premier démarrage",
    create_user: "Créer le premier utilisateur",
    username: "Nom d'utilisateur",
    password: "Mot de passe",
    login: "Se connecter",
    login_title: "Bienvenue",
    login_desc: "Connectez-vous pour accéder à vos données.",
    create_account: "Créer l'utilisateur",
    setup_title: "Premier démarrage",
    setup_desc: "Créez le premier utilisateur de l'application.",
    all_columns: "Toutes les colonnes",
    none: "Aucun",
    target_column: "Colonne cible",
    filter_value: "Valeur (optionnel)",
    group_by: "Grouper par",
    view_all: "Voir tout",
    unique_values: "Valeurs uniques",
    minimum: "Minimum",
    maximum: "Maximum",
    count: "Compter",
    sum: "Somme",
    average: "Moyenne",
    search_label: "Rechercher",
    group: "Grouper",
    manipulation_tools: "Outils :",
    explorer: "Explorateur",
    available_dbs: "Bases de données disponibles",
    select_db: "Sélectionnez une base de données existante",
    show_content: "Afficher le contenu de la base",
    administration: "Administration",
    duplicate_results: "Résultats - Recherche de doublons",
    select_table_first: "-- Sélectionnez une table d'abord --",
    back: "Retour",
    validate: "Valider",
    no_duplicates: "Aucun doublon trouvé.",
    duplicates_found: "doublon(s) trouvé(s)",
    analysis_complete: "Analyse terminée",
    analysis_cancelled: "Analyse annulée",
    communication_error: "Erreur de communication",
    select_db_first: "Veuillez sélectionner une base de données d'abord.",
    file_not_found: "Fichier non trouvé",
    export_success: "Exportation réussie",
    export_error: "Erreur lors de l'exportation",
    cleaning_complete: "Nettoyage terminé",
    cleaning_error: "Erreur lors du nettoyage",
    search_results: "résultat(s) trouvé(s)",
    no_search_results: "Aucun résultat trouvé",
    apply_filters: "Appliquer les filtres",
    reset_filters: "Réinitialiser les filtres",
    select_column: "Sélectionnez au moins une colonne.",
    filters_applied: "Filtres appliqués",
    filters_reset: "Filtres réinitialisés",
    operation_executed: "Opération exécutée",
    operation_error: "Erreur lors de l'opération",
    form_reset: "Formulaire réinitialisé",
    pdf_generated: "PDF généré avec succès",
    pdf_error: "Erreur lors de la génération du PDF",
    no_data_to_export: "Aucune donnée à exporter",
    select_pdf_location: "Sélectionnez l'emplacement du PDF",
    db_selected: "Base sélectionnée",
    table_selected: "Table sélectionnée",
    open_database: "Ouvrir la base de données",
    db_opened: "Base ouverte",
    db_closed: "Base fermée",
    import_success: "Importation réussie",
    import_error: "Erreur lors de l'importation",
    importing: "Importation en cours...",
    converting: "Conversion en base de données...",
    conversion_complete: "Conversion terminée",
    no_file_selected: "Aucun fichier sélectionné",
    invalid_file: "Fichier invalide",
    invalid_sheet: "Feuille invalide",
    preview_error: "Erreur lors de l'aperçu",
    columns_detected: "colonne(s) détectée(s)",
    column: "Colonne",
    unnamed_column: "Colonne sans nom",
    table_created: "Table créée",
    rows_imported: "lignes importées",
    confirm_delete_duplicates: "Êtes-vous sûr de vouloir supprimer",
    deleted_duplicates: "doublon(s) supprimé(s)",
    save_duplicates: "Doublons enregistrés",
    saving: "Enregistrement...",
    select_algorithm: "Sélectionnez un algorithme",
    algorithm_general: "Général (toutes les colonnes)",
    algorithm_cin_nom: "CIN + NOM (recherche par similarité)",
    run_analysis: "Lancer l'analyse",
    analysis: "Analyse",
    analyzing: "Analyse en cours...",
    analyzing_table: "Analyse de la table",
    analyzing_duplicates: "Analyse des doublons",
    duplicate_detected: "Doublon détecté",
    duplicate_type: "Type de doublon",
    cin_identical: "CIN identique",
    nom_geo: "Nom + géolocalisation",
    general_dup: "Général",
    reference: "Référence",
    details: "Détails",
    comparative_details: "Détails comparatifs",
    duplicate: "Doublon",
    original: "Original",
    id: "ID",
    table: "Table",
    no_tables: "Aucune table trouvée",
    select_table_to_view:
      "Veuillez sélectionner une table pour afficher les données.",
    db_name: "Nom de la base",
    db_path: "Chemin de la base",
    file_size: "Taille du fichier",
    kb: "Ko",
    mb: "Mo",
    confirm_delete: "Supprimer définitivement",
  },
  en: {
    welcome: "Hello",
    dashboard: "Dashboard",
    import_excel: "Import Excel File",
    import_desc: "Convert an Excel file to a database.",
    open_db: "Work with existing database",
    open_desc: "Open and manipulate an existing database.",
    home: "Home",
    logout: "Log out",
    quit: "Quit",
    theme: "Change theme",
    language: "Language",
    french: "French",
    english: "English",
    connected: "Connected",
    active_session: "Active session",
    no_database: "No database",
    no_activity: "No recent activity",
    database: "Database",
    active_db: "Active database",
    location: "Location",
    name: "Name",
    recent_actions: "Recent actions",
    activity: "Activity",
    tools: "Management tools",
    find_duplicates: "Find duplicates",
    clean_data: "Clean data",
    manipulate: "Manipulate data",
    export_excel: "Export to Excel",
    select_file: "Select Excel file",
    no_file: "No file selected",
    convert: "Convert to database",
    table_name: "Table name in database",
    columns: "Detected columns",
    sheet: "Excel sheet",
    results: "Results",
    duplicates: "Duplicates",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    export_pdf: "Export PDF",
    select_all: "Select all",
    deselect_all: "Deselect all",
    expand: "Expand",
    search: "Search",
    filter: "Filter columns",
    sql_queries: "SQL Queries",
    execute: "Execute",
    reset: "Reset",
    results_count: "Results count",
    no_data: "No data found.",
    select_table: "Please select a table.",
    loading: "Loading...",
    first_start: "First start",
    create_user: "Create the first user",
    username: "Username",
    password: "Password",
    login: "Log in",
    login_title: "Welcome",
    login_desc: "Log in to access your data.",
    create_account: "Create user",
    setup_title: "First start",
    setup_desc: "Create the first user of the application.",
    all_columns: "All columns",
    none: "None",
    target_column: "Target column",
    filter_value: "Filter value (optional)",
    group_by: "Group by",
    view_all: "View all",
    unique_values: "Unique values",
    minimum: "Minimum",
    maximum: "Maximum",
    count: "Count",
    sum: "Sum",
    average: "Average",
    search_label: "Search",
    group: "Group",
    manipulation_tools: "Tools :",
    explorer: "Explorer",
    available_dbs: "Available databases",
    select_db: "Select an existing database",
    show_content: "Show database content",
    administration: "Administration",
    duplicate_results: "Results - Duplicate search",
    select_table_first: "-- Select a table first --",
    back: "Back",
    validate: "Validate",
    no_duplicates: "No duplicates found.",
    duplicates_found: "duplicate(s) found",
    analysis_complete: "Analysis complete",
    analysis_cancelled: "Analysis cancelled",
    communication_error: "Communication error",
    select_db_first: "Please select a database first.",
    file_not_found: "File not found",
    export_success: "Export successful",
    export_error: "Export error",
    cleaning_complete: "Cleaning complete",
    cleaning_error: "Cleaning error",
    search_results: "result(s) found",
    no_search_results: "No results found",
    apply_filters: "Apply filters",
    reset_filters: "Reset filters",
    select_column: "Select at least one column.",
    filters_applied: "Filters applied",
    filters_reset: "Filters reset",
    operation_executed: "Operation executed",
    operation_error: "Operation error",
    form_reset: "Form reset",
    pdf_generated: "PDF generated successfully",
    pdf_error: "PDF generation error",
    no_data_to_export: "No data to export",
    select_pdf_location: "Select PDF location",
    db_selected: "Database selected",
    table_selected: "Table selected",
    open_database: "Open database",
    db_opened: "Database opened",
    db_closed: "Database closed",
    import_success: "Import successful",
    import_error: "Import error",
    importing: "Importing...",
    converting: "Converting to database...",
    conversion_complete: "Conversion complete",
    no_file_selected: "No file selected",
    invalid_file: "Invalid file",
    invalid_sheet: "Invalid sheet",
    preview_error: "Preview error",
    columns_detected: "column(s) detected",
    column: "Column",
    unnamed_column: "Unnamed column",
    table_created: "Table created",
    rows_imported: "rows imported",
    confirm_delete_duplicates: "Are you sure you want to delete",
    deleted_duplicates: "duplicate(s) deleted",
    save_duplicates: "Duplicates saved",
    saving: "Saving...",
    select_algorithm: "Select an algorithm",
    algorithm_general: "General (all columns)",
    algorithm_cin_nom: "CIN + NOM (similarity search)",
    run_analysis: "Run analysis",
    analysis: "Analysis",
    analyzing: "Analyzing...",
    analyzing_table: "Analyzing table",
    analyzing_duplicates: "Analyzing duplicates",
    duplicate_detected: "Duplicate detected",
    duplicate_type: "Duplicate type",
    cin_identical: "Identical CIN",
    nom_geo: "Name + geolocation",
    general_dup: "General",
    reference: "Reference",
    details: "Details",
    comparative_details: "Comparative details",
    duplicate: "Duplicate",
    original: "Original",
    id: "ID",
    table: "Table",
    no_tables: "No tables found",
    select_table_to_view: "Please select a table to view data.",
    db_name: "Database name",
    db_path: "Database path",
    file_size: "File size",
    kb: "KB",
    mb: "MB",
    confirm_delete: "Permanently delete",
  },
};

function getTranslation(key) {
  return translations[currentLanguage]?.[key] || key;
}

function setLanguage(lang) {
  currentLanguage = lang;
  localStorage.setItem("app_language", lang);

  // Mettre à jour les boutons de langue
  document.querySelectorAll(".language-btn").forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.lang === lang);
  });

  // Mettre à jour le label dans le menu
  document.querySelectorAll(".menu-lang-label").forEach(function (el) {
    el.textContent = lang === "fr" ? "Français" : "English";
  });
  var menuLangLabel = document.getElementById("menu-lang-label");
  if (menuLangLabel) {
    menuLangLabel.textContent = lang === "fr" ? "Français" : "English";
  }

  // Mettre à jour l'interface
  updateUITexts();
}

function updateUITexts() {
  // Dashboard
  var welcomeMsg = document.querySelector("#welcome-message");
  if (welcomeMsg) welcomeMsg.textContent = getTranslation("welcome");

  var btnImportTitle = document.querySelector("#btn-import-title");
  if (btnImportTitle)
    btnImportTitle.textContent = getTranslation("import_excel");

  var btnImportDesc = document.querySelector("#btn-import-desc");
  if (btnImportDesc) btnImportDesc.textContent = getTranslation("import_desc");

  var btnOpenTitle = document.querySelector("#btn-open-title");
  if (btnOpenTitle) btnOpenTitle.textContent = getTranslation("open_db");

  var btnOpenDesc = document.querySelector("#btn-open-desc");
  if (btnOpenDesc) btnOpenDesc.textContent = getTranslation("open_desc");

  // Topbar
  document.querySelectorAll(".btn-home").forEach(function (el) {
    el.innerHTML = '<i class="fas fa-home"></i> ' + getTranslation("home");
  });

  // Menu
  document.querySelectorAll(".logout-global-btn").forEach(function (el) {
    el.innerHTML =
      '<i class="fas fa-sign-out-alt"></i> ' + getTranslation("logout");
  });
  document.querySelectorAll(".quit-global-btn").forEach(function (el) {
    el.innerHTML = '<i class="fas fa-power-off"></i> ' + getTranslation("quit");
  });
  document.querySelectorAll(".theme-global-btn").forEach(function (el) {
    el.innerHTML = '<i class="fas fa-adjust"></i> ' + getTranslation("theme");
  });

  // Setup
  var setupTitle = document.querySelector("#setup-title");
  if (setupTitle) setupTitle.textContent = getTranslation("setup_title");

  var setupDesc = document.querySelector("#setup-view p");
  if (setupDesc) setupDesc.textContent = getTranslation("setup_desc");

  var setupPseudo = document.querySelector("#setup-pseudo");
  if (setupPseudo) setupPseudo.placeholder = getTranslation("username");

  var setupPassword = document.querySelector("#setup-password");
  if (setupPassword) setupPassword.placeholder = getTranslation("password");

  var setupBtn = document.querySelector('#setup-view button[type="submit"]');
  if (setupBtn) setupBtn.textContent = getTranslation("create_account");

  // Login
  var loginTitle = document.querySelector("#login-title");
  if (loginTitle) loginTitle.textContent = getTranslation("login_title");

  var loginDesc = document.querySelector("#login-view p");
  if (loginDesc) loginDesc.textContent = getTranslation("login_desc");

  var loginPseudo = document.querySelector("#login-pseudo");
  if (loginPseudo) loginPseudo.placeholder = getTranslation("username");

  var loginPassword = document.querySelector("#login-password");
  if (loginPassword) loginPassword.placeholder = getTranslation("password");

  var loginBtn = document.querySelector('#login-view button[type="submit"]');
  if (loginBtn) loginBtn.textContent = getTranslation("login");

  // Existing DB
  var existingTitle = document.querySelector("#existing-db-title");
  if (existingTitle)
    existingTitle.textContent = getTranslation("available_dbs");

  var existingDesc = document.querySelector(
    "#existing-db-view .dashboard-heading p",
  );
  if (existingDesc) existingDesc.textContent = getTranslation("select_db");

  var toggleLabel = document.querySelector("#toggle-show-tables-list");
  if (toggleLabel && toggleLabel.nextElementSibling) {
    toggleLabel.nextElementSibling.textContent = getTranslation("show_content");
  }

  var toolsTitle = document.querySelector(
    "#db-actions-panel .section-heading h2",
  );
  if (toolsTitle) toolsTitle.textContent = getTranslation("tools");

  // Admin buttons
  var btnFindDups = document.querySelector(
    "#btn-check-duplicates .feature-title",
  );
  if (btnFindDups)
    btnFindDups.textContent = "1. " + getTranslation("find_duplicates");

  var btnClean = document.querySelector("#btn-clean-db .feature-title");
  if (btnClean) btnClean.textContent = "2. " + getTranslation("clean_data");

  var btnManipulate = document.querySelector(
    "#btn-manipulate-db .feature-title",
  );
  if (btnManipulate)
    btnManipulate.textContent = "3. " + getTranslation("manipulate");

  var btnExport = document.querySelector("#btn-export-excel .feature-title");
  if (btnExport) btnExport.textContent = "4. " + getTranslation("export_excel");

  // Duplicate results
  var resultsTitle = document.querySelector("#results-title");
  if (resultsTitle) {
    resultsTitle.innerHTML =
      '<i class="fas fa-clone" style="color: var(--primary, #4f46e5);"></i> ' +
      getTranslation("duplicate_results");
  }

  var btnSelectAll = document.querySelector("#btn-select-all-dups");
  if (btnSelectAll)
    btnSelectAll.innerHTML =
      '<i class="fas fa-check-double"></i> ' + getTranslation("select_all");

  var btnDelete = document.querySelector("#btn-delete-selected-dups");
  if (btnDelete)
    btnDelete.innerHTML =
      '<i class="fas fa-trash"></i> ' + getTranslation("delete");

  var btnSave = document.querySelector("#btn-save-dups");
  if (btnSave)
    btnSave.innerHTML = '<i class="fas fa-save"></i> ' + getTranslation("save");

  var btnCancel = document.querySelector("#btn-cancel-dups");
  if (btnCancel)
    btnCancel.innerHTML =
      '<i class="fas fa-times"></i> ' + getTranslation("cancel");

  var btnExportPdf = document.querySelector("#btn-export-dups-pdf");
  if (btnExportPdf)
    btnExportPdf.innerHTML =
      '<i class="fas fa-file-pdf"></i> ' + getTranslation("export_pdf");

  var btnExpand = document.querySelector("#btn-expand-dups");
  if (btnExpand)
    btnExpand.innerHTML =
      '<i class="fas fa-expand"></i> ' + getTranslation("expand");

  // Manipulate
  var manipulateTitle = document.querySelector("#manipulate-title");
  if (manipulateTitle)
    manipulateTitle.textContent = getTranslation("manipulate");

  var manipulateDesc = document.querySelector(
    "#manipulate-view .dashboard-heading p",
  );
  if (manipulateDesc)
    manipulateDesc.textContent = getTranslation("select_table");

  var btnSelectTable = document.querySelector("#btn-manipulate-select-table");
  if (btnSelectTable)
    btnSelectTable.innerHTML =
      '<i class="fas fa-check"></i> ' + getTranslation("validate");

  var btnSearch = document.querySelector("#btn-manipulate-search");
  if (btnSearch)
    btnSearch.innerHTML =
      '<i class="fas fa-search"></i> ' + getTranslation("search");

  var btnFilters = document.querySelector("#btn-manipulate-filters");
  if (btnFilters)
    btnFilters.innerHTML =
      '<i class="fas fa-filter"></i> ' + getTranslation("filter");

  var btnOperations = document.querySelector("#btn-manipulate-operations");
  if (btnOperations)
    btnOperations.innerHTML =
      '<i class="fas fa-cogs"></i> ' + getTranslation("sql_queries");

  var btnExecuteSearch = document.querySelector("#btn-execute-search");
  if (btnExecuteSearch)
    btnExecuteSearch.innerHTML =
      '<i class="fas fa-search"></i> ' + getTranslation("search");

  var btnExecuteOp = document.querySelector("#btn-execute-operation");
  if (btnExecuteOp)
    btnExecuteOp.innerHTML =
      '<i class="fas fa-play"></i> ' + getTranslation("execute");

  var btnResetOp = document.querySelector("#btn-reset-operation");
  if (btnResetOp)
    btnResetOp.innerHTML =
      '<i class="fas fa-undo"></i> ' + getTranslation("reset");

  var btnExpandManipulate = document.querySelector("#btn-expand-manipulate");
  if (btnExpandManipulate)
    btnExpandManipulate.innerHTML =
      '<i class="fas fa-expand"></i> ' + getTranslation("expand");

  // SQL operation buttons
  var opBtns = document.querySelectorAll(".op-btn");
  var opBtnLabels = {
    SELECT_ALL: "view_all",
    DISTINCT: "unique_values",
    MIN: "minimum",
    MAX: "maximum",
    COUNT: "count",
    SUM: "sum",
    AVG: "average",
    WHERE_LIKE: "search_label",
    GROUP_BY: "group",
  };
  opBtns.forEach(function (btn) {
    var opType = btn.getAttribute("data-op");
    if (opType && opBtnLabels[opType]) {
      btn.textContent = getTranslation(opBtnLabels[opType]);
    }
  });

  // Labels
  var tableNameLabel = document.querySelector('label[for="excel-table-name"]');
  if (tableNameLabel) tableNameLabel.textContent = getTranslation("table_name");

  var sheetLabel = document.querySelector('label[for="excel-sheet-select"]');
  if (sheetLabel) sheetLabel.textContent = getTranslation("sheet");

  var dbFileLabel = document.querySelector('label[for="db-file-select"]');
  if (dbFileLabel) dbFileLabel.textContent = getTranslation("available_dbs");

  var attrLabel = document.querySelector('label[for="op-attribute-select"]');
  if (attrLabel) attrLabel.textContent = getTranslation("target_column");

  var groupLabel = document.querySelector('label[for="op-groupby-select"]');
  if (groupLabel) groupLabel.textContent = getTranslation("group_by");

  var tableSelectLabel = document.querySelector(
    'label[for="manipulate-table-select"]',
  );
  if (tableSelectLabel)
    tableSelectLabel.textContent = getTranslation("select_table");

  // Import Excel
  var importTitle = document.querySelector("#excel-import-title");
  if (importTitle) importTitle.textContent = getTranslation("import_excel");

  var selectFileBtn = document.querySelector("#select-excel-file-button");
  if (selectFileBtn)
    selectFileBtn.innerHTML =
      '<i class="fas fa-file-excel"></i> ' + getTranslation("select_file");

  var selectedFile = document.querySelector("#selected-excel-file");
  if (
    selectedFile &&
    !selectedFile.textContent.includes("fichier sélectionné")
  ) {
    // Ne pas écraser le nom du fichier
  }

  var convertBtn = document.querySelector("#import-excel-into-database-button");
  if (convertBtn)
    convertBtn.innerHTML =
      '<i class="fas fa-database"></i> ' + getTranslation("convert");

  var backBtn = document.querySelector("#back-to-dashboard-button");
  if (backBtn) backBtn.textContent = getTranslation("back");

  // Results count label
  var resultsCountLabel = document.querySelector(
    ".database-status-section .section-heading h3",
  );
  if (resultsCountLabel)
    resultsCountLabel.textContent = getTranslation("results");

  // Manipulate results
  var manipulateResultsTitle = document.querySelector(
    "#manipulate-view .database-status-section h3",
  );
  if (manipulateResultsTitle)
    manipulateResultsTitle.textContent = getTranslation("results");

  var responseCount = document.querySelector("#manipulate-response-count");
  if (responseCount) responseCount.textContent = "0";

  // Search input placeholder
  var searchInput = document.querySelector("#manipulate-search-input");
  if (searchInput) searchInput.placeholder = getTranslation("search");

  var valueInput = document.querySelector("#op-value-input");
  if (valueInput) valueInput.placeholder = getTranslation("filter_value");

  var attrSelect = document.querySelector(
    '#op-attribute-select option[value=""]',
  );
  if (attrSelect) attrSelect.textContent = getTranslation("select_table_first");

  var groupSelect = document.querySelector(
    '#op-groupby-select option[value=""]',
  );
  if (groupSelect) groupSelect.textContent = getTranslation("none");

  // No data message
  var noDataMsg = document.querySelector(
    "#manipulate-results-table-container p",
  );
  if (noDataMsg && !noDataMsg.querySelector("table")) {
    noDataMsg.textContent = getTranslation("select_table_to_view");
  }
}

// === INITIALISATION DE LA LANGUE ===
function initLanguage() {
  var savedLang = localStorage.getItem("app_language") || "fr";
  setLanguage(savedLang);
}

// Ajouter les écouteurs d'événements pour les boutons de langue
document.addEventListener("DOMContentLoaded", function () {
  // Initialiser la langue
  initLanguage();

  // Écouteurs pour les boutons de langue
  document.querySelectorAll(".language-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var lang = this.dataset.lang;
      setLanguage(lang);
    });
  });

  // Écouteurs pour les boutons de langue dans le menu
  document.querySelectorAll(".language-menu-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var newLang = currentLanguage === "fr" ? "en" : "fr";
      setLanguage(newLang);
    });
  });
});
