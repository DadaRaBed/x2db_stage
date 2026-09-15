// ============================================
// ETAT GLOBAL DE L'APPLICATION
// ============================================
let appInitialized = false;
let apiReadyPromise = null;
let selectedExcelFilePath = "";
let selectedExcelSheetName = "";
let importInProgress = false;
let duplicateScanCancelled = false;
let currentLoggedInUser = null;
let currentDbPath = null;
let isDbOpen = false;

let forgotPasswordState = {
  step: 1,
  userId: null,
  pseudo: null,
  email: null,
};

let allDuplicates = [];
let currentDuplicatesAlgo = "general";
let selectedDuplicateTables = [];
let currentColumns = [];

let currentManipulateTable = "";
let currentManipulateData = [];
let currentManipulateFiltered = [];
let currentManipulateTotalCount = 0;
let manipulateShowResults = true;

let currentManipulatePage = 1;
const MANIPULATE_PER_PAGE = 1000;
let currentDuplicatePage = 1;
const DUPLICATE_PER_PAGE = 1000;

let createDbExcelPath = "";
let createDbExcelSheets = [];
let createDbSelectedSheet = "";

let navigationHistory = [];

const FILTER_ATTRIBUTES = [
  "pole_de_developpement",
  "podev",
  "district",
  "commune",
  "fkt",
  "localite",
  "filieres",
  "opr",
  "h_f",
  "filiation_menage",
  "categorisation_eaf",
  "variete",
  "observation",
];

window._activeValueFilters = {};
let appInfoCache = null;

// ============================================
// SELECTEURS (mis en cache)
// ============================================
const setupView = document.querySelector("#setup-view");
const loginView = document.querySelector("#login-view");
const forgotPasswordView = document.querySelector("#forgot-password-view");
const dashboardView = document.querySelector("#dashboard-view");
const excelImportView = document.querySelector("#excel-import-view");
const existingDbView = document.querySelector("#existing-db-view");
const duplicatesView = document.querySelector("#duplicates-view");
const manipulateView = document.querySelector("#manipulate-view");
const createDbView = document.querySelector("#create-db-view");

const setupForm = document.querySelector("#setup-form");
const loginForm = document.querySelector("#login-form");
const menuButton = document.querySelector("#menu-button");
const userMenu = document.querySelector("#user-menu");

const importExcelButton = document.querySelector("#import-excel-button");
const selectExcelFileButton = document.querySelector(
  "#select-excel-file-button",
);
const backToDashboardButton = document.querySelector(
  "#back-to-dashboard-button",
);
const selectedExcelFileElement = document.querySelector("#selected-excel-file");
const excelSheetContainer = document.querySelector("#excel-sheet-container");
const excelSheetSelect = document.querySelector("#excel-sheet-select");
const toggleShowSheetsCheckbox = document.querySelector("#toggle-show-sheets");
const excelPreviewContainer = document.querySelector(
  "#excel-preview-container",
);
const excelPreview = document.querySelector("#excel-preview");
const excelPreviewCount = document.querySelector("#excel-preview-count");
const excelImportActions = document.querySelector("#excel-import-actions");
const excelTableNameInput = document.querySelector("#excel-table-name");
const importButton = document.querySelector(
  "#import-excel-into-database-button",
);
