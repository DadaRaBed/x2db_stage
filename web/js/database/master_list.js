// ============================================
// CREATION LISTE MERE
// ============================================
async function createMasterList() {
  if (!isDbOpen) {
    showNotification("Veuillez d'abord ouvrir une base.", false);
    return;
  }
  if (
    !confirm(
      "Voulez-vous creer la liste mere ?\n\nCette operation va :\n- Scanner toutes les tables\n- Copier TOUTES les lignes\n- Ignorer les lignes sans nom et prenoms\n\nContinuer ?",
    )
  )
    return;

  let progress = 5;
  showGlobalProgress(progress, true);
  showNotificationWithProgress("Creation de la liste mere...", progress, true);

  const progressInterval = setInterval(() => {
    progress = Math.min(92, progress + (92 - progress) * 0.08);
    showGlobalProgress(progress, true);
    showNotificationWithProgress(
      "Creation de la liste mere...",
      progress,
      true,
    );
  }, 400);
  try {
    await waitForApi();
    const activeDbPath = sessionStorage.getItem("current_db_path");
    const result = await window.pywebview.api.create_master_list(activeDbPath);
    clearInterval(progressInterval);
    showGlobalProgress(100, true);
    showNotificationWithProgress("Liste mere creee !", 100, true);

    if (result?.success) {
      showNotification(result.message || "Liste mere creee.", true);
      logUserAction(
        `Creation liste mere : ${result.total_persons} personne(s)`,
      );
      if (document.getElementById("toggle-show-tables-list")?.checked) {
        await loadDatabaseDetails(activeDbPath);
      }
    } else {
      showNotification(result?.message || "Erreur.", false);
    }
  } catch (error) {
    clearInterval(progressInterval);
    showGlobalProgress(0, false);
    console.error(error);
    showNotification("Erreur lors de la creation.", false);
  }
}

// ============================================
// ACTIVITES
// ============================================
async function loadUserActivities() {
  try {
    await waitForApi();
    const res = await window.pywebview.api.get_activities(5);
    const activityList = document.querySelector("#activity-list");
    const emptyState = document.querySelector("#empty-activity-state");
    const emptyLabel = document.querySelector("#empty-activity-label");

    if (res && res.success && res.activities && res.activities.length > 0) {
      if (emptyState) emptyState.classList.add("hidden");
      if (emptyLabel) emptyLabel.classList.add("hidden");
      if (activityList) {
        activityList.classList.remove("hidden");
        activityList.innerHTML = res.activities
          .map(
            (act) => `
          <div class="activity-item" style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--border-color,#eee);">
            <span><i class="fas fa-history" style="margin-right:8px;color:var(--primary-color,#4f46e5);"></i>
              ${escapeHtml(act.text)}
              <small style="color:var(--text-muted,gray);margin-left:8px;font-weight:400;">(${escapeHtml(act.user || "Utilisateur")})</small>
            </span>
            <small style="color:var(--text-muted,gray);white-space:nowrap;">${escapeHtml(act.date)}</small>
          </div>
        `,
          )
          .join("");
      }
    } else {
      if (activityList) activityList.classList.add("hidden");
      if (emptyState) emptyState.classList.remove("hidden");
      if (emptyLabel) emptyLabel.classList.remove("hidden");
    }
  } catch (e) {
    console.error("Erreur:", e);
  }
}

async function logUserAction(actionText) {
  try {
    await waitForApi();
    if (window.pywebview?.api?.log_activity) {
      await window.pywebview.api.log_activity(actionText);
      loadUserActivities();
    }
  } catch (err) {
    console.error("Erreur:", err);
  }
}
