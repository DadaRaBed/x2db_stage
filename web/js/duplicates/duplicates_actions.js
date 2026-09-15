// ============================================
// Duplicates - Duplicates_Actions
// Fichier extrait automatiquement depuis app.js
// ============================================

// ---------- deleteSelectedDuplicatesWithProgress ----------
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

// ---------- deleteAllDuplicatesWithProgress ----------
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

