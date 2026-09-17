// ============================================
// AIDE - MANUEL D'UTILISATION (avec theme sombre)
// ============================================

function showHelpModal(section = "intro") {
  const overlay = document.createElement("div");
  overlay.className = "edit-modal-overlay";
  overlay.style.zIndex = "99997";

  const sections = {
    intro: {
      title: "Bienvenue dans xl2db",
      content: `
        <h3 style="color: var(--text-color, #1a1a2e); margin-bottom: 1rem;">Qu'est-ce que xl2db ?</h3>
        <p>xl2db est un convertisseur Excel → SQLite qui vous permet de :</p>
        <ul style="margin-left: 1.5rem; line-height: 1.8;">
          <li>Convertir des fichiers Excel en bases de données SQLite</li>
          <li>Rechercher et supprimer les doublons</li>
          <li>Manipuler, filtrer et exporter vos données</li>
          <li>Créer des listes mères consolidées</li>
        </ul>
      `,
    },
    import: {
      title: "Importer un fichier Excel",
      content: `
        <h3 style="color: var(--text-color, #1a1a2e); margin-bottom: 1rem;">Importer un fichier Excel</h3>
        <ol style="margin-left: 1.5rem; line-height: 1.8;">
          <li>Cliquez sur <strong>"Importer un fichier Excel"</strong> depuis le tableau de bord</li>
          <li>Sélectionnez votre fichier <code>.xlsx</code> ou <code>.xls</code></li>
          <li>Choisissez la feuille à importer (ou toutes)</li>
          <li>Donnez un nom à la table de destination</li>
          <li>Cliquez sur <strong>"Convertir en base de données"</strong></li>
        </ol>
      `,
    },
    duplicates: {
      title: "Rechercher les doublons",
      content: `
        <h3 style="color: var(--text-color, #1a1a2e); margin-bottom: 1rem;">Algorithmes disponibles</h3>
        <ul style="margin-left: 1.5rem; line-height: 1.8;">
          <li><strong>Général</strong> : compare toutes les colonnes</li>
          <li><strong>CIN + NOM + COMMUNE + FKT</strong> : 4 critères</li>
          <li><strong>CIN + NOM + Année</strong> : 3 critères</li>
          <li><strong>CIN + NOM + Année + Commune + FKT + Résidence</strong> : 5 critères</li>
        </ul>
      `,
    },
    manipulate: {
      title: "Manipuler les données",
      content: `
        <h3 style="color: var(--text-color, #1a1a2e); margin-bottom: 1rem;">Fonctionnalités</h3>
        <ul style="margin-left: 1.5rem; line-height: 1.8;">
          <li><strong>Rechercher</strong> : trouve du texte dans la table</li>
          <li><strong>Filtrer</strong> : valeurs distinctes ou colonnes</li>
          <li><strong>Requêtes SQL</strong> : MIN, MAX, COUNT, SUM, GROUP BY</li>
          <li><strong>Requêtes statistiques</strong> : rapports prédéfinis</li>
        </ul>
      `,
    },
    shortcuts: {
      title: "Raccourcis clavier",
      content: `
        <h3 style="color: var(--text-color, #1a1a2e); margin-bottom: 1rem;">Raccourcis par défaut</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: var(--bg-secondary, #f1f5f9);">
              <th style="padding: 8px; text-align: left; color: var(--text-color, #1a1a2e); border-bottom: 1px solid var(--border-color, #e2e8f0);">Raccourci</th>
              <th style="padding: 8px; text-align: left; color: var(--text-color, #1a1a2e); border-bottom: 1px solid var(--border-color, #e2e8f0);">Action</th>
            </tr>
          </thead>
          <tbody id="shortcuts-help-tbody"></tbody>
        </table>
        <p style="margin-top: 1rem; color: var(--text-muted, #64748b);">Personnalisez-les dans <strong>Paramètres → Raccourcis clavier</strong>.</p>
      `,
    },
  };

  const s = sections[section] || sections.intro;

  overlay.innerHTML = `
    <div style="background: var(--card-bg, #ffffff); color: var(--text-color, #1a1a2e); border-radius: 12px; padding: 0; max-width: 800px; width: 95%; max-height: 85vh; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4); display: flex; flex-direction: column;">
      <div style="background: linear-gradient(135deg, #1a4d3a, #3d8b6a); color: white; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between;">
        <h3 style="margin: 0; font-size: 1.2rem; display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-question-circle"></i> Aide - ${escapeHtml(s.title)}
        </h3>
        <button type="button" id="close-help-modal" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 1.5rem; cursor: pointer; width: 32px; height: 32px; border-radius: 50%;">&times;</button>
      </div>
      <div style="display: flex; flex: 1; overflow: hidden;">
        <nav style="width: 220px; background: var(--bg-secondary, #f8fafc); padding: 16px; overflow-y: auto; border-right: 1px solid var(--border-color, #e2e8f0);">
          ${["intro", "import", "duplicates", "manipulate", "shortcuts"]
            .map((sKey) => {
              const labels = {
                intro: "Introduction",
                import: "Import Excel",
                duplicates: "Doublons",
                manipulate: "Manipulation",
                shortcuts: "Raccourcis",
              };
              const icons = {
                intro: "fa-home",
                import: "fa-file-import",
                duplicates: "fa-clone",
                manipulate: "fa-sliders-h",
                shortcuts: "fa-keyboard",
              };
              const isActive = sKey === section;
              return `
                <button class="help-nav-btn" data-section="${sKey}" style="display: block; width: 100%; text-align: left; padding: 10px 12px; margin-bottom: 4px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.9rem; background: ${isActive ? "#1a4d3a" : "transparent"}; color: ${isActive ? "white" : "var(--text-color, #334155)"};">
                  <i class="fas ${icons[sKey]}"></i> ${labels[sKey]}
                </button>
              `;
            })
            .join("")}
        </nav>
        <div style="flex: 1; padding: 24px; overflow-y: auto; color: var(--text-color, #334155); background: var(--card-bg, #ffffff);">
          <div style="font-size: 0.95rem; line-height: 1.7;">
            ${s.content}
          </div>
        </div>
      </div>
      <div style="padding: 12px 24px; border-top: 1px solid var(--border-color, #e2e8f0); background: var(--bg-secondary, #f8fafc); display: flex; justify-content: flex-end;">
        <button type="button" id="btn-close-help" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #6c757d; color: white;">Fermer</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector("#close-help-modal").onclick = close;
  overlay.querySelector("#btn-close-help").onclick = close;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  // Remplir la table des raccourcis si section "shortcuts"
  const shortcutsTbody = overlay.querySelector("#shortcuts-help-tbody");
  if (shortcutsTbody && typeof getShortcutsConfig === "function") {
    const config = getShortcutsConfig();
    Object.entries(config).forEach(([action, keys]) => {
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid var(--border-color, #e2e8f0)";
      tr.innerHTML = `
        <td style="padding: 8px;">
          <kbd style="background: var(--bg-secondary, #f1f5f9); color: var(--text-color, #1a1a2e); padding: 2px 8px; border-radius: 4px; border: 1px solid var(--border-color, #cbd5e1); font-family: monospace;">${escapeHtml(keys)}</kbd>
        </td>
        <td style="padding: 8px; color: var(--text-color, #1a1a2e);">${escapeHtml(getShortcutLabel(action))}</td>
      `;
      shortcutsTbody.appendChild(tr);
    });
  }

  // Navigation entre sections
  overlay.querySelectorAll(".help-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetSection = btn.getAttribute("data-section");
      overlay.remove();
      showHelpModal(targetSection);
    });
  });
}
