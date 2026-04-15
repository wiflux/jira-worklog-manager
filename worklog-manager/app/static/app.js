const pageTitle = document.getElementById("pageTitle");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const reportStartDateInput = document.getElementById("reportStartDateInput");
const reportEndDateInput = document.getElementById("reportEndDateInput");
const reportSearchBtn = document.getElementById("reportSearchBtn");
const reportStatusMsg = document.getElementById("reportStatusMsg");
const errorMsg = document.getElementById("errorMsg");
const reportTbody = document.getElementById("reportTbody");
const reportSummaryMsg = document.getElementById("reportSummaryMsg");
const customIssueKeyInput = document.getElementById("customIssueKeyInput");
const customTimeSpentInput = document.getElementById("customTimeSpentInput");
const customStartedInput = document.getElementById("customStartedInput");
const customDescriptionInput = document.getElementById("customDescriptionInput");
const customWorklogBtn = document.getElementById("customWorklogBtn");
const customWorklogStatusMsg = document.getElementById("customWorklogStatusMsg");
const customWorklogResultBox = document.getElementById("customWorklogResultBox");
const issueSummaryValue = document.getElementById("issueSummaryValue");
const issuePriorityValue = document.getElementById("issuePriorityValue");
const issueAssigneeValue = document.getElementById("issueAssigneeValue");
const issueEstimateValue = document.getElementById("issueEstimateValue");
const THEME_STORAGE_KEY = "jira-worklog-theme";

// Theme module: default to dark on first load, persist user's explicit choice.
function applyTheme(theme) {
  const isLight = theme === "light";
  document.body.classList.toggle("light-theme", isLight);
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
  reportSearchBtn.textContent = isLoading ? "Searching..." : "Search";
  if (isLoading) {
    reportStatusMsg.textContent = "Fetching Jira worklogs...";
  }
}

function setCustomWorklogLoading(isLoading) {
  customWorklogBtn.disabled = isLoading;
  customWorklogBtn.textContent = isLoading ? "Adding..." : "Add Worklog";
  if (isLoading) {
    customWorklogStatusMsg.textContent = "Creating Jira worklog...";
  }
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

function initializeReportDefaults() {
  const today = new Date();
  const localMidnightToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dayOfWeek = localMidnightToday.getDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(localMidnightToday);
  weekStart.setDate(localMidnightToday.getDate() - diffToMonday);

  const toIsoDate = (dt) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  reportStartDateInput.value = toIsoDate(weekStart);
  reportEndDateInput.value = toIsoDate(localMidnightToday);
}

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
          <td class="p-2">${escapeHtml(row.time_spent || row.time_spent_seconds || "-")}</td>
          <td class="p-2 font-mono text-xs">${escapeHtml(row.worklog_id || "-")}</td>
        </tr>
      `).join("")
    : '<tr><td class="p-2 text-slate-500" colspan="5">No worklogs found for selected filters.</td></tr>';

  const uniqueIssues = new Set(rows.map((row) => row.issue_key).filter(Boolean));
  const totalSeconds = rows.reduce((sum, row) => sum + Number(row.time_spent_seconds || 0), 0);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const formattedTime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  reportSummaryMsg.textContent = `Total tasks: ${uniqueIssues.size} | Total time spent: ${formattedTime}`;
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

function renderIssueDetails(details) {
  issueSummaryValue.textContent = details.summary || "-";
  issuePriorityValue.textContent = details.priority || "-";
  issueAssigneeValue.textContent = details.assignee || "-";
  issueEstimateValue.textContent = details.original_estimate || "-";
}

function toJiraStarted(userInputValue) {
  if (!userInputValue) return null;
  const raw = userInputValue.trim();
  if (!raw) return null;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return undefined;

  const pad = (n) => String(n).padStart(2, "0");
  const year = dt.getFullYear();
  const month = pad(dt.getMonth() + 1);
  const dayText = pad(dt.getDate());
  const hourText = pad(dt.getHours());
  const minuteText = pad(dt.getMinutes());
  const second = pad(dt.getSeconds());
  const tzMin = -dt.getTimezoneOffset();
  const sign = tzMin >= 0 ? "+" : "-";
  const absMin = Math.abs(tzMin);
  const tzHour = pad(Math.floor(absMin / 60));
  const tzMinute = pad(absMin % 60);
  return `${year}-${month}-${dayText}T${hourText}:${minuteText}:${second}.000${sign}${tzHour}${tzMinute}`;
}

async function runWorklogReportSearch() {
  clearError();
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
      return;
    }

    renderReportRows(payload.worklogs || []);
    reportStatusMsg.textContent = `Found ${payload.count || 0} worklog(s).`;
  } catch (error) {
    showError(error.message || "Unknown report error");
  } finally {
    setReportLoading(false);
  }
}

async function runAddCustomWorklog() {
  clearError();
  customWorklogResultBox.classList.add("hidden");
  const issueKey = customIssueKeyInput.value.trim().toUpperCase();
  const timeSpent = customTimeSpentInput.value.trim().toLowerCase();
  const started = toJiraStarted(customStartedInput.value);
  const description = customDescriptionInput.value.trim();
  if (!issueKey || !timeSpent) {
    showError("Ticket ID and Worklog time are required.");
    return;
  }
  if (customStartedInput.value.trim() && started === undefined) {
    showError("Started date/time is invalid.");
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
  } catch (error) {
    showCustomWorklogResult(false, error.message || "Unknown add worklog error");
  } finally {
    setCustomWorklogLoading(false);
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
initializeReportDefaults();
clearIssueDetails();
loadMeta();
