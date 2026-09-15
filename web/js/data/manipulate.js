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

  // ------------------------------------------------------------
  // TRI A→Z / Z→A
  // ------------------------------------------------------------
  const btnSortAZ = document.getElementById("btn-sort-az");
  const btnSortZA = document.getElementById("btn-sort-za");
  const btnSortNone = document.getElementById("btn-sort-none");
  const sortInfo = document.getElementById("sort-info");

  async function applySort(orderBy, orderDir) {
    if (!currentManipulateTable) {
      showNotification("Veuillez d'abord selectionner une table.", false);
      return;
    }
    const activeDbPath = sessionStorage.getItem("current_db_path");
    const struct =
      await window.pywebview.api.get_database_structure_matrix(activeDbPath);
    const columns = struct.structure[currentManipulateTable] || [];

    let nomCol = null;
    if (orderBy) nomCol = orderBy;
    else {
      for (const c of columns) {
        const cl = c.toLowerCase();
        if (cl === "nom_et_prenoms" || cl === "nom" || cl === "name") {
          nomCol = c;
          break;
        }
      }
    }
    if (!nomCol) {
      showNotification("Aucune colonne 'nom' trouvee dans cette table.", false);
      return;
    }
    if (sortInfo)
      sortInfo.textContent = orderDir
        ? `Tri cote serveur : ${nomCol} ${orderDir}`
        : "";
    await loadManipulateTableData(
      currentManipulateTable,
      1,
      orderDir ? nomCol : null,
      orderDir || "ASC",
    );
  }

  if (btnSortAZ)
    btnSortAZ.addEventListener("click", () => applySort(null, "ASC"));
  if (btnSortZA)
    btnSortZA.addEventListener("click", () => applySort(null, "DESC"));
  if (btnSortNone)
    btnSortNone.addEventListener("click", () => applySort(null, null));

  // ------------------------------------------------------------
  // Boutons divers
  // ------------------------------------------------------------
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
      if (currentManipulateTable)
        await loadManipulateTableData(
          currentManipulateTable,
          currentManipulatePage,
        );
      showNotification("Donnees actualisees.", true);
    });
  }

  if (btnShowResults) {
    btnShowResults.addEventListener("click", async () => {
      if (!currentManipulateTable) {
        showNotification("Veuillez d'abord selectionner une table.", false);
        return;
      }
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
      currentManipulatePage = 1;
      window._activeValueFilters = {};
      window._activeColumnFilters = null;
      showNotification(`Table ${selectedTable} selectionnee.`, true);
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
        const filtered = currentManipulateData.filter((row) =>
          Object.values(row).some((value) =>
            String(value).toUpperCase().includes(val.toUpperCase()),
          ),
        );
        if (filtered.length === 0)
          showNotification("Aucun resultat trouve.", false);
        else
          showNotification(`${filtered.length} resultat(s) trouve(s).`, true);
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
let currentManipulateOrderBy = null;
let currentManipulateOrderDir = "ASC";

async function loadManipulateTableData(
  tableName,
  page = 1,
  orderBy = null,
  orderDir = "ASC",
) {
  const container = document.querySelector(
    "#manipulate-results-table-container",
  );
  const countSpan = document.querySelector("#manipulate-response-count");
  if (!container) return;

  if (!tableName || String(tableName).trim() === "") {
    container.innerHTML =
      "<p style='color: red;'>Erreur : aucune table selectionnee.</p>";
    if (countSpan) countSpan.textContent = "0";
    return;
  }

  currentManipulateTable = tableName;
  currentManipulatePage = page;
  currentManipulateOrderBy = orderBy;
  currentManipulateOrderDir = orderDir;

  try {
    const activeDbPath = sessionStorage.getItem("current_db_path");
    const offset = (page - 1) * MANIPULATE_PER_PAGE;

    const res = await window.pywebview.api.get_table_rows(
      tableName,
      activeDbPath,
      MANIPULATE_PER_PAGE,
      offset,
      orderBy, // ← nouveau
      orderDir, // ← nouveau
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
