// ============================================
// Duplicates - Fullscreen_Modal
// Fichier extrait automatiquement depuis app.js
// ============================================

// ---------- openFullScreenModal ----------
function openFullScreenModal(titleText, htmlContent) {
  document.getElementById("fullscreen-modal-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "fullscreen-modal-overlay";
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(10px);
    z-index: 99999; display: flex; justify-content: center; align-items: center; padding: 20px;
  `;

  overlay.innerHTML = `
    <div style="background: #ffffff; color: #1a1a2e; width: 100vw; height: 100vh; border-radius: 0; display: flex; flex-direction: column; overflow: hidden;">
      <div style="padding: 16px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
        <h2 style="margin: 0; font-size: 1.4rem; display: flex; align-items: center; gap: 12px; color: #1a1a2e;">
          <i class="fas fa-expand" style="color: #1a4d3a;"></i>
          <span id="modal-title-text" style="color: #1a1a2e;">${escapeHtml(titleText)}</span>
        </h2>
        <button type="button" id="close-fullscreen-modal" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: #1a1a2e;">&times;</button>
      </div>
      <div id="fullscreen-modal-body" style="padding: 24px; overflow-y: auto; flex: 1; background: #ffffff; color: #1a1a2e;"></div>
      <div style="padding: 14px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc; display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;">
        <button type="button" class="button button-primary" id="modal-btn-select-all" style="background: #1a4d3a; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: 600;">
          <i class="fas fa-check-double"></i> Tout selectionner
        </button>
        <button type="button" class="button button-primary" id="modal-btn-delete" style="background: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: 600;">
          <i class="fas fa-trash"></i> Supprimer selectionnes
        </button>
        <button type="button" class="secondary-button" id="modal-btn-fermer" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">
          <i class="fas fa-times"></i> Fermer
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const body = document.getElementById("fullscreen-modal-body");

  // Injecter le HTML en gardant les attributs data-*
  body.innerHTML = htmlContent;

  // S'assurer que les checkboxes du modal sont reconnues
  body.querySelectorAll("input[type='checkbox']").forEach((chk) => {
    if (!chk.classList.contains("dup-checkbox")) {
      chk.classList.add("dup-checkbox");
    }
  });

  // Forcer les couleurs (le HTML injecte peut avoir d'autres styles)
  const style = document.createElement("style");
  style.textContent = `
    #fullscreen-modal-body table { background: #ffffff !important; color: #1a1a2e !important; }
    #fullscreen-modal-body th { background: #1a4d3a !important; color: white !important; }
    #fullscreen-modal-body td { background: #ffffff !important; color: #1a1a2e !important; border: 1px solid #e2e8f0 !important; }
    #fullscreen-modal-body tr:nth-child(even) td { background: #f8fafc !important; }
    #fullscreen-modal-body tr:hover td { background: #e8f3ef !important; }
  `;
  body.appendChild(style);

  // Fermer
  const close = () => overlay.remove();
  document.getElementById("close-fullscreen-modal").onclick = close;
  document.getElementById("modal-btn-fermer").onclick = close;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  // ============================================================
  // TOUT SELECTIONNER (corrige : parcourt tout le modal)
  // ============================================================
  document.getElementById("modal-btn-select-all").onclick = () => {
    const checkboxes = body.querySelectorAll("input[type='checkbox']");
    if (checkboxes.length === 0) {
      showNotification("Aucune case a cocher trouvee.", false);
      return;
    }
    const allChecked = Array.from(checkboxes).every((c) => c.checked);
    checkboxes.forEach((c) => (c.checked = !allChecked));
    showNotification(
      allChecked
        ? "Tout deselectionne"
        : `Tout selectionne (${checkboxes.length})`,
      true,
    );
  };

  // ============================================================
  // SUPPRIMER SELECTIONNES (corrige : utilise les data-* du modal)
  // ============================================================
  document.getElementById("modal-btn-delete").onclick = async () => {
    // Recuperer UNIQUEMENT les checkboxes cochees qui ont des data-table/data-rowid
    const checked = body.querySelectorAll("input[type='checkbox']:checked");
    if (checked.length === 0) {
      showNotification("Veuillez selectionner au moins un element.", false);
      return;
    }

    const items = [];
    checked.forEach((chk) => {
      const tableName = chk.getAttribute("data-table");
      const rowIndex = chk.getAttribute("data-rowid");
      if (tableName && rowIndex) {
        items.push({ tableName, row_index: parseInt(rowIndex, 10) });
      }
    });

    if (items.length === 0) {
      showNotification("Aucun element valide a supprimer.", false);
      return;
    }

    if (
      !confirm(
        `Supprimer ${items.length} element(s) ? Cette action est irreversible.`,
      )
    )
      return;

    try {
      await waitForApi();
      const activeDbPath = sessionStorage.getItem("current_db_path");
      const result = await window.pywebview.api.delete_duplicates_batch(
        items,
        activeDbPath,
      );
      if (result && result.success) {
        showNotification(`${result.deleted} element(s) supprime(s).`, true);
        logUserAction(`Suppression de ${result.deleted} elements`);

        // Retirer les lignes supprimees du DOM du modal
        const deletedIds = new Set(
          items.map((i) => `${i.tableName}|${i.row_index}`),
        );
        body
          .querySelectorAll("input[type='checkbox'][data-table][data-rowid]")
          .forEach((chk) => {
            const key = `${chk.getAttribute("data-table")}|${chk.getAttribute("data-rowid")}`;
            if (deletedIds.has(key)) {
              // Supprimer les 2 lignes correspondantes (DOUBLON + REFERENCE)
              const tr = chk.closest("tr");
              if (tr) {
                const nextTr = tr.nextElementSibling;
                tr.remove();
                if (nextTr) nextTr.remove();
              }
            }
          });

        // Mettre a jour les compteurs
        const remaining = body.querySelectorAll(
          "input[type='checkbox'][data-table]",
        ).length;
        if (remaining === 0) {
          body.innerHTML =
            '<p style="color: #27ae60; text-align: center; padding: 2rem;">Tous les elements ont ete supprimes.</p>';
        }
      } else {
        showNotification(
          result?.message || "Erreur lors de la suppression.",
          false,
        );
      }
    } catch (err) {
      console.error(err);
      showNotification("Erreur lors de la suppression.", false);
    }
  };
}

