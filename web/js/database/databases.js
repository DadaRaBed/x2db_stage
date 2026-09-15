// ============================================
// BASES DE DONNEES
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
      `ATTENTION : Suppression definitive\n\nVoulez-vous vraiment supprimer :\n"${fileName}" ?\n\nCette action est IRREVERSIBLE.`,
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
      document.getElementById("db-actions-panel")?.classList.add("hidden");
      const tc = document.getElementById("database-tables-container-existing");
      if (tc) {
        tc.innerHTML = "";
        tc.classList.add("hidden");
      }
    }

    showGlobalProgress(30, true);
    const result = await window.pywebview.api.delete_database(dbPath);
    showGlobalProgress(100, true);

    if (result && result.success) {
      showNotification(result.message || "Base supprimee.", true);
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
      showNotification(result?.message || "Erreur.", false);
    }
  } catch (err) {
    console.error("Erreur:", err);
    showNotification("Erreur lors de la suppression.", false);
  }
}

async function deleteSelectedTable(tableName) {
  if (!tableName) {
    showNotification("Aucune table a supprimer.", false);
    return;
  }
  if (!confirm(`Supprimer la table "${tableName}" ?\n\nIRREVERSIBLE.`)) return;

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
        if (container)
          container.innerHTML =
            "<p style='color: gray'>Veuillez selectionner une table.</p>";
        await loadManipulateTables();
      }
      if (
        document.getElementById("toggle-show-tables-list")?.checked &&
        activeDbPath
      ) {
        await loadDatabaseDetails(activeDbPath);
      }
      await loadDuplicateTableFilter();
    } else {
      showNotification(result?.message || "Erreur.", false);
    }
  } catch (err) {
    console.error("Erreur:", err);
    showNotification("Erreur lors de la suppression.", false);
  }
}

async function terminateDatabase() {
  if (!isDbOpen) {
    showNotification("Aucune base ouverte.", false);
    return;
  }
  if (
    !confirm(
      "Terminer l'utilisation de cette base ?\n\nVous pourrez en ouvrir une autre apres.",
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
      }
      const selectEl = document.getElementById("db-file-select");
      if (selectEl) selectEl.value = "";
      document.getElementById("db-actions-panel")?.classList.add("hidden");
      updateTerminateButtonVisibility();
      const tc = document.getElementById("database-tables-container-existing");
      if (tc) {
        tc.innerHTML = "";
        tc.classList.add("hidden");
      }
      document.getElementById("dup-results-container")?.classList.add("hidden");

      allDuplicates = [];
      currentColumns = [];
      selectedDuplicateTables = [];
      window._activeValueFilters = {};

      showNotification(result.message || "Base terminee.", true);
      logUserAction(`Terminer la base : ${result.closed_db || "inconnue"}`);
    } else {
      showNotification(result?.message || "Erreur.", false);
    }
  } catch (err) {
    console.error("Erreur:", err);
    showNotification("Erreur lors de la fermeture.", false);
  }
}

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
    console.error("Erreur:", error);
  }
}

function renderDatabaseStructureMatrix(structure, containerElement) {
  if (!containerElement) return;
  containerElement.replaceChildren();
  const tables = Object.keys(structure);
  if (tables.length === 0) {
    containerElement.textContent = "Aucune table.";
    return;
  }

  const listWrapper = document.createElement("div");
  listWrapper.style.cssText =
    "display:flex;flex-direction:column;gap:0.75rem;padding:0.5rem 0;";

  tables.forEach((tableName) => {
    const columns = structure[tableName] || [];
    const tableGroupEl = document.createElement("div");
    tableGroupEl.style.cssText =
      "display:flex;flex-direction:column;gap:0.5rem;";

    const headerRow = document.createElement("div");
    headerRow.style.cssText = "display:flex;gap:0.5rem;align-items:stretch;";

    const tableButton = document.createElement("button");
    tableButton.type = "button";
    tableButton.className = "button button-primary";
    tableButton.style.cssText =
      "display:flex;justify-content:space-between;align-items:center;flex:1;padding:0.75rem 1rem;text-align:left;border-radius:6px;cursor:pointer;";

    const titleSpan = document.createElement("span");
    titleSpan.innerHTML = `<i class="fas fa-table" style="margin-right:8px;"></i> ${escapeHtml(tableName)} <small style="opacity:0.8;font-weight:normal;">(${columns.length} attributs)</small>`;

    const arrowSpan = document.createElement("i");
    arrowSpan.className = "fas fa-chevron-down";

    tableButton.appendChild(titleSpan);
    tableButton.appendChild(arrowSpan);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn-delete-table";
    deleteBtn.title = `Supprimer "${tableName}"`;
    deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Supprimer';
    deleteBtn.style.padding = "0 14px";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSelectedTable(tableName);
    });

    headerRow.appendChild(tableButton);
    headerRow.appendChild(deleteBtn);

    const attrsContainer = document.createElement("div");
    attrsContainer.style.cssText =
      "display:none;flex-wrap:wrap;gap:6px;padding:0.75rem;background:var(--card-bg,#f9f9f9);border:1px solid var(--border-color,#ddd);border-radius:6px;";

    if (columns.length === 0) {
      const emptySpan = document.createElement("small");
      emptySpan.textContent = "Aucun attribut";
      attrsContainer.appendChild(emptySpan);
    } else {
      columns.forEach((attr) => {
        const attrPill = document.createElement("span");
        attrPill.textContent = attr;
        attrPill.style.cssText =
          "background:var(--bg-secondary,#eef2f7);padding:4px 10px;border-radius:4px;font-size:0.85rem;border:1px solid var(--border-color,#e2e8f0);";
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
  container.innerHTML = "<p>Chargement...</p>";

  try {
    await waitForApi();
    const structRes =
      await window.pywebview.api.get_database_structure_matrix(filePath);
    if (structRes && structRes.success === true && structRes.structure) {
      const tables = Object.keys(structRes.structure);
      if (tables.length === 0) container.innerHTML = "<p>Aucune table.</p>";
      else renderDatabaseStructureMatrix(structRes.structure, container);
      if (actionsPanel) actionsPanel.classList.remove("hidden");
    } else {
      container.innerHTML = `<p style="color:red;">${escapeHtml(structRes?.message || "Erreur.")}</p>`;
    }
  } catch (error) {
    console.error("Erreur:", error);
    container.innerHTML = `<p style="color:red;">Erreur : ${escapeHtml(error.message)}</p>`;
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
        '<option value="">-- Selectionnez une base --</option>';
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
    console.error("Erreur:", e);
  }
}

async function openSelectedDatabase() {
  const selectEl = document.getElementById("db-file-select");
  const filePath = selectEl?.value;
  if (!filePath) {
    showNotification("Veuillez selectionner une base.", false);
    return;
  }
  try {
    await waitForApi();
    const result = await window.pywebview.api.open_database_path(filePath);
    if (result && result.success) {
      isDbOpen = true;
      currentDbPath = filePath;
      sessionStorage.setItem("current_db_path", filePath);

      const fileName = filePath.split("/").pop().split("\\").pop();
      const label = document.getElementById("selected-db-path-label");
      if (label) {
        label.textContent = `${fileName} (ouverte)`;
        label.style.color = "var(--success-color, #27ae60)";
        label.style.fontWeight = "600";
      }
      document.getElementById("db-actions-panel")?.classList.remove("hidden");
      updateTerminateButtonVisibility();
      if (document.getElementById("toggle-show-tables-list")?.checked) {
        await loadDatabaseDetails(filePath);
      }
      showNotification(`Base "${fileName}" ouverte.`, true);
      logUserAction(`Ouverture de la base : ${fileName}`);
    } else {
      showNotification(result?.message || "Erreur.", false);
    }
  } catch (err) {
    console.error("Erreur:", err);
    showNotification("Erreur lors de l'ouverture.", false);
  }
}
