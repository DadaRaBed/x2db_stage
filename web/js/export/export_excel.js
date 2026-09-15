// ============================================
// Export - Export_Excel
// Fichier extrait automatiquement depuis app.js
// ============================================

// ---------- exportDuplicatesToExcel ----------
async function exportDuplicatesToExcel() {
  try {
    const filteredDuplicates = allDuplicates;
    if (filteredDuplicates.length === 0) {
      showNotification("Aucune donnee a exporter.", false);
      return;
    }
    const result = await window.pywebview.api.select_excel_export_file();
    if (!result || !result.success) return;

    const data = [];
    filteredDuplicates.forEach((dup) => {
      const rowData = {
        Table: dup.tableName,
        Type: "DOUBLON",
        ID: dup.row_index,
      };
      Object.assign(rowData, dup.data || {});
      data.push(rowData);
      const refData = {
        Table: dup.tableName,
        Type: "REFERENCE",
        ID: dup.reference_id,
      };
      Object.assign(refData, dup.reference_data || {});
      data.push(refData);
    });

    showNotificationWithProgress("Export des doublons vers Excel...", 30, true);
    const exportResult = await window.pywebview.api.generate_excel_from_data(
      result.file_path,
      data,
    );
    showNotificationWithProgress("Export termine.", 100, true);

    if (exportResult && exportResult.success) {
      showNotification(`Excel exporte : ${result.file_path}`, true);
      logUserAction(`Export des doublons vers Excel : ${result.file_path}`);
    } else {
      showNotification(
        exportResult?.message || "Erreur lors de l'export Excel.",
        false,
      );
    }
  } catch (error) {
    console.error("Erreur export Excel:", error);
    showNotification("Erreur lors de l'export Excel.", false);
  }
}

// ---------- exportResultsToExcel ----------
async function exportResultsToExcel() {
  const container = document.querySelector(
    "#manipulate-results-table-container",
  );
  if (!container) return;
  const table = container.querySelector("table");
  if (!table) return;
  try {
    const headers = [];
    const data = [];
    const thead = table.querySelector("thead");
    if (thead) {
      thead.querySelectorAll("th").forEach((th) => {
        const text = th.textContent.trim();
        if (text !== "Actions") headers.push(text);
      });
    }
    const tbody = table.querySelector("tbody");
    if (tbody) {
      tbody.querySelectorAll("tr").forEach((row) => {
        const rowData = {};
        const cells = row.querySelectorAll("td");
        let headerIdx = 0;
        cells.forEach((td, idx) => {
          if (idx === 0) return;
          if (headerIdx < headers.length) {
            rowData[headers[headerIdx]] = td.textContent.trim();
            headerIdx++;
          }
        });
        data.push(rowData);
      });
    }
    if (data.length === 0) {
      showNotification("Aucune donnee a exporter.", false);
      return;
    }
    const result = await window.pywebview.api.select_excel_export_file();
    if (!result || !result.success) return;
    showNotificationWithProgress("Export vers Excel en cours...", 30, true);
    const exportResult = await window.pywebview.api.generate_excel_from_data(
      result.file_path,
      data,
      headers,
    );
    showNotificationWithProgress("Export termine.", 100, true);
    if (exportResult && exportResult.success) {
      showNotification(`Excel exporte : ${result.file_path}`, true);
      logUserAction(`Export des resultats vers Excel`);
    } else {
      showNotification(
        exportResult?.message || "Erreur lors de l'export Excel.",
        false,
      );
    }
  } catch (error) {
    console.error("Erreur export Excel:", error);
    showNotification("Erreur lors de l'export Excel.", false);
  }
}

