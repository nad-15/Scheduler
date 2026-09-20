/**
 * Skhayeduler - Backup Manager & Conflict Resolution Engine
 * Handles intelligent, non-destructive merging of backup files with local storage.
 * Provides a side-by-side comparison modal for conflicts (Tasks by date, Todos, Templates, Settings).
 */

(function () {
  'use strict';

  // State for in-progress merge session
  let mergeSession = null;

  /**
   * Helper: Parse stringified JSON or return object
   */
  function safeParse(val, fallback = null) {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'object') return val;
    try {
      return JSON.parse(val);
    } catch (e) {
      return fallback !== null ? fallback : val;
    }
  }

  /**
   * Helper: Format YYYY-MM-DD or YYYY-M-D date string to human readable format
   */
  function formatHumanDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return dateStr || 'Unknown Date';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        // Scheduler internal date keys store month 0-indexed (0=Jan ... 8=Sep).
        // Setting time to 12:00 avoids DST edge shifts.
        const dt = new Date(y, m, d, 12, 0, 0);
        if (!isNaN(dt.getTime())) {
          return dt.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }
      }
    }
    return dateStr;
  }

  /**
   * Helper: Sanitize CSS color value to prevent style injection
   */
  function sanitizeColor(c) {
    if (typeof c !== 'string') return '#4285f4';
    const trimmed = c.trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed) || /^(rgb|hsl)a?\([^)]+\)$/i.test(trimmed) || /^[a-zA-Z]+$/.test(trimmed)) {
      return trimmed;
    }
    return '#4285f4';
  }

  /**
   * Clean task list: filters out blank ghost entries
   */
  function cleanTaskList(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(item => {
      if (!item || typeof item !== 'object') return false;
      const hasText = item.task && String(item.task).trim().length > 0;
      const hasColor = item.color && String(item.color).trim().length > 0 && item.color !== 'transparent';
      return hasText || hasColor;
    });
  }

  /**
   * Normalize a day object { morning: [], afternoon: [], evening: [] }
   */
  function normalizeDayTasks(day) {
    if (!day || typeof day !== 'object') {
      return { morning: [], afternoon: [], evening: [] };
    }
    return {
      morning: cleanTaskList(day.morning),
      afternoon: cleanTaskList(day.afternoon),
      evening: cleanTaskList(day.evening)
    };
  }

  /**
   * Check if two day objects have identical tasks and colors
   */
  function areTaskDaysEqual(dayA, dayB) {
    const normA = normalizeDayTasks(dayA);
    const normB = normalizeDayTasks(dayB);
    const periods = ['morning', 'afternoon', 'evening'];

    for (const p of periods) {
      const listA = normA[p];
      const listB = normB[p];
      if (listA.length !== listB.length) return false;
      for (let i = 0; i < listA.length; i++) {
        const tA = (listA[i].task || '').trim();
        const tB = (listB[i].task || '').trim();
        const cA = (listA[i].color || '').toLowerCase().trim();
        const cB = (listB[i].color || '').toLowerCase().trim();
        if (tA !== tB || cA !== cB) return false;
      }
    }
    return true;
  }

  /**
   * Check if dayA tasks are a subset of dayB tasks (Git fast-forward helper).
   * Returns true if every task in dayA (period, text, color) exists in dayB with 1-to-1 matching.
   */
  function isTaskDaySubset(dayA, dayB) {
    const normA = normalizeDayTasks(dayA);
    const normB = normalizeDayTasks(dayB);
    const periods = ['morning', 'afternoon', 'evening'];

    for (const p of periods) {
      const listA = normA[p];
      const listB = normB[p];

      const matchedB = new Set();
      for (let i = 0; i < listA.length; i++) {
        const tA = (listA[i].task || '').trim();
        const cA = (listA[i].color || '').toLowerCase().trim();

        let foundMatch = false;
        for (let j = 0; j < listB.length; j++) {
          if (matchedB.has(j)) continue;
          const tB = (listB[j].task || '').trim();
          const cB = (listB[j].color || '').toLowerCase().trim();
          if (tA === tB && cA === cB) {
            matchedB.add(j);
            foundMatch = true;
            break;
          }
        }

        if (!foundMatch) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Intelligently combine two day objects (union without duplicates)
   */
  function combineTaskDays(dayA, dayB) {
    const normA = normalizeDayTasks(dayA);
    const normB = normalizeDayTasks(dayB);
    const result = { morning: [], afternoon: [], evening: [] };
    const periods = ['morning', 'afternoon', 'evening'];

    periods.forEach(p => {
      // Start with local tasks
      const combined = normA[p].map(t => ({ task: t.task || '', color: t.color || '' }));

      // Append incoming tasks if not already verbatim present
      normB[p].forEach(inTask => {
        const textIn = (inTask.task || '').trim();
        const colorIn = (inTask.color || '').toLowerCase().trim();

        const exists = combined.some(ex =>
          (ex.task || '').trim() === textIn &&
          (ex.color || '').toLowerCase().trim() === colorIn
        );

        if (!exists) {
          combined.push({
            task: inTask.task || '',
            color: inTask.color || ''
          });
        }
      });

      result[p] = combined;
    });

    return result;
  }

  /**
   * Compare two todo items
   */
  function areTodosEqual(tA, tB) {
    if (!tA || !tB) return false;
    return (
      (tA.text || '').trim() === (tB.text || '').trim() &&
      Boolean(tA.done) === Boolean(tB.done) &&
      (tA.priority || null) === (tB.priority || null) &&
      (tA.dueDate || null) === (tB.dueDate || null) &&
      Boolean(tA.pinned) === Boolean(tB.pinned) &&
      Boolean(tA.isArchive) === Boolean(tB.isArchive) &&
      (tA.description || '').trim() === (tB.description || '').trim() &&
      (tA.timeEstimate || '').trim() === (tB.timeEstimate || '').trim() &&
      JSON.stringify(tA.subtasks || []) === JSON.stringify(tB.subtasks || [])
    );
  }

  /**
   * Escape HTML for safe rendering
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Download a safety backup of the current localStorage to disk
   */
  function downloadSafetyBackup() {
    const backupData = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      backupData[key] = localStorage.getItem(key);
    }
    const wrappedBackup = {
      signature: "SkhayedulerBackup_v1",
      version: 1,
      createdAt: new Date().toISOString(),
      label: "pre_merge_safety_backup",
      data: backupData
    };
    const blob = new Blob([JSON.stringify(wrappedBackup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Skhayeduler_PreMerge_SafetyBackup_${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Parse uploaded file content and extract backup payload
   */
  function parseBackupFileContent(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new Error("The selected file is not a valid JSON file.");
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error("The backup file contains empty or invalid data (expected a backup object).");
    }

    // Standard Skhayeduler signed backup
    if (parsed.signature === "SkhayedulerBackup_v1" && parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)) {
      return parsed.data;
    }

    // Direct key-value backup fallback
    if (!parsed.signature && typeof parsed === 'object') {
      return parsed;
    }

    throw new Error("Unrecognized backup format. Missing valid data or signature.");
  }

  /**
   * Main Analysis & Staging Engine
   * Compares incoming backupData with current localStorage in memory.
   * Discovers additions, identical matches, and conflicts.
   */
  function analyzeBackup(backupData) {
    const conflicts = [];

    // 1. Scheduled Tasks
    const localTasks = safeParse(localStorage.getItem('tasks'), {});
    const incomingTasks = safeParse(backupData.tasks, {});
    const stagedTasks = { ...localTasks };

    const allDateKeys = new Set([...Object.keys(localTasks), ...Object.keys(incomingTasks)]);
    allDateKeys.forEach(date => {
      const hasLocal = Object.prototype.hasOwnProperty.call(localTasks, date);
      const hasIncoming = Object.prototype.hasOwnProperty.call(incomingTasks, date);

      if (!hasLocal && hasIncoming) {
        // Brand new date -> auto-stage
        stagedTasks[date] = incomingTasks[date];
      } else if (hasLocal && hasIncoming) {
        // Exists in both -> compare for differences
        if (!areTaskDaysEqual(localTasks[date], incomingTasks[date])) {
          conflicts.push({
            category: 'task',
            id: date,
            title: formatHumanDate(date),
            subtitle: 'Different tasks found between your device and this backup',
            local: normalizeDayTasks(localTasks[date]),
            incoming: normalizeDayTasks(incomingTasks[date])
          });
        }
      }
    });

    // 2. Todos
    const localTodos = safeParse(localStorage.getItem('todos'), []);
    const incomingTodos = safeParse(backupData.todos, []);
    const stagedTodos = [...localTodos];

    if (Array.isArray(incomingTodos)) {
      const matchedLocalTodoIndices = new Set();
      const unmatchedIncomingTodos = [];

      // Pass 1: Identify identical todos (same ID, or same text + createdAt + all fields equal)
      incomingTodos.forEach(inTodo => {
        if (!inTodo || typeof inTodo !== 'object') return;

        let foundExact = false;
        for (let i = 0; i < localTodos.length; i++) {
          if (matchedLocalTodoIndices.has(i)) continue;
          const loc = localTodos[i];
          const idMatch = inTodo.id && loc.id && String(loc.id) === String(inTodo.id);
          const fallbackMatch = (loc.text || '').trim() === (inTodo.text || '').trim() && loc.createdAt && loc.createdAt === inTodo.createdAt;

          if ((idMatch || fallbackMatch) && areTodosEqual(loc, inTodo)) {
            matchedLocalTodoIndices.add(i);
            foundExact = true;
            break;
          }
        }

        if (!foundExact) {
          unmatchedIncomingTodos.push(inTodo);
        }
      });

      // Pass 2: For remaining todos, check for ID or text match that has different content
      unmatchedIncomingTodos.forEach(inTodo => {
        let matchedIdx = -1;
        for (let i = 0; i < localTodos.length; i++) {
          if (matchedLocalTodoIndices.has(i)) continue;
          const loc = localTodos[i];
          const idMatch = inTodo.id && loc.id && String(loc.id) === String(inTodo.id);
          const fallbackMatch = (loc.text || '').trim() === (inTodo.text || '').trim() && (!inTodo.id || !loc.id);

          if (idMatch || fallbackMatch) {
            matchedIdx = i;
            break;
          }
        }

        if (matchedIdx !== -1) {
          matchedLocalTodoIndices.add(matchedIdx);
          const matchedLocal = localTodos[matchedIdx];
          conflicts.push({
            category: 'todo',
            id: inTodo.id || inTodo.text,
            title: inTodo.text || 'Untitled To-Do',
            subtitle: 'Different details found for this item',
            local: matchedLocal,
            incoming: inTodo
          });
        } else {
          // New todo -> auto-stage
          stagedTodos.push(inTodo);
        }
      });
    }

    // 3. Templates (taskClipboard)
    const localTemplates = safeParse(localStorage.getItem('taskClipboard'), []);
    const incomingTemplates = safeParse(backupData.taskClipboard, []);
    const stagedTemplates = [...localTemplates];

    if (Array.isArray(incomingTemplates)) {
      const matchedLocalTmplIndices = new Set();
      const unmatchedIncomingTmpls = [];

      // Pass 1: Identify identical templates (same text, same color, same favorite status)
      incomingTemplates.forEach(inTmpl => {
        if (!inTmpl || !inTmpl.text) return;
        const cleanInText = (inTmpl.text || '').trim();
        const cleanInColor = (inTmpl.color || '').toLowerCase().trim();
        const inFav = Boolean(inTmpl.favorite);

        let foundExact = false;
        for (let i = 0; i < localTemplates.length; i++) {
          if (matchedLocalTmplIndices.has(i)) continue;
          const loc = localTemplates[i];
          const cleanLocText = (loc.text || '').trim();
          const cleanLocColor = (loc.color || '').toLowerCase().trim();
          const locFav = Boolean(loc.favorite);

          if (cleanLocText === cleanInText && cleanLocColor === cleanInColor && locFav === inFav) {
            matchedLocalTmplIndices.add(i);
            foundExact = true;
            break;
          }
        }

        if (!foundExact) {
          unmatchedIncomingTmpls.push(inTmpl);
        }
      });

      // Pass 2: For remaining incoming templates, match by text + color (differing favorite) or text
      unmatchedIncomingTmpls.forEach(inTmpl => {
        const cleanInText = (inTmpl.text || '').trim();
        const cleanInColor = (inTmpl.color || '').toLowerCase().trim();

        // Match same text AND same color first
        let matchedIdx = -1;
        for (let i = 0; i < localTemplates.length; i++) {
          if (matchedLocalTmplIndices.has(i)) continue;
          const loc = localTemplates[i];
          if ((loc.text || '').trim() === cleanInText && (loc.color || '').toLowerCase().trim() === cleanInColor) {
            matchedIdx = i;
            break;
          }
        }

        // Fallback to same text if no same text+color pair found
        if (matchedIdx === -1) {
          for (let i = 0; i < localTemplates.length; i++) {
            if (matchedLocalTmplIndices.has(i)) continue;
            const loc = localTemplates[i];
            if ((loc.text || '').trim() === cleanInText) {
              matchedIdx = i;
              break;
            }
          }
        }

        if (matchedIdx !== -1) {
          matchedLocalTmplIndices.add(matchedIdx);
          const matchedLocal = localTemplates[matchedIdx];
          conflicts.push({
            category: 'template',
            id: cleanInText,
            title: cleanInText || 'Untitled Template',
            subtitle: 'Different color or favorite status',
            local: matchedLocal,
            incoming: inTmpl
          });
        } else {
          // New template -> auto-stage
          stagedTemplates.push(inTmpl);
        }
      });
    }

    // 4. App Settings & Theme
    const localSettings = safeParse(localStorage.getItem('appSettings'), {});
    const incomingSettings = safeParse(backupData.appSettings, {});
    const localTheme = localStorage.getItem('theme') || 'default';
    const incomingTheme = backupData.theme || (incomingSettings && incomingSettings.theme) || null;

    const stagedSettings = { ...localSettings };
    let stagedTheme = localTheme;

    const settingsDiffs = [];
    if (incomingSettings && typeof incomingSettings === 'object') {
      Object.keys(incomingSettings).forEach(key => {
        const localVal = localSettings[key];
        const inVal = incomingSettings[key];
        if (JSON.stringify(localVal) !== JSON.stringify(inVal)) {
          settingsDiffs.push({
            key,
            localVal: localVal === undefined ? '(not set)' : localVal,
            incomingVal: inVal
          });
        }
      });
    }

    if (incomingTheme && incomingTheme !== localTheme) {
      settingsDiffs.push({
        key: 'Theme',
        localVal: localTheme,
        incomingVal: incomingTheme
      });
    }

    if (settingsDiffs.length > 0) {
      conflicts.push({
        category: 'settings',
        id: 'appSettings',
        title: 'Application Preferences & Theme',
        subtitle: `${settingsDiffs.length} setting(s) differ from backup`,
        diffs: settingsDiffs,
        incomingSettings,
        incomingTheme
      });
    }

    // 5. Weather State
    const localWeather = safeParse(localStorage.getItem('scheduler_weather_state'), null);
    const incomingWeather = safeParse(backupData.scheduler_weather_state, null);
    let stagedWeather = localWeather;

    if (incomingWeather && typeof incomingWeather === 'object') {
      if (!localWeather) {
        stagedWeather = incomingWeather;
      } else {
        const localCity = (localWeather.city || localWeather.cityName || '').trim();
        const incomingCity = (incomingWeather.city || incomingWeather.cityName || '').trim();
        if (localCity && incomingCity && localCity.toLowerCase() !== incomingCity.toLowerCase()) {
          conflicts.push({
            category: 'weather',
            id: 'scheduler_weather_state',
            title: 'Weather Location',
            subtitle: `Current: ${localCity} vs Incoming: ${incomingCity}`,
            localCity,
            incomingCity,
            incomingWeather
          });
        }
      }
    }

    // 6. Generic other keys
    const handledKeys = new Set([
      'tasks', 'todos', 'taskClipboard', 'appSettings', 'theme',
      'scheduler_weather_state', 'signature', 'version', 'createdAt',
      'pwa-installed', 'hideAllButtons'
    ]);
    const stagedOtherKeys = {};

    Object.keys(backupData).forEach(key => {
      if (handledKeys.has(key)) return;
      const localVal = localStorage.getItem(key);
      const incomingVal = backupData[key];
      const normInVal = typeof incomingVal === 'string' ? incomingVal : JSON.stringify(incomingVal);

      if (localVal === null) {
        stagedOtherKeys[key] = normInVal;
      } else if (localVal !== normInVal) {
        conflicts.push({
          category: 'other',
          id: key,
          title: `Custom Storage Item: "${key}"`,
          subtitle: 'Different value in backup',
          key,
          localVal,
          incomingVal: normInVal
        });
      }
    });

    return {
      conflicts,
      stagedTasks,
      stagedTodos,
      stagedTemplates,
      stagedSettings,
      stagedTheme,
      stagedWeather,
      stagedOtherKeys,
      incomingTasks,
      incomingTodos,
      incomingTemplates,
      incomingSettings,
      backupData
    };
  }

  /**
   * Commit the staged data transactionally to localStorage with rollback safety
   */
  function commitMerge(session) {
    // 1. Snapshot existing keys so we can roll back cleanly if storage quota is exceeded
    const rollbackKeys = [
      'tasks', 'todos', 'taskClipboard', 'appSettings', 'theme', 'scheduler_weather_state'
    ];
    if (session.stagedOtherKeys) {
      Object.keys(session.stagedOtherKeys).forEach(k => {
        if (!rollbackKeys.includes(k)) rollbackKeys.push(k);
      });
    }

    const snapshot = {};
    rollbackKeys.forEach(k => {
      snapshot[k] = localStorage.getItem(k);
    });

    try {
      // 1. Tasks
      localStorage.setItem('tasks', JSON.stringify(session.stagedTasks));

      // 2. Todos
      localStorage.setItem('todos', JSON.stringify(session.stagedTodos));

      // 3. Task Clipboard (Templates)
      localStorage.setItem('taskClipboard', JSON.stringify(session.stagedTemplates));

      // 4. Settings
      localStorage.setItem('appSettings', JSON.stringify(session.stagedSettings));

      // 5. Theme
      if (session.stagedTheme) {
        localStorage.setItem('theme', session.stagedTheme);
      }

      // 6. Weather
      if (session.stagedWeather) {
        localStorage.setItem('scheduler_weather_state', JSON.stringify(session.stagedWeather));
      }

      // 7. Other keys
      if (session.stagedOtherKeys) {
        Object.keys(session.stagedOtherKeys).forEach(k => {
          localStorage.setItem(k, session.stagedOtherKeys[k]);
        });
      }

      // Hide modal
      closeModal();

      // Show friendly confirmation
      alert("✅ Backup merged successfully with your data! Reloading Skhayeduler now...");
      setTimeout(() => location.reload(), 400);

    } catch (err) {
      console.error("Merge commit error:", err);
      // Rollback to snapshot state to prevent partial data corruption
      try {
        rollbackKeys.forEach(k => {
          if (snapshot[k] !== null && snapshot[k] !== undefined) {
            localStorage.setItem(k, snapshot[k]);
          } else {
            localStorage.removeItem(k);
          }
        });
      } catch (rollbackErr) {
        console.error("Rollback failed:", rollbackErr);
      }

      alert("⚠️ Error saving merged data to storage: " + err.message + "\nPlease make sure your browser storage has enough free space. Previous data was preserved.");
    }
  }

  /**
   * Conflict Modal UI Controller
   */
  let modalEl = null;
  let backdropEl = null;

  function ensureModalElements() {
    if (!backdropEl) backdropEl = document.getElementById('backup-conflict-backdrop');
    if (!modalEl) modalEl = document.getElementById('backup-conflict-modal');
  }

  function openModal() {
    // Ensure hamburger menu slider is closed when modal opens
    if (typeof window.closeMenu === 'function') {
      window.closeMenu();
    }
    ensureModalElements();
    if (backdropEl) backdropEl.classList.add('active');
    if (modalEl) modalEl.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    ensureModalElements();
    if (backdropEl) backdropEl.classList.remove('active');
    if (modalEl) modalEl.classList.remove('active');
    document.body.style.overflow = '';
    mergeSession = null;
  }

  /**
   * Render Task Differences in Clear, Non-Techy Text
   * Compares each period and only lists periods that actually differ.
   * Identical periods are summarized with a clean note.
   */
  function renderTasksComparison(localDay, incomingDay, leftEl, rightEl, noteEl) {
    const normLocal = normalizeDayTasks(localDay);
    const normIn = normalizeDayTasks(incomingDay);
    const periods = [
      { key: 'morning', label: 'Morning' },
      { key: 'afternoon', label: 'Afternoon' },
      { key: 'evening', label: 'Evening' }
    ];

    let leftHtml = '';
    let rightHtml = '';
    const identicalPeriods = [];
    let diffCount = 0;

    periods.forEach(p => {
      const listLocal = normLocal[p.key] || [];
      const listIn = normIn[p.key] || [];

      // Check if identical
      let isIdentical = listLocal.length === listIn.length;
      if (isIdentical) {
        for (let i = 0; i < listLocal.length; i++) {
          if ((listLocal[i].task || '').trim() !== (listIn[i].task || '').trim() ||
              (listLocal[i].color || '').toLowerCase().trim() !== (listIn[i].color || '').toLowerCase().trim()) {
            isIdentical = false;
            break;
          }
        }
      }

      if (isIdentical) {
        return; // Only show differing periods!
      }

      diffCount++;

      // Left Column (Device)
      leftHtml += `<div class="bcm-diff-period-section">
        <div class="bcm-diff-period-title">${p.label}</div>`;
      if (listLocal.length === 0) {
        leftHtml += `<div class="bcm-diff-empty-text">(None)</div>`;
      } else {
        listLocal.forEach(t => {
          const color = sanitizeColor(t.color || '#4285f4');
          leftHtml += `<div class="bcm-diff-task-item">
            <span class="bcm-task-dot" style="background-color: ${escapeHtml(color)};"></span>
            <span class="bcm-diff-task-text">${escapeHtml(t.task || '(Blank task)')}</span>
          </div>`;
        });
      }
      leftHtml += `</div>`;

      // Right Column (Backup File)
      rightHtml += `<div class="bcm-diff-period-section">
        <div class="bcm-diff-period-title">${p.label}</div>`;
      if (listIn.length === 0) {
        rightHtml += `<div class="bcm-diff-empty-text">(None)</div>`;
      } else {
        listIn.forEach(t => {
          const color = sanitizeColor(t.color || '#4285f4');
          rightHtml += `<div class="bcm-diff-task-item">
            <span class="bcm-task-dot" style="background-color: ${escapeHtml(color)};"></span>
            <span class="bcm-diff-task-text">${escapeHtml(t.task || '(Blank task)')}</span>
          </div>`;
        });
      }
      rightHtml += `</div>`;
    });

    if (diffCount === 0) {
      leftHtml = `<div class="bcm-diff-empty-text">All tasks identical</div>`;
      rightHtml = `<div class="bcm-diff-empty-text">All tasks identical</div>`;
    }

    if (leftEl) leftEl.innerHTML = leftHtml;
    if (rightEl) rightEl.innerHTML = rightHtml;

    if (noteEl) {
      noteEl.innerHTML = '';
      noteEl.style.display = 'none';
    }
  }

  /**
   * Render To-Do Item Comparison
   */
  function renderTodoComparison(local, incoming, leftEl, rightEl, noteEl) {
    const fields = [
      { label: 'Status', getVal: t => t ? (t.done ? 'Completed' : 'Pending') : '(None)' },
      { label: 'Priority', getVal: t => t ? (t.priority ? t.priority.toUpperCase() : 'Normal') : '(None)' },
      { label: 'Due Date', getVal: t => t ? (t.dueDate || '(None)') : '(None)' },
      { label: 'Notes', getVal: t => t ? (t.description || '(None)') : '(None)' }
    ];

    let leftHtml = '';
    let rightHtml = '';

    fields.forEach(f => {
      const vLoc = f.getVal(local);
      const vIn = f.getVal(incoming);
      if (vLoc !== vIn) {
        leftHtml += `<div class="bcm-diff-field-row"><span class="bcm-diff-field-name">${f.label}:</span> <b>${escapeHtml(vLoc)}</b></div>`;
        rightHtml += `<div class="bcm-diff-field-row"><span class="bcm-diff-field-name">${f.label}:</span> <b>${escapeHtml(vIn)}</b></div>`;
      }
    });

    if (leftEl) leftEl.innerHTML = leftHtml || '<div class="bcm-diff-empty-text">Identical</div>';
    if (rightEl) rightEl.innerHTML = rightHtml || '<div class="bcm-diff-empty-text">Identical</div>';
    if (noteEl) {
      noteEl.innerHTML = '';
      noteEl.style.display = 'none';
    }
  }

  /**
   * Render Job Template Comparison
   */
  function renderTemplateComparison(local, incoming, leftEl, rightEl, noteEl) {
    const locColor = sanitizeColor((local && local.color) || '#4285f4');
    const inColor = sanitizeColor((incoming && incoming.color) || '#4285f4');
    const locFav = local && local.favorite ? 'Favorite' : 'Standard';
    const inFav = incoming && incoming.favorite ? 'Favorite' : 'Standard';

    let leftHtml = '';
    let rightHtml = '';

    if (locColor !== inColor) {
      leftHtml += `<div class="bcm-diff-field-row"><span class="bcm-diff-field-name">Color:</span> <span class="bcm-task-dot" style="background-color: ${escapeHtml(locColor)};"></span> ${escapeHtml(locColor)}</div>`;
      rightHtml += `<div class="bcm-diff-field-row"><span class="bcm-diff-field-name">Color:</span> <span class="bcm-task-dot" style="background-color: ${escapeHtml(inColor)};"></span> ${escapeHtml(inColor)}</div>`;
    }

    if (locFav !== inFav) {
      leftHtml += `<div class="bcm-diff-field-row"><span class="bcm-diff-field-name">Status:</span> <b>${escapeHtml(locFav)}</b></div>`;
      rightHtml += `<div class="bcm-diff-field-row"><span class="bcm-diff-field-name">Status:</span> <b>${escapeHtml(inFav)}</b></div>`;
    }

    if (leftEl) leftEl.innerHTML = leftHtml || '<div class="bcm-diff-empty-text">Identical</div>';
    if (rightEl) rightEl.innerHTML = rightHtml || '<div class="bcm-diff-empty-text">Identical</div>';
    if (noteEl) {
      noteEl.innerHTML = '';
      noteEl.style.display = 'none';
    }
  }

  /**
   * Render Settings Comparison
   */
  function renderSettingsComparison(diffs, leftEl, rightEl, noteEl) {
    let leftHtml = '';
    let rightHtml = '';

    (diffs || []).forEach(d => {
      const locVal = typeof d.localVal === 'object' ? JSON.stringify(d.localVal) : String(d.localVal);
      const inVal = typeof d.incomingVal === 'object' ? JSON.stringify(d.incomingVal) : String(d.incomingVal);

      leftHtml += `<div class="bcm-diff-field-row"><span class="bcm-diff-field-name">${escapeHtml(d.key)}:</span> <b>${escapeHtml(locVal)}</b></div>`;
      rightHtml += `<div class="bcm-diff-field-row"><span class="bcm-diff-field-name">${escapeHtml(d.key)}:</span> <b>${escapeHtml(inVal)}</b></div>`;
    });

    if (leftEl) leftEl.innerHTML = leftHtml || '<div class="bcm-diff-empty-text">No differences</div>';
    if (rightEl) rightEl.innerHTML = rightHtml || '<div class="bcm-diff-empty-text">No differences</div>';
    if (noteEl) {
      noteEl.innerHTML = '';
      noteEl.style.display = 'none';
    }
  }

  /**
   * Render Generic / Weather Comparison
   */
  function renderGenericComparison(locVal, inVal, leftEl, rightEl, noteEl) {
    const locStr = typeof locVal === 'object' ? JSON.stringify(locVal) : String(locVal);
    const inStr = typeof inVal === 'object' ? JSON.stringify(inVal) : String(inVal);

    if (leftEl) leftEl.innerHTML = `<div class="bcm-diff-field-row"><b>${escapeHtml(locStr)}</b></div>`;
    if (rightEl) rightEl.innerHTML = `<div class="bcm-diff-field-row"><b>${escapeHtml(inStr)}</b></div>`;
    if (noteEl) {
      noteEl.innerHTML = '';
      noteEl.style.display = 'none';
    }
  }

  /**
   * Render the current conflict with clear, friendly text in the comparison drawer
   */
  function renderCurrentConflict() {
    ensureModalElements();
    if (!mergeSession || mergeSession.currentIndex >= mergeSession.conflicts.length) {
      // All resolved!
      if (mergeSession) commitMerge(mergeSession);
      return;
    }

    const c = mergeSession.conflicts[mergeSession.currentIndex];
    const total = mergeSession.conflicts.length;
    const currentNum = mergeSession.currentIndex + 1;

    // Elements
    const counterEl = document.getElementById('bcm-counter');
    const categoryBadgeEl = document.getElementById('bcm-category-badge');
    const titleEl = document.getElementById('bcm-conflict-title');
    const subtitleEl = document.getElementById('bcm-conflict-subtitle');
    const leftContentEl = document.getElementById('bcm-local-content');
    const rightContentEl = document.getElementById('bcm-incoming-content');
    const unchangedNoteEl = document.getElementById('bcm-unchanged-note');
    const combineBtn = document.getElementById('bcm-action-combine');
    const applyAllCheckbox = document.getElementById('bcm-apply-all-checkbox');
    const applyAllLabel = document.getElementById('bcm-apply-all-label');

    // Drawer and toggle button
    const drawerEl = document.getElementById('bcm-diff-drawer');
    const toggleBtn = document.getElementById('bcm-toggle-diff-btn');
    const toggleText = document.getElementById('bcm-diff-toggle-text');
    const toggleArrow = toggleBtn ? toggleBtn.querySelector('.bcm-diff-toggle-arrow') : null;

    // Open by default
    if (drawerEl) drawerEl.classList.remove('hidden');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
    if (toggleText) toggleText.textContent = 'Hide comparison details';
    if (toggleArrow) toggleArrow.textContent = 'expand_less';

    if (counterEl) counterEl.textContent = `${currentNum} of ${total}`;
    if (applyAllCheckbox) applyAllCheckbox.checked = false;

    // Friendly Badge Names
    const categoryNames = {
      task: 'Schedule',
      todo: 'To-Do',
      template: 'Template',
      settings: 'Settings',
      weather: 'Weather',
      other: 'Data'
    };
    if (categoryBadgeEl) {
      categoryBadgeEl.textContent = categoryNames[c.category] || 'Difference';
      categoryBadgeEl.className = `bcm-category-badge bcm-cat-${c.category}`;
    }

    if (titleEl) titleEl.textContent = c.title || 'Data Difference';
    if (subtitleEl) subtitleEl.textContent = c.subtitle || '';

    if (c.category === 'task') {
      renderTasksComparison(c.local, c.incoming, leftContentEl, rightContentEl, unchangedNoteEl);
      if (combineBtn) combineBtn.style.display = 'inline-flex';
      if (applyAllLabel) applyAllLabel.textContent = "Apply to all remaining Schedule differences";

    } else if (c.category === 'todo') {
      renderTodoComparison(c.local, c.incoming, leftContentEl, rightContentEl, unchangedNoteEl);
      if (combineBtn) combineBtn.style.display = 'inline-flex';
      if (applyAllLabel) applyAllLabel.textContent = "Apply to all remaining To-Do differences";

    } else if (c.category === 'template') {
      renderTemplateComparison(c.local, c.incoming, leftContentEl, rightContentEl, unchangedNoteEl);
      if (combineBtn) combineBtn.style.display = 'inline-flex';
      if (applyAllLabel) applyAllLabel.textContent = "Apply to all remaining Template differences";

    } else if (c.category === 'settings') {
      renderSettingsComparison(c.diffs, leftContentEl, rightContentEl, unchangedNoteEl);
      if (combineBtn) combineBtn.style.display = 'none'; // Settings cannot be merged together
      if (applyAllLabel) applyAllLabel.textContent = "Apply to all remaining Setting differences";

    } else if (c.category === 'weather') {
      renderGenericComparison(c.localCity, c.incomingCity, leftContentEl, rightContentEl, unchangedNoteEl);
      if (combineBtn) combineBtn.style.display = 'none';
      if (applyAllLabel) applyAllLabel.textContent = "Apply to all Weather differences";

    } else {
      renderGenericComparison(c.localVal, c.incomingVal, leftContentEl, rightContentEl, unchangedNoteEl);
      if (combineBtn) combineBtn.style.display = 'none';
      if (applyAllLabel) applyAllLabel.textContent = "Apply to all remaining differences";
    }
  }

  /**
   * Resolve a single conflict
   * action: 'keep_local' | 'replace' | 'combine'
   */
  function applyConflictResolution(conflict, action) {
    if (!mergeSession) return;

    if (conflict.category === 'task') {
      const date = conflict.id;
      if (action === 'keep_local') {
        mergeSession.stagedTasks[date] = conflict.local;
      } else if (action === 'replace') {
        mergeSession.stagedTasks[date] = conflict.incoming;
      } else if (action === 'combine') {
        mergeSession.stagedTasks[date] = combineTaskDays(conflict.local, conflict.incoming);
      }

    } else if (conflict.category === 'todo') {
      if (action === 'keep_local') {
        // Local already present in stagedTodos, do nothing
      } else if (action === 'replace') {
        // Replace existing matching todo with incoming
        const idx = mergeSession.stagedTodos.findIndex(t =>
          (conflict.local && t === conflict.local) ||
          (conflict.incoming.id && t.id && String(t.id) === String(conflict.incoming.id)) ||
          ((t.text || '').trim() === (conflict.incoming.text || '').trim() && t.createdAt && t.createdAt === conflict.incoming.createdAt) ||
          ((t.text || '').trim() === (conflict.incoming.text || '').trim())
        );
        if (idx !== -1) {
          mergeSession.stagedTodos[idx] = conflict.incoming;
        } else {
          mergeSession.stagedTodos.push(conflict.incoming);
        }
      } else if (action === 'combine') {
        // Keep both: ensure incoming has distinct ID
        const newTodo = { ...conflict.incoming, id: Date.now() + '_' + Math.floor(Math.random() * 10000) };
        mergeSession.stagedTodos.push(newTodo);
      }

    } else if (conflict.category === 'template') {
      if (action === 'keep_local') {
        // Keep local
      } else if (action === 'replace') {
        const idx = mergeSession.stagedTemplates.findIndex(t =>
          (conflict.local && t === conflict.local) ||
          ((t.text || '').trim() === (conflict.incoming.text || '').trim() && (t.color || '').toLowerCase().trim() === (conflict.incoming.color || '').toLowerCase().trim()) ||
          ((t.text || '').trim() === (conflict.incoming.text || '').trim())
        );
        if (idx !== -1) {
          mergeSession.stagedTemplates[idx] = conflict.incoming;
        } else {
          mergeSession.stagedTemplates.push(conflict.incoming);
        }
      } else if (action === 'combine') {
        // Only push incoming if not already verbatim identical in stagedTemplates
        const alreadyPresent = mergeSession.stagedTemplates.some(t =>
          (t.text || '').trim() === (conflict.incoming.text || '').trim() &&
          (t.color || '').toLowerCase().trim() === (conflict.incoming.color || '').toLowerCase().trim() &&
          Boolean(t.favorite) === Boolean(conflict.incoming.favorite)
        );
        if (!alreadyPresent) {
          mergeSession.stagedTemplates.push(conflict.incoming);
        }
      }

    } else if (conflict.category === 'settings') {
      if (action === 'replace') {
        mergeSession.stagedSettings = { ...mergeSession.stagedSettings, ...conflict.incomingSettings };
        if (conflict.incomingTheme) {
          mergeSession.stagedTheme = conflict.incomingTheme;
        }
      }
      // 'keep_local' leaves stagedSettings and stagedTheme untouched

    } else if (conflict.category === 'weather') {
      if (action === 'replace') {
        mergeSession.stagedWeather = conflict.incomingWeather;
      }

    } else if (conflict.category === 'other') {
      if (action === 'replace') {
        mergeSession.stagedOtherKeys[conflict.key] = conflict.incomingVal;
      }
    }
  }

  /**
   * Action button handler
   */
  function handleConflictAction(action) {
    if (!mergeSession) return;
    const checkbox = document.getElementById('bcm-apply-all-checkbox');
    const applyToAllRemaining = checkbox ? checkbox.checked : false;

    const currentConflict = mergeSession.conflicts[mergeSession.currentIndex];
    const category = currentConflict.category;

    if (applyToAllRemaining) {
      // Resolve current and all remaining conflicts of the SAME category
      for (let i = mergeSession.currentIndex; i < mergeSession.conflicts.length; i++) {
        const conf = mergeSession.conflicts[i];
        if (conf.category === category) {
          applyConflictResolution(conf, action);
          conf._resolved = true;
        }
      }
    } else {
      // Resolve just this conflict
      applyConflictResolution(currentConflict, action);
      currentConflict._resolved = true;
      mergeSession.currentIndex++;
    }

    // Always advance to the next unresolved conflict
    while (
      mergeSession.currentIndex < mergeSession.conflicts.length &&
      mergeSession.conflicts[mergeSession.currentIndex]._resolved
    ) {
      mergeSession.currentIndex++;
    }

    renderCurrentConflict();
  }

  /**
   * Main entry point when a backup file is uploaded
   */
  function handleBackupUpload(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      try {
        const backupData = parseBackupFileContent(event.target.result);
        const analysis = analyzeBackup(backupData);

        if (analysis.conflicts.length === 0) {
          // Zero conflicts! Seamlessly merge all additions without prompting
          commitMerge({
            stagedTasks: analysis.stagedTasks,
            stagedTodos: analysis.stagedTodos,
            stagedTemplates: analysis.stagedTemplates,
            stagedSettings: analysis.stagedSettings,
            stagedTheme: analysis.stagedTheme,
            stagedWeather: analysis.stagedWeather,
            stagedOtherKeys: analysis.stagedOtherKeys
          });
          return;
        }

        // Conflicts found -> start merge review session
        mergeSession = {
          ...analysis,
          currentIndex: 0
        };

        openModal();
        renderCurrentConflict();

      } catch (err) {
        console.error("Backup file error:", err);
        alert("⚠️ Failed to process backup file: " + err.message);
      }
    };

    reader.onerror = function () {
      alert("⚠️ Error reading the selected file. Please try again.");
    };

    reader.readAsText(file);
  }

  /**
   * Bind event listeners to modal buttons
   */
  function initModalListeners() {
    ensureModalElements();

    const closeBtn = document.getElementById('bcm-close-btn');
    const cancelBtn = document.getElementById('bcm-action-cancel');
    const keepLocalBtn = document.getElementById('bcm-action-keep-local');
    const replaceBtn = document.getElementById('bcm-action-replace');
    const combineBtn = document.getElementById('bcm-action-combine');
    const safetyBackupBtn = document.getElementById('bcm-safety-backup-btn');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (confirm("Cancel backup import? No changes will be made to your current data.")) {
          closeModal();
        }
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (confirm("Cancel backup import? No changes will be made to your current data.")) {
          closeModal();
        }
      });
    }

    if (keepLocalBtn) {
      keepLocalBtn.addEventListener('click', () => handleConflictAction('keep_local'));
    }

    if (replaceBtn) {
      replaceBtn.addEventListener('click', () => handleConflictAction('replace'));
    }

    if (combineBtn) {
      combineBtn.addEventListener('click', () => handleConflictAction('combine'));
    }

    if (safetyBackupBtn) {
      safetyBackupBtn.addEventListener('click', () => {
        downloadSafetyBackup();
      });
    }

    const toggleDiffBtn = document.getElementById('bcm-toggle-diff-btn');
    if (toggleDiffBtn) {
      toggleDiffBtn.addEventListener('click', () => {
        const drawerEl = document.getElementById('bcm-diff-drawer');
        const toggleText = document.getElementById('bcm-diff-toggle-text');
        const toggleArrow = toggleDiffBtn.querySelector('.bcm-diff-toggle-arrow');
        if (!drawerEl) return;

        const isHidden = drawerEl.classList.contains('hidden');
        if (isHidden) {
          drawerEl.classList.remove('hidden');
          toggleDiffBtn.setAttribute('aria-expanded', 'true');
          if (toggleText) toggleText.textContent = 'Hide comparison details';
          if (toggleArrow) toggleArrow.textContent = 'expand_less';
        } else {
          drawerEl.classList.add('hidden');
          toggleDiffBtn.setAttribute('aria-expanded', 'false');
          if (toggleText) toggleText.textContent = 'Show comparison details';
          if (toggleArrow) toggleArrow.textContent = 'expand_more';
        }
      });
    }

    // Escape key closes modal safely
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalEl && modalEl.classList.contains('active')) {
        if (confirm("Cancel backup import? No changes will be made to your current data.")) {
          closeModal();
        }
      }
    });
  }

  // Initialize listeners when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initModalListeners);
  } else {
    initModalListeners();
  }

  // Expose BackupManager API to global window
  window.BackupManager = {
    handleBackupUpload,
    downloadSafetyBackup,
    analyzeBackup,
    combineTaskDays,
    areTaskDaysEqual,
    renderTasksComparison
  };

})();
