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
                if (!job.splitsByRange || typeof job.splitsByRange !== 'object') {
                  job.splitsByRange = {};
                }
                if (!job.expenseSplitsByRange || typeof job.expenseSplitsByRange !== 'object') {
                  job.expenseSplitsByRange = {};
                }
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
            customJobs: Array.isArray(parsed.customJobs) ? parsed.customJobs.map((c) => ({
              ...c,
              splits: Array.isArray(c.splits) && c.splits.length > 0 ? c.splits : [{
                shifts: parseInt(c.shiftsCount, 10) || 1,
                hours: typeof c.hoursPerShift === 'number' ? c.hoursPerShift : (parseFloat(c.hoursPerShift) || 4)
              }]
            })) : [],
            customExpenses: Array.isArray(parsed.customExpenses) ? parsed.customExpenses.map((e) => ({
              ...e,
              type: e.type === 'percent' ? 'percent' : 'fixed',
              percentValue: typeof e.percentValue === 'number' ? e.percentValue : (parseFloat(e.percentValue) || 10),
              splits: Array.isArray(e.splits) && e.splits.length > 0 ? e.splits : [{ qty: 1, amount: typeof e.amount === 'number' ? e.amount : (parseFloat(e.amount) || 25) }]
            })) : []
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

          // Default to split mode unless user explicitly has custom date overrides
          const hasDateOverrides = job.dateOverrides && Object.keys(job.dateOverrides).length > 0;
          if (job.adjustMode === 'date' && hasDateOverrides) {
            cleanJob.adjustMode = 'date';
          } else {
            cleanJob.adjustMode = 'split';
          }

          // Persist range-scoped splits so other months never inherit old shift counts
          if (job.splitsByRange && typeof job.splitsByRange === 'object') {
            const cleanSplitsByRange = {};
            for (const [rKey, rSplits] of Object.entries(job.splitsByRange)) {
              if (Array.isArray(rSplits)) {
                const validSplits = rSplits
                  .map((s) => ({
                    shifts: parseInt(s.shifts, 10) || 0,
                    hours: parseFloat(s.hours) || 0
                  }))
                  .filter((s) => s.shifts > 0 || rSplits.length === 1);
                if (validSplits.length > 0) {
                  cleanSplitsByRange[rKey] = validSplits;
                }
              }
            }
            if (Object.keys(cleanSplitsByRange).length > 0) {
              cleanJob.splitsByRange = cleanSplitsByRange;
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
          cleanJob.expenseAdjustMode = job.expenseAdjustMode === 'date' ? 'date' : 'split';

          // Persist range-scoped expense splits so other months never inherit old shift counts
          if (job.expenseSplitsByRange && typeof job.expenseSplitsByRange === 'object') {
            const cleanExpSplitsByRange = {};
            for (const [rKey, rSplits] of Object.entries(job.expenseSplitsByRange)) {
              if (Array.isArray(rSplits)) {
                const validSplits = rSplits
                  .map((s) => ({
                    shifts: parseInt(s.shifts, 10) || 0,
                    amount: parseFloat(s.amount) || 0
                  }))
                  .filter((s) => s.shifts > 0 || rSplits.length === 1);
                if (validSplits.length > 0) {
                  cleanExpSplitsByRange[rKey] = validSplits;
                }
              }
            }
            if (Object.keys(cleanExpSplitsByRange).length > 0) {
              cleanJob.expenseSplitsByRange = cleanExpSplitsByRange;
            }
          }

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
      customJobs: (state.settings.customJobs || []).map((c) => ({
        id: c.id,
        name: c.name || 'Untitled',
        isPaid: c.isPaid !== false,
        isTaxable: c.isTaxable !== false,
        hourlyRate: typeof c.hourlyRate === 'number' ? c.hourlyRate : (parseFloat(c.hourlyRate) || 25),
        shiftsCount: parseInt(c.shiftsCount, 10) || 1,
        hoursPerShift: typeof c.hoursPerShift === 'number' ? c.hoursPerShift : (parseFloat(c.hoursPerShift) || 4),
        splits: Array.isArray(c.splits) && c.splits.length > 0 ? c.splits.map((s) => ({
          shifts: parseInt(s.shifts, 10) || 0,
          hours: parseFloat(s.hours) || 0
        })) : [{
          shifts: parseInt(c.shiftsCount, 10) || 1,
          hours: typeof c.hoursPerShift === 'number' ? c.hoursPerShift : (parseFloat(c.hoursPerShift) || 4)
        }]
      })),
      customExpenses: (state.settings.customExpenses || []).map((e) => ({
        id: e.id,
        name: e.name || 'Untitled',
        isExpense: e.isExpense !== false,
        type: e.type === 'percent' ? 'percent' : 'fixed',
        percentValue: typeof e.percentValue === 'number' ? e.percentValue : (parseFloat(e.percentValue) || 10),
        amount: typeof e.amount === 'number' ? e.amount : (parseFloat(e.amount) || 0),
        splits: Array.isArray(e.splits) && e.splits.length > 0 ? e.splits.map((s) => ({
          qty: parseInt(s.qty, 10) || 1,
          amount: typeof s.amount === 'number' ? s.amount : (parseFloat(s.amount) || 0)
        })) : [{ qty: 1, amount: typeof e.amount === 'number' ? e.amount : (parseFloat(e.amount) || 25) }]
      }))
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
        expenseAdjustMode: 'split',
        expenseSplitsByRange: {},
        defaultHours: 4,
        hourlyRate: 25,
        isTaxable: true,
        adjustMode: 'split',
        splits: [],
        splitsByRange: {},
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
      if (!state.settings.jobs[jobName].expenseAdjustMode) {
        state.settings.jobs[jobName].expenseAdjustMode = 'split';
      }
      if (!state.settings.jobs[jobName].expenseSplitsByRange || typeof state.settings.jobs[jobName].expenseSplitsByRange !== 'object') {
        state.settings.jobs[jobName].expenseSplitsByRange = {};
      }
      if (!state.settings.jobs[jobName].adjustMode) {
        state.settings.jobs[jobName].adjustMode = 'split';
      }
      if (!Array.isArray(state.settings.jobs[jobName].splits)) {
        state.settings.jobs[jobName].splits = [];
      }
      if (!state.settings.jobs[jobName].splitsByRange || typeof state.settings.jobs[jobName].splitsByRange !== 'object') {
        state.settings.jobs[jobName].splitsByRange = {};
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

  function roundCents(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
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
    const year = (typeof currentYearValue !== 'undefined' && currentYearValue !== null)
      ? currentYearValue
      : ((typeof currentYearVertView !== 'undefined' && currentYearVertView !== null) ? currentYearVertView : now.getFullYear());
    const month = (typeof currentMonthValue !== 'undefined' && currentMonthValue !== null)
      ? currentMonthValue
      : ((typeof currentMonthVertView !== 'undefined' && currentMonthVertView !== null) ? currentMonthVertView : now.getMonth());

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

  /**
   * Helper to identify the active calculation range (e.g. "2026-10" or "2026-10-01_2026-10-15")
   * to ensure split allocations are scoped properly and never bleed across months.
   */
  function getActiveRangeKey() {
    if (state.fromDate && state.toDate) {
      const fromM = state.fromDate.slice(0, 7);
      const toM = state.toDate.slice(0, 7);
      if (fromM === toM) return fromM;
      return `${state.fromDate}_${state.toDate}`;
    }
    return 'default';
  }

  /**
   * Retrieves or initializes splits for a job in the current active range.
   * If single-tier (default), its shift count ALWAYS dynamically matches the scanned occurrences count
   * in the active range, eliminating hardcoded shift count carry-over across months.
   */
  function getJobSplits(job, setting, count, defaultHours) {
    const safeCount = typeof count === 'number' && !isNaN(count) ? count : 0;
    const safeHours = typeof defaultHours === 'number' && !isNaN(defaultHours) ? defaultHours : (setting?.defaultHours ?? 4);
    const rangeKey = getActiveRangeKey();

    if (!setting.splitsByRange || typeof setting.splitsByRange !== 'object') {
      setting.splitsByRange = {};
    }

    let rangeSplits = setting.splitsByRange[rangeKey];

    // If not yet saved for this range, check if legacy setting.splits matches current count
    if ((!rangeSplits || !Array.isArray(rangeSplits) || rangeSplits.length === 0) && Array.isArray(setting.splits) && setting.splits.length > 0) {
      let legacyTotal = 0;
      setting.splits.forEach((s) => { legacyTotal += (parseInt(s.shifts, 10) || 0); });
      if (legacyTotal === safeCount && safeCount > 0) {
        rangeSplits = setting.splits.map((s) => ({
          shifts: parseInt(s.shifts, 10) || 0,
          hours: parseFloat(s.hours) || 0
        }));
        setting.splitsByRange[rangeKey] = rangeSplits;
      }
    }

    // If still no valid splits for this range, initialize single row with current range count
    if (!rangeSplits || !Array.isArray(rangeSplits) || rangeSplits.length === 0) {
      rangeSplits = [{ shifts: safeCount, hours: safeHours }];
      setting.splitsByRange[rangeKey] = rangeSplits;
      setting.splits = rangeSplits;
      return rangeSplits;
    }

    // Ensure all existing split rows have valid numeric values without overwriting user input
    rangeSplits.forEach((s) => {
      const numShifts = parseInt(s.shifts, 10);
      s.shifts = (!isNaN(numShifts) && numShifts >= 0) ? numShifts : safeCount;
      const numHours = parseFloat(s.hours);
      s.hours = (!isNaN(numHours) && numHours >= 0) ? numHours : safeHours;
    });

    setting.splits = rangeSplits;
    return rangeSplits;
  }

  /**
   * Retrieves or initializes expense splits for a calendar task in the current active range.
   * If single-tier (default), its shift/occurrence count dynamically matches the scanned count
   * in the active range, eliminating hardcoded shift count carry-over across months.
   */
  function getJobExpenseSplits(job, setting, count, defaultExpense) {
    const safeCount = typeof count === 'number' && !isNaN(count) ? count : 0;
    const safeAmount = typeof defaultExpense === 'number' && !isNaN(defaultExpense) ? defaultExpense : (setting?.expenseAmount ?? 25);
    const rangeKey = getActiveRangeKey();

    if (!setting.expenseSplitsByRange || typeof setting.expenseSplitsByRange !== 'object') {
      setting.expenseSplitsByRange = {};
    }

    let rangeSplits = setting.expenseSplitsByRange[rangeKey];

    // If still no valid splits for this range, initialize single row with current range count
    if (!rangeSplits || !Array.isArray(rangeSplits) || rangeSplits.length === 0) {
      rangeSplits = [{ shifts: safeCount, amount: safeAmount }];
      setting.expenseSplitsByRange[rangeKey] = rangeSplits;
      return rangeSplits;
    }

    // Ensure all existing split rows have valid numeric values without overwriting user input
    rangeSplits.forEach((s) => {
      const numShifts = parseInt(s.shifts, 10);
      s.shifts = (!isNaN(numShifts) && numShifts >= 0) ? numShifts : safeCount;
      const numAmount = parseFloat(s.amount);
      s.amount = (!isNaN(numAmount) && numAmount >= 0) ? numAmount : safeAmount;
    });

    return rangeSplits;
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

        if (setting.adjustMode === 'split') {
          const splits = getJobSplits(job, setting, count, defaultHours);
          jobSessions = 0;
          splits.forEach((s) => {
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
      let expSessions = count;
      if (setting.isExpense) {
        const defaultExpAmt = parseFloat(setting.expenseAmount) || 0;
        if (setting.expenseAdjustMode !== 'date') {
          const expSplits = getJobExpenseSplits(job, setting, count, defaultExpAmt);
          expSessions = 0;
          expSplits.forEach((s) => {
            const sCount = parseInt(s.shifts, 10) || 0;
            const sAmount = parseFloat(s.amount) || 0;
            jobExpenseTotal += (sCount * sAmount);
            expSessions += sCount;
          });
        } else {
          job.occurrences.forEach((occ) => {
            const overrideVal = setting.expenseOverrides?.[occ.occKey];
            const occExp = (typeof overrideVal === 'number' && !isNaN(overrideVal))
              ? overrideVal
              : defaultExpAmt;

            jobExpenseTotal += occExp;
          });
        }

        jobExpenseTotal = roundCents(jobExpenseTotal);
        totalExpenses += jobExpenseTotal;
      }

      const activeSplits = (setting.isPaid && setting.adjustMode === 'split') ? getJobSplits(job, setting, count, parseFloat(setting.defaultHours) || 0) : null;
      const activeExpSplits = (setting.isExpense && setting.expenseAdjustMode !== 'date') ? getJobExpenseSplits(job, setting, count, parseFloat(setting.expenseAmount) || 0) : null;

      let displayCountVal = count;
      if (setting.isPaid && activeSplits && activeSplits.length > 0) {
        displayCountVal = jobSessions;
      } else if (setting.isExpense && activeExpSplits && activeExpSplits.length > 0) {
        displayCountVal = expSessions;
      }

      jobResults[name] = {
        isPaid: setting.isPaid === true,
        isExpense: setting.isExpense === true,
        expenseAmount: parseFloat(setting.expenseAmount) || 0,
        expenseTotal: jobExpenseTotal,
        isTaxable: setting.isTaxable !== false,
        count: displayCountVal,
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
        const isTaxable = cJob.isTaxable !== false;

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
      } else {
        customResults[cJob.id] = {
          id: cJob.id,
          name: cJob.name || 'Untitled',
          count: parseInt(cJob.shiftsCount, 10) || 1,
          totalHours: 0,
          hourlyRate: parseFloat(cJob.hourlyRate) || 0,
          isTaxable: cJob.isTaxable !== false,
          subtotal: 0,
          isExcluded: true
        };
      }
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

    // Post-tax income: basis for percentage-based custom expenses
    const postTaxIncome = Math.max(0, roundCents(grossEarnings - taxDeductionAmount));

    // Custom / Off-calendar expenses
    const customExpenseResults = {};
    (state.settings.customExpenses || []).forEach((cExp) => {
      const isPercent = cExp.type === 'percent';
      const pctVal = typeof cExp.percentValue === 'number' ? cExp.percentValue : (parseFloat(cExp.percentValue) || 10);

      const splits = Array.isArray(cExp.splits) && cExp.splits.length > 0 ? cExp.splits : [{ qty: 1, amount: parseFloat(cExp.amount) || 0 }];
      let totalQty = 0;
      let totalFixedAmt = 0;
      splits.forEach((s) => {
        const q = parseInt(s.qty, 10) || 0;
        const a = parseFloat(s.amount) || 0;
        totalQty += q;
        totalFixedAmt += (q * a);
      });
      totalFixedAmt = roundCents(totalFixedAmt);

      let totalExpAmt = 0;
      if (isPercent) {
        totalExpAmt = postTaxIncome > 0 ? roundCents((postTaxIncome * pctVal) / 100) : 0;
      } else {
        totalExpAmt = totalFixedAmt;
      }

      if (cExp.isExpense !== false) {
        totalExpenses += totalExpAmt;
        customExpenseResults[cExp.id] = {
          id: cExp.id,
          name: cExp.name || 'Expense',
          count: isPercent ? 1 : totalQty,
          amount: totalExpAmt,
          splits: splits,
          isPercent: isPercent,
          percentValue: pctVal
        };
      } else {
        customExpenseResults[cExp.id] = {
          id: cExp.id,
          name: cExp.name || 'Expense',
          count: isPercent ? 1 : totalQty,
          amount: 0,
          splits: splits,
          isExcluded: true,
          isPercent: isPercent,
          percentValue: pctVal
        };
      }
    });

    grossEarnings = roundCents(grossEarnings);
    taxableEarnings = roundCents(taxableEarnings);
    totalExpenses = roundCents(totalExpenses);

    // Net Take-Home: Gross - Tax Deduction - Total Expenses (supports negative balance / deficit)
    const netTakeHome = roundCents(grossEarnings - taxDeductionAmount - totalExpenses);

    return {
      totalSessions,
      totalHours,
      grossEarnings,
      taxableEarnings,
      taxDeductionAmount,
      postTaxIncome,
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

  const RECEIPT_BARCODE_BARS = [
    4, 2, 2, 2, 5, 3, 2, 2, 4, 3, 2, 4, 3, 2, 5, 3, 2, 2, 4, 3,
    3, 2, 2, 4, 5, 3, 3, 3, 2, 4, 4, 3, 2, 3, 5, 3, 3, 2, 4, 3,
    2, 4, 3, 3, 5, 3, 2, 3, 4, 3, 3, 2, 2, 4, 4
  ];

  function getBarcodeSvgMarkup() {
    let x = 0;
    const rects = [];
    RECEIPT_BARCODE_BARS.forEach((w, idx) => {
      if (idx % 2 === 0) {
        rects.push(`<rect x="${x}" y="0" width="${w}" height="24" fill="#334155" />`);
      }
      x += w;
    });
    return `<svg class="receipt-barcode-svg" viewBox="0 0 ${x} 24" width="${x}" height="24" aria-hidden="true">${rects.join('')}</svg>`;
  }

  function ensureCalculatorDOM() {
    const existing = document.getElementById('job-calculator-container');
    if (state.injected && existing && existing.querySelector('#job-calc-receipt-wrapper') && !existing.querySelector('#receipt-btn-print') && existing.innerHTML.includes('EARNINGS STATEMENT') && !existing.innerHTML.includes('Paid Jobs (') && existing.innerHTML.includes('Earnings (') && existing.innerHTML.includes('Schedules') && existing.querySelector('.job-calc-btn-close') && existing.innerHTML.includes('job-calc-tax-field') && existing.querySelector('#job-calc-jobs-card') && existing.querySelector('#job-calc-add-custom-btn') && existing.querySelector('#job-calc-tab-expenses') && existing.querySelector('#job-calc-expense-summary-row') && existing.querySelector('#job-calc-post-tax-summary-row') && existing.querySelector('#receipt-expenses-section') && existing.querySelector('#receipt-post-tax-section') && existing.innerHTML.includes('Financial Summary') && existing.innerHTML.includes('Schedule Calculator') && !existing.querySelector('#job-calc-btn-quick-copy') && existing.querySelector('#job-calc-net-status-icon') && existing.querySelector('#job-calc-tax-symbol-toggle') && !existing.querySelector('#job-calc-tax-mode-toggle') && !existing.querySelector('#job-calc-tax-field #job-calc-tax-symbol-toggle') && existing.querySelector('#receipt-btn-download') && existing.querySelector('.receipt-barcode-svg')) {
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
              <h2 class="job-calc-title">Schedule Calculator</h2>
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
        
        <!-- 1. Date Range Section -->
        <section class="job-calc-date-section">
          <div class="job-calc-section-header">
            <span class="material-symbols-outlined job-calc-card-icon">calendar_month</span>
            <span class="job-calc-card-title">Date Range</span>
          </div>
          
          <div class="job-calc-card job-calc-date-card">
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
          </div>
        </section>

        <!-- 2. Schedules Section (Un-containerized Work Section) -->
        <section class="job-calc-jobs-section" id="job-calc-jobs-card">
          <div class="job-calc-section-header job-calc-jobs-header">
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

        <!-- 3. Financial Summary & Tax Deduction Section -->
        <section class="job-calc-summary-section">
          <div class="job-calc-section-header" id="job-calc-summary-header">
            <span class="material-symbols-outlined job-calc-card-icon">receipt_long</span>
            <span class="job-calc-card-title">Financial Summary</span>
          </div>

          <div class="job-calc-card job-calc-summary-card" id="job-calc-summary-card">
            <div class="job-calc-summary-metrics">
              <div class="job-calc-metric">
                <div class="job-calc-metric-header">
                  <span class="material-symbols-outlined job-calc-metric-icon">event_available</span>
                  <span class="job-calc-metric-label">Earning Shifts</span>
                </div>
                <span class="job-calc-metric-val" id="job-calc-sum-sessions">0x</span>
              </div>
              <div class="job-calc-metric">
                <div class="job-calc-metric-header">
                  <span class="material-symbols-outlined job-calc-metric-icon">schedule</span>
                  <span class="job-calc-metric-label">Total Hours</span>
                </div>
                <span class="job-calc-metric-val" id="job-calc-sum-hours">0.0 hrs</span>
              </div>
            </div>

            <div class="job-calc-summary-rows">
              <div class="job-calc-summary-row">
                <div class="job-calc-row-title-wrap">
                  <span class="job-calc-flow-dot flow-gross"></span>
                  <span class="job-calc-row-title">Gross Earnings</span>
                </div>
                <span class="job-calc-sum-bold" id="job-calc-sum-gross">$0.00</span>
              </div>

              <!-- Tax Deduction Row -->
              <div class="job-calc-summary-row job-calc-tax-row">
                <div class="job-calc-row-title-wrap">
                  <span class="job-calc-flow-dot flow-tax"></span>
                  <span class="job-calc-tax-title">Tax Deduction</span>
                </div>
                <div class="job-calc-tax-input-group">
                  <div class="job-calc-tax-field mode-percent" id="job-calc-tax-field">
                    <input type="number" id="job-calc-tax-input" class="job-calc-num-input job-calc-tax-val-input" min="0" step="1" placeholder="0">
                  </div>
                  <button type="button" class="job-calc-tax-symbol-toggle" id="job-calc-tax-symbol-toggle" title="Currently Percent (%) — click to switch to Dollar ($)">%</button>
                  <span class="job-calc-tax-deduction-amount" id="job-calc-tax-amount">-$0.00</span>
                </div>
              </div>

              <!-- Post-Tax Earnings Row (Visible whenever Tax Deduction > 0) -->
              <div class="job-calc-summary-row" id="job-calc-post-tax-summary-row" style="display: none;">
                <div class="job-calc-row-title-wrap">
                  <span class="job-calc-flow-dot flow-post-tax"></span>
                  <span class="job-calc-row-title">Post-Tax Earnings</span>
                </div>
                <span class="job-calc-sum-bold job-calc-post-tax-amount" id="job-calc-sum-post-tax">$0.00</span>
              </div>

              <!-- Expenses Row (Included only when expenses exist) -->
              <div class="job-calc-summary-row" id="job-calc-expense-summary-row" style="display: none;">
                <div class="job-calc-row-title-wrap">
                  <span class="job-calc-flow-dot flow-expense"></span>
                  <span class="job-calc-row-title">Expenses</span>
                </div>
                <span class="job-calc-expense-amount" id="job-calc-sum-expenses">-$0.00</span>
              </div>

              <div class="job-calc-divider"></div>

              <!-- Net Take-Home Row -->
              <div class="job-calc-summary-row job-calc-net-row" id="job-calc-net-row">
                <div class="job-calc-net-left">
                  <div class="job-calc-net-icon-wrap">
                    <span class="material-symbols-outlined job-calc-net-status-icon" id="job-calc-net-status-icon">trending_up</span>
                  </div>
                  <div class="job-calc-net-label-wrap">
                    <span class="job-calc-net-label">Net Take-Home Pay</span>
                    <span class="job-calc-net-sublabel">After tax & expenses</span>
                  </div>
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
          </div>
        </section>

        <!-- Retro "Receipt Ticket" Section (Swapped when user clicks View Breakdown) -->
        <section class="job-calc-receipt-wrapper" id="job-calc-receipt-wrapper" style="display: none;">
          <div class="job-calc-receipt-ticket" id="job-calc-receipt-ticket">
            <!-- Top-Right Actions: Download Image button -->
            <div class="receipt-top-actions">
              <button type="button" class="receipt-action-btn receipt-btn-download" id="receipt-btn-download" title="Save breakdown as image">
                <span class="material-symbols-outlined">download</span>
                <span class="receipt-action-btn-text">Save Image</span>
              </button>
            </div>

            <!-- Jagged Top Tear Edge -->
            <div class="receipt-edge receipt-edge-top"></div>

            <div class="receipt-inner">
              <!-- Header -->
              <div class="receipt-header">
                <div class="receipt-brand">EARNINGS STATEMENT</div>
                <div class="receipt-badge">★ EARNINGS & EXPENSES BREAKDOWN ★</div>
                <div class="receipt-meta">
                  <div class="receipt-meta-row">
                    <span>PERIOD:</span>
                    <span id="receipt-date-range">Selected Period</span>
                  </div>
                  <div class="receipt-meta-row">
                    <span>GENERATED:</span>
                    <span id="receipt-generated-date">Oct 18, 2026, 11:41 AM</span>
                  </div>
                </div>
              </div>

              <div class="receipt-divider-dash"></div>

              <!-- Earnings -->
              <div class="receipt-section" id="receipt-shifts-section">
                <div class="receipt-section-header">
                  <span>EARNINGS</span>
                  <span id="receipt-shifts-count">0x</span>
                </div>
                <div class="receipt-items-list" id="receipt-shifts-list">
                  <!-- Dynamic shift lines -->
                </div>
                <div class="receipt-subtotal-row">
                  <span>EARNINGS TOTAL (<span id="receipt-shifts-hours">0.0h</span>)</span>
                  <span id="receipt-shifts-subtotal">$0.00</span>
                </div>
              </div>

              <div class="receipt-divider-dash"></div>

              <!-- Gross Earnings -->
              <div class="receipt-gross-row">
                <span>GROSS EARNINGS</span>
                <span id="receipt-gross-amount">$0.00</span>
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

              <!-- Post-Tax Earnings (if tax was deducted) -->
              <div class="receipt-section" id="receipt-post-tax-section" style="display: none;">
                <div class="receipt-divider-dash"></div>
                <div class="receipt-post-tax-row">
                  <span>POST-TAX EARNINGS</span>
                  <span id="receipt-post-tax-amount">$0.00</span>
                </div>
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
                ${getBarcodeSvgMarkup()}
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
              <span>Back to Summary</span>
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

    // Tax Symbol Toggle (% vs $) inside input box
    const taxSymbolBtn = container.querySelector('#job-calc-tax-symbol-toggle');
    const taxInput = container.querySelector('#job-calc-tax-input');

    function toggleTaxMode() {
      const currentMode = state.settings.tax?.type === 'amount' ? 'amount' : 'percent';
      const newMode = currentMode === 'percent' ? 'amount' : 'percent';
      state.settings.tax.type = newMode;
      syncTaxModeUI(newMode);
      saveSettings();
      updateSummaryCard();
    }

    function syncTaxModeUI(mode) {
      const taxField = container.querySelector('#job-calc-tax-field');
      const symbolBtn = container.querySelector('#job-calc-tax-symbol-toggle');

      if (taxField) {
        taxField.classList.toggle('mode-percent', mode === 'percent');
        taxField.classList.toggle('mode-amount', mode === 'amount');
      }
      if (symbolBtn) {
        symbolBtn.textContent = mode === 'amount' ? '$' : '%';
        symbolBtn.title = mode === 'amount'
          ? 'Currently Dollar ($) — click to switch to Percent (%)'
          : 'Currently Percent (%) — click to switch to Dollar ($)';
        symbolBtn.setAttribute('aria-label', symbolBtn.title);
      }
    }

    if (taxSymbolBtn) {
      taxSymbolBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleTaxMode();
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
      const currentHeader = container.querySelector('#job-calc-summary-header');
      if (currentSummary) {
        currentSummary.style.display = 'none';
      }
      if (currentHeader) {
        currentHeader.style.display = 'none';
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
      const currentHeader = container.querySelector('#job-calc-summary-header');
      if (currentSummary) {
        currentSummary.style.display = '';
      }
      if (currentHeader) {
        currentHeader.style.display = '';
      }
      try {
        (currentSummary || currentHeader).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (_) {}
    }

    // Container delegated click listener handles receipt navigation, download, copy, and tax toggle cleanly without double-firing
    container.addEventListener('click', (e) => {
      if (e.target.closest('#job-calc-btn-view-receipt, .job-calc-btn-view-receipt')) {
        swapToReceiptTicket();
      } else if (e.target.closest('#job-calc-btn-back-summary, .job-calc-btn-back-summary')) {
        swapToBreakdownSummary();
      } else if (e.target.closest('#receipt-btn-download, .receipt-btn-download')) {
        handleDownloadReceiptImage();
      } else if (e.target.closest('#receipt-btn-copy, .receipt-btn-copy')) {
        handleCopyReceipt();
      } else if (e.target.closest('#job-calc-tax-symbol-toggle, .job-calc-tax-symbol-toggle')) {
        e.preventDefault();
        e.stopPropagation();
        toggleTaxMode();
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
      isTaxable: true,
      splits: [{ shifts: 1, hours: 4 }]
    });
    state.expandedJobs.add(newId);
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
      type: 'fixed',
      percentValue: 10,
      amount: 25,
      isExpense: true,
      splits: [{ qty: 1, amount: 25 }]
    });
    state.expandedJobs.add(newId);
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
    const activeCustomExpenses = customExpenses.filter((e) => e.isExpense !== false);

    const totalAllCount = allNames.length + customJobs.length + customExpenses.length;
    const totalPaidCount = paidNames.length + paidCustomJobs.length;
    const totalExpensesCount = expenseNames.length + activeCustomExpenses.length;

    if (countAllEl) countAllEl.textContent = totalAllCount;
    if (countPaidEl) countPaidEl.textContent = totalPaidCount;
    if (countExpensesEl) countExpensesEl.textContent = totalExpensesCount;

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
      visibleCustomExpenses = [...activeCustomExpenses];
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
              (isPaidTab || isExpTab) && !state.searchQuery && totalAllCount > 0
                ? `<button type="button" class="job-calc-empty-action-btn" id="job-calc-switch-to-all">
                     Browse All (${totalAllCount}) →
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

    const { jobResults, customResults, customExpenseResults, postTaxIncome } = calculateTotals();

    let html = '';
    const isAllTab = state.activeTab === 'all';

    // 1. Render Custom Expenses (in Expenses or All tab)
    visibleCustomExpenses.forEach((cExp) => {
      const isPercentMode = cExp.type === 'percent';
      const pctVal = typeof cExp.percentValue === 'number' ? cExp.percentValue : (parseFloat(cExp.percentValue) || 10);

      if (!Array.isArray(cExp.splits) || cExp.splits.length === 0) {
        cExp.splits = [{
          qty: 1,
          amount: typeof cExp.amount === 'number' ? cExp.amount : 25
        }];
      }

      let customExpTotalQty = 0;
      let customExpTotalAmt = 0;
      const canDeleteCustomExpSplit = cExp.splits.length > 1;

      let customExpRowsHtml = `
        <div class="job-calc-split-headers-row is-two-col">
          <span class="job-calc-split-col-header">Items</span>
          <span class="job-calc-split-col-header">Cost ($)</span>
        </div>
      `;

      cExp.splits.forEach((s, idx) => {
        const sQty = parseInt(s.qty, 10) || 0;
        const sAmt = parseFloat(s.amount) || 0;
        customExpTotalQty += sQty;
        customExpTotalAmt += (sQty * sAmt);

        customExpRowsHtml += `
          <div class="job-calc-split-row-item ${canDeleteCustomExpSplit ? 'is-swipeable' : ''}" data-split-index="${idx}" title="${canDeleteCustomExpSplit ? 'Swipe left to delete this split row (or type 0 in items)' : ''}">
            ${canDeleteCustomExpSplit ? `
              <div class="job-calc-split-delete-action">
                <button type="button" 
                        class="job-calc-custom-exp-split-delete-btn job-calc-split-delete-btn" 
                        data-split-index="${idx}" 
                        title="Delete split row" 
                        aria-label="Delete split row">
                  <span class="material-symbols-outlined">delete</span>
                </button>
              </div>
            ` : ''}
            <div class="job-calc-inputs-row is-two-col job-calc-split-row" data-split-index="${idx}">
              <div class="job-calc-input-block">
                <div class="job-calc-input-wrapper">
                  <input type="number" 
                         class="job-calc-custom-exp-split-qty-input job-calc-num-input" 
                         data-split-index="${idx}" 
                         min="0" 
                         step="1" 
                         value="${s.qty ?? 1}" 
                         aria-label="Items"
                         title="Enter items (swipe left or type 0 to remove this row)">
                  <span class="job-calc-unit">x</span>
                </div>
              </div>

              <div class="job-calc-input-block">
                <div class="job-calc-input-wrapper">
                  <span class="job-calc-prefix">$</span>
                  <input type="number" 
                         class="job-calc-custom-exp-split-amount-input job-calc-num-input" 
                         data-split-index="${idx}" 
                         min="0" 
                         step="0.5" 
                         value="${s.amount ?? 25}" 
                         placeholder="25"
                         aria-label="Cost">
                </div>
              </div>
            </div>
          </div>
        `;
      });

      const cExpRes = customExpenseResults?.[cExp.id] || {
        amount: isPercentMode ? (postTaxIncome > 0 ? roundCents((postTaxIncome * pctVal) / 100) : 0) : customExpTotalAmt,
        count: isPercentMode ? 1 : customExpTotalQty
      };

      const isCustomExpense = cExp.isExpense !== false;
      const expCheckClass = isCustomExpense ? 'is-expense' : 'is-unmarked';
      const expTriageIcon = isCustomExpense ? 'trending_down' : 'add';
      let expCardClass = 'job-calc-task-card job-calc-expense-card';
      if (isCustomExpense) expCardClass += ' is-expense';
      else expCardClass += ' is-unpaid is-excluded';

      html += `
        <div class="${expCardClass}" data-expense-id="${escapeHtml(cExp.id)}">
          
          <!-- Card Header / Main Row -->
          <div class="job-calc-card-main">
            <!-- Triage Box with Popover Menu -->
            <div class="job-calc-triage-wrap">
              <button type="button" 
                      class="job-calc-triage-btn ${expCheckClass}" 
                      data-action="open-triage-menu" 
                      title="${isCustomExpense ? 'Expenses (Click to change or exclude)' : 'Categorize Custom Expense'}">
                <span class="material-symbols-outlined job-calc-triage-icon" style="font-size: 15px !important;">${expTriageIcon}</span>
              </button>

              <!-- Popover Menu -->
              <div class="job-calc-triage-popover hidden">
                <div class="job-calc-triage-popover-header">Custom Expense</div>
                <button type="button" class="job-calc-triage-option option-expense ${isCustomExpense ? 'selected' : ''}" data-custom-exp-triage="expense" data-expense-id="${escapeHtml(cExp.id)}">
                  <div class="job-calc-triage-option-icon"><span class="material-symbols-outlined">trending_down</span></div>
                  <span class="job-calc-triage-option-title">Expenses</span>
                  ${isCustomExpense ? '<span class="material-symbols-outlined job-calc-option-check">check</span>' : ''}
                </button>
                <div class="job-calc-triage-popover-divider"></div>
                <button type="button" class="job-calc-triage-option option-unmark ${!isCustomExpense ? 'selected' : ''}" data-custom-exp-triage="exclude" data-expense-id="${escapeHtml(cExp.id)}">
                  <div class="job-calc-triage-option-icon"><span class="material-symbols-outlined">cancel</span></div>
                  <span class="job-calc-triage-option-title">Exclude</span>
                  ${!isCustomExpense ? '<span class="material-symbols-outlined job-calc-option-check">check</span>' : ''}
                </button>
                <button type="button" class="job-calc-triage-option option-delete" data-custom-exp-triage="delete" data-expense-id="${escapeHtml(cExp.id)}">
                  <div class="job-calc-triage-option-icon"><span class="material-symbols-outlined">delete</span></div>
                  <span class="job-calc-triage-option-title">Delete Permanently</span>
                </button>
              </div>
            </div>

            <div class="job-calc-color-indicator job-calc-expense-indicator ${!isCustomExpense ? 'is-excluded' : ''}" title="Custom Expenses"></div>

            <div class="job-calc-card-info">
              <div class="job-calc-title-row">
                <input type="text" 
                       class="job-calc-expense-name-input" 
                       value="${escapeHtml(cExp.name || 'Untitled')}" 
                       placeholder="Untitled" 
                       size="${Math.max(1, (cExp.name || 'Untitled').length)}">
                <span class="job-calc-session-badge">${isPercentMode ? `${pctVal}%` : `${customExpTotalQty}x`}</span>
              </div>
              ${!isCustomExpense ? '<div class="job-calc-tagline">Excluded</div>' : ''}
            </div>

            <!-- Subtotal Pill -->
            ${isCustomExpense ? `
              <div class="job-calc-subtotal-badge job-calc-expense-badge">
                <span class="job-calc-subtotal-amount">-$${cExpRes.amount.toFixed(2)}</span>
              </div>
            ` : ''}
          </div>

          <!-- Config Section (Visible when Active Expense) -->
          ${isCustomExpense ? `
            <div class="job-calc-card-config">
              <div class="job-calc-groups-wrap">
                ${isPercentMode ? `
                  <div class="job-calc-percent-exp-wrap">
                    <div class="job-calc-split-headers-row is-two-col">
                      <span class="job-calc-split-col-header">% of Earnings</span>
                      <span class="job-calc-split-col-header">Post-Tax Earnings</span>
                    </div>
                    <div class="job-calc-inputs-row is-two-col">
                      <div class="job-calc-input-block">
                        <div class="job-calc-input-wrapper">
                          <input type="number" 
                                 class="job-calc-custom-exp-percent-input job-calc-num-input" 
                                 min="0" 
                                 max="100" 
                                 step="0.5" 
                                 value="${pctVal}" 
                                 placeholder="10"
                                 aria-label="Percentage of post-tax earnings">
                          <span class="job-calc-unit">%</span>
                        </div>
                      </div>

                      <div class="job-calc-input-block">
                        <div class="job-calc-percent-of-wrap">
                          <span class="job-calc-percent-of-text">of <strong>$${(postTaxIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> post-tax</span>
                        </div>
                      </div>
                    </div>
                    <div class="job-calc-percent-calc-hint">
                      Automatically calculated from your post-tax earnings.
                    </div>
                  </div>
                ` : `
                  ${customExpRowsHtml}
                `}
              </div>
              <div class="job-calc-adjust-bar is-split-mode">
                <div class="job-calc-split-bar-left">
                  ${!isPercentMode ? `
                    <button type="button" class="job-calc-add-custom-exp-split-btn job-calc-add-split-btn" title="Add another expense split row">
                      <span class="material-symbols-outlined">add</span>
                      <span>Add Split</span>
                    </button>
                  ` : `
                    <span class="job-calc-split-tag is-complete">% of Post-Tax</span>
                  `}
                </div>

                <button type="button" 
                        class="job-calc-custom-exp-type-toggle job-calc-mode-swap-btn" 
                        title="${isPercentMode ? 'Switch to Fixed Amount ($)' : 'Switch to Percentage of Post-Tax Earnings (%)'}">
                  <span class="material-symbols-outlined">swap_horiz</span>
                  <span>${isPercentMode ? 'Fixed ($)' : '% of Earnings'}</span>
                </button>
              </div>
            </div>
          ` : ''}

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

      const isCustomPaid = cJob.isPaid !== false;
      const customCheckClass = isCustomPaid ? 'is-paid' : 'is-unmarked';
      const customTriageIcon = isCustomPaid ? 'trending_up' : 'add';
      let customCardClass = 'job-calc-task-card job-calc-custom-card';
      if (isCustomPaid) customCardClass += ' is-paid';
      else customCardClass += ' is-unpaid is-excluded';
      const isJobAccordionOpen = state.expandedJobs.has(cJob.id);

      html += `
        <div class="${customCardClass}" data-custom-id="${escapeHtml(cJob.id)}">
          
          <!-- Card Header / Main Row -->
          <div class="job-calc-card-main">
            <!-- Triage Box with Popover Menu -->
            <div class="job-calc-triage-wrap">
              <button type="button" 
                      class="job-calc-triage-btn ${customCheckClass}" 
                      data-action="open-triage-menu" 
                      title="${isCustomPaid ? 'Earnings (Click to change or exclude)' : 'Categorize Custom Earnings'}">
                <span class="material-symbols-outlined job-calc-triage-icon" style="font-size: 15px !important;">${customTriageIcon}</span>
              </button>

              <!-- Popover Menu -->
              <div class="job-calc-triage-popover hidden">
                <div class="job-calc-triage-popover-header">Custom Earnings</div>
                <button type="button" class="job-calc-triage-option option-paid ${isCustomPaid ? 'selected' : ''}" data-custom-job-triage="paid" data-custom-id="${escapeHtml(cJob.id)}">
                  <div class="job-calc-triage-option-icon"><span class="material-symbols-outlined">trending_up</span></div>
                  <span class="job-calc-triage-option-title">Earnings</span>
                  ${isCustomPaid ? '<span class="material-symbols-outlined job-calc-option-check">check</span>' : ''}
                </button>
                <div class="job-calc-triage-popover-divider"></div>
                <button type="button" class="job-calc-triage-option option-unmark ${!isCustomPaid ? 'selected' : ''}" data-custom-job-triage="exclude" data-custom-id="${escapeHtml(cJob.id)}">
                  <div class="job-calc-triage-option-icon"><span class="material-symbols-outlined">cancel</span></div>
                  <span class="job-calc-triage-option-title">Exclude</span>
                  ${!isCustomPaid ? '<span class="material-symbols-outlined job-calc-option-check">check</span>' : ''}
                </button>
                <button type="button" class="job-calc-triage-option option-delete" data-custom-job-triage="delete" data-custom-id="${escapeHtml(cJob.id)}">
                  <div class="job-calc-triage-option-icon"><span class="material-symbols-outlined">delete</span></div>
                  <span class="job-calc-triage-option-title">Delete Permanently</span>
                </button>
              </div>
            </div>

            <div class="job-calc-color-indicator job-calc-custom-indicator ${!isCustomPaid ? 'is-excluded' : ''}" title="Custom Earnings"></div>

            <div class="job-calc-card-info">
              <div class="job-calc-title-row">
                <input type="text" 
                       class="job-calc-custom-name-input" 
                       value="${escapeHtml(cJob.name || 'Untitled')}" 
                       placeholder="Untitled"
                       size="${Math.max(1, (cJob.name || 'Untitled').length)}">
                <span class="job-calc-session-badge">${customTotalShifts}x</span>
              </div>
              ${isCustomPaid ? `
                <label class="job-calc-taxable-check-row" title="${cJob.isTaxable !== false ? 'Subject to tax deduction' : 'Untaxed earnings'}">
                  <input type="checkbox" class="job-calc-custom-taxable-checkbox" ${cJob.isTaxable !== false ? 'checked' : ''}>
                  <span class="job-calc-taxable-check-box"></span>
                  <span class="job-calc-taxable-check-text">Taxable</span>
                </label>
              ` : `
                <div class="job-calc-tagline">Excluded</div>
              `}
            </div>

            <!-- Subtotal Pill -->
            ${isCustomPaid ? `
              <div class="job-calc-subtotal-badge">
                <span class="job-calc-subtotal-amount">$${cRes.subtotal.toFixed(2)}</span>
                <span class="job-calc-subtotal-hours">${cRes.totalHours.toFixed(1)} hrs</span>
              </div>
            ` : ''}
          </div>

          <!-- Config Section (Visible when Active Paid) -->
          ${isCustomPaid ? `
            <div class="job-calc-card-config">
              <div class="job-calc-groups-wrap">
                ${customRowsHtml}
              </div>
              <div class="job-calc-adjust-bar is-split-mode">
                <div class="job-calc-split-bar-left">
                  <button type="button" class="job-calc-add-custom-split-btn job-calc-add-split-btn" title="Add another shift split row">
                    <span class="material-symbols-outlined">add</span>
                    <span>Add Split</span>
                  </button>
                </div>
              </div>
            </div>
          ` : ''}

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
      const splits = getJobSplits(job, setting, count, setting.defaultHours ?? 4);
      splits.forEach((s) => { splitAllocated += (parseInt(s.shifts, 10) || 0); });
      const splitRemaining = count - splitAllocated;
      const displayCount = (isSplitMode && splitAllocated > 0) ? splitAllocated : count;

      const isExpSplitMode = isExpense && setting.expenseAdjustMode !== 'date';
      let expSplitAllocated = 0;
      const expSplits = getJobExpenseSplits(job, setting, count, setting.expenseAmount ?? 25);
      expSplits.forEach((s) => { expSplitAllocated += (parseInt(s.shifts, 10) || 0); });
      const expSplitRemaining = count - expSplitAllocated;
      const displayExpCount = (isExpSplitMode && expSplitAllocated > 0) ? expSplitAllocated : count;
      const finalDisplayCount = isExpense ? displayExpCount : displayCount;

      let cardClass = 'job-calc-task-card';
      if (isPaid) cardClass += ' is-paid';
      else if (isExpense) cardClass += ' is-expense';
      else cardClass += ' is-unpaid';

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
                <span class="job-calc-session-badge">${finalDisplayCount}x</span>
              </div>
              ${isPaid ? `
                <label class="job-calc-taxable-check-row" title="${setting.isTaxable !== false ? 'Subject to tax deduction' : 'Untaxed earnings'}">
                  <input type="checkbox" class="job-calc-taxable-checkbox" ${setting.isTaxable !== false ? 'checked' : ''}>
                  <span class="job-calc-taxable-check-box"></span>
                  <span class="job-calc-taxable-check-text">Taxable</span>
                </label>
              ` : (isExpense ? '' : `
                <div class="job-calc-tagline">
                  Excluded
                </div>
              `)}
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
                      <button type="button" class="job-calc-calendar-add-split-btn job-calc-add-split-btn" title="Add another split row">
                        <span class="material-symbols-outlined">add</span>
                        <span>Add Split</span>
                      </button>
                      <span class="job-calc-split-tag ${splitRemaining === 0 ? 'is-complete' : (splitRemaining > 0 ? 'is-pending' : 'is-over')}">
                        ${splitRemaining === 0 ? `${count} shifts ✔` : `${splitAllocated}/${count} shifts`}
                      </span>
                    </div>

                    <button type="button" 
                            class="job-calc-calendar-mode-swap-btn job-calc-mode-swap-btn" 
                            data-mode="date" 
                            title="Switch back to individual calendar dates">
                      <span class="material-symbols-outlined">swap_horiz</span>
                      <span>By Date</span>
                    </button>
                  </div>
                ` : `
                  <div class="job-calc-adjust-bar">
                    <button type="button" class="job-calc-accordion-btn job-calc-calendar-accordion-btn ${isAccordionOpen ? 'active' : ''}">
                      <span class="material-symbols-outlined job-calc-accordion-arrow">
                        ${isAccordionOpen ? 'expand_less' : 'expand_more'}
                      </span>
                      <span>Adjust Dates (${count})</span>
                    </button>

                    ${count > 1 ? `
                      <button type="button" 
                              class="job-calc-calendar-mode-swap-btn job-calc-mode-swap-btn" 
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

                <!-- Adjust Bar: In Split Mode shows Add Split and By Date swapper (NO accordion) -->
                ${isExpSplitMode ? `
                  <div class="job-calc-adjust-bar is-split-mode">
                    <div class="job-calc-split-bar-left">
                      <button type="button" class="job-calc-add-calendar-exp-split-btn job-calc-add-split-btn" title="Add another expense split row">
                        <span class="material-symbols-outlined">add</span>
                        <span>Add Split</span>
                      </button>
                      <span class="job-calc-split-tag ${expSplitRemaining === 0 ? 'is-complete' : (expSplitRemaining > 0 ? 'is-pending' : 'is-over')}">
                        ${expSplitRemaining === 0 ? `${count} items ✔` : `${expSplitAllocated}/${count} items`}
                      </span>
                    </div>

                    <button type="button" 
                            class="job-calc-exp-mode-swap-btn job-calc-mode-swap-btn" 
                            data-mode="date" 
                            title="Switch back to individual calendar dates">
                      <span class="material-symbols-outlined">swap_horiz</span>
                      <span>By Date</span>
                    </button>
                  </div>
                ` : `
                  <div class="job-calc-adjust-bar">
                    <button type="button" class="job-calc-accordion-btn job-calc-calendar-accordion-btn ${isAccordionOpen ? 'active' : ''}">
                      <span class="material-symbols-outlined job-calc-accordion-arrow">
                        ${isAccordionOpen ? 'expand_less' : 'expand_more'}
                      </span>
                      <span>Adjust Dates (${count})</span>
                    </button>

                    ${count > 1 ? `
                      <button type="button" 
                              class="job-calc-exp-mode-swap-btn job-calc-mode-swap-btn" 
                              data-mode="split" 
                              title="Switch to split items">
                        <span class="material-symbols-outlined">swap_horiz</span>
                        <span>Split</span>
                      </button>
                    ` : ''}
                  </div>

                  <!-- Accordion Dates List -->
                  <div class="job-calc-dates-accordion ${isAccordionOpen ? '' : 'hidden'}">
                    ${renderExpenseOccurrencesHtml(job, setting)}
                  </div>
                `}
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
      const splits = getJobSplits(job, setting, count, setting.defaultHours ?? 4);

      const canDeleteSplit = splits.length > 1;
      let splitRowsHtml = `
        <div class="job-calc-split-headers-row">
          <span class="job-calc-split-col-header">Shifts</span>
          <span class="job-calc-split-col-header">Hours / Shift</span>
          <span class="job-calc-split-col-header">Rate ($/hr)</span>
        </div>
      `;

      splits.forEach((s, idx) => {
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
    const count = (job.occurrences || []).length;
    const defaultExp = typeof setting.expenseAmount === 'number' ? setting.expenseAmount : 25;

    // Split Mode:
    if (setting.expenseAdjustMode !== 'date') {
      const expSplits = getJobExpenseSplits(job, setting, count, defaultExp);
      const canDeleteExpSplit = expSplits.length > 1;

      let splitRowsHtml = `
        <div class="job-calc-split-headers-row is-two-col">
          <span class="job-calc-split-col-header">Items</span>
          <span class="job-calc-split-col-header">Cost ($)</span>
        </div>
      `;

      expSplits.forEach((s, idx) => {
        splitRowsHtml += `
          <div class="job-calc-split-row-item ${canDeleteExpSplit ? 'is-swipeable' : ''}" data-split-index="${idx}" title="${canDeleteExpSplit ? 'Swipe left to delete this split row (or type 0 in items)' : ''}">
            ${canDeleteExpSplit ? `
              <div class="job-calc-split-delete-action">
                <button type="button" 
                        class="job-calc-calendar-exp-split-delete-btn job-calc-split-delete-btn" 
                        data-split-index="${idx}" 
                        title="Delete split row" 
                        aria-label="Delete split row">
                  <span class="material-symbols-outlined">delete</span>
                </button>
              </div>
            ` : ''}
            <div class="job-calc-inputs-row is-two-col job-calc-split-row" data-split-index="${idx}">
              <div class="job-calc-input-block">
                <div class="job-calc-input-wrapper">
                  <input type="number" 
                         class="job-calc-calendar-exp-split-shifts-input job-calc-num-input" 
                         data-split-index="${idx}" 
                         min="0" 
                         step="1" 
                         value="${s.shifts}" 
                         aria-label="Items"
                         title="Enter items (swipe left or type 0 to remove this row)">
                  <span class="job-calc-unit">x</span>
                </div>
              </div>

              <div class="job-calc-input-block">
                <div class="job-calc-input-wrapper">
                  <span class="job-calc-prefix">$</span>
                  <input type="number" 
                         class="job-calc-calendar-exp-split-amount-input job-calc-num-input" 
                         data-split-index="${idx}" 
                         min="0" 
                         step="0.5" 
                         value="${s.amount ?? defaultExp}" 
                         aria-label="Cost per item">
                </div>
              </div>
            </div>
          </div>
        `;
      });

      return splitRowsHtml;
    }

    // By Date Mode (single default input)
    return `
      <div class="job-calc-inputs-row">
        <div class="job-calc-input-block" style="flex: 1; grid-column: 1 / -1;">
          <label>Default Cost ($)</label>
          <div class="job-calc-input-wrapper">
            <span class="job-calc-prefix">$</span>
            <input type="number" class="job-calc-calendar-expense-input job-calc-num-input" min="0" step="0.5" value="${defaultExp}">
          </div>
        </div>
      </div>
    `;
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
    const splits = getJobSplits(job, setting, count, setting.defaultHours ?? 4);
    (splits || []).forEach((s) => {
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

  function updateCardExpenseSplitTag(card, job, setting) {
    if (!card || !job || !setting) return;
    const tagEl = card.querySelector('.job-calc-split-tag');
    if (!tagEl) return;
    const count = job.occurrences ? job.occurrences.length : 0;
    let allocated = 0;
    const expSplits = getJobExpenseSplits(job, setting, count, setting.expenseAmount ?? 25);
    (expSplits || []).forEach((s) => {
      allocated += (parseInt(s.shifts, 10) || 0);
    });
    const remaining = count - allocated;

    tagEl.className = 'job-calc-split-tag';
    if (remaining === 0) {
      tagEl.classList.add('is-complete');
      tagEl.textContent = `${count} items ✔`;
    } else if (remaining > 0) {
      tagEl.classList.add('is-pending');
      tagEl.textContent = `${allocated}/${count} items`;
    } else {
      tagEl.classList.add('is-over');
      tagEl.textContent = `${allocated}/${count} items`;
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
          if (!setting.adjustMode) setting.adjustMode = 'split';
          const job = scannedJobs[jobName];
          const count = job && job.occurrences ? job.occurrences.length : 1;
          getJobSplits(job, setting, count, setting.defaultHours ?? 4);
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

    // 4. Calendar Accordion Toggle
    listEl.querySelectorAll('.job-calc-calendar-accordion-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        const accordion = card.querySelector('.job-calc-dates-accordion');
        if (!accordion) return;
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

    // 4b. Calendar Mode Swapper (By Date vs Split)
    listEl.querySelectorAll('.job-calc-calendar-mode-swap-btn').forEach((btn) => {
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
          getJobSplits(job, setting, count, setting.defaultHours ?? 4);
        }

        saveSettings();
        renderTasksList();
        updateSummaryCard();
      });
    });

    // 4c. Calendar Split Mode: Add Split Row Button
    listEl.querySelectorAll('.job-calc-calendar-add-split-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = e.target.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        const job = scannedJobs[jobName];
        if (!job) return;
        const setting = getJobSetting(jobName);
        const count = job.occurrences ? job.occurrences.length : 0;
        const splits = getJobSplits(job, setting, count, setting.defaultHours ?? 4);

        let allocated = 0;
        splits.forEach((s) => { allocated += (parseInt(s.shifts, 10) || 0); });
        const remaining = count - allocated;
        const newShifts = remaining > 0 ? remaining : 1;

        splits.push({
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
        const count = job.occurrences ? job.occurrences.length : 0;
        const splits = getJobSplits(job, setting, count, setting.defaultHours ?? 4);
        const idx = parseInt(input.dataset.splitIndex, 10);
        if (!splits || !splits[idx]) return;

        const val = parseInt(e.target.value, 10);
        splits[idx].shifts = isNaN(val) ? 0 : Math.max(0, val);

        updateCardSplitTag(card, job, setting);
        saveSettings();
        updateCardSubtotal(card, jobName);
        updateSummaryCard();
      });

      const handleRemoveOnZero = () => {
        const card = input.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        const job = scannedJobs[jobName];
        const setting = getJobSetting(jobName);
        const count = job ? (job.occurrences ? job.occurrences.length : 0) : 0;
        const splits = getJobSplits(job, setting, count, setting.defaultHours ?? 4);
        const idx = parseInt(input.dataset.splitIndex, 10);
        if (!splits || !splits[idx]) return;

        const val = parseInt(input.value, 10);
        // Auto-remove row if shifts is 0 or empty (keeping at least one row)
        if (val === 0 || isNaN(val) || input.value.trim() === '' || input.value.trim() === '0') {
          if (splits.length > 1) {
            splits.splice(idx, 1);
            saveSettings();
            renderTasksList();
            updateSummaryCard();
            return;
          } else {
            splits[0].shifts = count > 0 ? count : 1;
            input.value = splits[0].shifts;
            saveSettings();
            updateCardSubtotal(card, jobName);
            updateSummaryCard();
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
        const job = scannedJobs[jobName];
        const setting = getJobSetting(jobName);
        const count = job ? (job.occurrences ? job.occurrences.length : 0) : 0;
        const splits = getJobSplits(job, setting, count, setting.defaultHours ?? 4);
        const idx = parseInt(input.dataset.splitIndex, 10);
        if (!splits || !splits[idx]) return;

        const val = parseFloat(e.target.value);
        splits[idx].hours = isNaN(val) ? 0 : Math.max(0, val);

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
            const job = scannedJobs[jobName];
            const setting = getJobSetting(jobName);
            const count = job ? (job.occurrences ? job.occurrences.length : 0) : 0;
            const splits = getJobSplits(job, setting, count, setting.defaultHours ?? 4);
            const idx = parseInt(input.dataset.splitIndex, 10);
            if (splits && splits[idx]) {
              splits[idx].hours = 0;
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
        const job = scannedJobs[jobName];
        const setting = getJobSetting(jobName);
        const count = job ? (job.occurrences ? job.occurrences.length : 0) : 0;
        const splits = getJobSplits(job, setting, count, setting.defaultHours ?? 4);
        const idx = parseInt(btn.dataset.splitIndex, 10);
        if (!splits || splits.length <= 1) return; // Keep at least 1 row
        if (isNaN(idx) || idx < 0 || idx >= splits.length) return;

        const rowItem = btn.closest('.job-calc-split-row-item');
        if (rowItem) {
          rowItem.style.transition = 'opacity 0.15s ease, max-height 0.18s ease';
          rowItem.style.opacity = '0';
          rowItem.style.maxHeight = '0px';
          setTimeout(() => {
            splits.splice(idx, 1);
            saveSettings();
            renderTasksList();
            updateSummaryCard();
          }, 150);
        } else {
          splits.splice(idx, 1);
          saveSettings();
          renderTasksList();
          updateSummaryCard();
        }
      });
    });

    // 4g. Calendar Expense Mode Swapper (By Date vs Split)
    listEl.querySelectorAll('.job-calc-exp-mode-swap-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = e.target.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        const job = scannedJobs[jobName];
        if (!job) return;
        const setting = getJobSetting(jobName);
        const mode = btn.dataset.mode;

        if (setting.expenseAdjustMode === mode) return;

        setting.expenseAdjustMode = mode;
        if (mode === 'split') {
          const count = job.occurrences ? job.occurrences.length : 0;
          getJobExpenseSplits(job, setting, count, setting.expenseAmount ?? 25);
        }

        saveSettings();
        renderTasksList();
        updateSummaryCard();
      });
    });

    // 4h. Calendar Expense Split Mode: Add Split Row Button
    listEl.querySelectorAll('.job-calc-add-calendar-exp-split-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = e.target.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        const job = scannedJobs[jobName];
        if (!job) return;
        const setting = getJobSetting(jobName);
        const count = job.occurrences ? job.occurrences.length : 0;
        const expSplits = getJobExpenseSplits(job, setting, count, setting.expenseAmount ?? 25);

        let allocated = 0;
        expSplits.forEach((s) => { allocated += (parseInt(s.shifts, 10) || 0); });
        const remaining = count - allocated;
        const newShifts = remaining > 0 ? remaining : 1;
        const defaultAmt = expSplits[expSplits.length - 1]?.amount ?? (setting.expenseAmount ?? 25);

        expSplits.push({
          shifts: newShifts,
          amount: defaultAmt
        });

        saveSettings();
        renderTasksList();
        updateSummaryCard();
      });
    });

    // 4i. Calendar Expense Split Mode: Shifts Input
    listEl.querySelectorAll('.job-calc-calendar-exp-split-shifts-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        const job = scannedJobs[jobName];
        const setting = getJobSetting(jobName);
        const count = job.occurrences ? job.occurrences.length : 0;
        const expSplits = getJobExpenseSplits(job, setting, count, setting.expenseAmount ?? 25);
        const idx = parseInt(input.dataset.splitIndex, 10);
        if (!expSplits || !expSplits[idx]) return;

        const val = parseInt(e.target.value, 10);
        expSplits[idx].shifts = isNaN(val) ? 0 : Math.max(0, val);

        updateCardExpenseSplitTag(card, job, setting);
        saveSettings();
        updateCardExpenseBadge(card, jobName);
        updateSummaryCard();
      });

      const handleRemoveOnZero = () => {
        const card = input.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        const job = scannedJobs[jobName];
        const setting = getJobSetting(jobName);
        const count = job.occurrences ? job.occurrences.length : 0;
        const expSplits = getJobExpenseSplits(job, setting, count, setting.expenseAmount ?? 25);
        const idx = parseInt(input.dataset.splitIndex, 10);
        if (!expSplits || !expSplits[idx]) return;

        const val = parseInt(input.value, 10);
        if (val === 0 || isNaN(val) || input.value.trim() === '' || input.value.trim() === '0') {
          if (expSplits.length > 1) {
            expSplits.splice(idx, 1);
            saveSettings();
            renderTasksList();
            updateSummaryCard();
            return;
          } else {
            expSplits[0].shifts = count > 0 ? count : 1;
            input.value = expSplits[0].shifts;
            updateCardExpenseSplitTag(card, job, setting);
            saveSettings();
            updateCardExpenseBadge(card, jobName);
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

    // 4j. Calendar Expense Split Mode: Amount Input
    listEl.querySelectorAll('.job-calc-calendar-exp-split-amount-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        const job = scannedJobs[jobName];
        const setting = getJobSetting(jobName);
        const count = job.occurrences ? job.occurrences.length : 0;
        const expSplits = getJobExpenseSplits(job, setting, count, setting.expenseAmount ?? 25);
        const idx = parseInt(input.dataset.splitIndex, 10);
        if (!expSplits || !expSplits[idx]) return;

        const val = parseFloat(e.target.value);
        expSplits[idx].amount = isNaN(val) ? 0 : Math.max(0, val);

        saveSettings();
        updateCardExpenseBadge(card, jobName);
        updateSummaryCard();
      });

      input.addEventListener('blur', (e) => {
        if (e.target.value.trim() === '') {
          e.target.value = 0;
        }
      });
    });

    // 4k. Calendar Expense Split Mode: Delete Row Button
    listEl.querySelectorAll('.job-calc-calendar-exp-split-delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.job-calc-task-card');
        if (!card) return;
        const jobName = card.dataset.jobName;
        const job = scannedJobs[jobName];
        const setting = getJobSetting(jobName);
        const count = job ? (job.occurrences ? job.occurrences.length : 0) : 0;
        const expSplits = getJobExpenseSplits(job, setting, count, setting.expenseAmount ?? 25);
        const idx = parseInt(btn.dataset.splitIndex, 10);
        if (!expSplits || expSplits.length <= 1) return; // Keep at least 1 row
        if (isNaN(idx) || idx < 0 || idx >= expSplits.length) return;

        const rowItem = btn.closest('.job-calc-split-row-item');
        if (rowItem) {
          rowItem.style.transition = 'opacity 0.15s ease, max-height 0.18s ease';
          rowItem.style.opacity = '0';
          rowItem.style.maxHeight = '0px';
          setTimeout(() => {
            expSplits.splice(idx, 1);
            saveSettings();
            renderTasksList();
            updateSummaryCard();
          }, 150);
        } else {
          expSplits.splice(idx, 1);
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
        input.size = Math.max(1, e.target.value.length);
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
        const val = e.target.value.trim();
        const finalName = val || 'Untitled';
        e.target.value = finalName;
        const card = e.target.closest('.job-calc-custom-card');
        if (!card) return;
        const customId = card.dataset.customId;
        const cJob = (state.settings.customJobs || []).find((c) => c.id === customId);
        if (cJob) {
          cJob.name = finalName;
          saveSettings();
          updateSummaryCard();
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
        }
      });
    });

    // 8b. Custom Job: Accordion Button (in ALL tab)
    listEl.querySelectorAll('.job-calc-custom-job-accordion-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.job-calc-custom-card');
        if (!card) return;
        const customId = card.dataset.customId;
        const accordion = card.querySelector('.job-calc-custom-accordion');
        const arrow = btn.querySelector('.job-calc-accordion-arrow');

        if (state.expandedJobs.has(customId)) {
          state.expandedJobs.delete(customId);
          if (accordion) accordion.classList.add('hidden');
          btn.classList.remove('active');
          if (arrow) arrow.textContent = 'expand_more';
        } else {
          state.expandedJobs.add(customId);
          if (accordion) accordion.classList.remove('hidden');
          btn.classList.add('active');
          if (arrow) arrow.textContent = 'expand_less';
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
        state.expandedJobs.add(customId);
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

    // 12. Custom Job Triage (Earnings / Exclude / Delete Permanently)
    listEl.querySelectorAll('[data-custom-job-triage]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const customId = btn.dataset.customId;
        const triage = btn.dataset.customJobTriage;
        const cJob = (state.settings.customJobs || []).find((c) => c.id === customId);
        if (!cJob && triage !== 'delete') return;

        if (triage === 'paid') {
          cJob.isPaid = true;
          cJob.isExpense = false;
          state.expandedJobs.add(customId);
        } else if (triage === 'exclude') {
          cJob.isPaid = false;
          cJob.isExpense = false;
          state.expandedJobs.delete(customId);
        } else if (triage === 'delete') {
          state.expandedJobs.delete(customId);
          state.settings.customJobs = (state.settings.customJobs || []).filter((c) => c.id !== customId);
        }

        saveSettings();
        renderTasksList();
        updateSummaryCard();
      });
    });

    // 12b. Custom Expense Triage (Expenses / Exclude / Delete Permanently)
    listEl.querySelectorAll('[data-custom-exp-triage]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const expId = btn.dataset.expenseId;
        const triage = btn.dataset.customExpTriage;
        const cExp = (state.settings.customExpenses || []).find((c) => c.id === expId);
        if (!cExp && triage !== 'delete') return;

        if (triage === 'expense') {
          cExp.isExpense = true;
          state.expandedJobs.add(expId);
        } else if (triage === 'exclude') {
          cExp.isExpense = false;
          state.expandedJobs.delete(expId);
        } else if (triage === 'delete') {
          state.expandedJobs.delete(expId);
          state.settings.customExpenses = (state.settings.customExpenses || []).filter((c) => c.id !== expId);
        }

        saveSettings();
        renderTasksList();
        updateSummaryCard();
      });
    });

    // 12c. Custom Job Delete button fallback
    listEl.querySelectorAll('.job-calc-custom-delete-btn, [data-action="delete-custom-job"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = e.target.closest('.job-calc-custom-card');
        if (!card) return;
        const customId = card.dataset.customId;
        state.expandedJobs.delete(customId);
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

    // 15. Custom Expense Delete box button fallback
    listEl.querySelectorAll('[data-action="delete-custom-expense"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = e.target.closest('.job-calc-expense-card');
        if (!card) return;
        const expId = card.dataset.expenseId;
        state.expandedJobs.delete(expId);
        state.settings.customExpenses = (state.settings.customExpenses || []).filter((c) => c.id !== expId);
        saveSettings();
        renderTasksList();
        updateSummaryCard();
      });
    });

    // 16. Custom Expense Name input
    listEl.querySelectorAll('.job-calc-expense-name-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        input.size = Math.max(1, e.target.value.length);
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
        const val = e.target.value.trim();
        const finalName = val || 'Untitled';
        e.target.value = finalName;
        const card = e.target.closest('.job-calc-expense-card');
        if (!card) return;
        const expId = card.dataset.expenseId;
        const cExp = (state.settings.customExpenses || []).find((c) => c.id === expId);
        if (cExp) {
          cExp.name = finalName;
          saveSettings();
          updateSummaryCard();
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
        }
      });
    });

    // 17. Custom Expense: Split Qty input (with auto-remove on 0)
    listEl.querySelectorAll('.job-calc-custom-exp-split-qty-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.job-calc-expense-card');
        if (!card) return;
        const expId = card.dataset.expenseId;
        const cExp = (state.settings.customExpenses || []).find((c) => c.id === expId);
        const idx = parseInt(input.dataset.splitIndex, 10);
        if (!cExp || !cExp.splits || !cExp.splits[idx]) return;

        const val = parseInt(e.target.value, 10);
        cExp.splits[idx].qty = isNaN(val) ? 0 : Math.max(0, val);

        saveSettings();
        updateCustomExpenseBadge(card, expId);
        updateSummaryCard();
      });

      const handleRemoveOnZero = () => {
        const card = input.closest('.job-calc-expense-card');
        if (!card) return;
        const expId = card.dataset.expenseId;
        const cExp = (state.settings.customExpenses || []).find((c) => c.id === expId);
        const idx = parseInt(input.dataset.splitIndex, 10);
        if (!cExp || !cExp.splits || !cExp.splits[idx]) return;

        const val = parseInt(input.value, 10);
        if (val === 0 || isNaN(val) || input.value.trim() === '' || input.value.trim() === '0') {
          if (cExp.splits.length > 1) {
            cExp.splits.splice(idx, 1);
            saveSettings();
            renderTasksList();
            updateSummaryCard();
            return;
          } else {
            cExp.splits[0].qty = 1;
            input.value = 1;
            saveSettings();
            updateCustomExpenseBadge(card, expId);
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

    // 17b. Custom Expense: Split Amount input
    listEl.querySelectorAll('.job-calc-custom-exp-split-amount-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.job-calc-expense-card');
        if (!card) return;
        const expId = card.dataset.expenseId;
        const cExp = (state.settings.customExpenses || []).find((c) => c.id === expId);
        const idx = parseInt(input.dataset.splitIndex, 10);
        if (!cExp || !cExp.splits || !cExp.splits[idx]) return;

        const val = parseFloat(e.target.value);
        cExp.splits[idx].amount = isNaN(val) ? 0 : Math.max(0, val);

        saveSettings();
        updateCustomExpenseBadge(card, expId);
        updateSummaryCard();
      });

      input.addEventListener('blur', (e) => {
        if (e.target.value.trim() === '') {
          e.target.value = 0;
          const card = e.target.closest('.job-calc-expense-card');
          if (card) {
            const expId = card.dataset.expenseId;
            const cExp = (state.settings.customExpenses || []).find((c) => c.id === expId);
            const idx = parseInt(input.dataset.splitIndex, 10);
            if (cExp && cExp.splits && cExp.splits[idx]) {
              cExp.splits[idx].amount = 0;
              saveSettings();
              updateCustomExpenseBadge(card, expId);
              updateSummaryCard();
            }
          }
        }
      });
    });

    // 17c. Custom Expense: Delete Row Button (via swipe reveal)
    listEl.querySelectorAll('.job-calc-custom-exp-split-delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.job-calc-expense-card');
        if (!card) return;
        const expId = card.dataset.expenseId;
        const cExp = (state.settings.customExpenses || []).find((c) => c.id === expId);
        const idx = parseInt(btn.dataset.splitIndex, 10);
        if (!cExp || !cExp.splits || cExp.splits.length <= 1) return; // Keep at least 1 row
        if (isNaN(idx) || idx < 0 || idx >= cExp.splits.length) return;

        const rowItem = btn.closest('.job-calc-split-row-item');
        if (rowItem) {
          rowItem.style.transition = 'opacity 0.15s ease, max-height 0.18s ease';
          rowItem.style.opacity = '0';
          rowItem.style.maxHeight = '0px';
          setTimeout(() => {
            cExp.splits.splice(idx, 1);
            saveSettings();
            renderTasksList();
            updateSummaryCard();
          }, 150);
        } else {
          cExp.splits.splice(idx, 1);
          saveSettings();
          renderTasksList();
          updateSummaryCard();
        }
      });
    });

    // 17c. Custom Expense: Accordion Button (in ALL tab)
    listEl.querySelectorAll('.job-calc-custom-exp-accordion-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.job-calc-expense-card');
        if (!card) return;
        const expId = card.dataset.expenseId;
        const accordion = card.querySelector('.job-calc-custom-accordion');
        const arrow = btn.querySelector('.job-calc-accordion-arrow');

        if (state.expandedJobs.has(expId)) {
          state.expandedJobs.delete(expId);
          if (accordion) accordion.classList.add('hidden');
          btn.classList.remove('active');
          if (arrow) arrow.textContent = 'expand_more';
        } else {
          state.expandedJobs.add(expId);
          if (accordion) accordion.classList.remove('hidden');
          btn.classList.add('active');
          if (arrow) arrow.textContent = 'expand_less';
        }
      });
    });

    // 17d. Custom Expense: Add Split Row Button
    listEl.querySelectorAll('.job-calc-add-custom-exp-split-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = e.target.closest('.job-calc-expense-card');
        if (!card) return;
        const expId = card.dataset.expenseId;
        state.expandedJobs.add(expId);
        const cExp = (state.settings.customExpenses || []).find((c) => c.id === expId);
        if (!cExp) return;

        if (!Array.isArray(cExp.splits)) {
          cExp.splits = [{ qty: 1, amount: typeof cExp.amount === 'number' ? cExp.amount : 25 }];
        }

        const defaultAmt = cExp.splits.length > 0 ? cExp.splits[cExp.splits.length - 1].amount : 25;
        cExp.splits.push({
          qty: 1,
          amount: defaultAmt
        });

        saveSettings();
        renderTasksList();
        updateSummaryCard();
      });
    });

    // 17e. Custom Expense: Percent Input
    listEl.querySelectorAll('.job-calc-custom-exp-percent-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.job-calc-expense-card');
        if (!card) return;
        const expId = card.dataset.expenseId;
        const cExp = (state.settings.customExpenses || []).find((c) => c.id === expId);
        if (!cExp) return;

        const val = parseFloat(e.target.value);
        cExp.percentValue = isNaN(val) ? 0 : Math.max(0, Math.min(100, val));

        saveSettings();
        updateCustomExpenseBadge(card, expId);
        updateSummaryCard();
      });

      input.addEventListener('blur', (e) => {
        if (e.target.value.trim() === '') {
          e.target.value = 0;
          const card = e.target.closest('.job-calc-expense-card');
          if (card) {
            const expId = card.dataset.expenseId;
            const cExp = (state.settings.customExpenses || []).find((c) => c.id === expId);
            if (cExp) {
              cExp.percentValue = 0;
              saveSettings();
              updateCustomExpenseBadge(card, expId);
              updateSummaryCard();
            }
          }
        }
      });
    });

    // 17f. Custom Expense: Mode Swap Button (Fixed $ <-> % of Earnings)
    listEl.querySelectorAll('.job-calc-custom-exp-type-toggle').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.job-calc-expense-card');
        if (!card) return;
        const expId = card.dataset.expenseId;
        const cExp = (state.settings.customExpenses || []).find((c) => c.id === expId);
        if (!cExp) return;

        cExp.type = cExp.type === 'percent' ? 'fixed' : 'percent';
        if (cExp.type === 'percent' && (cExp.percentValue === undefined || cExp.percentValue === null)) {
          cExp.percentValue = 10;
        }
        if (cExp.type === 'fixed' && (!Array.isArray(cExp.splits) || cExp.splits.length === 0)) {
          cExp.splits = [{ qty: 1, amount: typeof cExp.amount === 'number' ? cExp.amount : 25 }];
        }

        saveSettings();
        renderTasksList();
        updateSummaryCard();
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

    const count = (job.occurrences || []).length;
    let jobExpenseTotal = 0;
    if (setting.expenseAdjustMode !== 'date') {
      const expSplits = getJobExpenseSplits(job, setting, count, setting.expenseAmount ?? 25);
      expSplits.forEach((s) => {
        const sCount = parseInt(s.shifts, 10) || 0;
        const sAmount = parseFloat(s.amount) || 0;
        jobExpenseTotal += (sCount * sAmount);
      });
    } else {
      const defaultExpAmt = parseFloat(setting.expenseAmount) || 0;
      job.occurrences.forEach((occ) => {
        const overrideVal = setting.expenseOverrides?.[occ.occKey];
        const occExp = (typeof overrideVal === 'number' && !isNaN(overrideVal))
          ? overrideVal
          : defaultExpAmt;
        jobExpenseTotal += occExp;
      });
    }

    jobExpenseTotal = roundCents(jobExpenseTotal);

    const amountEl = card.querySelector('.job-calc-subtotal-badge.job-calc-expense-badge .job-calc-subtotal-amount');
    if (amountEl) {
      amountEl.textContent = `-$${jobExpenseTotal.toFixed(2)}`;
    }
    const badgeEl = card.querySelector('.job-calc-session-badge');
    if (badgeEl) {
      if (setting.expenseAdjustMode !== 'date') {
        const expSplits = getJobExpenseSplits(job, setting, count, setting.expenseAmount ?? 25);
        let expAllocated = 0;
        expSplits.forEach((s) => { expAllocated += (parseInt(s.shifts, 10) || 0); });
        badgeEl.textContent = `${expAllocated > 0 ? expAllocated : count}x`;
      } else {
        badgeEl.textContent = `${count}x`;
      }
    }
  }

  function updateCustomExpenseBadge(card, customId) {
    const cExp = (state.settings.customExpenses || []).find((c) => c.id === customId);
    if (!cExp) return;

    if (cExp.type === 'percent') {
      const pct = typeof cExp.percentValue === 'number' ? cExp.percentValue : (parseFloat(cExp.percentValue) || 10);
      const { postTaxIncome } = calculateTotals();
      const totalAmt = postTaxIncome > 0 ? roundCents((postTaxIncome * pct) / 100) : 0;
      cExp.amount = totalAmt;

      const amountEl = card.querySelector('.job-calc-subtotal-badge.job-calc-expense-badge .job-calc-subtotal-amount');
      if (amountEl) {
        amountEl.textContent = `-$${totalAmt.toFixed(2)}`;
      }
      const badgeEl = card.querySelector('.job-calc-session-badge');
      if (badgeEl) {
        badgeEl.textContent = `${pct}%`;
      }
      const ofTextEl = card.querySelector('.job-calc-percent-of-text');
      if (ofTextEl) {
        ofTextEl.innerHTML = `of <strong>$${postTaxIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> post-tax`;
      }
      return;
    }

    let totalAmt = 0;
    let totalQty = 0;
    const splits = Array.isArray(cExp.splits) && cExp.splits.length > 0 ? cExp.splits : [{ qty: 1, amount: parseFloat(cExp.amount) || 0 }];
    splits.forEach((s) => {
      const q = parseInt(s.qty, 10) || 0;
      const a = parseFloat(s.amount) || 0;
      totalQty += q;
      totalAmt += (q * a);
    });
    totalAmt = roundCents(totalAmt);
    cExp.amount = totalAmt;

    const amountEl = card.querySelector('.job-calc-subtotal-badge.job-calc-expense-badge .job-calc-subtotal-amount');
    if (amountEl) {
      amountEl.textContent = `-$${totalAmt.toFixed(2)}`;
    }
    const badgeEl = card.querySelector('.job-calc-session-badge');
    if (badgeEl) {
      badgeEl.textContent = `${totalQty}x`;
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

    if (setting.adjustMode === 'split') {
      const splits = getJobSplits(job, setting, count, defaultHours);
      splits.forEach((s) => {
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

    const subtotal = roundCents(hours * rate);

    const amountEl = card.querySelector('.job-calc-subtotal-amount');
    const hoursEl = card.querySelector('.job-calc-subtotal-hours');
    const badgeEl = card.querySelector('.job-calc-session-badge');
    if (amountEl) amountEl.textContent = `$${subtotal.toFixed(2)}`;
    if (hoursEl) hoursEl.textContent = `${hours.toFixed(1)} hrs`;
    if (badgeEl) {
      if (setting.adjustMode === 'split') {
        const splits = getJobSplits(job, setting, count, defaultHours);
        let splitAllocated = 0;
        splits.forEach((s) => { splitAllocated += (parseInt(s.shifts, 10) || 0); });
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

    if (cJob.isPaid !== false) {
      if (amountEl) amountEl.textContent = `$${subtotal.toFixed(2)}`;
      if (hoursEl) hoursEl.textContent = `${totalHours.toFixed(1)} hrs`;
    } else {
      if (amountEl) amountEl.textContent = 'Excluded';
      if (hoursEl) hoursEl.textContent = '0.0 hrs';
    }
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
      postTaxIncome,
      totalExpenses,
      netTakeHome,
      customExpenseResults
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

    if (sumSessions) sumSessions.textContent = `${totalSessions}x`;
    if (sumHours) sumHours.textContent = `${totalHours.toFixed(1)} hrs`;
    if (sumGross) sumGross.textContent = `$${grossEarnings.toFixed(2)}`;

    // Conditionally include Post-Tax Earnings in the summary (show whenever Tax Deduction > 0)
    const postTaxRow = container.querySelector('#job-calc-post-tax-summary-row');
    const sumPostTax = container.querySelector('#job-calc-sum-post-tax');
    if (postTaxRow) {
      postTaxRow.style.display = taxDeductionAmount > 0 ? 'flex' : 'none';
    }
    if (sumPostTax) {
      sumPostTax.textContent = `$${postTaxIncome.toFixed(2)}`;
    }

    // Conditionally include Expenses in the summary (hide if $0)
    const expenseRow = container.querySelector('#job-calc-expense-summary-row');
    if (expenseRow) {
      expenseRow.style.display = totalExpenses > 0 ? 'flex' : 'none';
    }
    if (sumExpenses) sumExpenses.textContent = `-$${totalExpenses.toFixed(2)}`;

    const isDeficit = netTakeHome < 0;
    if (sumNet) {
      sumNet.textContent = isDeficit ? `-$${Math.abs(netTakeHome).toFixed(2)}` : `$${netTakeHome.toFixed(2)}`;
    }
    if (taxAmountEl) taxAmountEl.textContent = `-$${taxDeductionAmount.toFixed(2)}`;

    const netRowEl = container.querySelector('.job-calc-net-row');
    if (netRowEl) {
      netRowEl.classList.toggle('is-deficit', isDeficit);
    }

    const netIconEl = container.querySelector('#job-calc-net-status-icon');
    if (netIconEl) {
      netIconEl.textContent = isDeficit ? 'trending_down' : 'trending_up';
    }

    const netLabelEl = container.querySelector('.job-calc-net-label');
    if (netLabelEl) {
      netLabelEl.textContent = isDeficit ? 'Net Deficit' : 'Net Take-Home Pay';
    }

    // Sync Net sublabel dynamically
    const netSublabelEl = container.querySelector('.job-calc-net-sublabel');
    if (netSublabelEl) {
      if (isDeficit) {
        netSublabelEl.textContent = 'Expenses exceed earnings';
      } else if (taxDeductionAmount > 0 && totalExpenses > 0) {
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
    const symbolBtn = container.querySelector('#job-calc-tax-symbol-toggle');
    if (taxField) {
      taxField.classList.toggle('mode-percent', taxSetting.type === 'percent');
      taxField.classList.toggle('mode-amount', taxSetting.type === 'amount');
    }
    if (symbolBtn) {
      symbolBtn.textContent = taxSetting.type === 'amount' ? '$' : '%';
      symbolBtn.title = taxSetting.type === 'amount'
        ? 'Currently Dollar ($) — click to switch to Percent (%)'
        : 'Currently Percent (%) — click to switch to Dollar ($)';
    }

    // Sync any percent-based custom expense cards currently rendered
    container.querySelectorAll('.job-calc-expense-card').forEach((card) => {
      const expId = card.dataset.expenseId;
      const cExp = (state.settings.customExpenses || []).find((c) => c.id === expId);
      if (cExp && cExp.type === 'percent') {
        const res = customExpenseResults?.[expId];
        const amt = res ? res.amount : 0;
        const subtotalEl = card.querySelector('.job-calc-subtotal-badge.job-calc-expense-badge .job-calc-subtotal-amount');
        if (subtotalEl) {
          subtotalEl.textContent = `-$${amt.toFixed(2)}`;
        }
        const ofTextEl = card.querySelector('.job-calc-percent-of-text');
        if (ofTextEl) {
          ofTextEl.innerHTML = `of <strong>$${(postTaxIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> post-tax`;
        }
      }
    });

    // Keep the receipt ticket synced with current data
    updateReceiptTicket();
  }

  /* ==========================================================================
   * 8. Retro Receipt Ticket Updater & Export
   * ========================================================================== */

  function getCalendarExpenseDetail(name, setting, count, totalAmt) {
    if (setting && setting.expenseAdjustMode !== 'date') {
      const splits = getJobExpenseSplits(scannedJobs[name], setting, count, parseFloat(setting.expenseAmount) || 0);
      const activeSplits = (splits || []).filter((s) => (parseInt(s.shifts, 10) || 0) > 0);
      if (activeSplits.length === 1) {
        const rate = parseFloat(activeSplits[0].amount) || 0;
        return `${count}x @ $${rate.toFixed(2)}`;
      }
      if (activeSplits.length > 1) {
        return activeSplits.map((s) => `${s.shifts}x @ $${(parseFloat(s.amount) || 0).toFixed(2)}`).join(', ');
      }
    }
    if (count > 0 && totalAmt > 0) {
      const avg = totalAmt / count;
      return `${count}x @ $${avg.toFixed(2)}`;
    }
    const defaultRate = parseFloat(setting?.expenseAmount) || 0;
    return `${count || 1}x @ $${defaultRate.toFixed(2)}`;
  }

  function getCustomExpenseDetail(cExp, res, postTaxIncome) {
    if (res?.isPercent || cExp.type === 'percent') {
      const pct = res?.percentValue ?? (parseFloat(cExp.percentValue) || 10);
      const base = typeof postTaxIncome === 'number' ? postTaxIncome : 0;
      return base > 0 ? `${pct}% of post-tax ($${base.toFixed(2)})` : `${pct}% of post-tax`;
    }

    const splits = (res?.splits && res.splits.length > 0) ? res.splits : (cExp.splits || [{ qty: res?.count || 1, amount: parseFloat(cExp.amount) || 0 }]);
    const activeSplits = splits.filter((s) => (parseInt(s.qty, 10) || 0) > 0);
    if (activeSplits.length === 1) {
      const q = parseInt(activeSplits[0].qty, 10) || 1;
      const a = parseFloat(activeSplits[0].amount) || 0;
      return `${q}x @ $${a.toFixed(2)}`;
    }
    if (activeSplits.length > 1) {
      return activeSplits.map((s) => `${s.qty}x @ $${(parseFloat(s.amount) || 0).toFixed(2)}`).join(', ');
    }

    const count = res?.count ?? 1;
    const amt = parseFloat(cExp.amount) || (res ? res.amount : 0);
    return `${count}x @ $${amt.toFixed(2)}`;
  }

  function updateReceiptTicket() {
    const container = document.getElementById('job-calculator-container');
    if (!container) return;

    const {
      totalSessions,
      totalHours,
      grossEarnings,
      taxableEarnings,
      taxDeductionAmount,
      postTaxIncome,
      totalExpenses,
      netTakeHome,
      jobResults,
      customResults,
      customExpenseResults
    } = calculateTotals();

    // 1. Update Receipt Header Date Info
    const rangeEl = container.querySelector('#receipt-date-range');
    if (rangeEl && state.fromDate && state.toDate) {
      const f = parseIsoDate(state.fromDate);
      const t = parseIsoDate(state.toDate);
      rangeEl.textContent = `${formatDisplayDate(f)} — ${formatDisplayDate(t)}`;
    }
    const genDateEl = container.querySelector('#receipt-generated-date');
    if (genDateEl) {
      genDateEl.textContent = formatGeneratedDate();
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
        const taxVal = parseFloat(taxSetting.value) || 0;
        let shiftsHtml = '';

        paidNames.forEach((name) => {
          const setting = getJobSetting(name);
          const res = jobResults?.[name] || { count: 0, totalHours: 0, subtotal: 0 };
          const rate = parseFloat(setting.hourlyRate) || 0;
          const hours = res.totalHours;
          const count = res.count;
          const subtotal = res.subtotal;

          const isTaxable = setting.isTaxable !== false;
          const jobTax = (taxVal > 0 && isTaxable)
            ? (taxSetting.type === 'percent'
                ? roundCents((subtotal * taxVal) / 100)
                : (taxableEarnings > 0 ? roundCents((subtotal / taxableEarnings) * taxDeductionAmount) : 0))
            : 0;
          const jobNet = Math.max(0, roundCents(subtotal - jobTax));

          let taxSublineHtml = '';
          if (taxVal > 0) {
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

          const isTaxable = cJob.isTaxable !== false;
          const jobTax = (taxVal > 0 && isTaxable)
            ? (taxSetting.type === 'percent'
                ? roundCents((subtotal * taxVal) / 100)
                : (taxableEarnings > 0 ? roundCents((subtotal / taxableEarnings) * taxDeductionAmount) : 0))
            : 0;
          const jobNet = Math.max(0, roundCents(subtotal - jobTax));

          let taxSublineHtml = '';
          if (taxVal > 0) {
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
        return s.isExpense && ((res?.expenseTotal || 0) > 0);
      });
      const customExps = (state.settings.customExpenses || []).filter((e) => e.isExpense !== false && ((customExpenseResults?.[e.id]?.amount || 0) > 0));
      const totalExpItemsCount = expCalendarNames.length + customExps.length;

      if (expCountEl) expCountEl.textContent = `${totalExpItemsCount}x`;
      if (expSubtotalEl) expSubtotalEl.textContent = `-$${totalExpenses.toFixed(2)}`;

      if (expListEl) {
        let expHtml = '';
        expCalendarNames.forEach((name) => {
          const setting = getJobSetting(name);
          const res = jobResults[name];
          const count = res?.count || (scannedJobs[name]?.occurrences.length || 1);
          const totalAmt = res?.expenseTotal !== undefined ? res.expenseTotal : ((parseFloat(setting.expenseAmount) || 0) * count);
          if (totalAmt > 0) {
            const detailText = getCalendarExpenseDetail(name, setting, count, totalAmt);
            expHtml += `
              <div class="receipt-item-row">
                <div class="receipt-item-title-col">
                  <span class="receipt-item-name">${escapeHtml(name)}</span>
                  <span class="receipt-item-detail">${escapeHtml(detailText)}</span>
                </div>
                <span class="receipt-item-amount receipt-item-deduction">-$${totalAmt.toFixed(2)}</span>
              </div>
            `;
          }
        });

        customExps.forEach((cExp) => {
          const res = customExpenseResults?.[cExp.id];
          const amt = res ? res.amount : (parseFloat(cExp.amount) || 0);
          if (amt > 0) {
            const detailText = getCustomExpenseDetail(cExp, res, postTaxIncome);
            expHtml += `
              <div class="receipt-item-row">
                <div class="receipt-item-title-col">
                  <span class="receipt-item-name">${escapeHtml(cExp.name || 'Untitled')} <span class="receipt-item-tag-expense">EXPENSES</span></span>
                  <span class="receipt-item-detail">${escapeHtml(detailText)}</span>
                </div>
                <span class="receipt-item-amount receipt-item-deduction">-$${amt.toFixed(2)}</span>
              </div>
            `;
          }
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

    // 5b. Post-Tax Earnings
    const postTaxSection = container.querySelector('#receipt-post-tax-section');
    const postTaxAmountEl = container.querySelector('#receipt-post-tax-amount');
    if (taxDeductionAmount > 0) {
      if (postTaxSection) postTaxSection.style.display = 'block';
      if (postTaxAmountEl) postTaxAmountEl.textContent = `$${postTaxIncome.toFixed(2)}`;
    } else {
      if (postTaxSection) postTaxSection.style.display = 'none';
    }

    // 6. Net Take-Home Hero Row
    const netAmountEl = container.querySelector('#receipt-net-amount');
    const receiptNetRow = container.querySelector('.receipt-net-row');
    const receiptNetLabel = container.querySelector('.receipt-net-main-label');
    const receiptNetSublabel = container.querySelector('.receipt-net-sublabel');
    const isDeficit = netTakeHome < 0;

    if (netAmountEl) {
      netAmountEl.textContent = isDeficit ? `-$${Math.abs(netTakeHome).toFixed(2)}` : `$${netTakeHome.toFixed(2)}`;
    }
    if (receiptNetRow) {
      receiptNetRow.classList.toggle('is-deficit', isDeficit);
    }
    if (receiptNetLabel) {
      receiptNetLabel.textContent = isDeficit ? 'NET DEFICIT' : 'NET TAKE-HOME';
    }
    if (receiptNetSublabel) {
      receiptNetSublabel.textContent = isDeficit ? 'Expenses exceed earnings' : 'Total pocket earnings';
    }
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

    const taxSetting = state.settings.tax || { type: 'percent', value: 0 };
    const taxVal = parseFloat(taxSetting.value) || 0;

    let out = [];
    out.push(doubleDivider);
    out.push(center('EARNINGS STATEMENT'));
    out.push(center('★ EARNINGS & EXPENSES BREAKDOWN ★'));
    out.push(doubleDivider);
    out.push(row('PERIOD', rangeStr));
    out.push(row('GENERATED', formatGeneratedDate()));
    out.push(divider);

    // Paid Calendar Jobs & Custom Jobs
    const paidJobs = Object.keys(scannedJobs).filter((name) => getJobSetting(name).isPaid);
    const paidCustom = (state.settings.customJobs || []).filter((c) => c.isPaid !== false);

    if (paidJobs.length > 0 || paidCustom.length > 0) {
      out.push('EARNINGS:');
      paidJobs.forEach((name) => {
        const setting = getJobSetting(name);
        const res = totals.jobResults?.[name] || { count: 0, totalHours: 0, subtotal: 0 };
        const rate = parseFloat(setting.hourlyRate) || 0;
        const hours = res.totalHours;
        const count = res.count;
        const subtotal = res.subtotal;
        const detailStr = `  ${name} (${hours.toFixed(1)}h · ${count}x)`;
        out.push(row(detailStr, `$${subtotal.toFixed(2)}`));

        if (taxVal > 0) {
          const isTaxable = setting.isTaxable !== false;
          if (isTaxable) {
            const jobTax = taxSetting.type === 'percent'
              ? roundCents((subtotal * taxVal) / 100)
              : (totals.taxableEarnings > 0 ? roundCents((subtotal / totals.taxableEarnings) * totals.taxDeductionAmount) : 0);
            const jobNet = Math.max(0, roundCents(subtotal - jobTax));
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

        if (taxVal > 0) {
          const isTaxable = cJob.isTaxable !== false;
          if (isTaxable) {
            const jobTax = taxSetting.type === 'percent'
              ? roundCents((subtotal * taxVal) / 100)
              : (totals.taxableEarnings > 0 ? roundCents((subtotal / totals.taxableEarnings) * totals.taxDeductionAmount) : 0);
            const jobNet = Math.max(0, roundCents(subtotal - jobTax));
            out.push(`    Tax: -$${jobTax.toFixed(2)} · Net: $${jobNet.toFixed(2)}`);
          } else {
            out.push(`    Untaxed · Net: $${subtotal.toFixed(2)}`);
          }
        }
      });

      out.push(row('  Total Hours', `${totals.totalHours.toFixed(1)} hrs`));
      out.push(row('  Earnings Subtotal', `$${totals.grossEarnings.toFixed(2)}`));
      out.push(divider);
    }

    out.push(row('GROSS EARNINGS', `$${totals.grossEarnings.toFixed(2)}`));

    if (totals.taxDeductionAmount > 0) {
      const typeLabel = taxSetting.type === 'percent' ? ` (${taxSetting.value}%)` : '';
      out.push(row(`  Total Tax Deduction${typeLabel}`, `-$${totals.taxDeductionAmount.toFixed(2)}`));
      out.push(row('POST-TAX EARNINGS', `$${totals.postTaxIncome.toFixed(2)}`));
    }

    // Expenses (if any)
    if (totals.totalExpenses > 0) {
      out.push(divider);
      out.push('EXPENSES:');
      const expCalendarNames = Object.keys(scannedJobs).filter((name) => {
        const s = getJobSetting(name);
        const res = totals.jobResults?.[name];
        return s.isExpense && ((res?.expenseTotal || 0) > 0);
      });
      expCalendarNames.forEach((name) => {
        const s = getJobSetting(name);
        const res = totals.jobResults?.[name];
        const count = res?.count || (scannedJobs[name]?.occurrences.length || 1);
        const totalAmt = res?.expenseTotal || 0;
        if (totalAmt > 0) {
          const detail = getCalendarExpenseDetail(name, s, count, totalAmt);
          out.push(row(`  ${name} (${detail})`, `-$${totalAmt.toFixed(2)}`));
        }
      });

      (state.settings.customExpenses || []).forEach((cExp) => {
        if (cExp.isExpense !== false) {
          const res = totals.customExpenseResults?.[cExp.id];
          const amt = res ? res.amount : (parseFloat(cExp.amount) || 0);
          if (amt > 0) {
            const detail = getCustomExpenseDetail(cExp, res, totals.postTaxIncome);
            out.push(row(`  ${cExp.name || 'Untitled'} [Expenses] (${detail})`, `-$${amt.toFixed(2)}`));
          }
        }
      });
      out.push(row('  Total Expenses', `-$${totals.totalExpenses.toFixed(2)}`));
    }

    out.push(doubleDivider);

    const isDeficit = totals.netTakeHome < 0;
    const netFormatted = isDeficit ? `-$${Math.abs(totals.netTakeHome).toFixed(2)}` : `$${totals.netTakeHome.toFixed(2)}`;
    out.push(row(isDeficit ? 'NET DEFICIT' : 'NET TAKE-HOME', netFormatted));
    out.push(doubleDivider);
    if (isDeficit) {
      out.push(center('NET DEFICIT PERIOD'));
      out.push(center('EXPENSES EXCEEDED EARNINGS ⚠️'));
    } else {
      out.push(center('THANK YOU FOR YOUR WORK!'));
      out.push(center('EVERY SHIFT ADDS UP 🐷'));
    }
    out.push(doubleDivider);

    return out.join('\n');
  }

  /* ==========================================================================
   * 8. Retro Receipt Canvas Image Generator & Download
   * ========================================================================== */

  function formatGeneratedDate(d = new Date()) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${month} ${day}, ${year}, ${hours}:${minutes} ${ampm}`;
  }

  function renderReceiptToCanvas() {
    const totals = calculateTotals();
    const {
      totalHours,
      grossEarnings,
      taxableEarnings,
      taxDeductionAmount,
      postTaxIncome,
      totalExpenses,
      netTakeHome,
      totalSessions,
      jobResults,
      customResults,
      customExpenseResults
    } = totals;

    const taxSetting = state.settings.tax || { type: 'percent', value: 0 };
    const taxVal = parseFloat(taxSetting.value) || 0;
    const rangeEl = document.querySelector('#receipt-date-range');
    const periodText = (rangeEl && rangeEl.textContent) ? rangeEl.textContent.trim() : 'Selected Period';
    const genDateText = formatGeneratedDate();

    // Prepare shift lines
    const paidNames = Object.keys(scannedJobs).filter((name) => getJobSetting(name).isPaid);
    const paidCustom = (state.settings.customJobs || []).filter((c) => c.isPaid !== false);

    const shiftItems = [];
    paidNames.forEach((name) => {
      const setting = getJobSetting(name);
      const res = jobResults?.[name] || { count: 0, totalHours: 0, subtotal: 0 };
      const rate = parseFloat(setting.hourlyRate) || 0;
      const hours = res.totalHours;
      const count = res.count;
      const subtotal = res.subtotal;
      const isTaxable = setting.isTaxable !== false;

      const jobTax = (taxVal > 0 && isTaxable)
        ? (taxSetting.type === 'percent'
            ? roundCents((subtotal * taxVal) / 100)
            : (taxableEarnings > 0 ? roundCents((subtotal / taxableEarnings) * taxDeductionAmount) : 0))
        : 0;
      const jobNet = Math.max(0, roundCents(subtotal - jobTax));

      shiftItems.push({
        name,
        detail: `${hours.toFixed(1)}h (${count}x) @ $${rate.toFixed(2)}/hr`,
        taxSubline: taxVal > 0
          ? (isTaxable ? `Tax: -$${jobTax.toFixed(2)} · Net: $${jobNet.toFixed(2)}` : `Untaxed · Net: $${subtotal.toFixed(2)}`)
          : null,
        amount: `$${subtotal.toFixed(2)}`,
        isCustom: false,
        isUntaxed: !isTaxable
      });
    });

    paidCustom.forEach((cJob) => {
      const res = customResults?.[cJob.id] || { count: 1, totalHours: 0, subtotal: 0 };
      const hours = res.totalHours;
      const rate = parseFloat(cJob.hourlyRate) || 0;
      const count = res.count;
      const subtotal = res.subtotal;
      const isTaxable = cJob.isTaxable !== false;

      const jobTax = (taxVal > 0 && isTaxable)
        ? (taxSetting.type === 'percent'
            ? roundCents((subtotal * taxVal) / 100)
            : (taxableEarnings > 0 ? roundCents((subtotal / taxableEarnings) * taxDeductionAmount) : 0))
        : 0;
      const jobNet = Math.max(0, roundCents(subtotal - jobTax));

      shiftItems.push({
        name: cJob.name || 'Untitled',
        detail: `${hours.toFixed(1)}h (${count}x) @ $${rate.toFixed(2)}/hr`,
        taxSubline: taxVal > 0
          ? (isTaxable ? `Tax: -$${jobTax.toFixed(2)} · Net: $${jobNet.toFixed(2)}` : `Untaxed · Net: $${subtotal.toFixed(2)}`)
          : null,
        amount: `$${subtotal.toFixed(2)}`,
        isCustom: true,
        tag: 'EARNINGS',
        isUntaxed: !isTaxable
      });
    });

    // Prepare expense lines
    const expItems = [];
    if (totalExpenses > 0) {
      const expCalendarNames = Object.keys(scannedJobs).filter((name) => {
        const s = getJobSetting(name);
        const res = jobResults[name];
        return s.isExpense && ((res?.expenseTotal || 0) > 0);
      });
      const customExps = (state.settings.customExpenses || []).filter((e) => e.isExpense !== false && ((customExpenseResults?.[e.id]?.amount || 0) > 0));

      expCalendarNames.forEach((name) => {
        const s = getJobSetting(name);
        const res = jobResults[name];
        const count = res?.count || (scannedJobs[name]?.occurrences.length || 1);
        const amt = res?.expenseTotal || 0;
        if (amt > 0) {
          expItems.push({
            name,
            detail: getCalendarExpenseDetail(name, s, count, amt),
            amount: `-$${amt.toFixed(2)}`,
            isCustom: false
          });
        }
      });

      customExps.forEach((cExp) => {
        const res = customExpenseResults?.[cExp.id];
        const amt = res ? res.amount : (parseFloat(cExp.amount) || 0);
        if (amt > 0) {
          expItems.push({
            name: cExp.name || 'Untitled',
            detail: getCustomExpenseDetail(cExp, res, postTaxIncome),
            amount: `-$${amt.toFixed(2)}`,
            isCustom: true,
            tag: 'EXPENSES'
          });
        }
      });
    }

    // Dynamic Height Calculation
    const logicalWidth = 460;
    const padX = 26;
    const contentW = logicalWidth - padX * 2;
    const dpr = 2; // Crisp 2x retina display

    let totalHeight = 24; // Top padding & tear edge
    totalHeight += 28;    // Brand title "EARNINGS STATEMENT"
    totalHeight += 20;    // Badge "★ EARNINGS & EXPENSES BREAKDOWN ★"
    totalHeight += 12;    // Gap
    totalHeight += 18;    // PERIOD row
    totalHeight += 18;    // GENERATED row
    totalHeight += 14;    // Gap before dash divider
    totalHeight += 14;    // Dashed divider

    // Shifts section
    totalHeight += 24;    // Section header "CALENDAR SHIFTS"
    if (shiftItems.length === 0) {
      totalHeight += 26;
    } else {
      shiftItems.forEach((item) => {
        totalHeight += item.taxSubline ? 52 : 36;
      });
    }
    totalHeight += 26;    // Shifts subtotal row
    totalHeight += 14;    // Gap & divider
    totalHeight += 14;

    // Gross row
    totalHeight += 26;

    // Tax Deduction & Post-Tax (if tax > 0)
    if (taxDeductionAmount > 0) {
      totalHeight += 14;  // divider
      totalHeight += 38;  // tax deduction row + detail
      totalHeight += 14;  // divider
      totalHeight += 26;  // post-tax earnings row
    }

    // Expenses section (if expenses > 0)
    if (totalExpenses > 0) {
      totalHeight += 14;  // divider
      totalHeight += 24;  // Expenses header
      totalHeight += expItems.length * 36;
      totalHeight += 26;  // Expenses subtotal row
    }

    // Double divider
    totalHeight += 16;

    // Net Take-Home Hero Box
    totalHeight += 66;

    // Double divider
    totalHeight += 16;

    // Footer
    totalHeight += 36;   // Barcode
    totalHeight += 18;   // "THANK YOU FOR YOUR HARD WORK!"
    totalHeight += 18;   // "EVERY SHIFT ADDS UP 🐷"
    totalHeight += 26;   // Bottom jagged edge & margin

    // Setup Canvas
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(logicalWidth * dpr);
    canvas.height = Math.round(totalHeight * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Helpers
    const fontPrimary = "'Courier New', Courier, 'Cascadia Code', Consolas, monospace";
    const teethCount = Math.round(logicalWidth / 14);
    const toothW = logicalWidth / teethCount;
    const toothH = 6;
    const topY = 10;
    const botY = totalHeight - 12;

    // 1. Draw Receipt Paper with Jagged Edges
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, topY);
    for (let i = 0; i < teethCount; i++) {
      const x = i * toothW;
      ctx.lineTo(x + toothW / 2, topY - toothH);
      ctx.lineTo(x + toothW, topY);
    }
    ctx.lineTo(logicalWidth, botY);
    for (let i = teethCount - 1; i >= 0; i--) {
      const x = i * toothW;
      ctx.lineTo(x + toothW / 2, botY + toothH);
      ctx.lineTo(x, botY);
    }
    ctx.closePath();

    ctx.fillStyle = '#fffdf9';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#e2e8f0';
    ctx.stroke();
    ctx.restore();

    let currY = 34;

    // 2. Header
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f172a';
    ctx.font = `900 18px ${fontPrimary}`;
    ctx.fillText('EARNINGS STATEMENT', logicalWidth / 2, currY);
    currY += 19;

    ctx.fillStyle = '#475569';
    ctx.font = `700 10.5px ${fontPrimary}`;
    ctx.fillText('★ EARNINGS & EXPENSES BREAKDOWN ★', logicalWidth / 2, currY);
    currY += 18;

    // 3. Meta Rows
    ctx.font = `600 11px ${fontPrimary}`;
    // Period
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.fillText('PERIOD:', padX, currY);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#334155';
    ctx.fillText(periodText, logicalWidth - padX, currY);
    currY += 16;

    // Generated
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.fillText('GENERATED:', padX, currY);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#334155';
    ctx.fillText(genDateText, logicalWidth - padX, currY);
    currY += 12;

    function drawDashDivider(y) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(logicalWidth - padX, y);
      ctx.stroke();
      ctx.restore();
    }

    function drawDoubleDivider(y) {
      ctx.save();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(logicalWidth - padX, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(padX, y + 3);
      ctx.lineTo(logicalWidth - padX, y + 3);
      ctx.stroke();
      ctx.restore();
    }

    function truncate(text, maxW) {
      if (ctx.measureText(text).width <= maxW) return text;
      let s = text;
      while (s.length > 0 && ctx.measureText(s + '...').width > maxW) {
        s = s.slice(0, -1);
      }
      return s + '...';
    }

    // Divider
    drawDashDivider(currY);
    currY += 16;

    // 4. Earnings Section Header
    ctx.textAlign = 'left';
    ctx.fillStyle = '#334155';
    ctx.font = `800 11px ${fontPrimary}`;
    ctx.fillText('EARNINGS', padX, currY);
    ctx.textAlign = 'right';
    ctx.font = `700 11px ${fontPrimary}`;
    ctx.fillText(`${totalSessions}x`, logicalWidth - padX, currY);
    currY += 18;

    // Shift Items
    if (shiftItems.length === 0) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#94a3b8';
      ctx.font = `italic 12px ${fontPrimary}`;
      ctx.fillText('No earnings selected', padX, currY);
      ctx.textAlign = 'right';
      ctx.fillText('$0.00', logicalWidth - padX, currY);
      currY += 22;
    } else {
      shiftItems.forEach((item) => {
        // Line 1: Name, Tag, Amount
        ctx.textAlign = 'left';
        ctx.fillStyle = '#0f172a';
        ctx.font = `700 12.5px ${fontPrimary}`;
        const maxNameW = contentW - ctx.measureText(item.amount).width - (item.tag ? 65 : 12);
        const nameStr = truncate(item.name, maxNameW);
        ctx.fillText(nameStr, padX, currY);

        if (item.tag) {
          ctx.save();
          ctx.font = `700 8.5px ${fontPrimary}`;
          const tagTextW = ctx.measureText(item.tag).width;
          const nameTextW = ctx.measureText(nameStr).width;
          const badgeX = padX + nameTextW + 6;
          const badgeW = tagTextW + 8;
          ctx.fillStyle = '#dcfce7';
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(badgeX, currY - 9, badgeW, 12, 3);
            ctx.fill();
          } else {
            ctx.fillRect(badgeX, currY - 9, badgeW, 12);
          }
          ctx.fillStyle = '#15803d';
          ctx.fillText(item.tag, badgeX + 4, currY - 0.5);
          ctx.restore();
        }

        ctx.textAlign = 'right';
        ctx.fillStyle = '#0f172a';
        ctx.font = `700 12.5px ${fontPrimary}`;
        ctx.fillText(item.amount, logicalWidth - padX, currY);
        currY += 15;

        // Line 2: Detail
        ctx.textAlign = 'left';
        ctx.fillStyle = '#64748b';
        ctx.font = `500 10.5px ${fontPrimary}`;
        ctx.fillText(truncate(item.detail, contentW - 10), padX, currY);
        currY += 14;

        // Line 3 (if tax applied): Tax & Net subline
        if (item.taxSubline) {
          ctx.textAlign = 'left';
          ctx.font = `600 10px ${fontPrimary}`;
          if (item.isUntaxed) {
            ctx.fillStyle = '#d97706';
            ctx.fillText('Untaxed', padX, currY);
            const utW = ctx.measureText('Untaxed').width;
            ctx.fillStyle = '#64748b';
            ctx.fillText(' · ', padX + utW, currY);
            const dotW = ctx.measureText(' · ').width;
            ctx.fillStyle = '#059669';
            ctx.font = `700 10px ${fontPrimary}`;
            ctx.fillText(`Net: ${item.amount}`, padX + utW + dotW, currY);
          } else {
            const parts = item.taxSubline.split('·');
            const taxPart = (parts[0] || '').trim();
            const netPart = (parts[1] || '').trim();
            ctx.fillStyle = '#d97706';
            ctx.fillText(taxPart, padX, currY);
            const taxW = ctx.measureText(taxPart).width;
            ctx.fillStyle = '#64748b';
            ctx.fillText(' · ', padX + taxW, currY);
            const dotW = ctx.measureText(' · ').width;
            ctx.fillStyle = '#059669';
            ctx.font = `700 10px ${fontPrimary}`;
            ctx.fillText(netPart, padX + taxW + dotW, currY);
          }
          currY += 15;
        }

        currY += 6;
      });
    }

    // Shifts Subtotal
    ctx.save();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(padX, currY - 4);
    ctx.lineTo(logicalWidth - padX, currY - 4);
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = `700 11.5px ${fontPrimary}`;
    ctx.fillText(`EARNINGS TOTAL (${totalHours.toFixed(1)}h)`, padX, currY + 10);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 12px ${fontPrimary}`;
    ctx.fillText(`$${grossEarnings.toFixed(2)}`, logicalWidth - padX, currY + 10);
    currY += 22;

    // Divider
    drawDashDivider(currY);
    currY += 16;

    // 5. Gross Earnings Row
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = `900 13.5px ${fontPrimary}`;
    ctx.fillText('GROSS EARNINGS', padX, currY);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#059669';
    ctx.font = `900 14.5px ${fontPrimary}`;
    ctx.fillText(`$${grossEarnings.toFixed(2)}`, logicalWidth - padX, currY);
    currY += 14;

    // 6. Tax Deduction & Post-Tax (if tax > 0)
    if (taxDeductionAmount > 0) {
      drawDashDivider(currY + 4);
      currY += 18;

      ctx.textAlign = 'left';
      ctx.fillStyle = '#0f172a';
      ctx.font = `700 12px ${fontPrimary}`;
      ctx.fillText('Total Tax Deduction', padX, currY);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#d97706';
      ctx.font = `700 12.5px ${fontPrimary}`;
      ctx.fillText(`-$${taxDeductionAmount.toFixed(2)}`, logicalWidth - padX, currY);
      currY += 14;

      // Tax detail line (e.g. "(10% of taxable)" or "($25.00 flat)")
      const taxDetailStr = taxSetting.type === 'percent'
        ? `(${taxSetting.value}% of taxable)`
        : `($${parseFloat(taxSetting.value || 0).toFixed(2)} flat)`;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#64748b';
      ctx.font = `500 10px ${fontPrimary}`;
      ctx.fillText(taxDetailStr, padX, currY);
      currY += 15;

      drawDashDivider(currY + 4);
      currY += 18;

      ctx.textAlign = 'left';
      ctx.fillStyle = '#0f172a';
      ctx.font = `800 13px ${fontPrimary}`;
      ctx.fillText('POST-TAX EARNINGS', padX, currY);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#0284c7';
      ctx.font = `800 13.5px ${fontPrimary}`;
      ctx.fillText(`$${postTaxIncome.toFixed(2)}`, logicalWidth - padX, currY);
      currY += 14;
    }

    // 7. Expenses (if expenses > 0)
    if (totalExpenses > 0) {
      drawDashDivider(currY + 4);
      currY += 18;

      ctx.textAlign = 'left';
      ctx.fillStyle = '#334155';
      ctx.font = `800 11px ${fontPrimary}`;
      ctx.fillText('EXPENSES', padX, currY);
      ctx.textAlign = 'right';
      ctx.font = `700 11px ${fontPrimary}`;
      ctx.fillText(`${expItems.length}x`, logicalWidth - padX, currY);
      currY += 18;

      expItems.forEach((item) => {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#0f172a';
        ctx.font = `700 12.5px ${fontPrimary}`;
        const maxNameW = contentW - ctx.measureText(item.amount).width - (item.tag ? 70 : 12);
        const nameStr = truncate(item.name, maxNameW);
        ctx.fillText(nameStr, padX, currY);

        if (item.tag) {
          ctx.save();
          ctx.font = `700 8.5px ${fontPrimary}`;
          const tagTextW = ctx.measureText(item.tag).width;
          const nameTextW = ctx.measureText(nameStr).width;
          const badgeX = padX + nameTextW + 6;
          const badgeW = tagTextW + 8;
          ctx.fillStyle = '#ffedd5';
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(badgeX, currY - 9, badgeW, 12, 3);
            ctx.fill();
          } else {
            ctx.fillRect(badgeX, currY - 9, badgeW, 12);
          }
          ctx.fillStyle = '#c2410c';
          ctx.fillText(item.tag, badgeX + 4, currY - 0.5);
          ctx.restore();
        }

        ctx.textAlign = 'right';
        ctx.fillStyle = '#dc2626';
        ctx.font = `700 12.5px ${fontPrimary}`;
        ctx.fillText(item.amount, logicalWidth - padX, currY);
        currY += 15;

        ctx.textAlign = 'left';
        ctx.fillStyle = '#64748b';
        ctx.font = `500 10.5px ${fontPrimary}`;
        ctx.fillText(truncate(item.detail, contentW - 10), padX, currY);
        currY += 18;
      });

      // Expenses Subtotal
      ctx.save();
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(padX, currY - 4);
      ctx.lineTo(logicalWidth - padX, currY - 4);
      ctx.stroke();
      ctx.restore();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#475569';
      ctx.font = `700 11.5px ${fontPrimary}`;
      ctx.fillText('EXPENSES TOTAL', padX, currY + 10);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#dc2626';
      ctx.font = `700 12px ${fontPrimary}`;
      ctx.fillText(`-$${totalExpenses.toFixed(2)}`, logicalWidth - padX, currY + 10);
      currY += 22;
    }

    // 8. Double Divider before Net Box
    currY += 6;
    drawDoubleDivider(currY);
    currY += 16;

    // 9. Net Take-Home Hero Box
    const isDeficit = netTakeHome < 0;
    const boxH = 58;
    const boxR = 6;

    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(padX, currY, contentW, boxH, boxR);
    } else {
      ctx.rect(padX, currY, contentW, boxH);
    }
    ctx.fillStyle = isDeficit ? '#fef2f2' : '#ecfdf5';
    ctx.fill();

    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = isDeficit ? '#f87171' : '#10b981';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Box text
    ctx.textAlign = 'left';
    ctx.fillStyle = isDeficit ? '#991b1b' : '#065f46';
    ctx.font = `900 13px ${fontPrimary}`;
    ctx.fillText('NET TAKE-HOME', padX + 14, currY + 24);

    ctx.fillStyle = isDeficit ? '#b91c1c' : '#047857';
    ctx.font = `600 10px ${fontPrimary}`;
    ctx.fillText('Total pocket earnings', padX + 14, currY + 42);

    ctx.textAlign = 'right';
    ctx.fillStyle = isDeficit ? '#dc2626' : '#047857';
    ctx.font = `900 20px ${fontPrimary}`;
    ctx.fillText(`$${netTakeHome.toFixed(2)}`, logicalWidth - padX - 14, currY + 36);

    currY += boxH + 12;

    // 10. Double Divider after Net Box
    drawDoubleDivider(currY);
    currY += 18;

    // 11. Footer: Barcode and Message
    ctx.save();
    const totalBarW = RECEIPT_BARCODE_BARS.reduce((sum, w) => sum + w, 0);
    const barcodeX = Math.round((logicalWidth - totalBarW) / 2);
    const barcodeH = 24;
    ctx.fillStyle = '#334155';
    let bx = barcodeX;
    RECEIPT_BARCODE_BARS.forEach((w, idx) => {
      if (idx % 2 === 0) {
        ctx.fillRect(bx, currY, w, barcodeH);
      }
      bx += w;
    });
    ctx.restore();
    currY += barcodeH + 16;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#475569';
    ctx.font = `800 10.5px ${fontPrimary}`;
    ctx.fillText('THANK YOU FOR YOUR HARD WORK!', logicalWidth / 2, currY);
    currY += 15;

    ctx.fillStyle = '#64748b';
    ctx.font = `600 10px ${fontPrimary}`;
    ctx.fillText('EVERY SHIFT ADDS UP 🐷', logicalWidth / 2, currY);

    return canvas;
  }

  let isSavingReceipt = false;
  const DEFAULT_RECEIPT_DOWNLOAD_HTML = `
    <span class="material-symbols-outlined">download</span>
    <span class="receipt-action-btn-text">Save Image</span>
  `;

  function handleDownloadReceiptImage() {
    if (isSavingReceipt) return;
    isSavingReceipt = true;

    const btn = document.querySelector('#receipt-btn-download');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <span class="material-symbols-outlined" style="font-size: 14px; color: #0284c7;">hourglass_empty</span>
        <span class="receipt-action-btn-text" style="color: #0284c7;">Saving...</span>
      `;
    }

    const resetButton = () => {
      isSavingReceipt = false;
      const b = document.querySelector('#receipt-btn-download');
      if (b) {
        b.disabled = false;
        b.innerHTML = DEFAULT_RECEIPT_DOWNLOAD_HTML;
      }
    };

    // Safety fallback timer: guarantee button resets even under extreme delays or browser cancellations
    const safetyTimer = setTimeout(() => {
      if (isSavingReceipt) {
        resetButton();
      }
    }, 3000);

    try {
      const canvas = renderReceiptToCanvas();
      const rangeEl = document.querySelector('#receipt-date-range');
      const periodStr = (rangeEl?.textContent || 'statement')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const filename = `earnings-statement-${periodStr || 'breakdown'}.png`;

      // Helper to convert dataURL to Blob synchronously
      function dataURLtoBlob(dataurl) {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
      }

      const dataUrl = canvas.toDataURL('image/png');
      const blob = dataURLtoBlob(dataUrl);

      // Trigger download synchronously to preserve user activation on mobile / PWA
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);

      clearTimeout(safetyTimer);
      showToastNotification('Earnings Statement saved.');

      if (btn) {
        btn.innerHTML = `
          <span class="material-symbols-outlined" style="font-size: 14px; color: #16a34a;">check</span>
          <span class="receipt-action-btn-text" style="color: #16a34a;">Saved!</span>
        `;
        setTimeout(() => {
          resetButton();
        }, 1600);
      } else {
        resetButton();
      }
    } catch (err) {
      clearTimeout(safetyTimer);
      console.error('Failed to download earnings statement image:', err);
      showToastNotification('Failed to save image. Please try again.');
      resetButton();
    }
  }

  const DEFAULT_RECEIPT_COPY_HTML = `
    <span class="material-symbols-outlined">content_copy</span>
    <span class="receipt-action-btn-text">Copy</span>
  `;

  function handleCopyReceipt() {
    const totals = calculateTotals();
    const text = formatReceiptText(totals);

    const btn = document.querySelector('#receipt-btn-copy');

    const showSuccess = () => {
      showToastNotification('Breakdown copied to clipboard.');
      if (btn) {
        btn.innerHTML = `
          <span class="material-symbols-outlined" style="font-size: 14px; color: #16a34a;">check</span>
          <span class="receipt-action-btn-text" style="color: #16a34a;">Copied!</span>
        `;
        setTimeout(() => {
          if (btn) btn.innerHTML = DEFAULT_RECEIPT_COPY_HTML;
        }, 1600);
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
      showToastNotification('Breakdown copied to clipboard.');
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

    // Re-sync active date range with currently active calendar month (or preset) upon opening
    if (!state.fromDate || !state.toDate || state.activePreset === 'this-month' || state.activePreset === 'last-month') {
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
      const summaryHeader = container.querySelector('#job-calc-summary-header');
      const receiptWrapper = container.querySelector('#job-calc-receipt-wrapper, .job-calc-receipt-wrapper');
      if (summaryCard) summaryCard.style.display = '';
      if (summaryHeader) summaryHeader.style.display = '';
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
