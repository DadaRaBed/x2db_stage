// ============================================
// AUTHENTIFICATION
// ============================================

async function initializeApp() {
  if (appInitialized) return;
  try {
    await waitForApi();
    const status = await window.pywebview.api.get_auth_status();
    appInitialized = true;
    const sessionActive = sessionStorage.getItem("session_active");

    if (!status.first_user_exists) {
      showView(setupView);
    } else if (!status.authenticated && sessionActive !== "true") {
      showView(loginView);
    } else {
      if (status.authenticated) {
        showDashboard(status.user);
      } else {
        showDashboard({ pseudo: "Utilisateur" });
      }
    }
  } catch (error) {
    console.error(error);
    showView(loginView);
    showMessage(
      "#login-message",
      "Impossible de communiquer avec l'application.",
    );
  }
}

// ============================================================
// METTRE A JOUR LE PSEUDO PARTOUT DANS L'INTERFACE
// ============================================================
function updateUserPseudoEverywhere(pseudo) {
  const avatar = getInitials(pseudo);

  // Mettre a jour TOUS les menus, peu importe la page
  const allPseudos = document.querySelectorAll(
    "#menu-pseudo, #menu-pseudo-import, #menu-pseudo-existing, " +
      "#menu-pseudo-duplicates, #menu-pseudo-manipulate, .menu-pseudo-alt",
  );
  allPseudos.forEach((el) => {
    if (el) el.textContent = pseudo;
  });

  const allAvatars = document.querySelectorAll(
    "#menu-avatar, #menu-avatar-import, #menu-avatar-existing, " +
      "#menu-avatar-duplicates, #menu-avatar-manipulate, .menu-avatar-alt",
  );
  allAvatars.forEach((el) => {
    if (el) el.textContent = avatar;
  });

  // Message d'accueil du dashboard
  const greeting = document.querySelector("#welcome-message");
  if (greeting) greeting.textContent = `Bonjour, ${pseudo}`;

  // Stocker pour re-affichage
  window.currentUserPseudo = pseudo;
}

async function showDashboard(user) {
  if (!user) {
    showView(loginView);
    return;
  }

  // Verifier l'acceptation des CGU
  try {
    await waitForApi();
    const cguStatus = await window.pywebview.api.get_cgu_status();
    if (cguStatus && cguStatus.success && !cguStatus.accepted) {
      window.location.href = "cgu.html";
      return;
    }
  } catch (e) {
    console.error("Erreur verification CGU:", e);
  }

  currentLoggedInUser = user;
  window.lastLoggedInUser = user;
  sessionStorage.setItem("session_active", "true");
  sessionStorage.setItem("current_user_pseudo", user.pseudo || "");

  navigationHistory = ["dashboard"];
  showView(dashboardView);

  // ✅ Mettre a jour le pseudo dans TOUS les menus
  updateUserPseudoEverywhere(user.pseudo || "Utilisateur");

  refreshDatabaseStatus();
  loadUserActivities();
  updateFooterVersion();
}

async function logoutUser() {
  try {
    await waitForApi();
    const result = await window.pywebview.api.logout();

    if (result && result.success) {
      sessionStorage.removeItem("session_active");
      sessionStorage.removeItem("current_db_path");
      sessionStorage.removeItem("current_db_name");
      sessionStorage.removeItem("current_user_pseudo");
      currentLoggedInUser = null;
      window.lastLoggedInUser = null;
      window.currentUserPseudo = null;
      isDbOpen = false;
      navigationHistory = [];
      currentManipulateTable = "";
      currentManipulateData = [];
      currentManipulateFiltered = [];
      currentManipulatePage = 1;

      document
        .querySelectorAll(".user-menu")
        .forEach((menu) => menu.classList.add("hidden"));
      document
        .querySelectorAll(".menu-button")
        .forEach((btn) => btn.setAttribute("aria-expanded", "false"));
      updateTerminateButtonVisibility();

      showView(loginView);
      showNotification("Deconnexion reussie.", true);
    } else {
      const errorType = result?.error_type;
      if (errorType === "database_still_open") {
        showNotification(
          "Une base de donnees est encore ouverte. Cliquez sur 'Terminer' avant de vous deconnecter.",
          false,
        );
        setTimeout(() => {
          alert(
            "Impossible de se deconnecter\n\nUne base de donnees est encore ouverte.\n\nVeuillez cliquer sur 'Terminer la base' pour fermer avant de vous deconnecter.",
          );
        }, 100);
      } else if (errorType === "operation_in_progress") {
        showNotification(
          "Une operation est en cours. Veuillez patienter avant de vous deconnecter.",
          false,
        );
      } else {
        showNotification(
          result?.message || "Erreur lors de la deconnexion.",
          false,
        );
      }
    }
  } catch (error) {
    console.error("Erreur lors de la deconnexion:", error);
    showNotification("Erreur lors de la deconnexion.", false);
  }
}
