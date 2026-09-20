// ==========================================================================
// Year Map Module - 12-Month Grid Map for Month View
// ==========================================================================

(function () {
  'use strict';

  const MONTH_NAMES_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const WEEKDAY_NAMES_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // GitHub contribution graph green shades
  const GITHUB_HEATMAP_SHADES = {
    1: '#9be9a8', // Light green
    2: '#40c463', // Medium green
    3: '#30a14e', // Dark green
    4: '#216e39', // Deepest green
    defaultMany: '#216e39'
  };

  let containerEl = null;
  let gridEl = null;
  let titleEl = null;
  let arrowWrapperEl = null;
  let arrowBtn = null;
  let modeBtn = null;
  let modeLabelEl = null;
  let gotoMonthBtn = null;
  let gotoListBtn = null;
  let triggerBtn = null;

  let currentYear = 2026;
  let currentMode = 'heatmap'; // 'heatmap' | 'stripes'
  let selectedMonth = 0;

  function init() {
    containerEl = document.getElementById('year-map-container');
    gridEl = document.getElementById('year-map-grid');
    titleEl = document.getElementById('year-map-title');
    arrowWrapperEl = document.getElementById('year-map-arrow-wrapper');
    arrowBtn = document.getElementById('year-map-arrow-btn');
    modeBtn = document.getElementById('year-map-mode-btn');
    modeLabelEl = document.getElementById('year-map-mode-label');
    gotoMonthBtn = document.getElementById('year-map-goto-month-btn');
    gotoListBtn = document.getElementById('year-map-goto-list-btn');
    triggerBtn = document.getElementById('month-view-year-map-btn');

    if (!containerEl || !gridEl) return;

    if (triggerBtn) {
      triggerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openYearMap();
      });
    }

    const popupYearMapBtn = document.getElementById('year-map-popup-btn');
    if (popupYearMapBtn) {
      popupYearMapBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        let targetYear = (typeof currentYearValue !== 'undefined' && currentYearValue >= 1) ? currentYearValue : null;
        let targetMonth = (typeof currentMonthValue !== 'undefined') ? currentMonthValue : null;
        if ((targetYear === null || targetMonth === null) && typeof popUpDate === 'string' && popUpDate) {
          const parts = popUpDate.split('-').map(Number);
          if (parts.length === 3) {
            targetYear = parts[0];
            targetMonth = parts[1];
          }
        }

        if (typeof hidePopup === 'function') {
          hidePopup();
        } else {
          const closeBtn = document.getElementById('closePopupBtn');
          if (closeBtn) closeBtn.click();
        }
        openYearMap(targetYear, targetMonth);
      });
    }

    if (titleEl) {
      titleEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof openGoToDateModal === 'function') {
          openGoToDateModal(selectedMonth, currentYear, false, true);
        }
      });
    }

    if (arrowBtn) {
      arrowBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof openGoToDateModal === 'function') {
          openGoToDateModal(selectedMonth, currentYear, false, true);
        }
      });
    }

    if (arrowWrapperEl) {
      arrowWrapperEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof openGoToDateModal === 'function') {
          openGoToDateModal(selectedMonth, currentYear, false, true);
        }
      });
    }

    // Touch Swipe Left/Right to Navigate Years
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    containerEl.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
      }
    }, { passive: true });

    containerEl.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 1) {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const dx = touchEndX - touchStartX;
        const dy = touchEndY - touchStartY;
        const dt = Date.now() - touchStartTime;

        // Valid horizontal swipe: > 45px, predominantly horizontal, within 600ms
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3 && dt < 600) {
          if (dx < 0) {
            // Swipe left -> Next year
            currentYear++;
            renderYearMap(currentYear);
          } else {
            // Swipe right -> Previous year (unbounded)
            currentYear--;
            renderYearMap(currentYear);
          }
        }
      }
    }, { passive: true });

    if (modeBtn) {
      modeBtn.addEventListener('click', toggleMode);
    }

    if (gotoMonthBtn) {
      gotoMonthBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        goToMonthView(selectedMonth, currentYear);
      });
    }

    if (gotoListBtn) {
      gotoListBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof currentMonthVertView !== 'undefined') currentMonthVertView = selectedMonth;
        if (typeof currentYearVertView !== 'undefined') currentYearVertView = currentYear;
        if (typeof currentMonthValue !== 'undefined') currentMonthValue = selectedMonth;
        if (typeof currentYearValue !== 'undefined') currentYearValue = currentYear;
        if (typeof popUpDate !== 'undefined') popUpDate = null;

        closeYearMap();

        if (typeof showCalHorView === 'function') {
          showCalHorView(selectedMonth, currentYear);
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !isYearMapOpen()) return;

      const returnView = window.previousViewBeforeYear || 'month';
      closeYearMap();
      if (returnView === 'list' && typeof showCalHorView === 'function') {
        showCalHorView(selectedMonth, currentYear);
      } else if (typeof showCalVertView === 'function') {
        showCalVertView(selectedMonth, currentYear);
      }
    });

    window.addEventListener('timezone-changed', () => {
      if (isYearMapOpen()) {
        renderYearMap(currentYear);
      }
    });
  }

  function isYearMapOpen() {
    return containerEl && containerEl.style.display !== 'none';
  }

  function openYearMap(targetYearParam, targetMonthParam) {
    if (!containerEl) init();
    if (!containerEl) return;

    window.previousViewBeforeYear = window.currentActiveViewName || 'month';
    window.currentActiveViewName = 'year';

    // Deactivate other views & pause background operations
    const main = document.getElementById('main-container');
    const vert = document.getElementById('calendar-container-vert-view');
    const todo = document.getElementById('todo-container');

    if (main) {
      main.style.display = 'none';
      main.classList.add('view-inactive');
    }
    if (vert) {
      vert.style.display = 'none';
    }
    if (todo) {
      todo.classList.remove('active');
    }
    if (typeof pauseWeatherTicker === 'function') {
      pauseWeatherTicker();
    }

    let targetYear = null;
    if (typeof targetYearParam === 'number' && !isNaN(targetYearParam) && targetYearParam >= 1) {
      targetYear = targetYearParam;
    } else {
      const activeYear = (typeof currentYearVertView !== 'undefined' && currentYearVertView >= 1)
        ? currentYearVertView
        : (typeof currentYearValue !== 'undefined' && currentYearValue >= 1 ? currentYearValue : null);
      if (activeYear) {
        targetYear = activeYear;
      }
    }

    if (!targetYear) {
      const now = typeof AppTimezone !== 'undefined' ? AppTimezone.now() : new Date();
      targetYear = typeof currentYearVertView !== 'undefined' ? currentYearVertView : now.getFullYear();
    }

    currentYear = targetYear;

    const now = typeof AppTimezone !== 'undefined' ? AppTimezone.now() : new Date();
    let targetMonth = null;
    if (typeof targetMonthParam === 'number' && targetMonthParam >= 0 && targetMonthParam <= 11) {
      targetMonth = targetMonthParam;
    } else {
      targetMonth = (typeof currentMonthVertView !== 'undefined' && currentMonthVertView !== null)
        ? currentMonthVertView
        : (typeof currentMonthValue !== 'undefined' && currentMonthValue !== null ? currentMonthValue : now.getMonth());
    }

    selectedMonth = targetMonth;
    if (typeof currentMonthVertView !== 'undefined') currentMonthVertView = selectedMonth;
    if (typeof currentYearVertView !== 'undefined') currentYearVertView = currentYear;
    if (typeof currentMonthValue !== 'undefined') currentMonthValue = selectedMonth;
    if (typeof currentYearValue !== 'undefined') currentYearValue = currentYear;

    containerEl.style.display = 'flex';
    updateModeButtonLabel();
    renderYearMap(currentYear);
  }

  function closeYearMap() {
    if (containerEl) {
      containerEl.style.display = 'none';
      if (gridEl) {
        gridEl.innerHTML = '';
      }
    }
  }

  function toggleMode() {
    currentMode = currentMode === 'stripes' ? 'heatmap' : 'stripes';
    updateModeButtonLabel();
    renderYearMap(currentYear);
  }

  function updateModeButtonLabel() {
    if (modeBtn) {
      modeBtn.title = currentMode === 'stripes' ? 'Switch to Heatmap Mode' : 'Switch to Task Colors Mode';
      if (currentMode === 'heatmap') {
        modeBtn.classList.add('active');
        modeBtn.classList.remove('is-stripes');
      } else {
        modeBtn.classList.remove('active');
        modeBtn.classList.add('is-stripes');
      }
    }
  }

  function getStoredTasks() {
    try {
      return JSON.parse(localStorage.getItem('tasks')) || {};
    } catch (e) {
      return {};
    }
  }

  function getDayTasksList(storedTasks, dateKey) {
    if (!storedTasks || typeof storedTasks !== 'object') return [];
    const dayData = storedTasks[dateKey];
    if (!dayData || typeof dayData !== 'object') return [];

    const tasksList = [];
    const periods = ['morning', 'afternoon', 'evening'];

    periods.forEach(period => {
      const periodTasks = dayData[period];
      if (Array.isArray(periodTasks)) {
        periodTasks.forEach(item => {
          if (item) {
            const rawColor = (typeof item === 'object' && item.color) ? String(item.color) : '#6a5044';
            const color = rawColor.trim() !== '' ? rawColor : '#6a5044';
            const taskText = (typeof item === 'object' && item.task) ? String(item.task) : (typeof item === 'string' ? item : '');
            tasksList.push({
              task: taskText,
              color: color,
              period: period
            });
          }
        });
      }
    });

    return tasksList;
  }


  function renderYearMap(year) {
    if (!gridEl || !titleEl) return;

    const safeYear = parseInt(year, 10) || currentYear || 2026;
    titleEl.textContent = safeYear.toString();
    gridEl.innerHTML = '';

    const storedTasks = getStoredTasks();
    const now = typeof AppTimezone !== 'undefined' ? AppTimezone.now() : new Date();
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const isCurrentYear = safeYear === now.getFullYear();
    const currentActualMonth = now.getMonth();

    for (let m = 0; m < 12; m++) {
      const monthBox = document.createElement('div');
      monthBox.className = 'year-map-month';
      monthBox.dataset.month = m.toString();

      const isCurrentMonth = isCurrentYear && m === currentActualMonth;
      if (isCurrentMonth) {
        monthBox.classList.add('is-current-month');
      }

      if (m === selectedMonth) {
        monthBox.classList.add('is-selected');
      }

      monthBox.addEventListener('click', () => {
        selectMonth(m);
      });

      // Month Title (Clicking it zooms Month View directly to that month)
      const monthHeader = document.createElement('div');
      monthHeader.className = 'year-map-month-header';
      monthHeader.textContent = MONTH_NAMES_SHORT[m];
      monthHeader.title = isCurrentMonth
        ? `Current Month - Open ${MONTH_NAMES_SHORT[m]} ${safeYear} in Month View`
        : `Open ${MONTH_NAMES_SHORT[m]} ${safeYear} in Month View`;
      monthHeader.addEventListener('click', (e) => {
        e.stopPropagation();
        selectMonth(m);
        goToMonthView(m, safeYear);
      });
      monthBox.appendChild(monthHeader);

      // Weekday letters row: S M T W T F S
      const weekdaysRow = document.createElement('div');
      weekdaysRow.className = 'year-map-weekdays';
      WEEKDAY_NAMES_SHORT.forEach(letter => {
        const span = document.createElement('span');
        span.textContent = letter;
        weekdaysRow.appendChild(span);
      });
      monthBox.appendChild(weekdaysRow);

      // Days Grid
      const daysGrid = document.createElement('div');
      daysGrid.className = 'year-map-days-grid';

      // Safe date calculation for unbounded years
      const firstDayDate = new Date(0);
      firstDayDate.setFullYear(safeYear, m, 1);
      const firstDayOfWeek = firstDayDate.getDay();

      const totalDaysDate = new Date(0);
      totalDaysDate.setFullYear(safeYear, m + 1, 0);
      const totalDays = totalDaysDate.getDate();

      // Empty offset cells before day 1
      for (let empty = 0; empty < firstDayOfWeek; empty++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'year-map-day year-map-day-empty';
        daysGrid.appendChild(emptyCell);
      }

      // Day cells
      for (let d = 1; d <= totalDays; d++) {
        const dateKey = `${safeYear}-${m}-${d}`;
        const dayCell = document.createElement('div');
        dayCell.className = 'year-map-day';
        dayCell.dataset.date = dateKey;

        if (dateKey === todayKey) {
          dayCell.classList.add('year-map-today');
        }

        const tasksList = getDayTasksList(storedTasks, dateKey);

        if (tasksList.length > 0) {
          if (currentMode === 'stripes') {
            // Task Colors stacked in order from morning to evening, no space
            dayCell.classList.add('has-stripes');
            const stripesWrap = document.createElement('div');
            stripesWrap.className = 'year-map-stripes-wrap';

            tasksList.forEach(taskItem => {
              const stripe = document.createElement('div');
              stripe.className = 'year-map-stripe';
              stripe.style.backgroundColor = fadeColor(taskItem.color, 0.6);
              stripesWrap.appendChild(stripe);
            });

            dayCell.appendChild(stripesWrap);
          } else {
            // GitHub-style Green Heatmap
            const count = tasksList.length;
            const greenColor = GITHUB_HEATMAP_SHADES[count] || GITHUB_HEATMAP_SHADES.defaultMany;
            dayCell.style.backgroundColor = greenColor;
            dayCell.classList.add('has-heatmap');
            if (count >= 2) {
              dayCell.classList.add('text-light');
            }
          }

          dayCell.title = `${MONTH_NAMES_SHORT[m]} ${d}, ${safeYear}: ${tasksList.length} task${tasksList.length > 1 ? 's' : ''}`;
        } else {
          dayCell.title = `${MONTH_NAMES_SHORT[m]} ${d}, ${safeYear}`;
        }

        const dayNumberSpan = document.createElement('span');
        dayNumberSpan.className = 'year-map-day-number';
        dayNumberSpan.textContent = d.toString();
        dayCell.appendChild(dayNumberSpan);
        daysGrid.appendChild(dayCell);
      }

      monthBox.appendChild(daysGrid);
      gridEl.appendChild(monthBox);
    }
  }

  function selectMonth(m) {
    selectedMonth = m;
    if (typeof currentMonthVertView !== 'undefined') currentMonthVertView = m;
    if (typeof currentMonthValue !== 'undefined') currentMonthValue = m;
    if (gridEl) {
      gridEl.querySelectorAll('.year-map-month').forEach((box) => {
        box.classList.toggle('is-selected', parseInt(box.dataset.month, 10) === m);
      });
    }
  }

  function goToMonthView(m, year) {
    if (typeof currentMonthVertView !== 'undefined') currentMonthVertView = m;
    if (typeof currentYearVertView !== 'undefined') currentYearVertView = year;
    if (typeof currentMonthValue !== 'undefined') currentMonthValue = m;
    if (typeof currentYearValue !== 'undefined') currentYearValue = year;
    if (typeof popUpDate !== 'undefined') popUpDate = null;

    if (typeof showCalVertView === 'function') {
      showCalVertView(m, year);
    } else if (typeof updateCalendarWithTasks === 'function') {
      updateCalendarWithTasks(m, year);
    }

    closeYearMap();
  }

  function updateYearMapFromGoToDate(year, month) {
    if (!containerEl) init();
    if (!containerEl) return;

    const parsedYear = parseInt(year, 10);
    if (!isNaN(parsedYear)) {
      currentYear = parsedYear;
    }
    const parsedMonth = parseInt(month, 10);
    if (!isNaN(parsedMonth)) {
      selectedMonth = parsedMonth;
    }

    // Ensure Year Map container is active and visible
    containerEl.style.display = 'flex';
    window.currentActiveViewName = 'year';

    // Deactivate other views
    const main = document.getElementById('main-container');
    const vert = document.getElementById('calendar-container-vert-view');
    const todo = document.getElementById('todo-container');
    if (main) {
      main.style.display = 'none';
      main.classList.add('view-inactive');
    }
    if (vert) {
      vert.style.display = 'none';
    }
    if (todo) {
      todo.classList.remove('active');
    }

    renderYearMap(currentYear);
  }

  document.addEventListener('DOMContentLoaded', init);

  window.openYearMap = openYearMap;
  window.closeYearMap = closeYearMap;
  window.renderYearMap = renderYearMap;
  window.updateYearMapFromGoToDate = updateYearMapFromGoToDate;
})();
