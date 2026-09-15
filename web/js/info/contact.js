// ============================================
// Info - Contact
// Fichier extrait automatiquement depuis app.js
// ============================================

// ---------- showContactModal ----------
function showContactModal() {
  const overlay = document.createElement("div");
  overlay.className = "edit-modal-overlay";
  overlay.style.zIndex = "99997";

  overlay.innerHTML = `
    <div style="background: #ffffff; border-radius: 12px; padding: 0; max-width: 560px; width: 95%; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); overflow: hidden;">
      <div style="background: linear-gradient(135deg, #1a4d3a, #3d8b6a); color: white; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between;">
        <h3 style="margin: 0; font-size: 1.2rem; display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-envelope"></i> Nous contacter
        </h3>
        <button type="button" id="close-contact-modal" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 1.5rem; cursor: pointer; width: 32px; height: 32px; border-radius: 50%;">&times;</button>
      </div>
      <div style="padding: 24px;">
        <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 1.5rem;">
          Envoyez un email au developpeur (DadaRaBed). Nous vous repondrons dans les plus brefs delais.
        </p>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #334155; font-size: 0.9rem;">Votre email (optionnel) :</label>
          <input type="email" id="contact-email" placeholder="votre.email@example.com" style="width: 100%; padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; box-sizing: border-box;" />
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #334155; font-size: 0.9rem;">Sujet :</label>
          <input type="text" id="contact-subject" placeholder="Sujet de votre message" value="[xl2db] Demande de contact" style="width: 100%; padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; box-sizing: border-box;" />
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label style="display: block; font-weight: 600; margin-bottom: 6px; color: #334155; font-size: 0.9rem;">Message :</label>
          <textarea id="contact-message" rows="6" placeholder="Decrivez votre demande, question ou suggestion..." style="width: 100%; padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; box-sizing: border-box; font-family: inherit; resize: vertical;"></textarea>
        </div>
        <div id="contact-message-status" style="margin-bottom: 1rem;"></div>
        <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 1.5rem;">
          <button type="button" id="btn-cancel-contact" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #6c757d; color: white;">Annuler</button>
          <button type="button" id="btn-send-contact" style="padding: 0.6rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; background: #1a4d3a; color: white;">
            <i class="fas fa-paper-plane"></i> Envoyer
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector("#close-contact-modal").onclick = close;
  overlay.querySelector("#btn-cancel-contact").onclick = close;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  overlay.querySelector("#btn-send-contact").onclick = async () => {
    const email = overlay.querySelector("#contact-email").value.trim();
    const subject = overlay.querySelector("#contact-subject").value.trim();
    const message = overlay.querySelector("#contact-message").value.trim();
    const statusEl = overlay.querySelector("#contact-message-status");

    if (!message) {
      statusEl.innerHTML =
        '<p style="color: #dc3545; font-size: 0.9rem;"><i class="fas fa-exclamation-circle"></i> Veuillez ecrire un message.</p>';
      return;
    }
    statusEl.innerHTML =
      '<p style="color: #1a4d3a; font-size: 0.9rem;"><i class="fas fa-spinner fa-spin"></i> Envoi en cours...</p>';
    try {
      await waitForApi();
      const result = await window.pywebview.api.send_contact_email(
        subject,
        message,
        email,
      );
      if (result && result.success) {
        statusEl.innerHTML =
          '<p style="color: #27ae60; font-size: 0.9rem;"><i class="fas fa-check-circle"></i> ' +
          escapeHtml(result.message) +
          "</p>";
        logUserAction("Envoi d'un message de contact");
        setTimeout(() => {
          close();
          showNotification("Merci ! Votre message a ete transmis.", true);
        }, 1500);
      } else {
        statusEl.innerHTML =
          '<p style="color: #dc3545; font-size: 0.9rem;"><i class="fas fa-times-circle"></i> ' +
          escapeHtml(result?.message || "Erreur lors de l'envoi.") +
          "</p>";
      }
    } catch (err) {
      console.error(err);
      statusEl.innerHTML =
        '<p style="color: #dc3545; font-size: 0.9rem;"><i class="fas fa-times-circle"></i> Erreur : ' +
        escapeHtml(err.message) +
        "</p>";
    }
  };
}

