// ============================================
// THEME CLAIR / SOMBRE
// ============================================
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("app_theme", theme);
}
