// ============================================
// IMPORT EXCEL
// ============================================
function updateImportButtonState() {
  const tableName = excelTableNameInput?.value.trim() || "";
  const valid = Boolean(
    selectedExcelFilePath && tableName && !importInProgress,
  );
  if (importButton) importButton.disabled = !valid;
}

function resetExcelImportView() {
  selectedExcelFilePath = "";
  selectedExcelSheetName = "";
  importInProgress = false;
  if (selectedExcelFileElement)
    selectedExcelFileElement.textContent = "Aucun fichier selectionne";
  if (excelSheetContainer) excelSheetContainer.classList.add("hidden");
  if (excelSheetSelect) {
    excelSheetSelect.innerHTML =
      '<option value="">Selectionnez une feuille</option>';
    excelSheetSelect.disabled = true;
  }
  excelPreviewContainer?.classList.add("hidden");
  if (excelPreview) excelPreview.replaceChildren();
  if (excelPreviewCount) excelPreviewCount.textContent = "";
  excelImportActions?.classList.add("hidden");
  if (excelTableNameInput) excelTableNameInput.value = "";
  showMessage("#excel-import-message", "");
  updateImportButtonState();
}

async function selectExcelFile() {
  try {
    await waitForApi();
    const result = await window.pywebview.api.select_excel_file();
    if (!result?.success) {
      if (result?.message !== "Aucun fichier selectionne.") {
        showMessage("#excel-import-message", result?.message || "Impossible.");
      }
      return;
    }
    selectedExcelFilePath = result.file_path;
    selectedExcelSheetName = "";
    selectedExcelFileElement.textContent = selectedExcelFilePath;

    const fileName = selectedExcelFilePath
      .split("/")
      .pop()
      .split("\\")
      .pop()
      .split(".")[0];
    if (excelTableNameInput) {
      excelTableNameInput.value = fileName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_");
    }
    await loadExcelSheets();
    updateImportButtonState();
  } catch (error) {
    console.error(error);
    showMessage("#excel-import-message", "Impossible.");
  }
}

async function loadExcelSheets() {
  const result = await window.pywebview.api.get_excel_sheets(
    selectedExcelFilePath,
  );
  if (!result?.success || !Array.isArray(result.sheets)) {
    showMessage("#excel-import-message", result?.message || "Impossible.");
    return;
  }
  excelSheetSelect.innerHTML =
    '<option value="">Selectionnez une feuille (optionnel)</option>';
  result.sheets.forEach((sheet) => {
    const option = document.createElement("option");
    option.value = sheet;
    option.textContent = sheet;
    excelSheetSelect.appendChild(option);
  });
  excelSheetContainer.classList.remove("hidden");
  excelSheetSelect.disabled = false;
  if (result.sheets.length === 1) {
    excelSheetSelect.value = result.sheets[0];
    await loadExcelPreview(result.sheets[0]);
  }
  updateImportButtonState();
}

async function loadExcelPreview(sheetName) {
  if (toggleShowSheetsCheckbox && !toggleShowSheetsCheckbox.checked) {
    excelPreviewContainer?.classList.add("hidden");
    return;
  }
  if (!selectedExcelFilePath || !sheetName) return;
  try {
    const result = await window.pywebview.api.preview_excel_sheet(
      selectedExcelFilePath,
      sheetName,
    );
    if (!result?.success) {
      showMessage("#excel-import-message", result?.message || "Impossible.");
      return;
    }
    selectedExcelSheetName = sheetName;
    let headers = result.headers;
    if (!headers && result.preview && result.preview.length > 0)
      headers = result.preview[0];
    renderExcelPreview(headers);
    updateImportButtonState();
  } catch (error) {
    console.error(error);
    showMessage("#excel-import-message", "Impossible.");
  }
}

function renderExcelPreview(headers) {
  if (toggleShowSheetsCheckbox && !toggleShowSheetsCheckbox.checked) {
    excelPreviewContainer.classList.add("hidden");
    return;
  }
  excelPreview.replaceChildren();
  excelPreviewContainer.classList.remove("hidden");
  let headersArray = headers;
  if (headersArray && !Array.isArray(headersArray))
    headersArray = Object.values(headersArray);
  if (!Array.isArray(headersArray) || headersArray.length === 0) {
    excelPreviewCount.textContent = "Aucune colonne detectee";
    excelImportActions.classList.add("hidden");
    updateImportButtonState();
    return;
  }
  const listContainer = document.createElement("div");
  listContainer.className = "columns-list-container";
  listContainer.style.cssText =
    "display:flex;flex-wrap:wrap;gap:8px;padding:10px 0;";

  headersArray.forEach((header) => {
    const badge = document.createElement("span");
    badge.className = "column-badge";
    badge.textContent = String(header ?? "Colonne sans nom");
    badge.style.cssText =
      "background:var(--bg-secondary,#e0e7ff);color:var(--text-color,#3730a3);padding:6px 12px;border-radius:6px;font-size:0.9rem;font-weight:600;";
    listContainer.appendChild(badge);
  });
  excelPreview.appendChild(listContainer);
  excelPreviewCount.textContent = `${headersArray.length} colonne(s) identifiee(s)`;
  excelImportActions.classList.remove("hidden");
  updateImportButtonState();
}

async function importExcelIntoDatabase() {
  if (!selectedExcelFilePath) {
    showMessage("#excel-import-message", "Veuillez selectionner un fichier.");
    return;
  }
  const tableName = excelTableNameInput.value.trim();
  if (!tableName) {
    showMessage("#excel-import-message", "Veuillez entrer un nom de table.");
    excelTableNameInput.focus();
    return;
  }

  importInProgress = true;
  updateImportButtonState();
  if (selectExcelFileButton) selectExcelFileButton.disabled = true;
  if (excelSheetSelect) excelSheetSelect.disabled = true;
  if (excelTableNameInput) excelTableNameInput.disabled = true;

  let progress = 5;
  showNotificationWithProgress("Import en cours...", progress, true);
  showGlobalProgress(progress, true);

  const progressInterval = setInterval(() => {
    progress = Math.min(95, progress + (95 - progress) * 0.1);
    showNotificationWithProgress("Import en cours...", progress, true);
    showGlobalProgress(progress, true);
  }, 500);

  try {
    const result = await window.pywebview.api.import_excel_to_database(
      selectedExcelFilePath,
      selectedExcelSheetName || null,
      tableName,
    );
    clearInterval(progressInterval);
    showNotificationWithProgress("Termine.", 100, true);
    showGlobalProgress(100, true);

    if (!result?.success) {
      showMessage("#excel-import-message", result?.message || "Echec.");
      return;
    }
    showMessage(
      "#excel-import-message",
      result.message || "Fichier converti.",
      true,
    );
    excelImportActions?.classList.add("hidden");

    setTimeout(() => {
      goToExistingDb();
      if (result.db_path) {
        const dbFileSelect = document.getElementById("db-file-select");
        if (dbFileSelect) {
          dbFileSelect.value = result.db_path;
          dbFileSelect.dispatchEvent(new Event("change"));
        }
      }
    }, 900);
  } catch (error) {
    clearInterval(progressInterval);
    console.error(error);
    showMessage("#excel-import-message", "Impossible.");
  } finally {
    importInProgress = false;
    if (selectExcelFileButton) selectExcelFileButton.disabled = false;
    if (excelSheetSelect) excelSheetSelect.disabled = false;
    if (excelTableNameInput) excelTableNameInput.disabled = false;
    updateImportButtonState();
  }
}
