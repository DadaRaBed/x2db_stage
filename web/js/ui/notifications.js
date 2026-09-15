// ============================================
// NOTIFICATIONS
// ============================================
function showMessage(selector, message, success = false) {
  const element = document.querySelector(selector);
  if (!element) return;
  element.textContent = message;
  element.classList.remove("success", "error");
  if (message) element.classList.add(success ? "success" : "error");
}

function showNotification(message, success = true) {
  const container = document.querySelector("#notification-container");
  if (!container) return;
  const notification = document.createElement("div");
  notification.className = success
    ? "notification notification-success"
    : "notification notification-error";
  notification.textContent = message;
  container.appendChild(notification);
  setTimeout(() => notification.remove(), 4000);
}
