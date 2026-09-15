// ============================================
// FONCTIONS UTILITAIRES
// ============================================
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getInitials(pseudo) {
  const value = String(pseudo || "").trim();
  return value ? value.slice(0, 2).toUpperCase() : "?";
}

function isApiReady() {
  const api = window.pywebview?.api;
  return Boolean(
    api &&
    typeof api.get_auth_status === "function" &&
    typeof api.create_first_user === "function" &&
    typeof api.login === "function" &&
    typeof api.logout === "function",
  );
}

function waitForApi() {
  if (isApiReady()) return Promise.resolve();
  if (apiReadyPromise) return apiReadyPromise;

  apiReadyPromise = new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      if (isApiReady()) {
        resolve();
        return;
      }
      attempts += 1;
      if (attempts >= 100) {
        reject(new Error("API pywebview indisponible."));
        return;
      }
      setTimeout(check, 100);
    };
    check();
  });
  return apiReadyPromise;
}

function updateSelectAllButton() {
  const checkboxes = document.querySelectorAll(".dup-checkbox");
  const selectAllBtn = document.querySelector("#btn-select-all-dups");
  if (!selectAllBtn || checkboxes.length === 0) return;

  const checked = Array.from(checkboxes).filter((chk) => chk.checked).length;
  const total = checkboxes.length;

  if (checked === total) selectAllBtn.textContent = "Tout deselectionner";
  else if (checked === 0) selectAllBtn.textContent = "Tout selectionner";
  else selectAllBtn.textContent = `Tout selectionner (${checked}/${total})`;
}
