// ============================================
// CONSTANTES ET SELECTEURS
// ============================================
const setupView = document.querySelector("#setup-view");
const loginView = document.querySelector("#login-view");
const forgotPasswordView = document.querySelector("#forgot-password-view");
const dashboardView = document.querySelector("#dashboard-view");
const excelImportView = document.querySelector("#excel-import-view");
const existingDbView = document.querySelector("#existing-db-view");
const duplicatesView = document.querySelector("#duplicates-view");
const manipulateView = document.querySelector("#manipulate-view");
const createDbView = document.querySelector("#create-db-view");

const setupForm = document.querySelector("#setup-form");
const loginForm = document.querySelector("#login-form");
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

// ============================================
// ETAT GLOBAL
// ============================================
let appInitialized = false;
let apiReadyPromise = null;
let selectedExcelFilePath = "";
let selectedExcelSheetName = "";
let importInProgress = false;
let duplicateScanCancelled = false;
let currentLoggedInUser = null;
let currentDbPath = null;
let isDbOpen = false;

let forgotPasswordState = {
  step: 1,
  userId: null,
  pseudo: null,
  email: null,
};

let allDuplicates = [];
let currentDuplicatesAlgo = "general";
let selectedDuplicateTables = [];
let currentColumns = [];

let currentManipulateTable = "";
let currentManipulateData = [];
let currentManipulateFiltered = [];
let currentManipulateTotalCount = 0;
let manipulateShowResults = true;

// ✅ PAGINATION : une seule declaration
let currentManipulatePage = 1;
const MANIPULATE_PER_PAGE = 1000;
let currentDuplicatePage = 1;
const DUPLICATE_PER_PAGE = 1000;

let createDbExcelPath = "";
let createDbExcelSheets = [];
let createDbSelectedSheet = "";

let navigationHistory = [];

const FILTER_ATTRIBUTES = [
  "pole_de_developpement",
  "podev",
  "district",
  "commune",
  "fkt",
  "localite",
  "filieres",
  "opr",
  "h_f",
  "filiation_menage",
  "categorisation_eaf",
  "variete",
  "observation",
];

window._activeValueFilters = {};

let appInfoCache = null;

// ============================================
// FONCTIONS GLOBALES
// ============================================
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function pushNavigationHistory(viewName) {
  const current = navigationHistory[navigationHistory.length - 1];
  if (current !== viewName) {
    navigationHistory.push(viewName);
  }
}

function goBack() {
  if (navigationHistory.length <= 1) {
    goToDashboard();
    return;
  }
  navigationHistory.pop();
  const previousView = navigationHistory[navigationHistory.length - 1];

  switch (previousView) {
    case "dashboard":
      showView(dashboardView);
      refreshDatabaseStatus();
      break;
    case "existingDb":
      showView(existingDbView);
      loadDataDirectoryDatabases();
      updateTerminateButtonVisibility();
      setTimeout(() => restoreDbState(), 200);
      break;
    case "duplicates":
      showView(duplicatesView);
      updateTerminateButtonVisibility();
      loadDuplicateTableFilter();
      break;
    case "manipulate":
      showView(manipulateView);
      updateTerminateButtonVisibility();
      setTimeout(() => {
        loadManipulateTables().then(() => {
          if (currentManipulateTable) {
            loadManipulateTableData(
              currentManipulateTable,
              currentManipulatePage,
            );
          }
        });
      }, 200);
      break;
    case "createDb":
      showView(createDbView);
      break;
    case "excelImport":
      showView(excelImportView);
      break;
    default:
      goToDashboard();
  }
}

function showView(viewElement) {
  const allViews = document.querySelectorAll(
    "#setup-view, #login-view, #forgot-password-view, #dashboard-view, " +
      "#excel-import-view, #existing-db-view, #duplicates-view, " +
      "#manipulate-view, #create-db-view",
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
      <span>Progression : ${Math.round(percentage)}%</span>
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

function showGlobalProgress(percentage, show = true) {
  const progressBar = document.getElementById("global-progress-bar");
  const progressFill = document.getElementById("global-progress-fill");
  if (!progressBar || !progressFill) return;

  if (show) {
    progressBar.style.display = "block";
    progressFill.style.width = `${percentage}%`;
    if (percentage >= 100) {
      setTimeout(() => {
        progressBar.style.display = "none";
        progressFill.style.width = "0%";
      }, 800);
    }
  } else {
    progressBar.style.display = "none";
    progressFill.style.width = "0%";
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
        reject(new Error("API pywebview indisponible."));
        return;
      }
      setTimeout(check, 100);
    };
    check();
  });
  return apiReadyPromise;
}

function updateSelectAllButton() {
  const checkboxes = document.querySelectorAll(".dup-checkbox");
  const selectAllBtn = document.querySelector("#btn-select-all-dups");
  if (!selectAllBtn || checkboxes.length === 0) return;

  const checked = Array.from(checkboxes).filter((chk) => chk.checked).length;
  const total = checkboxes.length;

  if (checked === total) {
    selectAllBtn.textContent = "Tout deselectionner";
  } else if (checked === 0) {
    selectAllBtn.textContent = "Tout selectionner";
  } else {
    selectAllBtn.textContent = `Tout selectionner (${checked}/${total})`;
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("app_theme", theme);
}

// ============================================
// SAUVEGARDE ET RESTAURATION DE LA BASE
// ============================================
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

function updateTerminateButtonVisibility() {
  const buttons = [
    document.getElementById("btn-terminate-database-existing"),
    document.getElementById("btn-terminate-database-duplicates"),
    document.getElementById("btn-terminate-database-manipulate"),
  ];
  buttons.forEach((btn) => {
    if (btn) {
      btn.style.display = isDbOpen ? "inline-flex" : "none";
    }
  });
}

// ============================================
// GESTION DE LA SESSION
// ============================================
async function showDashboard(user) {
  if (!user) {
    showView(loginView);
    return;
  }

  // Verifier l'acceptation des CGU
  try {
    await waitForApi();
    const cguStatus = await window.pywebview.api.get_cgu_status();
    if (cguStatus && cguStatus.success && !cguStatus.accepted) {
      window.location.href = "cgu.html";
      return;
    }
  } catch (e) {
    console.error("Erreur verification CGU:", e);
  }

  currentLoggedInUser = user;
  window.lastLoggedInUser = user;
  sessionStorage.setItem("session_active", "true");
  navigationHistory = ["dashboard"];
  showView(dashboardView);

  const pseudo = user.pseudo || "";
  const greeting = document.querySelector("#welcome-message");
  const menuPseudos = document.querySelectorAll(
    "#menu-pseudo, .menu-pseudo-alt",
  );
  const menuAvatars = document.querySelectorAll(
    "#menu-avatar, .menu-avatar-alt",
  );

  if (greeting) greeting.textContent = `Bonjour, ${pseudo}`;
  menuPseudos.forEach((el) => {
    if (el) el.textContent = pseudo;
  });
  menuAvatars.forEach((el) => {
    if (el) el.textContent = getInitials(pseudo);
  });

  refreshDatabaseStatus();
  loadUserActivities();
  updateFooterVersion();
}
function goToDashboard() {
  saveCurrentDbState();
  navigationHistory = ["dashboard"];
  if (window.lastLoggedInUser) {
    showDashboard(window.lastLoggedInUser);
  } else {
    showView(dashboardView);
    refreshDatabaseStatus();
  }
  setTimeout(() => restoreDbState(), 100);
}

function goToExistingDb() {
  saveCurrentDbState();
  pushNavigationHistory("existingDb");
  showView(existingDbView);
  loadDataDirectoryDatabases();
  updateTerminateButtonVisibility();
  setTimeout(() => restoreDbState(), 200);
}

function goToDuplicates() {
  if (!isDbOpen) {
    showNotification("Veuillez d'abord ouvrir une base de donnees.", false);
    return;
  }
  saveCurrentDbState();
  pushNavigationHistory("duplicates");
  showView(duplicatesView);
  updateTerminateButtonVisibility();
  loadDuplicateTableFilter();
}

function resetDuplicateView() {
  allDuplicates = [];
  currentColumns = [];
  selectedDuplicateTables = [];
  currentDuplicatePage = 1;

  const resultsContainer = document.getElementById("dup-results-container");
  if (resultsContainer) resultsContainer.classList.add("hidden");
  const resultsContent = document.getElementById("db-results-content");
  if (resultsContent) resultsContent.innerHTML = "";
  const countBadge = document.getElementById("dup-results-count");
  if (countBadge) countBadge.textContent = "0";
  const statusDiv = document.getElementById("dup-scan-status");
  if (statusDiv)
    statusDiv.textContent =
      'Selectionnez un algorithme et cliquez sur "Lancer l\'analyse"';
}

// ============================================
// MOT DE PASSE OUBLIE
// ============================================
function resetForgotPasswordUI() {
  forgotPasswordState = { step: 1, userId: null, pseudo: null, email: null };
  
  const s1 = document.getElementById("forgot-step-email");
  const s2 = document.getElementById("forgot-step-code");
  const s3 = document.getElementById("forgot-step-password");
  if (s1) s1.classList.remove("hidden");
  if (s2) s2.classList.add("hidden");
  if (s3) s3.classList.add("hidden");
  
  const emailInput = document.getElementById("forgot-email-input");
  const codeInput = document.getElementById("forgot-code-input");
  const pwdInput = document.getElementById("forgot-new-password");
  const pwdConfirm = document.getElementById("forgot-confirm-password");
  if (emailInput) emailInput.value = "";
  if (codeInput) codeInput.value = "";
  if (pwdInput) pwdInput.value = "";
  if (pwdConfirm) pwdConfirm.value = "";
  
  const title = document.getElementById("forgot-title");
  const subtitle = document.getElementById("forgot-subtitle");
  if (title) title.textContent = "Mot de passe oublie";
  if (subtitle) subtitle.textContent =
    "Saisissez votre email pour recevoir un code de validation.";
  
  showMessage("#forgot-message", "");
}

function showForgotPasswordView() {
  resetForgotPasswordUI();
  showView(forgotPasswordView);
  setTimeout(() => {
    document.getElementById("forgot-email-input")?.focus();
  }, 100);
}

function cancelForgotPassword() {
  resetForgotPasswordUI();
  showView(loginView);
}



async function handleForgotEmailSubmit(e) {
  e.preventDefault();
  const email = document.getElementById("forgot-email-input")?.value.trim();
  if (!email) {
    showMessage("#forgot-message", "Veuillez saisir votre email.");
    return;
  }
  try {
    await waitForApi();
    const result = await window.pywebview.api.request_password_reset(email);
    if (!result || !result.success) {
      showMessage("#forgot-message", result?.message || "Erreur.");
      return;
    }

    forgotPasswordState.step = 2;
    forgotPasswordState.userId = result.user_id;
    forgotPasswordState.pseudo = result.pseudo;
    forgotPasswordState.email = email;

    document.getElementById("forgot-step-email")?.classList.add("hidden");
    document.getElementById("forgot-step-code")?.classList.remove("hidden");

    const title = document.getElementById("forgot-title");
    const subtitle = document.getElementById("forgot-subtitle");
    const userName = document.getElementById("forgot-user-name");
    if (title) title.textContent = "Code de validation";
    if (subtitle)
      subtitle.textContent =
        "Notez ce code soigneusement, il ne sera plus affiche.";
    if (userName) userName.textContent = `Utilisateur : ${result.pseudo}`;

    // Afficher le code dans un encadre bien visible
    showValidationCodeBox(result.code);

    showMessage("#forgot-message", "Email verifie. Code genere.", true);
    setTimeout(() => {
      document.getElementById("forgot-code-input")?.focus();
    }, 100);
  } catch (err) {
    console.error(err);
    showMessage("#forgot-message", "Erreur de communication.");
  }
}

async function handleForgotEmailSubmit(e) {
  e.preventDefault();
  const email = document.getElementById("forgot-email-input")?.value.trim();
  if (!email) {
    showMessage("#forgot-message", "Veuillez saisir votre email.");
    return;
  }
  try {
    await waitForApi();
    const result = await window.pywebview.api.request_password_reset(email);
    console.log("[FORGOT] result =", result);
    
    if (!result || !result.success) {
      showMessage("#forgot-message", result?.message || "Erreur.");
      return;
    }
    
    forgotPasswordState.step = 2;
    forgotPasswordState.userId = result.user_id;
    forgotPasswordState.pseudo = result.pseudo;
    forgotPasswordState.email = email;
    
    // Cacher l'étape 1, montrer l'étape 2
    document.getElementById("forgot-step-email")?.classList.add("hidden");
    document.getElementById("forgot-step-code")?.classList.remove("hidden");
    
    // Titres
    const title = document.getElementById("forgot-title");
    const subtitle = document.getElementById("forgot-subtitle");
    const userName = document.getElementById("forgot-user-name");
    if (title) title.textContent = "Code de validation";
    if (subtitle) subtitle.textContent =
      "Notez le code ci-dessous soigneusement, il ne sera plus affiche.";
    if (userName) userName.textContent = `Utilisateur : ${result.pseudo}`;
    
    // ⭐⭐⭐ AFFICHER LE CODE ⭐⭐⭐
    console.log("[FORGOT] Appel showValidationCodeBox avec :", result.code);
    showValidationCodeBox(result.code);
    
    showMessage("#forgot-message", "Email verifie. Code genere.", true);
    setTimeout(() => {
      document.getElementById("forgot-code-input")?.focus();
    }, 100);
  } catch (err) {
    console.error("[FORGOT] Exception :", err);
    showMessage("#forgot-message", "Erreur de communication.");
  }
}

async function handleForgotEmailSubmit(e) {
  e.preventDefault();
  const email = document.getElementById("forgot-email-input")?.value.trim();
  if (!email) {
    showMessage("#forgot-message", "Veuillez saisir votre email.");
    return;
  }
  try {
    await waitForApi();
    const result = await window.pywebview.api.request_password_reset(email);
    if (!result || !result.success) {
      showMessage("#forgot-message", result?.message || "Erreur.");
      return;
    }
    
    forgotPasswordState.step = 2;
    forgotPasswordState.userId = result.user_id;
    forgotPasswordState.pseudo = result.pseudo;
    forgotPasswordState.email = email;
    
    // Cacher l'etape 1, montrer l'etape 2
    document.getElementById("forgot-step-email")?.classList.add("hidden");
    document.getElementById("forgot-step-code")?.classList.remove("hidden");
    
    // Titres
    const title = document.getElementById("forgot-title");
    const subtitle = document.getElementById("forgot-subtitle");
    const userName = document.getElementById("forgot-user-name");
    if (title) title.textContent = "Verification du code";
    if (subtitle) subtitle.textContent =
      "Un code a ete envoye a votre adresse email. Verifiez votre boite de reception (et vos spams).";
    if (userName) userName.textContent = `Utilisateur : ${result.pseudo}`;
    
    showMessage("#forgot-message", result.message, true);
    setTimeout(() => {
      document.getElementById("forgot-code-input")?.focus();
    }, 100);
  } catch (err) {
    console.error(err);
    showMessage("#forgot-message", "Erreur de communication.");
  }
}

// ============================================
// SUPPRESSION DE BASE DE DONNEES
// ============================================
async function deleteSelectedDatabase() {
  const selectEl = document.getElementById("db-file-select");
  if (!selectEl || !selectEl.value) {
    showNotification("Veuillez d'abord selectionner une base.", false);
    return;
  }
  const dbPath = selectEl.value;
  const fileName = selectEl.options[selectEl.selectedIndex]?.text || dbPath;

  if (
    !confirm(
      `ATTENTION : Suppression definitive\n\n` +
        `Voulez-vous vraiment supprimer la base :\n"${fileName}" ?\n\n` +
        `Cette action est IRREVERSIBLE.\nToutes les tables et donnees seront perdues.`,
    )
  )
    return;

  try {
    await waitForApi();
    const openedPath = sessionStorage.getItem("current_db_path");
    if (openedPath && openedPath === dbPath && isDbOpen) {
      try {
        await window.pywebview.api.terminate_database();
      } catch (e) {}
      isDbOpen = false;
      currentDbPath = null;
      sessionStorage.removeItem("current_db_path");
      sessionStorage.removeItem("current_db_name");
      updateTerminateButtonVisibility();
      const actionsPanel = document.getElementById("db-actions-panel");
      if (actionsPanel) actionsPanel.classList.add("hidden");
      const tablesContainer = document.getElementById(
        "database-tables-container-existing",
      );
      if (tablesContainer) {
        tablesContainer.innerHTML = "";
        tablesContainer.classList.add("hidden");
      }
    }

    showGlobalProgress(30, true);
    const result = await window.pywebview.api.delete_database(dbPath);
    showGlobalProgress(100, true);

    if (result && result.success) {
      showNotification(result.message || "Base supprimee avec succes.", true);
      logUserAction(`Suppression de la base : ${result.db_name || fileName}`);
      selectEl.value = "";
      const label = document.getElementById("selected-db-path-label");
      if (label) {
        label.textContent = "Aucune base selectionnee";
        label.style.color = "var(--text-color, gray)";
        label.style.fontStyle = "italic";
        label.style.fontWeight = "normal";
      }
      await loadDataDirectoryDatabases();
    } else {
      showNotification(
        result?.message || "Erreur lors de la suppression.",
        false,
      );
    }
  } catch (err) {
    console.error("Erreur suppression base:", err);
    showNotification("Erreur lors de la suppression de la base.", false);
  }
}

// ============================================
// SUPPRESSION DE TABLE
// ============================================
async function deleteSelectedTable(tableName) {
  if (!tableName) {
    showNotification("Aucune table a supprimer.", false);
    return;
  }
  if (
    !confirm(
      `ATTENTION : Suppression definitive\n\n` +
        `Voulez-vous vraiment supprimer la table :\n"${tableName}" ?\n\n` +
        `Toutes les donnees de cette table seront perdues.\nCette action est IRREVERSIBLE.`,
    )
  )
    return;

  try {
    await waitForApi();
    const activeDbPath = sessionStorage.getItem("current_db_path");
    showGlobalProgress(30, true);
    const result = await window.pywebview.api.delete_table(
      tableName,
      activeDbPath,
    );
    showGlobalProgress(100, true);

    if (result && result.success) {
      showNotification(
        result.message || `Table "${tableName}" supprimee.`,
        true,
      );
      logUserAction(`Suppression de la table : ${tableName}`);
      if (currentManipulateTable === tableName) {
        currentManipulateTable = "";
        currentManipulateData = [];
        currentManipulateFiltered = [];
        currentManipulatePage = 1;
        const container = document.querySelector(
          "#manipulate-results-table-container",
        );
        if (container) {
          container.innerHTML =
            "<p style='color: gray'>Veuillez selectionner une table pour afficher les donnees.</p>";
        }
        await loadManipulateTables();
      }
      const toggleChecked = document.getElementById(
        "toggle-show-tables-list",
      )?.checked;
      if (toggleChecked && activeDbPath) {
        await loadDatabaseDetails(activeDbPath);
      }
      await loadDuplicateTableFilter();
    } else {
      showNotification(
        result?.message || "Erreur lors de la suppression de la table.",
        false,
      );
    }
  } catch (err) {
    console.error("Erreur suppression table:", err);
    showNotification("Erreur lors de la suppression de la table.", false);
  }
}

// ============================================
// TERMINER LA BASE DE DONNEES
// ============================================
async function terminateDatabase() {
  if (!isDbOpen) {
    showNotification("Aucune base de donnees n'est ouverte.", false);
    return;
  }
  if (
    !confirm(
      "Voulez-vous vraiment terminer l'utilisation de cette base de donnees ?\n\nVous pourrez en ouvrir une autre apres.",
    )
  )
    return;

  try {
    await waitForApi();
    const result = await window.pywebview.api.terminate_database();

    if (result && result.success) {
      isDbOpen = false;
      currentDbPath = null;
      currentManipulateTable = "";
      currentManipulateData = [];
      currentManipulateFiltered = [];
      currentManipulatePage = 1;

      const label = document.getElementById("selected-db-path-label");
      if (label) {
        label.textContent = "Aucune base selectionnee";
        label.style.color = "var(--text-color, gray)";
        label.style.fontWeight = "normal";
      }
      const selectEl = document.getElementById("db-file-select");
      if (selectEl) selectEl.value = "";
      const actionsPanel = document.getElementById("db-actions-panel");
      if (actionsPanel) actionsPanel.classList.add("hidden");
      updateTerminateButtonVisibility();
      const tablesContainer = document.getElementById(
        "database-tables-container-existing",
      );
      if (tablesContainer) {
        tablesContainer.innerHTML = "";
        tablesContainer.classList.add("hidden");
      }
      const resultsContainer = document.getElementById("dup-results-container");
      if (resultsContainer) resultsContainer.classList.add("hidden");

      allDuplicates = [];
      currentColumns = [];
      selectedDuplicateTables = [];
      window._activeValueFilters = {};

      showNotification(result.message || "Base de donnees terminee.", true);
      logUserAction(`Terminer la base : ${result.closed_db || "inconnue"}`);
    } else {
      showNotification(
        result?.message || "Erreur lors de la fermeture.",
        false,
      );
    }
  } catch (err) {
    console.error("Erreur lors de la fermeture de la base:", err);
    showNotification("Erreur lors de la fermeture de la base.", false);
  }
}

// ============================================
// DECONNEXION
// ============================================
async function logoutUser() {
  try {
    await waitForApi();
    const result = await window.pywebview.api.logout();

    if (result && result.success) {
      sessionStorage.removeItem("session_active");
      sessionStorage.removeItem("current_db_path");
      sessionStorage.removeItem("current_db_name");
      currentLoggedInUser = null;
      window.lastLoggedInUser = null;
      isDbOpen = false;
      navigationHistory = [];
      currentManipulateTable = "";
      currentManipulateData = [];
      currentManipulateFiltered = [];
      currentManipulatePage = 1;

      document
        .querySelectorAll(".user-menu")
        .forEach((menu) => menu.classList.add("hidden"));
      document
        .querySelectorAll(".menu-button")
        .forEach((btn) => btn.setAttribute("aria-expanded", "false"));
      updateTerminateButtonVisibility();

      showView(loginView);
      showNotification("Deconnexion reussie.", true);
    } else {
      const errorType = result?.error_type;
      if (errorType === "database_still_open") {
        showNotification(
          "Une base de donnees est encore ouverte. Cliquez sur 'Terminer' avant de vous deconnecter.",
          false,
        );
        setTimeout(() => {
          alert(
            "Impossible de se deconnecter\n\nUne base de donnees est encore ouverte.\n\nVeuillez cliquer sur 'Terminer la base' pour fermer avant de vous deconnecter.",
          );
        }, 100);
      } else if (errorType === "operation_in_progress") {
        showNotification(
          "Une operation est en cours. Veuillez patienter avant de vous deconnecter.",
          false,
        );
      } else {
        showNotification(
          result?.message || "Erreur lors de la deconnexion.",
          false,
        );
      }
    }
  } catch (error) {
    console.error("Erreur lors de la deconnexion:", error);
    showNotification("Erreur lors de la deconnexion.", false);
  }
}

// ============================================
// INITIALISATION
// ============================================
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
        showDashboard({ pseudo: "Utilisateur" });
      }
    }
  } catch (error) {
    console.error(error);
    showView(loginView);
    showMessage(
      "#login-message",
      "Impossible de communiquer avec l'application.",
    );
  }
}

// ============================================
// IMPORTATION EXCEL
// ============================================
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
    selectedExcelFileElement.textContent = "Aucun fichier selectionne";
  if (excelSheetContainer) excelSheetContainer.classList.add("hidden");
  if (excelSheetSelect) {
    excelSheetSelect.innerHTML =
      '<option value="">Selectionnez une feuille</option>';
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
      if (result?.message !== "Aucun fichier selectionne.") {
        showMessage(
          "#excel-import-message",
          result?.message || "Impossible de selectionner le fichier.",
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
    showMessage(
      "#excel-import-message",
      "Impossible de selectionner le fichier Excel.",
    );
  }
}

async function loadExcelSheets() {
  const result = await window.pywebview.api.get_excel_sheets(
    selectedExcelFilePath,
  );
  if (!result?.success || !Array.isArray(result.sheets)) {
    showMessage(
      "#excel-import-message",
      result?.message || "Impossible de lire les feuilles Excel.",
    );
    return;
  }
  excelSheetSelect.innerHTML =
    '<option value="">Selectionnez une feuille (optionnel)</option>';
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
        result?.message || "Impossible de generer l'apercu.",
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
    showMessage(
      "#excel-import-message",
      "Impossible de lire la feuille selectionnee.",
    );
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
    excelPreviewCount.textContent = "Aucune colonne detectee";
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
      header !== null && header !== undefined ? header : "Colonne sans nom",
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
  excelPreviewCount.textContent = `${headersArray.length} colonne(s) identifiee(s)`;
  excelImportActions.classList.remove("hidden");
  updateImportButtonState();
}

async function importExcelIntoDatabase() {
  if (!selectedExcelFilePath) {
    showMessage(
      "#excel-import-message",
      "Veuillez selectionner un fichier Excel.",
    );
    return;
  }
  const tableName = excelTableNameInput.value.trim();
  if (!tableName) {
    showMessage("#excel-import-message", "Veuillez entrer un nom de table.");
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
    "Import et conversion SQLite en cours...",
    progress,
    true,
  );
  showGlobalProgress(progress, true);

  const progressInterval = setInterval(() => {
    progress = Math.min(95, progress + (95 - progress) * 0.1);
    showNotificationWithProgress(
      "Import et conversion SQLite en cours...",
      progress,
      true,
    );
    showGlobalProgress(progress, true);
  }, 500);

  try {
    const result = await window.pywebview.api.import_excel_to_database(
      selectedExcelFilePath,
      selectedExcelSheetName || null,
      tableName,
    );
    clearInterval(progressInterval);
    showNotificationWithProgress("Conversion terminee avec succes.", 100, true);
    showGlobalProgress(100, true);

    if (!result?.success) {
      showMessage(
        "#excel-import-message",
        result?.message || "Echec de l'import.",
      );
      return;
    }
    showMessage(
      "#excel-import-message",
      result.message || "Fichier converti avec succes.",
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
    showMessage(
      "#excel-import-message",
      "Impossible d'effectuer la conversion.",
    );
  } finally {
    importInProgress = false;
    if (selectExcelFileButton) selectExcelFileButton.disabled = false;
    if (excelSheetSelect) excelSheetSelect.disabled = false;
    if (excelTableNameInput) excelTableNameInput.disabled = false;
    updateImportButtonState();
  }
}

// ============================================
// CREATION DE BASE DE DONNEES
// ============================================
function resetCreateDbView() {
  createDbExcelPath = "";
  createDbExcelSheets = [];
  createDbSelectedSheet = "";
  const fileLabel = document.getElementById("create-db-selected-file");
  if (fileLabel) fileLabel.textContent = "Aucun fichier selectionne";
  const dbNameInput = document.getElementById("create-db-name");
  if (dbNameInput) dbNameInput.value = "";
  const tableNameInput = document.getElementById("create-db-table-name");
  if (tableNameInput) tableNameInput.value = "donnees";
  const sheetContainer = document.getElementById("create-db-sheet-container");
  if (sheetContainer) sheetContainer.classList.add("hidden");
  const sheetSelect = document.getElementById("create-db-sheet-select");
  if (sheetSelect) {
    sheetSelect.innerHTML =
      '<option value="">Selectionnez une feuille</option>';
  }
  const messageEl = document.getElementById("create-db-message");
  if (messageEl) messageEl.textContent = "";
  const exportSection = document.getElementById("create-db-export-section");
  if (exportSection) exportSection.classList.add("hidden");
}

async function selectCreateDbExcelFile() {
  try {
    await waitForApi();
    const result = await window.pywebview.api.select_excel_file();
    if (!result?.success) {
      if (result?.message !== "Aucun fichier selectionne.") {
        showMessage(
          "#create-db-message",
          result?.message || "Impossible de selectionner le fichier.",
        );
      }
      return;
    }
    createDbExcelPath = result.file_path;
    const fileLabel = document.getElementById("create-db-selected-file");
    if (fileLabel) fileLabel.textContent = createDbExcelPath;

    const fileName = createDbExcelPath
      .split("/")
      .pop()
      .split("\\")
      .pop()
      .split(".")[0];
    const dbNameInput = document.getElementById("create-db-name");
    if (dbNameInput && !dbNameInput.value) {
      dbNameInput.value = fileName.toLowerCase().replace(/[^a-z0-9]/g, "_");
    }

    const sheetsResult =
      await window.pywebview.api.get_excel_sheets(createDbExcelPath);
    if (sheetsResult?.success && Array.isArray(sheetsResult.sheets)) {
      createDbExcelSheets = sheetsResult.sheets;
      const sheetContainer = document.getElementById(
        "create-db-sheet-container",
      );
      const sheetSelect = document.getElementById("create-db-sheet-select");
      if (sheetSelect) {
        sheetSelect.innerHTML =
          '<option value="">-- Toutes les feuilles --</option>';
        sheetsResult.sheets.forEach((sheet) => {
          const option = document.createElement("option");
          option.value = sheet;
          option.textContent = sheet;
          sheetSelect.appendChild(option);
        });
      }
      if (sheetContainer) sheetContainer.classList.remove("hidden");
    }
    showMessage("#create-db-message", "Fichier selectionne avec succes.", true);
  } catch (error) {
    console.error(error);
    showMessage(
      "#create-db-message",
      "Impossible de selectionner le fichier Excel.",
    );
  }
}

async function createDatabaseFromExcel() {
  if (!createDbExcelPath) {
    showMessage(
      "#create-db-message",
      "Veuillez selectionner un fichier Excel.",
    );
    return;
  }
  const dbNameInput = document.getElementById("create-db-name");
  const dbName = dbNameInput?.value.trim();
  if (!dbName) {
    showMessage("#create-db-message", "Veuillez entrer un nom de base.");
    dbNameInput?.focus();
    return;
  }
  showGlobalProgress(20, true);
  try {
    await waitForApi();
    const result = await window.pywebview.api.create_database_from_excel(
      createDbExcelPath,
      dbName,
    );
    showGlobalProgress(80, true);

    if (result?.success) {
      showGlobalProgress(100, true);
      showMessage(
        "#create-db-message",
        result.message || "Base de donnees creee avec succes.",
        true,
      );
      const exportSection = document.getElementById("create-db-export-section");
      if (exportSection) exportSection.classList.remove("hidden");
      window._createdDbPath = result.db_path;
      showNotification("Base de donnees creee avec succes.", true);
      logUserAction(`Creation de la base : ${result.db_name}`);
      loadDataDirectoryDatabases();
    } else {
      showGlobalProgress(0, false);
      showMessage(
        "#create-db-message",
        result?.message || "Erreur lors de la creation.",
      );
    }
  } catch (error) {
    showGlobalProgress(0, false);
    console.error(error);
    showMessage("#create-db-message", "Erreur lors de la creation.");
  }
}

async function createEmptyDatabase() {
  const dbNameInput = document.getElementById("create-db-name");
  const tableNameInput = document.getElementById("create-db-table-name");
  const dbName = dbNameInput?.value.trim();
  const tableName = tableNameInput?.value.trim() || "donnees";
  if (!dbName) {
    showMessage("#create-db-message", "Veuillez entrer un nom de base.");
    dbNameInput?.focus();
    return;
  }
  showGlobalProgress(30, true);
  try {
    await waitForApi();
    const result = await window.pywebview.api.create_new_database(
      dbName,
      tableName,
    );
    showGlobalProgress(100, true);

    if (result?.success) {
      showMessage(
        "#create-db-message",
        result.message || "Base de donnees creee avec succes.",
        true,
      );
      const exportSection = document.getElementById("create-db-export-section");
      if (exportSection) exportSection.classList.remove("hidden");
      window._createdDbPath = result.db_path;
      showNotification("Base de donnees creee avec succes.", true);
      logUserAction(`Creation de la base vide : ${result.db_name}`);
      loadDataDirectoryDatabases();
    } else {
      showGlobalProgress(0, false);
      showMessage(
        "#create-db-message",
        result?.message || "Erreur lors de la creation.",
      );
    }
  } catch (error) {
    showGlobalProgress(0, false);
    console.error(error);
    showMessage("#create-db-message", "Erreur lors de la creation.");
  }
}

async function exportCreatedDatabaseToExcel() {
  if (!window._createdDbPath) {
    showNotification("Aucune base a exporter.", false);
    return;
  }
  try {
    await waitForApi();
    const saveResult = await window.pywebview.api.select_excel_save_file();
    if (!saveResult || !saveResult.success) return;
    showGlobalProgress(30, true);
    const result =
      await window.pywebview.api.export_database_to_excel_from_path(
        window._createdDbPath,
        saveResult.file_path,
      );
    showGlobalProgress(100, true);
    if (result?.success) {
      showNotification(`Excel exporte : ${saveResult.file_path}`, true);
      logUserAction(`Export de la base creee vers Excel`);
    } else {
      showNotification(result?.message || "Erreur lors de l'export.", false);
    }
  } catch (error) {
    console.error(error);
    showNotification("Erreur lors de l'export Excel.", false);
  }
}

// ============================================
// AFFICHAGE DES BASES DE DONNEES
// ============================================
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
        info.name || info.database_name || info.filename || "Base SQLite";
    if (path) path.textContent = info.path || info.database_path || "-";

    const structRes =
      await window.pywebview.api.get_database_structure_matrix();
    if (structRes?.success) {
      renderDatabaseStructureMatrix(
        structRes.structure || {},
        document.querySelector("#database-tables-container"),
      );
    }
  } catch (error) {
    console.error("Erreur lors du rafraichissement:", error);
  }
}

function renderDatabaseStructureMatrix(structure, containerElement) {
  if (!containerElement) return;
  containerElement.replaceChildren();
  const tables = Object.keys(structure);
  if (tables.length === 0) {
    containerElement.textContent = "Aucune table dans cette base de donnees.";
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

    const headerRow = document.createElement("div");
    headerRow.style.display = "flex";
    headerRow.style.gap = "0.5rem";
    headerRow.style.alignItems = "stretch";

    const tableButton = document.createElement("button");
    tableButton.type = "button";
    tableButton.className = "button button-primary";
    tableButton.style.display = "flex";
    tableButton.style.justifyContent = "space-between";
    tableButton.style.alignItems = "center";
    tableButton.style.flex = "1";
    tableButton.style.padding = "0.75rem 1rem";
    tableButton.style.textAlign = "left";
    tableButton.style.borderRadius = "6px";
    tableButton.style.cursor = "pointer";

    const titleSpan = document.createElement("span");
    titleSpan.innerHTML = `<i class="fas fa-table" style="margin-right: 8px;"></i> ${escapeHtml(tableName)} <small style="opacity: 0.8; font-weight: normal;">(${columns.length} attributs)</small>`;

    const arrowSpan = document.createElement("i");
    arrowSpan.className = "fas fa-chevron-down";

    tableButton.appendChild(titleSpan);
    tableButton.appendChild(arrowSpan);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn-delete-table";
    deleteBtn.title = `Supprimer la table "${tableName}"`;
    deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Supprimer';
    deleteBtn.style.padding = "0 14px";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSelectedTable(tableName);
    });

    headerRow.appendChild(tableButton);
    headerRow.appendChild(deleteBtn);

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
      emptySpan.textContent = "Aucun attribut";
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

    tableGroupEl.appendChild(headerRow);
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
  container.innerHTML = "<p>Chargement de la structure des tables...</p>";

  try {
    await waitForApi();
    const structRes =
      await window.pywebview.api.get_database_structure_matrix(filePath);
    if (structRes && structRes.success === true && structRes.structure) {
      const tables = Object.keys(structRes.structure);
      if (tables.length === 0) {
        container.innerHTML =
          "<p>La base de donnees ne contient aucune table utilisateur.</p>";
      } else {
        renderDatabaseStructureMatrix(structRes.structure, container);
      }
      if (actionsPanel) actionsPanel.classList.remove("hidden");
    } else {
      container.innerHTML = `<p style="color: red;">${escapeHtml(structRes?.message || "Erreur de chargement.")}</p>`;
    }
  } catch (error) {
    console.error("Erreur lors du chargement de la base:", error);
    container.innerHTML = `<p style="color: red;">Erreur : ${escapeHtml(error.message)}</p>`;
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
        '<option value="">-- Selectionnez une base existante --</option>';
      res.databases.forEach((db) => {
        const opt = document.createElement("option");
        opt.value = db.path;
        opt.textContent = `${db.name} (${db.size_kb} Ko)`;
        selectEl.appendChild(opt);
      });
      if (container) container.classList.remove("hidden");
    } else {
      if (container) container.classList.add("hidden");
    }
  } catch (e) {
    console.error("Erreur lors de la liste des bases depuis data:", e);
  }
}

// ============================================
// OUVRIR UNE BASE
// ============================================
async function openSelectedDatabase() {
  const selectEl = document.getElementById("db-file-select");
  const filePath = selectEl?.value;
  if (!filePath) {
    showNotification("Veuillez selectionner une base de donnees.", false);
    return;
  }
  try {
    await waitForApi();
    const result = await window.pywebview.api.open_database_path(filePath);
    if (result && result.success) {
      isDbOpen = true;
      currentDbPath = filePath;

      // ✅ SAUVEGARDER le chemin dans sessionStorage (crucial pour l'export)
      sessionStorage.setItem("current_db_path", filePath);
      console.log("[DB] Base ouverte, chemin sauvegarde :", filePath);

      const fileName = filePath.split("/").pop().split("\\").pop();
      const label = document.getElementById("selected-db-path-label");
      if (label) {
        label.textContent = `${fileName} (ouverte)`;
        label.style.color = "var(--success-color, #27ae60)";
        label.style.fontWeight = "600";
      }
      const actionsPanel = document.getElementById("db-actions-panel");
      if (actionsPanel) actionsPanel.classList.remove("hidden");
      updateTerminateButtonVisibility();
      const toggleChecked = document.getElementById(
        "toggle-show-tables-list",
      )?.checked;
      if (toggleChecked) {
        await loadDatabaseDetails(filePath);
      }
      showNotification(
        `Base de donnees "${fileName}" ouverte avec succes.`,
        true,
      );
      logUserAction(`Ouverture de la base : ${fileName}`);
    } else {
      showNotification(
        result?.message || "Erreur lors de l'ouverture de la base.",
        false,
      );
    }
  } catch (err) {
    console.error("Erreur lors de l'ouverture de la base:", err);
    showNotification("Erreur lors de l'ouverture de la base.", false);
  }
}

// ============================================
// CREATION DES LISTES MERES
// ============================================
async function createMasterList() {
  if (!isDbOpen) {
    showNotification("Veuillez d'abord ouvrir une base de donnees.", false);
    return;
  }
  if (
    !confirm(
      "Voulez-vous creer la liste mere ?\n\n" +
        "Cette operation va :\n" +
        "- Scanner toutes les tables de la base\n" +
        "- Copier TOUTES les lignes (sans dedoublonnage)\n" +
        "- Ajouter les colonnes 'source_table' et 'ligne_origine'\n" +
        "- Ignorer les lignes sans nom et prenoms\n\n" +
        "Continuer ?",
    )
  )
    return;

  showGlobalProgress(20, true);
  showNotificationWithProgress(
    "Creation de la liste mere en cours...",
    30,
    true,
  );

  try {
    await waitForApi();
    const activeDbPath = sessionStorage.getItem("current_db_path");
    const result = await window.pywebview.api.create_master_list(activeDbPath);

    showGlobalProgress(100, true);
    showNotificationWithProgress("Liste mere creee !", 100, true);

    if (result?.success) {
      let msg = result.message || "Liste mere creee avec succes.";
      showNotification(msg, true);
      logUserAction(
        `Creation de la liste mere : ${result.total_persons} personne(s)`,
      );
      const toggleChecked = document.getElementById(
        "toggle-show-tables-list",
      )?.checked;
      if (toggleChecked) {
        await loadDatabaseDetails(activeDbPath);
      }
    } else {
      showNotification(
        result?.message || "Erreur lors de la creation de la liste mere.",
        false,
      );
    }
  } catch (error) {
    showGlobalProgress(0, false);
    console.error(error);
    showNotification("Erreur lors de la creation de la liste mere.", false);
  }
}

// ============================================
// ACTIVITES UTILISATEUR
// ============================================
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
                  (${escapeHtml(act.user || "Utilisateur")})
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
    console.error("Erreur lors du chargement des activites:", e);
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
    console.error("Erreur lors de l'enregistrement de l'action:", err);
  }
}

// ============================================
// BOITE DE DIALOGUE D'EXPORT
// ============================================
function showExportDialog(onExport) {
  const overlay = document.createElement("div");
  overlay.className = "export-dialog-overlay";
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(5px);
    z-index: 99999; display: flex; justify-content: center; align-items: center;
  `;
  overlay.innerHTML = `
    <div style="background: #ffffff; border-radius: 12px; padding: 2rem; max-width: 400px; width: 90%; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); text-align: center;">
      <h3 style="margin: 0 0 0.5rem 0; color: #1a1a2e;"><i class="fas fa-file-export"></i> Exporter</h3>
      <p style="color: #64748b; margin-bottom: 1.5rem;">Choisissez le format d'exportation :</p>
      <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
        <button data-format="pdf" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.95rem; background: #c0392b; color: white;">
          <i class="fas fa-file-pdf"></i> PDF
        </button>
        <button data-format="excel" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.95rem; background: #27ae60; color: white;">
          <i class="fas fa-file-excel"></i> Excel
        </button>
        <button data-format="cancel" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.95rem; background: #6c757d; color: white;">
          <i class="fas fa-times"></i> Annuler
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const format = btn.dataset.format;
      overlay.remove();
      if (format !== "cancel" && typeof onExport === "function") {
        onExport(format);
      }
    });
  });
}

// ============================================
// MODAL DE MODIFICATION / AJOUT
// ============================================
function openEditModal(tableName, rowId, rowData, isNew = false) {
  const overlay = document.createElement("div");
  overlay.className = "edit-modal-overlay";

  let formFields = "";
  Object.keys(rowData).forEach((key) => {
    if (key === "rowid" || key === "id") {
      if (isNew) return;
    }
    const value =
      rowData[key] === null || rowData[key] === undefined
        ? ""
        : String(rowData[key]);
    formFields += `
      <div class="form-group">
        <label for="edit-field-${escapeHtml(key)}">${escapeHtml(key)}</label>
        <input type="text" id="edit-field-${escapeHtml(key)}" data-column="${escapeHtml(key)}" value="${escapeHtml(value)}" />
      </div>
    `;
  });

  const title = isNew ? "Ajouter une ligne" : `Modifier la ligne #${rowId}`;

  overlay.innerHTML = `
    <div class="edit-modal-box">
      <h3><i class="fas fa-${isNew ? "plus" : "edit"}" style="color: ${isNew ? "#27ae60" : "#f39c12"};"></i> ${title}</h3>
      <p style="color: #64748b; font-size: 0.85rem; margin-bottom: 1rem;">
        Table : <strong>${escapeHtml(tableName)}</strong>
      </p>
      <div id="edit-form-fields">${formFields}</div>
      <div class="modal-actions">
        <button class="btn-cancel" id="btn-cancel-edit">Annuler</button>
        <button class="btn-save" id="btn-save-edit">
          <i class="fas fa-save"></i> ${isNew ? "Ajouter" : "Enregistrer"}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();
  overlay
    .querySelector("#btn-cancel-edit")
    .addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  overlay
    .querySelector("#btn-save-edit")
    .addEventListener("click", async () => {
      const inputs = overlay.querySelectorAll("#edit-form-fields input");

      if (isNew) {
        const values = {};
        inputs.forEach((input) => {
          const col = input.getAttribute("data-column");
          if (input.value && input.value.trim() !== "") {
            values[col] = input.value;
          }
        });
        if (Object.keys(values).length === 0) {
          showNotification("Veuillez remplir au moins un champ.", false);
          return;
        }
        try {
          await waitForApi();
          const activeDbPath = sessionStorage.getItem("current_db_path");
          showGlobalProgress(50, true);
          const res = await window.pywebview.api.insert_table_row(
            tableName,
            values,
            activeDbPath,
          );
          showGlobalProgress(100, true);
          if (res && res.success) {
            showNotification("Ligne ajoutee avec succes.", true);
            logUserAction(`Ajout d'une ligne dans ${tableName}`);
            closeModal();
            if (currentManipulateTable === tableName) {
              await loadManipulateTableData(tableName, currentManipulatePage);
            }
          } else {
            showNotification(res?.message || "Erreur lors de l'ajout.", false);
          }
        } catch (e) {
          console.error(e);
          showNotification("Erreur lors de l'ajout.", false);
        }
      } else {
        const updates = {};
        inputs.forEach((input) => {
          const col = input.getAttribute("data-column");
          const newValue = input.value;
          const oldValue =
            rowData[col] === null || rowData[col] === undefined
              ? ""
              : String(rowData[col]);
          if (newValue !== oldValue) {
            updates[col] = newValue;
          }
        });
        if (Object.keys(updates).length === 0) {
          showNotification("Aucune modification a enregistrer.", false);
          return;
        }
        try {
          await waitForApi();
          const activeDbPath = sessionStorage.getItem("current_db_path");
          showGlobalProgress(50, true);
          let successCount = 0;
          for (const [col, val] of Object.entries(updates)) {
            const res = await window.pywebview.api.update_table_row(
              tableName,
              rowId,
              col,
              val,
              activeDbPath,
            );
            if (res && res.success) successCount++;
          }
          showGlobalProgress(100, true);
          if (successCount > 0) {
            showNotification(
              `${successCount} champ(s) modifie(s) avec succes.`,
              true,
            );
            logUserAction(
              `Modification de la ligne #${rowId} dans ${tableName}`,
            );
            for (const dup of allDuplicates) {
              if (dup.tableName === tableName) {
                if (dup.row_index === rowId) Object.assign(dup.data, updates);
                if (dup.reference_id === rowId)
                  Object.assign(dup.reference_data, updates);
              }
            }
            if (typeof renderDuplicatesWithFilter === "function") {
              renderDuplicatesWithFilter();
            }
            if (currentManipulateTable === tableName) {
              await loadManipulateTableData(tableName, currentManipulatePage);
            }
            closeModal();
          } else {
            showNotification("Erreur lors de la modification.", false);
          }
        } catch (e) {
          console.error(e);
          showNotification("Erreur lors de la modification.", false);
        }
      }
    });
}

// ============================================
// GESTION DES DOUBLONS
// ============================================
async function loadDuplicateTableFilter() {
  const container = document.getElementById("dup-tables-checkboxes");
  if (!container) return;
  try {
    await waitForApi();
    const activeDbPath = sessionStorage.getItem("current_db_path");
    const tablesRes =
      await window.pywebview.api.get_database_table_names(activeDbPath);

    if (tablesRes && tablesRes.success && tablesRes.tables.length > 0) {
      container.innerHTML = "";
      tablesRes.tables.forEach((table) => {
        const label = document.createElement("label");
        label.className = "dup-table-checkbox-label checked";
        label.innerHTML = `
          <input type="checkbox" class="dup-table-checkbox" value="${escapeHtml(table)}" checked />
          <span>${escapeHtml(table)}</span>
        `;
        const chk = label.querySelector("input");
        chk.addEventListener("change", () => {
          if (chk.checked) label.classList.add("checked");
          else label.classList.remove("checked");
          updateDuplicateTablesInfo();
        });
        container.appendChild(label);
      });
      updateDuplicateTablesInfo();
    } else {
      container.innerHTML =
        '<span style="color: #999; font-style: italic;">Aucune table disponible.</span>';
      const info = document.getElementById("dup-tables-info");
      if (info) info.textContent = "0 table(s) selectionnee(s)";
    }
  } catch (e) {
    console.error("Erreur lors du chargement des tables pour le filtre:", e);
  }
}

function updateDuplicateTablesInfo() {
  const checkboxes = document.querySelectorAll(".dup-table-checkbox:checked");
  const total = document.querySelectorAll(".dup-table-checkbox").length;
  const info = document.getElementById("dup-tables-info");
  if (info) {
    info.textContent = `${checkboxes.length} / ${total} table(s) selectionnee(s)`;
    info.style.color =
      checkboxes.length === 0
        ? "#dc3545"
        : checkboxes.length === total
          ? "#27ae60"
          : "#64748b";
    info.style.fontWeight = "600";
  }
}

function initDuplicatesPage() {
  const btnCheckDups = document.querySelector("#btn-check-duplicates");
  const runBtn = document.querySelector("#btn-run-dup-scan");
  const cancelBtn = document.querySelector("#btn-cancel-dup-scan");
  const refreshTablesBtn = document.querySelector("#btn-refresh-tables");
  const refreshDupsBtn = document.querySelector("#btn-refresh-dups");
  const btnSelectAll = document.querySelector("#btn-select-all-dups");
  const btnEditDups = document.querySelector("#btn-edit-selected-dups");
  const btnDeleteDups = document.querySelector("#btn-delete-selected-dups");
  const btnDeleteAllDups = document.querySelector("#btn-delete-all-dups");
  const btnExportDups = document.querySelector("#btn-export-dups");
  const btnExpandDups = document.querySelector("#btn-expand-dups");
  const btnAddDup = document.querySelector("#btn-add-dups");
  const btnCheckAllTables = document.querySelector("#btn-check-all-tables");
  const btnUncheckAllTables = document.querySelector("#btn-uncheck-all-tables");

  if (btnCheckDups) {
    btnCheckDups.addEventListener("click", () => {
      resetDuplicateView();
      goToDuplicates();
    });
  }

  const radioButtons = document.querySelectorAll('input[name="dup-algorithm"]');
  const labels = document.querySelectorAll(".dup-algorithm-selector label");
  radioButtons.forEach((radio, index) => {
    radio.addEventListener("change", () => {
      labels.forEach((l, i) => {
        l.classList.toggle("active", i === index);
      });
    });
  });

  if (refreshTablesBtn) {
    refreshTablesBtn.addEventListener("click", async () => {
      await loadDuplicateTableFilter();
      showNotification("Liste des tables actualisee.", true);
    });
  }
  if (refreshDupsBtn) {
    refreshDupsBtn.addEventListener("click", async () => {
      if (allDuplicates.length === 0) {
        showNotification(
          "Aucun resultat a actualiser. Lancez d'abord une analyse.",
          false,
        );
        return;
      }
      showNotification("Actualisation des resultats...", true);
      await refreshDuplicateResults();
    });
  }
  if (btnCheckAllTables) {
    btnCheckAllTables.addEventListener("click", () => {
      document.querySelectorAll(".dup-table-checkbox").forEach((chk) => {
        chk.checked = true;
        chk.closest(".dup-table-checkbox-label")?.classList.add("checked");
      });
      updateDuplicateTablesInfo();
    });
  }
  if (btnUncheckAllTables) {
    btnUncheckAllTables.addEventListener("click", () => {
      document.querySelectorAll(".dup-table-checkbox").forEach((chk) => {
        chk.checked = false;
        chk.closest(".dup-table-checkbox-label")?.classList.remove("checked");
      });
      updateDuplicateTablesInfo();
    });
  }
  if (runBtn) {
    runBtn.addEventListener("click", async () => {
      const selectedAlgo =
        document.querySelector('input[name="dup-algorithm"]:checked')?.value ||
        "general";
      await runDuplicateScan(selectedAlgo);
    });
  }
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      duplicateScanCancelled = true;
      showNotification("Analyse annulee.", false);
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
      btnSelectAll.textContent = allChecked
        ? "Tout selectionner"
        : "Tout deselectionner";
      updateSelectAllButton();
    });
  }
  if (btnEditDups) {
    btnEditDups.addEventListener("click", async () => {
      const checkedBoxes = document.querySelectorAll(".dup-checkbox:checked");
      if (checkedBoxes.length === 0) {
        showNotification(
          "Veuillez selectionner au moins un element a modifier.",
          false,
        );
        return;
      }
      if (checkedBoxes.length > 1) {
        showNotification(
          "Veuillez selectionner un seul element a la fois pour la modification.",
          false,
        );
        return;
      }
      const chk = checkedBoxes[0];
      const tableName = chk.getAttribute("data-table");
      const rowIndex = parseInt(chk.getAttribute("data-rowid"));
      const duplicate = allDuplicates.find(
        (d) => d.tableName === tableName && d.row_index === rowIndex,
      );
      if (!duplicate) {
        showNotification(
          "Impossible de trouver les donnees de cette ligne.",
          false,
        );
        return;
      }
      openEditModal(tableName, rowIndex, duplicate.data, false);
    });
  }
  if (btnAddDup) {
    btnAddDup.addEventListener("click", async () => {
      const activeDbPath = sessionStorage.getItem("current_db_path");
      const tablesRes =
        await window.pywebview.api.get_database_table_names(activeDbPath);
      if (!tablesRes || !tablesRes.tables || tablesRes.tables.length === 0) {
        showNotification("Aucune table disponible.", false);
        return;
      }
      const tableName = tablesRes.tables[0];
      const struct =
        await window.pywebview.api.get_database_structure_matrix(activeDbPath);
      const columns = struct.structure[tableName] || [];
      const emptyRow = {};
      columns.forEach((col) => {
        if (col !== "id" && col !== "rowid") {
          emptyRow[col] = "";
        }
      });
      openEditModal(tableName, null, emptyRow, true);
    });
  }
  if (btnDeleteDups) {
    btnDeleteDups.addEventListener("click", async () => {
      await deleteSelectedDuplicatesWithProgress();
    });
  }
  if (btnDeleteAllDups) {
    btnDeleteAllDups.addEventListener("click", async () => {
      await deleteAllDuplicatesWithProgress();
    });
  }
  if (btnExportDups) {
    btnExportDups.addEventListener("click", () => {
      exportDuplicatesWithDialog();
    });
  }
  if (btnExpandDups) {
    btnExpandDups.addEventListener("click", () => {
      const contentElem = document.querySelector("#db-results-content");
      if (!contentElem || !contentElem.innerHTML.trim()) {
        showNotification("Aucun resultat a agrandir.", false);
        return;
      }
      openFullScreenModal(
        "Gestion avancee des doublons - Vue agrandie",
        contentElem.innerHTML,
      );
    });
  }
}

async function runDuplicateScan(selectedAlgo) {
  const resultsContainer = document.getElementById("dup-results-container");
  const resultsBody = document.getElementById("db-results-content");
  const statusDiv = document.getElementById("dup-scan-status");
  const countBadge = document.getElementById("dup-results-count");
  const toolbar = document.getElementById("duplicate-actions-toolbar");
  const cancelBtn = document.getElementById("btn-cancel-dup-scan");
  const runBtn = document.getElementById("btn-run-dup-scan");

  if (!resultsBody || !statusDiv) return;

  const checkedTables = Array.from(
    document.querySelectorAll(".dup-table-checkbox:checked"),
  ).map((chk) => chk.value);
  if (checkedTables.length === 0) {
    showNotification("Veuillez selectionner au moins une table.", false);
    return;
  }

  const algoLabel =
    {
      general: "General (toutes les colonnes)",
      cin_nom: "CIN + NOM + COMMUNE + FKT",
      cin_nom_only: "CIN + NOM + ANNEE NAISSANCE",
      cin_nom_annee_commune_fkt: "CIN + NOM + ANNEE + COMMUNE + FKT (strict)",
    }[selectedAlgo] || selectedAlgo;

  resultsContainer.classList.remove("hidden");
  toolbar.classList.remove("hidden");
  resultsBody.innerHTML =
    '<p style="color: var(--text-muted, #64748b);">Analyse en cours...</p>';
  statusDiv.textContent = `Analyse avec l'algorithme "${algoLabel}" sur ${checkedTables.length} table(s)...`;
  duplicateScanCancelled = false;
  if (cancelBtn) cancelBtn.style.display = "inline-block";
  if (runBtn) runBtn.disabled = true;

  showGlobalProgress(0, true);

  const container = document.querySelector("#notification-container");
  let progressNotif = document.getElementById("dup-scan-progress-notif");
  if (!progressNotif) {
    progressNotif = document.createElement("div");
    progressNotif.id = "dup-scan-progress-notif";
    progressNotif.className = "notification notification-success";
    progressNotif.style.display = "block";
    progressNotif.style.background = "rgba(79, 70, 229, 0.95)";
    progressNotif.style.minWidth = "350px";
    container.appendChild(progressNotif);
  }

  try {
    await waitForApi();
    const activeDbPath = sessionStorage.getItem("current_db_path");
    const tablesToScan = checkedTables;

    // ✅ Reinitialiser la pagination
    currentDuplicatePage = 1;
    allDuplicates = [];

    for (let i = 0; i < tablesToScan.length; i++) {
      if (duplicateScanCancelled) break;
      const currentTable = tablesToScan[i];
      const pct = Math.round(((i + 1) / tablesToScan.length) * 100);

      progressNotif.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px;">
          <i class="fas fa-search"></i> Analyse des doublons...
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; opacity: 0.9; margin-bottom: 4px;">
          <span>Table : <strong>${escapeHtml(currentTable)}</strong></span>
          <span>${i + 1} / ${tablesToScan.length}</span>
        </div>
        <div style="width: 100%; background: rgba(255,255,255,0.3); height: 6px; border-radius: 3px; overflow: hidden;">
          <div style="width: ${pct}%; background: #ffffff; height: 100%; transition: width 0.3s ease;"></div>
        </div>
      `;
      showGlobalProgress(pct, true);

      const scanRes = await window.pywebview.api.scan_table_duplicates_advanced(
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

    if (duplicateScanCancelled) {
      statusDiv.textContent = "Analyse annulee.";
      if (cancelBtn) cancelBtn.style.display = "none";
      if (runBtn) runBtn.disabled = false;
      if (progressNotif) {
        progressNotif.style.display = "none";
        progressNotif.remove();
      }
      showGlobalProgress(0, false);
      return;
    }

    showGlobalProgress(100, true);

    if (progressNotif) {
      progressNotif.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px;">
          <i class="fas fa-check-circle"></i> Analyse terminee !
        </div>
        <div style="font-size: 0.85rem; opacity: 0.9;">
          ${allDuplicates.length} doublon(s) trouve(s)
        </div>
      `;
      setTimeout(() => {
        if (progressNotif) {
          progressNotif.style.display = "none";
          progressNotif.remove();
        }
      }, 2500);
    }

    currentDuplicatesAlgo = selectedAlgo;

    if (allDuplicates.length === 0) {
      resultsBody.innerHTML =
        "<p style='color: var(--success, #10b981);'>Aucun doublon trouve.</p>";
      statusDiv.textContent = "Analyse terminee : aucun doublon trouve.";
      if (countBadge) countBadge.textContent = "0";
    } else {
      showNotification(`${allDuplicates.length} doublon(s) trouve(s).`, true);
      statusDiv.textContent = `${allDuplicates.length} doublon(s) identifie(s) avec l'algorithme "${algoLabel}"`;
      if (countBadge) countBadge.textContent = allDuplicates.length;
      if (allDuplicates.length > 0 && allDuplicates[0].data) {
        currentColumns = Object.keys(allDuplicates[0].data);
      }
      renderDuplicatesWithFilter();
    }
  } catch (err) {
    console.error("Erreur lors de l'analyse des doublons:", err);
    resultsBody.innerHTML = `<p style='color: var(--error, #ef4444);'>Erreur : ${err.message}</p>`;
    showNotification(`Erreur: ${err.message}`, false);
    if (progressNotif) {
      progressNotif.style.display = "none";
      progressNotif.remove();
    }
    showGlobalProgress(0, false);
  } finally {
    if (cancelBtn) cancelBtn.style.display = "none";
    if (runBtn) runBtn.disabled = false;
  }
}

function renderDuplicatesWithFilter() {
  const resultsBody = document.getElementById("db-results-content");
  if (!resultsBody) return;

  const filteredDuplicates = allDuplicates;
  if (filteredDuplicates.length === 0) {
    resultsBody.innerHTML =
      "<p style='color: var(--warning, #f39c12);'>Aucun doublon a afficher.</p>";
    return;
  }

  const MAX_DISPLAY = 1000;
  const pageDuplicates = paginateArray(
    filteredDuplicates,
    currentDuplicatePage,
    MAX_DISPLAY,
  );
  const hasMore = filteredDuplicates.length > MAX_DISPLAY;

  let allColumns = currentColumns;
  if (
    allColumns.length === 0 &&
    pageDuplicates.length > 0 &&
    pageDuplicates[0].data
  ) {
    allColumns = Object.keys(pageDuplicates[0].data);
  }

  // Vider
  resultsBody.innerHTML = "";

  // En-tete
  const headerEl = document.createElement("div");
  headerEl.style.cssText =
    "margin-bottom: 12px; font-weight: bold; color: var(--primary-color, #4f46e5);";
  headerEl.innerHTML = `
    ${filteredDuplicates.length} doublon(s) au total
    ${hasMore ? `<span style="color: orange; font-weight: normal;">(Page ${currentDuplicatePage} sur ${Math.ceil(filteredDuplicates.length / MAX_DISPLAY)})</span>` : ""}
  `;
  resultsBody.appendChild(headerEl);

  // ✅ Pagination
  const paginationEl = buildPaginationControls({
    currentPage: currentDuplicatePage,
    totalItems: filteredDuplicates.length,
    perPage: MAX_DISPLAY,
    onPageChange: (newPage) => {
      currentDuplicatePage = newPage;
      renderDuplicatesWithFilter();
      const container = document.getElementById("db-results-content");
      if (container) container.scrollTop = 0;
    },
  });
  resultsBody.appendChild(paginationEl);

  // Tableau
  let html = `
    <div class="duplicates-table-wrapper" style="max-height: 500px; overflow: auto;">
      <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem; background: var(--bg-container, #fff);">
        <thead style="position: sticky; top: 0; z-index: 10; background: var(--bg-secondary, #f1f5f9);">
          <tr>
            <th style="width: 40px; text-align: center; padding: 0.3rem 0.4rem; border: 1px solid var(--border-color, #e2e8f0);">Sel.</th>
            <th style="width: 60px; text-align: center; padding: 0.3rem 0.4rem; border: 1px solid var(--border-color, #e2e8f0);">Actions</th>
            <th style="padding: 0.3rem 0.4rem; border: 1px solid var(--border-color, #e2e8f0);">Table</th>
            <th style="padding: 0.3rem 0.4rem; border: 1px solid var(--border-color, #e2e8f0);">Type</th>
            <th style="padding: 0.3rem 0.4rem; border: 1px solid var(--border-color, #e2e8f0);">ID</th>
  `;

  allColumns.forEach((col) => {
    html += `<th style="padding: 0.3rem 0.4rem; border: 1px solid var(--border-color, #e2e8f0);">${escapeHtml(col)}</th>`;
  });

  html += `</tr></thead><tbody>`;

  for (let idx = 0; idx < pageDuplicates.length; idx++) {
    const dup = pageDuplicates[idx];
    const tableName = escapeHtml(dup.tableName || dup.table || "");
    const rowIndex = escapeHtml(String(dup.row_index || ""));
    const refId = escapeHtml(String(dup.reference_id || ""));
    const dupData = dup.data || {};
    const refData = dup.reference_data || {};

    html += `
      <tr style="border-bottom: 1px solid var(--border-color, #e2e8f0); background: ${idx % 2 === 0 ? "transparent" : "rgba(231, 76, 60, 0.03)"};">
        <td style="text-align: center; padding: 0.2rem 0.3rem; border: 1px solid var(--border-color, #e2e8f0);">
          <input type="checkbox" class="dup-checkbox" data-index="${idx}" data-table="${tableName}" data-rowid="${rowIndex}" checked style="width: 14px; height: 14px; cursor: pointer;" />
        </td>
        <td style="text-align: center; padding: 0.2rem 0.3rem; border: 1px solid var(--border-color, #e2e8f0);">
          <button class="btn-edit-row" data-table="${tableName}" data-rowid="${rowIndex}" title="Modifier cette ligne" style="background: #f39c12; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 0.65rem;">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-delete-row-single" data-table="${tableName}" data-rowid="${rowIndex}" title="Supprimer cette ligne" style="background: #dc3545; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 0.65rem; margin-left: 2px;">
            <i class="fas fa-trash"></i>
          </button>
        </td>
        <td style="font-weight: 600; padding: 0.2rem 0.3rem; border: 1px solid var(--border-color, #e2e8f0); font-size: 0.7rem;">${tableName}</td>
        <td style="padding: 0.2rem 0.3rem; border: 1px solid var(--border-color, #e2e8f0);">
          <span style="background: #e74c3c; color: white; padding: 1px 6px; border-radius: 3px; font-size: 0.6rem; font-weight: 600;">DOUBLON</span>
        </td>
        <td style="font-weight: 600; padding: 0.2rem 0.3rem; border: 1px solid var(--border-color, #e2e8f0);">#${rowIndex}</td>
    `;

    allColumns.forEach((col) => {
      let val = dupData[col];
      if (val === null || val === undefined || val === "") {
        val = '<span style="color: #999; font-style: italic;">NULL</span>';
      } else {
        val = escapeHtml(String(val));
      }
      html += `<td style="padding: 0.2rem 0.3rem; border: 1px solid var(--border-color, #e2e8f0); font-size: 0.65rem; max-width: 150px; word-break: break-word;">${val}</td>`;
    });

    html += `</tr>`;

    html += `
      <tr style="border-bottom: 2px solid var(--border-color, #e2e8f0); background: ${idx % 2 === 0 ? "rgba(39, 174, 96, 0.03)" : "transparent"};">
        <td style="padding: 0.2rem 0.3rem; border: 1px solid var(--border-color, #e2e8f0);"></td>
        <td style="text-align: center; padding: 0.2rem 0.3rem; border: 1px solid var(--border-color, #e2e8f0);">
          <button class="btn-edit-row" data-table="${tableName}" data-rowid="${refId}" title="Modifier la reference" style="background: #f39c12; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 0.65rem;">
            <i class="fas fa-edit"></i>
          </button>
        </td>
        <td style="padding: 0.2rem 0.3rem; border: 1px solid var(--border-color, #e2e8f0);"></td>
        <td style="padding: 0.2rem 0.3rem; border: 1px solid var(--border-color, #e2e8f0);">
          <span style="background: #27ae60; color: white; padding: 1px 6px; border-radius: 3px; font-size: 0.6rem; font-weight: 600;">REFERENCE</span>
        </td>
        <td style="font-weight: 600; padding: 0.2rem 0.3rem; border: 1px solid var(--border-color, #e2e8f0);">#${refId}</td>
    `;

    allColumns.forEach((col) => {
      let val = refData[col];
      if (val === null || val === undefined || val === "") {
        val = '<span style="color: #999; font-style: italic;">NULL</span>';
      } else {
        val = escapeHtml(String(val));
      }
      html += `<td style="padding: 0.2rem 0.3rem; border: 1px solid var(--border-color, #e2e8f0); font-size: 0.65rem; max-width: 150px; word-break: break-word;">${val}</td>`;
    });

    html += `</tr>`;
  }

  html += `
    </tbody></table></div>
  `;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  resultsBody.appendChild(wrapper);

  // Listeners
  document.querySelectorAll(".dup-checkbox").forEach((chk) => {
    chk.addEventListener("change", updateSelectAllButton);
  });

  document.querySelectorAll(".btn-edit-row").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      const tableName = this.getAttribute("data-table");
      const rowId = parseInt(this.getAttribute("data-rowid"));
      let rowData = null;
      for (const dup of allDuplicates) {
        if (
          dup.tableName === tableName &&
          (dup.row_index === rowId || dup.reference_id === rowId)
        ) {
          if (dup.row_index === rowId) rowData = dup.data;
          else rowData = dup.reference_data;
          break;
        }
      }
      if (!rowData) {
        showNotification(
          "Impossible de trouver les donnees de cette ligne.",
          false,
        );
        return;
      }
      openEditModal(tableName, rowId, rowData, false);
    });
  });

  document.querySelectorAll(".btn-delete-row-single").forEach((btn) => {
    btn.addEventListener("click", async function (e) {
      e.preventDefault();
      const tableName = this.getAttribute("data-table");
      const rowId = parseInt(this.getAttribute("data-rowid"));
      if (!confirm(`Supprimer la ligne #${rowId} de la table "${tableName}" ?`))
        return;
      try {
        await waitForApi();
        const activeDbPath = sessionStorage.getItem("current_db_path");
        const res = await window.pywebview.api.delete_table_row(
          tableName,
          rowId,
          activeDbPath,
        );
        if (res && res.success) {
          showNotification("Ligne supprimee avec succes.", true);
          logUserAction(`Suppression de la ligne #${rowId} dans ${tableName}`);
          allDuplicates = allDuplicates.filter(
            (d) =>
              !(
                d.tableName === tableName &&
                (d.row_index === rowId || d.reference_id === rowId)
              ),
          );
          const countBadge = document.getElementById("dup-results-count");
          if (countBadge) countBadge.textContent = allDuplicates.length;
          renderDuplicatesWithFilter();
        } else {
          showNotification(
            res?.message || "Erreur lors de la suppression.",
            false,
          );
        }
      } catch (err) {
        console.error(err);
        showNotification("Erreur lors de la suppression.", false);
      }
    });
  });

  updateSelectAllButton();
}

async function refreshDuplicateResults() {
  if (allDuplicates.length === 0) {
    showNotification("Aucun resultat a actualiser.", false);
    return;
  }
  try {
    await waitForApi();
    const activeDbPath = sessionStorage.getItem("current_db_path");
    showGlobalProgress(30, true);

    let updatedDuplicates = [];
    const tables = [...new Set(allDuplicates.map((d) => d.tableName))];
    let processed = 0;

    for (const table of tables) {
      const tableData = await window.pywebview.api.get_table_rows(
        table,
        activeDbPath,
        100000,
        0,
      );
      processed++;
      showGlobalProgress(
        30 + Math.round((processed / tables.length) * 60),
        true,
      );
      if (tableData && tableData.success) {
        const rowsMap = {};
        tableData.data.forEach((row, idx) => {
          rowsMap[idx + 1] = row;
        });
        const tableDuplicates = allDuplicates.filter(
          (d) => d.tableName === table,
        );
        for (const dup of tableDuplicates) {
          const newDupData = rowsMap[dup.row_index];
          const newRefData = rowsMap[dup.reference_id];
          if (newDupData && newRefData) {
            updatedDuplicates.push({
              ...dup,
              data: newDupData,
              reference_data: newRefData,
            });
          }
        }
      }
    }

    showGlobalProgress(100, true);
    const removedCount = allDuplicates.length - updatedDuplicates.length;
    allDuplicates = updatedDuplicates;
    const countBadge = document.getElementById("dup-results-count");
    if (countBadge) countBadge.textContent = allDuplicates.length;
    renderDuplicatesWithFilter();
    if (removedCount > 0) {
      showNotification(
        `${removedCount} doublon(s) supprime(s) depuis la derniere analyse.`,
        true,
      );
    } else {
      showNotification("Resultats actualises.", true);
    }
  } catch (e) {
    console.error("Erreur lors de l'actualisation:", e);
    showNotification("Erreur lors de l'actualisation.", false);
  }
}

// ============================================
// SUPPRESSION PAR SELECTION
// ============================================
async function deleteSelectedDuplicatesWithProgress() {
  const checkedBoxes = document.querySelectorAll(".dup-checkbox:checked");
  if (checkedBoxes.length === 0) {
    showNotification(
      "Veuillez selectionner au moins un doublon a supprimer.",
      false,
    );
    return;
  }
  if (
    !confirm(
      `Attention : vous allez supprimer definitivement ${checkedBoxes.length} doublon(s). Continuer ?`,
    )
  )
    return;

  try {
    await waitForApi();
    const activeDbPath = sessionStorage.getItem("current_db_path");
    const duplicatesToDelete = [];
    checkedBoxes.forEach((chk) => {
      const tableName = chk.getAttribute("data-table");
      const rowIndex = chk.getAttribute("data-rowid");
      if (tableName && rowIndex) {
        duplicatesToDelete.push({ tableName, row_index: parseInt(rowIndex) });
      }
    });

    showGlobalProgress(30, true);
    showNotification("Suppression en cours...", true);

    const result = await window.pywebview.api.delete_duplicates_batch(
      duplicatesToDelete,
      activeDbPath,
    );
    showGlobalProgress(100, true);

    if (result && result.success) {
      const { deleted, errors, elapsed_seconds } = result;
      const msg = `${deleted} doublon(s) supprimes en ${elapsed_seconds}s${errors > 0 ? ` (${errors} erreurs)` : ""}`;
      showNotification(msg, errors === 0);
      logUserAction(
        `Suppression de ${deleted} doublons en ${elapsed_seconds}s`,
      );
      allDuplicates = allDuplicates.filter((d) => {
        return !duplicatesToDelete.some(
          (dd) => dd.tableName === d.tableName && dd.row_index === d.row_index,
        );
      });
      const countBadge = document.getElementById("dup-results-count");
      if (countBadge) countBadge.textContent = allDuplicates.length;
      renderDuplicatesWithFilter();
      if (allDuplicates.length === 0) {
        document
          .getElementById("dup-results-container")
          .classList.add("hidden");
      }
    } else {
      showNotification(
        result?.message || "Erreur lors de la suppression.",
        false,
      );
    }
  } catch (err) {
    console.error("Erreur lors de la suppression:", err);
    showNotification("Erreur lors de la suppression des doublons.", false);
  }
}

async function deleteAllDuplicatesWithProgress() {
  if (allDuplicates.length === 0) {
    showNotification("Aucun doublon a supprimer.", false);
    return;
  }
  const total = allDuplicates.length;

  if (
    !confirm(
      `ATTENTION : SUPPRESSION MASSIVE\n\n` +
        `Vous allez supprimer DEFINITIVEMENT ${total} doublon(s).\n\n` +
        `Cette action est IRREVERSIBLE.\n\n` +
        `Voulez-vous vraiment continuer ?`,
    )
  )
    return;

  if (
    !confirm(
      `Derniere confirmation :\n\n${total} ligne(s) vont etre supprimees.\n\nConfirmer la suppression massive ?`,
    )
  )
    return;

  try {
    await waitForApi();
    const activeDbPath = sessionStorage.getItem("current_db_path");
    showGlobalProgress(10, true);

    const container = document.querySelector("#notification-container");
    let progressNotif = document.getElementById(
      "duplicate-delete-all-progress",
    );
    if (!progressNotif) {
      progressNotif = document.createElement("div");
      progressNotif.id = "duplicate-delete-all-progress";
      progressNotif.className = "notification notification-error";
      progressNotif.style.display = "block";
      progressNotif.style.background = "rgba(139, 0, 0, 0.95)";
      progressNotif.style.minWidth = "350px";
      container.appendChild(progressNotif);
    }
    progressNotif.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px;">
        <i class="fas fa-bomb"></i> Suppression massive de ${total} doublons...
      </div>
      <div style="font-size: 0.85rem; opacity: 0.9;">
        Traitement en cours, veuillez patienter...
      </div>
      <div style="width: 100%; background: rgba(255,255,255,0.3); height: 6px; border-radius: 3px; overflow: hidden; margin-top: 6px;">
        <div style="width: 30%; background: #ff6b6b; height: 100%; transition: width 0.3s ease;"></div>
      </div>
    `;

    showGlobalProgress(30, true);

    const result = await window.pywebview.api.delete_duplicates_batch(
      allDuplicates,
      activeDbPath,
    );
    showGlobalProgress(100, true);

    setTimeout(() => {
      if (progressNotif) {
        progressNotif.style.display = "none";
        progressNotif.remove();
      }
    }, 2000);

    if (result && result.success) {
      const { deleted, errors, elapsed_seconds, details } = result;
      let msg = `${deleted} doublon(s) supprimes en ${elapsed_seconds}s`;
      if (errors > 0) msg += ` (${errors} erreur(s))`;
      showNotification(msg, errors === 0);
      logUserAction(
        `Suppression MASSIVE de ${deleted} doublons en ${elapsed_seconds}s`,
      );

      allDuplicates = [];
      const countBadge = document.getElementById("dup-results-count");
      if (countBadge) countBadge.textContent = "0";
      renderDuplicatesWithFilter();
      document.getElementById("dup-results-container").classList.add("hidden");
      const statusDiv = document.getElementById("dup-scan-status");
      if (statusDiv) {
        statusDiv.textContent = `Suppression massive terminee : ${deleted} doublon(s) supprime(s) en ${elapsed_seconds}s.`;
      }
      if (details) console.log("[DETAILS] Suppressions par table :", details);
    } else {
      showNotification(
        result?.message || "Erreur lors de la suppression massive.",
        false,
      );
    }
  } catch (err) {
    console.error("Erreur lors de la suppression massive:", err);
    showNotification("Erreur lors de la suppression massive.", false);
    const progressNotif = document.getElementById(
      "duplicate-delete-all-progress",
    );
    if (progressNotif) {
      progressNotif.style.display = "none";
      progressNotif.remove();
    }
  }
}

// ============================================
// EXPORT DES DOUBLONS
// ============================================
async function exportDuplicatesWithDialog() {
  if (allDuplicates.length === 0) {
    showNotification("Aucun resultat de doublons a exporter.", false);
    return;
  }
  showExportDialog(async (format) => {
    if (format === "pdf") await exportDuplicatesToPDF();
    else if (format === "excel") await exportDuplicatesToExcel();
  });
}

async function exportDuplicatesToExcel() {
  try {
    const filteredDuplicates = allDuplicates;
    if (filteredDuplicates.length === 0) {
      showNotification("Aucune donnee a exporter.", false);
      return;
    }
    const result = await window.pywebview.api.select_excel_export_file();
    if (!result || !result.success) return;

    const data = [];
    filteredDuplicates.forEach((dup) => {
      const rowData = {
        Table: dup.tableName,
        Type: "DOUBLON",
        ID: dup.row_index,
      };
      Object.assign(rowData, dup.data || {});
      data.push(rowData);
      const refData = {
        Table: dup.tableName,
        Type: "REFERENCE",
        ID: dup.reference_id,
      };
      Object.assign(refData, dup.reference_data || {});
      data.push(refData);
    });

    showNotificationWithProgress("Export des doublons vers Excel...", 30, true);
    const exportResult = await window.pywebview.api.generate_excel_from_data(
      result.file_path,
      data,
    );
    showNotificationWithProgress("Export termine.", 100, true);

    if (exportResult && exportResult.success) {
      showNotification(`Excel exporte : ${result.file_path}`, true);
      logUserAction(`Export des doublons vers Excel : ${result.file_path}`);
    } else {
      showNotification(
        exportResult?.message || "Erreur lors de l'export Excel.",
        false,
      );
    }
  } catch (error) {
    console.error("Erreur export Excel:", error);
    showNotification("Erreur lors de l'export Excel.", false);
  }
}

async function exportDuplicatesToPDF() {
  try {
    const filteredDuplicates = allDuplicates;
    if (filteredDuplicates.length === 0) {
      showNotification("Aucune donnee a exporter.", false);
      return;
    }
    const result = await window.pywebview.api.select_pdf_file();
    if (!result || !result.success) return;

    const allColumns =
      currentColumns.length > 0
        ? currentColumns
        : Object.keys(filteredDuplicates[0]?.data || {});

    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Rapport des doublons</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'DejaVu Sans', Arial, sans-serif; padding: 20px; color: #1a1a2e; background: #ffffff; font-size: 8px; }
          .header { text-align: center; padding-bottom: 15px; border-bottom: 2px solid #1a4d3a; margin-bottom: 15px; }
          .header h1 { color: #1a4d3a; font-size: 18px; }
          .summary { background: #e8f3ef; padding: 8px 14px; border-radius: 6px; margin-bottom: 12px; border-left: 4px solid #1a4d3a; font-weight: 600; font-size: 12px; color: #1a4d3a; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 6.5px; }
          th { background: #1a4d3a; color: white; padding: 4px 5px; text-align: left; border: 1px solid #1a4d3a; }
          td { padding: 3px 5px; border: 1px solid #e2e8f0; word-wrap: break-word; max-width: 120px; }
          .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 7px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Rapport des doublons</h1>
          <div style="color: #666; font-size: 10px; margin-top: 3px;">xl2db - Expert Edition</div>
        </div>
        <div class="summary">${filteredDuplicates.length} doublon(s) - ${allColumns.length} attributs</div>
        <table>
          <thead>
            <tr>
              <th>Table</th><th>Type</th><th>ID</th>
              ${allColumns.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
    `;

    filteredDuplicates.forEach((dup) => {
      htmlContent += `<tr><td>${escapeHtml(dup.tableName)}</td><td>DOUBLON</td><td>#${dup.row_index}</td>`;
      allColumns.forEach((col) => {
        const val = dup.data?.[col];
        htmlContent += `<td>${escapeHtml(val === null || val === undefined ? "" : String(val))}</td>`;
      });
      htmlContent += `</tr>`;

      htmlContent += `<tr style="background: rgba(39, 174, 96, 0.05);"><td>${escapeHtml(dup.tableName)}</td><td>REFERENCE</td><td>#${dup.reference_id}</td>`;
      allColumns.forEach((col) => {
        const val = dup.reference_data?.[col];
        htmlContent += `<td>${escapeHtml(val === null || val === undefined ? "" : String(val))}</td>`;
      });
      htmlContent += `</tr>`;
    });

    htmlContent += `</tbody></table></body></html>`;

    showNotificationWithProgress("Generation du PDF...", 50, true);
    const pdfResult = await window.pywebview.api.generate_pdf_from_html(
      result.file_path,
      htmlContent,
    );
    showNotificationWithProgress("PDF genere.", 100, true);

    if (pdfResult && pdfResult.success) {
      showNotification(`PDF exporte : ${result.file_path}`, true);
      logUserAction(`Export des doublons vers PDF : ${result.file_path}`);
    } else {
      showNotification(
        pdfResult?.message || "Erreur lors de la generation du PDF.",
        false,
      );
    }
  } catch (error) {
    console.error("Erreur export PDF:", error);
    showNotification("Erreur lors de l'export PDF.", false);
  }
}

// ============================================
// MANIPULATION DES DONNEES
// ============================================
async function initManipulatePage() {
  const tableSelect = document.querySelector("#manipulate-table-select");
  const btnSelectTable = document.querySelector("#btn-manipulate-select-table");
  const btnRefreshManipulate = document.querySelector(
    "#btn-refresh-manipulate",
  );
  const btnShowResults = document.querySelector("#btn-manipulate-show-results");
  const btnAddRow = document.querySelector("#btn-manipulate-add-row");
  const btnDeleteTable = document.querySelector("#btn-manipulate-delete-table");
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
      if (!isDbOpen) {
        showNotification("Veuillez d'abord ouvrir une base de donnees.", false);
        return;
      }
      saveCurrentDbState();
      pushNavigationHistory("manipulate");
      showView(manipulateView);
      updateTerminateButtonVisibility();
      await loadManipulateTables();
      setTimeout(() => restoreDbState(), 100);
    };
  }

  const btnExpandManipulate = document.querySelector("#btn-expand-manipulate");
  if (btnExpandManipulate) {
    btnExpandManipulate.addEventListener("click", () => {
      const contentElem = document.querySelector(
        "#manipulate-results-table-container",
      );
      if (
        !contentElem ||
        !contentElem.innerHTML.trim() ||
        !contentElem.querySelector("table")
      ) {
        showNotification("Aucun resultat a agrandir.", false);
        return;
      }
      openFullScreenModal(
        "Manipulation - Vue agrandie des resultats",
        contentElem.innerHTML,
      );
    });
  }

  if (btnRefreshManipulate) {
    btnRefreshManipulate.addEventListener("click", async () => {
      await loadManipulateTables();
      if (currentManipulateTable) {
        await loadManipulateTableData(
          currentManipulateTable,
          currentManipulatePage,
        );
      }
      showNotification("Donnees actualisees.", true);
    });
  }
  if (btnShowResults) {
    btnShowResults.addEventListener("click", async () => {
      if (!currentManipulateTable) {
        showNotification("Veuillez d'abord selectionner une table.", false);
        return;
      }
      // ✅ Reinitialiser a la page 1
      await loadManipulateTableData(currentManipulateTable, 1);
      showNotification("Resultats affiches.", true);
    });
  }
  if (btnAddRow) {
    btnAddRow.addEventListener("click", async () => {
      if (!currentManipulateTable) {
        showNotification("Veuillez d'abord selectionner une table.", false);
        return;
      }
      const activeDbPath = sessionStorage.getItem("current_db_path");
      const struct =
        await window.pywebview.api.get_database_structure_matrix(activeDbPath);
      const columns = struct.structure[currentManipulateTable] || [];
      const emptyRow = {};
      columns.forEach((col) => {
        if (col !== "id" && col !== "rowid") emptyRow[col] = "";
      });
      openEditModal(currentManipulateTable, null, emptyRow, true);
    });
  }
  if (btnDeleteTable) {
    btnDeleteTable.addEventListener("click", () => {
      if (!currentManipulateTable) {
        showNotification(
          "Veuillez d'abord selectionner une table a supprimer.",
          false,
        );
        return;
      }
      deleteSelectedTable(currentManipulateTable);
    });
  }
  if (!tableSelect) return;
  await loadManipulateTables();

  if (btnSelectTable) {
    btnSelectTable.onclick = async () => {
      const selectedTable = tableSelect.value;
      if (!selectedTable) {
        showNotification("Veuillez selectionner une table.", false);
        return;
      }
      currentManipulateTable = selectedTable;
      currentManipulatePage = 1; // ✅ Reinitialiser la pagination
      window._activeValueFilters = {};
      window._activeColumnFilters = null;
      showNotification(`Table ${selectedTable} selectionnee.`, true);

      // ✅ Charger la page 1
      await loadManipulateTableData(selectedTable, 1);

      if (searchInput) searchInput.value = "";
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

  if (btnExecuteSearch) {
    btnExecuteSearch.onclick = async () => {
      const val = searchInput?.value.trim();
      if (!currentManipulateTable) {
        showNotification("Veuillez d'abord selectionner une table.", false);
        return;
      }
      if (!val) {
        displayManipulateData(
          currentManipulateData,
          resultsContainer,
          countSpan,
          currentManipulateTotalCount,
          currentManipulateTable,
        );
        currentManipulateFiltered = currentManipulateData;
        return;
      }
      try {
        const filtered = currentManipulateData.filter((row) => {
          return Object.values(row).some((value) =>
            String(value).toUpperCase().includes(val.toUpperCase()),
          );
        });
        if (filtered.length === 0) {
          showNotification(
            "Aucun resultat trouve pour cette recherche.",
            false,
          );
        } else {
          showNotification(`${filtered.length} resultat(s) trouve(s).`, true);
        }
        // ✅ Passer currentManipulateTable explicitement
        displayManipulateData(
          filtered,
          resultsContainer,
          countSpan,
          filtered.length,
          currentManipulateTable,
        );
        currentManipulateFiltered = filtered;
      } catch (err) {
        console.error(err);
        showNotification("Erreur lors de la recherche.", false);
      }
    };
  }

  const btnSearch = document.querySelector("#btn-manipulate-search");
  if (btnSearch) {
    btnSearch.onclick = function () {
      if (!currentManipulateTable) {
        showNotification("Veuillez d'abord selectionner une table.", false);
        return;
      }
      const isVisible =
        searchBarArea && !searchBarArea.classList.contains("hidden");
      if (isVisible) {
        searchBarArea.classList.add("hidden");
        searchBarArea.style.display = "none";
        this.style.background = "";
        this.style.color = "";
        return;
      }
      if (filtersArea) {
        filtersArea.classList.add("hidden");
        filtersArea.style.display = "none";
      }
      if (operationsArea) {
        operationsArea.classList.add("hidden");
        operationsArea.style.display = "none";
      }
      searchBarArea.classList.remove("hidden");
      searchBarArea.style.display = "flex";
      searchInput.focus();
      this.style.background = "var(--primary, #4f46e5)";
      this.style.color = "white";
    };
  }

  const btnFilters = document.querySelector("#btn-manipulate-filters");
  if (btnFilters) {
    btnFilters.onclick = async function () {
      if (!currentManipulateTable) {
        showNotification("Veuillez d'abord selectionner une table.", false);
        return;
      }
      const isVisible =
        filtersArea && !filtersArea.classList.contains("hidden");
      if (isVisible) {
        filtersArea.classList.add("hidden");
        filtersArea.style.display = "none";
        this.style.background = "";
        this.style.color = "";
        return;
      }
      if (searchBarArea) {
        searchBarArea.classList.add("hidden");
        searchBarArea.style.display = "none";
      }
      if (operationsArea) {
        operationsArea.classList.add("hidden");
        operationsArea.style.display = "none";
      }

      try {
        const activeDbPath = sessionStorage.getItem("current_db_path");
        const struct =
          await window.pywebview.api.get_database_structure_matrix(
            activeDbPath,
          );
        const allColumns = struct.structure[currentManipulateTable] || [];

        if (filtersArea) {
          filtersArea.classList.remove("hidden");
          filtersArea.style.display = "block";
          filtersArea.innerHTML = `
            <div style="margin-bottom: 1rem;">
              <h4 style="margin-bottom: 12px; color: var(--text-color); font-weight: bold;">
                <i class="fas fa-filter"></i> Filtrer
              </h4>
              <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem;">Choisissez le type de filtre :</p>
              <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 1rem;">
                <button id="btn-filter-results-mode" class="button button-primary" type="button" style="padding: 0.6rem 1.2rem;">
                  <i class="fas fa-list-check"></i> Filtrer les resultats
                </button>
                <button id="btn-filter-columns-mode" class="secondary-button" type="button" style="padding: 0.6rem 1.2rem;">
                  <i class="fas fa-columns"></i> Filtrer les colonnes
                </button>
              </div>
            </div>
            <div id="filter-content-container" style="border-top: 1px solid var(--border-color); padding-top: 1rem;"></div>
            <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end;">
              <button id="btn-close-filters" class="secondary-button" style="padding: 0.5rem 1.5rem; background: #6c757d; color: white;">
                <i class="fas fa-times"></i> Fermer
              </button>
            </div>
          `;

          const filterContentContainer = filtersArea.querySelector(
            "#filter-content-container",
          );
          const btnFilterResultsMode = filtersArea.querySelector(
            "#btn-filter-results-mode",
          );
          const btnFilterColumnsMode = filtersArea.querySelector(
            "#btn-filter-columns-mode",
          );

          function renderFilterResultsMode() {
            btnFilterResultsMode.className = "button button-primary";
            btnFilterResultsMode.style.background = "var(--primary, #4f46e5)";
            btnFilterResultsMode.style.color = "white";
            btnFilterColumnsMode.className = "secondary-button";
            btnFilterColumnsMode.style.background = "";
            btnFilterColumnsMode.style.color = "";

            const availableAttributes = FILTER_ATTRIBUTES.filter((attr) =>
              allColumns.some(
                (col) => col.toLowerCase() === attr.toLowerCase(),
              ),
            );

            filterContentContainer.innerHTML = `
              <div style="margin-bottom: 1rem;">
                <h4 style="margin-bottom: 12px; color: var(--text-color); font-weight: bold;">
                  <i class="fas fa-filter"></i> Filtrer par valeurs distinctes
                </h4>
                <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem;">
                  Cliquez sur un attribut pour voir ses valeurs distinctes et cocher celles a afficher.
                </p>
                <div id="attribute-buttons-container" style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 1rem;"></div>
              </div>
              <div id="distinct-values-container" style="border-top: 1px solid var(--border-color); padding-top: 1rem; display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 10px;">
                  <h4 id="distinct-values-title" style="margin: 0; color: var(--text-color); font-weight: bold;"></h4>
                  <div style="display: flex; gap: 8px;">
                    <button id="btn-select-all-values" class="secondary-button" style="padding: 0.3rem 0.8rem; font-size: 0.8rem;">Tout cocher</button>
                    <button id="btn-deselect-all-values" class="secondary-button" style="padding: 0.3rem 0.8rem; font-size: 0.8rem;">Tout decocher</button>
                  </div>
                </div>
                <div id="distinct-values-checkboxes" style="display: flex; flex-direction: column; gap: 6px; max-height: 350px; overflow-y: auto; padding: 10px; background: var(--bg-secondary, #f8fafc); border-radius: 6px;"></div>
              </div>
              <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                <button id="btn-apply-value-filters" class="button button-primary" style="padding: 0.5rem 1.5rem;">
                  <i class="fas fa-check"></i> Appliquer les filtres
                </button>
                <button id="btn-reset-value-filters" class="secondary-button" style="padding: 0.5rem 1.5rem;">
                  <i class="fas fa-undo"></i> Reinitialiser
                </button>
              </div>
            `;

            const attributeButtonsContainer =
              filterContentContainer.querySelector(
                "#attribute-buttons-container",
              );
            const distinctValuesContainer =
              filterContentContainer.querySelector(
                "#distinct-values-container",
              );
            const distinctValuesTitle = filterContentContainer.querySelector(
              "#distinct-values-title",
            );
            const distinctValuesCheckboxes =
              filterContentContainer.querySelector(
                "#distinct-values-checkboxes",
              );

            if (availableAttributes.length === 0) {
              attributeButtonsContainer.innerHTML =
                '<span style="color: #999; font-style: italic;">Aucun attribut predefini trouve dans cette table</span>';
            } else {
              availableAttributes.forEach((attr) => {
                const actualCol = allColumns.find(
                  (col) => col.toLowerCase() === attr.toLowerCase(),
                );
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "secondary-button attribute-filter-btn";
                btn.dataset.column = actualCol;
                btn.style.cssText =
                  "padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 0.85rem; border: 2px solid transparent; cursor: pointer; background: #fef3c7; color: #92400e;";
                btn.innerHTML = `<i class="fas fa-tag"></i> ${escapeHtml(actualCol)}`;

                btn.addEventListener("click", async () => {
                  attributeButtonsContainer
                    .querySelectorAll(".attribute-filter-btn")
                    .forEach((b) => {
                      b.style.borderColor = "transparent";
                      b.style.background = "#fef3c7";
                      b.style.color = "#92400e";
                    });
                  btn.style.borderColor = "#1a4d3a";
                  btn.style.background = "#e8f3ef";
                  btn.style.color = "#1a4d3a";
                  distinctValuesContainer.style.display = "block";
                  distinctValuesTitle.innerHTML = `<i class="fas fa-list"></i> Valeurs distinctes de "${escapeHtml(actualCol)}"`;
                  distinctValuesCheckboxes.innerHTML =
                    '<p style="color: var(--text-muted);">Chargement des valeurs...</p>';

                  try {
                    const result =
                      await window.pywebview.api.get_distinct_values(
                        currentManipulateTable,
                        actualCol,
                        activeDbPath,
                      );
                    if (result?.success && result.values.length > 0) {
                      const activeValues =
                        window._activeValueFilters[actualCol] || null;
                      distinctValuesCheckboxes.innerHTML = "";
                      result.values.forEach((val) => {
                        const valStr = String(val);
                        const isChecked = activeValues
                          ? activeValues.includes(valStr)
                          : true;
                        const label = document.createElement("label");
                        label.style.cssText =
                          "display: flex; align-items: center; gap: 10px; padding: 6px 10px; background: #ffffff; border-radius: 4px; cursor: pointer; border: 1px solid #e2e8f0; font-size: 0.85rem;";
                        label.innerHTML = `
                          <input type="checkbox" class="distinct-value-chk" data-column="${escapeHtml(actualCol)}" value="${escapeHtml(valStr)}" ${isChecked ? "checked" : ""} style="width: 18px; height: 18px; cursor: pointer; accent-color: #1a4d3a;" />
                          <span style="flex: 1;">${escapeHtml(valStr)}</span>
                        `;
                        distinctValuesCheckboxes.appendChild(label);
                      });
                      showNotification(
                        `${result.values.length} valeur(s) trouvee(s)`,
                        true,
                      );
                    } else {
                      distinctValuesCheckboxes.innerHTML =
                        '<p style="color: #999; font-style: italic;">Aucune valeur trouvee pour cette colonne.</p>';
                    }
                  } catch (err) {
                    console.error(err);
                    distinctValuesCheckboxes.innerHTML =
                      '<p style="color: red;">Erreur lors du chargement.</p>';
                  }
                });
                attributeButtonsContainer.appendChild(btn);
              });
            }

            filterContentContainer.querySelector(
              "#btn-select-all-values",
            ).onclick = () => {
              distinctValuesCheckboxes
                .querySelectorAll(".distinct-value-chk")
                .forEach((chk) => {
                  chk.checked = true;
                });
            };
            filterContentContainer.querySelector(
              "#btn-deselect-all-values",
            ).onclick = () => {
              distinctValuesCheckboxes
                .querySelectorAll(".distinct-value-chk")
                .forEach((chk) => {
                  chk.checked = false;
                });
            };
            filterContentContainer.querySelector(
              "#btn-apply-value-filters",
            ).onclick = () => {
              const newFilters = {};
              distinctValuesCheckboxes
                .querySelectorAll(".distinct-value-chk")
                .forEach((chk) => {
                  const col = chk.getAttribute("data-column");
                  if (chk.checked) {
                    if (!newFilters[col]) newFilters[col] = [];
                    newFilters[col].push(chk.value);
                  }
                });
              window._activeValueFilters = newFilters;
              applyValueFilters();
              const filterCount = Object.keys(newFilters).length;
              if (filterCount === 0) {
                showNotification(
                  "Aucun filtre actif. Toutes les donnees sont affichees.",
                  true,
                );
              } else {
                showNotification(
                  `Filtres appliques sur ${filterCount} colonne(s).`,
                  true,
                );
              }
            };
            filterContentContainer.querySelector(
              "#btn-reset-value-filters",
            ).onclick = () => {
              window._activeValueFilters = {};
              distinctValuesCheckboxes
                .querySelectorAll(".distinct-value-chk")
                .forEach((chk) => {
                  chk.checked = true;
                });
              displayManipulateData(
                currentManipulateData,
                resultsContainer,
                countSpan,
                currentManipulateTotalCount,
                currentManipulateTable,
              );
              showNotification("Filtres reinitialises.", true);
            };
          }

          function renderFilterColumnsMode() {
            btnFilterColumnsMode.className = "button button-primary";
            btnFilterColumnsMode.style.background = "var(--primary, #4f46e5)";
            btnFilterColumnsMode.style.color = "white";
            btnFilterResultsMode.className = "secondary-button";
            btnFilterResultsMode.style.background = "";
            btnFilterResultsMode.style.color = "";

            const activeCols =
              window._activeColumnFilters || allColumns.slice();

            filterContentContainer.innerHTML = `
              <div style="margin-bottom: 1rem;">
                <h4 style="margin-bottom: 12px; color: var(--text-color); font-weight: bold;">
                  <i class="fas fa-columns"></i> Filtrer les colonnes a afficher
                </h4>
                <div style="margin-bottom: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
                  <button id="btn-select-all-cols" class="secondary-button" style="padding: 0.3rem 0.8rem; font-size: 0.8rem;">Tout cocher</button>
                  <button id="btn-deselect-all-cols" class="secondary-button" style="padding: 0.3rem 0.8rem; font-size: 0.8rem;">Tout decocher</button>
                </div>
                <div id="columns-checkboxes-container" style="display: flex; gap: 8px; flex-wrap: wrap;"></div>
              </div>
              <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                <button id="btn-apply-column-filters" class="button button-primary" style="padding: 0.5rem 1.5rem;">
                  <i class="fas fa-check"></i> Appliquer
                </button>
                <button id="btn-reset-column-filters" class="secondary-button" style="padding: 0.5rem 1.5rem;">
                  <i class="fas fa-undo"></i> Reinitialiser
                </button>
              </div>
            `;

            const columnsCheckboxesContainer =
              filterContentContainer.querySelector(
                "#columns-checkboxes-container",
              );
            allColumns.forEach((col) => {
              const isChecked = activeCols.includes(col);
              const label = document.createElement("label");
              label.style.cssText =
                "display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; background: var(--bg-secondary, #e2e8f0); border-radius: 6px; cursor: pointer; font-weight: 600; color: var(--text-color, #111); border: 1px solid var(--border-color, #cbd5e1); font-size: 0.85rem;";
              label.innerHTML = `
                <input type="checkbox" class="column-filter-chk" value="${escapeHtml(col)}" ${isChecked ? "checked" : ""} style="width: 18px; height: 18px; cursor: pointer;" />
                <span>${escapeHtml(col)}</span>
              `;
              columnsCheckboxesContainer.appendChild(label);
            });
            filterContentContainer.querySelector(
              "#btn-select-all-cols",
            ).onclick = () => {
              columnsCheckboxesContainer
                .querySelectorAll(".column-filter-chk")
                .forEach((chk) => {
                  chk.checked = true;
                });
            };
            filterContentContainer.querySelector(
              "#btn-deselect-all-cols",
            ).onclick = () => {
              columnsCheckboxesContainer
                .querySelectorAll(".column-filter-chk")
                .forEach((chk) => {
                  chk.checked = false;
                });
            };
            filterContentContainer.querySelector(
              "#btn-apply-column-filters",
            ).onclick = () => {
              const selectedCols = Array.from(
                columnsCheckboxesContainer.querySelectorAll(
                  ".column-filter-chk:checked",
                ),
              ).map((chk) => chk.value);
              if (selectedCols.length === 0) {
                showNotification(
                  "Selectionnez au moins une colonne a afficher.",
                  false,
                );
                return;
              }
              window._activeColumnFilters = selectedCols;
              const filteredData = currentManipulateFiltered.map((row) => {
                const newRow = {};
                selectedCols.forEach((col) => {
                  newRow[col] = row[col];
                });
                return newRow;
              });
              displayManipulateData(
                filteredData,
                resultsContainer,
                countSpan,
                currentManipulateTotalCount,
                currentManipulateTable,
              );
              showNotification(
                `Affichage de ${selectedCols.length} colonne(s).`,
                true,
              );
            };
            filterContentContainer.querySelector(
              "#btn-reset-column-filters",
            ).onclick = () => {
              window._activeColumnFilters = null;
              columnsCheckboxesContainer
                .querySelectorAll(".column-filter-chk")
                .forEach((chk) => {
                  chk.checked = true;
                });
              displayManipulateData(
                currentManipulateFiltered,
                resultsContainer,
                countSpan,
                currentManipulateTotalCount,
                currentManipulateTable,
              );
              showNotification("Toutes les colonnes sont affichees.", true);
            };
          }

          btnFilterResultsMode.onclick = () => {
            renderFilterResultsMode();
          };
          btnFilterColumnsMode.onclick = () => {
            renderFilterColumnsMode();
          };
          renderFilterResultsMode();
          filtersArea.querySelector("#btn-close-filters").onclick = () => {
            filtersArea.classList.add("hidden");
            filtersArea.style.display = "none";
            btnFilters.style.background = "";
            btnFilters.style.color = "";
          };
          this.style.background = "var(--primary, #4f46e5)";
          this.style.color = "white";
        }
      } catch (e) {
        console.error(e);
        showNotification("Erreur lors du chargement des colonnes.", false);
      }
    };
  }

  function applyValueFilters() {
    if (!currentManipulateData || currentManipulateData.length === 0) return;
    const filters = window._activeValueFilters || {};
    const filterKeys = Object.keys(filters);
    if (filterKeys.length === 0) {
      currentManipulateFiltered = currentManipulateData;
      displayManipulateData(
        currentManipulateData,
        resultsContainer,
        countSpan,
        currentManipulateTotalCount,
        currentManipulateTable,
      );
      return;
    }
    const filtered = currentManipulateData.filter((row) => {
      return filterKeys.every((col) => {
        const allowedValues = filters[col];
        const rowValue = String(row[col] ?? "");
        return allowedValues.includes(rowValue);
      });
    });
    currentManipulateFiltered = filtered;
    displayManipulateData(
      filtered,
      resultsContainer,
      countSpan,
      currentManipulateTotalCount,
      currentManipulateTable,
    );
    if (filtered.length === 0) {
      showNotification(
        "Aucun resultat ne correspond aux filtres selectionnes.",
        false,
      );
    }
  }

  const btnOperations = document.querySelector("#btn-manipulate-operations");
  if (btnOperations) {
    btnOperations.addEventListener("click", async function () {
      if (!currentManipulateTable) {
        showNotification("Veuillez d'abord selectionner une table.", false);
        return;
      }
      const isVisible =
        operationsArea && !operationsArea.classList.contains("hidden");
      if (isVisible) {
        operationsArea.classList.add("hidden");
        operationsArea.style.display = "none";
        this.style.background = "";
        this.style.color = "";
        return;
      }
      if (searchBarArea) {
        searchBarArea.classList.add("hidden");
        searchBarArea.style.display = "none";
      }
      if (filtersArea) {
        filtersArea.classList.add("hidden");
        filtersArea.style.display = "none";
      }
      operationsArea.classList.remove("hidden");
      operationsArea.style.display = "flex";
      await initAdvancedQuerySelects(currentManipulateTable);
      this.style.background = "var(--primary, #4f46e5)";
      this.style.color = "white";
    });
  }

  const btnExecuteOp = document.getElementById("btn-execute-operation");
  if (btnExecuteOp) {
    btnExecuteOp.addEventListener("click", async () => {
      if (!currentManipulateTable) {
        showNotification("Veuillez d'abord selectionner une table.", false);
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
        const activeDbPath = sessionStorage.getItem("current_db_path");
        showNotificationWithProgress(
          `Execution de "${opNames[opType] || opType}"...`,
          30,
          true,
        );
        const res = await window.pywebview.api.execute_custom_sql_operation(
          currentManipulateTable,
          opType,
          attribute,
          value,
          groupBy,
          activeDbPath,
        );
        showNotificationWithProgress("Operation terminee", 100, true);
        if (res?.success) {
          currentManipulateData = res.data;
          currentManipulateFiltered = res.data;
          currentManipulateTotalCount = res.data.length;
          displayManipulateData(
            res.data,
            resultsContainer,
            countSpan,
            res.data.length,
            currentManipulateTable,
          );
          showNotification(
            `${opNames[opType] || opType} executee : ${res.data.length} resultat(s).`,
            true,
          );
          logUserAction(`Execution de ${opType} sur ${currentManipulateTable}`);
        } else {
          showNotification(
            res?.message || "Erreur lors de l'execution.",
            false,
          );
        }
      } catch (err) {
        console.error(err);
        showNotification("Erreur de communication avec l'API.", false);
      }
    });
  }

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
        firstOpBtn.style.background = "var(--primary-color, #1a4d3a)";
        firstOpBtn.style.color = "#ffffff";
      }
      if (currentManipulateTable) {
        loadManipulateTableData(currentManipulateTable, currentManipulatePage);
      }
      showNotification("Formulaire reinitialise.", true);
    });
  }
}

// ============================================
// CHARGEMENT DES DONNEES - PAGINATION SERVEUR
// ============================================
async function loadManipulateTableData(tableName, page = 1) {
  const container = document.querySelector(
    "#manipulate-results-table-container",
  );
  const countSpan = document.querySelector("#manipulate-response-count");
  if (!container) return;

  // ✅ SECURITE : refuser une table vide
  if (!tableName || String(tableName).trim() === "") {
    console.error("[loadManipulateTableData] Table vide !");
    container.innerHTML =
      "<p style='color: red;'>Erreur : aucune table selectionnee. Veuillez selectionner une table.</p>";
    if (countSpan) countSpan.textContent = "0";
    return;
  }

  // ✅ Restaurer la variable globale (au cas ou)
  currentManipulateTable = tableName;
  currentManipulatePage = page;

  console.log(
    `[loadManipulateTableData] Chargement table="${tableName}", page=${page}`,
  );

  try {
    const activeDbPath = sessionStorage.getItem("current_db_path");
    const offset = (page - 1) * MANIPULATE_PER_PAGE;

    const res = await window.pywebview.api.get_table_rows(
      tableName,
      activeDbPath,
      MANIPULATE_PER_PAGE,
      offset,
    );

    if (res && res.success) {
      currentManipulateData = res.data;
      currentManipulateFiltered = res.data;
      currentManipulateTotalCount = res.total_count || res.data.length;

      if (
        window._activeValueFilters &&
        Object.keys(window._activeValueFilters).length > 0
      ) {
        const filters = window._activeValueFilters;
        const filterKeys = Object.keys(filters);
        const filtered = currentManipulateData.filter((row) => {
          return filterKeys.every((col) => {
            const allowedValues = filters[col];
            const rowValue = String(row[col] ?? "");
            return allowedValues.includes(rowValue);
          });
        });
        currentManipulateFiltered = filtered;
        displayManipulateData(
          filtered,
          container,
          countSpan,
          currentManipulateTotalCount,
          tableName,
        );
      } else {
        displayManipulateData(
          res.data,
          container,
          countSpan,
          currentManipulateTotalCount,
          tableName,
        );
      }
    } else {
      container.innerHTML = `<p style="color: red;">Erreur : ${escapeHtml(res?.message || "table introuvable")}</p>`;
      if (countSpan) countSpan.textContent = "0";
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Erreur lors du chargement.</p>";
  }
}

// ============================================
// AFFICHAGE - PAGINATION
// ============================================
function displayManipulateData(
  dataArray,
  container,
  countSpan,
  totalCount = null,
  tableName = null,
) {
  if (!container) return;
  if (!dataArray || dataArray.length === 0) {
    container.innerHTML = "<p>Aucune donnee trouvee.</p>";
    if (countSpan) countSpan.textContent = "0";
    return;
  }

  // ✅ Utiliser la table passee en parametre, sinon la globale
  const activeTable = tableName || currentManipulateTable;

  if (!activeTable) {
    console.error("[displayManipulateData] Aucune table active !");
    container.innerHTML =
      "<p style='color: red;'>Erreur : aucune table selectionnee.</p>";
    return;
  }

  const displayedCount = dataArray.length;
  const realTotal =
    totalCount !== null && totalCount !== undefined
      ? totalCount
      : displayedCount;

  if (countSpan) {
    if (realTotal > displayedCount || currentManipulatePage > 1) {
      const start = (currentManipulatePage - 1) * MANIPULATE_PER_PAGE + 1;
      const end = start + displayedCount - 1;
      countSpan.innerHTML = `<strong>${start}</strong> - <strong>${end}</strong> sur <strong>${realTotal}</strong>`;
      countSpan.style.color = "var(--primary-color)";
      countSpan.style.fontWeight = "600";
    } else {
      countSpan.textContent = displayedCount;
      countSpan.style.color = "var(--primary-color)";
      countSpan.style.fontWeight = "normal";
    }
  }

  // ✅ Pagination avec capture de la table dans une closure
  const paginationEl = buildPaginationControls({
    currentPage: currentManipulatePage,
    totalItems: realTotal,
    perPage: MANIPULATE_PER_PAGE,
    onPageChange: (newPage) => {
      console.log(`[Pagination] Page ${newPage} de la table "${activeTable}"`);
      loadManipulateTableData(activeTable, newPage);
    },
  });

  const keys = Object.keys(dataArray[0]);
  let html = `
    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; background: var(--bg-container, #fff); color: var(--text-color, #000);">
      <thead style="position: sticky; top: 0; background: var(--bg-secondary, #f1f5f9); z-index: 2;">
        <tr style="border-bottom: 2px solid #cbd5e1;">
          <th style="padding: 10px; border-right: 1px solid #e2e8f0; text-align: center; width: 100px;">Actions</th>
          ${keys.map((k) => `<th style="padding: 10px; border-right: 1px solid #e2e8f0; text-align: left;">${escapeHtml(k)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
  `;

  dataArray.forEach((row, idx) => {
    html += `<tr style="border-bottom: 1px solid #e2e8f0;">`;
    const rowId = row.rowid || row.id || idx + 1;
    html += `
      <td style="padding: 8px 10px; border-right: 1px solid #e2e8f0; text-align: center; white-space: nowrap;">
        <button class="btn-manipulate-edit" data-rowid="${rowId}" title="Modifier" style="background: #f39c12; color: white; border: none; padding: 3px 6px; border-radius: 3px; cursor: pointer; font-size: 0.7rem; margin-right: 3px;">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn-manipulate-delete" data-rowid="${rowId}" title="Supprimer" style="background: #dc3545; color: white; border: none; padding: 3px 6px; border-radius: 3px; cursor: pointer; font-size: 0.7rem;">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    keys.forEach((k) => {
      html += `<td style="padding: 8px 10px; border-right: 1px solid #e2e8f0;">${escapeHtml(row[k])}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;

  container.innerHTML = "";
  container.appendChild(paginationEl);
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  container.appendChild(wrapper);

  // Listeners
  container.querySelectorAll(".btn-manipulate-edit").forEach((btn) => {
    btn.addEventListener("click", function () {
      const rowId = parseInt(this.getAttribute("data-rowid"));
      const row = currentManipulateData.find(
        (r, i) => (r.rowid || r.id || i + 1) === rowId,
      );
      if (row) openEditModal(currentManipulateTable, rowId, row, false);
    });
  });

  container.querySelectorAll(".btn-manipulate-delete").forEach((btn) => {
    btn.addEventListener("click", async function () {
      const rowId = parseInt(this.getAttribute("data-rowid"));
      if (!confirm(`Supprimer la ligne #${rowId} ?`)) return;
      try {
        const activeDbPath = sessionStorage.getItem("current_db_path");
        const res = await window.pywebview.api.delete_table_row(
          currentManipulateTable,
          rowId,
          activeDbPath,
        );
        if (res && res.success) {
          showNotification("Ligne supprimee avec succes.", true);
          logUserAction(
            `Suppression de la ligne #${rowId} dans ${currentManipulateTable}`,
          );
          await loadManipulateTableData(
            currentManipulateTable,
            currentManipulatePage,
          );
        } else {
          showNotification(
            res?.message || "Erreur lors de la suppression.",
            false,
          );
        }
      } catch (err) {
        console.error(err);
        showNotification("Erreur lors de la suppression.", false);
      }
    });
  });
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
      tableSelect.innerHTML =
        '<option value="">-- Choisir une table --</option>';
      tablesRes.tables.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = t;
        tableSelect.appendChild(opt);
      });
    }
  } catch (e) {
    console.error("Erreur lors du chargement des tables", e);
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
      attrSelect.innerHTML =
        '<option value="">-- Toutes les colonnes (*) --</option>';
      columns.forEach((col) => {
        const opt = document.createElement("option");
        opt.value = col;
        opt.textContent = col;
        attrSelect.appendChild(opt);
      });
    }
    if (groupSelect) {
      groupSelect.innerHTML = '<option value="">-- Aucun --</option>';
      columns.forEach((col) => {
        const opt = document.createElement("option");
        opt.value = col;
        opt.textContent = col;
        groupSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("Erreur lors du chargement des attributs:", err);
  }
}

// ============================================
// MODAL PLEIN ECRAN
// ============================================
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
      <div style="background: #ffffff; color: #1a1a2e; width: 100vw; height: 100vh; border-radius: 0; display: flex; flex-direction: column; overflow: hidden;">
        <div style="padding: 16px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
          <h2 id="modal-title-text" style="margin: 0; font-size: 1.4rem; display: flex; align-items: center; gap: 12px; color: #1a1a2e;">
            <i class="fas fa-expand" style="color: #1a4d3a;"></i>
            <span style="color: #1a1a2e;">${titleText}</span>
          </h2>
          <button type="button" id="close-fullscreen-modal" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: #1a1a2e;">&times;</button>
        </div>
        <div id="fullscreen-modal-body" style="padding: 24px; overflow-y: auto; flex: 1; background: #ffffff; color: #1a1a2e;"></div>
        <div style="padding: 14px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc; display: flex; justify-content: flex-end; gap: 10px;">
          <button type="button" class="button button-primary" id="modal-btn-select-all" style="background: #1a4d3a; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
            <i class="fas fa-check-double"></i> Tout selectionner
          </button>
          <button type="button" class="button button-primary" id="modal-btn-delete" style="background: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
            <i class="fas fa-trash"></i> Supprimer selectionnes
          </button>
          <button type="button" class="secondary-button" id="modal-btn-fermer" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
            <i class="fas fa-times"></i> Fermer
          </button>
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
  let cleanHtml = htmlContent;
  if (cleanHtml.includes("<table")) {
    cleanHtml = cleanHtml.replace(
      /<table/g,
      '<table style="width: 100%; border-collapse: collapse; background: #ffffff; color: #1a1a2e;"',
    );
    cleanHtml = cleanHtml.replace(
      /<th/g,
      '<th style="background: #1a4d3a; color: white; padding: 10px; text-align: left; border: 1px solid #e2e8f0;"',
    );
    cleanHtml = cleanHtml.replace(
      /<td/g,
      '<td style="padding: 8px 10px; border: 1px solid #e2e8f0; background: #ffffff; color: #1a1a2e;"',
    );
    cleanHtml = cleanHtml.replace(/<tr/g, '<tr style="background: #ffffff;"');
  }
  document.getElementById("fullscreen-modal-body").innerHTML = cleanHtml;
  modalOverlay.style.display = "flex";

  const modalSelectAllBtn = document.getElementById("modal-btn-select-all");
  if (modalSelectAllBtn) {
    modalSelectAllBtn.onclick = () => {
      const checkboxes = document.querySelectorAll(
        "#fullscreen-modal-body .dup-checkbox, #fullscreen-modal-body input[type='checkbox']",
      );
      if (checkboxes.length === 0) {
        showNotification("Aucune case a cocher trouvee.", false);
        return;
      }
      const allChecked = Array.from(checkboxes).every((chk) => chk.checked);
      checkboxes.forEach((chk) => {
        chk.checked = !allChecked;
      });
      showNotification(
        allChecked ? "Tout deselectionne" : "Tout selectionne",
        true,
      );
    };
  }

  const modalDeleteBtn = document.getElementById("modal-btn-delete");
  if (modalDeleteBtn) {
    modalDeleteBtn.onclick = async () => {
      const checkedBoxes = document.querySelectorAll(
        "#fullscreen-modal-body .dup-checkbox:checked, #fullscreen-modal-body input[type='checkbox']:checked",
      );
      if (checkedBoxes.length === 0) {
        showNotification("Veuillez selectionner au moins un element.", false);
        return;
      }
      if (
        !confirm(`Supprimer ${checkedBoxes.length} element(s) selectionne(s) ?`)
      )
        return;
      try {
        const duplicatesToDelete = [];
        checkedBoxes.forEach((chk) => {
          const tableName = chk.getAttribute("data-table");
          const rowIndex = chk.getAttribute("data-rowid");
          if (tableName && rowIndex) {
            duplicatesToDelete.push({
              tableName,
              row_index: parseInt(rowIndex),
            });
          }
        });
        if (duplicatesToDelete.length === 0) {
          showNotification("Aucun element valide a supprimer.", false);
          return;
        }
        const activeDbPath = sessionStorage.getItem("current_db_path");
        const result = await window.pywebview.api.delete_duplicates_batch(
          duplicatesToDelete,
          activeDbPath,
        );
        if (result && result.success) {
          showNotification(
            `${result.deleted} element(s) supprime(s) en ${result.elapsed_seconds}s.`,
            true,
          );
          logUserAction(`Suppression de ${result.deleted} elements`);
          document.getElementById("fullscreen-modal-overlay").style.display =
            "none";
        } else {
          showNotification(
            result?.message || "Erreur lors de la suppression.",
            false,
          );
        }
      } catch (err) {
        console.error("Erreur lors de la suppression:", err);
        showNotification("Erreur lors de la suppression.", false);
      }
    };
  }

  const style = document.createElement("style");
  style.textContent = `
    #fullscreen-modal-body table { background: #ffffff !important; color: #1a1a2e !important; }
    #fullscreen-modal-body th { background: #1a4d3a !important; color: white !important; }
    #fullscreen-modal-body td { background: #ffffff !important; color: #1a1a2e !important; border: 1px solid #e2e8f0 !important; }
    #fullscreen-modal-body tr:nth-child(even) td { background: #f8fafc !important; }
    #fullscreen-modal-body tr:hover td { background: #e8f3ef !important; }
  `;
  document.getElementById("fullscreen-modal-body").appendChild(style);
}

// ============================================
// REQUETES STATISTIQUES
// ============================================
function initStatisticalQueries() {
  const btnOpenStats = document.getElementById("btn-open-statistical-queries");
  if (btnOpenStats) {
    btnOpenStats.addEventListener("click", () => {
      openStatisticalQueriesModal();
    });
  }
}

function openStatisticalQueriesModal() {
  if (!isDbOpen) {
    showNotification("Veuillez d'abord ouvrir une base de donnees.", false);
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = "edit-modal-overlay";
  overlay.style.zIndex = "99998";

  overlay.innerHTML = `
    <div style="background: #ffffff; border-radius: 12px; padding: 1.5rem; max-width: 900px; width: 95%; max-height: 85vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="margin: 0; color: #1a1a2e;">
          <i class="fas fa-chart-bar" style="color: #1a4d3a;"></i> Requetes statistiques
        </h3>
        <button type="button" id="close-stats-modal" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: #1a1a2e;">&times;</button>
      </div>
      <p style="color: #64748b; margin-bottom: 1.5rem;">Selectionnez une requete pour obtenir des statistiques sur vos donnees.</p>
      <div id="stats-query-buttons" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; margin-bottom: 1.5rem;">
        <button class="stat-query-btn" data-query="femmes_par_tranche_age" style="padding: 12px; border: 2px solid #1a4d3a; border-radius: 8px; background: #ffffff; color: #1a4d3a; font-weight: 600; cursor: pointer; text-align: left;"><i class="fas fa-female"></i> Femmes par tranche d'age</button>
        <button class="stat-query-btn" data-query="personnes_par_commune" style="padding: 12px; border: 2px solid #1a4d3a; border-radius: 8px; background: #ffffff; color: #1a4d3a; font-weight: 600; cursor: pointer; text-align: left;"><i class="fas fa-map-marker-alt"></i> Personnes par commune</button>
        <button class="stat-query-btn" data-query="personnes_par_lieu" style="padding: 12px; border: 2px solid #1a4d3a; border-radius: 8px; background: #ffffff; color: #1a4d3a; font-weight: 600; cursor: pointer; text-align: left;"><i class="fas fa-location-dot"></i> Personnes par lieu (fkt)</button>
        <button class="stat-query-btn" data-query="superficie_par_personne" style="padding: 12px; border: 2px solid #1a4d3a; border-radius: 8px; background: #ffffff; color: #1a4d3a; font-weight: 600; cursor: pointer; text-align: left;"><i class="fas fa-ruler-combined"></i> Superficie par personne</button>
        <button class="stat-query-btn" data-query="hommes_femmes" style="padding: 12px; border: 2px solid #1a4d3a; border-radius: 8px; background: #ffffff; color: #1a4d3a; font-weight: 600; cursor: pointer; text-align: left;"><i class="fas fa-venus-mars"></i> Repartition Hommes / Femmes</button>
        <button class="stat-query-btn" data-query="personnes_par_filiere" style="padding: 12px; border: 2px solid #1a4d3a; border-radius: 8px; background: #ffffff; color: #1a4d3a; font-weight: 600; cursor: pointer; text-align: left;"><i class="fas fa-seedling"></i> Personnes par filiere</button>
        <button class="stat-query-btn" data-query="personnes_par_categorisation" style="padding: 12px; border: 2px solid #1a4d3a; border-radius: 8px; background: #ffffff; color: #1a4d3a; font-weight: 600; cursor: pointer; text-align: left;"><i class="fas fa-users"></i> Personnes par categorisation EAF</button>
        <button class="stat-query-btn" data-query="age_moyen" style="padding: 12px; border: 2px solid #1a4d3a; border-radius: 8px; background: #ffffff; color: #1a4d3a; font-weight: 600; cursor: pointer; text-align: left;"><i class="fas fa-birthday-cake"></i> Age moyen des personnes</button>
        <button class="stat-query-btn" data-query="superficie_totale" style="padding: 12px; border: 2px solid #1a4d3a; border-radius: 8px; background: #ffffff; color: #1a4d3a; font-weight: 600; cursor: pointer; text-align: left;"><i class="fas fa-chart-area"></i> Superficie totale</button>
      </div>
      <div id="stats-query-params" style="margin-bottom: 1.5rem; display: none;"></div>
      <div id="stats-query-results" style="background: #f8fafc; border-radius: 8px; padding: 1rem; min-height: 100px; color: #334155;">
        <p style="color: #64748b; text-align: center;"><i class="fas fa-info-circle"></i> Selectionnez une requete pour afficher les resultats.</p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();
  overlay.querySelector("#close-stats-modal").onclick = closeModal;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  const resultsContainer = overlay.querySelector("#stats-query-results");
  const paramsContainer = overlay.querySelector("#stats-query-params");

  overlay.querySelectorAll(".stat-query-btn").forEach((btn) => {
    btn.addEventListener("click", async function () {
      overlay.querySelectorAll(".stat-query-btn").forEach((b) => {
        b.style.background = "#ffffff";
        b.style.color = "#1a4d3a";
      });
      this.style.background = "#1a4d3a";
      this.style.color = "#ffffff";

      const queryType = this.getAttribute("data-query");
      paramsContainer.style.display = "none";
      paramsContainer.innerHTML = "";

      if (queryType === "femmes_par_tranche_age") {
        paramsContainer.style.display = "block";
        paramsContainer.innerHTML = `
          <div style="background: #e8f3ef; padding: 12px; border-radius: 6px; margin-bottom: 12px;">
            <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #1a1a2e;">Age minimum :</label>
            <input type="number" id="stat-age-min" value="0" min="0" max="120" style="padding: 8px; border-radius: 4px; border: 1px solid #cbd5e1; width: 100px; margin-right: 12px;" />
            <label style="display: block; font-weight: 600; margin-bottom: 6px; margin-top: 8px; color: #1a1a2e;">Age maximum :</label>
            <input type="number" id="stat-age-max" value="120" min="0" max="120" style="padding: 8px; border-radius: 4px; border: 1px solid #cbd5e1; width: 100px;" />
          </div>
        `;
      }

      resultsContainer.innerHTML =
        '<p style="text-align: center; color: #64748b;"><i class="fas fa-spinner fa-spin"></i> Chargement...</p>';

      try {
        await waitForApi();
        const activeDbPath = sessionStorage.getItem("current_db_path");
        const params = {};
        if (queryType === "femmes_par_tranche_age") {
          params.age_min = parseInt(
            overlay.querySelector("#stat-age-min")?.value || 0,
          );
          params.age_max = parseInt(
            overlay.querySelector("#stat-age-max")?.value || 120,
          );
        } else if (queryType === "personnes_par_lieu") {
          params.lieu_type = "fkt";
        }
        const result = await window.pywebview.api.execute_statistical_query(
          queryType,
          params,
          activeDbPath,
        );

        if (result?.success && result.data.length > 0) {
          let html =
            '<table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">';
          html += '<thead><tr style="background: #1a4d3a; color: white;">';
          const firstRow = result.data[0];
          Object.keys(firstRow).forEach((k) => {
            html += `<th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0;">${escapeHtml(k)}</th>`;
          });
          html += "</tr></thead><tbody>";
          result.data.forEach((row, idx) => {
            html += `<tr style="background: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">`;
            Object.values(row).forEach((val) => {
              html += `<td style="padding: 8px 10px; border: 1px solid #e2e8f0;">${escapeHtml(String(val ?? ""))}</td>`;
            });
            html += "</tr>";
          });
          html += "</tbody></table>";
          resultsContainer.innerHTML = html;
          logUserAction(`Requete statistique : ${queryType}`);
        } else {
          resultsContainer.innerHTML =
            '<p style="text-align: center; color: #f39c12;"><i class="fas fa-info-circle"></i> Aucun resultat pour cette requete.</p>';
        }
      } catch (err) {
        console.error(err);
        resultsContainer.innerHTML =
          '<p style="text-align: center; color: #ef4444;"><i class="fas fa-exclamation-circle"></i> Erreur lors du chargement.</p>';
      }
    });
  });
}

// ============================================
// A PROPOS / MISES A JOUR / CONTACT
// ============================================
async function getAppInfo() {
  if (appInfoCache) return appInfoCache;
  try {
    await waitForApi();
    const info = await window.pywebview.api.get_app_info();
    if (info && info.success) {
      appInfoCache = info;
      return info;
    }
  } catch (e) {
    console.error("Erreur get_app_info:", e);
  }
  return null;
}

async function updateFooterVersion() {
  try {
    const info = await getAppInfo();
    const el = document.getElementById("footer-version");
    if (el && info) el.textContent = info.app_version || "1.0.0";
  } catch (e) {}
}

async function showAboutModal() {
  const info = await getAppInfo();
  const appName = info?.app_name || "xl2db";
  const appVersion = info?.app_version || "1.0.2";
  const devName = info?.developer_name || "DadaRaBed";
  const devEmail = info?.developer_email || "nanoonadjah3@gmail.com";
  const githubRepo = info?.github_repo || "DadaRaBed";
  const pythonVersion = info?.python_version || "-";
  const platform = info?.platform || "-";

  const overlay = document.createElement("div");
  overlay.className = "edit-modal-overlay";
  overlay.style.zIndex = "99997";

  overlay.innerHTML = `
    <div style="background: #ffffff; border-radius: 12px; padding: 0; max-width: 720px; width: 95%; max-height: 88vh; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); display: flex; flex-direction: column;">
      <div style="background: linear-gradient(135deg, #1a4d3a, #3d8b6a); color: white; padding: 24px; display: flex; align-items: center; gap: 16px;">
        <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; font-weight: 700;">XL</div>
        <div style="flex: 1;">
          <h2 style="margin: 0 0 4px 0; font-size: 1.6rem;">${escapeHtml(appName)}</h2>
          <div style="opacity: 0.9; font-size: 0.95rem;">Version ${escapeHtml(appVersion)} - Expert Edition</div>
        </div>
        <button type="button" id="close-about-modal" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 1.5rem; cursor: pointer; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">&times;</button>
      </div>
      <div style="padding: 24px; overflow-y: auto; flex: 1;">
        <h3 style="margin: 0 0 12px 0; color: #1a1a2e; display: flex; align-items: center; gap: 8px; font-size: 1.1rem;">
          <i class="fas fa-book" style="color: #1a4d3a;"></i> Guide de l'application
        </h3>
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #1a4d3a;">
          <div style="margin-bottom: 14px;">
            <strong style="color: #1a4d3a; display: block; margin-bottom: 4px;"><i class="fas fa-file-import"></i> 1. Importer un fichier Excel</strong>
            <div style="color: #475569; font-size: 0.9rem;">Convertissez un fichier Excel (.xlsx, .xls) en base de donnees SQLite. Chaque feuille devient une table.</div>
          </div>
          <div style="margin-bottom: 14px;">
            <strong style="color: #1a4d3a; display: block; margin-bottom: 4px;"><i class="fas fa-folder-open"></i> 2. Travailler avec une base existante</strong>
            <div style="color: #475569; font-size: 0.9rem;">Ouvrez une base de donnees existante pour la manipuler, chercher les doublons, ou l'exporter vers Excel.</div>
          </div>
          <div style="margin-bottom: 14px;">
            <strong style="color: #1a4d3a; display: block; margin-bottom: 4px;"><i class="fas fa-clone"></i> 3. Trouver les doublons</strong>
            <div style="color: #475569; font-size: 0.9rem;">Detectez les doublons avec differents algorithmes : General, CIN+NOM, CIN+NOM+ANNEE, CIN+NOM+ANNEE+COMMUNE+FKT.</div>
          </div>
          <div style="margin-bottom: 14px;">
            <strong style="color: #1a4d3a; display: block; margin-bottom: 4px;"><i class="fas fa-users"></i> 4. Creer une liste mere</strong>
            <div style="color: #475569; font-size: 0.9rem;">Copiez TOUTES les lignes de TOUTES les tables dans une seule table <code>listes_meres</code>, avec tracabilite.</div>
          </div>
          <div style="margin-bottom: 14px;">
            <strong style="color: #1a4d3a; display: block; margin-bottom: 4px;"><i class="fas fa-sliders-h"></i> 5. Manipuler les donnees</strong>
            <div style="color: #475569; font-size: 0.9rem;">Filtrez, recherchez, modifiez, supprimez. Utilisez la pagination pour naviguer dans les grandes tables.</div>
          </div>
          <div>
            <strong style="color: #1a4d3a; display: block; margin-bottom: 4px;"><i class="fas fa-file-excel"></i> 6. Exporter vers Excel</strong>
            <div style="color: #475569; font-size: 0.9rem;">Exportez vos tables ou resultats vers Excel avec une mise en forme professionnelle automatique.</div>
          </div>
        </div>
        <h3 style="margin: 0 0 12px 0; color: #1a1a2e; display: flex; align-items: center; gap: 8px; font-size: 1.1rem;">
          <i class="fas fa-user-circle" style="color: #1a4d3a;"></i> A propos du developpeur
        </h3>
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <div style="font-size: 1rem; font-weight: 600; color: #1a1a2e; margin-bottom: 8px;">${escapeHtml(devName)}</div>
          <div style="color: #475569; font-size: 0.9rem; margin-bottom: 12px;">
            Developpeur de l'application ${escapeHtml(appName)}. N'hesitez pas a me contacter pour toute question, suggestion ou signalement de bug.
          </div>
          <div style="display: flex; align-items: center; gap: 8px; color: #475569; font-size: 0.9rem; margin-bottom: 8px;">
            <i class="fas fa-envelope" style="color: #1a4d3a; width: 18px;"></i>
            <a href="mailto:${escapeHtml(devEmail)}" style="color: #1a4d3a; text-decoration: none;">${escapeHtml(devEmail)}</a>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; color: #475569; font-size: 0.9rem;">
            <i class="fab fa-github" style="color: #1a4d3a; width: 18px;"></i>
            <a href="https://github.com/${escapeHtml(githubRepo)}" style="color: #1a4d3a; text-decoration: none;" onclick="window.pywebview.api.open_url_in_browser('https://github.com/${escapeHtml(githubRepo)}'); return false;">
              github.com/${escapeHtml(githubRepo)}
            </a>
          </div>
        </div>
        <details style="background: #f1f5f9; border-radius: 8px; padding: 12px 16px;">
          <summary style="cursor: pointer; font-weight: 600; color: #475569; font-size: 0.9rem;">
            <i class="fas fa-cog"></i> Informations techniques
          </summary>
          <div style="margin-top: 12px; font-size: 0.85rem; color: #64748b;">
            <div><strong>Version :</strong> ${escapeHtml(appVersion)}</div>
            <div><strong>Python :</strong> ${escapeHtml(pythonVersion)}</div>
            <div><strong>Plateforme :</strong> ${escapeHtml(platform)}</div>
            <div><strong>Mode :</strong> ${info?.frozen ? "EXE (PyInstaller)" : "DEV"}</div>
          </div>
        </details>
      </div>
      <div style="padding: 16px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc; display: flex; justify-content: flex-end; gap: 10px;">
        <button type="button" id="btn-close-about" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #6c757d; color: white;">Fermer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector("#close-about-modal").onclick = close;
  overlay.querySelector("#btn-close-about").onclick = close;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
}

async function checkForUpdates() {
  const overlay = document.createElement("div");
  overlay.className = "edit-modal-overlay";
  overlay.style.zIndex = "99997";

  overlay.innerHTML = `
    <div style="background: #ffffff; border-radius: 12px; padding: 2rem; max-width: 520px; width: 90%; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); text-align: center;">
      <div id="update-content">
        <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: #1a4d3a; margin-bottom: 1rem;"></i>
        <h3 style="margin: 0 0 0.5rem 0; color: #1a1a2e;">Verification des mises a jour...</h3>
        <p style="color: #64748b;">Connexion au serveur, veuillez patienter.</p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  const content = overlay.querySelector("#update-content");

  try {
    await waitForApi();
    const result = await window.pywebview.api.check_for_updates();

    // Cas "pas d'internet"
    if (result && result.no_internet) {
      content.innerHTML = `
        <i class="fas fa-wifi" style="font-size: 3rem; color: #dc3545; margin-bottom: 1rem;"></i>
        <h3 style="margin: 0 0 0.5rem 0; color: #1a1a2e;">Connexion impossible</h3>
        <p style="color: #64748b; margin-bottom: 1.5rem;">
          ${escapeHtml(result.message || "Pas de connexion internet ou reseau indisponible.")}
        </p>
        <button type="button" id="btn-close-updates" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #6c757d; color: white;">Fermer</button>
      `;
      content.querySelector("#btn-close-updates").onclick = close;
      return;
    }

    if (!result || !result.success) {
      content.innerHTML = `
        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #f39c12; margin-bottom: 1rem;"></i>
        <h3 style="margin: 0 0 0.5rem 0; color: #1a1a2e;">Verification impossible</h3>
        <p style="color: #64748b; margin-bottom: 1.5rem;">${escapeHtml(result?.message || "Erreur inconnue.")}</p>
        <button type="button" id="btn-close-updates" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #6c757d; color: white;">Fermer</button>
      `;
    } else if (result.up_to_date) {
      content.innerHTML = `
        <i class="fas fa-check-circle" style="font-size: 3rem; color: #27ae60; margin-bottom: 1rem;"></i>
        <h3 style="margin: 0 0 0.5rem 0; color: #1a1a2e;">Vous etes a jour !</h3>
        <p style="color: #64748b; margin-bottom: 1.5rem;">
          Version actuelle : <strong>${escapeHtml(result.current_version)}</strong>
        </p>
        <button type="button" id="btn-close-updates" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #27ae60; color: white;">Fermer</button>
      `;
    } else {
      content.innerHTML = `
        <i class="fas fa-download" style="font-size: 3rem; color: #1a4d3a; margin-bottom: 1rem;"></i>
        <h3 style="margin: 0 0 0.5rem 0; color: #1a1a2e;">Nouvelle version disponible !</h3>
        <p style="color: #64748b; margin-bottom: 0.5rem;">
          Version actuelle : <strong>${escapeHtml(result.current_version)}</strong>
        </p>
        <p style="color: #1a4d3a; font-weight: 600; margin-bottom: 1rem;">
          Nouvelle version : <strong>${escapeHtml(result.latest_version)}</strong>
        </p>
        ${
          result.release_notes
            ? `<div style="text-align: left; background: #f8fafc; border-radius: 6px; padding: 12px; margin-bottom: 1rem; max-height: 200px; overflow-y: auto; font-size: 0.85rem; color: #475569;">
                <strong style="display: block; margin-bottom: 6px; color: #1a1a2e;">Notes de version :</strong>
                <pre style="white-space: pre-wrap; word-wrap: break-word; font-family: inherit; margin: 0;">${escapeHtml(result.release_notes)}</pre>
              </div>`
            : ""
        }
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          <button type="button" id="btn-download-update" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #1a4d3a; color: white;">
            <i class="fas fa-download"></i> Telecharger et installer
          </button>
          <button type="button" id="btn-close-updates" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #6c757d; color: white;">Plus tard</button>
        </div>
      `;
      const downloadBtn = content.querySelector("#btn-download-update");
      if (downloadBtn) {
        downloadBtn.onclick = async () => {
          if (
            !confirm(
              "Mise a jour automatique\n\nL'application va :\n1. Telecharger la nouvelle version\n2. Se fermer automatiquement\n3. Se relancer avec la nouvelle version\n\nContinuer ?",
            )
          )
            return;
          downloadBtn.disabled = true;
          downloadBtn.innerHTML =
            '<i class="fas fa-spinner fa-spin"></i> Telechargement...';
          try {
            const res = await window.pywebview.api.download_and_install_update(
              result.download_url,
            );
            if (res && !res.success) {
              alert("Erreur : " + (res.message || "Echec."));
              downloadBtn.disabled = false;
              downloadBtn.innerHTML =
                '<i class="fas fa-download"></i> Telecharger et installer';
            }
          } catch (err) {
            alert("Erreur : " + err.message);
            downloadBtn.disabled = false;
            downloadBtn.innerHTML =
              '<i class="fas fa-download"></i> Telecharger et installer';
          }
        };
      }
    }
    const closeBtn = content.querySelector("#btn-close-updates");
    if (closeBtn) closeBtn.onclick = close;
  } catch (err) {
    console.error(err);
    content.innerHTML = `
      <i class="fas fa-times-circle" style="font-size: 3rem; color: #dc3545; margin-bottom: 1rem;"></i>
      <h3 style="margin: 0 0 0.5rem 0; color: #1a1a2e;">Erreur</h3>
      <p style="color: #64748b; margin-bottom: 1.5rem;">${escapeHtml(err.message || "Impossible de verifier.")}</p>
      <button type="button" id="btn-close-updates" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #6c757d; color: white;">Fermer</button>
    `;
    const closeBtn = content.querySelector("#btn-close-updates");
    if (closeBtn) closeBtn.onclick = close;
  }
}
function showContactModal() {
  const overlay = document.createElement("div");
  overlay.className = "edit-modal-overlay";
  overlay.style.zIndex = "99997";

  overlay.innerHTML = `
    <div style="background: #ffffff; border-radius: 12px; padding: 0; max-width: 560px; width: 95%; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); overflow: hidden;">
      <div style="background: linear-gradient(135deg, #1a4d3a, #3d8b6a); color: white; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between;">
        <h3 style="margin: 0; font-size: 1.2rem; display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-envelope"></i> Nous contacter
        </h3>
        <button type="button" id="close-contact-modal" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 1.5rem; cursor: pointer; width: 32px; height: 32px; border-radius: 50%;">&times;</button>
      </div>
      <div style="padding: 24px;">
        <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 1.5rem;">
          Envoyez un email au developpeur (DadaRaBed). Nous vous repondrons dans les plus brefs delais.
        </p>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #334155; font-size: 0.9rem;">Votre email (optionnel) :</label>
          <input type="email" id="contact-email" placeholder="votre.email@example.com" style="width: 100%; padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; box-sizing: border-box;" />
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #334155; font-size: 0.9rem;">Sujet :</label>
          <input type="text" id="contact-subject" placeholder="Sujet de votre message" value="[xl2db] Demande de contact" style="width: 100%; padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; box-sizing: border-box;" />
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #334155; font-size: 0.9rem;">Message :</label>
          <textarea id="contact-message" rows="6" placeholder="Decrivez votre demande, question ou suggestion..." style="width: 100%; padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; box-sizing: border-box; font-family: inherit; resize: vertical;"></textarea>
        </div>
        <div id="contact-message-status" style="margin-bottom: 1rem;"></div>
        <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 1.5rem;">
          <button type="button" id="btn-cancel-contact" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #6c757d; color: white;">Annuler</button>
          <button type="button" id="btn-send-contact" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #1a4d3a; color: white;">
            <i class="fas fa-paper-plane"></i> Envoyer
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector("#close-contact-modal").onclick = close;
  overlay.querySelector("#btn-cancel-contact").onclick = close;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  overlay.querySelector("#btn-send-contact").onclick = async () => {
    const email = overlay.querySelector("#contact-email").value.trim();
    const subject = overlay.querySelector("#contact-subject").value.trim();
    const message = overlay.querySelector("#contact-message").value.trim();
    const statusEl = overlay.querySelector("#contact-message-status");

    if (!message) {
      statusEl.innerHTML =
        '<p style="color: #dc3545; font-size: 0.9rem;"><i class="fas fa-exclamation-circle"></i> Veuillez ecrire un message.</p>';
      return;
    }
    statusEl.innerHTML =
      '<p style="color: #1a4d3a; font-size: 0.9rem;"><i class="fas fa-spinner fa-spin"></i> Envoi en cours...</p>';
    try {
      await waitForApi();
      const result = await window.pywebview.api.send_contact_email(
        subject,
        message,
        email,
      );
      if (result && result.success) {
        statusEl.innerHTML =
          '<p style="color: #27ae60; font-size: 0.9rem;"><i class="fas fa-check-circle"></i> ' +
          escapeHtml(result.message) +
          "</p>";
        logUserAction("Envoi d'un message de contact");
        setTimeout(() => {
          close();
          showNotification("Merci ! Votre message a ete transmis.", true);
        }, 1500);
      } else {
        statusEl.innerHTML =
          '<p style="color: #dc3545; font-size: 0.9rem;"><i class="fas fa-times-circle"></i> ' +
          escapeHtml(result?.message || "Erreur lors de l'envoi.") +
          "</p>";
      }
    } catch (err) {
      console.error(err);
      statusEl.innerHTML =
        '<p style="color: #dc3545; font-size: 0.9rem;"><i class="fas fa-times-circle"></i> Erreur : ' +
        escapeHtml(err.message) +
        "</p>";
    }
  };
}

// ============================================
// INITIALISATION DES NOUVELLES FONCTIONNALITES
// ============================================
function initNewFeatures() {
  const btnExportResult = document.getElementById("btn-export-result");
  if (btnExportResult) {
    btnExportResult.addEventListener("click", () => {
      const container = document.querySelector(
        "#manipulate-results-table-container",
      );
      if (!container || !container.querySelector("table")) {
        showNotification("Aucun resultat a exporter.", false);
        return;
      }
      showExportDialog(async (format) => {
        if (format === "pdf") await exportResultsToPDF();
        else if (format === "excel") await exportResultsToExcel();
      });
    });
  }

  const btnStats = document.getElementById("btn-generate-stats");
  if (btnStats) btnStats.addEventListener("click", generateStatistics);

  const btnChartNom = document.getElementById("btn-chart-nom");
  if (btnChartNom)
    btnChartNom.addEventListener("click", () => generateChart("nom"));
  const btnChartCin = document.getElementById("btn-chart-cin");
  if (btnChartCin)
    btnChartCin.addEventListener("click", () => generateChart("cin"));
  const btnChartRegion = document.getElementById("btn-chart-region");
  if (btnChartRegion)
    btnChartRegion.addEventListener("click", () => generateChart("region"));
  const btnChartAll = document.getElementById("btn-chart-all");
  if (btnChartAll) {
    btnChartAll.addEventListener("click", () => {
      document.querySelector("#charts-container").innerHTML = "";
      generateChart("all");
    });
  }

  const opButtons = ["sum", "avg", "min", "max", "count", "countif", "sort"];
  opButtons.forEach((op) => {
    const btn = document.getElementById(`btn-op-${op}`);
    if (btn) btn.addEventListener("click", () => performResultOperation(op));
  });

  const btnOpenDb = document.getElementById("btn-open-database");
  if (btnOpenDb) btnOpenDb.addEventListener("click", openSelectedDatabase);

  const btnDeleteSelectedDb = document.getElementById("btn-delete-selected-db");
  if (btnDeleteSelectedDb)
    btnDeleteSelectedDb.addEventListener("click", deleteSelectedDatabase);

  const terminateBtns = [
    document.getElementById("btn-terminate-database-existing"),
    document.getElementById("btn-terminate-database-duplicates"),
    document.getElementById("btn-terminate-database-manipulate"),
  ];
  terminateBtns.forEach((btn) => {
    if (btn) btn.addEventListener("click", terminateDatabase);
  });

  const btnCreateDb = document.getElementById("btn-create-db");
  if (btnCreateDb) {
    btnCreateDb.addEventListener("click", () => {
      resetCreateDbView();
      pushNavigationHistory("createDb");
      showView(createDbView);
    });
  }

  const btnCreateDbBack = document.getElementById("btn-create-db-back");
  if (btnCreateDbBack)
    btnCreateDbBack.addEventListener("click", () => showView(dashboardView));

  const btnSelectCreateExcel = document.getElementById(
    "btn-select-create-excel",
  );
  if (btnSelectCreateExcel)
    btnSelectCreateExcel.addEventListener("click", selectCreateDbExcelFile);

  const btnCreateFromExcel = document.getElementById("btn-create-from-excel");
  if (btnCreateFromExcel)
    btnCreateFromExcel.addEventListener("click", createDatabaseFromExcel);

  const btnCreateEmpty = document.getElementById("btn-create-empty");
  if (btnCreateEmpty)
    btnCreateEmpty.addEventListener("click", createEmptyDatabase);

  const btnExportCreated = document.getElementById("btn-export-created-db");
  if (btnExportCreated)
    btnExportCreated.addEventListener("click", exportCreatedDatabaseToExcel);

  const btnCreateMasterList = document.getElementById("btn-create-master-list");
  if (btnCreateMasterList)
    btnCreateMasterList.addEventListener("click", createMasterList);

  const btnOpenStats = document.getElementById("btn-open-statistical-queries");
  if (btnOpenStats)
    btnOpenStats.addEventListener("click", openStatisticalQueriesModal);

  document.querySelectorAll(".btn-back-global").forEach((btn) => {
    btn.addEventListener("click", goBack);
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest(".about-global-btn")) {
      e.preventDefault();
      showAboutModal();
      document
        .querySelectorAll(".user-menu")
        .forEach((m) => m.classList.add("hidden"));
    }
    if (e.target.closest(".updates-global-btn")) {
      e.preventDefault();
      checkForUpdates();
      document
        .querySelectorAll(".user-menu")
        .forEach((m) => m.classList.add("hidden"));
    }
    if (e.target.closest(".contact-global-btn")) {
      e.preventDefault();
      showContactModal();
      document
        .querySelectorAll(".user-menu")
        .forEach((m) => m.classList.add("hidden"));
    }
  });

  const footerCheckUpdates = document.getElementById("footer-check-updates");
  if (footerCheckUpdates)
    footerCheckUpdates.addEventListener("click", checkForUpdates);
  const footerContact = document.getElementById("footer-contact");
  if (footerContact) footerContact.addEventListener("click", showContactModal);

  // ============================================================
  // BOUTON "NETTOYER LES DONNEES"
  // ============================================================
  // ============================================================
  // BOUTON "2. NETTOYER LES DONNEES"
  // ============================================================
  const btnCleanDb = document.getElementById("btn-clean-db");
  if (btnCleanDb) {
    btnCleanDb.addEventListener("click", async () => {
      console.log("[CLEAN] === Bouton Nettoyer les donnees clique ===");

      if (!isDbOpen) {
        showNotification("Veuillez d'abord ouvrir une base de donnees.", false);
        return;
      }

      if (
        !confirm(
          "Nettoyer les donnees ?\n\n" +
            "Cette operation va remplacer toutes les valeurs vides (NaN/Null) par :\n" +
            "- 'Non specifie' pour les colonnes texte\n" +
            "- 0 pour les colonnes numeriques\n\n" +
            "Continuer ?",
        )
      )
        return;

      try {
        let activeDbPath = sessionStorage.getItem("current_db_path");
        console.log("[CLEAN] activeDbPath (sessionStorage) :", activeDbPath);

        if (!activeDbPath) {
          const dbFileSelect = document.getElementById("db-file-select");
          activeDbPath = dbFileSelect?.value;
          if (activeDbPath) {
            sessionStorage.setItem("current_db_path", activeDbPath);
          }
        }

        if (!activeDbPath) {
          showNotification("Impossible de determiner la base active.", false);
          return;
        }

        showGlobalProgress(30, true);
        showNotificationWithProgress("Nettoyage en cours...", 30, true);

        console.log("[CLEAN] Appel API clean_database_values :", activeDbPath);
        const result =
          await window.pywebview.api.clean_database_values(activeDbPath);
        console.log("[CLEAN] Resultat :", result);

        showGlobalProgress(100, true);
        showNotificationWithProgress("Nettoyage termine", 100, true);

        if (result && result.success) {
          showNotification(
            result.message || "Nettoyage termine avec succes.",
            true,
          );
          logUserAction(
            `Nettoyage de la base : ${result.cleaned_tables?.length || 0} table(s)`,
          );

          const toggleChecked = document.getElementById(
            "toggle-show-tables-list",
          )?.checked;
          if (toggleChecked && activeDbPath) {
            await loadDatabaseDetails(activeDbPath);
          }
        } else {
          showNotification(
            result?.message || "Erreur lors du nettoyage.",
            false,
          );
        }
      } catch (err) {
        console.error("[CLEAN] Exception :", err);
        showGlobalProgress(0, false);
        showNotification(`Erreur lors du nettoyage : ${err.message}`, false);
      }
    });
  }

  // ============================================================
  // BOUTON "4. EXPORTER VERS EXCEL"
  // ============================================================
  const btnExportExcel = document.getElementById("btn-export-excel");
  if (btnExportExcel) {
    btnExportExcel.addEventListener("click", async () => {
      console.log("[EXPORT] === Bouton Export Excel clique ===");

      if (!isDbOpen) {
        showNotification("Veuillez d'abord ouvrir une base de donnees.", false);
        return;
      }

      try {
        // Recuperer le chemin de la base
        let activeDbPath = sessionStorage.getItem("current_db_path");
        console.log("[EXPORT] activeDbPath (sessionStorage) :", activeDbPath);

        // Fallback : lire depuis le select
        if (!activeDbPath) {
          const dbFileSelect = document.getElementById("db-file-select");
          activeDbPath = dbFileSelect?.value;
          console.log(
            "[EXPORT] activeDbPath (fallback select) :",
            activeDbPath,
          );

          if (activeDbPath) {
            sessionStorage.setItem("current_db_path", activeDbPath);
          }
        }

        if (!activeDbPath) {
          showNotification(
            "Impossible de determiner la base active. Veuillez reouvrir la base.",
            false,
          );
          return;
        }

        // Selection du fichier de sortie
        console.log("[EXPORT] Selection du fichier de sortie...");
        const saveResult =
          await window.pywebview.api.select_excel_export_file();
        console.log("[EXPORT] saveResult :", saveResult);

        if (!saveResult || !saveResult.success) {
          if (saveResult?.message !== "Aucun fichier selectionne.") {
            showNotification(
              saveResult?.message || "Aucun fichier selectionne.",
              false,
            );
          }
          return;
        }

        showGlobalProgress(30, true);
        showNotificationWithProgress("Export Excel en cours...", 30, true);

        console.log("[EXPORT] Appel API export_database_to_excel :", {
          output: saveResult.file_path,
          db: activeDbPath,
        });

        // Appel API
        const result = await window.pywebview.api.export_database_to_excel(
          saveResult.file_path,
          activeDbPath,
        );

        console.log("[EXPORT] Resultat :", result);

        showGlobalProgress(100, true);
        showNotificationWithProgress("Export termine", 100, true);

        if (result && result.success) {
          showNotification(
            result.message || `Excel exporte : ${saveResult.file_path}`,
            true,
          );
          logUserAction(
            `Export Excel : ${result.tables_exported?.length || 0} feuille(s)`,
          );
        } else {
          showNotification(
            result?.message || "Erreur lors de l'export Excel.",
            false,
          );
        }
      } catch (err) {
        console.error("[EXPORT] Exception :", err);
        showGlobalProgress(0, false);
        showNotification(
          `Erreur lors de l'export Excel : ${err.message}`,
          false,
        );
      }
    });
  }
}

// ============================================
// EXPORT DES RESULTATS
// ============================================
async function exportResultsToExcel() {
  const container = document.querySelector(
    "#manipulate-results-table-container",
  );
  if (!container) return;
  const table = container.querySelector("table");
  if (!table) return;
  try {
    const headers = [];
    const data = [];
    const thead = table.querySelector("thead");
    if (thead) {
      thead.querySelectorAll("th").forEach((th) => {
        const text = th.textContent.trim();
        if (text !== "Actions") headers.push(text);
      });
    }
    const tbody = table.querySelector("tbody");
    if (tbody) {
      tbody.querySelectorAll("tr").forEach((row) => {
        const rowData = {};
        const cells = row.querySelectorAll("td");
        let headerIdx = 0;
        cells.forEach((td, idx) => {
          if (idx === 0) return;
          if (headerIdx < headers.length) {
            rowData[headers[headerIdx]] = td.textContent.trim();
            headerIdx++;
          }
        });
        data.push(rowData);
      });
    }
    if (data.length === 0) {
      showNotification("Aucune donnee a exporter.", false);
      return;
    }
    const result = await window.pywebview.api.select_excel_export_file();
    if (!result || !result.success) return;
    showNotificationWithProgress("Export vers Excel en cours...", 30, true);
    const exportResult = await window.pywebview.api.generate_excel_from_data(
      result.file_path,
      data,
      headers,
    );
    showNotificationWithProgress("Export termine.", 100, true);
    if (exportResult && exportResult.success) {
      showNotification(`Excel exporte : ${result.file_path}`, true);
      logUserAction(`Export des resultats vers Excel`);
    } else {
      showNotification(
        exportResult?.message || "Erreur lors de l'export Excel.",
        false,
      );
    }
  } catch (error) {
    console.error("Erreur export Excel:", error);
    showNotification("Erreur lors de l'export Excel.", false);
  }
}

async function exportResultsToPDF() {
  const container = document.querySelector(
    "#manipulate-results-table-container",
  );
  if (!container) return;
  const table = container.querySelector("table");
  if (!table) return;
  try {
    const result = await window.pywebview.api.select_pdf_file();
    if (!result || !result.success) return;
    const htmlContent = `
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8"><title>Export des resultats</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        h1 { color: #1a4d3a; border-bottom: 3px solid #1a4d3a; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 11px; }
        th { background: #1a4d3a; color: white; padding: 10px; text-align: left; }
        td { padding: 8px 10px; border-bottom: 1px solid #ddd; }
        tr:nth-child(even) { background: #f8fafc; }
      </style></head><body>
        <h1>Export des resultats</h1>
        <p><strong>Date :</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Nombre :</strong> ${table.querySelectorAll("tbody tr").length}</p>
        ${table.outerHTML}
      </body></html>
    `;
    showNotificationWithProgress("Generation du PDF...", 50, true);
    const pdfResult = await window.pywebview.api.generate_pdf_from_html(
      result.file_path,
      htmlContent,
    );
    showNotificationWithProgress("PDF genere.", 100, true);
    if (pdfResult && pdfResult.success) {
      showNotification(`PDF exporte : ${result.file_path}`, true);
      logUserAction(`Export des resultats vers PDF`);
    } else {
      showNotification(
        pdfResult?.message || "Erreur lors de la generation du PDF.",
        false,
      );
    }
  } catch (error) {
    console.error("Erreur export PDF:", error);
    showNotification("Erreur lors de l'export PDF.", false);
  }
}

// ============================================
// STATISTIQUES ET GRAPHIQUES
// ============================================
async function generateStatistics() {
  const tableName = currentManipulateTable;
  if (!tableName) {
    showNotification("Veuillez selectionner une table.", false);
    return;
  }
  const container = document.querySelector("#statistics-container");
  const section = document.querySelector("#statistics-section");
  section.classList.remove("hidden");
  container.innerHTML = "<p>Calcul des statistiques...</p>";
  try {
    const activeDbPath = sessionStorage.getItem("current_db_path");
    const stats = await window.pywebview.api.get_table_statistics(
      tableName,
      activeDbPath,
    );
    if (!stats || !stats.success) {
      container.innerHTML = `<p style="color: red;">${stats?.message || "Erreur."}</p>`;
      return;
    }
    let html =
      '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">';
    for (const [col, data] of Object.entries(stats.stats)) {
      if (data.type === "numerique") {
        html += `
          <div class="stat-card">
            <h4>${escapeHtml(col)}</h4>
            <div class="stat-grid">
              <span class="label">Effectif :</span><span class="value">${data.count}</span>
              <span class="label">Moyenne :</span><span class="value">${data.average !== null ? data.average : "-"}</span>
              <span class="label">Minimum :</span><span class="value">${data.min !== null ? data.min : "-"}</span>
              <span class="label">Maximum :</span><span class="value">${data.max !== null ? data.max : "-"}</span>
              <span class="label">Somme :</span><span class="value">${data.sum !== null ? data.sum : "-"}</span>
            </div>
          </div>`;
      } else {
        html += `
          <div class="stat-card" style="border-left-color: #3d8b6a;">
            <h4>${escapeHtml(col)}</h4>
            <div style="font-size: 0.9rem;">
              <span class="label">Valeurs distinctes :</span> <strong>${data.distinct_count}</strong>
              <span class="label" style="margin-left: 1rem;">Total :</span> <strong>${data.total_count}</strong>
            </div>
          </div>`;
      }
    }
    html += "</div>";
    container.innerHTML = html;
    showNotification("Statistiques generees.", true);
  } catch (error) {
    console.error("Erreur statistiques:", error);
    container.innerHTML = '<p style="color: red;">Erreur lors du calcul.</p>';
  }
}

async function generateChart(chartType) {
  const tableName = currentManipulateTable;
  if (!tableName) {
    showNotification("Veuillez selectionner une table.", false);
    return;
  }
  const section = document.querySelector("#charts-section");
  const container = document.querySelector("#charts-container");
  section.classList.remove("hidden");

  let column = "";
  let title = "";
  switch (chartType) {
    case "nom":
      column = "nom";
      title = "Distribution des Noms";
      break;
    case "cin":
      column = "cin";
      title = "Distribution des CIN";
      break;
    case "region":
      column = "region";
      title = "Distribution par Region";
      break;
    default:
      container.innerHTML = "";
      await generateChart("nom");
      await generateChart("cin");
      await generateChart("region");
      return;
  }
  try {
    const activeDbPath = sessionStorage.getItem("current_db_path");
    const struct =
      await window.pywebview.api.get_database_structure_matrix(activeDbPath);
    const columns = struct.structure[tableName] || [];
    let foundCol = null;
    for (const col of columns) {
      const colLower = col.toLowerCase();
      if (colLower.includes(column) || colLower === column) {
        foundCol = col;
        break;
      }
    }
    if (!foundCol) {
      showNotification(`Colonne "${column}" non trouvee.`, false);
      return;
    }
    const distribution = await window.pywebview.api.get_table_distribution(
      tableName,
      foundCol,
      activeDbPath,
    );
    if (!distribution || !distribution.success) {
      showNotification(distribution?.message || "Erreur.", false);
      return;
    }
    const data = distribution.distribution;
    const maxCount =
      data.length > 0 ? Math.max(...data.map((d) => d.count)) : 1;
    let chartHtml = `<div class="chart-container"><h4>${title}</h4><div class="chart-bar-container">`;
    data.slice(0, 30).forEach((item) => {
      const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
      chartHtml += `
        <div class="chart-bar-row">
          <span class="chart-bar-label">${escapeHtml(String(item.value).substring(0, 30))}</span>
          <div class="chart-bar-track"><div class="chart-bar-fill" style="width: ${percentage}%"></div></div>
          <span class="chart-bar-count">${item.count}</span>
        </div>`;
    });
    chartHtml += `</div><div style="margin-top: 8px; font-size: 0.75rem; color: var(--text-muted, #64748b);">${data.length > 30 ? `30 premieres sur ${data.length}` : `${data.length} valeur(s)`}</div></div>`;
    if (chartType === "all") container.innerHTML += chartHtml;
    else container.innerHTML = chartHtml;
    showNotification(`Graphique "${title}" genere.`, true);
  } catch (error) {
    console.error("Erreur graphique:", error);
    showNotification("Erreur lors de la generation.", false);
  }
}

function performResultOperation(operation) {
  const container = document.querySelector(
    "#manipulate-results-table-container",
  );
  const output = document.querySelector("#result-operations-output");
  const section = document.querySelector("#result-operations-section");
  if (!container) return;
  const table = container.querySelector("table");
  if (!table) {
    showNotification("Aucune donnee a traiter.", false);
    return;
  }
  section.classList.remove("hidden");
  try {
    const numericData = [];
    const headers = [];
    const thead = table.querySelector("thead");
    if (thead) {
      thead.querySelectorAll("th").forEach((th) => {
        const text = th.textContent.trim();
        if (text !== "Actions") headers.push(text);
      });
    }
    const tbody = table.querySelector("tbody");
    if (!tbody) return;
    tbody.querySelectorAll("tr").forEach((row) => {
      const cells = row.querySelectorAll("td");
      let headerIdx = 0;
      cells.forEach((td, idx) => {
        if (idx === 0) return;
        if (headerIdx < headers.length) {
          const val = parseFloat(td.textContent.trim().replace(/,/g, "."));
          if (!isNaN(val)) {
            if (!numericData[headerIdx]) numericData[headerIdx] = [];
            numericData[headerIdx].push(val);
          }
          headerIdx++;
        }
      });
    });
    if (
      numericData.length === 0 ||
      numericData.every((arr) => !arr || arr.length === 0)
    ) {
      output.innerHTML =
        '<span style="color: orange;">Aucune donnee numerique trouvee.</span>';
      return;
    }
    let resultHtml =
      '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">';
    numericData.forEach((data, idx) => {
      if (!data || data.length === 0) return;
      const colName = headers[idx] || `Colonne ${idx + 1}`;
      let operationResult = "";
      let operationLabel = "";
      switch (operation) {
        case "sum":
          operationResult = data.reduce((a, b) => a + b, 0).toFixed(2);
          operationLabel = "Somme";
          break;
        case "avg":
          operationResult = (
            data.reduce((a, b) => a + b, 0) / data.length
          ).toFixed(2);
          operationLabel = "Moyenne";
          break;
        case "min":
          operationResult = Math.min(...data).toFixed(2);
          operationLabel = "Minimum";
          break;
        case "max":
          operationResult = Math.max(...data).toFixed(2);
          operationLabel = "Maximum";
          break;
        case "count":
          operationResult = data.length;
          operationLabel = "Effectif";
          break;
        case "countif":
          operationResult = data.filter((v) => v > 0).length;
          operationLabel = "Nb > 0";
          break;
        case "sort":
          operationResult = [...data].sort((a, b) => a - b).join(", ");
          operationLabel = "Tri croissant";
          break;
      }
      resultHtml += `
        <div style="background: var(--bg-secondary, #f8fafc); padding: 0.75rem; border-radius: 6px; border-left: 3px solid #1a4d3a;">
          <div style="font-size: 0.75rem; color: var(--text-muted, #64748b);">${escapeHtml(colName)}</div>
          <div style="font-size: 1rem; font-weight: 600;">${operationLabel} : ${operationResult} <span style="font-size: 0.75rem; font-weight: 400; color: var(--text-muted, #64748b);">(n=${data.length})</span></div>
        </div>`;
    });
    resultHtml += "</div>";
    output.innerHTML = resultHtml;
    showNotification(`Operation "${operation}" effectuee.`, true);
  } catch (error) {
    console.error("Erreur operation:", error);
    output.innerHTML = `<span style="color: red;">Erreur : ${error.message}</span>`;
  }
}

// ============================================
// REQUETES SQL INTERACTIVES
// ============================================
function initSqlOperations() {
  document.querySelectorAll(".op-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".op-btn").forEach((b) => {
        b.style.background = "";
        b.style.color = "";
      });
      e.target.style.background = "var(--primary-color, #1a4d3a)";
      e.target.style.color = "#ffffff";
      document.getElementById("selected-operation-type").value =
        e.target.getAttribute("data-op");
    });
  });
}

// ============================================
// EVENEMENTS PRINCIPAUX
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("app_theme") || "light";
  applyTheme(savedTheme);

  initializeApp();
  initManipulatePage();
  initDuplicatesPage();
  initSqlOperations();
  initNewFeatures();
  initStatisticalQueries();

  if (setupForm) {
    setupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const pseudo = document.querySelector("#setup-pseudo")?.value.trim();
      const email = document.querySelector("#setup-email")?.value.trim() || "";
      const password = document.querySelector("#setup-password")?.value;
      if (!pseudo || !password) {
        showMessage(
          "#setup-message",
          "Veuillez remplir les champs obligatoires.",
        );
        return;
      }
      try {
        await waitForApi();
        const result = await window.pywebview.api.create_first_user(
          pseudo,
          password,
          email,
        );
        showMessage(
          "#setup-message",
          result.message || "Operation terminee.",
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
          "Impossible de communiquer avec l'application.",
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
        showMessage("#login-message", "Veuillez remplir tous les champs.");
        return;
      }
      try {
        await waitForApi();
        const result = await window.pywebview.api.login(pseudo, password);
        if (!result?.success) {
          showMessage(
            "#login-message",
            result?.message || "Identifiants incorrects.",
          );
          return;
        }
        loginForm.reset();
        showDashboard(result.user);
      } catch (error) {
        console.error(error);
        showMessage(
          "#login-message",
          "Impossible de communiquer avec l'application.",
        );
      }
    });
  }

  document.addEventListener("click", (e) => {
    const logoutBtn = e.target.closest(".logout-global-btn");
    if (logoutBtn) {
      e.preventDefault();
      e.stopPropagation();
      logoutUser();
    }
  });

  document.addEventListener("click", async (e) => {
    const quitBtn = e.target.closest(".quit-global-btn");
    if (quitBtn) {
      e.preventDefault();
      try {
        if (window.pywebview?.api?.quit_app) {
          await window.pywebview.api.quit_app();
        } else {
          window.close();
        }
      } catch (err) {
        console.error("Erreur lors de la fermeture:", err);
      }
    }
  });

  document.querySelectorAll(".menu-container").forEach((container) => {
    const button = container.querySelector(".menu-button");
    const menu = container.querySelector(".user-menu");
    if (button && menu) {
      button.addEventListener("click", (event) => {
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
      applyTheme(currentTheme === "dark" ? "light" : "dark");
    }
  });

  importExcelButton?.addEventListener("click", () => {
    resetExcelImportView();
    pushNavigationHistory("excelImport");
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
        label.style.fontWeight = "normal";
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
  // ============================================================
  // MOT DE PASSE OUBLIE - Listeners
  // ============================================================
  document
    .getElementById("forgot-password-link")
    ?.addEventListener("click", showForgotPasswordView);

  document
    .getElementById("forgot-email-form")
    ?.addEventListener("submit", handleForgotEmailSubmit);

  document
    .getElementById("forgot-code-form")
    ?.addEventListener("submit", handleForgotCodeSubmit);

  document
    .getElementById("forgot-password-form")
    ?.addEventListener("submit", handleForgotPasswordSubmit);

  ["1", "2", "3"].forEach((n) => {
    document
      .getElementById(`forgot-cancel-${n}`)
      ?.addEventListener("click", cancelForgotPassword);
  });
});

// ============================================
// MOT DE PASSE OUBLIE
// ============================================
function resetForgotPasswordUI() {
  forgotPasswordState = { step: 1, userId: null, pseudo: null, email: null };
  const s1 = document.getElementById("forgot-step-email");
  const s2 = document.getElementById("forgot-step-code");
  const s3 = document.getElementById("forgot-step-password");
  if (s1) s1.classList.remove("hidden");
  if (s2) s2.classList.add("hidden");
  if (s3) s3.classList.add("hidden");

  const emailInput = document.getElementById("forgot-email-input");
  const codeInput = document.getElementById("forgot-code-input");
  const pwdInput = document.getElementById("forgot-new-password");
  const pwdConfirm = document.getElementById("forgot-confirm-password");
  if (emailInput) emailInput.value = "";
  if (codeInput) codeInput.value = "";
  if (pwdInput) pwdInput.value = "";
  if (pwdConfirm) pwdConfirm.value = "";

  const title = document.getElementById("forgot-title");
  const subtitle = document.getElementById("forgot-subtitle");
  if (title) title.textContent = "Mot de passe oublie";
  if (subtitle)
    subtitle.textContent =
      "Saisissez votre email pour recevoir un code de validation.";

  showMessage("#forgot-message", "");
}

function showForgotPasswordView() {
  resetForgotPasswordUI();
  showView(forgotPasswordView);
  setTimeout(() => {
    document.getElementById("forgot-email-input")?.focus();
  }, 100);
}

function cancelForgotPassword() {
  resetForgotPasswordUI();
  showView(loginView);
}

async function handleForgotEmailSubmit(e) {
  e.preventDefault();
  const email = document.getElementById("forgot-email-input")?.value.trim();
  if (!email) {
    showMessage("#forgot-message", "Veuillez saisir votre email.");
    return;
  }
  try {
    await waitForApi();
    const result = await window.pywebview.api.request_password_reset(email);
    if (!result || !result.success) {
      showMessage("#forgot-message", result?.message || "Erreur.");
      return;
    }
    forgotPasswordState.step = 2;
    forgotPasswordState.userId = result.user_id;
    forgotPasswordState.pseudo = result.pseudo;
    forgotPasswordState.email = email;

    document.getElementById("forgot-step-email")?.classList.add("hidden");
    document.getElementById("forgot-step-code")?.classList.remove("hidden");

    const title = document.getElementById("forgot-title");
    const subtitle = document.getElementById("forgot-subtitle");
    const userName = document.getElementById("forgot-user-name");
    if (title) title.textContent = "Verification du code";
    if (subtitle) subtitle.textContent = "Un code vous a ete envoye par email.";
    if (userName) userName.textContent = `Utilisateur : ${result.pseudo}`;

    showMessage("#forgot-message", result.message, true);
    setTimeout(() => {
      document.getElementById("forgot-code-input")?.focus();
    }, 100);
  } catch (err) {
    console.error(err);
    showMessage("#forgot-message", "Erreur de communication.");
  }
}

async function handleForgotCodeSubmit(e) {
  e.preventDefault();
  const code = document.getElementById("forgot-code-input")?.value.trim();
  if (!code) {
    showMessage("#forgot-message", "Veuillez saisir le code recu par email.");
    return;
  }
  try {
    await waitForApi();
    const result = await window.pywebview.api.verify_reset_code(
      forgotPasswordState.userId,
        code,
    );
    if (!result || !result.success) {
      showMessage("#forgot-message", result?.message || "Code incorrect.");
      return;
    }
    forgotPasswordState.step = 3;
    document.getElementById("forgot-step-code")?.classList.add("hidden");
    document.getElementById("forgot-step-password")?.classList.remove("hidden");
    
    const title = document.getElementById("forgot-title");
    const subtitle = document.getElementById("forgot-subtitle");
    const userName2 = document.getElementById("forgot-user-name-2");
    if (title) title.textContent = "Nouveau mot de passe";
    if (subtitle) subtitle.textContent = "Choisissez un nouveau mot de passe.";
    if (userName2) userName2.textContent = `Utilisateur : ${forgotPasswordState.pseudo}`;
    
    showMessage("#forgot-message", "Code valide. Choisissez un nouveau mot de passe.", true);
    setTimeout(() => {
      document.getElementById("forgot-new-password")?.focus();
    }, 100);
  } catch (err) {
    console.error(err);
    showMessage("#forgot-message", "Erreur de communication.");
  }
}

async function handleForgotPasswordSubmit(e) {
  e.preventDefault();
  const pwd = document.getElementById("forgot-new-password")?.value || "";
  const confirm =
    document.getElementById("forgot-confirm-password")?.value || "";

  if (pwd.length < 6) {
    showMessage(
      "#forgot-message",
      "Le mot de passe doit contenir au moins 6 caracteres.",
    );
    return;
  }
  if (pwd !== confirm) {
    showMessage("#forgot-message", "Les mots de passe ne correspondent pas.");
    return;
  }
  try {
    await waitForApi();
    const code = document.getElementById("forgot-code-input")?.value.trim();
    const result = await window.pywebview.api.confirm_password_reset(
      forgotPasswordState.userId,
      code,
      pwd,
    );
    if (!result || !result.success) {
      showMessage("#forgot-message", result?.message || "Erreur.");
      return;
    }
    showMessage(
      "#forgot-message",
      "Mot de passe reinitialise ! Redirection...",
      true,
    );
    setTimeout(() => {
      cancelForgotPassword();
      showMessage(
        "#login-message",
        "Vous pouvez maintenant vous connecter.",
        true,
      );
    }, 1500);
  } catch (err) {
    console.error(err);
    showMessage("#forgot-message", "Erreur de communication.");
  }
}
