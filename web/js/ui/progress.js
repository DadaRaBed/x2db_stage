// ============================================
// BARRES DE PROGRESSION
// ============================================
function showNotificationWithProgress(message, percentage, success = true) {
  const container = document.querySelector("#notification-container");
  if (!container) return;

  let notif = document.getElementById("active-process-notification");
  if (!notif) {
    notif = document.createElement("div");
    notif.id = "active-process-notification";
    container.appendChild(notif);
  }

  notif.className = success
    ? "notification notification-success"
    : "notification notification-error";
  notif.style.display = "block";
  notif.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 4px;">${escapeHtml(message)}</div>
    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; opacity: 0.9; margin-bottom: 4px;">
      <span>Progression : ${Math.round(percentage)}%</span>
    </div>
    <div style="width: 100%; background: rgba(255,255,255,0.3); height: 6px; border-radius: 3px; overflow: hidden;">
      <div style="width: ${Math.min(100, percentage)}%; background: #ffffff; height: 100%; transition: width 0.2s ease;"></div>
    </div>
  `;

  if (percentage >= 100) {
    setTimeout(() => {
      notif.style.display = "none";
      notif.remove();
    }, 2000);
  }
}

function showGlobalProgress(percentage, show = true) {
  const progressBar = document.getElementById("global-progress-bar");
  const progressFill = document.getElementById("global-progress-fill");
  if (!progressBar || !progressFill) return;

  if (show) {
    progressBar.style.display = "block";
    progressFill.style.width = `${percentage}%`;
    if (percentage >= 100) {
      setTimeout(() => {
        progressBar.style.display = "none";
        progressFill.style.width = "0%";
      }, 800);
    }
  } else {
    progressBar.style.display = "none";
    progressFill.style.width = "0%";
  }
}
