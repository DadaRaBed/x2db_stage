// ============================================
// Export - Export_Pdf
// Fichier extrait automatiquement depuis app.js
// ============================================

// ---------- exportDuplicatesToPDF ----------
async function exportDuplicatesToPDF() {
  try {
    const filteredDuplicates = allDuplicates;
    if (filteredDuplicates.length === 0) {
      showNotification("Aucune donnee a exporter.", false);
      return;
    }
    const result = await window.pywebview.api.select_pdf_file();
    if (!result || !result.success) return;

    const allColumns =
      currentColumns.length > 0
        ? currentColumns
        : Object.keys(filteredDuplicates[0]?.data || {});

    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Rapport des doublons</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'DejaVu Sans', Arial, sans-serif; padding: 20px; color: #1a1a2e; background: #ffffff; font-size: 8px; }
          .header { text-align: center; padding-bottom: 15px; border-bottom: 2px solid #1a4d3a; margin-bottom: 15px; }
          .header h1 { color: #1a4d3a; font-size: 18px; }
          .summary { background: #e8f3ef; padding: 8px 14px; border-radius: 6px; margin-bottom: 12px; border-left: 4px solid #1a4d3a; font-weight: 600; font-size: 12px; color: #1a4d3a; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 6.5px; }
          th { background: #1a4d3a; color: white; padding: 4px 5px; text-align: left; border: 1px solid #1a4d3a; }
          td { padding: 3px 5px; border: 1px solid #e2e8f0; word-wrap: break-word; max-width: 120px; }
          .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 7px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Rapport des doublons</h1>
          <div style="color: #666; font-size: 10px; margin-top: 3px;">xl2db - Expert Edition</div>
        </div>
        <div class="summary">${filteredDuplicates.length} doublon(s) - ${allColumns.length} attributs</div>
        <table>
          <thead>
            <tr>
              <th>Table</th><th>Type</th><th>ID</th>
              ${allColumns.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
    `;

    filteredDuplicates.forEach((dup) => {
      htmlContent += `<tr><td>${escapeHtml(dup.tableName)}</td><td>DOUBLON</td><td>#${dup.row_index}</td>`;
      allColumns.forEach((col) => {
        const val = dup.data?.[col];
        htmlContent += `<td>${escapeHtml(val === null || val === undefined ? "" : String(val))}</td>`;
      });
      htmlContent += `</tr>`;

      htmlContent += `<tr style="background: rgba(39, 174, 96, 0.05);"><td>${escapeHtml(dup.tableName)}</td><td>REFERENCE</td><td>#${dup.reference_id}</td>`;
      allColumns.forEach((col) => {
        const val = dup.reference_data?.[col];
        htmlContent += `<td>${escapeHtml(val === null || val === undefined ? "" : String(val))}</td>`;
      });
      htmlContent += `</tr>`;
    });

    htmlContent += `</tbody></table></body></html>`;

    showNotificationWithProgress("Generation du PDF...", 50, true);
    const pdfResult = await window.pywebview.api.generate_pdf_from_html(
      result.file_path,
      htmlContent,
    );
    showNotificationWithProgress("PDF genere.", 100, true);

    if (pdfResult && pdfResult.success) {
      showNotification(`PDF exporte : ${result.file_path}`, true);
      logUserAction(`Export des doublons vers PDF : ${result.file_path}`);
    } else {
      showNotification(
        pdfResult?.message || "Erreur lors de la generation du PDF.",
        false,
      );
    }
  } catch (error) {
    console.error("Erreur export PDF:", error);
    showNotification("Erreur lors de l'export PDF.", false);
  }
}

// ---------- exportResultsToPDF ----------
async function exportResultsToPDF() {
  const container = document.querySelector(
    "#manipulate-results-table-container",
  );
  if (!container) return;
  const table = container.querySelector("table");
  if (!table) return;
  try {
    const result = await window.pywebview.api.select_pdf_file();
    if (!result || !result.success) return;
    const htmlContent = `
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8"><title>Export des resultats</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        h1 { color: #1a4d3a; border-bottom: 3px solid #1a4d3a; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 11px; }
        th { background: #1a4d3a; color: white; padding: 10px; text-align: left; }
        td { padding: 8px 10px; border-bottom: 1px solid #ddd; }
        tr:nth-child(even) { background: #f8fafc; }
      </style></head><body>
        <h1>Export des resultats</h1>
        <p><strong>Date :</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Nombre :</strong> ${table.querySelectorAll("tbody tr").length}</p>
        ${table.outerHTML}
      </body></html>
    `;
    showNotificationWithProgress("Generation du PDF...", 50, true);
    const pdfResult = await window.pywebview.api.generate_pdf_from_html(
      result.file_path,
      htmlContent,
    );
    showNotificationWithProgress("PDF genere.", 100, true);
    if (pdfResult && pdfResult.success) {
      showNotification(`PDF exporte : ${result.file_path}`, true);
      logUserAction(`Export des resultats vers PDF`);
    } else {
      showNotification(
        pdfResult?.message || "Erreur lors de la generation du PDF.",
        false,
      );
    }
  } catch (error) {
    console.error("Erreur export PDF:", error);
    showNotification("Erreur lors de l'export PDF.", false);
  }
}

