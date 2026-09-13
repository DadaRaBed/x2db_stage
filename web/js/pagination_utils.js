// ============================================
// UTILITAIRES DE PAGINATION
// ============================================

/**
 * Genere une barre de pagination.
 *
 * @param {Object} options
 *   - currentPage  : page actuelle (1-indexee)
 *   - totalItems   : nombre total d'elements
 *   - perPage      : elements par page (defaut: 1000)
 *   - onPageChange : callback(pageNumber)
 * @returns {HTMLElement}
 */
function buildPaginationControls(options) {
  const {
    currentPage = 1,
    totalItems = 0,
    perPage = 1000,
    onPageChange = () => {},
  } = options;

  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const container = document.createElement("div");
  container.className = "pagination-controls";

  if (totalPages <= 1) {
    // Une seule page : on affiche juste le compte
    container.innerHTML = `
      <div class="pagination-info">
        <i class="fas fa-list"></i>
        <strong>${totalItems}</strong> resultat(s)
      </div>
    `;
    return container;
  }

  // --- Bouton "Precedent" ---
  const btnPrev = document.createElement("button");
  btnPrev.type = "button";
  btnPrev.className = "pagination-btn pagination-nav";
  btnPrev.innerHTML = '<i class="fas fa-chevron-left"></i>';
  btnPrev.disabled = currentPage <= 1;
  btnPrev.title = "Page precedente";
  btnPrev.addEventListener("click", () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  });
  container.appendChild(btnPrev);

  // --- Calcul des pages a afficher ---
  const pageNumbers = computePageNumbers(currentPage, totalPages);

  pageNumbers.forEach((pageNum) => {
    if (pageNum === "...") {
      const span = document.createElement("span");
      span.className = "pagination-dots";
      span.textContent = "...";
      container.appendChild(span);
      return;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pagination-btn pagination-number";
    if (pageNum === currentPage) {
      btn.classList.add("active");
    }
    btn.textContent = String(pageNum);
    btn.title = `Page ${pageNum} (${(pageNum - 1) * perPage + 1} - ${Math.min(pageNum * perPage, totalItems)})`;

    btn.addEventListener("click", () => {
      if (pageNum !== currentPage) onPageChange(pageNum);
    });

    container.appendChild(btn);
  });

  // --- Bouton "Suivant" ---
  const btnNext = document.createElement("button");
  btnNext.type = "button";
  btnNext.className = "pagination-btn pagination-nav";
  btnNext.innerHTML = '<i class="fas fa-chevron-right"></i>';
  btnNext.disabled = currentPage >= totalPages;
  btnNext.title = "Page suivante";
  btnNext.addEventListener("click", () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  });
  container.appendChild(btnNext);

  // --- Info (X-Y sur Z) ---
  const start = (currentPage - 1) * perPage + 1;
  const end = Math.min(currentPage * perPage, totalItems);
  const info = document.createElement("div");
  info.className = "pagination-info";
  info.innerHTML = `
    <i class="fas fa-list"></i>
    <strong>${start}</strong> - <strong>${end}</strong> sur <strong>${totalItems}</strong>
    <span class="pagination-total-pages">(page ${currentPage}/${totalPages})</span>
  `;
  container.appendChild(info);

  return container;
}

/**
 * Calcule la liste des numeros de pages a afficher.
 * Format : [1, "...", 5, 6, 7, "...", 20]
 */
function computePageNumbers(currentPage, totalPages) {
  const pages = [];
  const maxVisible = 7; // nombre de boutons visibles max

  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }

  pages.push(1);

  let start = Math.max(2, currentPage - 2);
  let end = Math.min(totalPages - 1, currentPage + 2);

  if (currentPage <= 4) {
    start = 2;
    end = 5;
  } else if (currentPage >= totalPages - 3) {
    start = totalPages - 4;
    end = totalPages - 1;
  }

  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push("...");

  pages.push(totalPages);

  return pages;
}

/**
 * Retourne la tranche d'elements correspondant a la page demandee.
 */
function paginateArray(array, page, perPage = 1000) {
  const start = (page - 1) * perPage;
  const end = start + perPage;
  return array.slice(start, end);
}
