// ============================================
// AIDE - MANUEL D'UTILISATION
// ============================================

function showHelpModal(section = "intro") {
  const overlay = document.createElement("div");
  overlay.className = "edit-modal-overlay";
  overlay.style.zIndex = "99997";

  const sections = {
    intro: {
      title: "Bienvenue dans xl2db",
      icon: "fa-home",
      content: `
        <h3>Qu'est-ce que xl2db ?</h3>
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
      icon: "fa-file-import",
      content: `
        <h3>Importer un fichier Excel</h3>
        <ol style="margin-left: 1.5rem; line-height: 1.8;">
          <li>Cliquez sur <strong>"Importer un fichier Excel"</strong> depuis le tableau de bord</li>
          <li>Sélectionnez votre fichier <code>.xlsx</code> ou <code>.xls</code></li>
          <li>Choisissez la feuille à importer (ou toutes)</li>
          <li>Donnez un nom à la table de destination</li>
          <li>Cliquez sur <strong>"Convertir en base de données"</strong></li>
        </ol>
        <p style="margin-top: 1rem; padding: 10px; background: #fff3cd; border-left: 4px solid #f39c12; border-radius: 4px;">
          <strong>Astuce :</strong> La première ligne du fichier Excel devient les noms de colonnes.
        </p>
      `,
    },
    duplicates: {
      title: "Rechercher les doublons",
      icon: "fa-clone",
      content: `
        <h3>Algorithme de recherche</h3>
        <p>4 algorithmes sont disponibles :</p>
        <ul style="margin-left: 1.5rem; line-height: 1.8;">
          <li><strong>Général</strong> : compare toutes les colonnes</li>
          <li><strong>CIN + NOM + COMMUNE + FKT</strong> : basé sur 4 critères</li>
          <li><strong>CIN + NOM + Année</strong> : 3 critères</li>
          <li><strong>CIN + NOM + Année + Commune + FKT + Résidence</strong> : 5 critères avec règle spéciale sur le CIN</li>
        </ul>
        <h3 style="margin-top: 1.5rem;">Utilisation</h3>
        <ol style="margin-left: 1.5rem; line-height: 1.8;">
          <li>Sélectionnez l'algorithme</li>
          <li>Cochez les tables à analyser</li>
          <li>Cliquez sur <strong>"Lancer l'analyse"</strong></li>
          <li>Parcourez les résultats et supprimez les doublons</li>
        </ol>
      `,
    },
    manipulate: {
      title: "Manipuler les données",
      icon: "fa-sliders-h",
      content: `
        <h3>Fonctionnalités disponibles</h3>
        <ul style="margin-left: 1.5rem; line-height: 1.8;">
          <li><strong>Rechercher</strong> : trouve du texte dans la table affichée</li>
          <li><strong>Filtrer</strong> : valeurs distinctes ou colonnes à afficher</li>
          <li><strong>Requêtes SQL</strong> : construire des requêtes (MIN, MAX, COUNT, SUM, GROUP BY...)</li>
          <li><strong>Requêtes statistiques</strong> : rapport prédéfinis</li>
        </ul>
        <h3 style="margin-top: 1.5rem;">Raccourcis</h3>
        <ul style="margin-left: 1.5rem; line-height: 1.8;">
          <li><kbd>Ctrl</kbd> + <kbd>F</kbd> : ouvrir la recherche</li>
          <li><kbd>Ctrl</kbd> + <kbd>E</kbd> : exporter les résultats</li>
        </ul>
      `,
    },
    shortcuts: {
      title: "Raccourcis clavier",
      icon: "fa-keyboard",
      content: `
        <h3>Raccourcis par défaut</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #1a4d3a; color: white;">
              <th style="padding: 8px; text-align: left;">Raccourci</th>
              <th style="padding: 8px; text-align: left;">Action</th>
            </tr>
          </thead>
          <tbody id="shortcuts-help-tbody">
            <!-- rempli par JS -->
          </tbody>
        </table>
        <p style="margin-top: 1rem;">Personnalisez-les dans <strong>Paramètres → Raccourcis clavier</strong>.</p>
      `,
    },
  };

  const s = sections[section] || sections.intro;

  overlay.innerHTML = `
    <div style="background: #ffffff; border-radius: 12px; padding: 0; max-width: 800px; width: 95%; max-height: 85vh; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); display: flex; flex-direction: column;">
      <div style="background: linear-gradient(135deg, #1a4d3a, #3d8b6a); color: white; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between;">
        <h3 style="margin: 0; font-size: 1.2rem; display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-question-circle"></i> Aide - ${escapeHtml(s.title)}
        </h3>
        <button type="button" id="close-help-modal" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 1.5rem; cursor: pointer; width: 32px; height: 32px; border-radius: 50%;">&times;</button>
      </div>
      <div style="display: flex; flex: 1; overflow: hidden;">
        <nav style="width: 220px; background: #f8fafc; padding: 16px; overflow-y: auto; border-right: 1px solid #e2e8f0;">
          <button class="help-nav-btn ${section === "intro" ? "active" : ""}" data-section="intro" style="display: block; width: 100%; text-align: left; padding: 10px 12px; margin-bottom: 4px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.9rem; background: ${section === "intro" ? "#1a4d3a" : "transparent"}; color: ${section === "intro" ? "white" : "#334155"};">
            <i class="fas fa-home"></i> Introduction
          </button>
          <button class="help-nav-btn ${section === "import" ? "active" : ""}" data-section="import" style="display: block; width: 100%; text-align: left; padding: 10px 12px; margin-bottom: 4px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.9rem; background: ${section === "import" ? "#1a4d3a" : "transparent"}; color: ${section === "import" ? "white" : "#334155"};">
            <i class="fas fa-file-import"></i> Import Excel
          </button>
          <button class="help-nav-btn ${section === "duplicates" ? "active" : ""}" data-section="duplicates" style="display: block; width: 100%; text-align: left; padding: 10px 12px; margin-bottom: 4px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.9rem; background: ${section === "duplicates" ? "#1a4d3a" : "transparent"}; color: ${section === "duplicates" ? "white" : "#334155"};">
            <i class="fas fa-clone"></i> Doublons
          </button>
          <button class="help-nav-btn ${section === "manipulate" ? "active" : ""}" data-section="manipulate" style="display: block; width: 100%; text-align: left; padding: 10px 12px; margin-bottom: 4px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.9rem; background: ${section === "manipulate" ? "#1a4d3a" : "transparent"}; color: ${section === "manipulate" ? "white" : "#334155"};">
            <i class="fas fa-sliders-h"></i> Manipulation
          </button>
          <button class="help-nav-btn ${section === "shortcuts" ? "active" : ""}" data-section="shortcuts" style="display: block; width: 100%; text-align: left; padding: 10px 12px; margin-bottom: 4px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.9rem; background: ${section === "shortcuts" ? "#1a4d3a" : "transparent"}; color: ${section === "shortcuts" ? "white" : "#334155"};">
            <i class="fas fa-keyboard"></i> Raccourcis
          </button>
        </nav>
        <div style="flex: 1; padding: 24px; overflow-y: auto; color: #334155;">
          <div style="font-size: 0.95rem; line-height: 1.7;">
            ${s.content}
          </div>
        </div>
      </div>
      <div style="padding: 12px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc; display: flex; justify-content: flex-end;">
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
      tr.style.borderBottom = "1px solid #e2e8f0";
      tr.innerHTML = `
        <td style="padding: 8px;"><kbd style="background: #f1f5f9; padding: 2px 8px; border-radius: 4px; border: 1px solid #cbd5e1; font-family: monospace;">${escapeHtml(keys)}</kbd></td>
        <td style="padding: 8px;">${escapeHtml(getShortcutLabel(action))}</td>
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
