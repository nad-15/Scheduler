/**
 * ==========================================================================
 * Skhayeduler — Job & Earnings Calculator Module
 * ==========================================================================
 * 
 * Modular, on-demand feature for calculating work hours, earnings, and net pay.
 * - Injects DOM dynamically on first interaction (zero initial page weight).
 * - Scans localStorage['tasks'] within any date range (defaults to current month).
 * - Distinguishes paid jobs from personal tasks/errands via clean checkboxes.
 * - Handles happy case (uniform hours/rate) and edge cases (per-date hour overrides).
 * - Live Tax deduction (% or $) with net take-home calculation.
 * - Fully persistent in localStorage['jobCalculatorSettings'].
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'jobCalculatorSettings';

  // State
  let state = {
    injected: false,
    isOpen: false,
    fromDate: null, // YYYY-MM-DD
    toDate: null,   // YYYY-MM-DD
    activePreset: 'this-month', // 'this-month' | 'last-month' | 'first-half' | 'second-half' | 'last-30' | 'custom'
    activeTab: 'paid',          // 'paid' (default) | 'all'
    searchQuery: '',
    expandedJobs: new Set(),    // Set of job names whose date accordion is open
    settings: {
      tax: {
        type: 'percent', // 'percent' | 'amount'
        value: 0
      },
      jobs: {}
      /**
       * "Job Name": {
       *    isPaid: boolean,
       *    defaultHours: number,
       *    hourlyRate: number,
       *    dateOverrides: { [occKey]: number } // occKey = "YYYY-M-D_morning"
       * }
       */
    }
  };

  // Cached scan result: { [jobName]: { name, color, occurrences: [] } }
  let scannedJobs = {};

  /* ==========================================================================
   * 1. Persistence Helpers
   * ========================================================================== */

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          state.settings = {
            tax: {
              type: parsed.tax?.type === 'amount' ? 'amount' : 'percent',
              value: typeof parsed.tax?.value === 'number' ? parsed.tax.value : (parseFloat(parsed.tax?.value) || 0)
            },
            jobs: parsed.jobs && typeof parsed.jobs === 'object' ? parsed.jobs : {}
          };
        }
      }
    } catch (e) {
      console.warn('[JobCalculator] Failed to load settings from localStorage:', e);
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
    } catch (e) {
      console.warn('[JobCalculator] Failed to save settings to localStorage:', e);
    }
  }

  function getJobSetting(jobName) {
    if (!state.settings.jobs[jobName]) {
      state.settings.jobs[jobName] = {
        isPaid: false,
        defaultHours: 4,
        hourlyRate: 25,
        dateOverrides: {}
      };
    }
    return state.settings.jobs[jobName];
  }

  /* ==========================================================================
   * 2. Date Formatting & Helpers
   * ========================================================================== */

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const MONTH_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  function pad(num) {
    return String(num).padStart(2, '0');
  }

  function formatDateIso(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseIsoDate(isoStr) {
    if (!isoStr) return new Date();
    const [y, m, d] = isoStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function formatDisplayDate(dateObj) {
    return `${MONTH_SHORT[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;
  }

  function getPeriodLabel(period) {
    if (period === 'morning') return 'Morning';
    if (period === 'afternoon') return 'Afternoon';
    if (period === 'evening') return 'Evening';
    return period ? period.charAt(0).toUpperCase() + period.slice(1) : 'Session';
  }

  /**
   * Determine default start/end dates for a given preset
   */
  function computePresetRange(presetName) {
    const now = (typeof AppTimezone !== 'undefined' && AppTimezone.now) ? AppTimezone.now() : new Date();
    const year = (typeof currentYearVertView !== 'undefined' && currentYearVertView !== null) ? currentYearVertView : now.getFullYear();
    const month = (typeof currentMonthVertView !== 'undefined' && currentMonthVertView !== null) ? currentMonthVertView : now.getMonth();

    if (presetName === 'this-month') {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return { from: formatDateIso(start), to: formatDateIso(end) };
    }

    if (presetName === 'last-month') {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      return { from: formatDateIso(start), to: formatDateIso(end) };
    }

    if (presetName === 'first-half') {
      const start = new Date(year, month, 1);
      const end = new Date(year, month, 15);
      return { from: formatDateIso(start), to: formatDateIso(end) };
    }

    if (presetName === 'second-half') {
      const start = new Date(year, month, 16);
      const end = new Date(year, month + 1, 0);
      return { from: formatDateIso(start), to: formatDateIso(end) };
    }

    if (presetName === 'last-30') {
      const end = new Date(now);
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      return { from: formatDateIso(start), to: formatDateIso(end) };
    }

    return null;
  }

  /* ==========================================================================
   * 3. Task Scanner
   * ========================================================================== */

  /**
   * Reads localStorage['tasks'] and aggregates unique task titles
   * within state.fromDate -> state.toDate.
   */
  function scanTasksInRange() {
    const rawTasks = localStorage.getItem('tasks');
    let stored = {};
    try {
      stored = JSON.parse(rawTasks || '{}');
    } catch (e) {
      console.warn('[JobCalculator] Corrupted tasks in localStorage:', e);
    }

    const startDate = parseIsoDate(state.fromDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = parseIsoDate(state.toDate);
    endDate.setHours(23, 59, 59, 999);

    const jobsMap = {};

    Object.keys(stored).forEach((dateKey) => {
      // Key format: YYYY-M-D (M is 0-indexed month, D is 1-indexed date)
      const parts = dateKey.split('-');
      if (parts.length !== 3) return;

      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);

      if (isNaN(y) || isNaN(m) || isNaN(d)) return;

      const entryDate = new Date(y, m, d);
      if (entryDate < startDate || entryDate > endDate) return;

      const dayData = stored[dateKey];
      if (!dayData || typeof dayData !== 'object') return;

      ['morning', 'afternoon', 'evening'].forEach((period) => {
        const periodList = dayData[period];
        if (!Array.isArray(periodList)) return;

        periodList.forEach((entry, idx) => {
          if (!entry) return;
          const taskName = (typeof entry.task === 'string' ? entry.task : '').trim();
          if (!taskName) return;

          const color = entry.color || '#6a5044';
          const occKey = `${dateKey}_${period}_${idx}`;

          if (!jobsMap[taskName]) {
            jobsMap[taskName] = {
              name: taskName,
              color: color,
              occurrences: []
            };
          }

          jobsMap[taskName].occurrences.push({
            occKey: occKey,
            dateKey: dateKey,
            dateObj: entryDate,
            period: period,
            color: color
          });
        });
      });
    });

    // Sort occurrences by date chronologically
    Object.values(jobsMap).forEach((job) => {
      job.occurrences.sort((a, b) => a.dateObj - b.dateObj);
    });

    scannedJobs = jobsMap;
  }

  /* ==========================================================================
   * 4. Calculation Logic
   * ========================================================================== */

  function calculateTotals() {
    let totalSessions = 0;
    let totalHours = 0;
    let grossEarnings = 0;

    const jobResults = {};

    Object.keys(scannedJobs).forEach((name) => {
      const job = scannedJobs[name];
      const setting = getJobSetting(name);

      let jobHours = 0;
      let jobSubtotal = 0;
      const count = job.occurrences.length;

      if (setting.isPaid) {
        const defaultHours = parseFloat(setting.defaultHours) || 0;
        const rate = parseFloat(setting.hourlyRate) || 0;

        job.occurrences.forEach((occ) => {
          const overrideVal = setting.dateOverrides?.[occ.occKey];
          const occHours = (typeof overrideVal === 'number' && !isNaN(overrideVal))
            ? overrideVal
            : defaultHours;

          jobHours += occHours;
        });

        jobSubtotal = jobHours * rate;

        totalSessions += count;
        totalHours += jobHours;
        grossEarnings += jobSubtotal;
      }

      jobResults[name] = {
        isPaid: setting.isPaid,
        count: count,
        totalHours: jobHours,
        subtotal: jobSubtotal
      };
    });

    // Tax calculation
    const taxSetting = state.settings.tax || { type: 'percent', value: 0 };
    const taxVal = parseFloat(taxSetting.value) || 0;
    let taxDeductionAmount = 0;

    if (taxVal > 0 && grossEarnings > 0) {
      if (taxSetting.type === 'percent') {
        taxDeductionAmount = (grossEarnings * taxVal) / 100;
      } else {
        taxDeductionAmount = taxVal;
      }
      taxDeductionAmount = Math.min(grossEarnings, Math.max(0, taxDeductionAmount));
    }

    const netTakeHome = Math.max(0, grossEarnings - taxDeductionAmount);

    return {
      totalSessions,
      totalHours,
      grossEarnings,
      taxDeductionAmount,
      netTakeHome,
      jobResults
    };
  }

  /* ==========================================================================
   * 5. Lazy DOM Creation & Injection
   * ========================================================================== */

  function ensureCalculatorDOM() {
    if (state.injected && document.getElementById('job-calculator-container')) {
      return;
    }

    let existing = document.getElementById('job-calculator-container');
    if (existing) {
      existing.remove();
    }

    const container = document.createElement('div');
    container.id = 'job-calculator-container';
    container.className = 'job-calculator-view';
    container.style.display = 'none';

    container.innerHTML = `
      <!-- Sticky Header -->
      <header class="job-calc-header">
        <div class="job-calc-header-left">
          <button type="button" class="job-calc-btn-back" id="job-calc-btn-back" title="Back to Calendar">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="job-calc-title-group">
            <div class="job-calc-title-row">
              <svg class="job-calc-header-icon" viewBox="0 -960 960 960" width="22" height="22" fill="currentColor">
                <path d="M668.5-531.5Q680-543 680-560t-11.5-28.5Q657-600 640-600t-28.5 11.5Q600-577 600-560t11.5 28.5Q623-520 640-520t28.5-11.5ZM320-600h200v-80H320v80ZM180-120q-34-114-67-227.5T80-580q0-92 64-156t156-64h200q29-38 70.5-59t89.5-21q25 0 42.5 17.5T720-820q0 6-1.5 12t-3.5 11q-4 11-7.5 22.5T702-751l91 91h87v279l-113 37-67 224H480v-80h-80v80H180Zm60-80h80v-80h240v80h80l62-206 98-33v-141h-40L620-720q0-20 2.5-38.5T630-796q-29 8-51 27.5T547-720H300q-58 0-99 41t-41 99q0 98 27 191.5T240-200Zm240-298Z"/>
              </svg>
              <h2 class="job-calc-title">Work & Earnings</h2>
            </div>
            <span class="job-calc-subtitle" id="job-calc-subtitle">Monthly Shift Calculator</span>
          </div>
        </div>
      </header>

      <!-- Scrollable Main Content -->
      <div class="job-calc-body">
        
        <!-- Date Range Filter Card -->
        <section class="job-calc-card job-calc-date-card">
          <div class="job-calc-card-header">
            <span class="material-symbols-outlined job-calc-card-icon">calendar_month</span>
            <span class="job-calc-card-title">Date Range</span>
          </div>
          
          <div class="job-calc-date-presets" id="job-calc-date-presets">
            <button type="button" class="job-calc-pill active" data-preset="this-month">This Month</button>
            <button type="button" class="job-calc-pill" data-preset="last-month">Last Month</button>
            <button type="button" class="job-calc-pill" data-preset="first-half">1st - 15th</button>
            <button type="button" class="job-calc-pill" data-preset="second-half">16th - End</button>
            <button type="button" class="job-calc-pill" data-preset="last-30">Past 30 Days</button>
          </div>

          <div class="job-calc-date-inputs">
            <div class="job-calc-date-field">
              <label for="job-calc-from-date">From</label>
              <input type="date" id="job-calc-from-date" class="job-calc-date-picker">
            </div>
            <span class="job-calc-date-sep">→</span>
            <div class="job-calc-date-field">
              <label for="job-calc-to-date">To</label>
              <input type="date" id="job-calc-to-date" class="job-calc-date-picker">
            </div>
          </div>
        </section>

        <!-- Controls / Filter Tabs -->
        <section class="job-calc-controls-bar">
          <div class="job-calc-tabs">
            <button type="button" class="job-calc-tab active" data-tab="paid" id="job-calc-tab-paid">
              Paid Jobs (<span id="job-calc-count-paid">0</span>)
            </button>
            <button type="button" class="job-calc-tab" data-tab="all" id="job-calc-tab-all">
              All Tasks (<span id="job-calc-count-all">0</span>)
            </button>
          </div>
          <div class="job-calc-search-box">
            <span class="material-symbols-outlined job-calc-search-icon">search</span>
            <input type="text" id="job-calc-search-input" placeholder="Search tasks..." autocomplete="off">
            <button type="button" class="job-calc-search-clear" id="job-calc-search-clear" style="display: none;">✕</button>
          </div>
        </section>

        <!-- Tasks List Container -->
        <section class="job-calc-tasks-list" id="job-calc-tasks-list">
          <!-- Injected dynamically -->
        </section>

        <!-- Financial Summary & Tax Deduction Card -->
        <section class="job-calc-card job-calc-summary-card">
          <div class="job-calc-card-header">
            <span class="material-symbols-outlined job-calc-card-icon">receipt_long</span>
            <span class="job-calc-card-title">Earnings Summary</span>
          </div>

          <div class="job-calc-summary-metrics">
            <div class="job-calc-metric">
              <span class="job-calc-metric-label">Paid Sessions</span>
              <span class="job-calc-metric-val" id="job-calc-sum-sessions">0</span>
            </div>
            <div class="job-calc-metric">
              <span class="job-calc-metric-label">Total Hours</span>
              <span class="job-calc-metric-val" id="job-calc-sum-hours">0.0 hrs</span>
            </div>
          </div>

          <div class="job-calc-summary-rows">
            <div class="job-calc-summary-row">
              <span class="job-calc-row-title">Gross Earnings</span>
              <span class="job-calc-sum-bold" id="job-calc-sum-gross">$0.00</span>
            </div>

            <!-- Tax Deduction Row -->
            <div class="job-calc-tax-row">
              <div class="job-calc-tax-label-group">
                <span class="job-calc-tax-title">Tax Deduction</span>
                <div class="job-calc-tax-mode-toggle" id="job-calc-tax-mode-toggle">
                  <button type="button" class="job-calc-tax-mode-btn active" data-mode="percent">%</button>
                  <button type="button" class="job-calc-tax-mode-btn" data-mode="amount">$</button>
                </div>
              </div>
              <div class="job-calc-tax-input-group">
                <span class="job-calc-tax-symbol" id="job-calc-tax-symbol">%</span>
                <input type="number" id="job-calc-tax-input" class="job-calc-num-input job-calc-tax-val-input" min="0" step="1" placeholder="0">
                <span class="job-calc-tax-deduction-amount" id="job-calc-tax-amount">-$0.00</span>
              </div>
            </div>

            <div class="job-calc-divider"></div>

            <!-- Net Take-Home Row -->
            <div class="job-calc-summary-row job-calc-net-row">
              <div class="job-calc-net-label-wrap">
                <span class="job-calc-net-label">Net Take-Home Pay</span>
                <span class="job-calc-net-sublabel">After tax deduction</span>
              </div>
              <span class="job-calc-net-val" id="job-calc-sum-net">$0.00</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="job-calc-actions-row">
            <button type="button" class="job-calc-action-btn job-calc-btn-copy" id="job-calc-btn-copy">
              <span class="material-symbols-outlined">content_copy</span>
              <span>Copy Breakdown</span>
            </button>
          </div>
        </section>

      </div>
    `;

    document.body.appendChild(container);
    state.injected = true;

    bindDomEvents();
  }

  /* ==========================================================================
   * 6. DOM Events Binding
   * ========================================================================== */

  function bindDomEvents() {
    const container = document.getElementById('job-calculator-container');
    if (!container) return;

    // Back button
    const backBtn = container.querySelector('#job-calc-btn-back');
    if (backBtn) {
      backBtn.addEventListener('click', closeJobCalculatorView);
    }

    // Date Presets
    const presetsWrap = container.querySelector('#job-calc-date-presets');
    if (presetsWrap) {
      presetsWrap.addEventListener('click', (e) => {
        const btn = e.target.closest('.job-calc-pill');
        if (!btn) return;
        const preset = btn.dataset.preset;
        if (!preset) return;

        state.activePreset = preset;
        presetsWrap.querySelectorAll('.job-calc-pill').forEach((p) => {
          p.classList.toggle('active', p === btn);
        });

        const range = computePresetRange(preset);
        if (range) {
          state.fromDate = range.from;
          state.toDate = range.to;
          updateDateInputs();
          scanTasksInRange();
          renderAll();
        }
      });
    }

    // Date Inputs
    const fromInput = container.querySelector('#job-calc-from-date');
    const toInput = container.querySelector('#job-calc-to-date');

    const handleCustomDateChange = () => {
      const fromVal = fromInput.value;
      const toVal = toInput.value;
      if (fromVal && toVal) {
        state.fromDate = fromVal;
        state.toDate = toVal;
        state.activePreset = 'custom';
        presetsWrap?.querySelectorAll('.job-calc-pill').forEach((p) => p.classList.remove('active'));
        scanTasksInRange();
        renderAll();
      }
    };

    if (fromInput) fromInput.addEventListener('change', handleCustomDateChange);
    if (toInput) toInput.addEventListener('change', handleCustomDateChange);

    // Tabs
    const tabAll = container.querySelector('#job-calc-tab-all');
    const tabPaid = container.querySelector('#job-calc-tab-paid');

    if (tabAll) {
      tabAll.addEventListener('click', () => {
        state.activeTab = 'all';
        tabAll.classList.add('active');
        tabPaid.classList.remove('active');
        renderTasksList();
      });
    }

    if (tabPaid) {
      tabPaid.addEventListener('click', () => {
        state.activeTab = 'paid';
        tabPaid.classList.add('active');
        tabAll.classList.remove('active');
        renderTasksList();
      });
    }

    // Search
    const searchInput = container.querySelector('#job-calc-search-input');
    const searchClear = container.querySelector('#job-calc-search-clear');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        if (searchClear) searchClear.style.display = state.searchQuery ? 'block' : 'none';
        renderTasksList();
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        state.searchQuery = '';
        searchClear.style.display = 'none';
        renderTasksList();
      });
    }

    // Tax Mode Toggle (% vs $)
    const taxToggleWrap = container.querySelector('#job-calc-tax-mode-toggle');
    const taxInput = container.querySelector('#job-calc-tax-input');
    const taxSymbol = container.querySelector('#job-calc-tax-symbol');

    if (taxToggleWrap) {
      taxToggleWrap.addEventListener('click', (e) => {
        const btn = e.target.closest('.job-calc-tax-mode-btn');
        if (!btn) return;
        const mode = btn.dataset.mode;
        state.settings.tax.type = mode;
        taxToggleWrap.querySelectorAll('.job-calc-tax-mode-btn').forEach((b) => {
          b.classList.toggle('active', b === btn);
        });
        if (taxSymbol) taxSymbol.textContent = mode === 'percent' ? '%' : '$';
        saveSettings();
        updateSummaryCard();
      });
    }

    if (taxInput) {
      taxInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        state.settings.tax.value = isNaN(val) ? 0 : Math.max(0, val);
        saveSettings();
        updateSummaryCard();
      });
    }

    // Copy Summary Button
    const copyBtn = container.querySelector('#job-calc-btn-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', handleCopySummary);
    }
  }

  function updateDateInputs() {
    const container = document.getElementById('job-calculator-container');
    if (!container) return;
    const fromInput = container.querySelector('#job-calc-from-date');
    const toInput = container.querySelector('#job-calc-to-date');
    if (fromInput) fromInput.value = state.fromDate || '';
    if (toInput) toInput.value = state.toDate || '';

    const subtitle = container.querySelector('#job-calc-subtitle');
    if (subtitle && state.fromDate && state.toDate) {
      const f = parseIsoDate(state.fromDate);
      const t = parseIsoDate(state.toDate);
      subtitle.textContent = `${formatDisplayDate(f)} — ${formatDisplayDate(t)}`;
    }
  }

  /* ==========================================================================
   * 7. Rendering Logic
   * ========================================================================== */

  function renderAll() {
    updateDateInputs();
    renderTasksList();
    updateSummaryCard();
  }

  function renderTasksList() {
    const container = document.getElementById('job-calculator-container');
    if (!container) return;

    const listEl = container.querySelector('#job-calc-tasks-list');
    const countAllEl = container.querySelector('#job-calc-count-all');
    const countPaidEl = container.querySelector('#job-calc-count-paid');

    if (!listEl) return;

    const allNames = Object.keys(scannedJobs);
    const paidNames = allNames.filter((name) => getJobSetting(name).isPaid);

    if (countAllEl) countAllEl.textContent = allNames.length;
    if (countPaidEl) countPaidEl.textContent = paidNames.length;

    // Filter by tab and search
    let visibleNames = state.activeTab === 'paid' ? paidNames : allNames;

    if (state.searchQuery) {
      visibleNames = visibleNames.filter((name) =>
        name.toLowerCase().includes(state.searchQuery)
      );
    }

    // Sort: Paid jobs first, then by frequency
    visibleNames.sort((a, b) => {
      const isPaidA = getJobSetting(a).isPaid ? 1 : 0;
      const isPaidB = getJobSetting(b).isPaid ? 1 : 0;
      if (isPaidA !== isPaidB) return isPaidB - isPaidA;
      return scannedJobs[b].occurrences.length - scannedJobs[a].occurrences.length;
    });

    if (visibleNames.length === 0) {
      listEl.innerHTML = `
        <div class="job-calc-empty-state">
          <span class="material-symbols-outlined job-calc-empty-icon">
            ${state.activeTab === 'paid' ? 'account_balance_wallet' : 'event_busy'}
          </span>
          <p class="job-calc-empty-title">
            ${
              state.searchQuery
                ? 'No matching tasks'
                : state.activeTab === 'paid'
                ? 'No Paid Jobs Selected Yet'
                : 'No Tasks Found'
            }
          </p>
          <p class="job-calc-empty-text">
            ${
              state.searchQuery
                ? `No tasks match "<b>${escapeHtml(state.searchQuery)}</b>".`
                : state.activeTab === 'paid'
                ? `You haven't added any paid jobs to this calculation yet. Switch to "All Tasks" to pick your paid work.`
                : `No tasks found in the schedule between ${state.fromDate} and ${state.toDate}.`
            }
          </p>
          ${
            state.activeTab === 'paid' && !state.searchQuery
              ? `<button type="button" class="job-calc-empty-action-btn" id="job-calc-switch-to-all">
                   Browse All Logged Tasks (${allNames.length}) →
                 </button>`
              : ''
          }
        </div>
      `;

      const switchToAllBtn = listEl.querySelector('#job-calc-switch-to-all');
      if (switchToAllBtn) {
        switchToAllBtn.addEventListener('click', () => {
          state.activeTab = 'all';
          const tabAll = container.querySelector('#job-calc-tab-all');
          const tabPaid = container.querySelector('#job-calc-tab-paid');
          if (tabAll) tabAll.classList.add('active');
          if (tabPaid) tabPaid.classList.remove('active');
          renderTasksList();
        });
      }

      return;
    }

    const { jobResults } = calculateTotals();

    let html = '';
    visibleNames.forEach((name) => {
      const job = scannedJobs[name];
      const setting = getJobSetting(name);
      const isPaid = setting.isPaid;
      const count = job.occurrences.length;
      const result = jobResults[name] || { totalHours: 0, subtotal: 0 };
      const isAccordionOpen = state.expandedJobs.has(name);

      html += `
        <div class="job-calc-task-card ${isPaid ? 'is-paid' : 'is-unpaid'}" data-job-name="${escapeHtml(name)}">
          
          <!-- Card Header / Main Row -->
          <div class="job-calc-card-main">
            <label class="job-calc-checkbox-label" title="${isPaid ? 'Mark as Unpaid' : 'Mark as Paid Job'}">
              <input type="checkbox" class="job-calc-paid-checkbox" ${isPaid ? 'checked' : ''}>
              <span class="job-calc-custom-checkbox">
                <span class="material-symbols-outlined">check</span>
              </span>
            </label>

            <div class="job-calc-color-indicator" style="background-color: ${escapeHtml(job.color)};" title="Calendar Color"></div>

            <div class="job-calc-card-info">
              <div class="job-calc-title-row">
                <span class="job-calc-job-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
                <span class="job-calc-session-badge">${count} session${count > 1 ? 's' : ''}</span>
              </div>
              <div class="job-calc-tagline">
                ${isPaid ? 'Paid Work / Job' : 'Personal / Errand (Excluded)'}
              </div>
            </div>

            <!-- Subtotal Pill -->
            <div class="job-calc-subtotal-badge" style="${isPaid ? '' : 'display: none;'}">
              <span class="job-calc-subtotal-amount">$${result.subtotal.toFixed(2)}</span>
              <span class="job-calc-subtotal-hours">${result.totalHours.toFixed(1)} hrs</span>
            </div>
          </div>

          <!-- Config Section (Visible when Paid) -->
          <div class="job-calc-card-config" style="${isPaid ? '' : 'display: none;'}">
            
            <div class="job-calc-inputs-row">
              <div class="job-calc-input-block">
                <label>Hours / Session</label>
                <div class="job-calc-input-wrapper">
                  <input type="number" class="job-calc-hours-input job-calc-num-input" min="0" step="0.25" value="${setting.defaultHours ?? 4}" placeholder="4">
                  <span class="job-calc-unit">hrs</span>
                </div>
              </div>

              <div class="job-calc-input-block">
                <label>Rate ($/hr)</label>
                <div class="job-calc-input-wrapper">
                  <span class="job-calc-prefix">$</span>
                  <input type="number" class="job-calc-rate-input job-calc-num-input" min="0" step="0.5" value="${setting.hourlyRate ?? 25}" placeholder="25">
                  <span class="job-calc-unit">/hr</span>
                </div>
              </div>
            </div>

            <!-- Accordion Toggle Button -->
            <button type="button" class="job-calc-accordion-btn ${isAccordionOpen ? 'active' : ''}">
              <span class="material-symbols-outlined job-calc-accordion-arrow">
                ${isAccordionOpen ? 'expand_less' : 'expand_more'}
              </span>
              <span>View & Adjust Specific Dates (${count})</span>
            </button>

            <!-- Accordion Dates List -->
            <div class="job-calc-dates-accordion ${isAccordionOpen ? '' : 'hidden'}">
              ${renderJobOccurrencesHtml(job, setting)}
            </div>

          </div>

        </div>
      `;
    });

    listEl.innerHTML = html;
    bindCardEvents(listEl);
  }

  function renderJobOccurrencesHtml(job, setting) {
    const defaultHours = parseFloat(setting.defaultHours) || 0;

    let rowsHtml = '';
    job.occurrences.forEach((occ) => {
      const hasOverride = typeof setting.dateOverrides?.[occ.occKey] === 'number';
      const hoursVal = hasOverride ? setting.dateOverrides[occ.occKey] : defaultHours;

      rowsHtml += `
        <div class="job-calc-occ-row" data-occ-key="${escapeHtml(occ.occKey)}">
          <div class="job-calc-occ-date-wrap">
            <span class="job-calc-occ-date">${formatDisplayDate(occ.dateObj)}</span>
            <span class="job-calc-occ-period job-calc-period-${escapeHtml(occ.period)}">
              ${getPeriodLabel(occ.period)}
            </span>
          </div>

          <div class="job-calc-occ-input-wrap">
            <input type="number" class="job-calc-occ-hours-input job-calc-num-input" min="0" step="0.25" value="${hoursVal}">
            <span class="job-calc-occ-unit">hrs</span>
            ${
              hasOverride
                ? `<button type="button" class="job-calc-occ-reset-btn" title="Reset to default (${defaultHours} hrs)">
                    <span class="material-symbols-outlined">restart_alt</span>
                   </button>`
                : ''
            }
          </div>
        </div>
      `;
    });

    return rowsHtml;
  }

  function bindCardEvents(listEl) {
    // 1. Paid checkbox toggle
    listEl.querySelectorAll('.job-calc-paid-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        const jobName = card.dataset.jobName;
        const setting = getJobSetting(jobName);
        setting.isPaid = e.target.checked;
        saveSettings();
        renderTasksList();
        updateSummaryCard();
      });
    });

    // 2. Default hours input
    listEl.querySelectorAll('.job-calc-hours-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        const jobName = card.dataset.jobName;
        const setting = getJobSetting(jobName);
        const val = parseFloat(e.target.value);
        setting.defaultHours = isNaN(val) ? 0 : Math.max(0, val);
        saveSettings();
        updateCardSubtotal(card, jobName);
        updateSummaryCard();
      });
    });

    // 3. Hourly rate input
    listEl.querySelectorAll('.job-calc-rate-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        const jobName = card.dataset.jobName;
        const setting = getJobSetting(jobName);
        const val = parseFloat(e.target.value);
        setting.hourlyRate = isNaN(val) ? 0 : Math.max(0, val);
        saveSettings();
        updateCardSubtotal(card, jobName);
        updateSummaryCard();
      });
    });

    // 4. Accordion Toggle
    listEl.querySelectorAll('.job-calc-accordion-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        const jobName = card.dataset.jobName;
        const accordion = card.querySelector('.job-calc-dates-accordion');
        const arrow = btn.querySelector('.job-calc-accordion-arrow');

        if (state.expandedJobs.has(jobName)) {
          state.expandedJobs.delete(jobName);
          accordion.classList.add('hidden');
          btn.classList.remove('active');
          if (arrow) arrow.textContent = 'expand_more';
        } else {
          state.expandedJobs.add(jobName);
          accordion.classList.remove('hidden');
          btn.classList.add('active');
          if (arrow) arrow.textContent = 'expand_less';
        }
      });
    });

    // 5. Per-date hour override
    listEl.querySelectorAll('.job-calc-occ-hours-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        const occRow = e.target.closest('.job-calc-occ-row');
        const jobName = card.dataset.jobName;
        const occKey = occRow.dataset.occKey;
        const setting = getJobSetting(jobName);

        const val = parseFloat(e.target.value);
        if (!setting.dateOverrides) setting.dateOverrides = {};

        if (isNaN(val)) {
          delete setting.dateOverrides[occKey];
        } else {
          setting.dateOverrides[occKey] = Math.max(0, val);
        }

        saveSettings();
        updateCardSubtotal(card, jobName);
        updateSummaryCard();

        // Refresh row reset icon
        const accordion = card.querySelector('.job-calc-dates-accordion');
        if (accordion && scannedJobs[jobName]) {
          accordion.innerHTML = renderJobOccurrencesHtml(scannedJobs[jobName], setting);
          bindCardEvents(listEl);
        }
      });
    });

    // 6. Reset override button
    listEl.querySelectorAll('.job-calc-occ-reset-btn').forEach((resetBtn) => {
      resetBtn.addEventListener('click', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        const occRow = e.target.closest('.job-calc-occ-row');
        const jobName = card.dataset.jobName;
        const occKey = occRow.dataset.occKey;
        const setting = getJobSetting(jobName);

        if (setting.dateOverrides) {
          delete setting.dateOverrides[occKey];
        }

        saveSettings();
        updateCardSubtotal(card, jobName);
        updateSummaryCard();

        const accordion = card.querySelector('.job-calc-dates-accordion');
        if (accordion && scannedJobs[jobName]) {
          accordion.innerHTML = renderJobOccurrencesHtml(scannedJobs[jobName], setting);
          bindCardEvents(listEl);
        }
      });
    });
  }

  function updateCardSubtotal(card, jobName) {
    const setting = getJobSetting(jobName);
    const job = scannedJobs[jobName];
    if (!job || !setting.isPaid) return;

    const defaultHours = parseFloat(setting.defaultHours) || 0;
    const rate = parseFloat(setting.hourlyRate) || 0;

    let hours = 0;
    job.occurrences.forEach((occ) => {
      const overrideVal = setting.dateOverrides?.[occ.occKey];
      hours += (typeof overrideVal === 'number' && !isNaN(overrideVal))
        ? overrideVal
        : defaultHours;
    });

    const subtotal = hours * rate;

    const amountEl = card.querySelector('.job-calc-subtotal-amount');
    const hoursEl = card.querySelector('.job-calc-subtotal-hours');
    if (amountEl) amountEl.textContent = `$${subtotal.toFixed(2)}`;
    if (hoursEl) hoursEl.textContent = `${hours.toFixed(1)} hrs`;
  }

  function updateSummaryCard() {
    const container = document.getElementById('job-calculator-container');
    if (!container) return;

    const {
      totalSessions,
      totalHours,
      grossEarnings,
      taxDeductionAmount,
      netTakeHome
    } = calculateTotals();

    // Metrics
    const sumSessions = container.querySelector('#job-calc-sum-sessions');
    const sumHours = container.querySelector('#job-calc-sum-hours');
    const sumGross = container.querySelector('#job-calc-sum-gross');
    const sumNet = container.querySelector('#job-calc-sum-net');
    const taxAmountEl = container.querySelector('#job-calc-tax-amount');
    const taxInput = container.querySelector('#job-calc-tax-input');
    const taxSymbol = container.querySelector('#job-calc-tax-symbol');
    const taxToggleWrap = container.querySelector('#job-calc-tax-mode-toggle');

    if (sumSessions) sumSessions.textContent = totalSessions;
    if (sumHours) sumHours.textContent = `${totalHours.toFixed(1)} hrs`;
    if (sumGross) sumGross.textContent = `$${grossEarnings.toFixed(2)}`;
    if (sumNet) sumNet.textContent = `$${netTakeHome.toFixed(2)}`;
    if (taxAmountEl) taxAmountEl.textContent = `-$${taxDeductionAmount.toFixed(2)}`;

    // Sync tax input & modes
    const taxSetting = state.settings.tax || { type: 'percent', value: 0 };
    if (taxInput && document.activeElement !== taxInput) {
      taxInput.value = taxSetting.value > 0 ? taxSetting.value : '';
    }
    if (taxSymbol) {
      taxSymbol.textContent = taxSetting.type === 'percent' ? '%' : '$';
    }
    if (taxToggleWrap) {
      taxToggleWrap.querySelectorAll('.job-calc-tax-mode-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.mode === taxSetting.type);
      });
    }
  }

  /* ==========================================================================
   * 8. Clipboard Summary Export
   * ========================================================================== */

  function handleCopySummary() {
    const {
      totalSessions,
      totalHours,
      grossEarnings,
      taxDeductionAmount,
      netTakeHome
    } = calculateTotals();

    const rangeStr = state.fromDate && state.toDate
      ? `${formatDisplayDate(parseIsoDate(state.fromDate))} — ${formatDisplayDate(parseIsoDate(state.toDate))}`
      : 'Selected Period';

    const paidJobs = Object.keys(scannedJobs).filter((name) => getJobSetting(name).isPaid);

    let text = `📋 WORK & EARNINGS BREAKDOWN\n`;
    text += `Period: ${rangeStr}\n`;
    text += `─────────────────────────────────────────\n`;

    if (paidJobs.length === 0) {
      text += `No paid jobs selected for this period.\n`;
    } else {
      paidJobs.forEach((name) => {
        const job = scannedJobs[name];
        const setting = getJobSetting(name);
        const defaultHours = parseFloat(setting.defaultHours) || 0;
        const rate = parseFloat(setting.hourlyRate) || 0;

        let hours = 0;
        job.occurrences.forEach((occ) => {
          const overrideVal = setting.dateOverrides?.[occ.occKey];
          hours += (typeof overrideVal === 'number' && !isNaN(overrideVal))
            ? overrideVal
            : defaultHours;
        });

        const subtotal = hours * rate;
        text += `• ${name}: ${job.occurrences.length} sessions · ${hours.toFixed(1)} hrs @ $${rate.toFixed(2)}/hr = $${subtotal.toFixed(2)}\n`;
      });
    }

    text += `─────────────────────────────────────────\n`;
    text += `Total Sessions : ${totalSessions}\n`;
    text += `Total Hours    : ${totalHours.toFixed(1)} hrs\n`;
    text += `Gross Earnings : $${grossEarnings.toFixed(2)}\n`;

    const taxSetting = state.settings.tax || { type: 'percent', value: 0 };
    if (taxSetting.value > 0) {
      const taxLabel = taxSetting.type === 'percent' ? `${taxSetting.value}%` : `$${taxSetting.value}`;
      text += `Tax Deduction  : -$${taxDeductionAmount.toFixed(2)} (${taxLabel})\n`;
    }

    text += `Net Take-Home  : $${netTakeHome.toFixed(2)}\n`;
    text += `─────────────────────────────────────────\n`;
    text += `Generated via Skhayeduler 🐷\n`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => showToastNotification('Breakdown copied to clipboard!'))
        .catch(() => fallbackCopyText(text));
    } else {
      fallbackCopyText(text);
    }
  }

  function fallbackCopyText(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showToastNotification('Breakdown copied to clipboard!');
    } catch (err) {
      console.warn('Fallback copy failed', err);
      alert('Could not copy to clipboard. Please copy manually:\n\n' + text);
    }
    document.body.removeChild(textArea);
  }

  function showToastNotification(msg) {
    if (typeof window.showToast === 'function') {
      window.showToast(msg);
      return;
    }
    const toast = document.createElement('div');
    toast.className = 'job-calc-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('visible'), 10);
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ==========================================================================
   * 9. View Toggle: Open & Close
   * ========================================================================== */

  function openJobCalculatorView() {
    loadSettings();
    ensureCalculatorDOM();

    // Preserve previous active view to seamlessly restore on back
    window.previousViewBeforeCalculator = window.currentActiveViewName || 'list';
    window.currentActiveViewName = 'job-calculator';

    // Hide calendar & other views
    const main = document.getElementById('main-container');
    const vert = document.getElementById('calendar-container-vert-view');
    const yearMap = document.getElementById('year-map-container');
    const todo = document.getElementById('todo-container');

    if (main) {
      main.style.display = 'none';
      main.classList.add('view-inactive');
    }
    if (vert) vert.style.display = 'none';
    if (typeof closeYearMap === 'function') closeYearMap();
    else if (yearMap) yearMap.style.display = 'none';
    if (todo) todo.classList.remove('active');
    if (typeof pauseWeatherTicker === 'function') pauseWeatherTicker();

    // Compute active date range if not set
    if (!state.fromDate || !state.toDate) {
      const defaultRange = computePresetRange(state.activePreset || 'this-month');
      if (defaultRange) {
        state.fromDate = defaultRange.from;
        state.toDate = defaultRange.to;
      }
    }

    scanTasksInRange();
    renderAll();

    const container = document.getElementById('job-calculator-container');
    if (container) {
      container.style.display = 'flex';
      container.scrollTop = 0;
    }

    state.isOpen = true;
  }

  function closeJobCalculatorView() {
    const container = document.getElementById('job-calculator-container');
    if (container) {
      container.style.display = 'none';
    }

    state.isOpen = false;

    // Restore previous active view
    const prev = window.previousViewBeforeCalculator || 'list';

    if (prev === 'month') {
      if (typeof showCalVertView === 'function') {
        const m = (typeof currentMonthVertView !== 'undefined' && currentMonthVertView !== null) ? currentMonthVertView : new Date().getMonth();
        const y = (typeof currentYearVertView !== 'undefined' && currentYearVertView !== null) ? currentYearVertView : new Date().getFullYear();
        showCalVertView(m, y);
      }
    } else if (prev === 'year') {
      if (typeof openYearMap === 'function') {
        const y = (typeof currentYearValue !== 'undefined' && currentYearValue !== null) ? currentYearValue : new Date().getFullYear();
        const m = (typeof currentMonthValue !== 'undefined' && currentMonthValue !== null) ? currentMonthValue : new Date().getMonth();
        openYearMap(y, m);
      }
    } else if (prev === 'todo') {
      if (typeof openTodoView === 'function') {
        openTodoView();
      }
    } else {
      // Default: List View
      const main = document.getElementById('main-container');
      if (main) {
        main.style.display = '';
        main.classList.remove('view-inactive');
      }
      window.currentActiveViewName = 'list';
      if (typeof resumeWeatherTicker === 'function') {
        resumeWeatherTicker();
      }
    }
  }

  /* ==========================================================================
   * 10. Initialization & Global Export
   * ========================================================================== */

  function initTriggerButton() {
    const btn = document.getElementById('job-calculator-btn');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openJobCalculatorView();
      });
    }

    // Escape key closes calculator view safely
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.isOpen) {
        closeJobCalculatorView();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTriggerButton);
  } else {
    initTriggerButton();
  }

  // Global exports for universal caller capability
  window.openJobCalculatorView = openJobCalculatorView;
  window.closeJobCalculatorView = closeJobCalculatorView;

})();
