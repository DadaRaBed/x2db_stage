// ============================================
// UTILITAIRES DE TRI
// ============================================

/**
 * Trie un tableau de donnees selon une colonne donnee.
 *
 * @param {Array} dataArray      - Tableau d'objets
 * @param {string} columnName    - Nom de la colonne a trier
 * @param {string} order         - "asc" (A->Z) ou "desc" (Z->A)
 * @returns {Array}              - Nouveau tableau trie
 */
function sortDataByColumn(dataArray, columnName, order = "asc") {
  if (!dataArray || dataArray.length === 0) return [];

  // Copie pour ne pas modifier l'original
  const copy = [...dataArray];

  // Trie avec localeCompare pour gerer accents et casse
  copy.sort((a, b) => {
    const valA = normalizeForSort(a[columnName]);
    const valB = normalizeForSort(b[columnName]);

    // Gestion des vides
    if (!valA && !valB) return 0;
    if (!valA) return 1; // vides a la fin
    if (!valB) return -1;

    const cmp = valA.localeCompare(valB, "fr", { sensitivity: "base" });
    return order === "asc" ? cmp : -cmp;
  });

  return copy;
}

/**
 * Normalise une valeur pour le tri :
 * - Convertit en string
 * - Supprime les espaces en debut/fin
 * - Renvoie "" si null/undefined
 */
function normalizeForSort(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * Affiche une notification de tri.
 */
function notifySort(columnName, order, count) {
  const direction = order === "asc" ? "A → Z" : "Z → A";
  const message = `${count} ligne(s) triee(s) par "${columnName}" (${direction})`;
  if (typeof showNotification === "function") {
    showNotification(message, true);
  }
}

/**
 * Trie et affiche les donnees de manipulation.
 *
 * @param {string} order - "asc" ou "desc"
 */
function sortManipulateData(order) {
  if (typeof currentManipulateFiltered === "undefined") return;
  if (!currentManipulateFiltered || currentManipulateFiltered.length === 0) {
    if (typeof showNotification === "function") {
      showNotification("Aucune donnee a trier.", false);
    }
    return;
  }

  const sorted = sortDataByColumn(
    currentManipulateFiltered,
    "nom_et_prenoms",
    order,
  );

  // Mettre a jour la variable globale
  window.currentManipulateFiltered = sorted;

  // Reafficher
  const container = document.querySelector(
    "#manipulate-results-table-container",
  );
  const countSpan = document.querySelector("#manipulate-response-count");

  if (container && typeof displayManipulateData === "function") {
    const totalCount = window.currentManipulateTotalCount || sorted.length;
    displayManipulateData(sorted, container, countSpan, totalCount);
  }

  notifySort("nom_et_prenoms", order, sorted.length);
}

/**
 * Ajoute les boutons de tri dans une barre d'outils.
 * A appeler apres le chargement du DOM.
 */
function initSortButtons() {
  // Chercher la barre d'outils des resultats
  const toolbar = document.querySelector("#manipulate-results-toolbar");
  if (!toolbar) {
    console.warn("[sort_utils] Barre d'outils des resultats introuvable.");
    return;
  }

  // Eviter de creer les boutons plusieurs fois
  if (toolbar.querySelector("#btn-sort-az")) return;

  const btnAsc = document.createElement("button");
  btnAsc.id = "btn-sort-az";
  btnAsc.type = "button";
  btnAsc.className = "btn-sort";
  btnAsc.innerHTML = '<i class="fas fa-sort-alpha-down"></i> Trier A-Z';
  btnAsc.title = "Trier le nom et prenoms de A a Z";
  btnAsc.addEventListener("click", () => sortManipulateData("asc"));

  const btnDesc = document.createElement("button");
  btnDesc.id = "btn-sort-za";
  btnDesc.type = "button";
  btnDesc.className = "btn-sort";
  btnDesc.style.marginLeft = "8px";
  btnDesc.innerHTML = '<i class="fas fa-sort-alpha-up"></i> Trier Z-A';
  btnDesc.title = "Trier le nom et prenoms de Z a A";
  btnDesc.addEventListener("click", () => sortManipulateData("desc"));

  toolbar.appendChild(btnAsc);
  toolbar.appendChild(btnDesc);
}

// Auto-initialisation au chargement
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(initSortButtons, 500);
});
