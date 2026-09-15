// ============================================
// INITIALISATION DE L'APPLICATION
// Charge en DERNIER dans index.html
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  // ============================================================
  // THEME
  // ============================================================
  const savedTheme = localStorage.getItem("app_theme") || "light";
  applyTheme(savedTheme);

  // ============================================================
  // INITIALISATIONS
  // ============================================================
  initializeApp();

  // Initialisations differees (apres que les fonctions soient chargees)
  setTimeout(() => {
    if (typeof initManipulatePage === "function") initManipulatePage();
    if (typeof initDuplicatesPage === "function") initDuplicatesPage();
    if (typeof initSqlOperations === "function") initSqlOperations();
    if (typeof initNewFeatures === "function") initNewFeatures();
    if (typeof initStatisticalQueries === "function") initStatisticalQueries();
    if (typeof initShortcuts === "function") initShortcuts();
  }, 100);

  // ============================================================
  // FORMULAIRE : PREMIER UTILISATEUR
  // ============================================================
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

  // ============================================================
  // FORMULAIRE : CONNEXION
  // ============================================================
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

  // ============================================================
  // DECONNEXION
  // ============================================================
  document.addEventListener("click", (e) => {
    const logoutBtn = e.target.closest(".logout-global-btn");
    if (logoutBtn) {
      e.preventDefault();
      e.stopPropagation();
      logoutUser();
    }
  });

  // ============================================================
  // CHANGER DE MOT DE PASSE
  // ============================================================
  document.addEventListener("click", (e) => {
    if (e.target.closest(".change-password-global-btn")) {
      e.preventDefault();
      if (typeof showChangePasswordModal === "function") {
        showChangePasswordModal();
      } else {
        showNotification("Fonction indisponible.", false);
      }
      document
        .querySelectorAll(".user-menu")
        .forEach((m) => m.classList.add("hidden"));
    }
  });

  // ============================================================
  // QUITTER L'APPLICATION
  // ============================================================
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

  // ============================================================
  // MENUS UTILISATEUR (bouton hamburger)
  // ============================================================
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

  // Fermer les menus en cliquant ailleurs
  document.addEventListener("click", (event) => {
    document.querySelectorAll(".user-menu").forEach((menu) => {
      const container = menu.closest(".menu-container");
      if (container && !container.contains(event.target)) {
        menu.classList.add("hidden");
      }
    });
  });

  // ============================================================
  // THEME (boutons)
  // ============================================================
  document.addEventListener("click", (e) => {
    const themeBtn = e.target.closest(".theme-global-btn, .theme-toggle-btn");
    if (themeBtn) {
      const currentTheme =
        document.documentElement.getAttribute("data-theme") || "light";
      applyTheme(currentTheme === "dark" ? "light" : "dark");
    }
  });

  // ============================================================
  // IMPORT EXCEL
  // ============================================================
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

  // ============================================================
  // SELECTION DE BASE DE DONNEES
  // ============================================================
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

  // ============================================================
  // TOGGLE AFFICHAGE DES TABLES
  // ============================================================
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
  // MOT DE PASSE OUBLIE
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

  // ============================================================
  // BOUTONS GLOBAUX : PARAMETRES, AIDE, A PROPOS, MAJ, CONTACT
  // ============================================================
  document.addEventListener("click", (e) => {
    // PARAMETRES
    if (e.target.closest(".settings-global-btn")) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof showSettingsModal === "function") {
        showSettingsModal("general");
      } else {
        showNotification("Paramètres indisponibles.", false);
      }
      document
        .querySelectorAll(".user-menu")
        .forEach((m) => m.classList.add("hidden"));
      return;
    }

    // AIDE
    if (e.target.closest(".help-global-btn")) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof showHelpModal === "function") {
        showHelpModal("intro");
      } else {
        showNotification("Aide indisponible.", false);
      }
      document
        .querySelectorAll(".user-menu")
        .forEach((m) => m.classList.add("hidden"));
      return;
    }

    // A PROPOS
    if (e.target.closest(".about-global-btn")) {
      e.preventDefault();
      if (typeof showAboutModal === "function") {
        showAboutModal();
      }
      document
        .querySelectorAll(".user-menu")
        .forEach((m) => m.classList.add("hidden"));
      return;
    }

    // MISES A JOUR
    if (e.target.closest(".updates-global-btn")) {
      e.preventDefault();
      if (typeof checkForUpdates === "function") {
        checkForUpdates();
      }
      document
        .querySelectorAll(".user-menu")
        .forEach((m) => m.classList.add("hidden"));
      return;
    }

    // CONTACT
    if (e.target.closest(".contact-global-btn")) {
      e.preventDefault();
      if (typeof showContactModal === "function") {
        showContactModal();
      }
      document
        .querySelectorAll(".user-menu")
        .forEach((m) => m.classList.add("hidden"));
      return;
    }
  });

  // ============================================================
  // FOOTER
  // ============================================================
  const footerCheckUpdates = document.getElementById("footer-check-updates");
  if (footerCheckUpdates) {
    footerCheckUpdates.addEventListener("click", () => {
      if (typeof checkForUpdates === "function") checkForUpdates();
    });
  }
  const footerContact = document.getElementById("footer-contact");
  if (footerContact) {
    footerContact.addEventListener("click", () => {
      if (typeof showContactModal === "function") showContactModal();
    });
  }

  // ============================================================
  // BOUTONS "RETOUR"
  // ============================================================
  document.querySelectorAll(".btn-back-global").forEach((btn) => {
    btn.addEventListener("click", goBack);
  });

  // ============================================================
  // BOUTON "CREER UNE BASE DE DONNEES"
  // ============================================================
  const btnCreateDb = document.getElementById("btn-create-db");
  if (btnCreateDb) {
    btnCreateDb.addEventListener("click", () => {
      resetCreateDbView();
      pushNavigationHistory("createDb");
      showView(createDbView);
    });
  }

  const btnCreateDbBack = document.getElementById("btn-create-db-back");
  if (btnCreateDbBack) {
    btnCreateDbBack.addEventListener("click", () => showView(dashboardView));
  }

  const btnSelectCreateExcel = document.getElementById(
    "btn-select-create-excel",
  );
  if (btnSelectCreateExcel) {
    btnSelectCreateExcel.addEventListener("click", selectCreateDbExcelFile);
  }

  const btnCreateFromExcel = document.getElementById("btn-create-from-excel");
  if (btnCreateFromExcel) {
    btnCreateFromExcel.addEventListener("click", createDatabaseFromExcel);
  }

  const btnCreateEmpty = document.getElementById("btn-create-empty");
  if (btnCreateEmpty) {
    btnCreateEmpty.addEventListener("click", createEmptyDatabase);
  }

  const btnExportCreated = document.getElementById("btn-export-created-db");
  if (btnExportCreated) {
    btnExportCreated.addEventListener("click", exportCreatedDatabaseToExcel);
  }

  // ============================================================
  // BOUTON "CREER LISTE MERE"
  // ============================================================
  const btnCreateMasterList = document.getElementById("btn-create-master-list");
  if (btnCreateMasterList) {
    btnCreateMasterList.addEventListener("click", createMasterList);
  }

  // ============================================================
  // BOUTON "REQUETES STATISTIQUES" (header Manipulation)
  // ============================================================
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

  // ============================================================
  // BOUTON "OUVRIR UNE BASE"
  // ============================================================
  const btnOpenDb = document.getElementById("btn-open-database");
  if (btnOpenDb) {
    btnOpenDb.addEventListener("click", openSelectedDatabase);
  }

  const btnDeleteSelectedDb = document.getElementById("btn-delete-selected-db");
  if (btnDeleteSelectedDb) {
    btnDeleteSelectedDb.addEventListener("click", deleteSelectedDatabase);
  }

  // ============================================================
  // BOUTONS "TERMINER LA BASE"
  // ============================================================
  const terminateBtns = [
    document.getElementById("btn-terminate-database-existing"),
    document.getElementById("btn-terminate-database-duplicates"),
    document.getElementById("btn-terminate-database-manipulate"),
  ];
  terminateBtns.forEach((btn) => {
    if (btn) {
      btn.addEventListener("click", terminateDatabase);
    }
  });

  // ============================================================
  // BOUTON "NETTOYER LES DONNEES"
  // ============================================================
  const btnCleanDb = document.getElementById("btn-clean-db");
  if (btnCleanDb) {
    btnCleanDb.addEventListener("click", async () => {
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
      ) {
        return;
      }

      try {
        let activeDbPath = sessionStorage.getItem("current_db_path");
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

        const result =
          await window.pywebview.api.clean_database_values(activeDbPath);

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
  // BOUTON "EXPORTER VERS EXCEL"
  // ============================================================
  const btnExportExcel = document.getElementById("btn-export-excel");
  if (btnExportExcel) {
    btnExportExcel.addEventListener("click", async () => {
      if (!isDbOpen) {
        showNotification("Veuillez d'abord ouvrir une base de donnees.", false);
        return;
      }

      try {
        let activeDbPath = sessionStorage.getItem("current_db_path");
        if (!activeDbPath) {
          const dbFileSelect = document.getElementById("db-file-select");
          activeDbPath = dbFileSelect?.value;
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

        const saveResult =
          await window.pywebview.api.select_excel_export_file();

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

        const result = await window.pywebview.api.export_database_to_excel(
          saveResult.file_path,
          activeDbPath,
        );

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

  // ============================================================
  // BOUTON "EXPORTER LES RESULTATS"
  // ============================================================
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

  // ============================================================
  // STATISTIQUES ET GRAPHIQUES
  // ============================================================
  const btnStats = document.getElementById("btn-generate-stats");
  if (btnStats) btnStats.addEventListener("click", generateStatistics);

  const btnChartNom = document.getElementById("btn-chart-nom");
  if (btnChartNom) {
    btnChartNom.addEventListener("click", () => generateChart("nom"));
  }
  const btnChartCin = document.getElementById("btn-chart-cin");
  if (btnChartCin) {
    btnChartCin.addEventListener("click", () => generateChart("cin"));
  }
  const btnChartRegion = document.getElementById("btn-chart-region");
  if (btnChartRegion) {
    btnChartRegion.addEventListener("click", () => generateChart("region"));
  }
  const btnChartAll = document.getElementById("btn-chart-all");
  if (btnChartAll) {
    btnChartAll.addEventListener("click", () => {
      const c = document.querySelector("#charts-container");
      if (c) c.innerHTML = "";
      generateChart("all");
    });
  }

  // ============================================================
  // OPERATIONS SUR LES RESULTATS
  // ============================================================
  const opButtons = ["sum", "avg", "min", "max", "count", "countif", "sort"];
  opButtons.forEach((op) => {
    const btn = document.getElementById(`btn-op-${op}`);
    if (btn) {
      btn.addEventListener("click", () => performResultOperation(op));
    }
  });

  console.log("[INIT] Application initialisee");
});
