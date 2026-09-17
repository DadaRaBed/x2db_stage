// ============================================
// A PROPOS (avec theme sombre)
// ============================================

async function getAppInfo() {
  if (appInfoCache) return appInfoCache;
  try {
    await waitForApi();
    const info = await window.pywebview.api.get_app_info();
    if (info && info.success) {
      appInfoCache = info;
      return info;
    }
  } catch (e) {
    console.error("Erreur get_app_info:", e);
  }
  return null;
}

async function updateFooterVersion() {
  try {
    const info = await getAppInfo();
    const el = document.getElementById("footer-version");
    if (el && info) el.textContent = info.app_version || "1.0.0";
  } catch (e) {}
}

async function showAboutModal() {
  const info = await getAppInfo();
  const appName = info?.app_name || "xl2db";
  const appVersion = info?.app_version || "1.0.0";
  const devName = info?.developer_name || "DadaRaBed";
  const devEmail = info?.developer_email || "nanoonadjah3@gmail.com";
  const githubRepo = info?.github_repo || "DadaRaBed";
  const pythonVersion = info?.python_version || "-";
  const platform = info?.platform || "-";

  const overlay = document.createElement("div");
  overlay.className = "edit-modal-overlay";
  overlay.style.zIndex = "99997";

  overlay.innerHTML = `
    <div style="background: var(--card-bg, #ffffff); color: var(--text-color, #1a1a2e); border-radius: 12px; padding: 0; max-width: 720px; width: 95%; max-height: 88vh; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4); display: flex; flex-direction: column;">
      <div style="background: linear-gradient(135deg, #1a4d3a, #3d8b6a); color: white; padding: 24px; display: flex; align-items: center; gap: 16px;">
        <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; font-weight: 700;">XL</div>
        <div style="flex: 1;">
          <h2 style="margin: 0 0 4px 0; font-size: 1.6rem;">${escapeHtml(appName)}</h2>
          <div style="opacity: 0.9; font-size: 0.95rem;">Version ${escapeHtml(appVersion)} - Expert Edition</div>
        </div>
        <button type="button" id="close-about-modal" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 1.5rem; cursor: pointer; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">&times;</button>
      </div>
      <div style="padding: 24px; overflow-y: auto; flex: 1; background: var(--card-bg, #ffffff); color: var(--text-color, #1a1a2e);">
        <h3 style="margin: 0 0 12px 0; color: var(--text-color, #1a1a2e); display: flex; align-items: center; gap: 8px; font-size: 1.1rem;">
          <i class="fas fa-book" style="color: #1a4d3a;"></i> Guide de l'application
        </h3>
        <div style="background: var(--bg-secondary, #f8fafc); border: 1px solid var(--border-color, #e2e8f0); border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #1a4d3a;">
          <div style="margin-bottom: 14px;">
            <strong style="color: #1a4d3a; display: block; margin-bottom: 4px;"><i class="fas fa-file-import"></i> 1. Importer un fichier Excel</strong>
            <div style="color: var(--text-muted, #475569); font-size: 0.9rem;">Convertissez un fichier Excel (.xlsx, .xls) en base de donnees SQLite. Chaque feuille devient une table.</div>
          </div>
          <div style="margin-bottom: 14px;">
            <strong style="color: #1a4d3a; display: block; margin-bottom: 4px;"><i class="fas fa-folder-open"></i> 2. Travailler avec une base existante</strong>
            <div style="color: var(--text-muted, #475569); font-size: 0.9rem;">Ouvrez une base de donnees existante pour la manipuler, chercher les doublons, ou l'exporter vers Excel.</div>
          </div>
          <div style="margin-bottom: 14px;">
            <strong style="color: #1a4d3a; display: block; margin-bottom: 4px;"><i class="fas fa-clone"></i> 3. Trouver les doublons</strong>
            <div style="color: var(--text-muted, #475569); font-size: 0.9rem;">Detectez les doublons avec differents algorithmes : General, CIN+NOM, CIN+NOM+ANNEE, CIN+NOM+ANNEE+COMMUNE+FKT.</div>
          </div>
          <div style="margin-bottom: 14px;">
            <strong style="color: #1a4d3a; display: block; margin-bottom: 4px;"><i class="fas fa-users"></i> 4. Creer une liste mere</strong>
            <div style="color: var(--text-muted, #475569); font-size: 0.9rem;">Copiez TOUTES les lignes de TOUTES les tables dans une seule table <code>listes_meres</code>, avec tracabilite.</div>
          </div>
          <div style="margin-bottom: 14px;">
            <strong style="color: #1a4d3a; display: block; margin-bottom: 4px;"><i class="fas fa-sliders-h"></i> 5. Manipuler les donnees</strong>
            <div style="color: var(--text-muted, #475569); font-size: 0.9rem;">Filtrez, recherchez, modifiez, supprimez. Utilisez la pagination pour naviguer dans les grandes tables.</div>
          </div>
          <div>
            <strong style="color: #1a4d3a; display: block; margin-bottom: 4px;"><i class="fas fa-file-excel"></i> 6. Exporter vers Excel</strong>
            <div style="color: var(--text-muted, #475569); font-size: 0.9rem;">Exportez vos tables ou resultats vers Excel avec une mise en forme professionnelle automatique.</div>
          </div>
        </div>
        <h3 style="margin: 0 0 12px 0; color: var(--text-color, #1a1a2e); display: flex; align-items: center; gap: 8px; font-size: 1.1rem;">
          <i class="fas fa-user-circle" style="color: #1a4d3a;"></i> A propos du developpeur
        </h3>
        <div style="background: var(--bg-secondary, #f8fafc); border: 1px solid var(--border-color, #e2e8f0); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <div style="font-size: 1rem; font-weight: 600; color: var(--text-color, #1a1a2e); margin-bottom: 8px;">${escapeHtml(devName)}</div>
          <div style="color: var(--text-muted, #475569); font-size: 0.9rem; margin-bottom: 12px;">
            Developpeur de l'application ${escapeHtml(appName)}. N'hesitez pas a me contacter pour toute question, suggestion ou signalement de bug.
          </div>
          <div style="display: flex; align-items: center; gap: 8px; color: var(--text-muted, #475569); font-size: 0.9rem; margin-bottom: 8px;">
            <i class="fas fa-envelope" style="color: #1a4d3a; width: 18px;"></i>
            <a href="mailto:${escapeHtml(devEmail)}" style="color: #1a4d3a; text-decoration: none;">${escapeHtml(devEmail)}</a>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; color: var(--text-muted, #475569); font-size: 0.9rem;">
            <i class="fab fa-github" style="color: #1a4d3a; width: 18px;"></i>
            <a href="https://github.com/${escapeHtml(githubRepo)}" style="color: #1a4d3a; text-decoration: none;" onclick="window.pywebview.api.open_url_in_browser('https://github.com/${escapeHtml(githubRepo)}'); return false;">
              github.com/${escapeHtml(githubRepo)}
            </a>
          </div>
        </div>
        <details style="background: var(--bg-secondary, #f1f5f9); border: 1px solid var(--border-color, #e2e8f0); border-radius: 8px; padding: 12px 16px;">
          <summary style="cursor: pointer; font-weight: 600; color: var(--text-color, #475569); font-size: 0.9rem;">
            <i class="fas fa-cog"></i> Informations techniques
          </summary>
          <div style="margin-top: 12px; font-size: 0.85rem; color: var(--text-muted, #64748b);">
            <div><strong>Version :</strong> ${escapeHtml(appVersion)}</div>
            <div><strong>Python :</strong> ${escapeHtml(pythonVersion)}</div>
            <div><strong>Plateforme :</strong> ${escapeHtml(platform)}</div>
            <div><strong>Mode :</strong> ${info?.frozen ? "EXE (PyInstaller)" : "DEV"}</div>
          </div>
        </details>
      </div>
      <div style="padding: 16px 24px; border-top: 1px solid var(--border-color, #e2e8f0); background: var(--bg-secondary, #f8fafc); display: flex; justify-content: flex-end; gap: 10px;">
        <button type="button" id="btn-close-about" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #6c757d; color: white;">Fermer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector("#close-about-modal").onclick = close;
  overlay.querySelector("#btn-close-about").onclick = close;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
}
