const THEME_STORAGE_KEY = "jira-worklog-theme";
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

function worklogApp() {
  return {
    // Theme/page
    pageTitle: "WorkLog Report - unknown",
    themeIcon: "🌙",

    // Report state
    preset: "today",
    reportStartDate: "",
    reportEndDate: "",
    reportSearchBtnHtml: "Search",
    isReportLoading: false,
    reportStatusMsgHtml: "Enter filters and click Search.",
    reportSummaryMsg: "Total tasks: 0 | Total time spent: 0m",
    reportTbodyHtml: '<tr><td class="p-2 text-slate-500" colspan="7">No report data.</td></tr>',
    hasLoadedReportOnce: false,

    // Modals
    customWorklogModalInstance: null,
    deleteWorklogModalInstance: null,
    pendingDeleteWorklog: null,
    deleteConfirmText: "Are you sure you want to delete this worklog?",
    rangeStartInput: null,
    rangeEndInput: null,

    // Messages/results
    errorMsg: "",
    customWorklogStatusMsg: "Enter ticket and time, then click Add Worklog.",
    customWorklogBtnHtml: "Add Worklog",
    isCustomWorklogLoading: false,
    customWorklogResultVisible: false,
    customWorklogResultClass: "mt-2 text-sm rounded-md border p-3",
    customWorklogResultText: "",

    // Custom form
    customForm: {
      issueKey: "",
      timeSpent: "",
      startedDate: "",
      startedTime: "",
      description: ""
    },

    // Issue details
    issueDetails: {
      summary: "-",
      priority: "-",
      assignee: "-",
      originalEstimate: "-"
    },

    init() {
      this.initializeTheme();
      this.initializePresets();
      this.clearIssueDetails();
      this.setDefaultCustomStartedDateTime();
      this.setupDateRangePicker();
      this.loadMeta();
      this.runWorklogReportSearch();
    },

    setupDateRangePicker() {
      const rangeElement = document.getElementById("date-range-picker");
      if (!rangeElement || this.rangeStartInput) return;
      this.rangeStartInput = rangeElement.querySelector('input[name="start"]');
      this.rangeEndInput = rangeElement.querySelector('input[name="end"]');
      if (!this.rangeStartInput || !this.rangeEndInput) return;
      const onRangeChange = () => this.syncCustomRangeToState();
      this.rangeStartInput.addEventListener("input", onRangeChange);
      this.rangeStartInput.addEventListener("change", onRangeChange);
      this.rangeEndInput.addEventListener("input", onRangeChange);
      this.rangeEndInput.addEventListener("change", onRangeChange);
      rangeElement.addEventListener("changeDate", onRangeChange);
      onRangeChange();
    },

    initializeTheme() {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      this.applyTheme(savedTheme === "light" ? "light" : "dark");
    },

    applyTheme(theme) {
      const isLight = theme === "light";
      document.body.classList.toggle("light-theme", isLight);
      document.documentElement.classList.toggle("dark", !isLight);
      this.themeIcon = isLight ? "☀️" : "🌙";
    },

    toggleTheme() {
      const isLight = document.body.classList.contains("light-theme");
      const nextTheme = isLight ? "dark" : "light";
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      this.applyTheme(nextTheme);
    },

    toIsoDate(dt) {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const d = String(dt.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    },

    getPresetDates(preset) {
      const today = new Date();
      const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      if (preset === "today") return { start: localToday, end: localToday };
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
    },

    initializePresets() {
      const { start, end } = this.getPresetDates("today");
      this.reportStartDate = this.toIsoDate(start);
      this.reportEndDate = this.toIsoDate(end);
      this.preset = "today";
    },

    onPresetChange() {
      if (this.preset !== "custom") {
        const { start, end } = this.getPresetDates(this.preset);
        this.reportStartDate = this.toIsoDate(start);
        this.reportEndDate = this.toIsoDate(end);
        this.runWorklogReportSearch();
      } else {
        this.syncCustomRangeToState();
      }
    },

    parseDisplayDate(value) {
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
        if (!Number.isInteger(numericMonth) || numericMonth < 1 || numericMonth > 12) return null;
        month = numericMonth - 1;
      }
      const dt = new Date(year, month, day);
      if (dt.getFullYear() !== year || dt.getMonth() !== month || dt.getDate() !== day) return null;
      return dt;
    },

    syncCustomRangeToState() {
      if (!this.rangeStartInput || !this.rangeEndInput) return;
      const parsedStart = this.parseDisplayDate(this.rangeStartInput.value);
      const parsedEnd = this.parseDisplayDate(this.rangeEndInput.value);
      this.reportStartDate = parsedStart ? this.toIsoDate(parsedStart) : "";
      this.reportEndDate = parsedEnd ? this.toIsoDate(parsedEnd) : "";
    },

    setReportLoading(isLoading) {
      this.isReportLoading = isLoading;
      this.reportSearchBtnHtml = isLoading
        ? `<svg aria-hidden="true" role="status" class="inline w-4 h-4 me-2 text-white animate-spin" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
             <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor"/>
             <path d="M93.9676 39.0409C96.393 38.4037 97.8624 35.9113 97.0079 33.5539C95.2932 28.8227 92.8711 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446844 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="#1E3A8A"/>
           </svg>Fetching...`
        : "Search";
      if (isLoading) {
        if (!this.hasLoadedReportOnce) this.renderReportSkeleton();
        this.reportStatusMsgHtml = `Fetching Jira worklogs...
          <svg aria-hidden="true" role="status" class="inline w-5 h-5 ms-1 text-gray-200 dark:text-gray-600 fill-blue-600 animate-spin" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor"/>
            <path d="M93.9676 39.0409C96.393 38.4037 97.8624 35.9113 97.0079 33.5539C95.2932 28.8227 92.8711 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446844 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill"/>
          </svg>`;
      }
    },

    setCustomWorklogLoading(isLoading) {
      this.isCustomWorklogLoading = isLoading;
      this.customWorklogBtnHtml = isLoading
        ? `<svg aria-hidden="true" role="status" class="inline w-4 h-4 me-2 text-white animate-spin" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
             <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor"/>
             <path d="M93.9676 39.0409C96.393 38.4037 97.8624 35.9113 97.0079 33.5539C95.2932 28.8227 92.8711 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446844 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="#065F46"/>
           </svg>Saving...`
        : "Add Worklog";
      if (isLoading) this.customWorklogStatusMsg = "Creating Jira worklog...";
    },

    getCustomWorklogModalInstance() {
      if (!this.customWorklogModalInstance && typeof Modal !== "undefined") {
        this.customWorklogModalInstance = new Modal(document.getElementById("customWorklogModal"));
      }
      return this.customWorklogModalInstance;
    },

    getDeleteWorklogModalInstance() {
      if (!this.deleteWorklogModalInstance && typeof Modal !== "undefined") {
        this.deleteWorklogModalInstance = new Modal(document.getElementById("deleteWorklogConfirmModal"));
      }
      return this.deleteWorklogModalInstance;
    },

    openCustomWorklogModal(issueKey = "") {
      this.clearError();
      this.customWorklogResultVisible = false;
      this.customWorklogStatusMsg = "Enter ticket and time, then click Add Worklog.";
      const normalizedIssueKey = String(issueKey || "").trim().toUpperCase();
      this.customForm.issueKey = normalizedIssueKey;
      if (normalizedIssueKey) this.lookupTicketDetails();
      else this.clearIssueDetails();
      const modalInstance = this.getCustomWorklogModalInstance();
      if (modalInstance) modalInstance.show();
    },

    hideCustomWorklogModal() {
      const modalInstance = this.getCustomWorklogModalInstance();
      if (modalInstance) modalInstance.hide();
    },

    openDeleteWorklogConfirmModal(issueKey, worklogId, button) {
      this.pendingDeleteWorklog = {
        issueKey: String(issueKey || "").trim().toUpperCase(),
        worklogId: String(worklogId || "").trim(),
        button
      };
      this.deleteConfirmText =
        `Are you sure you want to delete worklog ${this.pendingDeleteWorklog.worklogId} from ${this.pendingDeleteWorklog.issueKey}?`;
      const modalInstance = this.getDeleteWorklogModalInstance();
      if (modalInstance) modalInstance.show();
    },

    cancelDeleteWorklog() {
      this.pendingDeleteWorklog = null;
      const modalInstance = this.getDeleteWorklogModalInstance();
      if (modalInstance) modalInstance.hide();
    },

    async confirmDeleteWorklog() {
      if (!this.pendingDeleteWorklog) return;
      const { issueKey, worklogId, button } = this.pendingDeleteWorklog;
      this.cancelDeleteWorklog();
      await this.runDeleteWorklog(issueKey, worklogId, button);
    },

    setDefaultCustomStartedDateTime() {
      const now = new Date();
      if (!this.customForm.startedDate.trim()) this.customForm.startedDate = this.formatCurrentDisplayDate(now);
      if (!this.customForm.startedTime.trim()) this.customForm.startedTime = this.formatCurrentTime24h(now);
    },

    formatCurrentDisplayDate(dt) {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${String(dt.getDate()).padStart(2, "0")}-${months[dt.getMonth()]}-${dt.getFullYear()}`;
    },

    formatCurrentTime24h(dt) {
      return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
    },

    escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    },

    formatStartedDisplay(rawStarted) {
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
      return `${day}-${month}-${year} ${pad(hour)}:${minute} ${ampm}`;
    },

    renderReportRows(rows) {
      this.reportTbodyHtml = rows.length
        ? rows.map((row) => `
            <tr class="border-b border-slate-100">
              <td class="p-2">${this.escapeHtml(this.formatStartedDisplay(row.started))}</td>
              <td class="p-2 font-medium">${
                row.issue_key
                  ? `<a href="${this.escapeHtml(row.issue_url || "#")}" target="_blank" rel="noopener noreferrer" class="text-blue-700 hover:underline">${this.escapeHtml(row.issue_key)}</a>`
                  : "-"
              }</td>
              <td class="p-2">${this.escapeHtml(row.issue_summary || "-")}</td>
              <td class="p-2">${this.escapeHtml(row.description || "-")}</td>
              <td class="p-2">${this.escapeHtml(row.time_spent || row.time_spent_seconds || "-")}</td>
              <td class="p-2 font-mono text-xs">${this.escapeHtml(row.worklog_id || "-")}</td>
              <td class="p-2">${
                row.issue_key ? `<div class="flex items-center gap-1">
                  <button type="button" class="inline-flex items-center rounded-lg border border-emerald-700 p-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-800 hover:text-white focus:z-10 focus:outline-none focus:ring-4 focus:ring-emerald-300 dark:border-emerald-500 dark:text-emerald-500 dark:hover:bg-emerald-500 dark:hover:text-white dark:focus:ring-emerald-800"
                    aria-label="Add custom worklog for ${this.escapeHtml(row.issue_key)}"
                    data-action="open-custom-worklog-modal"
                    data-issue-key="${this.escapeHtml(row.issue_key)}">
                    <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fill-rule="evenodd" d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z" clip-rule="evenodd"/>
                    </svg>
                  </button>
                  <button type="button" class="inline-flex items-center rounded-lg border border-red-700 p-2.5 text-sm font-medium text-red-700 hover:bg-red-800 hover:text-white focus:z-10 focus:outline-none focus:ring-4 focus:ring-red-300 dark:border-red-500 dark:text-red-500 dark:hover:bg-red-500 dark:hover:text-white dark:focus:ring-red-900"
                    aria-label="Delete worklog ${this.escapeHtml(row.worklog_id || "")} for ${this.escapeHtml(row.issue_key)}"
                    data-action="delete-worklog"
                    data-issue-key="${this.escapeHtml(row.issue_key)}"
                    data-worklog-id="${this.escapeHtml(row.worklog_id || "")}">
                    <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fill-rule="evenodd" d="M8.75 2.5a1.25 1.25 0 0 0-1.243 1.116L7.42 4H5.75a.75.75 0 0 0 0 1.5h.387l.743 9.287A2 2 0 0 0 8.873 16.7h2.254a2 2 0 0 0 1.993-1.913l.743-9.287h.387a.75.75 0 0 0 0-1.5h-1.67l-.086-.384A1.25 1.25 0 0 0 11.25 2.5h-2.5Zm.248 1.5h2.004l.057.25h-2.118l.057-.25Zm.003 3.25a.75.75 0 0 0-1.5 0v6a.75.75 0 0 0 1.5 0v-6Zm3.5 0a.75.75 0 0 0-1.5 0v6a.75.75 0 0 0 1.5 0v-6Z" clip-rule="evenodd"/>
                    </svg>
                  </button>
                </div>` : "-"
              }</td>
            </tr>
          `).join("")
        : '<tr><td class="p-2 text-slate-500" colspan="7">No worklogs found for selected filters.</td></tr>';

      const uniqueIssues = new Set(rows.map((row) => row.issue_key).filter(Boolean));
      const totalSeconds = rows.reduce((sum, row) => sum + Number(row.time_spent_seconds || 0), 0);
      const totalMinutes = Math.floor(totalSeconds / 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const formattedTime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      this.reportSummaryMsg = `Total tasks: ${uniqueIssues.size} | Total time spent: ${formattedTime}`;
    },

    renderReportSkeleton() {
      const row = `
        <tr class="border-b border-slate-100 animate-pulse">
          <td class="p-2"><div class="h-3 rounded-full bg-gray-200 dark:bg-gray-700 w-28"></div></td>
          <td class="p-2"><div class="h-3 rounded-full bg-gray-200 dark:bg-gray-700 w-20"></div></td>
          <td class="p-2"><div class="h-3 rounded-full bg-gray-200 dark:bg-gray-700 w-48"></div></td>
          <td class="p-2"><div class="h-3 rounded-full bg-gray-200 dark:bg-gray-700 w-56"></div></td>
          <td class="p-2"><div class="h-3 rounded-full bg-gray-200 dark:bg-gray-700 w-16"></div></td>
          <td class="p-2"><div class="h-3 rounded-full bg-gray-200 dark:bg-gray-700 w-24"></div></td>
          <td class="p-2"><div class="h-8 rounded-lg bg-gray-200 dark:bg-gray-700 w-20"></div></td>
        </tr>`;
      this.reportTbodyHtml = `${row}${row}${row}`;
    },

    renderReportMessageRow(message) {
      this.reportTbodyHtml = `<tr><td class="p-2 text-slate-500" colspan="7">${this.escapeHtml(message)}</td></tr>`;
    },

    showError(message) {
      this.errorMsg = message;
    },

    clearError() {
      this.errorMsg = "";
    },

    showCustomWorklogResult(ok, payload) {
      this.customWorklogResultVisible = true;
      this.customWorklogResultClass = ok
        ? "mt-2 text-sm rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-900"
        : "mt-2 text-sm rounded-md border border-red-200 bg-red-50 p-3 text-red-900";
      this.customWorklogResultText = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
    },

    clearIssueDetails() {
      this.issueDetails = {
        summary: "-",
        priority: "-",
        assignee: "-",
        originalEstimate: "-"
      };
    },

    renderIssueDetailsSkeleton() {
      const skeleton = '<div role="status" class="inline-flex animate-pulse align-middle"><div class="h-3 w-24 rounded-full bg-gray-200 dark:bg-gray-700"></div><span class="sr-only">Loading...</span></div>';
      this.issueDetails = {
        summary: skeleton,
        priority: skeleton,
        assignee: skeleton,
        originalEstimate: skeleton
      };
    },

    renderIssueDetails(details) {
      this.issueDetails = {
        summary: this.escapeHtml(details.summary || "-"),
        priority: this.escapeHtml(details.priority || "-"),
        assignee: this.escapeHtml(details.assignee || "-"),
        originalEstimate: this.escapeHtml(details.original_estimate || "-")
      };
    },

    formatTimeToAmPm(timeValue) {
      const raw = String(timeValue || "").trim();
      if (!raw) return null;
      const match = raw.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
      if (!match) return null;
      let hours = Number(match[1]);
      const minutes = match[2];
      const ampm = hours >= 12 ? "PM" : "AM";
      hours %= 12;
      if (hours === 0) hours = 12;
      return `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
    },

    getCustomStartedValue() {
      const dateValue = this.customForm.startedDate.trim();
      const timeValue = this.customForm.startedTime.trim();
      if (!dateValue && !timeValue) return { value: "", error: null };
      if (!dateValue && timeValue) return { value: "", error: "Select a started date before choosing time." };
      if (!timeValue) return { value: dateValue, error: null };
      const amPm = this.formatTimeToAmPm(timeValue);
      if (!amPm) return { value: "", error: "Started time is invalid." };
      return { value: `${dateValue} ${amPm}`, error: null };
    },

    async runWorklogReportSearch() {
      this.clearError();
      if (this.preset === "custom") this.syncCustomRangeToState();
      if (!this.reportStartDate || !this.reportEndDate) {
        this.showError("Start date and end date are required.");
        return;
      }
      if (this.reportStartDate > this.reportEndDate) {
        this.showError("Start date cannot be after end date.");
        return;
      }

      this.setReportLoading(true);
      try {
        const resp = await fetch("/report/worklogs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ start_date: this.reportStartDate, end_date: this.reportEndDate })
        });
        let payload;
        try {
          payload = await resp.json();
        } catch {
          payload = { detail: "Report response was not JSON." };
        }
        if (!resp.ok) {
          this.showError(payload?.detail || "Failed to fetch Jira worklogs.");
          this.reportStatusMsgHtml = "Search failed.";
          this.renderReportMessageRow("Unable to load worklogs for selected filters.");
          return;
        }
        this.renderReportRows(payload.worklogs || []);
        this.reportStatusMsgHtml = `Found ${payload.count || 0} worklog(s).`;
      } catch (error) {
        this.showError(error.message || "Unknown report error");
        this.renderReportMessageRow("Unable to load worklogs for selected filters.");
      } finally {
        this.hasLoadedReportOnce = true;
        this.setReportLoading(false);
      }
    },

    async refreshReportAfterMutation() {
      if (!this.reportStartDate || !this.reportEndDate) {
        const { start, end } = this.getPresetDates("today");
        this.reportStartDate = this.toIsoDate(start);
        this.reportEndDate = this.toIsoDate(end);
        this.preset = "today";
      }
      await this.runWorklogReportSearch();
    },

    async runAddCustomWorklog() {
      this.clearError();
      this.customWorklogResultVisible = false;
      let shouldRefreshReport = false;
      const issueKey = this.customForm.issueKey.trim().toUpperCase();
      const timeSpent = this.customForm.timeSpent.trim().toLowerCase();
      const description = this.customForm.description.trim();
      const { value: started, error: startedError } = this.getCustomStartedValue();
      if (!issueKey || !timeSpent) {
        this.showError("Ticket ID and Worklog time are required.");
        return;
      }
      if (startedError) {
        this.showError(startedError);
        return;
      }

      this.setCustomWorklogLoading(true);
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
          this.showCustomWorklogResult(false, payload?.detail || "Failed to add worklog.");
          this.customWorklogStatusMsg = "Add worklog failed.";
          return;
        }
        this.showCustomWorklogResult(true, payload);
        this.customWorklogStatusMsg = `Added worklog ${payload.worklog_id || ""} on ${payload.issue_key || issueKey}.`;
        shouldRefreshReport = true;
      } catch (error) {
        this.showCustomWorklogResult(false, error.message || "Unknown add worklog error");
      } finally {
        this.setCustomWorklogLoading(false);
      }
      if (shouldRefreshReport) await this.refreshReportAfterMutation();
    },

    async runDeleteWorklog(issueKey, worklogId, button) {
      const normalizedIssueKey = String(issueKey || "").trim().toUpperCase();
      const normalizedWorklogId = String(worklogId || "").trim();
      if (!normalizedIssueKey || !normalizedWorklogId) {
        this.showError("Issue key and worklog ID are required for delete.");
        return;
      }

      this.clearError();
      if (button) {
        button.disabled = true;
        button.classList.add("opacity-60", "cursor-not-allowed");
      }
      this.reportStatusMsgHtml = `Deleting worklog ${this.escapeHtml(normalizedWorklogId)}...`;
      try {
        const resp = await fetch("/worklogs/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ issue_key: normalizedIssueKey, worklog_id: normalizedWorklogId })
        });
        let payload;
        try {
          payload = await resp.json();
        } catch {
          payload = { detail: "Delete worklog response was not JSON." };
        }
        if (!resp.ok) {
          this.showError(payload?.detail || "Failed to delete Jira worklog.");
          this.reportStatusMsgHtml = "Delete failed.";
          return;
        }
        await this.refreshReportAfterMutation();
        this.reportStatusMsgHtml = `Deleted worklog ${this.escapeHtml(normalizedWorklogId)}.`;
      } catch (error) {
        this.showError(error.message || "Unknown delete worklog error");
      } finally {
        if (button) {
          button.disabled = false;
          button.classList.remove("opacity-60", "cursor-not-allowed");
        }
      }
    },

    async lookupTicketDetails() {
      const issueKey = this.customForm.issueKey.trim().toUpperCase();
      if (!issueKey || !/^[A-Z][A-Z0-9]+-\d+$/.test(issueKey)) {
        this.clearIssueDetails();
        return;
      }
      try {
        this.renderIssueDetailsSkeleton();
        const resp = await fetch("/issues/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ issue_key: issueKey })
        });
        const payload = await resp.json();
        if (!resp.ok) {
          this.clearIssueDetails();
          return;
        }
        this.renderIssueDetails(payload);
      } catch {
        this.clearIssueDetails();
      }
    },

    handleReportActionClick(event) {
      const btn = event.target.closest("button[data-action]");
      if (!btn) return;
      const action = btn.getAttribute("data-action");
      if (action === "open-custom-worklog-modal") {
        this.openCustomWorklogModal(btn.getAttribute("data-issue-key") || "");
        return;
      }
      if (action === "delete-worklog") {
        this.openDeleteWorklogConfirmModal(
          btn.getAttribute("data-issue-key") || "",
          btn.getAttribute("data-worklog-id") || "",
          btn
        );
      }
    },

    async loadMeta() {
      try {
        const resp = await fetch("/meta");
        if (!resp.ok) return;
        const payload = await resp.json();
        this.pageTitle = `WorkLog Report - ${payload.report_email_label || "unknown"}`;
      } catch {
        // Keep default title.
      }
    }
  };
}

window.worklogApp = worklogApp;
