// ============================================
// Duplicates - Duplicates_Render
// Fichier extrait automatiquement depuis app.js
// ============================================

// ---------- renderDuplicatesWithFilter ----------
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

// ---------- refreshDuplicateResults ----------
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

