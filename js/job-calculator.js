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
      jobs: {},
      customJobs: [],
      customExpenses: []
      /**
       * "Job Name": {
       *    isPaid: boolean,
       *    isExpense: boolean,
       *    expenseAmount: number,
       *    defaultHours: number,
       *    hourlyRate: number,
       *    isTaxable: boolean,
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
          // Only load categorized tasks into memory (prunes any legacy ghost entries)
          const loadedJobs = {};
          if (parsed.jobs && typeof parsed.jobs === 'object') {
            for (const [name, job] of Object.entries(parsed.jobs)) {
              if (job && (job.isPaid === true || job.isExpense === true)) {
                loadedJobs[name] = job;
              }
            }
          }

          state.settings = {
            tax: {
              type: parsed.tax?.type === 'amount' ? 'amount' : 'percent',
              value: typeof parsed.tax?.value === 'number' ? parsed.tax.value : (parseFloat(parsed.tax?.value) || 0)
            },
            jobs: loadedJobs,
            customJobs: Array.isArray(parsed.customJobs) ? parsed.customJobs : [],
            customExpenses: Array.isArray(parsed.customExpenses) ? parsed.customExpenses : []
          };
        }
      }
    } catch (e) {
      console.warn('[JobCalculator] Failed to load settings from localStorage:', e);
    }
  }

  function getCleanSettingsForStorage() {
    const cleanJobs = {};
    const jobs = state.settings.jobs || {};

    for (const [name, job] of Object.entries(jobs)) {
      if (!job) continue;
      const isPaid = job.isPaid === true;
      const isExpense = job.isExpense === true;

      // Zero-Waste: Only serialize tasks the user actively categorized as Earnings or Expense
      if (isPaid || isExpense) {
        const cleanJob = {
          isPaid,
          isExpense
        };

        if (isPaid) {
          cleanJob.defaultHours = typeof job.defaultHours === 'number' ? job.defaultHours : 4;
          cleanJob.hourlyRate = typeof job.hourlyRate === 'number' ? job.hourlyRate : 25;
          cleanJob.isTaxable = job.isTaxable !== false;

          // Preserve split mode allocation if in split mode
          if (job.adjustMode === 'split') {
            cleanJob.adjustMode = 'split';
            if (Array.isArray(job.splits)) {
              const validSplits = job.splits
                .map((s) => ({
                  shifts: parseInt(s.shifts, 10) || 0,
                  hours: parseFloat(s.hours) || 0
                }))
                .filter((s) => s.shifts > 0);
              if (validSplits.length > 0) {
                cleanJob.splits = validSplits;
              }
            }
          }

          // Only store date overrides if they actually differ from the job's default hours
          if (job.dateOverrides && typeof job.dateOverrides === 'object') {
            const validOverrides = {};
            for (const [key, val] of Object.entries(job.dateOverrides)) {
              if (typeof val === 'number' && !isNaN(val) && val !== cleanJob.defaultHours) {
                validOverrides[key] = val;
              }
            }
            if (Object.keys(validOverrides).length > 0) {
              cleanJob.dateOverrides = validOverrides;
            }
          }
        }

        if (isExpense) {
          cleanJob.expenseAmount = typeof job.expenseAmount === 'number' ? job.expenseAmount : 0;

          // Only store expense overrides if they actually differ from the default expense amount
          if (job.expenseOverrides && typeof job.expenseOverrides === 'object') {
            const validExpOverrides = {};
            for (const [key, val] of Object.entries(job.expenseOverrides)) {
              if (typeof val === 'number' && !isNaN(val) && val !== cleanJob.expenseAmount) {
                validExpOverrides[key] = val;
              }
            }
            if (Object.keys(validExpOverrides).length > 0) {
              cleanJob.expenseOverrides = validExpOverrides;
            }
          }
        }

        cleanJobs[name] = cleanJob;
      }
    }

    return {
      tax: {
        type: state.settings.tax?.type === 'amount' ? 'amount' : 'percent',
        value: typeof state.settings.tax?.value === 'number' ? state.settings.tax.value : (parseFloat(state.settings.tax?.value) || 0)
      },
      jobs: cleanJobs,
      customJobs: Array.isArray(state.settings.customJobs) ? state.settings.customJobs : [],
      customExpenses: Array.isArray(state.settings.customExpenses) ? state.settings.customExpenses : []
    };
  }

  function saveSettings() {
    try {
      const payload = getCleanSettingsForStorage();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('[JobCalculator] Failed to save settings to localStorage:', e);
    }
  }

  function getJobSetting(jobName) {
    if (!state.settings.jobs[jobName]) {
      state.settings.jobs[jobName] = {
        isPaid: false,
        isExpense: false,
        expenseAmount: 0,
        defaultHours: 4,
        hourlyRate: 25,
        isTaxable: true,
        adjustMode: 'date',
        splits: [],
        dateOverrides: {},
        expenseOverrides: {}
      };
    } else {
      if (state.settings.jobs[jobName].isTaxable === undefined) {
        state.settings.jobs[jobName].isTaxable = true;
      }
      if (state.settings.jobs[jobName].isExpense === undefined) {
        state.settings.jobs[jobName].isExpense = false;
      }
      if (state.settings.jobs[jobName].expenseAmount === undefined) {
        state.settings.jobs[jobName].expenseAmount = 0;
      }
      if (!state.settings.jobs[jobName].adjustMode) {
        state.settings.jobs[jobName].adjustMode = 'date';
      }
      if (!Array.isArray(state.settings.jobs[jobName].splits)) {
        state.settings.jobs[jobName].splits = [];
      }
      if (!state.settings.jobs[jobName].dateOverrides) {
        state.settings.jobs[jobName].dateOverrides = {};
      }
      if (!state.settings.jobs[jobName].expenseOverrides) {
        state.settings.jobs[jobName].expenseOverrides = {};
      }
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
    const roundCents = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

    let totalSessions = 0;
    let totalHours = 0;
    let grossEarnings = 0;
    let taxableEarnings = 0;
    let totalExpenses = 0;

    const jobResults = {};

    Object.keys(scannedJobs).forEach((name) => {
      const job = scannedJobs[name];
      const setting = getJobSetting(name);

      let jobHours = 0;
      let jobSubtotal = 0;
      const count = job.occurrences.length;
      let jobSessions = count;

      if (setting.isPaid) {
        const defaultHours = parseFloat(setting.defaultHours) || 0;
        const rate = parseFloat(setting.hourlyRate) || 0;

        if (setting.adjustMode === 'split' && Array.isArray(setting.splits) && setting.splits.length > 0) {
          jobSessions = 0;
          setting.splits.forEach((s) => {
            const sCount = parseInt(s.shifts, 10) || 0;
            const sHours = parseFloat(s.hours) || 0;
            jobHours += (sCount * sHours);
            jobSessions += sCount;
          });
        } else {
          job.occurrences.forEach((occ) => {
            const overrideVal = setting.dateOverrides?.[occ.occKey];
            const occHours = (typeof overrideVal === 'number' && !isNaN(overrideVal))
              ? overrideVal
              : defaultHours;

            jobHours += occHours;
          });
        }

        jobSubtotal = roundCents(jobHours * rate);

        totalSessions += jobSessions;
        totalHours += jobHours;
        grossEarnings += jobSubtotal;

        if (setting.isTaxable !== false) {
          taxableEarnings += jobSubtotal;
        }
      }

      // Check if calendar task is marked as an Expense
      let jobExpenseTotal = 0;
      if (setting.isExpense) {
        const defaultExpAmt = parseFloat(setting.expenseAmount) || 0;
        job.occurrences.forEach((occ) => {
          const overrideVal = setting.expenseOverrides?.[occ.occKey];
          const occExp = (typeof overrideVal === 'number' && !isNaN(overrideVal))
            ? overrideVal
            : defaultExpAmt;

          jobExpenseTotal += occExp;
        });

        jobExpenseTotal = roundCents(jobExpenseTotal);
        totalExpenses += jobExpenseTotal;
      }

      jobResults[name] = {
        isPaid: setting.isPaid === true,
        isExpense: setting.isExpense === true,
        expenseAmount: parseFloat(setting.expenseAmount) || 0,
        expenseTotal: jobExpenseTotal,
        isTaxable: setting.isTaxable !== false,
        count: (setting.isPaid && setting.adjustMode === 'split') ? jobSessions : count,
        totalHours: jobHours,
        subtotal: jobSubtotal
      };
    });

    // Custom / Off-calendar jobs
    const customResults = {};
    (state.settings.customJobs || []).forEach((cJob) => {
      if (cJob.isPaid !== false) {
        const rate = parseFloat(cJob.hourlyRate) || 0;
        let count = 0;
        let totalCustomHours = 0;

        if (Array.isArray(cJob.splits) && cJob.splits.length > 0) {
          cJob.splits.forEach((s) => {
            const sCount = parseInt(s.shifts, 10) || 0;
            const sHours = parseFloat(s.hours) || 0;
            totalCustomHours += (sCount * sHours);
            count += sCount;
          });
        } else {
          count = parseInt(cJob.shiftsCount, 10) || 1;
          const hoursPerShift = parseFloat(cJob.hoursPerShift) || 0;
          totalCustomHours = count * hoursPerShift;
        }

        const customSubtotal = roundCents(totalCustomHours * rate);
        const isTaxable = cJob.isTaxable === true; // Default false for custom jobs

        totalSessions += count;
        totalHours += totalCustomHours;
        grossEarnings += customSubtotal;

        if (isTaxable) {
          taxableEarnings += customSubtotal;
        }

        customResults[cJob.id] = {
          id: cJob.id,
          name: cJob.name || 'Untitled',
          count: count,
          totalHours: totalCustomHours,
          hourlyRate: rate,
          isTaxable: isTaxable,
          subtotal: customSubtotal
        };
      }
    });

    // Custom / Off-calendar expenses
    const customExpenseResults = {};
    (state.settings.customExpenses || []).forEach((cExp) => {
      const amt = roundCents(parseFloat(cExp.amount) || 0);
      totalExpenses += amt;
      customExpenseResults[cExp.id] = {
        id: cExp.id,
        name: cExp.name || 'Expense',
        amount: amt
      };
    });

    // Tax calculation based on TAXABLE earnings
    const taxSetting = state.settings.tax || { type: 'percent', value: 0 };
    const taxVal = parseFloat(taxSetting.value) || 0;
    let taxDeductionAmount = 0;

    if (taxVal > 0) {
      if (taxSetting.type === 'percent') {
        if (taxableEarnings > 0) {
          taxDeductionAmount = roundCents((taxableEarnings * taxVal) / 100);
        }
      } else {
        taxDeductionAmount = Math.min(taxableEarnings, roundCents(taxVal));
      }
      taxDeductionAmount = Math.min(taxableEarnings, Math.max(0, taxDeductionAmount));
    }

    grossEarnings = roundCents(grossEarnings);
    taxableEarnings = roundCents(taxableEarnings);
    totalExpenses = roundCents(totalExpenses);

    // Net Take-Home: Gross - Tax Deduction - Total Expenses
    const netTakeHome = Math.max(0, roundCents(grossEarnings - taxDeductionAmount - totalExpenses));

    return {
      totalSessions,
      totalHours,
      grossEarnings,
      taxableEarnings,
      taxDeductionAmount,
      totalExpenses,
      netTakeHome,
      jobResults,
      customResults,
      customExpenseResults
    };
  }

  /* ==========================================================================
   * 5. Lazy DOM Creation & Injection
   * ========================================================================== */

  function ensureCalculatorDOM() {
    const existing = document.getElementById('job-calculator-container');
    if (state.injected && existing && existing.querySelector('#job-calc-receipt-wrapper') && !existing.querySelector('#receipt-btn-print') && existing.innerHTML.includes('PAYSLIP') && !existing.innerHTML.includes('Paid Jobs (') && existing.innerHTML.includes('Earnings (') && existing.innerHTML.includes('Schedules') && existing.querySelector('.job-calc-btn-close') && existing.innerHTML.includes('job-calc-tax-field') && existing.querySelector('#job-calc-jobs-card') && existing.querySelector('#job-calc-add-custom-btn') && existing.querySelector('#job-calc-tab-expenses') && existing.querySelector('#job-calc-expense-summary-row') && existing.querySelector('#receipt-expenses-section') && existing.innerHTML.includes('Financial Summary')) {
      return;
    }

    if (existing) {
      existing.remove();
      state.injected = false;
    }

    const container = document.createElement('div');
    container.id = 'job-calculator-container';
    container.className = 'job-calculator-view';
    container.style.display = 'none';

    container.innerHTML = `
      <!-- Sticky Header -->
      <header class="job-calc-header">
        <div class="job-calc-header-left">
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
        <button type="button" class="job-calc-btn-close" id="job-calc-btn-back" title="Close (Back to Calendar)">
          <span class="material-symbols-outlined">close</span>
        </button>
      </header>

      <!-- Scrollable Main Content -->
      <div class="job-calc-body">
        
        <!-- 1. Date Range Filter Card -->
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

        <!-- 2. Schedules Card (Containerized Work Section) -->
        <section class="job-calc-card job-calc-jobs-card" id="job-calc-jobs-card">
          <div class="job-calc-card-header job-calc-jobs-header">
            <div class="job-calc-header-title-wrap">
              <span class="material-symbols-outlined job-calc-card-icon">calendar_today</span>
              <span class="job-calc-card-title">Schedules</span>
            </div>
            <button type="button" class="job-calc-add-custom-btn" id="job-calc-add-custom-btn" title="Add off-calendar earnings or expense">
              <span class="material-symbols-outlined">add</span>
              <span>Add Custom</span>
            </button>
          </div>

          <!-- Controls / Filter Tabs -->
          <div class="job-calc-controls-bar">
            <div class="job-calc-tabs">
              <button type="button" class="job-calc-tab active" data-tab="paid" id="job-calc-tab-paid">
                <span>Earnings (<span id="job-calc-count-paid">0</span>)</span>
              </button>
              <button type="button" class="job-calc-tab" data-tab="expenses" id="job-calc-tab-expenses">
                <span>Expenses (<span id="job-calc-count-expenses">0</span>)</span>
              </button>
              <button type="button" class="job-calc-tab" data-tab="all" id="job-calc-tab-all">
                <span>All (<span id="job-calc-count-all">0</span>)</span>
              </button>
            </div>
            <div class="job-calc-search-box">
              <span class="material-symbols-outlined job-calc-search-icon">search</span>
              <input type="text" id="job-calc-search-input" placeholder="Search..." autocomplete="off">
              <button type="button" class="job-calc-search-clear" id="job-calc-search-clear" style="display: none;">✕</button>
            </div>
          </div>

          <!-- Tasks List Container -->
          <div class="job-calc-tasks-list" id="job-calc-tasks-list">
            <!-- Injected dynamically -->
          </div>
        </section>

        <!-- 3. Financial Summary & Tax Deduction Card -->
        <section class="job-calc-card job-calc-summary-card" id="job-calc-summary-card">
          <div class="job-calc-card-header">
            <span class="material-symbols-outlined job-calc-card-icon">receipt_long</span>
            <span class="job-calc-card-title">Financial Summary</span>
          </div>

          <div class="job-calc-summary-metrics">
            <div class="job-calc-metric">
              <span class="job-calc-metric-label">Earning Shifts</span>
              <span class="job-calc-metric-val" id="job-calc-sum-sessions">0x</span>
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
                <div class="job-calc-tax-field mode-percent" id="job-calc-tax-field">
                  <span class="job-calc-tax-symbol-prefix" id="job-calc-tax-symbol-prefix" style="display: none;">$</span>
                  <input type="number" id="job-calc-tax-input" class="job-calc-num-input job-calc-tax-val-input" min="0" step="1" placeholder="0">
                  <span class="job-calc-tax-symbol-suffix" id="job-calc-tax-symbol-suffix">%</span>
                </div>
                <span class="job-calc-tax-deduction-amount" id="job-calc-tax-amount">-$0.00</span>
              </div>
            </div>

            <!-- Expenses Row (Included only when expenses exist) -->
            <div class="job-calc-summary-row" id="job-calc-expense-summary-row" style="display: none;">
              <span class="job-calc-row-title">Expenses</span>
              <span class="job-calc-expense-amount" id="job-calc-sum-expenses">-$0.00</span>
            </div>

            <div class="job-calc-divider"></div>

            <!-- Net Take-Home Row -->
            <div class="job-calc-summary-row job-calc-net-row">
              <div class="job-calc-net-label-wrap">
                <span class="job-calc-net-label">Net Take-Home Pay</span>
                <span class="job-calc-net-sublabel">After tax & expenses</span>
              </div>
              <span class="job-calc-net-val" id="job-calc-sum-net">$0.00</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="job-calc-actions-row">
            <button type="button" class="job-calc-action-btn job-calc-btn-view-receipt" id="job-calc-btn-view-receipt" title="View Breakdown Ticket">
              <span class="material-symbols-outlined">receipt_long</span>
              <span>View Breakdown</span>
            </button>
          </div>
        </section>

        <!-- Retro "Receipt Ticket" Section (Swapped when user clicks View Breakdown) -->
        <section class="job-calc-receipt-wrapper" id="job-calc-receipt-wrapper" style="display: none;">
          <div class="job-calc-receipt-ticket" id="job-calc-receipt-ticket">
            <!-- Top-Right Actions: Subtle Copy button -->
            <div class="receipt-top-actions">
              <button type="button" class="receipt-action-btn receipt-btn-copy" id="receipt-btn-copy" title="Copy breakdown ticket">
                <span class="material-symbols-outlined">content_copy</span>
                <span class="receipt-action-btn-text">Copy</span>
              </button>
            </div>

            <!-- Jagged Top Tear Edge -->
            <div class="receipt-edge receipt-edge-top"></div>

            <div class="receipt-inner">
              <!-- Header -->
              <div class="receipt-header">
                <div class="receipt-brand">PAYSLIP</div>
                <div class="receipt-badge">★ SHIFT BREAKDOWN ★</div>
                <div class="receipt-meta">
                  <div class="receipt-meta-row">
                    <span>PERIOD:</span>
                    <span id="receipt-date-range">Selected Period</span>
                  </div>
                </div>
              </div>

              <div class="receipt-divider-dash"></div>

              <!-- Calendar Shifts -->
              <div class="receipt-section" id="receipt-shifts-section">
                <div class="receipt-section-header">
                  <span>CALENDAR SHIFTS & WORK</span>
                  <span id="receipt-shifts-count">0x</span>
                </div>
                <div class="receipt-items-list" id="receipt-shifts-list">
                  <!-- Dynamic shift lines -->
                </div>
                <div class="receipt-subtotal-row">
                  <span>SHIFTS TOTAL (<span id="receipt-shifts-hours">0.0h</span>)</span>
                  <span id="receipt-shifts-subtotal">$0.00</span>
                </div>
              </div>

              <div class="receipt-divider-dash"></div>

              <!-- Gross Earnings -->
              <div class="receipt-gross-row">
                <span>GROSS EARNINGS</span>
                <span id="receipt-gross-amount">$0.00</span>
              </div>

              <!-- Expenses (if any) -->
              <div class="receipt-section" id="receipt-expenses-section" style="display: none;">
                <div class="receipt-divider-dash"></div>
                <div class="receipt-section-header">
                  <span>EXPENSES</span>
                  <span id="receipt-expenses-count">0x</span>
                </div>
                <div class="receipt-items-list" id="receipt-expenses-list">
                  <!-- Dynamic expense lines -->
                </div>
                <div class="receipt-subtotal-row">
                  <span>EXPENSES TOTAL</span>
                  <span class="receipt-item-deduction" id="receipt-expenses-subtotal">-$0.00</span>
                </div>
              </div>

              <!-- Tax Deduction (if any) -->
              <div class="receipt-section" id="receipt-tax-section" style="display: none;">
                <div class="receipt-divider-dash"></div>
                <div class="receipt-item-row">
                  <div class="receipt-item-title-col">
                    <span class="receipt-item-name">Total Tax Deduction</span>
                    <span class="receipt-item-detail" id="receipt-tax-detail">(0%)</span>
                  </div>
                  <span class="receipt-item-amount receipt-item-deduction" id="receipt-tax-amount">-$0.00</span>
                </div>
              </div>

              <div class="receipt-divider-double"></div>

              <!-- Net Take-Home (Hero Row) -->
              <div class="receipt-net-row">
                <div class="receipt-net-label-col">
                  <span class="receipt-net-main-label">NET TAKE-HOME</span>
                  <span class="receipt-net-sublabel">Total pocket earnings</span>
                </div>
                <span class="receipt-net-amount" id="receipt-net-amount">$0.00</span>
              </div>

              <div class="receipt-divider-double"></div>

              <!-- Footer -->
              <div class="receipt-footer">
                <div class="receipt-barcode">||| |||| || ||||||| ||| ||||| |||| |||</div>
                <div class="receipt-footer-msg">THANK YOU FOR YOUR HARD WORK!</div>
                <div class="receipt-footer-sub">EVERY SHIFT ADDS UP 🐷</div>
              </div>
            </div>

            <!-- Jagged Bottom Tear Edge -->
            <div class="receipt-edge receipt-edge-bottom"></div>
          </div>

          <!-- Actions Row Below Ticket -->
          <div class="job-calc-actions-row">
            <button type="button" class="job-calc-action-btn job-calc-btn-back-summary" id="job-calc-btn-back-summary" title="Back to Financial Summary">
              <span class="material-symbols-outlined">arrow_back</span>
              <span>View Summary</span>
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
      let fromVal = fromInput?.value;
      let toVal = toInput?.value;
      if (fromVal && toVal) {
        if (fromVal > toVal) {
          const tmp = fromVal;
          fromVal = toVal;
          toVal = tmp;
          if (fromInput) fromInput.value = fromVal;
          if (toInput) toInput.value = toVal;
        }
        state.fromDate = fromVal;
        state.toDate = toVal;
        state.activePreset = 'custom';
        presetsWrap?.querySelectorAll('.job-calc-pill').forEach((p) => p.classList.remove('active'));
        scanTasksInRange();
        renderAll();
      }
    };

    const triggerDatePicker = (input) => {
      if (!input) return;
      try {
        if (typeof input.showPicker === 'function') {
          input.showPicker();
        } else {
          input.focus();
        }
      } catch (err) {
        // Fallback for browsers or when already presenting picker
        input.focus();
      }
    };

    if (fromInput) {
      fromInput.addEventListener('change', handleCustomDateChange);
      fromInput.addEventListener('click', () => triggerDatePicker(fromInput));
    }
    if (toInput) {
      toInput.addEventListener('change', handleCustomDateChange);
      toInput.addEventListener('click', () => triggerDatePicker(toInput));
    }

    container.querySelectorAll('.job-calc-date-field').forEach((field) => {
      field.addEventListener('click', (e) => {
        const input = field.querySelector('.job-calc-date-picker');
        if (input && e.target !== input) {
          triggerDatePicker(input);
        }
      });
    });

    // Tabs (Paid, Expenses, All)
    const tabsWrap = container.querySelector('.job-calc-tabs');
    if (tabsWrap) {
      tabsWrap.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('.job-calc-tab');
        if (!tabBtn) return;
        const tabName = tabBtn.dataset.tab;
        if (!tabName || state.activeTab === tabName) return;

        state.activeTab = tabName;
        tabsWrap.querySelectorAll('.job-calc-tab').forEach((t) => {
          t.classList.toggle('active', t === tabBtn);
        });
        renderTasksList();
      });
    }

    // Add Custom Job or Expense Button
    const addCustomBtn = container.querySelector('#job-calc-add-custom-btn');
    if (addCustomBtn) {
      addCustomBtn.addEventListener('click', () => {
        if (state.activeTab === 'expenses') {
          handleAddCustomExpense();
        } else {
          handleAddCustomJob();
        }
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

    function syncTaxModeUI(mode) {
      const taxField = container.querySelector('#job-calc-tax-field');
      const prefix = container.querySelector('#job-calc-tax-symbol-prefix');
      const suffix = container.querySelector('#job-calc-tax-symbol-suffix');

      if (taxField) {
        taxField.classList.toggle('mode-percent', mode === 'percent');
        taxField.classList.toggle('mode-amount', mode === 'amount');
      }
      if (prefix) prefix.style.display = mode === 'amount' ? 'inline' : 'none';
      if (suffix) suffix.style.display = mode === 'percent' ? 'inline' : 'none';
    }

    if (taxToggleWrap) {
      taxToggleWrap.addEventListener('click', (e) => {
        const btn = e.target.closest('.job-calc-tax-mode-btn');
        if (!btn) return;
        const mode = btn.dataset.mode;
        state.settings.tax.type = mode;
        taxToggleWrap.querySelectorAll('.job-calc-tax-mode-btn').forEach((b) => {
          b.classList.toggle('active', b === btn);
        });
        syncTaxModeUI(mode);
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

      taxInput.addEventListener('blur', (e) => {
        if (e.target.value.trim() === '') {
          e.target.value = 0;
          state.settings.tax.value = 0;
          saveSettings();
          updateSummaryCard();
        }
      });
    }

    // View Receipt Button (Swaps Summary Card <-> Receipt Ticket)
    function swapToReceiptTicket() {
      const currentSummary = container.querySelector('#job-calc-summary-card') || container.querySelector('.job-calc-summary-card');
      const currentReceipt = container.querySelector('#job-calc-receipt-wrapper') || container.querySelector('.job-calc-receipt-wrapper');
      if (currentSummary) {
        currentSummary.style.display = 'none';
      }
      if (currentReceipt) {
        currentReceipt.style.display = 'flex';
        updateReceiptTicket();
        try {
          currentReceipt.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (_) {}
      }
    }

    function swapToBreakdownSummary() {
      const currentSummary = container.querySelector('#job-calc-summary-card') || container.querySelector('.job-calc-summary-card');
      const currentReceipt = container.querySelector('#job-calc-receipt-wrapper') || container.querySelector('.job-calc-receipt-wrapper');
      if (currentReceipt) {
        currentReceipt.style.display = 'none';
      }
      if (currentSummary) {
        currentSummary.style.display = '';
        try {
          currentSummary.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (_) {}
      }
    }

    // Direct event bindings
    const viewReceiptBtn = container.querySelector('#job-calc-btn-view-receipt');
    if (viewReceiptBtn) {
      viewReceiptBtn.addEventListener('click', swapToReceiptTicket);
    }

    const backSummaryBtn = container.querySelector('#job-calc-btn-back-summary');
    if (backSummaryBtn) {
      backSummaryBtn.addEventListener('click', swapToBreakdownSummary);
    }

    const receiptCopyBtn = container.querySelector('#receipt-btn-copy');
    if (receiptCopyBtn) {
      receiptCopyBtn.addEventListener('click', handleCopyReceipt);
    }

    // Delegated container click listener (catches clicks even if dynamic DOM shifts occur)
    container.addEventListener('click', (e) => {
      if (e.target.closest('#job-calc-btn-view-receipt, .job-calc-btn-view-receipt')) {
        swapToReceiptTicket();
      } else if (e.target.closest('#job-calc-btn-back-summary, .job-calc-btn-back-summary')) {
        swapToBreakdownSummary();
      } else if (e.target.closest('#receipt-btn-copy, .receipt-btn-copy')) {
        handleCopyReceipt();
      }
    });
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
   * 7. Rendering Logic & Custom Jobs Handling
   * ========================================================================== */

  function handleAddCustomJob() {
    const container = document.getElementById('job-calculator-container');
    if (!container) return;

    state.settings.customJobs = state.settings.customJobs || [];
    const newId = 'custom_' + Date.now();
    state.settings.customJobs.unshift({
      id: newId,
      name: 'Untitled',
      shiftsCount: 1,
      hoursPerShift: 4,
      hourlyRate: 25,
      isPaid: true,
      isTaxable: false,
      splits: [{ shifts: 1, hours: 4 }]
    });
    saveSettings();

    // If on All or Expenses tab, switch to Paid tab so user sees new card immediately
    if (state.activeTab !== 'paid') {
      state.activeTab = 'paid';
      const tabs = container.querySelectorAll('.job-calc-tab');
      tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === 'paid'));
    }

    renderTasksList();
    updateSummaryCard();

    // Focus on new job name input for instant typing
    const newCard = container.querySelector(`[data-custom-id="${newId}"]`);
    if (newCard) {
      const nameInput = newCard.querySelector('.job-calc-custom-name-input');
      if (nameInput) {
        nameInput.focus();
        nameInput.select();
      }
    }
  }

  function handleAddCustomExpense() {
    const container = document.getElementById('job-calculator-container');
    if (!container) return;

    state.settings.customExpenses = state.settings.customExpenses || [];
    const newId = 'exp_' + Date.now();
    state.settings.customExpenses.unshift({
      id: newId,
      name: 'Untitled',
      amount: 25
    });
    saveSettings();

    // If not on Expenses tab, switch to Expenses tab so user sees new card immediately
    if (state.activeTab !== 'expenses') {
      state.activeTab = 'expenses';
      const tabs = container.querySelectorAll('.job-calc-tab');
      tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === 'expenses'));
    }

    renderTasksList();
    updateSummaryCard();

    // Focus on new expense name input for instant typing
    const newCard = container.querySelector(`[data-expense-id="${newId}"]`);
    if (newCard) {
      const nameInput = newCard.querySelector('.job-calc-expense-name-input');
      if (nameInput) {
        nameInput.focus();
        nameInput.select();
      }
    }
  }

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
    const countExpensesEl = container.querySelector('#job-calc-count-expenses');

    if (!listEl) return;

    // Dynamically update the header button label based on active tab
    const addBtn = container.querySelector('#job-calc-add-custom-btn');
    if (addBtn) {
      if (state.activeTab === 'expenses') {
        addBtn.style.display = '';
        addBtn.classList.add('is-expense');
        addBtn.innerHTML = `<span class="material-symbols-outlined">add</span><span>Add Expenses</span>`;
        addBtn.title = 'Add custom expenses';
      } else if (state.activeTab === 'paid') {
        addBtn.style.display = '';
        addBtn.classList.remove('is-expense');
        addBtn.innerHTML = `<span class="material-symbols-outlined">add</span><span>Add Earnings</span>`;
        addBtn.title = 'Add off-calendar earnings';
      } else {
        // In 'all' tab, hide add custom button
        addBtn.style.display = 'none';
      }
    }

    const allNames = Object.keys(scannedJobs);
    const paidNames = allNames.filter((name) => getJobSetting(name).isPaid);
    const expenseNames = allNames.filter((name) => getJobSetting(name).isExpense);

    const customJobs = state.settings.customJobs || [];
    const paidCustomJobs = customJobs.filter((c) => c.isPaid !== false);

    const customExpenses = state.settings.customExpenses || [];

    if (countAllEl) countAllEl.textContent = allNames.length + customJobs.length + customExpenses.length;
    if (countPaidEl) countPaidEl.textContent = paidNames.length + paidCustomJobs.length;
    if (countExpensesEl) countExpensesEl.textContent = expenseNames.length + customExpenses.length;

    // Filter by tab
    let visibleNames = [];
    let visibleCustomJobs = [];
    let visibleCustomExpenses = [];

    if (state.activeTab === 'paid') {
      visibleNames = [...paidNames];
      visibleCustomJobs = [...paidCustomJobs];
      visibleCustomExpenses = [];
    } else if (state.activeTab === 'expenses') {
      visibleNames = [...expenseNames];
      visibleCustomJobs = [];
      visibleCustomExpenses = [...customExpenses];
    } else {
      // 'all'
      visibleNames = [...allNames];
      visibleCustomJobs = [...customJobs];
      visibleCustomExpenses = [...customExpenses];
    }

    // Filter by search
    if (state.searchQuery) {
      visibleNames = visibleNames.filter((name) =>
        name.toLowerCase().includes(state.searchQuery)
      );
      visibleCustomJobs = visibleCustomJobs.filter((c) =>
        (c.name || 'Untitled').toLowerCase().includes(state.searchQuery)
      );
      visibleCustomExpenses = visibleCustomExpenses.filter((e) =>
        (e.name || 'Untitled').toLowerCase().includes(state.searchQuery)
      );
    }

    // Sort calendar jobs: in All tab, triage items (Paid or Expense) first, then frequency
    visibleNames.sort((a, b) => {
      const setA = getJobSetting(a);
      const setB = getJobSetting(b);
      const scoredA = setA.isPaid ? 2 : (setA.isExpense ? 1 : 0);
      const scoredB = setB.isPaid ? 2 : (setB.isExpense ? 1 : 0);
      if (scoredA !== scoredB) return scoredB - scoredA;
      return scannedJobs[b].occurrences.length - scannedJobs[a].occurrences.length;
    });

    if (visibleNames.length === 0 && visibleCustomJobs.length === 0 && visibleCustomExpenses.length === 0) {
      const isPaidTab = state.activeTab === 'paid';
      const isExpTab = state.activeTab === 'expenses';

      listEl.innerHTML = `
        <div class="job-calc-empty-state">
          <span class="material-symbols-outlined job-calc-empty-icon">
            ${isPaidTab ? 'trending_up' : (isExpTab ? 'trending_down' : 'event_busy')}
          </span>
          <p class="job-calc-empty-title">
            ${
              state.searchQuery
                ? 'No matching items'
                : isPaidTab
                ? 'No Earnings Selected Yet'
                : isExpTab
                ? 'No Expenses Logged Yet'
                : 'No Tasks Found'
            }
          </p>
          <p class="job-calc-empty-text">
            ${
              state.searchQuery
                ? `No items match "<b>${escapeHtml(state.searchQuery)}</b>".`
                : isPaidTab
                ? `You haven't added any earnings to this calculation yet. Switch to "All" to categorize calendar tasks, or use "+ Add Earnings" above.`
                : isExpTab
                ? `Track work-related expenses (gas, supplies, tools) to deduct them from your net pay. Switch to "All" or use "+ Add Expenses" above.`
                : `No tasks found in the schedule between ${state.fromDate} and ${state.toDate}.`
            }
          </p>
          <div class="job-calc-empty-actions">
            ${
              (isPaidTab || isExpTab) && !state.searchQuery && allNames.length > 0
                ? `<button type="button" class="job-calc-empty-action-btn" id="job-calc-switch-to-all">
                     Browse All (${allNames.length}) →
                   </button>`
                : ''
            }
          </div>
        </div>
      `;

      const switchToAllBtn = listEl.querySelector('#job-calc-switch-to-all');
      if (switchToAllBtn) {
        switchToAllBtn.addEventListener('click', () => {
          state.activeTab = 'all';
          const tabs = container.querySelectorAll('.job-calc-tab');
          tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === 'all'));
          renderTasksList();
        });
      }

      return;
    }

    const { jobResults, customResults } = calculateTotals();

    let html = '';

    // 1. Render Custom Expenses (in Expenses or All tab)
    visibleCustomExpenses.forEach((cExp) => {
      const amt = parseFloat(cExp.amount) || 0;
      html += `
        <div class="job-calc-task-card job-calc-expense-card is-expense" data-expense-id="${escapeHtml(cExp.id)}">
          
          <!-- Card Header / Main Row -->
          <div class="job-calc-card-main">
            <!-- Delete Box -->
            <div class="job-calc-triage-wrap">
              <button type="button" 
                      class="job-calc-triage-btn is-expense job-calc-custom-expense-delete-box" 
                      data-action="delete-custom-expense" 
                      title="Remove custom expenses">
                <span class="material-symbols-outlined job-calc-triage-icon">delete</span>
              </button>
            </div>

            <div class="job-calc-color-indicator job-calc-expense-indicator" title="Custom Expenses"></div>

            <div class="job-calc-card-info">
              <div class="job-calc-title-row">
                <input type="text" class="job-calc-expense-name-input" value="${escapeHtml(cExp.name || 'Untitled')}" placeholder="Untitled">
              </div>
              <div class="job-calc-tagline">Expenses</div>
            </div>

            <!-- Subtotal Pill -->
            <div class="job-calc-subtotal-badge job-calc-expense-badge">
              <span class="job-calc-subtotal-amount">-$${amt.toFixed(2)}</span>
            </div>
          </div>

          <!-- Config Section -->
          <div class="job-calc-card-config">
            <div class="job-calc-inputs-row">
              <div class="job-calc-input-block" style="flex: 1;">
                <label>Cost ($)</label>
                <div class="job-calc-input-wrapper">
                  <span class="job-calc-prefix">$</span>
                  <input type="number" class="job-calc-expense-amount-input job-calc-num-input" min="0" step="0.5" value="${cExp.amount ?? 25}">
                </div>
              </div>
            </div>
          </div>

        </div>
      `;
    });

    // 2. Render Custom Jobs (in Paid or All tab)
    visibleCustomJobs.forEach((cJob) => {
      if (!Array.isArray(cJob.splits) || cJob.splits.length === 0) {
        cJob.splits = [{
          shifts: parseInt(cJob.shiftsCount, 10) || 1,
          hours: typeof cJob.hoursPerShift === 'number' ? cJob.hoursPerShift : 4
        }];
      }

      let customTotalShifts = 0;
      let customRowsHtml = `
        <div class="job-calc-split-headers-row">
          <span class="job-calc-split-col-header">Shifts</span>
          <span class="job-calc-split-col-header">Hours / Shift</span>
          <span class="job-calc-split-col-header">Rate ($/hr)</span>
        </div>
      `;
      const canDeleteCustomSplit = Array.isArray(cJob.splits) && cJob.splits.length > 1;

      cJob.splits.forEach((s, idx) => {
        const sShifts = parseInt(s.shifts, 10) || 0;
        customTotalShifts += sShifts;
        customRowsHtml += `
          <div class="job-calc-split-row-item ${canDeleteCustomSplit ? 'is-swipeable' : ''}" data-split-index="${idx}" title="${canDeleteCustomSplit ? 'Swipe left to delete this split row (or type 0 in shifts)' : ''}">
            ${canDeleteCustomSplit ? `
              <div class="job-calc-split-delete-action">
                <button type="button" 
                        class="job-calc-custom-split-delete-btn job-calc-split-delete-btn" 
                        data-split-index="${idx}" 
                        title="Delete split row" 
                        aria-label="Delete split row">
                  <span class="material-symbols-outlined">delete</span>
                </button>
              </div>
            ` : ''}
            <div class="job-calc-inputs-row job-calc-custom-inputs-row job-calc-split-row" data-split-index="${idx}">
              <div class="job-calc-input-block">
                <div class="job-calc-input-wrapper">
                  <input type="number" 
                         class="job-calc-custom-split-shifts-input job-calc-num-input" 
                         data-split-index="${idx}" 
                         min="0" 
                         step="1" 
                         value="${s.shifts}" 
                         aria-label="Shifts"
                         title="Enter shifts (swipe left or type 0 to remove this row)">
                  <span class="job-calc-unit">x</span>
                </div>
              </div>

              <div class="job-calc-input-block">
                <div class="job-calc-input-wrapper">
                  <input type="number" 
                         class="job-calc-custom-split-hours-input job-calc-num-input" 
                         data-split-index="${idx}" 
                         min="0" 
                         step="0.25" 
                         value="${s.hours}"
                         aria-label="Hours per shift">
                  <span class="job-calc-unit">hrs</span>
                </div>
              </div>

              <div class="job-calc-input-block">
                <div class="job-calc-input-wrapper">
                  <span class="job-calc-prefix">$</span>
                  <input type="number" 
                         class="job-calc-custom-rate-input job-calc-num-input" 
                         min="0" 
                         step="0.5" 
                         value="${cJob.hourlyRate ?? 25}" 
                         placeholder="25"
                         aria-label="Hourly rate">
                  <span class="job-calc-unit">/hr</span>
                </div>
              </div>
            </div>
          </div>
        `;
      });

      const cRes = customResults?.[cJob.id] || {
        totalHours: 0,
        subtotal: 0
      };

      html += `
        <div class="job-calc-task-card job-calc-custom-card is-paid" data-custom-id="${escapeHtml(cJob.id)}">
          
          <!-- Card Header / Main Row -->
          <div class="job-calc-card-main">
            <!-- Delete Box -->
            <div class="job-calc-triage-wrap">
              <button type="button" 
                      class="job-calc-triage-btn is-paid job-calc-custom-earnings-delete-box" 
                      data-action="delete-custom-job"
                      title="Remove custom earnings">
                <span class="material-symbols-outlined job-calc-triage-icon">delete</span>
              </button>
            </div>

            <div class="job-calc-color-indicator job-calc-custom-indicator" title="Custom Earnings"></div>

            <div class="job-calc-card-info">
              <div class="job-calc-title-row">
                <input type="text" class="job-calc-custom-name-input" value="${escapeHtml(cJob.name || 'Untitled')}" placeholder="Untitled">
                <span class="job-calc-session-badge">${customTotalShifts}x</span>
              </div>
              <label class="job-calc-taxable-check-row" title="${cJob.isTaxable === true ? 'Subject to tax deduction' : 'Untaxed earnings'}">
                <input type="checkbox" class="job-calc-custom-taxable-checkbox" ${cJob.isTaxable === true ? 'checked' : ''}>
                <span class="job-calc-taxable-check-box"></span>
                <span class="job-calc-taxable-check-text">Taxable</span>
              </label>
            </div>

            <!-- Subtotal Pill -->
            <div class="job-calc-subtotal-badge">
              <span class="job-calc-subtotal-amount">$${cRes.subtotal.toFixed(2)}</span>
              <span class="job-calc-subtotal-hours">${cRes.totalHours.toFixed(1)} hrs</span>
            </div>
          </div>

          <!-- Config Section -->
          <div class="job-calc-card-config">
            <div class="job-calc-groups-wrap">
              ${customRowsHtml}
            </div>

            <!-- Add Split Button for Custom Earnings -->
            <div class="job-calc-adjust-bar is-split-mode">
              <div class="job-calc-split-bar-left">
                <button type="button" class="job-calc-add-custom-split-btn job-calc-add-split-btn" title="Add another shift split row">
                  <span class="material-symbols-outlined">add</span>
                  <span>Add Split</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      `;
    });

    // 3. Render Calendar Scanned Jobs
    visibleNames.forEach((name) => {
      const job = scannedJobs[name];
      const setting = getJobSetting(name);
      const isPaid = setting.isPaid === true;
      const isExpense = setting.isExpense === true;
      const isMarked = isPaid || isExpense;
      const count = job.occurrences.length;
      const result = jobResults[name] || { totalHours: 0, subtotal: 0, expenseTotal: 0 };
      const isAccordionOpen = state.expandedJobs.has(name);
      const isSplitMode = isPaid && setting.adjustMode === 'split';
      let splitAllocated = 0;
      if (Array.isArray(setting.splits)) {
        setting.splits.forEach((s) => { splitAllocated += (parseInt(s.shifts, 10) || 0); });
      }
      const splitRemaining = count - splitAllocated;
      const displayCount = (isSplitMode && splitAllocated > 0) ? splitAllocated : count;

      let cardClass = 'job-calc-task-card';
      if (isPaid) cardClass += ' is-paid';
      else if (isExpense) cardClass += ' is-expense';
      else cardClass += ' is-unpaid';

      let tagline = 'Excluded';
      if (isPaid) tagline = 'Earnings';
      else if (isExpense) tagline = 'Expenses';

      const checkClass = isPaid ? 'is-paid' : (isExpense ? 'is-expense' : 'is-unmarked');
      const triageIcon = isPaid ? 'trending_up' : (isExpense ? 'trending_down' : 'add');

      html += `
        <div class="${cardClass}" data-job-name="${escapeHtml(name)}">
          
          <!-- Card Header / Main Row -->
          <div class="job-calc-card-main">
            <!-- Triage Checkbox with Popover Menu -->
            <div class="job-calc-triage-wrap">
              <button type="button" 
                      class="job-calc-triage-btn ${checkClass}" 
                      data-action="open-triage-menu" 
                      title="${isPaid ? 'Earnings (Click to change or exclude)' : (isExpense ? 'Expenses (Click to change or exclude)' : 'Categorize Task')}">
                <span class="material-symbols-outlined job-calc-triage-icon" style="font-size: 15px !important;">${triageIcon}</span>
              </button>

              <!-- Popover Menu -->
              <div class="job-calc-triage-popover hidden">
                <div class="job-calc-triage-popover-header">Categorize Task</div>
                <button type="button" class="job-calc-triage-option option-paid ${isPaid ? 'selected' : ''}" data-triage-type="paid">
                  <div class="job-calc-triage-option-icon"><span class="material-symbols-outlined">trending_up</span></div>
                  <span class="job-calc-triage-option-title">Earnings</span>
                  ${isPaid ? '<span class="material-symbols-outlined job-calc-option-check">check</span>' : ''}
                </button>
                <button type="button" class="job-calc-triage-option option-expense ${isExpense ? 'selected' : ''}" data-triage-type="expense">
                  <div class="job-calc-triage-option-icon"><span class="material-symbols-outlined">trending_down</span></div>
                  <span class="job-calc-triage-option-title">Expenses</span>
                  ${isExpense ? '<span class="material-symbols-outlined job-calc-option-check">check</span>' : ''}
                </button>
                ${isMarked ? `
                  <div class="job-calc-triage-popover-divider"></div>
                  <button type="button" class="job-calc-triage-option option-unmark" data-triage-type="unmark">
                    <div class="job-calc-triage-option-icon"><span class="material-symbols-outlined">cancel</span></div>
                    <span class="job-calc-triage-option-title">Exclude</span>
                  </button>
                ` : ''}
              </div>
            </div>

            <div class="job-calc-color-indicator" style="background-color: ${escapeHtml(job.color)};" title="Calendar Color"></div>

            <div class="job-calc-card-info">
              <div class="job-calc-title-row">
                <span class="job-calc-job-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
                <span class="job-calc-session-badge">${displayCount}x</span>
              </div>
              ${isPaid ? `
                <label class="job-calc-taxable-check-row" title="${setting.isTaxable !== false ? 'Subject to tax deduction' : 'Untaxed earnings'}">
                  <input type="checkbox" class="job-calc-taxable-checkbox" ${setting.isTaxable !== false ? 'checked' : ''}>
                  <span class="job-calc-taxable-check-box"></span>
                  <span class="job-calc-taxable-check-text">Taxable</span>
                </label>
              ` : `
                <div class="job-calc-tagline">
                  ${tagline}
                </div>
              `}
            </div>

            <!-- Subtotal Badge for Paid or Expense -->
            ${
              isPaid
                ? `<div class="job-calc-subtotal-badge">
                     <span class="job-calc-subtotal-amount">$${result.subtotal.toFixed(2)}</span>
                     <span class="job-calc-subtotal-hours">${result.totalHours.toFixed(1)} hrs</span>
                   </div>`
                : (isExpense
                ? `<div class="job-calc-subtotal-badge job-calc-expense-badge">
                     <span class="job-calc-subtotal-amount">-$${(result.expenseTotal || 0).toFixed(2)}</span>
                   </div>`
                : '')
            }
          </div>

          <!-- Config Section (Visible when Paid) -->
          ${
            isPaid ? `
              <div class="job-calc-card-config">
                <div class="job-calc-groups-wrap">
                  ${renderJobInputsHtml(name, job, setting)}
                </div>

                <!-- Adjust Bar: In Split Mode shows Add Split and By Date swapper (NO accordion) -->
                ${isSplitMode ? `
                  <div class="job-calc-adjust-bar is-split-mode">
                    <div class="job-calc-split-bar-left">
                      <button type="button" class="job-calc-add-split-btn" title="Add another split row">
                        <span class="material-symbols-outlined">add</span>
                        <span>Add Split</span>
                      </button>
                      <span class="job-calc-split-tag ${splitRemaining === 0 ? 'is-complete' : (splitRemaining > 0 ? 'is-pending' : 'is-over')}">
                        ${splitRemaining === 0 ? `${count} shifts ✔` : `${splitAllocated}/${count} shifts`}
                      </span>
                    </div>

                    <button type="button" 
                            class="job-calc-mode-swap-btn" 
                            data-mode="date" 
                            title="Switch back to individual calendar dates">
                      <span class="material-symbols-outlined">swap_horiz</span>
                      <span>By Date</span>
                    </button>
                  </div>
                ` : `
                  <div class="job-calc-adjust-bar">
                    <button type="button" class="job-calc-accordion-btn ${isAccordionOpen ? 'active' : ''}">
                      <span class="material-symbols-outlined job-calc-accordion-arrow">
                        ${isAccordionOpen ? 'expand_less' : 'expand_more'}
                      </span>
                      <span>Adjust Dates (${count})</span>
                    </button>

                    ${count > 1 ? `
                      <button type="button" 
                              class="job-calc-mode-swap-btn" 
                              data-mode="split" 
                              title="Switch to split shifts">
                        <span class="material-symbols-outlined">swap_horiz</span>
                        <span>Split</span>
                      </button>
                    ` : ''}
                  </div>

                  <!-- Accordion Dates List -->
                  <div class="job-calc-dates-accordion ${isAccordionOpen ? '' : 'hidden'}">
                    ${renderJobOccurrencesHtml(job, setting)}
                  </div>
                `}
              </div>
            ` : ''
          }

          <!-- Config Section (Visible when Expense) -->
          ${
            isExpense ? `
              <div class="job-calc-card-config">
                <div class="job-calc-groups-wrap">
                  ${renderExpenseInputsHtml(name, job, setting)}
                </div>

                <!-- Accordion Toggle Button -->
                <button type="button" class="job-calc-accordion-btn ${isAccordionOpen ? 'active' : ''}">
                  <span class="material-symbols-outlined job-calc-accordion-arrow">
                    ${isAccordionOpen ? 'expand_less' : 'expand_more'}
                  </span>
                  <span>Adjust Dates (${count})</span>
                </button>

                <!-- Accordion Dates List -->
                <div class="job-calc-dates-accordion ${isAccordionOpen ? '' : 'hidden'}">
                  ${renderExpenseOccurrencesHtml(job, setting)}
                </div>
              </div>
            ` : ''
          }

        </div>
      `;
    });

    listEl.innerHTML = html;
    bindCardEvents(listEl);
  }

  function getJobHoursGroups(job, setting) {
    const defaultHours = typeof setting.defaultHours === 'number' ? setting.defaultHours : 4;
    const groupsMap = new Map();

    (job.occurrences || []).forEach((occ) => {
      const hasOverride = typeof setting.dateOverrides?.[occ.occKey] === 'number';
      const hoursVal = hasOverride ? setting.dateOverrides[occ.occKey] : defaultHours;

      if (!groupsMap.has(hoursVal)) {
        groupsMap.set(hoursVal, {
          hours: hoursVal,
          count: 0,
          occKeys: [],
          isDefault: hoursVal === defaultHours
        });
      }
      const g = groupsMap.get(hoursVal);
      g.count += 1;
      g.occKeys.push(occ.occKey);
    });

    const groups = Array.from(groupsMap.values());
    groups.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.hours - a.hours;
    });

    return groups;
  }

  function renderJobInputsHtml(jobName, job, setting) {
    const hourlyRate = setting.hourlyRate ?? 25;

    // Split Mode: Render each split tier as a directly editable 3-column row
    if (setting.adjustMode === 'split') {
      const count = (job.occurrences || []).length;
      if (!Array.isArray(setting.splits) || setting.splits.length === 0) {
        setting.splits = [{ shifts: count > 0 ? count : 1, hours: setting.defaultHours ?? 4 }];
      }

      const canDeleteSplit = setting.splits.length > 1;
      let splitRowsHtml = `
        <div class="job-calc-split-headers-row">
          <span class="job-calc-split-col-header">Shifts</span>
          <span class="job-calc-split-col-header">Hours / Shift</span>
          <span class="job-calc-split-col-header">Rate ($/hr)</span>
        </div>
      `;

      setting.splits.forEach((s, idx) => {
        splitRowsHtml += `
          <div class="job-calc-split-row-item ${canDeleteSplit ? 'is-swipeable' : ''}" data-split-index="${idx}" title="${canDeleteSplit ? 'Swipe left to delete this split row (or type 0 in shifts)' : ''}">
            ${canDeleteSplit ? `
              <div class="job-calc-split-delete-action">
                <button type="button" 
                        class="job-calc-calendar-split-delete-btn job-calc-split-delete-btn" 
                        data-split-index="${idx}" 
                        title="Delete split row" 
                        aria-label="Delete split row">
                  <span class="material-symbols-outlined">delete</span>
                </button>
              </div>
            ` : ''}
            <div class="job-calc-inputs-row job-calc-custom-inputs-row job-calc-split-row" data-split-index="${idx}">
              <div class="job-calc-input-block">
                <div class="job-calc-input-wrapper">
                  <input type="number" 
                         class="job-calc-split-shifts-input job-calc-num-input" 
                         data-split-index="${idx}"
                         min="0" 
                         step="1" 
                         value="${s.shifts}" 
                         aria-label="Shifts"
                         title="Enter shifts (swipe left or type 0 to remove this row)">
                  <span class="job-calc-unit">x</span>
                </div>
              </div>

              <div class="job-calc-input-block">
                <div class="job-calc-input-wrapper">
                  <input type="number" 
                         class="job-calc-split-hours-input job-calc-num-input" 
                         data-split-index="${idx}"
                         min="0" 
                         step="0.25" 
                         value="${s.hours}"
                         aria-label="Hours per shift">
                  <span class="job-calc-unit">hrs</span>
                </div>
              </div>

              <div class="job-calc-input-block">
                <div class="job-calc-input-wrapper">
                  <span class="job-calc-prefix">$</span>
                  <input type="number" 
                         class="job-calc-rate-input job-calc-num-input" 
                         min="0" 
                         step="0.5" 
                         value="${hourlyRate}" 
                         placeholder="25"
                         aria-label="Hourly rate">
                  <span class="job-calc-unit">/hr</span>
                </div>
              </div>
            </div>
          </div>
        `;
      });

      return splitRowsHtml;
    }

    const groups = getJobHoursGroups(job, setting);

    // Happy case: all occurrences have the exact same hours (or zero occurrences)
    if (groups.length <= 1) {
      const defaultHours = groups.length === 1 ? groups[0].hours : (setting.defaultHours ?? 4);
      return `
        <div class="job-calc-inputs-row">
          <div class="job-calc-input-block">
            <label>Hours / Shift</label>
            <div class="job-calc-input-wrapper">
              <input type="number" class="job-calc-hours-input job-calc-num-input" min="0" step="0.25" value="${defaultHours}" placeholder="4">
              <span class="job-calc-unit">hrs</span>
            </div>
          </div>

          <div class="job-calc-input-block">
            <label>Rate ($/hr)</label>
            <div class="job-calc-input-wrapper">
              <span class="job-calc-prefix">$</span>
              <input type="number" class="job-calc-rate-input job-calc-num-input" min="0" step="0.5" value="${hourlyRate}" placeholder="25">
              <span class="job-calc-unit">/hr</span>
            </div>
          </div>
        </div>
      `;
    }

    // Customized dates case: multiple groups with different hours
    let rowsHtml = '';
    groups.forEach((g, idx) => {
      const showLabels = idx === 0;
      rowsHtml += `
        <div class="job-calc-inputs-row job-calc-custom-inputs-row job-calc-group-row" data-hours-group="${g.hours}">
          <div class="job-calc-input-block">
            ${showLabels ? '<label>Shifts</label>' : ''}
            <div class="job-calc-input-wrapper">
              <input type="number" class="job-calc-group-shifts-input job-calc-num-input" value="${g.count}" readonly tabindex="-1" style="cursor: default;" title="${g.count} shifts are ${g.hours} hrs" aria-label="Shifts">
              <span class="job-calc-unit">x</span>
            </div>
          </div>

          <div class="job-calc-input-block">
            ${showLabels ? '<label>Hours / Shift</label>' : ''}
            <div class="job-calc-input-wrapper">
              <input type="number" class="job-calc-group-hours-input job-calc-num-input" min="0" step="0.25" value="${g.hours}" data-original-hours="${g.hours}" aria-label="Hours per shift">
              <span class="job-calc-unit">hrs</span>
            </div>
          </div>

          <div class="job-calc-input-block">
            ${showLabels ? '<label>Rate ($/hr)</label>' : ''}
            <div class="job-calc-input-wrapper">
              <span class="job-calc-prefix">$</span>
              <input type="number" class="job-calc-rate-input job-calc-num-input" min="0" step="0.5" value="${hourlyRate}" placeholder="25" aria-label="Hourly rate">
              <span class="job-calc-unit">/hr</span>
            </div>
          </div>
        </div>
      `;
    });

    return rowsHtml;
  }

  function refreshCardGroups(card, jobName) {
    if (!card) return;
    const setting = getJobSetting(jobName);
    const job = scannedJobs[jobName];
    if (!job || !setting.isPaid) return;

    const wrap = card.querySelector('.job-calc-groups-wrap');
    if (!wrap) return;

    wrap.innerHTML = renderJobInputsHtml(jobName, job, setting);
    bindGroupInputs(card);
  }

  function bindGroupInputs(scope) {
    // 1. Single default hours input (Happy Case)
    scope.querySelectorAll('.job-calc-hours-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        const setting = getJobSetting(jobName);
        const val = parseFloat(e.target.value);
        const newDefault = isNaN(val) ? 0 : Math.max(0, val);
        setting.defaultHours = newDefault;
        if (setting.dateOverrides) {
          Object.keys(setting.dateOverrides).forEach((k) => delete setting.dateOverrides[k]);
        }
        saveSettings();

        // Update accordion date inputs
        card.querySelectorAll('.job-calc-occ-row').forEach((occRow) => {
          const occInput = occRow.querySelector('.job-calc-occ-hours-input');
          if (occInput) occInput.value = newDefault;
          const resetBtn = occRow.querySelector('.job-calc-occ-reset-btn');
          if (resetBtn) resetBtn.style.display = 'none';
        });

        updateCardSubtotal(card, jobName);
        updateSummaryCard();
      });

      input.addEventListener('blur', (e) => {
        if (e.target.value.trim() === '') {
          e.target.value = 0;
        }
      });
    });

    // 2. Grouped hours input (Multiple Different Hours)
    scope.querySelectorAll('.job-calc-group-hours-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        const job = scannedJobs[jobName];
        const setting = getJobSetting(jobName);
        if (!job || !setting) return;

        const origHours = parseFloat(input.dataset.originalHours);
        const rawVal = e.target.value.trim();
        const val = parseFloat(rawVal);
        const newHours = (rawVal === '' || isNaN(val)) ? 0 : Math.max(0, val);
        const defaultHours = typeof setting.defaultHours === 'number' ? setting.defaultHours : 4;

        let defaultUpdated = false;
        (job.occurrences || []).forEach((occ) => {
          const hasOverride = typeof setting.dateOverrides?.[occ.occKey] === 'number';
          const occHours = hasOverride ? setting.dateOverrides[occ.occKey] : defaultHours;

          if (occHours === origHours) {
            if (!hasOverride && !defaultUpdated) {
              setting.defaultHours = newHours;
              defaultUpdated = true;
            } else {
              if (!setting.dateOverrides) setting.dateOverrides = {};
              setting.dateOverrides[occ.occKey] = newHours;
            }

            const occRow = card.querySelector(`.job-calc-occ-row[data-occ-key="${occ.occKey}"]`);
            if (occRow) {
              const occInput = occRow.querySelector('.job-calc-occ-hours-input');
              if (occInput) occInput.value = newHours;
              const resetBtn = occRow.querySelector('.job-calc-occ-reset-btn');
              if (resetBtn) {
                resetBtn.style.display = (newHours !== (setting.defaultHours ?? 4)) ? '' : 'none';
              }
            }
          }
        });

        input.dataset.originalHours = newHours;
        saveSettings();
        updateCardSubtotal(card, jobName);
        updateSummaryCard();
      });

      input.addEventListener('blur', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        refreshCardGroups(card, jobName);
      });
    });

    // 3. Hourly rate inputs (keeps all rate inputs on the card in sync)
    scope.querySelectorAll('.job-calc-rate-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        const setting = getJobSetting(jobName);
        const val = parseFloat(e.target.value);
        setting.hourlyRate = isNaN(val) ? 0 : Math.max(0, val);
        saveSettings();
        card.querySelectorAll('.job-calc-rate-input').forEach((r) => {
          if (r !== e.target) r.value = e.target.value;
        });
        updateCardSubtotal(card, jobName);
        updateSummaryCard();
      });

      input.addEventListener('blur', (e) => {
        if (e.target.value.trim() === '') {
          e.target.value = 0;
        }
      });
    });
  }

  function getJobExpenseGroups(job, setting) {
    const defaultExp = typeof setting.expenseAmount === 'number' ? setting.expenseAmount : 0;
    const groupsMap = new Map();

    (job.occurrences || []).forEach((occ) => {
      const hasOverride = typeof setting.expenseOverrides?.[occ.occKey] === 'number';
      const expVal = hasOverride ? setting.expenseOverrides[occ.occKey] : defaultExp;

      if (!groupsMap.has(expVal)) {
        groupsMap.set(expVal, {
          amount: expVal,
          count: 0,
          occKeys: [],
          isDefault: expVal === defaultExp
        });
      }
      const g = groupsMap.get(expVal);
      g.count += 1;
      g.occKeys.push(occ.occKey);
    });

    const groups = Array.from(groupsMap.values());
    groups.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.amount - a.amount;
    });

    return groups;
  }

  function renderExpenseInputsHtml(jobName, job, setting) {
    const defaultExp = setting.expenseAmount ?? 0;
    const groups = getJobExpenseGroups(job, setting);

    // Happy case: all occurrences have the exact same cost (or zero occurrences)
    if (groups.length <= 1) {
      const amountVal = groups.length === 1 ? groups[0].amount : defaultExp;
      return `
        <div class="job-calc-inputs-row">
          <div class="job-calc-input-block" style="flex: 1; grid-column: 1 / -1;">
            <label>Cost / Occurrence ($)</label>
            <div class="job-calc-input-wrapper">
              <span class="job-calc-prefix">$</span>
              <input type="number" class="job-calc-calendar-expense-input job-calc-num-input" min="0" step="0.5" value="${amountVal}">
            </div>
          </div>
        </div>
      `;
    }

    // Customized dates case: multiple groups with different cost
    let rowsHtml = '';
    groups.forEach((g, idx) => {
      const showLabels = idx === 0;
      rowsHtml += `
        <div class="job-calc-inputs-row job-calc-group-row job-calc-expense-group-row" data-expense-group="${g.amount}">
          <div class="job-calc-input-block">
            ${showLabels ? '<label>Shifts</label>' : ''}
            <div class="job-calc-input-wrapper">
              <input type="number" class="job-calc-group-shifts-input job-calc-num-input" value="${g.count}" readonly tabindex="-1" style="cursor: default;" title="${g.count} shifts are $${g.amount.toFixed(2)}" aria-label="Shifts">
              <span class="job-calc-unit">x</span>
            </div>
          </div>

          <div class="job-calc-input-block">
            ${showLabels ? '<label>Cost / Occurrence ($)</label>' : ''}
            <div class="job-calc-input-wrapper">
              <span class="job-calc-prefix">$</span>
              <input type="number" class="job-calc-group-expense-input job-calc-num-input" min="0" step="0.5" value="${g.amount}" data-original-amount="${g.amount}" aria-label="Cost per occurrence">
            </div>
          </div>
        </div>
      `;
    });

    return rowsHtml;
  }

  function refreshExpenseCardGroups(card, jobName) {
    if (!card) return;
    const setting = getJobSetting(jobName);
    const job = scannedJobs[jobName];
    if (!job || !setting.isExpense) return;

    const wrap = card.querySelector('.job-calc-groups-wrap');
    if (!wrap) return;

    wrap.innerHTML = renderExpenseInputsHtml(jobName, job, setting);
    bindExpenseGroupInputs(card);
  }

  function bindExpenseGroupInputs(scope) {
    // 1. Single default expense input (Happy Case)
    scope.querySelectorAll('.job-calc-calendar-expense-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        const setting = getJobSetting(jobName);
        const val = parseFloat(e.target.value);
        const newExp = isNaN(val) ? 0 : Math.max(0, val);
        setting.expenseAmount = newExp;
        if (setting.expenseOverrides) {
          Object.keys(setting.expenseOverrides).forEach((k) => delete setting.expenseOverrides[k]);
        }
        saveSettings();

        // Update occurrence rows that don't have overrides
        card.querySelectorAll('.job-calc-occ-row').forEach((occRow) => {
          const occInput = occRow.querySelector('.job-calc-occ-expense-input');
          if (occInput) occInput.value = setting.expenseAmount;
          const resetBtn = occRow.querySelector('.job-calc-occ-expense-reset-btn');
          if (resetBtn) resetBtn.style.display = 'none';
        });

        updateCardExpenseBadge(card, jobName);
        updateSummaryCard();
      });

      input.addEventListener('blur', (e) => {
        if (e.target.value.trim() === '') {
          e.target.value = 0;
          const card = e.target.closest('.job-calc-task-card');
          if (!card) return;
          const jobName = card.dataset.jobName;
          const setting = getJobSetting(jobName);
          setting.expenseAmount = 0;
          saveSettings();
          updateCardExpenseBadge(card, jobName);
          updateSummaryCard();
        }
        const card = e.target.closest('.job-calc-task-card');
        if (card) {
          refreshExpenseCardGroups(card, card.dataset.jobName);
        }
      });
    });

    // 2. Grouped expense input (Multiple Different Expense Amounts)
    scope.querySelectorAll('.job-calc-group-expense-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        const job = scannedJobs[jobName];
        const setting = getJobSetting(jobName);
        if (!job || !setting) return;

        const origAmount = parseFloat(input.dataset.originalAmount);
        const rawVal = e.target.value.trim();
        const val = parseFloat(rawVal);
        const newAmount = (rawVal === '' || isNaN(val)) ? 0 : Math.max(0, val);
        const defaultExp = typeof setting.expenseAmount === 'number' ? setting.expenseAmount : 0;

        let defaultUpdated = false;
        (job.occurrences || []).forEach((occ) => {
          const hasOverride = typeof setting.expenseOverrides?.[occ.occKey] === 'number';
          const occExp = hasOverride ? setting.expenseOverrides[occ.occKey] : defaultExp;

          if (occExp === origAmount) {
            if (!hasOverride && !defaultUpdated) {
              setting.expenseAmount = newAmount;
              defaultUpdated = true;
            } else {
              if (!setting.expenseOverrides) setting.expenseOverrides = {};
              setting.expenseOverrides[occ.occKey] = newAmount;
            }

            const occRow = card.querySelector(`.job-calc-occ-row[data-occ-key="${occ.occKey}"]`);
            if (occRow) {
              const occInput = occRow.querySelector('.job-calc-occ-expense-input');
              if (occInput) occInput.value = newAmount;
              const resetBtn = occRow.querySelector('.job-calc-occ-expense-reset-btn');
              if (resetBtn) {
                resetBtn.style.display = (newAmount !== (setting.expenseAmount ?? 0)) ? '' : 'none';
              }
            }
          }
        });

        input.dataset.originalAmount = newAmount;
        saveSettings();
        updateCardExpenseBadge(card, jobName);
        updateSummaryCard();
      });

      input.addEventListener('blur', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        refreshExpenseCardGroups(card, jobName);
      });
    });
  }

  function renderExpenseOccurrencesHtml(job, setting) {
    const defaultExp = parseFloat(setting.expenseAmount) || 0;

    let rowsHtml = '';
    job.occurrences.forEach((occ) => {
      const hasOverride = typeof setting.expenseOverrides?.[occ.occKey] === 'number';
      const expVal = hasOverride ? setting.expenseOverrides[occ.occKey] : defaultExp;

      rowsHtml += `
        <div class="job-calc-occ-row" data-occ-key="${escapeHtml(occ.occKey)}">
          <div class="job-calc-occ-date-wrap">
            <span class="job-calc-occ-date">${formatDisplayDate(occ.dateObj)}</span>
            <span class="job-calc-occ-period job-calc-period-${escapeHtml(occ.period)}">
              ${getPeriodLabel(occ.period)}
            </span>
          </div>

          <div class="job-calc-occ-input-wrap">
            <div class="job-calc-occ-input-field">
              <span class="job-calc-occ-unit-prefix">$</span>
              <input type="number" class="job-calc-occ-expense-input job-calc-num-input" min="0" step="0.5" value="${expVal}">
            </div>
            <button type="button" class="job-calc-occ-expense-reset-btn" style="${hasOverride && expVal !== defaultExp ? '' : 'display: none;'}" title="Reset to default ($${defaultExp.toFixed(2)})">
              <span class="material-symbols-outlined">restart_alt</span>
            </button>
          </div>
        </div>
      `;
    });

    return rowsHtml;
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
            <div class="job-calc-occ-input-field">
              <input type="number" class="job-calc-occ-hours-input job-calc-num-input" min="0" step="0.25" value="${hoursVal}">
              <span class="job-calc-occ-unit">hrs</span>
            </div>
            <button type="button" class="job-calc-occ-reset-btn" style="${hasOverride && hoursVal !== defaultHours ? '' : 'display: none;'}" title="Reset to default (${defaultHours} hrs)">
              <span class="material-symbols-outlined">restart_alt</span>
            </button>
          </div>
        </div>
      `;
    });

    return rowsHtml;
  }

  function updateCardSplitTag(card, job, setting) {
    if (!card || !job || !setting) return;
    const tagEl = card.querySelector('.job-calc-split-tag');
    if (!tagEl) return;
    const count = job.occurrences ? job.occurrences.length : 0;
    let allocated = 0;
    (setting.splits || []).forEach((s) => {
      allocated += (parseInt(s.shifts, 10) || 0);
    });
    const remaining = count - allocated;

    tagEl.className = 'job-calc-split-tag';
    if (remaining === 0) {
      tagEl.classList.add('is-complete');
      tagEl.textContent = `${count} shifts ✔`;
    } else if (remaining > 0) {
      tagEl.classList.add('is-pending');
      tagEl.textContent = `${allocated}/${count} shifts`;
    } else {
      tagEl.classList.add('is-over');
      tagEl.textContent = `${allocated}/${count} shifts`;
    }
  }

  function bindCardEvents(listEl) {
    // 1. Triage Actions (Open Menu, Fast Unmark, Popover Option Select)
    listEl.querySelectorAll('[data-action="open-triage-menu"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = e.target.closest('.job-calc-task-card');
        if (!card) return;
        const popover = card.querySelector('.job-calc-triage-popover');
        if (!popover) return;

        const isCurrentlyHidden = popover.classList.contains('hidden');

        // Close all other open popovers
        document.querySelectorAll('.job-calc-triage-popover:not(.hidden)').forEach((p) => {
          p.classList.add('hidden');
          const parentCard = p.closest('.job-calc-task-card');
          if (parentCard) parentCard.classList.remove('popover-open');
        });

        if (isCurrentlyHidden) {
          popover.classList.remove('hidden');
          card.classList.add('popover-open');
        } else {
          popover.classList.add('hidden');
          card.classList.remove('popover-open');
        }
      });
    });

    listEl.querySelectorAll('[data-triage-type]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = e.target.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        if (!jobName) return;
        const setting = getJobSetting(jobName);
        const type = btn.dataset.triageType;

        if (type === 'paid') {
          setting.isPaid = true;
          setting.isExpense = false;
        } else if (type === 'expense') {
          setting.isExpense = true;
          setting.isPaid = false;
          if (setting.expenseAmount === undefined || setting.expenseAmount === 0) {
            setting.expenseAmount = 25;
          }
        } else if (type === 'unmark') {
          setting.isPaid = false;
          setting.isExpense = false;
          delete state.settings.jobs[jobName];
        }

        saveSettings();
        renderTasksList();
        updateSummaryCard();
      });
    });

    // Global listener to close popovers on click outside
    if (!document._jobCalcTriageDocListenerAttached) {
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.job-calc-triage-wrap')) {
          document.querySelectorAll('.job-calc-triage-popover:not(.hidden)').forEach((p) => {
            p.classList.add('hidden');
            const parentCard = p.closest('.job-calc-task-card');
            if (parentCard) parentCard.classList.remove('popover-open');
          });
        }
      });
      document._jobCalcTriageDocListenerAttached = true;
    }

    // 2. Calendar Job Grouped / Default inputs and Rate inputs
    bindGroupInputs(listEl);
    bindExpenseGroupInputs(listEl);

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

    // 4b. Mode Swapper (By Date vs Split)
    listEl.querySelectorAll('.job-calc-mode-swap-btn, .job-calc-mode-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = e.target.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        const job = scannedJobs[jobName];
        if (!job) return;
        const setting = getJobSetting(jobName);
        const mode = btn.dataset.mode;

        if (setting.adjustMode === mode) return;

        setting.adjustMode = mode;
        if (mode === 'split') {
          const count = job.occurrences ? job.occurrences.length : 0;
          if (!Array.isArray(setting.splits) || setting.splits.length === 0) {
            const groups = getJobHoursGroups(job, setting);
            if (groups.length > 0) {
              setting.splits = groups.map((g) => ({ shifts: g.count, hours: g.hours }));
            } else {
              setting.splits = [{ shifts: count > 0 ? count : 1, hours: setting.defaultHours ?? 4 }];
            }
          }
        }

        saveSettings();
        renderTasksList();
        updateSummaryCard();
      });
    });

    // 4c. Split Mode: Add Split Row Button
    listEl.querySelectorAll('.job-calc-task-card:not(.job-calc-custom-card) .job-calc-add-split-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = e.target.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        const job = scannedJobs[jobName];
        if (!job) return;
        const setting = getJobSetting(jobName);
        const count = job.occurrences ? job.occurrences.length : 0;

        if (!Array.isArray(setting.splits)) setting.splits = [];

        let allocated = 0;
        setting.splits.forEach((s) => { allocated += (parseInt(s.shifts, 10) || 0); });
        const remaining = count - allocated;
        const newShifts = remaining > 0 ? remaining : 1;

        setting.splits.push({
          shifts: newShifts,
          hours: setting.defaultHours ?? 4
        });

        saveSettings();
        renderTasksList();
        updateSummaryCard();
      });
    });

    // 4d. Split Mode: Shifts Input (Live editing & Auto-remove on 0)
    listEl.querySelectorAll('.job-calc-split-shifts-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        const job = scannedJobs[jobName];
        const setting = getJobSetting(jobName);
        const idx = parseInt(input.dataset.splitIndex, 10);
        if (!setting.splits || !setting.splits[idx]) return;

        const val = parseInt(e.target.value, 10);
        setting.splits[idx].shifts = isNaN(val) ? 0 : Math.max(0, val);

        updateCardSplitTag(card, job, setting);
        saveSettings();
        updateCardSubtotal(card, jobName);
        updateSummaryCard();
      });

      const handleRemoveOnZero = () => {
        const card = input.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        const setting = getJobSetting(jobName);
        const idx = parseInt(input.dataset.splitIndex, 10);
        if (!setting.splits || !setting.splits[idx]) return;

        const val = parseInt(input.value, 10);
        // Auto-remove row if shifts is 0 or empty (keeping at least one row)
        if (val === 0 || isNaN(val) || input.value.trim() === '' || input.value.trim() === '0') {
          if (setting.splits.length > 1) {
            setting.splits.splice(idx, 1);
            saveSettings();
            renderTasksList();
            updateSummaryCard();
            return;
          } else {
            setting.splits[0].shifts = 1;
            input.value = 1;
            saveSettings();
            updateCardSubtotal(card, jobName);
            updateSummaryCard();
            const job = scannedJobs[jobName];
            if (job) updateCardSplitTag(card, job, setting);
          }
        }
      };

      input.addEventListener('change', handleRemoveOnZero);
      input.addEventListener('blur', handleRemoveOnZero);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
        }
      });
    });

    // 4e. Split Mode: Hours Input
    listEl.querySelectorAll('.job-calc-split-hours-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        const setting = getJobSetting(jobName);
        const idx = parseInt(input.dataset.splitIndex, 10);
        if (!setting.splits || !setting.splits[idx]) return;

        const val = parseFloat(e.target.value);
        setting.splits[idx].hours = isNaN(val) ? 0 : Math.max(0, val);

        saveSettings();
        updateCardSubtotal(card, jobName);
        updateSummaryCard();
      });

      input.addEventListener('blur', (e) => {
        if (e.target.value.trim() === '') {
          e.target.value = 0;
          const card = e.target.closest('.job-calc-task-card');
          if (card) {
            const jobName = card.dataset.jobName;
            const setting = getJobSetting(jobName);
            const idx = parseInt(input.dataset.splitIndex, 10);
            if (setting.splits && setting.splits[idx]) {
              setting.splits[idx].hours = 0;
              saveSettings();
              updateCardSubtotal(card, jobName);
              updateSummaryCard();
            }
          }
        }
      });
    });

    // 4f. Split Mode: Delete Row Button (via swipe reveal)
    listEl.querySelectorAll('.job-calc-calendar-split-delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        const setting = getJobSetting(jobName);
        const idx = parseInt(btn.dataset.splitIndex, 10);
        if (!setting.splits || setting.splits.length <= 1) return; // Keep at least 1 row
        if (isNaN(idx) || idx < 0 || idx >= setting.splits.length) return;

        const rowItem = btn.closest('.job-calc-split-row-item');
        if (rowItem) {
          rowItem.style.transition = 'opacity 0.15s ease, max-height 0.18s ease';
          rowItem.style.opacity = '0';
          rowItem.style.maxHeight = '0px';
          setTimeout(() => {
            setting.splits.splice(idx, 1);
            saveSettings();
            renderTasksList();
            updateSummaryCard();
          }, 150);
        } else {
          setting.splits.splice(idx, 1);
          saveSettings();
          renderTasksList();
          updateSummaryCard();
        }
      });
    });

    // 5. Per-date hour override
    listEl.querySelectorAll('.job-calc-occ-hours-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        const occRow = e.target.closest('.job-calc-occ-row');
        if (!card || !occRow) return;

        const jobName = card.dataset.jobName;
        const occKey = occRow.dataset.occKey;
        const setting = getJobSetting(jobName);
        const defaultHours = parseFloat(setting.defaultHours) || 0;

        const rawVal = e.target.value.trim();
        const val = parseFloat(rawVal);
        if (!setting.dateOverrides) setting.dateOverrides = {};

        if (rawVal === '' || isNaN(val)) {
          setting.dateOverrides[occKey] = 0;
        } else {
          setting.dateOverrides[occKey] = Math.max(0, val);
        }

        saveSettings();
        updateCardSubtotal(card, jobName);
        updateSummaryCard();

        const resetBtn = occRow.querySelector('.job-calc-occ-reset-btn');
        if (resetBtn) {
          const currentNumericVal = (rawVal === '' || isNaN(val)) ? 0 : val;
          const isDifferent = currentNumericVal !== defaultHours;
          resetBtn.style.display = isDifferent ? '' : 'none';
        }
      });

      input.addEventListener('blur', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        const occRow = e.target.closest('.job-calc-occ-row');
        if (!card || !occRow) return;

        const jobName = card.dataset.jobName;
        const occKey = occRow.dataset.occKey;
        const setting = getJobSetting(jobName);
        const defaultHours = parseFloat(setting.defaultHours) || 0;

        if (e.target.value.trim() === '') {
          if (!setting.dateOverrides) setting.dateOverrides = {};
          setting.dateOverrides[occKey] = 0;
          e.target.value = 0;
          saveSettings();
          updateCardSubtotal(card, jobName);
          updateSummaryCard();
          const resetBtn = occRow.querySelector('.job-calc-occ-reset-btn');
          if (resetBtn) resetBtn.style.display = (0 !== defaultHours) ? '' : 'none';
        }
        refreshCardGroups(card, jobName);
      });
    });

    // 6. Reset override button
    listEl.querySelectorAll('.job-calc-occ-reset-btn').forEach((resetBtn) => {
      resetBtn.addEventListener('click', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        const occRow = e.target.closest('.job-calc-occ-row');
        if (!card || !occRow) return;

        const jobName = card.dataset.jobName;
        const occKey = occRow.dataset.occKey;
        const setting = getJobSetting(jobName);
        const defaultHours = parseFloat(setting.defaultHours) || 0;

        if (setting.dateOverrides) {
          delete setting.dateOverrides[occKey];
        }

        saveSettings();

        const hoursInput = occRow.querySelector('.job-calc-occ-hours-input');
        if (hoursInput) {
          hoursInput.value = defaultHours;
        }
        resetBtn.style.display = 'none';

        updateCardSubtotal(card, jobName);
        updateSummaryCard();
        refreshCardGroups(card, jobName);
      });
    });

    // 7b. Per-date expense override (Accordion Dates)
    listEl.querySelectorAll('.job-calc-occ-expense-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        const occRow = e.target.closest('.job-calc-occ-row');
        if (!card || !occRow) return;

        const jobName = card.dataset.jobName;
        const occKey = occRow.dataset.occKey;
        const setting = getJobSetting(jobName);
        const defaultExp = parseFloat(setting.expenseAmount) || 0;

        const rawVal = e.target.value.trim();
        const val = parseFloat(rawVal);
        if (!setting.expenseOverrides) setting.expenseOverrides = {};

        if (rawVal === '' || isNaN(val)) {
          setting.expenseOverrides[occKey] = 0;
        } else {
          setting.expenseOverrides[occKey] = Math.max(0, val);
        }

        saveSettings();
        updateCardExpenseBadge(card, jobName);
        updateSummaryCard();

        const resetBtn = occRow.querySelector('.job-calc-occ-expense-reset-btn');
        if (resetBtn) {
          const currentNumericVal = (rawVal === '' || isNaN(val)) ? 0 : val;
          const isDifferent = currentNumericVal !== defaultExp;
          resetBtn.style.display = isDifferent ? '' : 'none';
        }
      });

      input.addEventListener('blur', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        const occRow = e.target.closest('.job-calc-occ-row');
        if (!card || !occRow) return;

        const jobName = card.dataset.jobName;
        const occKey = occRow.dataset.occKey;
        const setting = getJobSetting(jobName);
        const defaultExp = parseFloat(setting.expenseAmount) || 0;

        if (e.target.value.trim() === '') {
          if (!setting.expenseOverrides) setting.expenseOverrides = {};
          setting.expenseOverrides[occKey] = 0;
          e.target.value = 0;
          saveSettings();
          updateCardExpenseBadge(card, jobName);
          updateSummaryCard();
          const resetBtn = occRow.querySelector('.job-calc-occ-expense-reset-btn');
          if (resetBtn) resetBtn.style.display = (0 !== defaultExp) ? '' : 'none';
        }
        refreshExpenseCardGroups(card, jobName);
      });

      input.addEventListener('change', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        if (!card) return;
        refreshExpenseCardGroups(card, card.dataset.jobName);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.target.blur();
        }
      });
    });

    // 7c. Reset expense override button
    listEl.querySelectorAll('.job-calc-occ-expense-reset-btn').forEach((resetBtn) => {
      resetBtn.addEventListener('click', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        const occRow = e.target.closest('.job-calc-occ-row');
        if (!card || !occRow) return;

        const jobName = card.dataset.jobName;
        const occKey = occRow.dataset.occKey;
        const setting = getJobSetting(jobName);
        const defaultExp = parseFloat(setting.expenseAmount) || 0;

        if (setting.expenseOverrides) {
          delete setting.expenseOverrides[occKey];
        }

        saveSettings();

        const expInput = occRow.querySelector('.job-calc-occ-expense-input');
        if (expInput) {
          expInput.value = defaultExp;
        }
        resetBtn.style.display = 'none';

        updateCardExpenseBadge(card, jobName);
        updateSummaryCard();
        refreshExpenseCardGroups(card, jobName);
      });
    });

    // 8. Custom Job Name input
    listEl.querySelectorAll('.job-calc-custom-name-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.job-calc-custom-card');
        if (!card) return;
        const customId = card.dataset.customId;
        const cJob = (state.settings.customJobs || []).find((c) => c.id === customId);
        if (cJob) {
          cJob.name = e.target.value.trim() || 'Untitled';
          saveSettings();
        }
      });

      input.addEventListener('blur', (e) => {
        if (!e.target.value.trim()) {
          e.target.value = 'Untitled';
          const card = e.target.closest('.job-calc-custom-card');
          if (!card) return;
          const customId = card.dataset.customId;
          const cJob = (state.settings.customJobs || []).find((c) => c.id === customId);
          if (cJob) {
            cJob.name = 'Untitled';
            saveSettings();
          }
        }
      });
    });

    // 9. Custom Job: Add Split Row Button
    listEl.querySelectorAll('.job-calc-add-custom-split-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = e.target.closest('.job-calc-custom-card');
        if (!card) return;
        const customId = card.dataset.customId;
        const cJob = (state.settings.customJobs || []).find((c) => c.id === customId);
        if (!cJob) return;

        if (!Array.isArray(cJob.splits)) {
          cJob.splits = [{ shifts: parseInt(cJob.shiftsCount, 10) || 1, hours: parseFloat(cJob.hoursPerShift) || 4 }];
        }

        cJob.splits.push({
          shifts: 1,
          hours: cJob.splits.length > 0 ? cJob.splits[0].hours : 4
        });
        cJob.shiftsCount = cJob.splits.reduce((acc, s) => acc + (parseInt(s.shifts, 10) || 0), 0);

        saveSettings();
        renderTasksList();
        updateSummaryCard();
      });
    });

    // 10. Custom Job: Split Shifts Input (with Auto-remove on 0)
    listEl.querySelectorAll('.job-calc-custom-split-shifts-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.job-calc-custom-card');
        if (!card) return;
        const customId = card.dataset.customId;
        const cJob = (state.settings.customJobs || []).find((c) => c.id === customId);
        const idx = parseInt(input.dataset.splitIndex, 10);
        if (!cJob || !cJob.splits || !cJob.splits[idx]) return;

        const val = parseInt(e.target.value, 10);
        cJob.splits[idx].shifts = isNaN(val) ? 0 : Math.max(0, val);
        cJob.shiftsCount = cJob.splits.reduce((acc, s) => acc + (parseInt(s.shifts, 10) || 0), 0);

        saveSettings();
        updateCustomCardSubtotal(card, customId);
        updateSummaryCard();
      });

      const handleRemoveOnZero = () => {
        const card = input.closest('.job-calc-custom-card');
        if (!card) return;
        const customId = card.dataset.customId;
        const cJob = (state.settings.customJobs || []).find((c) => c.id === customId);
        const idx = parseInt(input.dataset.splitIndex, 10);
        if (!cJob || !cJob.splits || !cJob.splits[idx]) return;

        const val = parseInt(input.value, 10);
        if (val === 0 || isNaN(val) || input.value.trim() === '' || input.value.trim() === '0') {
          if (cJob.splits.length > 1) {
            cJob.splits.splice(idx, 1);
            cJob.shiftsCount = cJob.splits.reduce((acc, s) => acc + (parseInt(s.shifts, 10) || 0), 0);
            saveSettings();
            renderTasksList();
            updateSummaryCard();
            return;
          } else {
            cJob.splits[0].shifts = 1;
            cJob.shiftsCount = 1;
            input.value = 1;
            saveSettings();
            updateCustomCardSubtotal(card, customId);
            updateSummaryCard();
          }
        }
      };

      input.addEventListener('change', handleRemoveOnZero);
      input.addEventListener('blur', handleRemoveOnZero);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
        }
      });
    });

    // 11. Custom Job: Split Hours Input
    listEl.querySelectorAll('.job-calc-custom-split-hours-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.job-calc-custom-card');
        if (!card) return;
        const customId = card.dataset.customId;
        const cJob = (state.settings.customJobs || []).find((c) => c.id === customId);
        const idx = parseInt(input.dataset.splitIndex, 10);
        if (!cJob || !cJob.splits || !cJob.splits[idx]) return;

        const val = parseFloat(e.target.value);
        cJob.splits[idx].hours = isNaN(val) ? 0 : Math.max(0, val);
        if (idx === 0) cJob.hoursPerShift = cJob.splits[0].hours;

        saveSettings();
        updateCustomCardSubtotal(card, customId);
        updateSummaryCard();
      });

      input.addEventListener('blur', (e) => {
        if (e.target.value.trim() === '') {
          e.target.value = 0;
          const card = e.target.closest('.job-calc-custom-card');
          if (card) {
            const customId = card.dataset.customId;
            const cJob = (state.settings.customJobs || []).find((c) => c.id === customId);
            const idx = parseInt(input.dataset.splitIndex, 10);
            if (cJob && cJob.splits && cJob.splits[idx]) {
              cJob.splits[idx].hours = 0;
              saveSettings();
              updateCustomCardSubtotal(card, customId);
              updateSummaryCard();
            }
          }
        }
      });
    });

    // 11b. Custom Split Mode: Delete Row Button (via swipe reveal)
    listEl.querySelectorAll('.job-calc-custom-split-delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.job-calc-custom-card');
        if (!card) return;
        const customId = card.dataset.customId;
        const cJob = (state.settings.customJobs || []).find((c) => c.id === customId);
        const idx = parseInt(btn.dataset.splitIndex, 10);
        if (!cJob || !cJob.splits || cJob.splits.length <= 1) return; // Keep at least 1 row
        if (isNaN(idx) || idx < 0 || idx >= cJob.splits.length) return;

        const rowItem = btn.closest('.job-calc-split-row-item');
        if (rowItem) {
          rowItem.style.transition = 'opacity 0.15s ease, max-height 0.18s ease';
          rowItem.style.opacity = '0';
          rowItem.style.maxHeight = '0px';
          setTimeout(() => {
            cJob.splits.splice(idx, 1);
            cJob.shiftsCount = cJob.splits.reduce((acc, s) => acc + (parseInt(s.shifts, 10) || 0), 0);
            saveSettings();
            renderTasksList();
            updateSummaryCard();
          }, 150);
        } else {
          cJob.splits.splice(idx, 1);
          cJob.shiftsCount = cJob.splits.reduce((acc, s) => acc + (parseInt(s.shifts, 10) || 0), 0);
          saveSettings();
          renderTasksList();
          updateSummaryCard();
        }
      });
    });

    // 12. Custom Job: Rate input (syncs all rate inputs on that card)
    listEl.querySelectorAll('.job-calc-custom-rate-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.job-calc-custom-card');
        if (!card) return;
        const customId = card.dataset.customId;
        const cJob = (state.settings.customJobs || []).find((c) => c.id === customId);
        if (cJob) {
          const val = parseFloat(e.target.value);
          cJob.hourlyRate = isNaN(val) ? 0 : Math.max(0, val);
          saveSettings();
          card.querySelectorAll('.job-calc-custom-rate-input').forEach((r) => {
            if (r !== e.target) r.value = e.target.value;
          });
          updateCustomCardSubtotal(card, customId);
          updateSummaryCard();
        }
      });

      input.addEventListener('blur', (e) => {
        if (e.target.value.trim() === '') {
          e.target.value = 0;
        }
      });
    });

    // 12. Custom Job Delete button
    listEl.querySelectorAll('.job-calc-custom-delete-btn, [data-action="delete-custom-job"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = e.target.closest('.job-calc-custom-card');
        if (!card) return;
        const customId = card.dataset.customId;
        if (state.settings.customJobs) {
          state.settings.customJobs = state.settings.customJobs.filter((c) => c.id !== customId);
          saveSettings();
          renderTasksList();
          updateSummaryCard();
        }
      });
    });

    // 13. Calendar Job Taxable Checkbox
    listEl.querySelectorAll('.job-calc-taxable-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        const setting = getJobSetting(jobName);
        setting.isTaxable = e.target.checked;
        saveSettings();
        updateSummaryCard();
      });
    });

    // 14. Custom Job Taxable Checkbox
    listEl.querySelectorAll('.job-calc-custom-taxable-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        const card = e.target.closest('.job-calc-custom-card');
        if (!card) return;
        const customId = card.dataset.customId;
        const cJob = (state.settings.customJobs || []).find((c) => c.id === customId);
        if (cJob) {
          cJob.isTaxable = e.target.checked;
          saveSettings();
          updateSummaryCard();
        }
      });
    });

    // 15. Custom Expense Delete box button
    listEl.querySelectorAll('[data-action="delete-custom-expense"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = e.target.closest('.job-calc-expense-card');
        if (!card) return;
        const expId = card.dataset.expenseId;
        state.settings.customExpenses = (state.settings.customExpenses || []).filter((c) => c.id !== expId);
        saveSettings();
        renderTasksList();
        updateSummaryCard();
      });
    });

    // 16. Custom Expense Name input
    listEl.querySelectorAll('.job-calc-expense-name-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.job-calc-expense-card');
        if (!card) return;
        const expId = card.dataset.expenseId;
        const cExp = (state.settings.customExpenses || []).find((c) => c.id === expId);
        if (cExp) {
          cExp.name = e.target.value.trim() || 'Untitled';
          saveSettings();
        }
      });

      input.addEventListener('blur', (e) => {
        if (!e.target.value.trim()) {
          e.target.value = 'Untitled';
          const card = e.target.closest('.job-calc-expense-card');
          if (!card) return;
          const expId = card.dataset.expenseId;
          const cExp = (state.settings.customExpenses || []).find((c) => c.id === expId);
          if (cExp) {
            cExp.name = 'Untitled';
            saveSettings();
          }
        }
      });
    });

    // 17. Custom Expense Amount input
    listEl.querySelectorAll('.job-calc-expense-amount-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.job-calc-expense-card');
        if (!card) return;
        const expId = card.dataset.expenseId;
        const cExp = (state.settings.customExpenses || []).find((c) => c.id === expId);
        if (cExp) {
          const val = parseFloat(e.target.value);
          cExp.amount = isNaN(val) ? 0 : Math.max(0, val);
          saveSettings();
          updateCustomExpenseBadge(card, expId);
          updateSummaryCard();
        }
      });

      input.addEventListener('blur', (e) => {
        if (e.target.value.trim() === '') {
          e.target.value = 0;
          const card = e.target.closest('.job-calc-expense-card');
          if (!card) return;
          const expId = card.dataset.expenseId;
          const cExp = (state.settings.customExpenses || []).find((c) => c.id === expId);
          if (cExp) {
            cExp.amount = 0;
            saveSettings();
            updateCustomExpenseBadge(card, expId);
            updateSummaryCard();
          }
        }
      });
    });

    // 18. Bind swipe gestures for split rows
    bindSplitRowSwipeGestures(listEl);
  }

  function bindSplitRowSwipeGestures(listEl) {
    const swipeableRows = listEl.querySelectorAll('.job-calc-split-row-item.is-swipeable');
    if (swipeableRows.length === 0) return;

    const closeAllSwipedRows = (exceptItem = null) => {
      listEl.querySelectorAll('.job-calc-split-row-item.is-swiped, .job-calc-split-row-item.is-swiping').forEach((item) => {
        if (item !== exceptItem) {
          item.classList.remove('is-swiped');
          item.classList.remove('is-swiping');
          const innerRow = item.querySelector('.job-calc-split-row');
          if (innerRow) {
            innerRow.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
            innerRow.style.transform = 'translateX(0px)';
          }
        }
      });
    };

    swipeableRows.forEach((item) => {
      const innerRow = item.querySelector('.job-calc-split-row');
      if (!innerRow) return;

      // When any input inside focuses, close swiped state
      item.querySelectorAll('input').forEach((input) => {
        input.addEventListener('focus', () => {
          if (item.classList.contains('is-swiped') || item.classList.contains('is-swiping')) {
            item.classList.remove('is-swiped');
            item.classList.remove('is-swiping');
            innerRow.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
            innerRow.style.transform = 'translateX(0px)';
          }
        });
      });

      // --- Touch Swiping (Mobile / Tablets) ---
      let touchStartX = 0;
      let touchStartY = 0;
      let touchStartTime = 0;
      let isSwiping = false;
      let initialOffset = 0;

      item.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
        isSwiping = false;
        initialOffset = item.classList.contains('is-swiped') ? -70 : 0;
      }, { passive: true });

      item.addEventListener('touchmove', (e) => {
        if (e.touches.length !== 1) return;
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const dx = currentX - touchStartX;
        const dy = currentY - touchStartY;

        if (!isSwiping) {
          if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.1) {
            isSwiping = true;
            item.classList.add('is-swiping');
            closeAllSwipedRows(item);
          } else if (Math.abs(dy) > 8) {
            return;
          }
        }

        if (isSwiping) {
          if (e.cancelable) e.preventDefault();
          const targetOffset = Math.max(-82, Math.min(0, initialOffset + dx));
          innerRow.style.transition = 'none';
          innerRow.style.transform = `translateX(${targetOffset}px)`;
        }
      }, { passive: false });

      const handleTouchFinish = (e) => {
        if (!isSwiping) return;
        isSwiping = false;
        item.classList.remove('is-swiping');
        const touch = e.changedTouches ? e.changedTouches[0] : null;
        if (!touch) return;
        const dx = touch.clientX - touchStartX;
        const duration = Date.now() - touchStartTime;

        innerRow.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';

        if (initialOffset === 0) {
          if (dx <= -25 || (dx < -15 && duration < 250)) {
            item.classList.add('is-swiped');
            innerRow.style.transform = 'translateX(-70px)';
          } else {
            item.classList.remove('is-swiped');
            innerRow.style.transform = 'translateX(0px)';
          }
        } else {
          if (dx >= 20 || (dx > 10 && duration < 250)) {
            item.classList.remove('is-swiped');
            innerRow.style.transform = 'translateX(0px)';
          } else {
            item.classList.add('is-swiped');
            innerRow.style.transform = 'translateX(-70px)';
          }
        }
      };

      item.addEventListener('touchend', handleTouchFinish, { passive: true });
      item.addEventListener('touchcancel', () => {
        if (isSwiping) {
          isSwiping = false;
          item.classList.remove('is-swiping');
          innerRow.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
          innerRow.style.transform = item.classList.contains('is-swiped') ? 'translateX(-70px)' : 'translateX(0px)';
        }
      }, { passive: true });

      // --- Pointer / Mouse Drag Swiping (Desktop) ---
      item.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return;
        if (e.target.closest('input') || e.target.closest('.job-calc-split-delete-btn')) return;

        const startX = e.clientX;
        const startY = e.clientY;
        const startTime = Date.now();
        let isPointerSwiping = false;
        const initOffset = item.classList.contains('is-swiped') ? -70 : 0;

        const onPointerMove = (pe) => {
          const dx = pe.clientX - startX;
          const dy = pe.clientY - startY;

          if (!isPointerSwiping) {
            if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
              isPointerSwiping = true;
              item.classList.add('is-swiping');
              closeAllSwipedRows(item);
            } else if (Math.abs(dy) > 6) {
              cleanup();
              return;
            }
          }

          if (isPointerSwiping) {
            const targetOffset = Math.max(-82, Math.min(0, initOffset + dx));
            innerRow.style.transition = 'none';
            innerRow.style.transform = `translateX(${targetOffset}px)`;
          }
        };

        const onPointerUp = (pe) => {
          cleanup();
          if (!isPointerSwiping) return;
          item.classList.remove('is-swiping');

          const dx = pe.clientX - startX;
          const duration = Date.now() - startTime;
          innerRow.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';

          if (initOffset === 0) {
            if (dx <= -25 || (dx < -15 && duration < 250)) {
              item.classList.add('is-swiped');
              innerRow.style.transform = 'translateX(-70px)';
            } else {
              item.classList.remove('is-swiped');
              innerRow.style.transform = 'translateX(0px)';
            }
          } else {
            if (dx >= 20 || (dx > 10 && duration < 250)) {
              item.classList.remove('is-swiped');
              innerRow.style.transform = 'translateX(0px)';
            } else {
              item.classList.add('is-swiped');
              innerRow.style.transform = 'translateX(-70px)';
            }
          }
        };

        const cleanup = () => {
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          window.removeEventListener('pointercancel', onPointerUp);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
      });
    });

    // Dismiss any swiped row when clicking outside
    if (!document._jobCalcSplitSwipeListenerAttached) {
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.job-calc-split-row-item')) {
          document.querySelectorAll('.job-calc-split-row-item.is-swiped, .job-calc-split-row-item.is-swiping').forEach((item) => {
            item.classList.remove('is-swiped');
            item.classList.remove('is-swiping');
            const innerRow = item.querySelector('.job-calc-split-row');
            if (innerRow) {
              innerRow.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
              innerRow.style.transform = 'translateX(0px)';
            }
          });
        }
      }, { capture: true });
      document._jobCalcSplitSwipeListenerAttached = true;
    }
  }

  function updateCardExpenseBadge(card, jobName) {
    const job = scannedJobs[jobName];
    const setting = getJobSetting(jobName);
    if (!job || !setting) return;

    const defaultExpAmt = parseFloat(setting.expenseAmount) || 0;
    let jobExpenseTotal = 0;
    job.occurrences.forEach((occ) => {
      const overrideVal = setting.expenseOverrides?.[occ.occKey];
      const occExp = (typeof overrideVal === 'number' && !isNaN(overrideVal))
        ? overrideVal
        : defaultExpAmt;
      jobExpenseTotal += occExp;
    });

    const amountEl = card.querySelector('.job-calc-subtotal-badge.job-calc-expense-badge .job-calc-subtotal-amount');
    if (amountEl) {
      amountEl.textContent = `-$${jobExpenseTotal.toFixed(2)}`;
    }
  }

  function updateCustomExpenseBadge(card, customId) {
    const cExp = (state.settings.customExpenses || []).find((c) => c.id === customId);
    if (!cExp) return;
    const amt = parseFloat(cExp.amount) || 0;
    const amountEl = card.querySelector('.job-calc-subtotal-badge.job-calc-expense-badge .job-calc-subtotal-amount');
    if (amountEl) {
      amountEl.textContent = `-$${amt.toFixed(2)}`;
    }
  }

  function updateCardSubtotal(card, jobName) {
    const setting = getJobSetting(jobName);
    const job = scannedJobs[jobName];
    if (!job || !setting.isPaid) return;

    const defaultHours = parseFloat(setting.defaultHours) || 0;
    const rate = parseFloat(setting.hourlyRate) || 0;
    const count = job.occurrences ? job.occurrences.length : 0;
    let hours = 0;

    if (setting.adjustMode === 'split' && Array.isArray(setting.splits) && setting.splits.length > 0) {
      setting.splits.forEach((s) => {
        const sCount = parseInt(s.shifts, 10) || 0;
        const sHours = parseFloat(s.hours) || 0;
        hours += (sCount * sHours);
      });
    } else {
      job.occurrences.forEach((occ) => {
        const overrideVal = setting.dateOverrides?.[occ.occKey];
        hours += (typeof overrideVal === 'number' && !isNaN(overrideVal))
          ? overrideVal
          : defaultHours;
      });
    }

    const roundCents = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
    const subtotal = roundCents(hours * rate);

    const amountEl = card.querySelector('.job-calc-subtotal-amount');
    const hoursEl = card.querySelector('.job-calc-subtotal-hours');
    const badgeEl = card.querySelector('.job-calc-session-badge');
    if (amountEl) amountEl.textContent = `$${subtotal.toFixed(2)}`;
    if (hoursEl) hoursEl.textContent = `${hours.toFixed(1)} hrs`;
    if (badgeEl) {
      if (setting.adjustMode === 'split' && Array.isArray(setting.splits) && setting.splits.length > 0) {
        let splitAllocated = 0;
        setting.splits.forEach((s) => { splitAllocated += (parseInt(s.shifts, 10) || 0); });
        badgeEl.textContent = `${splitAllocated > 0 ? splitAllocated : count}x`;
      } else {
        badgeEl.textContent = `${count}x`;
      }
    }
  }

  function updateCustomCardSubtotal(card, customId) {
    const cJob = (state.settings.customJobs || []).find((c) => c.id === customId);
    if (!cJob) return;

    const rate = parseFloat(cJob.hourlyRate) || 0;
    let totalHours = 0;
    let totalShifts = 0;

    if (Array.isArray(cJob.splits) && cJob.splits.length > 0) {
      cJob.splits.forEach((s) => {
        const sCount = parseInt(s.shifts, 10) || 0;
        const sHours = parseFloat(s.hours) || 0;
        totalHours += (sCount * sHours);
        totalShifts += sCount;
      });
    } else {
      totalShifts = parseInt(cJob.shiftsCount, 10) || 1;
      const hoursPerShift = parseFloat(cJob.hoursPerShift) || 0;
      totalHours = totalShifts * hoursPerShift;
    }

    const subtotal = Math.round((totalHours * rate + Number.EPSILON) * 100) / 100;

    const amountEl = card.querySelector('.job-calc-subtotal-amount');
    const hoursEl = card.querySelector('.job-calc-subtotal-hours');
    const badgeEl = card.querySelector('.job-calc-session-badge');
    if (amountEl) amountEl.textContent = `$${subtotal.toFixed(2)}`;
    if (hoursEl) hoursEl.textContent = `${totalHours.toFixed(1)} hrs`;
    if (badgeEl) badgeEl.textContent = `${totalShifts}x`;
  }

  function updateSummaryCard() {
    const container = document.getElementById('job-calculator-container');
    if (!container) return;

    const {
      totalSessions,
      totalHours,
      grossEarnings,
      taxDeductionAmount,
      totalExpenses,
      netTakeHome
    } = calculateTotals();

    // Metrics
    const sumSessions = container.querySelector('#job-calc-sum-sessions');
    const sumHours = container.querySelector('#job-calc-sum-hours');
    const sumGross = container.querySelector('#job-calc-sum-gross');
    const sumExpenses = container.querySelector('#job-calc-sum-expenses');
    const sumNet = container.querySelector('#job-calc-sum-net');
    const taxAmountEl = container.querySelector('#job-calc-tax-amount');
    const taxInput = container.querySelector('#job-calc-tax-input');
    const taxSymbol = container.querySelector('#job-calc-tax-symbol');
    const taxToggleWrap = container.querySelector('#job-calc-tax-mode-toggle');

    if (sumSessions) sumSessions.textContent = `${totalSessions}x`;
    if (sumHours) sumHours.textContent = `${totalHours.toFixed(1)} hrs`;
    if (sumGross) sumGross.textContent = `$${grossEarnings.toFixed(2)}`;

    // Conditionally include Expenses in the summary (hide if $0)
    const expenseRow = container.querySelector('#job-calc-expense-summary-row');
    if (expenseRow) {
      expenseRow.style.display = totalExpenses > 0 ? 'flex' : 'none';
    }
    if (sumExpenses) sumExpenses.textContent = `-$${totalExpenses.toFixed(2)}`;

    if (sumNet) sumNet.textContent = `$${netTakeHome.toFixed(2)}`;
    if (taxAmountEl) taxAmountEl.textContent = `-$${taxDeductionAmount.toFixed(2)}`;

    // Sync Net sublabel dynamically
    const netSublabelEl = container.querySelector('.job-calc-net-sublabel');
    if (netSublabelEl) {
      if (taxDeductionAmount > 0 && totalExpenses > 0) {
        netSublabelEl.textContent = 'After tax & expenses';
      } else if (taxDeductionAmount > 0) {
        netSublabelEl.textContent = 'After tax deduction';
      } else if (totalExpenses > 0) {
        netSublabelEl.textContent = 'After expenses';
      } else {
        netSublabelEl.textContent = 'Estimated take-home';
      }
    }

    // Sync tax input & modes
    const taxSetting = state.settings.tax || { type: 'percent', value: 0 };
    if (taxInput && document.activeElement !== taxInput) {
      taxInput.value = taxSetting.value > 0 ? taxSetting.value : '';
    }
    const taxField = container.querySelector('#job-calc-tax-field');
    const prefix = container.querySelector('#job-calc-tax-symbol-prefix');
    const suffix = container.querySelector('#job-calc-tax-symbol-suffix');
    if (taxField) {
      taxField.classList.toggle('mode-percent', taxSetting.type === 'percent');
      taxField.classList.toggle('mode-amount', taxSetting.type === 'amount');
    }
    if (prefix) prefix.style.display = taxSetting.type === 'amount' ? 'inline' : 'none';
    if (suffix) suffix.style.display = taxSetting.type === 'percent' ? 'inline' : 'none';

    if (taxToggleWrap) {
      taxToggleWrap.querySelectorAll('.job-calc-tax-mode-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.mode === taxSetting.type);
      });
    }

    // Keep the receipt ticket synced with current data
    updateReceiptTicket();
  }

  /* ==========================================================================
   * 8. Retro Receipt Ticket Updater & Export
   * ========================================================================== */

  function updateReceiptTicket() {
    const container = document.getElementById('job-calculator-container');
    if (!container) return;

    const {
      totalSessions,
      totalHours,
      grossEarnings,
      taxableEarnings,
      taxDeductionAmount,
      totalExpenses,
      netTakeHome,
      jobResults,
      customResults
    } = calculateTotals();

    // 1. Update Receipt Header Date Info
    const rangeEl = container.querySelector('#receipt-date-range');
    if (rangeEl && state.fromDate && state.toDate) {
      const f = parseIsoDate(state.fromDate);
      const t = parseIsoDate(state.toDate);
      rangeEl.textContent = `${formatDisplayDate(f)} — ${formatDisplayDate(t)}`;
    }

    // 2. Calendar Shifts Section
    const shiftsCountEl = container.querySelector('#receipt-shifts-count');
    const shiftsHoursEl = container.querySelector('#receipt-shifts-hours');
    const shiftsSubtotalEl = container.querySelector('#receipt-shifts-subtotal');
    const shiftsListEl = container.querySelector('#receipt-shifts-list');

    if (shiftsCountEl) shiftsCountEl.textContent = `${totalSessions}x`;
    if (shiftsHoursEl) shiftsHoursEl.textContent = `${totalHours.toFixed(1)}h`;
    if (shiftsSubtotalEl) shiftsSubtotalEl.textContent = `$${grossEarnings.toFixed(2)}`;

    if (shiftsListEl) {
      const paidNames = Object.keys(scannedJobs).filter((name) => getJobSetting(name).isPaid);
      const paidCustom = (state.settings.customJobs || []).filter((c) => c.isPaid !== false);

      if (paidNames.length === 0 && paidCustom.length === 0) {
        shiftsListEl.innerHTML = `
          <div class="receipt-item-row receipt-item-muted">
            <span>No earnings selected</span>
            <span>$0.00</span>
          </div>
        `;
      } else {
        const taxSetting = state.settings.tax || { type: 'percent', value: 0 };
        let shiftsHtml = '';

        paidNames.forEach((name) => {
          const setting = getJobSetting(name);
          const res = jobResults?.[name] || { count: 0, totalHours: 0, subtotal: 0 };
          const rate = parseFloat(setting.hourlyRate) || 0;
          const hours = res.totalHours;
          const count = res.count;
          const subtotal = res.subtotal;

          const isTaxable = setting.isTaxable !== false;
          const jobTax = (taxDeductionAmount > 0 && isTaxable)
            ? (taxSetting.type === 'percent'
                ? (subtotal * (parseFloat(taxSetting.value) || 0)) / 100
                : (taxableEarnings > 0 ? (subtotal / taxableEarnings) * taxDeductionAmount : 0))
            : 0;
          const jobNet = Math.max(0, subtotal - jobTax);

          let taxSublineHtml = '';
          if (taxDeductionAmount > 0) {
            taxSublineHtml = isTaxable
              ? `<span class="receipt-item-tax-detail">Tax: -$${jobTax.toFixed(2)} <span class="receipt-item-tax-net">· Net: $${jobNet.toFixed(2)}</span></span>`
              : `<span class="receipt-item-tax-detail receipt-item-untaxed-detail">Untaxed <span class="receipt-item-tax-net">· Net: $${subtotal.toFixed(2)}</span></span>`;
          }

          shiftsHtml += `
            <div class="receipt-item-row">
              <div class="receipt-item-title-col">
                <span class="receipt-item-name">${escapeHtml(name)}</span>
                <span class="receipt-item-detail">${hours.toFixed(1)}h (${count}x) @ $${rate.toFixed(2)}/hr</span>
                ${taxSublineHtml}
              </div>
              <span class="receipt-item-amount">$${subtotal.toFixed(2)}</span>
            </div>
          `;
        });

        paidCustom.forEach((cJob) => {
          const res = customResults?.[cJob.id] || { count: 1, totalHours: 0, subtotal: 0 };
          const rate = parseFloat(cJob.hourlyRate) || 0;
          const hours = res.totalHours;
          const count = res.count;
          const subtotal = res.subtotal;

          const isTaxable = cJob.isTaxable === true;
          const jobTax = (taxDeductionAmount > 0 && isTaxable)
            ? (taxSetting.type === 'percent'
                ? (subtotal * (parseFloat(taxSetting.value) || 0)) / 100
                : (taxableEarnings > 0 ? (subtotal / taxableEarnings) * taxDeductionAmount : 0))
            : 0;
          const jobNet = Math.max(0, subtotal - jobTax);

          let taxSublineHtml = '';
          if (taxDeductionAmount > 0) {
            taxSublineHtml = isTaxable
              ? `<span class="receipt-item-tax-detail">Tax: -$${jobTax.toFixed(2)} <span class="receipt-item-tax-net">· Net: $${jobNet.toFixed(2)}</span></span>`
              : `<span class="receipt-item-tax-detail receipt-item-untaxed-detail">Untaxed <span class="receipt-item-tax-net">· Net: $${subtotal.toFixed(2)}</span></span>`;
          }

          shiftsHtml += `
            <div class="receipt-item-row">
              <div class="receipt-item-title-col">
                <span class="receipt-item-name">${escapeHtml(cJob.name || 'Untitled')} <span class="receipt-item-tag-custom">EARNINGS</span></span>
                <span class="receipt-item-detail">${hours.toFixed(1)}h (${count}x) @ $${rate.toFixed(2)}/hr</span>
                ${taxSublineHtml}
              </div>
              <span class="receipt-item-amount">$${subtotal.toFixed(2)}</span>
            </div>
          `;
        });

        shiftsListEl.innerHTML = shiftsHtml;
      }
    }

    // 3. Gross Earnings
    const grossAmountEl = container.querySelector('#receipt-gross-amount');
    if (grossAmountEl) grossAmountEl.textContent = `$${grossEarnings.toFixed(2)}`;

    // 4. Work Expenses Section
    const expSection = container.querySelector('#receipt-expenses-section');
    const expCountEl = container.querySelector('#receipt-expenses-count');
    const expSubtotalEl = container.querySelector('#receipt-expenses-subtotal');
    const expListEl = container.querySelector('#receipt-expenses-list');

    if (totalExpenses > 0) {
      if (expSection) expSection.style.display = 'block';
      const expCalendarNames = Object.keys(scannedJobs).filter((name) => {
        const s = getJobSetting(name);
        const res = jobResults[name];
        return s.isExpense && ((res?.expenseTotal || 0) > 0 || (parseFloat(s.expenseAmount) || 0) > 0);
      });
      const customExps = (state.settings.customExpenses || []).filter((e) => (parseFloat(e.amount) || 0) > 0);
      const totalExpItemsCount = expCalendarNames.length + customExps.length;

      if (expCountEl) expCountEl.textContent = `${totalExpItemsCount}x`;
      if (expSubtotalEl) expSubtotalEl.textContent = `-$${totalExpenses.toFixed(2)}`;

      if (expListEl) {
        let expHtml = '';
        expCalendarNames.forEach((name) => {
          const setting = getJobSetting(name);
          const res = jobResults[name];
          const count = scannedJobs[name]?.occurrences.length || 1;
          const totalAmt = res?.expenseTotal !== undefined ? res.expenseTotal : ((parseFloat(setting.expenseAmount) || 0) * count);
          expHtml += `
            <div class="receipt-item-row">
              <div class="receipt-item-title-col">
                <span class="receipt-item-name">${escapeHtml(name)}</span>
                <span class="receipt-item-detail">Calendar expense (${count}x)</span>
              </div>
              <span class="receipt-item-amount receipt-item-deduction">-$${totalAmt.toFixed(2)}</span>
            </div>
          `;
        });

        customExps.forEach((cExp) => {
          const amt = parseFloat(cExp.amount) || 0;
          expHtml += `
            <div class="receipt-item-row">
              <div class="receipt-item-title-col">
                <span class="receipt-item-name">${escapeHtml(cExp.name || 'Untitled')} <span class="receipt-item-tag-expense">EXPENSES</span></span>
                <span class="receipt-item-detail">Custom Expense</span>
              </div>
              <span class="receipt-item-amount receipt-item-deduction">-$${amt.toFixed(2)}</span>
            </div>
          `;
        });

        expListEl.innerHTML = expHtml;
      }
    } else {
      if (expSection) expSection.style.display = 'none';
    }

    // 5. Tax Deduction
    const taxSection = container.querySelector('#receipt-tax-section');
    const taxDetailEl = container.querySelector('#receipt-tax-detail');
    const taxAmountEl = container.querySelector('#receipt-tax-amount');
    const taxSetting = state.settings.tax || { type: 'percent', value: 0 };

    if (taxDeductionAmount > 0) {
      if (taxSection) taxSection.style.display = 'block';
      if (taxDetailEl) {
        taxDetailEl.textContent = taxSetting.type === 'percent'
          ? `(${taxSetting.value}% of taxable)`
          : `(Flat deduction)`;
      }
      if (taxAmountEl) taxAmountEl.textContent = `-$${taxDeductionAmount.toFixed(2)}`;
    } else {
      if (taxSection) taxSection.style.display = 'none';
    }

    // 6. Net Take-Home Hero Row
    const netAmountEl = container.querySelector('#receipt-net-amount');
    if (netAmountEl) netAmountEl.textContent = `$${netTakeHome.toFixed(2)}`;
  }

  function formatReceiptText(totals) {
    const LINE_WIDTH = 42;
    const divider = '-'.repeat(LINE_WIDTH);
    const doubleDivider = '='.repeat(LINE_WIDTH);

    function center(text) {
      if (text.length >= LINE_WIDTH) return text;
      const leftPad = Math.floor((LINE_WIDTH - text.length) / 2);
      return ' '.repeat(leftPad) + text;
    }

    function row(left, right) {
      const leftSpace = LINE_WIDTH - right.length;
      if (left.length > leftSpace - 1) {
        left = left.substring(0, Math.max(0, leftSpace - 4)) + '...';
      }
      return left.padEnd(leftSpace, ' ') + right;
    }

    const rangeStr = state.fromDate && state.toDate
      ? `${formatDisplayDate(parseIsoDate(state.fromDate))} — ${formatDisplayDate(parseIsoDate(state.toDate))}`
      : 'Selected Period';

    let out = [];
    out.push(doubleDivider);
    out.push(center('PAYSLIP'));
    out.push(center('★ SHIFT BREAKDOWN ★'));
    out.push(doubleDivider);
    out.push(row('PERIOD', rangeStr));
    out.push(divider);

    // Paid Calendar Jobs & Custom Jobs
    const paidJobs = Object.keys(scannedJobs).filter((name) => getJobSetting(name).isPaid);
    const paidCustom = (state.settings.customJobs || []).filter((c) => c.isPaid !== false);

    if (paidJobs.length > 0 || paidCustom.length > 0) {
      out.push('SHIFTS & WORK:');
      paidJobs.forEach((name) => {
        const setting = getJobSetting(name);
        const res = totals.jobResults?.[name] || { count: 0, totalHours: 0, subtotal: 0 };
        const rate = parseFloat(setting.hourlyRate) || 0;
        const hours = res.totalHours;
        const count = res.count;
        const subtotal = res.subtotal;
        const detailStr = `  ${name} (${hours.toFixed(1)}h · ${count}x)`;
        out.push(row(detailStr, `$${subtotal.toFixed(2)}`));

        if (totals.taxDeductionAmount > 0) {
          const isTaxable = setting.isTaxable !== false;
          if (isTaxable) {
            const jobTax = taxSetting.type === 'percent'
              ? (subtotal * (parseFloat(taxSetting.value) || 0)) / 100
              : (totals.taxableEarnings > 0 ? (subtotal / totals.taxableEarnings) * totals.taxDeductionAmount : 0);
            const jobNet = Math.max(0, subtotal - jobTax);
            out.push(`    Tax: -$${jobTax.toFixed(2)} · Net: $${jobNet.toFixed(2)}`);
          } else {
            out.push(`    Untaxed · Net: $${subtotal.toFixed(2)}`);
          }
        }
      });

      paidCustom.forEach((cJob) => {
        const res = totals.customResults?.[cJob.id] || { count: 1, totalHours: 0, subtotal: 0 };
        const hours = res.totalHours;
        const count = res.count;
        const subtotal = res.subtotal;
        const detailStr = `  ${cJob.name || 'Untitled'} [Earnings] (${hours.toFixed(1)}h · ${count}x)`;
        out.push(row(detailStr, `$${subtotal.toFixed(2)}`));

        if (totals.taxDeductionAmount > 0) {
          const isTaxable = cJob.isTaxable === true;
          if (isTaxable) {
            const jobTax = taxSetting.type === 'percent'
              ? (subtotal * (parseFloat(taxSetting.value) || 0)) / 100
              : (totals.taxableEarnings > 0 ? (subtotal / totals.taxableEarnings) * totals.taxDeductionAmount : 0);
            const jobNet = Math.max(0, subtotal - jobTax);
            out.push(`    Tax: -$${jobTax.toFixed(2)} · Net: $${jobNet.toFixed(2)}`);
          } else {
            out.push(`    Untaxed · Net: $${subtotal.toFixed(2)}`);
          }
        }
      });

      out.push(row('  Total Shift Hours', `${totals.totalHours.toFixed(1)} hrs`));
      out.push(row('  Shifts Subtotal', `$${totals.grossEarnings.toFixed(2)}`));
      out.push(divider);
    }

    out.push(row('GROSS EARNINGS', `$${totals.grossEarnings.toFixed(2)}`));

    const taxSetting = state.settings.tax || { type: 'percent', value: 0 };
    if (totals.taxDeductionAmount > 0) {
      const typeLabel = taxSetting.type === 'percent' ? ` (${taxSetting.value}%)` : '';
      out.push(row(`  Total Tax Deduction${typeLabel}`, `-$${totals.taxDeductionAmount.toFixed(2)}`));
    }

    // Expenses (if any)
    if (totals.totalExpenses > 0) {
      out.push(divider);
      out.push('EXPENSES:');
      const expCalendarNames = Object.keys(scannedJobs).filter((name) => {
        const s = getJobSetting(name);
        const res = totals.jobResults[name];
        return s.isExpense && ((res?.expenseTotal || 0) > 0 || (parseFloat(s.expenseAmount) || 0) > 0);
      });
      expCalendarNames.forEach((name) => {
        const res = totals.jobResults[name];
        const count = scannedJobs[name]?.occurrences.length || 1;
        const totalAmt = res?.expenseTotal || 0;
        out.push(row(`  ${name} (${count}x)`, `-$${totalAmt.toFixed(2)}`));
      });

      (state.settings.customExpenses || []).forEach((cExp) => {
        const amt = parseFloat(cExp.amount) || 0;
        if (amt > 0) {
          out.push(row(`  ${cExp.name || 'Untitled'} [Expenses]`, `-$${amt.toFixed(2)}`));
        }
      });
      out.push(row('  Total Expenses', `-$${totals.totalExpenses.toFixed(2)}`));
    }

    out.push(doubleDivider);

    out.push(row('NET TAKE-HOME', `$${totals.netTakeHome.toFixed(2)}`));
    out.push(doubleDivider);
    out.push(center('THANK YOU FOR YOUR WORK!'));
    out.push(center('EVERY SHIFT ADDS UP 🐷'));
    out.push(doubleDivider);

    return out.join('\n');
  }

  function handleCopyReceipt() {
    const totals = calculateTotals();
    const text = formatReceiptText(totals);

    const btn = document.querySelector('#receipt-btn-copy');
    const originalHtml = btn ? btn.innerHTML : '';

    const showSuccess = () => {
      showToastNotification('Breakdown ticket copied to clipboard! 📋');
      if (btn) {
        btn.innerHTML = `
          <span class="material-symbols-outlined" style="font-size: 14px; color: #16a34a;">check</span>
          <span class="receipt-action-btn-text" style="color: #16a34a;">Copied!</span>
        `;
        setTimeout(() => {
          if (btn) btn.innerHTML = originalHtml;
        }, 1800);
      }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(showSuccess)
        .catch(() => {
          fallbackCopyText(text);
          showSuccess();
        });
    } else {
      fallbackCopyText(text);
      showSuccess();
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
      showToastNotification('Receipt Ticket copied to clipboard! 📋');
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
      const summaryCard = container.querySelector('#job-calc-summary-card, .job-calc-summary-card');
      const receiptWrapper = container.querySelector('#job-calc-receipt-wrapper, .job-calc-receipt-wrapper');
      if (summaryCard) summaryCard.style.display = '';
      if (receiptWrapper) receiptWrapper.style.display = 'none';

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
