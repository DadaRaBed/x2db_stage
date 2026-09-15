// ============================================
// MOT DE PASSE OUBLIE (SMTP)
// ============================================
function resetForgotPasswordUI() {
  forgotPasswordState = { step: 1, userId: null, pseudo: null, email: null };

  const s1 = document.getElementById("forgot-step-email");
  const s2 = document.getElementById("forgot-step-code");
  const s3 = document.getElementById("forgot-step-password");
  if (s1) s1.classList.remove("hidden");
  if (s2) s2.classList.add("hidden");
  if (s3) s3.classList.add("hidden");

  [
    "forgot-email-input",
    "forgot-code-input",
    "forgot-new-password",
    "forgot-confirm-password",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const title = document.getElementById("forgot-title");
  const subtitle = document.getElementById("forgot-subtitle");
  if (title) title.textContent = "Mot de passe oublie";
  if (subtitle)
    subtitle.textContent =
      "Saisissez votre email pour recevoir un code de validation.";
  showMessage("#forgot-message", "");
}

function showForgotPasswordView() {
  resetForgotPasswordUI();
  showView(forgotPasswordView);
  setTimeout(() => document.getElementById("forgot-email-input")?.focus(), 100);
}

function cancelForgotPassword() {
  resetForgotPasswordUI();
  showView(loginView);
}

async function handleForgotEmailSubmit(e) {
  e.preventDefault();
  const email = document.getElementById("forgot-email-input")?.value.trim();
  if (!email) {
    showMessage("#forgot-message", "Veuillez saisir votre email.");
    return;
  }
  try {
    await waitForApi();
    const result = await window.pywebview.api.request_password_reset(email);
    if (!result || !result.success) {
      showMessage("#forgot-message", result?.message || "Erreur.");
      return;
    }

    forgotPasswordState.step = 2;
    forgotPasswordState.userId = result.user_id;
    forgotPasswordState.pseudo = result.pseudo;
    forgotPasswordState.email = email;

    document.getElementById("forgot-step-email")?.classList.add("hidden");
    document.getElementById("forgot-step-code")?.classList.remove("hidden");

    const title = document.getElementById("forgot-title");
    const subtitle = document.getElementById("forgot-subtitle");
    const userName = document.getElementById("forgot-user-name");
    if (title) title.textContent = "Verification du code";
    if (subtitle)
      subtitle.textContent =
        "Un code vous a ete envoye par email (verifiez aussi les spams).";
    if (userName) userName.textContent = `Utilisateur : ${result.pseudo}`;

    showMessage("#forgot-message", result.message, true);
    setTimeout(
      () => document.getElementById("forgot-code-input")?.focus(),
      100,
    );
  } catch (err) {
    console.error(err);
    showMessage("#forgot-message", "Erreur de communication.");
  }
}

async function handleForgotCodeSubmit(e) {
  e.preventDefault();
  const code = document.getElementById("forgot-code-input")?.value.trim();
  if (!code) {
    showMessage("#forgot-message", "Veuillez saisir le code.");
    return;
  }
  try {
    await waitForApi();
    const result = await window.pywebview.api.verify_reset_code(
      forgotPasswordState.userId,
      code,
    );
    if (!result || !result.success) {
      showMessage("#forgot-message", result?.message || "Code incorrect.");
      return;
    }

    forgotPasswordState.step = 3;
    document.getElementById("forgot-step-code")?.classList.add("hidden");
    document.getElementById("forgot-step-password")?.classList.remove("hidden");

    const title = document.getElementById("forgot-title");
    const subtitle = document.getElementById("forgot-subtitle");
    const userName2 = document.getElementById("forgot-user-name-2");
    if (title) title.textContent = "Nouveau mot de passe";
    if (subtitle) subtitle.textContent = "Choisissez un nouveau mot de passe.";
    if (userName2)
      userName2.textContent = `Utilisateur : ${forgotPasswordState.pseudo}`;

    showMessage("#forgot-message", "Code valide.", true);
    setTimeout(
      () => document.getElementById("forgot-new-password")?.focus(),
      100,
    );
  } catch (err) {
    console.error(err);
    showMessage("#forgot-message", "Erreur de communication.");
  }
}

async function handleForgotPasswordSubmit(e) {
  e.preventDefault();
  const pwd = document.getElementById("forgot-new-password")?.value || "";
  const confirm =
    document.getElementById("forgot-confirm-password")?.value || "";

  if (pwd.length < 6) {
    showMessage("#forgot-message", "Minimum 6 caracteres.");
    return;
  }
  if (pwd !== confirm) {
    showMessage("#forgot-message", "Les mots de passe ne correspondent pas.");
    return;
  }

  try {
    await waitForApi();
    const code = document.getElementById("forgot-code-input")?.value.trim();
    const result = await window.pywebview.api.confirm_password_reset(
      forgotPasswordState.userId,
      code,
      pwd,
    );
    if (!result || !result.success) {
      showMessage("#forgot-message", result?.message || "Erreur.");
      return;
    }

    showMessage(
      "#forgot-message",
      "Mot de passe reinitialise ! Redirection...",
      true,
    );
    setTimeout(() => {
      cancelForgotPassword();
      showMessage(
        "#login-message",
        "Vous pouvez maintenant vous connecter.",
        true,
      );
    }, 1500);
  } catch (err) {
    console.error(err);
    showMessage("#forgot-message", "Erreur de communication.");
  }
}
