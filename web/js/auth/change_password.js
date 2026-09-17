// ============================================
// CHANGER DE MOT DE PASSE (avec theme sombre)
// ============================================

function showChangePasswordModal() {
  const overlay = document.createElement("div");
  overlay.className = "edit-modal-overlay";
  overlay.style.zIndex = "99997";

  overlay.innerHTML = `
    <div style="background: var(--card-bg, #ffffff); color: var(--text-color, #1a1a2e); border-radius: 12px; padding: 0; max-width: 480px; width: 95%; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4); overflow: hidden;">
      <div style="background: linear-gradient(135deg, #1a4d3a, #3d8b6a); color: white; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between;">
        <h3 style="margin: 0; font-size: 1.2rem; display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-key"></i> Changer de mot de passe
        </h3>
        <button type="button" id="close-chpwd-modal" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 1.5rem; cursor: pointer; width: 32px; height: 32px; border-radius: 50%;">&times;</button>
      </div>
      <div style="padding: 24px;">
        <div class="form-group" style="margin-bottom: 1rem;">
          <label style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--text-color, #334155); font-size: 0.9rem;">
            Ancien mot de passe :
          </label>
          <input type="password" id="chpwd-old" placeholder="Votre mot de passe actuel" autocomplete="current-password"
            style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color, #cbd5e1); border-radius: 6px; font-size: 0.9rem; box-sizing: border-box; background: var(--bg-input, #ffffff); color: var(--text-color, #1a1a2e);" />
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--text-color, #334155); font-size: 0.9rem;">
            Nouveau mot de passe :
          </label>
          <input type="password" id="chpwd-new" placeholder="Au moins 6 caracteres" autocomplete="new-password"
            style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color, #cbd5e1); border-radius: 6px; font-size: 0.9rem; box-sizing: border-box; background: var(--bg-input, #ffffff); color: var(--text-color, #1a1a2e);" />
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--text-color, #334155); font-size: 0.9rem;">
            Confirmer le nouveau mot de passe :
          </label>
          <input type="password" id="chpwd-confirm" placeholder="Retapez le nouveau mot de passe" autocomplete="new-password"
            style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color, #cbd5e1); border-radius: 6px; font-size: 0.9rem; box-sizing: border-box; background: var(--bg-input, #ffffff); color: var(--text-color, #1a1a2e);" />
        </div>
        <div id="chpwd-status" style="margin-bottom: 1rem;"></div>
        <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 1.5rem;">
          <button type="button" id="btn-cancel-chpwd" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #6c757d; color: white;">Annuler</button>
          <button type="button" id="btn-save-chpwd" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #1a4d3a; color: white;">
            <i class="fas fa-save"></i> Enregistrer
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector("#close-chpwd-modal").onclick = close;
  overlay.querySelector("#btn-cancel-chpwd").onclick = close;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  const statusEl = overlay.querySelector("#chpwd-status");

  overlay.querySelector("#btn-save-chpwd").onclick = async () => {
    const oldPwd = overlay.querySelector("#chpwd-old").value;
    const newPwd = overlay.querySelector("#chpwd-new").value;
    const confirm = overlay.querySelector("#chpwd-confirm").value;

    if (!oldPwd || !newPwd || !confirm) {
      statusEl.innerHTML =
        '<p style="color: #dc3545; font-size: 0.9rem;"><i class="fas fa-exclamation-circle"></i> Tous les champs sont obligatoires.</p>';
      return;
    }
    if (newPwd.length < 6) {
      statusEl.innerHTML =
        '<p style="color: #dc3545; font-size: 0.9rem;"><i class="fas fa-exclamation-circle"></i> Le nouveau mot de passe doit contenir au moins 6 caracteres.</p>';
      return;
    }
    if (newPwd !== confirm) {
      statusEl.innerHTML =
        '<p style="color: #dc3545; font-size: 0.9rem;"><i class="fas fa-exclamation-circle"></i> Les mots de passe ne correspondent pas.</p>';
      return;
    }

    statusEl.innerHTML =
      '<p style="color: #1a4d3a; font-size: 0.9rem;"><i class="fas fa-spinner fa-spin"></i> Modification...</p>';

    try {
      await waitForApi();
      const res = await window.pywebview.api.change_password(oldPwd, newPwd);
      if (res && res.success) {
        statusEl.innerHTML =
          '<p style="color: #27ae60; font-size: 0.9rem;"><i class="fas fa-check-circle"></i> Mot de passe modifie.</p>';
        setTimeout(() => {
          close();
          showNotification("Mot de passe modifie avec succes.", true);
          logUserAction("Changement de mot de passe");
        }, 1200);
      } else {
        statusEl.innerHTML =
          '<p style="color: #dc3545; font-size: 0.9rem;"><i class="fas fa-times-circle"></i> ' +
          escapeHtml(res?.message || "Erreur.") +
          "</p>";
      }
    } catch (err) {
      statusEl.innerHTML =
        '<p style="color: #dc3545; font-size: 0.9rem;"><i class="fas fa-times-circle"></i> ' +
        escapeHtml(err.message) +
        "</p>";
    }
  };
}
