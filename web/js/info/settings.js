// ============================================
// PARAMETRES
// ============================================

function showSettingsModal(initialTab = "general") {
  const overlay = document.createElement("div");
  overlay.className = "edit-modal-overlay";
  overlay.style.zIndex = "99997";

  overlay.innerHTML = `
    <div style="background: #ffffff; border-radius: 12px; padding: 0; max-width: 700px; width: 95%; max-height: 85vh; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); display: flex; flex-direction: column;">
      <div style="background: linear-gradient(135deg, #1a4d3a, #3d8b6a); color: white; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between;">
        <h3 style="margin: 0; font-size: 1.2rem; display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-cog"></i> Paramètres
        </h3>
        <button type="button" id="close-settings-modal" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 1.5rem; cursor: pointer; width: 32px; height: 32px; border-radius: 50%;">&times;</button>
      </div>
      <div style="display: flex; flex: 1; overflow: hidden;">
        <nav style="width: 200px; background: #f8fafc; padding: 16px; border-right: 1px solid #e2e8f0;">
          <button class="settings-nav-btn" data-tab="general" style="display: block; width: 100%; text-align: left; padding: 10px 12px; margin-bottom: 4px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.9rem; background: ${initialTab === "general" ? "#1a4d3a" : "transparent"}; color: ${initialTab === "general" ? "white" : "#334155"};">
            <i class="fas fa-sliders-h"></i> Général
          </button>
          <button class="settings-nav-btn" data-tab="shortcuts" style="display: block; width: 100%; text-align: left; padding: 10px 12px; margin-bottom: 4px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.9rem; background: ${initialTab === "shortcuts" ? "#1a4d3a" : "transparent"}; color: ${initialTab === "shortcuts" ? "white" : "#334155"};">
            <i class="fas fa-keyboard"></i> Raccourcis clavier
          </button>
          <button class="settings-nav-btn" data-tab="about" style="display: block; width: 100%; text-align: left; padding: 10px 12px; margin-bottom: 4px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.9rem; background: ${initialTab === "about" ? "#1a4d3a" : "transparent"}; color: ${initialTab === "about" ? "white" : "#334155"};">
            <i class="fas fa-info-circle"></i> À propos
          </button>
        </nav>
        <div id="settings-content" style="flex: 1; padding: 24px; overflow-y: auto;"></div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector("#close-settings-modal").onclick = close;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  const content = overlay.querySelector("#settings-content");

  function renderTab(tab) {
    // Mettre a jour les boutons actifs
    overlay.querySelectorAll(".settings-nav-btn").forEach((b) => {
      const isActive = b.getAttribute("data-tab") === tab;
      b.style.background = isActive ? "#1a4d3a" : "transparent";
      b.style.color = isActive ? "white" : "#334155";
    });

    if (tab === "general") {
      renderGeneralTab(content);
    } else if (tab === "shortcuts") {
      renderShortcutsTab(content);
    } else if (tab === "about") {
      renderAboutTab(content);
    }
  }

  overlay.querySelectorAll(".settings-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      renderTab(btn.getAttribute("data-tab"));
    });
  });

  renderTab(initialTab);
}

// ============================================================
// ONGLET GENERAL
// ============================================================
function renderGeneralTab(container) {
  const currentTheme =
    document.documentElement.getAttribute("data-theme") || "light";
  const isDark = currentTheme === "dark";

  container.innerHTML = `
    <h3 style="margin: 0 0 20px 0; color: #1a1a2e;">Paramètres généraux</h3>

    <div style="margin-bottom: 24px; padding: 16px; background: #f8fafc; border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 600; color: #1a1a2e; margin-bottom: 4px;">
            <i class="fas fa-adjust" style="color: #1a4d3a; margin-right: 8px;"></i>
            Thème
          </div>
          <div style="color: #64748b; font-size: 0.9rem;">Thème clair ou sombre</div>
        </div>
        <button id="btn-toggle-theme" style="padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #1a4d3a; color: white;">
          ${isDark ? "Clair" : "Sombre"}
        </button>
      </div>
    </div>

    <div style="margin-bottom: 24px; padding: 16px; background: #f8fafc; border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 600; color: #1a1a2e; margin-bottom: 4px;">
            <i class="fas fa-key" style="color: #1a4d3a; margin-right: 8px;"></i>
            Changer de mot de passe
          </div>
          <div style="color: #64748b; font-size: 0.9rem;">Modifier votre mot de passe</div>
        </div>
        <button id="btn-change-pwd-settings" style="padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #f39c12; color: white;">
          Modifier
        </button>
      </div>
    </div>

    <div style="margin-bottom: 24px; padding: 16px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #f39c12;">
      <div style="font-weight: 600; color: #856404; margin-bottom: 4px;">
        <i class="fas fa-exclamation-triangle"></i>
        Zone de danger
      </div>
      <div style="color: #856404; font-size: 0.9rem; margin-bottom: 12px;">
        Ces actions sont irréversibles.
      </div>
      <button id="btn-reset-shortcuts" style="padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #dc3545; color: white;">
        Réinitialiser les raccourcis
      </button>
    </div>
  `;

  container.querySelector("#btn-toggle-theme").onclick = () => {
    applyTheme(isDark ? "light" : "dark");
    renderGeneralTab(container);
  };

  container.querySelector("#btn-change-pwd-settings").onclick = () => {
    showChangePasswordModal();
  };

  container.querySelector("#btn-reset-shortcuts").onclick = () => {
    if (!confirm("Réinitialiser tous les raccourcis aux valeurs par défaut ?"))
      return;
    resetShortcutsConfig();
    showNotification("Raccourcis réinitialisés.", true);
  };
}

// ============================================================
// ONGLET RACCOURCIS
// ============================================================
function renderShortcutsTab(container) {
  const config = getShortcutsConfig();
  let recording = null;

  container.innerHTML = `
    <h3 style="margin: 0 0 8px 0; color: #1a1a2e;">Raccourcis clavier</h3>
    <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 20px;">
      Cliquez sur un raccourci puis appuyez sur les touches pour le modifier.
    </p>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #f1f5f9;">
          <th style="padding: 10px; text-align: left; font-size: 0.9rem;">Action</th>
          <th style="padding: 10px; text-align: left; font-size: 0.9rem; width: 200px;">Raccourci</th>
          <th style="padding: 10px; text-align: center; font-size: 0.9rem; width: 80px;">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(config)
          .map(
            ([action, keys]) => `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px; font-size: 0.9rem;">${escapeHtml(getShortcutLabel(action))}</td>
            <td style="padding: 10px;">
              <button
                class="shortcut-btn"
                data-action="${escapeHtml(action)}"
                style="background: #f1f5f9; padding: 6px 14px; border-radius: 6px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: 600; cursor: pointer; min-width: 120px; text-align: center;"
              >${escapeHtml(keys)}</button>
            </td>
            <td style="padding: 10px; text-align: center;">
              <button
                class="shortcut-reset-btn"
                data-action="${escapeHtml(action)}"
                title="Réinitialiser"
                style="background: #6c757d; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;"
              >↺</button>
            </td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;

  container.querySelectorAll(".shortcut-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action");
      recording = action;

      // Etape 1 : demander une touche
      btn.textContent = "Appuyez sur les touches...";
      btn.style.background = "#fef3c7";
      btn.style.borderColor = "#f39c12";

      const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const newShortcut = normalizeShortcut(e);
        if (
          !newShortcut ||
          newShortcut === "Ctrl" ||
          newShortcut === "Alt" ||
          newShortcut === "Shift"
        ) {
          return; // en attente d'une vraie touche
        }

        document.removeEventListener("keydown", handler, true);

        // Mettre a jour la config
        const newConfig = { ...getShortcutsConfig() };
        newConfig[action] = newShortcut;
        saveShortcutsConfig(newConfig);

        showNotification(`Raccourci modifié : ${newShortcut}`, true);
        recording = null;

        // Re-render
        renderShortcutsTab(container);
      };

      document.addEventListener("keydown", handler, true);
    });
  });

  container.querySelectorAll(".shortcut-reset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action");
      const newConfig = { ...getShortcutsConfig() };
      newConfig[action] = DEFAULT_SHORTCUTS[action] || "";
      saveShortcutsConfig(newConfig);
      showNotification("Raccourci réinitialisé.", true);
      renderShortcutsTab(container);
    });
  });
}

// ============================================================
// ONGLET A PROPOS
// ============================================================
function renderAboutTab(container) {
  container.innerHTML = `
    <h3 style="margin: 0 0 20px 0; color: #1a1a2e;">À propos</h3>
    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center;">
      <div style="width: 60px; height: 60px; background: #1a4d3a; color: white; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700; margin-bottom: 12px;">XL</div>
      <div style="font-size: 1.3rem; font-weight: 700; color: #1a1a2e;">xl2db</div>
      <div style="color: #64748b; margin-bottom: 20px;">Expert Edition</div>
      <button id="btn-show-about-full" style="padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #1a4d3a; color: white;">
        <i class="fas fa-info-circle"></i> Voir les détails
      </button>
    </div>
  `;
  container.querySelector("#btn-show-about-full").onclick = () =>
    showAboutModal();
}
