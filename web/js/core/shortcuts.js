// ============================================
// RACCOURCIS CLAVIER
// ============================================

const DEFAULT_SHORTCUTS = {
  search: "Ctrl+F",
  export: "Ctrl+E",
  save: "Ctrl+S",
  close_modal: "Escape",
  help: "F1",
  dashboard: "Ctrl+H",
  duplicates: "Ctrl+D",
  manipulate: "Ctrl+M",
  focus_menu: "Ctrl+Shift+M",
};

const SHORTCUT_LABELS = {
  search: "Rechercher (vue courante)",
  export: "Exporter les résultats",
  save: "Sauvegarder",
  close_modal: "Fermer la fenêtre modale",
  help: "Ouvrir l'aide",
  dashboard: "Aller au tableau de bord",
  duplicates: "Aller à la page Doublons",
  manipulate: "Aller à la page Manipulation",
  focus_menu: "Ouvrir le menu",
};

let _shortcutsConfig = null;

function getShortcutsConfig() {
  if (_shortcutsConfig) return _shortcutsConfig;
  try {
    const stored = localStorage.getItem("xl2db_shortcuts");
    if (stored) {
      _shortcutsConfig = { ...DEFAULT_SHORTCUTS, ...JSON.parse(stored) };
    } else {
      _shortcutsConfig = { ...DEFAULT_SHORTCUTS };
    }
  } catch (e) {
    _shortcutsConfig = { ...DEFAULT_SHORTCUTS };
  }
  return _shortcutsConfig;
}

function saveShortcutsConfig(config) {
  _shortcutsConfig = { ...config };
  try {
    localStorage.setItem("xl2db_shortcuts", JSON.stringify(config));
  } catch (e) {
    console.error("Erreur sauvegarde raccourcis:", e);
  }
}

function resetShortcutsConfig() {
  _shortcutsConfig = { ...DEFAULT_SHORTCUTS };
  try {
    localStorage.removeItem("xl2db_shortcuts");
  } catch (e) {}
  return _shortcutsConfig;
}

function getShortcutLabel(action) {
  return SHORTCUT_LABELS[action] || action;
}

function normalizeShortcut(event) {
  const parts = [];
  if (event.ctrlKey || event.metaKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");

  const key = event.key;
  if (!["Control", "Alt", "Shift", "Meta"].includes(key)) {
    parts.push(key.length === 1 ? key.toUpperCase() : key);
  }

  return parts.join("+");
}

function findActionForShortcut(shortcut) {
  const config = getShortcutsConfig();
  for (const [action, keys] of Object.entries(config)) {
    if (keys === shortcut) return action;
  }
  return null;
}

function executeShortcutAction(action) {
  switch (action) {
    case "search":
      const searchInput = document.getElementById("manipulate-search-input");
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
      break;
    case "export":
      const btnExport = document.getElementById("btn-export-result");
      if (btnExport) btnExport.click();
      break;
    case "save":
      showNotification("Sauvegarde automatique.", true);
      break;
    case "close_modal":
      const modals = document.querySelectorAll(".edit-modal-overlay");
      modals.forEach((m) => m.remove());
      break;
    case "help":
      showHelpModal("intro");
      break;
    case "dashboard":
      goToDashboard();
      break;
    case "duplicates":
      goToDuplicates();
      break;
    case "manipulate":
      if (typeof initManipulatePage === "function") {
        pushNavigationHistory("manipulate");
        showView(manipulateView);
        loadManipulateTables();
      }
      break;
    case "focus_menu":
      const menu = document.querySelector(".menu-button");
      if (menu) menu.click();
      break;
  }
}

function initShortcuts() {
  document.addEventListener("keydown", (event) => {
    // Ignorer si focus dans un input (sauf Escape)
    const target = event.target;
    const isInput =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable;

    const shortcut = normalizeShortcut(event);

    if (isInput && shortcut !== "Escape") {
      return;
    }

    const action = findActionForShortcut(shortcut);
    if (action) {
      event.preventDefault();
      executeShortcutAction(action);
    }
  });
}
