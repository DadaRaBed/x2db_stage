// ============================================
// Data - Statistics
// Fichier extrait automatiquement depuis app.js
// ============================================

// ---------- generateStatistics ----------
async function generateStatistics() {
  const tableName = currentManipulateTable;
  if (!tableName) {
    showNotification("Veuillez selectionner une table.", false);
    return;
  }
  const container = document.querySelector("#statistics-container");
  const section = document.querySelector("#statistics-section");
  section.classList.remove("hidden");
  container.innerHTML = "<p>Calcul des statistiques...</p>";
  try {
    const activeDbPath = sessionStorage.getItem("current_db_path");
    const stats = await window.pywebview.api.get_table_statistics(
      tableName,
      activeDbPath,
    );
    if (!stats || !stats.success) {
      container.innerHTML = `<p style="color: red;">${stats?.message || "Erreur."}</p>`;
      return;
    }
    let html =
      '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">';
    for (const [col, data] of Object.entries(stats.stats)) {
      if (data.type === "numerique") {
        html += `
          <div class="stat-card">
            <h4>${escapeHtml(col)}</h4>
            <div class="stat-grid">
              <span class="label">Effectif :</span><span class="value">${data.count}</span>
              <span class="label">Moyenne :</span><span class="value">${data.average !== null ? data.average : "-"}</span>
              <span class="label">Minimum :</span><span class="value">${data.min !== null ? data.min : "-"}</span>
              <span class="label">Maximum :</span><span class="value">${data.max !== null ? data.max : "-"}</span>
              <span class="label">Somme :</span><span class="value">${data.sum !== null ? data.sum : "-"}</span>
            </div>
          </div>`;
      } else {
        html += `
          <div class="stat-card" style="border-left-color: #3d8b6a;">
            <h4>${escapeHtml(col)}</h4>
            <div style="font-size: 0.9rem;">
              <span class="label">Valeurs distinctes :</span> <strong>${data.distinct_count}</strong>
              <span class="label" style="margin-left: 1rem;">Total :</span> <strong>${data.total_count}</strong>
            </div>
          </div>`;
      }
    }
    html += "</div>";
    container.innerHTML = html;
    showNotification("Statistiques generees.", true);
  } catch (error) {
    console.error("Erreur statistiques:", error);
    container.innerHTML = '<p style="color: red;">Erreur lors du calcul.</p>';
  }
}

// ---------- generateChart ----------
async function generateChart(chartType) {
  const tableName = currentManipulateTable;
  if (!tableName) {
    showNotification("Veuillez selectionner une table.", false);
    return;
  }
  const section = document.querySelector("#charts-section");
  const container = document.querySelector("#charts-container");
  section.classList.remove("hidden");

  let column = "";
  let title = "";
  switch (chartType) {
    case "nom":
      column = "nom";
      title = "Distribution des Noms";
      break;
    case "cin":
      column = "cin";
      title = "Distribution des CIN";
      break;
    case "region":
      column = "region";
      title = "Distribution par Region";
      break;
    default:
      container.innerHTML = "";
      await generateChart("nom");
      await generateChart("cin");
      await generateChart("region");
      return;
  }
  try {
    const activeDbPath = sessionStorage.getItem("current_db_path");
    const struct =
      await window.pywebview.api.get_database_structure_matrix(activeDbPath);
    const columns = struct.structure[tableName] || [];
    let foundCol = null;
    for (const col of columns) {
      const colLower = col.toLowerCase();
      if (colLower.includes(column) || colLower === column) {
        foundCol = col;
        break;
      }
    }
    if (!foundCol) {
      showNotification(`Colonne "${column}" non trouvee.`, false);
      return;
    }
    const distribution = await window.pywebview.api.get_table_distribution(
      tableName,
      foundCol,
      activeDbPath,
    );
    if (!distribution || !distribution.success) {
      showNotification(distribution?.message || "Erreur.", false);
      return;
    }
    const data = distribution.distribution;
    const maxCount =
      data.length > 0 ? Math.max(...data.map((d) => d.count)) : 1;
    let chartHtml = `<div class="chart-container"><h4>${title}</h4><div class="chart-bar-container">`;
    data.slice(0, 30).forEach((item) => {
      const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
      chartHtml += `
        <div class="chart-bar-row">
          <span class="chart-bar-label">${escapeHtml(String(item.value).substring(0, 30))}</span>
          <div class="chart-bar-track"><div class="chart-bar-fill" style="width: ${percentage}%"></div></div>
          <span class="chart-bar-count">${item.count}</span>
        </div>`;
    });
    chartHtml += `</div><div style="margin-top: 8px; font-size: 0.75rem; color: var(--text-muted, #64748b);">${data.length > 30 ? `30 premieres sur ${data.length}` : `${data.length} valeur(s)`}</div></div>`;
    if (chartType === "all") container.innerHTML += chartHtml;
    else container.innerHTML = chartHtml;
    showNotification(`Graphique "${title}" genere.`, true);
  } catch (error) {
    console.error("Erreur graphique:", error);
    showNotification("Erreur lors de la generation.", false);
  }
}

// ---------- performResultOperation ----------
function performResultOperation(operation) {
  const container = document.querySelector(
    "#manipulate-results-table-container",
  );
  const output = document.querySelector("#result-operations-output");
  const section = document.querySelector("#result-operations-section");
  if (!container) return;
  const table = container.querySelector("table");
  if (!table) {
    showNotification("Aucune donnee a traiter.", false);
    return;
  }
  section.classList.remove("hidden");
  try {
    const numericData = [];
    const headers = [];
    const thead = table.querySelector("thead");
    if (thead) {
      thead.querySelectorAll("th").forEach((th) => {
        const text = th.textContent.trim();
        if (text !== "Actions") headers.push(text);
      });
    }
    const tbody = table.querySelector("tbody");
    if (!tbody) return;
    tbody.querySelectorAll("tr").forEach((row) => {
      const cells = row.querySelectorAll("td");
      let headerIdx = 0;
      cells.forEach((td, idx) => {
        if (idx === 0) return;
        if (headerIdx < headers.length) {
          const val = parseFloat(td.textContent.trim().replace(/,/g, "."));
          if (!isNaN(val)) {
            if (!numericData[headerIdx]) numericData[headerIdx] = [];
            numericData[headerIdx].push(val);
          }
          headerIdx++;
        }
      });
    });
    if (
      numericData.length === 0 ||
      numericData.every((arr) => !arr || arr.length === 0)
    ) {
      output.innerHTML =
        '<span style="color: orange;">Aucune donnee numerique trouvee.</span>';
      return;
    }
    let resultHtml =
      '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">';
    numericData.forEach((data, idx) => {
      if (!data || data.length === 0) return;
      const colName = headers[idx] || `Colonne ${idx + 1}`;
      let operationResult = "";
      let operationLabel = "";
      switch (operation) {
        case "sum":
          operationResult = data.reduce((a, b) => a + b, 0).toFixed(2);
          operationLabel = "Somme";
          break;
        case "avg":
          operationResult = (
            data.reduce((a, b) => a + b, 0) / data.length
          ).toFixed(2);
          operationLabel = "Moyenne";
          break;
        case "min":
          operationResult = Math.min(...data).toFixed(2);
          operationLabel = "Minimum";
          break;
        case "max":
          operationResult = Math.max(...data).toFixed(2);
          operationLabel = "Maximum";
          break;
        case "count":
          operationResult = data.length;
          operationLabel = "Effectif";
          break;
        case "countif":
          operationResult = data.filter((v) => v > 0).length;
          operationLabel = "Nb > 0";
          break;
        case "sort":
          operationResult = [...data].sort((a, b) => a - b).join(", ");
          operationLabel = "Tri croissant";
          break;
      }
      resultHtml += `
        <div style="background: var(--bg-secondary, #f8fafc); padding: 0.75rem; border-radius: 6px; border-left: 3px solid #1a4d3a;">
          <div style="font-size: 0.75rem; color: var(--text-muted, #64748b);">${escapeHtml(colName)}</div>
          <div style="font-size: 1rem; font-weight: 600;">${operationLabel} : ${operationResult} <span style="font-size: 0.75rem; font-weight: 400; color: var(--text-muted, #64748b);">(n=${data.length})</span></div>
        </div>`;
    });
    resultHtml += "</div>";
    output.innerHTML = resultHtml;
    showNotification(`Operation "${operation}" effectuee.`, true);
  } catch (error) {
    console.error("Erreur operation:", error);
    output.innerHTML = `<span style="color: red;">Erreur : ${error.message}</span>`;
  }
}

