// ============================================
// Features
// Fichier extrait automatiquement depuis app.js
// ============================================

// ---------- resetCreateDbView ----------
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

// ---------- selectCreateDbExcelFile ----------
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

// ---------- createDatabaseFromExcel ----------
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

// ---------- createEmptyDatabase ----------
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

// ---------- exportCreatedDatabaseToExcel ----------
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

// ---------- initStatisticalQueries ----------
// ============================================
// REQUETES STATISTIQUES
// ============================================
function initStatisticalQueries() {
  const btnOpenStats = document.getElementById("btn-open-statistical-queries");
  if (btnOpenStats) {
    btnOpenStats.addEventListener("click", () => {
      if (typeof openStatisticalQueriesModal === "function") {
        openStatisticalQueriesModal();
      } else {
        showNotification("Statistiques indisponibles.", false);
      }
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
          <i class="fas fa-chart-bar" style="color: #1a4d3a;"></i> Requêtes statistiques
        </h3>
        <button type="button" id="close-stats-modal" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: #1a1a2e;">&times;</button>
      </div>
      <p style="color: #64748b; margin-bottom: 1.5rem;">Sélectionnez une requête pour obtenir des statistiques.</p>
      <div id="stats-query-buttons" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; margin-bottom: 1.5rem;">
        <button class="stat-query-btn" data-query="femmes_par_tranche_age" style="padding: 12px; border: 2px solid #1a4d3a; border-radius: 8px; background: #ffffff; color: #1a4d3a; font-weight: 600; cursor: pointer; text-align: left;"><i class="fas fa-female"></i> Femmes par tranche d'age</button>
        <button class="stat-query-btn" data-query="personnes_par_commune" style="padding: 12px; border: 2px solid #1a4d3a; border-radius: 8px; background: #ffffff; color: #1a4d3a; font-weight: 600; cursor: pointer; text-align: left;"><i class="fas fa-map-marker-alt"></i> Personnes par commune</button>
        <button class="stat-query-btn" data-query="personnes_par_lieu" style="padding: 12px; border: 2px solid #1a4d3a; border-radius: 8px; background: #ffffff; color: #1a4d3a; font-weight: 600; cursor: pointer; text-align: left;"><i class="fas fa-location-dot"></i> Personnes par lieu (fkt)</button>
        <button class="stat-query-btn" data-query="superficie_par_personne" style="padding: 12px; border: 2px solid #1a4d3a; border-radius: 8px; background: #ffffff; color: #1a4d3a; font-weight: 600; cursor: pointer; text-align: left;"><i class="fas fa-ruler-combined"></i> Superficie par personne</button>
        <button class="stat-query-btn" data-query="hommes_femmes" style="padding: 12px; border: 2px solid #1a4d3a; border-radius: 8px; background: #ffffff; color: #1a4d3a; font-weight: 600; cursor: pointer; text-align: left;"><i class="fas fa-venus-mars"></i> Hommes / Femmes</button>
        <button class="stat-query-btn" data-query="personnes_par_filiere" style="padding: 12px; border: 2px solid #1a4d3a; border-radius: 8px; background: #ffffff; color: #1a4d3a; font-weight: 600; cursor: pointer; text-align: left;"><i class="fas fa-seedling"></i> Personnes par filiere</button>
        <button class="stat-query-btn" data-query="personnes_par_categorisation" style="padding: 12px; border: 2px solid #1a4d3a; border-radius: 8px; background: #ffffff; color: #1a4d3a; font-weight: 600; cursor: pointer; text-align: left;"><i class="fas fa-users"></i> Personnes par categorisation EAF</button>
        <button class="stat-query-btn" data-query="age_moyen" style="padding: 12px; border: 2px solid #1a4d3a; border-radius: 8px; background: #ffffff; color: #1a4d3a; font-weight: 600; cursor: pointer; text-align: left;"><i class="fas fa-birthday-cake"></i> Age moyen</button>
        <button class="stat-query-btn" data-query="superficie_totale" style="padding: 12px; border: 2px solid #1a4d3a; border-radius: 8px; background: #ffffff; color: #1a4d3a; font-weight: 600; cursor: pointer; text-align: left;"><i class="fas fa-chart-area"></i> Superficie totale</button>
      </div>
      <div id="stats-query-results" style="background: #f8fafc; border-radius: 8px; padding: 1rem; min-height: 100px; color: #334155;">
        <p style="color: #64748b; text-align: center;"><i class="fas fa-info-circle"></i> Sélectionnez une requête.</p>
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

  overlay.querySelectorAll(".stat-query-btn").forEach((btn) => {
    btn.addEventListener("click", async function () {
      // Reset visuel
      overlay.querySelectorAll(".stat-query-btn").forEach((b) => {
        b.style.background = "#ffffff";
        b.style.color = "#1a4d3a";
      });
      this.style.background = "#1a4d3a";
      this.style.color = "#ffffff";

      const queryType = this.getAttribute("data-query");
      resultsContainer.innerHTML =
        '<p style="text-align: center; color: #64748b;"><i class="fas fa-spinner fa-spin"></i> Chargement...</p>';

      try {
        await waitForApi();
        const activeDbPath = sessionStorage.getItem("current_db_path");
        const params = {};
        if (queryType === "personnes_par_lieu") {
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
          logUserAction(`Requête statistique : ${queryType}`);
        } else {
          resultsContainer.innerHTML =
            '<p style="text-align: center; color: #f39c12;"><i class="fas fa-info-circle"></i> Aucun résultat.</p>';
        }
      } catch (err) {
        console.error("[STATS] Erreur:", err);
        resultsContainer.innerHTML = `<p style="text-align: center; color: #ef4444;"><i class="fas fa-exclamation-circle"></i> Erreur : ${escapeHtml(err.message)}</p>`;
      }
    });
  });
}

// ---------- initNewFeatures ----------
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
