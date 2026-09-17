// ============================================
// MISES A JOUR (avec theme sombre)
// ============================================

async function checkForUpdates() {
  const overlay = document.createElement("div");
  overlay.className = "edit-modal-overlay";
  overlay.style.zIndex = "99997";

  overlay.innerHTML = `
    <div style="background: var(--card-bg, #ffffff); color: var(--text-color, #1a1a2e); border-radius: 12px; padding: 2rem; max-width: 520px; width: 90%; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4); text-align: center;">
      <div id="update-content">
        <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: #1a4d3a; margin-bottom: 1rem;"></i>
        <h3 style="margin: 0 0 0.5rem 0; color: var(--text-color, #1a1a2e);">Verification des mises a jour...</h3>
        <p style="color: var(--text-muted, #64748b);">Connexion au serveur, veuillez patienter.</p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  const content = overlay.querySelector("#update-content");

  try {
    await waitForApi();
    const result = await window.pywebview.api.check_for_updates();

    // Cas "pas d'internet"
    if (result && result.no_internet) {
      content.innerHTML = `
        <i class="fas fa-wifi" style="font-size: 3rem; color: #dc3545; margin-bottom: 1rem;"></i>
        <h3 style="margin: 0 0 0.5rem 0; color: var(--text-color, #1a1a2e);">Connexion impossible</h3>
        <p style="color: var(--text-muted, #64748b); margin-bottom: 1.5rem;">
          ${escapeHtml(result.message || "Pas de connexion internet ou reseau indisponible.")}
        </p>
        <button type="button" id="btn-close-updates" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #6c757d; color: white;">Fermer</button>
      `;
      content.querySelector("#btn-close-updates").onclick = close;
      return;
    }

    if (!result || !result.success) {
      content.innerHTML = `
        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #f39c12; margin-bottom: 1rem;"></i>
        <h3 style="margin: 0 0 0.5rem 0; color: var(--text-color, #1a1a2e);">Verification impossible</h3>
        <p style="color: var(--text-muted, #64748b); margin-bottom: 1.5rem;">${escapeHtml(result?.message || "Erreur inconnue.")}</p>
        <button type="button" id="btn-close-updates" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #6c757d; color: white;">Fermer</button>
      `;
    } else if (result.up_to_date) {
      content.innerHTML = `
        <i class="fas fa-check-circle" style="font-size: 3rem; color: #27ae60; margin-bottom: 1rem;"></i>
        <h3 style="margin: 0 0 0.5rem 0; color: var(--text-color, #1a1a2e);">Vous etes a jour !</h3>
        <p style="color: var(--text-muted, #64748b); margin-bottom: 1.5rem;">
          Version actuelle : <strong>${escapeHtml(result.current_version)}</strong>
        </p>
        <button type="button" id="btn-close-updates" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #27ae60; color: white;">Fermer</button>
      `;
    } else {
      content.innerHTML = `
        <i class="fas fa-download" style="font-size: 3rem; color: #1a4d3a; margin-bottom: 1rem;"></i>
        <h3 style="margin: 0 0 0.5rem 0; color: var(--text-color, #1a1a2e);">Nouvelle version disponible !</h3>
        <p style="color: var(--text-muted, #64748b); margin-bottom: 0.5rem;">
          Version actuelle : <strong>${escapeHtml(result.current_version)}</strong>
        </p>
        <p style="color: #1a4d3a; font-weight: 600; margin-bottom: 1rem;">
          Nouvelle version : <strong>${escapeHtml(result.latest_version)}</strong>
        </p>
        ${
          result.release_notes
            ? `<div style="text-align: left; background: var(--bg-secondary, #f8fafc); border: 1px solid var(--border-color, #e2e8f0); border-radius: 6px; padding: 12px; margin-bottom: 1rem; max-height: 200px; overflow-y: auto; font-size: 0.85rem; color: var(--text-muted, #475569);">
                <strong style="display: block; margin-bottom: 6px; color: var(--text-color, #1a1a2e);">Notes de version :</strong>
                <pre style="white-space: pre-wrap; word-wrap: break-word; font-family: inherit; margin: 0;">${escapeHtml(result.release_notes)}</pre>
              </div>`
            : ""
        }
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          <button type="button" id="btn-download-update" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #1a4d3a; color: white;">
            <i class="fas fa-download"></i> Telecharger et installer
          </button>
          <button type="button" id="btn-close-updates" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #6c757d; color: white;">Plus tard</button>
        </div>
      `;
      const downloadBtn = content.querySelector("#btn-download-update");
      if (downloadBtn) {
        downloadBtn.onclick = async () => {
          if (
            !confirm(
              "Mise a jour automatique\n\nL'application va :\n1. Telecharger la nouvelle version\n2. Se fermer automatiquement\n3. Se relancer avec la nouvelle version\n\nContinuer ?",
            )
          )
            return;
          downloadBtn.disabled = true;
          downloadBtn.innerHTML =
            '<i class="fas fa-spinner fa-spin"></i> Telechargement...';
          try {
            const res = await window.pywebview.api.download_and_install_update(
              result.download_url,
            );
            if (res && !res.success) {
              alert("Erreur : " + (res.message || "Echec."));
              downloadBtn.disabled = false;
              downloadBtn.innerHTML =
                '<i class="fas fa-download"></i> Telecharger et installer';
            }
          } catch (err) {
            alert("Erreur : " + err.message);
            downloadBtn.disabled = false;
            downloadBtn.innerHTML =
              '<i class="fas fa-download"></i> Telecharger et installer';
          }
        };
      }
    }
    const closeBtn = content.querySelector("#btn-close-updates");
    if (closeBtn) closeBtn.onclick = close;
  } catch (err) {
    console.error(err);
    content.innerHTML = `
      <i class="fas fa-times-circle" style="font-size: 3rem; color: #dc3545; margin-bottom: 1rem;"></i>
      <h3 style="margin: 0 0 0.5rem 0; color: var(--text-color, #1a1a2e);">Erreur</h3>
      <p style="color: var(--text-muted, #64748b); margin-bottom: 1.5rem;">${escapeHtml(err.message || "Impossible de verifier.")}</p>
      <button type="button" id="btn-close-updates" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #6c757d; color: white;">Fermer</button>
    `;
    const closeBtn = content.querySelector("#btn-close-updates");
    if (closeBtn) closeBtn.onclick = close;
  }
}
