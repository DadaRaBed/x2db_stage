// ============================================
// Duplicates - Duplicates
// Fichier extrait automatiquement depuis app.js
// ============================================

// ---------- resetDuplicateView ----------
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

// ---------- loadDuplicateTableFilter ----------
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

// ---------- updateDuplicateTablesInfo ----------
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

// ---------- initDuplicatesPage ----------
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

// ---------- runDuplicateScan ----------
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
  await new Promise((r) => setTimeout(r, 0));

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
