// ============================================
// MODAL EDITION / AJOUT LIGNE (avec theme sombre)
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
      <div class="form-group" style="margin-bottom: 12px;">
        <label for="edit-field-${escapeHtml(key)}" style="display: block; font-weight: 600; margin-bottom: 4px; color: var(--text-color, #1a1a2e); font-size: 0.85rem;">${escapeHtml(key)}</label>
        <input type="text" id="edit-field-${escapeHtml(key)}" data-column="${escapeHtml(key)}" value="${escapeHtml(value)}"
          style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color, #cbd5e1); border-radius: 4px; box-sizing: border-box; background: var(--bg-input, #ffffff); color: var(--text-color, #1a1a2e);" />
      </div>
    `;
  });

  const title = isNew ? "Ajouter une ligne" : `Modifier la ligne #${rowId}`;

  overlay.innerHTML = `
    <div class="edit-modal-box" style="background: var(--card-bg, #ffffff); color: var(--text-color, #1a1a2e); border-radius: 12px; padding: 24px; max-width: 600px; width: 95%; max-height: 85vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);">
      <h3 style="margin: 0 0 8px 0; color: var(--text-color, #1a1a2e);">
        <i class="fas fa-${isNew ? "plus" : "edit"}" style="color: ${isNew ? "#27ae60" : "#f39c12"};"></i> ${title}
      </h3>
      <p style="color: var(--text-muted, #64748b); font-size: 0.85rem; margin-bottom: 1rem;">
        Table : <strong>${escapeHtml(tableName)}</strong>
      </p>
      <div id="edit-form-fields">${formFields}</div>
      <div class="modal-actions" style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 1.5rem;">
        <button class="btn-cancel" id="btn-cancel-edit" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #6c757d; color: white;">Annuler</button>
        <button class="btn-save" id="btn-save-edit" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #1a4d3a; color: white;">
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
