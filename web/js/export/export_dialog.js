// ============================================
// Export - Export_Dialog
// Fichier extrait automatiquement depuis app.js
// ============================================

// ---------- showExportDialog ----------
function showExportDialog(onExport) {
  const overlay = document.createElement("div");
  overlay.className = "export-dialog-overlay";
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(5px);
    z-index: 99999; display: flex; justify-content: center; align-items: center;
  `;
  overlay.innerHTML = `
    <div style="background: #ffffff; border-radius: 12px; padding: 2rem; max-width: 400px; width: 90%; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); text-align: center;">
      <h3 style="margin: 0 0 0.5rem 0; color: #1a1a2e;"><i class="fas fa-file-export"></i> Exporter</h3>
      <p style="color: #64748b; margin-bottom: 1.5rem;">Choisissez le format d'exportation :</p>
      <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
        <button data-format="pdf" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.95rem; background: #c0392b; color: white;">
          <i class="fas fa-file-pdf"></i> PDF
        </button>
        <button data-format="excel" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.95rem; background: #27ae60; color: white;">
          <i class="fas fa-file-excel"></i> Excel
        </button>
        <button data-format="cancel" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.95rem; background: #6c757d; color: white;">
          <i class="fas fa-times"></i> Annuler
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const format = btn.dataset.format;
      overlay.remove();
      if (format !== "cancel" && typeof onExport === "function") {
        onExport(format);
      }
    });
  });
}

