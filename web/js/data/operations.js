// ============================================
// Data - Operations
// Fichier extrait automatiquement depuis app.js
// ============================================

// ---------- initSqlOperations ----------
function initSqlOperations() {
  document.querySelectorAll(".op-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".op-btn").forEach((b) => {
        b.style.background = "";
        b.style.color = "";
      });
      e.target.style.background = "var(--primary-color, #1a4d3a)";
      e.target.style.color = "#ffffff";
      document.getElementById("selected-operation-type").value =
        e.target.getAttribute("data-op");
    });
  });
}

