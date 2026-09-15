// ============================================
// NAVIGATION ENTRE VUES
// ============================================
function pushNavigationHistory(viewName) {
  const current = navigationHistory[navigationHistory.length - 1];
  if (current !== viewName) navigationHistory.push(viewName);
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

function goToDashboard() {
  saveCurrentDbState();
  navigationHistory = ["dashboard"];
  if (window.lastLoggedInUser) showDashboard(window.lastLoggedInUser);
  else {
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

// ============================================
// SAUVEGARDE / RESTAURATION DE LA BASE
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
    if (document.getElementById("toggle-show-tables-list")?.checked) {
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
    if (btn) btn.style.display = isDbOpen ? "inline-flex" : "none";
  });
}
