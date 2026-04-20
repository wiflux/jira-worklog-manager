const pageTitle = document.getElementById("pageTitle");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const reportStartDateInput = document.getElementById("reportStartDateInput");
const reportEndDateInput = document.getElementById("reportEndDateInput");
const reportSearchBtn = document.getElementById("reportSearchBtn");
const openCustomWorklogBtn = document.getElementById("openCustomWorklogBtn");
const presetSelect = document.getElementById("presetSelect");
const customDateRangeRow = document.getElementById("customDateRangeRow");
const reportStatusMsg = document.getElementById("reportStatusMsg");
const errorMsg = document.getElementById("errorMsg");
const reportTbody = document.getElementById("reportTbody");
const reportSummaryMsg = document.getElementById("reportSummaryMsg");
const customIssueKeyInput = document.getElementById("customIssueKeyInput");
const customTimeSpentInput = document.getElementById("customTimeSpentInput");
const customStartedInput = document.getElementById("customStartedInput");
const customStartedTimeInput = document.getElementById("customStartedTimeInput");
const customDescriptionInput = document.getElementById("customDescriptionInput");
const customWorklogBtn = document.getElementById("customWorklogBtn");
const customWorklogStatusMsg = document.getElementById("customWorklogStatusMsg");
const customWorklogResultBox = document.getElementById("customWorklogResultBox");
const issueSummaryValue = document.getElementById("issueSummaryValue");
const issuePriorityValue = document.getElementById("issuePriorityValue");
const issueAssigneeValue = document.getElementById("issueAssigneeValue");
const issueEstimateValue = document.getElementById("issueEstimateValue");
const customWorklogModal = document.getElementById("customWorklogModal");
const customWorklogModalCloseBtn = document.getElementById("customWorklogModalCloseBtn");
const deleteWorklogConfirmModal = document.getElementById("deleteWorklogConfirmModal");
const deleteWorklogConfirmText = document.getElementById("deleteWorklogConfirmText");
const confirmDeleteWorklogBtn = document.getElementById("confirmDeleteWorklogBtn");
const cancelDeleteWorklogBtn = document.getElementById("cancelDeleteWorklogBtn");
const THEME_STORAGE_KEY = "jira-worklog-theme";
let customWorklogModalInstance = null;
let deleteWorklogModalInstance = null;
let hasLoadedReportOnce = false;
let pendingDeleteWorklog = null;

// Theme module: default to dark on first load, persist user's explicit choice.
function applyTheme(theme) {
  const isLight = theme === "light";
  document.body.classList.toggle("light-theme", isLight);
  document.documentElement.classList.toggle("dark", !isLight);
  themeToggleBtn.textContent = isLight ? "☀️" : "🌙";
  themeToggleBtn.setAttribute("aria-label", `Switch to ${isLight ? "dark" : "light"} mode`);
}

function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  applyTheme(savedTheme === "light" ? "light" : "dark");
}

function toggleTheme() {
  const isLight = document.body.classList.contains("light-theme");
  const nextTheme = isLight ? "dark" : "light";
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  applyTheme(nextTheme);
}

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.classList.remove("hidden");
}

function clearError() {
  errorMsg.textContent = "";
  errorMsg.classList.add("hidden");
}

function setReportLoading(isLoading) {
  reportSearchBtn.disabled = isLoading;
  reportSearchBtn.innerHTML = isLoading
    ? `<svg aria-hidden="true" role="status" class="inline w-4 h-4 me-2 text-white animate-spin" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
         <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor"/>
         <path d="M93.9676 39.0409C96.393 38.4037 97.8624 35.9113 97.0079 33.5539C95.2932 28.8227 92.8711 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446844 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="#1E3A8A"/>
       </svg>Fetching...`
    : "Search";
  if (isLoading) {
    if (!hasLoadedReportOnce) {
      renderReportSkeleton();
    }
    reportStatusMsg.innerHTML = `Fetching Jira worklogs...
      <svg aria-hidden="true" role="status" class="inline w-5 h-5 ms-1 text-gray-200 dark:text-gray-600 fill-blue-600 animate-spin" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor"/>
        <path d="M93.9676 39.0409C96.393 38.4037 97.8624 35.9113 97.0079 33.5539C95.2932 28.8227 92.8711 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446844 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill"/>
      </svg>`;
  }
}

function setCustomWorklogLoading(isLoading) {
  customWorklogBtn.disabled = isLoading;
  customWorklogBtn.innerHTML = isLoading
    ? `<svg aria-hidden="true" role="status" class="inline w-4 h-4 me-2 text-white animate-spin" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
         <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor"/>
         <path d="M93.9676 39.0409C96.393 38.4037 97.8624 35.9113 97.0079 33.5539C95.2932 28.8227 92.8711 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446844 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="#065F46"/>
       </svg>Saving...`
    : "Add Worklog";
  if (isLoading) {
    customWorklogStatusMsg.textContent = "Creating Jira worklog...";
  }
}

function setDeleteWorklogLoading(button, isLoading) {
  if (!button) return;
  button.disabled = isLoading;
  button.classList.toggle("opacity-60", isLoading);
  button.classList.toggle("cursor-not-allowed", isLoading);
}

function getCustomWorklogModalInstance() {
  if (!customWorklogModal) return null;
  if (!customWorklogModalInstance && typeof Modal !== "undefined") {
    customWorklogModalInstance = new Modal(customWorklogModal);
  }
  return customWorklogModalInstance;
}

function getDeleteWorklogModalInstance() {
  if (!deleteWorklogConfirmModal) return null;
  if (!deleteWorklogModalInstance && typeof Modal !== "undefined") {
    deleteWorklogModalInstance = new Modal(deleteWorklogConfirmModal);
  }
  return deleteWorklogModalInstance;
}

function openDeleteWorklogConfirmModal(issueKey, worklogId, button) {
  pendingDeleteWorklog = {
    issueKey: String(issueKey || "").trim().toUpperCase(),
    worklogId: String(worklogId || "").trim(),
    button
  };
  if (deleteWorklogConfirmText) {
    deleteWorklogConfirmText.textContent =
      `Are you sure you want to delete worklog ${pendingDeleteWorklog.worklogId} from ${pendingDeleteWorklog.issueKey}?`;
  }
  const modalInstance = getDeleteWorklogModalInstance();
  if (modalInstance) modalInstance.show();
}

function openCustomWorklogModal(issueKey = "") {
  clearError();
  customWorklogResultBox.classList.add("hidden");
  customWorklogStatusMsg.textContent = "Enter ticket and time, then click Add Worklog.";
  const normalizedIssueKey = String(issueKey || "").trim().toUpperCase();
  customIssueKeyInput.value = normalizedIssueKey;
  if (normalizedIssueKey) {
    lookupTicketDetails();
  } else {
    clearIssueDetails();
  }
  const modalInstance = getCustomWorklogModalInstance();
  if (modalInstance) modalInstance.show();
}

async function loadMeta() {
  try {
    const resp = await fetch("/meta");
    if (!resp.ok) return;
    const payload = await resp.json();
    pageTitle.textContent = `WorkLog Report - ${payload.report_email_label || "unknown"}`;
  } catch {
    // Keep default title if metadata call fails.
  }
}

const toIsoDate = (dt) => {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

function getPresetDates(preset) {
  const today = new Date();
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (preset === "today") {
    return { start: localToday, end: localToday };
  }
  if (preset === "yesterday") {
    const yesterday = new Date(localToday);
    yesterday.setDate(localToday.getDate() - 1);
    return { start: yesterday, end: yesterday };
  }
  if (preset === "this-week") {
    const dayOfWeek = localToday.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(localToday);
    weekStart.setDate(localToday.getDate() - diffToMonday);
    return { start: weekStart, end: localToday };
  }
  if (preset === "last-week") {
    const dayOfWeek = localToday.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisMonday = new Date(localToday);
    thisMonday.setDate(localToday.getDate() - diffToMonday);
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday);
    lastSunday.setDate(thisMonday.getDate() - 1);
    return { start: lastMonday, end: lastSunday };
  }
  return null;
}

function setActivePreset(preset) {
  presetSelect.value = preset;
  const isCustom = preset === "custom";
  customDateRangeRow.classList.toggle("hidden", !isCustom);
  if (isCustom) ensureDateRangePicker();
}

let rangeStartInput = null;
let rangeEndInput = null;

const MONTH_INDEX = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11
};

function parseDisplayDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const parts = raw.split("-");
  if (parts.length !== 3) return null;
  const day = Number(parts[0]);
  const monthPart = parts[1].trim();
  const year = Number(parts[2]);
  if (!Number.isInteger(day) || !Number.isInteger(year)) return null;

  let month = MONTH_INDEX[monthPart.toLowerCase()];
  if (month === undefined) {
    const numericMonth = Number(monthPart);
    if (!Number.isInteger(numericMonth) || numericMonth < 1 || numericMonth > 12) {
      return null;
    }
    month = numericMonth - 1;
  }

  const dt = new Date(year, month, day);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return dt;
}

function formatTimeToAmPm(timeValue) {
  const raw = String(timeValue || "").trim();
  if (!raw) return null;
  const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = match[2];
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
}

function getCustomStartedValue() {
  const dateValue = customStartedInput.value.trim();
  const timeValue = customStartedTimeInput ? customStartedTimeInput.value.trim() : "";
  if (!dateValue && !timeValue) return { value: "", error: null };
  if (!dateValue && timeValue) {
    return { value: "", error: "Select a started date before choosing time." };
  }
  if (!timeValue) return { value: dateValue, error: null };
  const amPm = formatTimeToAmPm(timeValue);
  if (!amPm) {
    return { value: "", error: "Started time is invalid." };
  }
  return { value: `${dateValue} ${amPm}`, error: null };
}

function formatCurrentDisplayDate(dt) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(dt.getDate()).padStart(2, "0");
  const month = months[dt.getMonth()];
  const year = dt.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatCurrentTime24h(dt) {
  const hour = String(dt.getHours()).padStart(2, "0");
  const minute = String(dt.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function setDefaultCustomStartedDateTime() {
  const now = new Date();
  if (customStartedInput && !customStartedInput.value.trim()) {
    customStartedInput.value = formatCurrentDisplayDate(now);
  }
  if (customStartedTimeInput && !customStartedTimeInput.value.trim()) {
    customStartedTimeInput.value = formatCurrentTime24h(now);
  }
}

function syncCustomRangeToHiddenInputs() {
  if (!rangeStartInput || !rangeEndInput) return;
  const parsedStart = parseDisplayDate(rangeStartInput.value);
  const parsedEnd = parseDisplayDate(rangeEndInput.value);
  reportStartDateInput.value = parsedStart ? toIsoDate(parsedStart) : "";
  reportEndDateInput.value = parsedEnd ? toIsoDate(parsedEnd) : "";
}

function ensureDateRangePicker() {
  const rangeElement = document.getElementById("date-range-picker");
  if (!rangeElement || rangeStartInput) return;
  rangeStartInput = rangeElement.querySelector('input[name="start"]');
  rangeEndInput = rangeElement.querySelector('input[name="end"]');
  if (!rangeStartInput || !rangeEndInput) return;

  const onRangeChange = () => syncCustomRangeToHiddenInputs();
  rangeStartInput.addEventListener("input", onRangeChange);
  rangeStartInput.addEventListener("change", onRangeChange);
  rangeEndInput.addEventListener("input", onRangeChange);
  rangeEndInput.addEventListener("change", onRangeChange);
  rangeElement.addEventListener("changeDate", onRangeChange);
  onRangeChange();
}

function initializePresets() {
  const { start, end } = getPresetDates("today");
  reportStartDateInput.value = toIsoDate(start);
  reportEndDateInput.value = toIsoDate(end);
  setActivePreset("today");
}

presetSelect.addEventListener("change", () => {
  const preset = presetSelect.value;
  setActivePreset(preset);
  if (preset !== "custom") {
    const { start, end } = getPresetDates(preset);
    reportStartDateInput.value = toIsoDate(start);
    reportEndDateInput.value = toIsoDate(end);
    runWorklogReportSearch();
  }
  if (preset === "custom") {
    syncCustomRangeToHiddenInputs();
  }
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatStartedDisplay(rawStarted) {
  const value = String(rawStarted || "").trim();
  if (!value) return "-";

  let normalized = value;
  if (normalized.length >= 5 && (normalized.at(-5) === "+" || normalized.at(-5) === "-")) {
    normalized = `${normalized.slice(0, -5)}${normalized.slice(-5, -2)}:${normalized.slice(-2)}`;
  }

  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) return value;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n) => String(n).padStart(2, "0");
  const day = pad(dt.getDate());
  const month = months[dt.getMonth()];
  const year = dt.getFullYear();
  let hour = dt.getHours();
  const minute = pad(dt.getMinutes());
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  const hourText = pad(hour);
  return `${day}-${month}-${year} ${hourText}:${minute} ${ampm}`;
}

function renderReportRows(rows) {
  reportTbody.innerHTML = rows.length
    ? rows.map((row) => `
        <tr class="border-b border-slate-100">
          <td class="p-2">${escapeHtml(formatStartedDisplay(row.started))}</td>
          <td class="p-2 font-medium">${
            row.issue_key
              ? `<a href="${escapeHtml(row.issue_url || "#")}" target="_blank" rel="noopener noreferrer" class="text-blue-700 hover:underline">${escapeHtml(row.issue_key)}</a>`
              : "-"
          }</td>
          <td class="p-2">${escapeHtml(row.issue_summary || "-")}</td>
          <td class="p-2">${escapeHtml(row.description || "-")}</td>
          <td class="p-2">${escapeHtml(row.time_spent || row.time_spent_seconds || "-")}</td>
          <td class="p-2 font-mono text-xs">${escapeHtml(row.worklog_id || "-")}</td>
          <td class="p-2">
            ${
              row.issue_key
                ? `<div class="flex items-center gap-1">
                     <button type="button" class="inline-flex items-center rounded-lg bg-emerald-600 p-2.5 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-300 dark:bg-emerald-600 dark:hover:bg-emerald-700 dark:focus:ring-emerald-800"
                       aria-label="Add custom worklog for ${escapeHtml(row.issue_key)}"
                       data-action="open-custom-worklog-modal"
                       data-issue-key="${escapeHtml(row.issue_key)}">
                      <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fill-rule="evenodd" d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z" clip-rule="evenodd"/>
                      </svg>
                     </button>
                     <button type="button" class="inline-flex items-center rounded-lg bg-red-600 p-2.5 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-300 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-900"
                       aria-label="Delete worklog ${escapeHtml(row.worklog_id || "")} for ${escapeHtml(row.issue_key)}"
                       data-action="delete-worklog"
                       data-issue-key="${escapeHtml(row.issue_key)}"
                       data-worklog-id="${escapeHtml(row.worklog_id || "")}">
                      <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fill-rule="evenodd" d="M8.75 2.5a1.25 1.25 0 0 0-1.243 1.116L7.42 4H5.75a.75.75 0 0 0 0 1.5h.387l.743 9.287A2 2 0 0 0 8.873 16.7h2.254a2 2 0 0 0 1.993-1.913l.743-9.287h.387a.75.75 0 0 0 0-1.5h-1.67l-.086-.384A1.25 1.25 0 0 0 11.25 2.5h-2.5Zm.248 1.5h2.004l.057.25h-2.118l.057-.25Zm.003 3.25a.75.75 0 0 0-1.5 0v6a.75.75 0 0 0 1.5 0v-6Zm3.5 0a.75.75 0 0 0-1.5 0v6a.75.75 0 0 0 1.5 0v-6Z" clip-rule="evenodd"/>
                      </svg>
                     </button>
                   </div>`
                : "-"
            }
          </td>
        </tr>
      `).join("")
    : '<tr><td class="p-2 text-slate-500" colspan="7">No worklogs found for selected filters.</td></tr>';

  const uniqueIssues = new Set(rows.map((row) => row.issue_key).filter(Boolean));
  const totalSeconds = rows.reduce((sum, row) => sum + Number(row.time_spent_seconds || 0), 0);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const formattedTime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  reportSummaryMsg.textContent = `Total tasks: ${uniqueIssues.size} | Total time spent: ${formattedTime}`;
}

function renderReportSkeleton() {
  const skeletonRow = `
    <tr class="border-b border-slate-100 animate-pulse">
      <td class="p-2"><div class="h-3 rounded-full bg-gray-200 dark:bg-gray-700 w-28"></div></td>
      <td class="p-2"><div class="h-3 rounded-full bg-gray-200 dark:bg-gray-700 w-20"></div></td>
      <td class="p-2"><div class="h-3 rounded-full bg-gray-200 dark:bg-gray-700 w-48"></div></td>
      <td class="p-2"><div class="h-3 rounded-full bg-gray-200 dark:bg-gray-700 w-56"></div></td>
      <td class="p-2"><div class="h-3 rounded-full bg-gray-200 dark:bg-gray-700 w-16"></div></td>
      <td class="p-2"><div class="h-3 rounded-full bg-gray-200 dark:bg-gray-700 w-24"></div></td>
      <td class="p-2"><div class="h-8 rounded-lg bg-gray-200 dark:bg-gray-700 w-20"></div></td>
    </tr>
  `;
  reportTbody.innerHTML = `${skeletonRow}${skeletonRow}${skeletonRow}`;
}

function renderReportMessageRow(message) {
  reportTbody.innerHTML = `<tr><td class="p-2 text-slate-500" colspan="7">${escapeHtml(message)}</td></tr>`;
}

function showCustomWorklogResult(ok, payload) {
  customWorklogResultBox.classList.remove("hidden");
  customWorklogResultBox.className = ok
    ? "mt-2 text-sm rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-900"
    : "mt-2 text-sm rounded-md border border-red-200 bg-red-50 p-3 text-red-900";
  customWorklogResultBox.textContent = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}

function clearIssueDetails() {
  issueSummaryValue.textContent = "-";
  issuePriorityValue.textContent = "-";
  issueAssigneeValue.textContent = "-";
  issueEstimateValue.textContent = "-";
}

function renderIssueDetailsSkeleton() {
  const skeleton = '<div role="status" class="inline-flex animate-pulse align-middle"><div class="h-3 w-24 rounded-full bg-gray-200 dark:bg-gray-700"></div><span class="sr-only">Loading...</span></div>';
  issueSummaryValue.innerHTML = skeleton;
  issuePriorityValue.innerHTML = skeleton;
  issueAssigneeValue.innerHTML = skeleton;
  issueEstimateValue.innerHTML = skeleton;
}

function renderIssueDetails(details) {
  issueSummaryValue.textContent = details.summary || "-";
  issuePriorityValue.textContent = details.priority || "-";
  issueAssigneeValue.textContent = details.assignee || "-";
  issueEstimateValue.textContent = details.original_estimate || "-";
}

async function runWorklogReportSearch() {
  clearError();
  if (presetSelect.value === "custom") {
    syncCustomRangeToHiddenInputs();
  }
  const startDate = reportStartDateInput.value;
  const endDate = reportEndDateInput.value;

  if (!startDate || !endDate) {
    showError("Start date and end date are required.");
    return;
  }
  if (startDate > endDate) {
    showError("Start date cannot be after end date.");
    return;
  }

  setReportLoading(true);
  try {
    const resp = await fetch("/report/worklogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_date: startDate, end_date: endDate })
    });

    let payload;
    try {
      payload = await resp.json();
    } catch {
      payload = { detail: "Report response was not JSON." };
    }

    if (!resp.ok) {
      showError(payload?.detail || "Failed to fetch Jira worklogs.");
      reportStatusMsg.textContent = "Search failed.";
      renderReportMessageRow("Unable to load worklogs for selected filters.");
      return;
    }

    renderReportRows(payload.worklogs || []);
    reportStatusMsg.textContent = `Found ${payload.count || 0} worklog(s).`;
  } catch (error) {
    showError(error.message || "Unknown report error");
    renderReportMessageRow("Unable to load worklogs for selected filters.");
  } finally {
    hasLoadedReportOnce = true;
    setReportLoading(false);
  }
}

async function refreshReportAfterMutation() {
  if (!reportStartDateInput.value || !reportEndDateInput.value) {
    const { start, end } = getPresetDates("today");
    reportStartDateInput.value = toIsoDate(start);
    reportEndDateInput.value = toIsoDate(end);
    setActivePreset("today");
  }
  await runWorklogReportSearch();
}

async function runAddCustomWorklog() {
  clearError();
  customWorklogResultBox.classList.add("hidden");
  let shouldRefreshReport = false;
  const issueKey = customIssueKeyInput.value.trim().toUpperCase();
  const timeSpent = customTimeSpentInput.value.trim().toLowerCase();
  const { value: started, error: startedError } = getCustomStartedValue();
  const description = customDescriptionInput.value.trim();
  if (!issueKey || !timeSpent) {
    showError("Ticket ID and Worklog time are required.");
    return;
  }
  if (startedError) {
    showError(startedError);
    return;
  }

  setCustomWorklogLoading(true);
  try {
    const resp = await fetch("/worklogs/custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        issue_key: issueKey,
        time_spent: timeSpent,
        started,
        description: description || null
      })
    });

    let payload;
    try {
      payload = await resp.json();
    } catch {
      payload = { detail: "Custom worklog response was not JSON." };
    }

    if (!resp.ok) {
      showCustomWorklogResult(false, payload?.detail || "Failed to add worklog.");
      customWorklogStatusMsg.textContent = "Add worklog failed.";
      return;
    }

    showCustomWorklogResult(true, payload);
    customWorklogStatusMsg.textContent = `Added worklog ${payload.worklog_id || ""} on ${payload.issue_key || issueKey}.`;
    shouldRefreshReport = true;
  } catch (error) {
    showCustomWorklogResult(false, error.message || "Unknown add worklog error");
  } finally {
    setCustomWorklogLoading(false);
  }
  if (shouldRefreshReport) {
    await refreshReportAfterMutation();
  }
}

async function runDeleteWorklog(issueKey, worklogId, button) {
  const normalizedIssueKey = String(issueKey || "").trim().toUpperCase();
  const normalizedWorklogId = String(worklogId || "").trim();
  if (!normalizedIssueKey || !normalizedWorklogId) {
    showError("Issue key and worklog ID are required for delete.");
    return;
  }

  clearError();
  setDeleteWorklogLoading(button, true);
  reportStatusMsg.textContent = `Deleting worklog ${normalizedWorklogId}...`;
  try {
    const resp = await fetch("/worklogs/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        issue_key: normalizedIssueKey,
        worklog_id: normalizedWorklogId
      })
    });

    let payload;
    try {
      payload = await resp.json();
    } catch {
      payload = { detail: "Delete worklog response was not JSON." };
    }
    if (!resp.ok) {
      showError(payload?.detail || "Failed to delete Jira worklog.");
      reportStatusMsg.textContent = "Delete failed.";
      return;
    }
    await refreshReportAfterMutation();
    reportStatusMsg.textContent = `Deleted worklog ${normalizedWorklogId}.`;
  } catch (error) {
    showError(error.message || "Unknown delete worklog error");
  } finally {
    setDeleteWorklogLoading(button, false);
  }
}

async function lookupTicketDetails() {
  const issueKey = customIssueKeyInput.value.trim().toUpperCase();
  if (!issueKey) {
    clearIssueDetails();
    return;
  }
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(issueKey)) {
    clearIssueDetails();
    return;
  }

  try {
    renderIssueDetailsSkeleton();
    const resp = await fetch("/issues/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issue_key: issueKey })
    });
    const payload = await resp.json();
    if (!resp.ok) {
      clearIssueDetails();
      return;
    }
    renderIssueDetails(payload);
  } catch {
    clearIssueDetails();
  }
}

reportSearchBtn.addEventListener("click", runWorklogReportSearch);
customWorklogBtn.addEventListener("click", runAddCustomWorklog);
openCustomWorklogBtn?.addEventListener("click", () => {
  openCustomWorklogModal();
});
customWorklogModalCloseBtn?.addEventListener("click", () => {
  const modalInstance = getCustomWorklogModalInstance();
  if (modalInstance) modalInstance.hide();
});
confirmDeleteWorklogBtn?.addEventListener("click", async () => {
  if (!pendingDeleteWorklog) return;
  const modalInstance = getDeleteWorklogModalInstance();
  if (modalInstance) modalInstance.hide();
  const { issueKey, worklogId, button } = pendingDeleteWorklog;
  pendingDeleteWorklog = null;
  await runDeleteWorklog(issueKey, worklogId, button);
});
cancelDeleteWorklogBtn?.addEventListener("click", () => {
  pendingDeleteWorklog = null;
  const modalInstance = getDeleteWorklogModalInstance();
  if (modalInstance) modalInstance.hide();
});
reportTbody.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;
  const action = btn.getAttribute("data-action");
  if (action === "open-custom-worklog-modal") {
    const issueKey = btn.getAttribute("data-issue-key") || "";
    openCustomWorklogModal(issueKey);
    return;
  }
  if (action === "delete-worklog") {
    const issueKey = btn.getAttribute("data-issue-key") || "";
    const worklogId = btn.getAttribute("data-worklog-id") || "";
    openDeleteWorklogConfirmModal(issueKey, worklogId, btn);
  }
});
customIssueKeyInput.addEventListener("blur", lookupTicketDetails);
customIssueKeyInput.addEventListener("change", lookupTicketDetails);
customIssueKeyInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    lookupTicketDetails();
  }
});
themeToggleBtn.addEventListener("click", toggleTheme);

initializeTheme();
initializePresets();
clearIssueDetails();
setDefaultCustomStartedDateTime();
loadMeta();
runWorklogReportSearch();
