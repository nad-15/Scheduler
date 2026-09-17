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
  let titleInputEl = null;
  let arrowWrapperEl = null;
  let arrowBtn = null;
  let dropdownMenuEl = null;
  let yearSelectEl = null;
  let modeBtn = null;
  let modeLabelEl = null;
  let gotoMonthBtn = null;
  let gotoListBtn = null;
  let triggerBtn = null;

  let currentYear = 2026;
  let currentMode = 'stripes'; // 'stripes' | 'heatmap'

  function populateYearSelect() {
    if (yearSelectEl) {
      yearSelectEl.innerHTML = '';
      const firstOpt = document.createElement('option');
      firstOpt.value = 'type-here';
      firstOpt.textContent = 'Type year...';
      yearSelectEl.appendChild(firstOpt);

      for (let y = 2025; y <= 2100; y++) {
        const opt = document.createElement('option');
        opt.value = y.toString();
        opt.textContent = y.toString();
        yearSelectEl.appendChild(opt);
      }
    }

    if (dropdownMenuEl) {
      dropdownMenuEl.innerHTML = '';

      // "Type year..." option
      const typeBtn = document.createElement('button');
      typeBtn.type = 'button';
      typeBtn.className = 'year-map-dropdown-item';
      typeBtn.setAttribute('role', 'option');
      typeBtn.textContent = 'Type year...';
      typeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeYearDropdown();
        startYearEdit();
      });
      dropdownMenuEl.appendChild(typeBtn);

      // Years 2025 to 2100
      for (let y = 2025; y <= 2100; y++) {
        const itemBtn = document.createElement('button');
        itemBtn.type = 'button';
        itemBtn.className = 'year-map-dropdown-item';
        itemBtn.dataset.year = y.toString();
        itemBtn.setAttribute('role', 'option');
        itemBtn.textContent = y.toString();
        itemBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          closeYearDropdown();
          currentYear = y;
          renderYearMap(currentYear);
        });
        dropdownMenuEl.appendChild(itemBtn);
      }
    }
  }

  function syncYearSelect(year) {
    const yVal = year || currentYear;
    const yStr = yVal.toString();
    if (yearSelectEl) {
      let existingOpt = yearSelectEl.querySelector(`option[value="${yStr}"]`);
      if (!existingOpt) {
        existingOpt = document.createElement('option');
        existingOpt.value = yStr;
        existingOpt.textContent = yStr;
        yearSelectEl.appendChild(existingOpt);
      }
      yearSelectEl.value = yStr;
    }

    if (dropdownMenuEl) {
      dropdownMenuEl.querySelectorAll('.year-map-dropdown-item[data-year]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.year === yStr);
      });
    }
  }

  function closeYearDropdown() {
    if (dropdownMenuEl) dropdownMenuEl.classList.add('hidden');
    if (arrowBtn) {
      arrowBtn.classList.remove('is-open');
      arrowBtn.setAttribute('aria-expanded', 'false');
    }
  }

  function toggleYearDropdown() {
    if (!dropdownMenuEl) return;
    const isCurrentlyOpen = !dropdownMenuEl.classList.contains('hidden');
    if (isCurrentlyOpen) {
      closeYearDropdown();
    } else {
      dropdownMenuEl.classList.remove('hidden');
      if (arrowBtn) {
        arrowBtn.classList.add('is-open');
        arrowBtn.setAttribute('aria-expanded', 'true');
      }
      syncYearSelect(currentYear);
      const activeItem = dropdownMenuEl.querySelector('.year-map-dropdown-item.active');
      if (activeItem) {
        requestAnimationFrame(() => {
          activeItem.scrollIntoView({ block: 'nearest' });
        });
      }
    }
  }

  function init() {
    containerEl = document.getElementById('year-map-container');
    gridEl = document.getElementById('year-map-grid');
    titleEl = document.getElementById('year-map-title');
    titleInputEl = document.getElementById('year-map-title-input');
    arrowWrapperEl = document.getElementById('year-map-arrow-wrapper');
    arrowBtn = document.getElementById('year-map-arrow-btn');
    dropdownMenuEl = document.getElementById('year-map-dropdown-menu');
    yearSelectEl = document.getElementById('year-map-select');
    modeBtn = document.getElementById('year-map-mode-btn');
    modeLabelEl = document.getElementById('year-map-mode-label');
    gotoMonthBtn = document.getElementById('year-map-goto-month-btn');
    gotoListBtn = document.getElementById('year-map-goto-list-btn');
    triggerBtn = document.getElementById('month-view-year-map-btn');

    if (!containerEl || !gridEl) return;

    populateYearSelect();

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
        if (typeof hidePopup === 'function') {
          hidePopup();
        } else {
          const closeBtn = document.getElementById('closePopupBtn');
          if (closeBtn) closeBtn.click();
        }
        openYearMap();
      });
    }

    if (titleEl) {
      titleEl.addEventListener('click', (e) => {
        e.stopPropagation();
        startYearEdit();
      });
    }

    if (arrowBtn) {
      arrowBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleYearDropdown();
      });
    }

    // Dismiss year dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (arrowWrapperEl && arrowWrapperEl.contains(e.target)) return;
      closeYearDropdown();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dropdownMenuEl && !dropdownMenuEl.classList.contains('hidden')) {
        closeYearDropdown();
      }
    });

    if (yearSelectEl) {
      yearSelectEl.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'type-here') {
          syncYearSelect();
          startYearEdit();
        } else {
          const parsed = parseInt(val, 10);
          if (!isNaN(parsed) && parsed >= 2025) {
            currentYear = parsed;
            renderYearMap(currentYear);
          }
        }
      });
    }

    if (titleInputEl) {
      titleInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finishYearEdit(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          finishYearEdit(false);
        }
      });

      titleInputEl.addEventListener('blur', () => {
        finishYearEdit(true);
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
            // Swipe right -> Previous year (constrained to min 2025)
            if (currentYear > 2025) {
              currentYear--;
              renderYearMap(currentYear);
            }
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
        const m = typeof currentMonthVertView !== 'undefined' ? currentMonthVertView : 0;
        goToMonthView(m, currentYear);
      });
    }

    if (gotoListBtn) {
      gotoListBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const m = typeof currentMonthVertView !== 'undefined' ? currentMonthVertView : 0;
        if (typeof currentMonthVertView !== 'undefined') currentMonthVertView = m;
        if (typeof currentYearVertView !== 'undefined') currentYearVertView = currentYear;
        if (typeof currentMonthValue !== 'undefined') currentMonthValue = m;
        if (typeof currentYearValue !== 'undefined') currentYearValue = currentYear;

        closeYearMap();

        if (typeof showCalHorView === 'function') {
          showCalHorView(m, currentYear);
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isYearMapOpen()) {
        const returnView = window.previousViewBeforeYear || 'month';
        closeYearMap();
        if (returnView === 'list' && typeof showCalHorView === 'function') {
          showCalHorView(currentMonthVertView || 0, currentYear);
        } else if (typeof showCalVertView === 'function') {
          showCalVertView(currentMonthVertView || 0, currentYear);
        }
      }
    });
  }

  function startYearEdit() {
    if (!titleInputEl || !titleEl) return;
    titleInputEl.value = currentYear.toString();
    titleEl.style.display = 'none';
    if (arrowWrapperEl) arrowWrapperEl.style.display = 'none';
    titleInputEl.style.display = 'inline-block';
    titleInputEl.focus();
    titleInputEl.select();
  }

  function finishYearEdit(commit) {
    if (!titleInputEl || !titleEl) return;
    if (titleInputEl.style.display === 'none') return;

    if (commit) {
      const rawVal = titleInputEl.value.trim();
      const parsed = parseInt(rawVal, 10);
      // Valid year constraint: number >= 2025 and <= 9999
      if (!isNaN(parsed) && parsed >= 2025 && parsed <= 9999 && String(parsed) === rawVal) {
        currentYear = parsed;
        renderYearMap(currentYear);
      } else {
        // Invalid input: catch error, do nothing and revert back to currentYear
        titleEl.textContent = currentYear.toString();
        syncYearSelect();
      }
    } else {
      titleEl.textContent = currentYear.toString();
      syncYearSelect();
    }

    titleInputEl.style.display = 'none';
    titleEl.style.display = '';
    if (arrowWrapperEl) arrowWrapperEl.style.display = '';
  }

  function isYearMapOpen() {
    return containerEl && containerEl.style.display !== 'none';
  }

  function openYearMap(targetYearParam) {
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
    if (typeof targetYearParam === 'number' && targetYearParam >= 2025) {
      targetYear = targetYearParam;
    } else if (typeof popUpDate === 'string' && popUpDate) {
      const pY = parseInt(popUpDate.split('-')[0], 10);
      if (!isNaN(pY) && pY >= 2025) {
        targetYear = pY;
      }
    }

    if (!targetYear) {
      const now = typeof AppTimezone !== 'undefined' ? AppTimezone.now() : new Date();
      targetYear = typeof currentYearVertView !== 'undefined' ? currentYearVertView : now.getFullYear();
    }

    currentYear = targetYear;

    containerEl.style.display = 'flex';
    updateModeButtonLabel();
    renderYearMap(currentYear);
  }

  function closeYearMap() {
    closeYearDropdown();
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
      } else {
        modeBtn.classList.remove('active');
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
    const dayData = storedTasks[dateKey];
    if (!dayData) return [];

    const tasksList = [];
    const periods = ['morning', 'afternoon', 'evening'];

    periods.forEach(period => {
      const periodTasks = dayData[period];
      if (Array.isArray(periodTasks)) {
        periodTasks.forEach(item => {
          if (item) {
            const color = item.color && item.color.trim() !== '' ? item.color : '#6a5044';
            tasksList.push({
              task: item.task || '',
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

    titleEl.textContent = year.toString();
    syncYearSelect(year);
    gridEl.innerHTML = '';

    const storedTasks = getStoredTasks();
    const now = typeof AppTimezone !== 'undefined' ? AppTimezone.now() : new Date();
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

    for (let m = 0; m < 12; m++) {
      const monthBox = document.createElement('div');
      monthBox.className = 'year-map-month';
      monthBox.dataset.month = m.toString();

      // Month Title (Clicking it zooms Month View directly to that month)
      const monthHeader = document.createElement('div');
      monthHeader.className = 'year-map-month-header';
      monthHeader.textContent = MONTH_NAMES_SHORT[m];
      monthHeader.title = `Open ${MONTH_NAMES_SHORT[m]} ${year} in Month View`;
      monthHeader.addEventListener('click', (e) => {
        e.stopPropagation();
        goToMonthView(m, year);
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

      const firstDayOfWeek = new Date(year, m, 1).getDay();
      const totalDays = new Date(year, m + 1, 0).getDate();

      // Empty offset cells before day 1
      for (let empty = 0; empty < firstDayOfWeek; empty++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'year-map-day year-map-day-empty';
        daysGrid.appendChild(emptyCell);
      }

      // Day cells
      for (let d = 1; d <= totalDays; d++) {
        const dateKey = `${year}-${m}-${d}`;
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
              stripe.style.backgroundColor = taskItem.color;
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

          dayCell.title = `${MONTH_NAMES_SHORT[m]} ${d}, ${year}: ${tasksList.length} task${tasksList.length > 1 ? 's' : ''}`;
        } else {
          dayCell.title = `${MONTH_NAMES_SHORT[m]} ${d}, ${year}`;
        }

        const dayNumberSpan = document.createElement('span');
        dayNumberSpan.className = 'year-map-day-number';
        dayNumberSpan.textContent = d.toString();
        dayCell.appendChild(dayNumberSpan);

        // Click to open that day's task popup
        dayCell.addEventListener('click', (e) => {
          e.stopPropagation();
          onDayClick(m, year, d, dateKey);
        });

        daysGrid.appendChild(dayCell);
      }

      monthBox.appendChild(daysGrid);
      gridEl.appendChild(monthBox);
    }
  }

  function onDayClick(m, year, d, dateKey) {
    // Sync Month View state
    if (typeof currentMonthVertView !== 'undefined') currentMonthVertView = m;
    if (typeof currentYearVertView !== 'undefined') currentYearVertView = year;
    if (typeof currentMonthValue !== 'undefined') currentMonthValue = m;
    if (typeof currentYearValue !== 'undefined') currentYearValue = year;

    if (typeof updateCalendarWithTasks === 'function') {
      updateCalendarWithTasks(m, year);
    }

    // Open daily task popup
    if (typeof showDayTasks === 'function') {
      showDayTasks(dateKey);
    }
  }

  function goToMonthView(m, year) {
    if (typeof currentMonthVertView !== 'undefined') currentMonthVertView = m;
    if (typeof currentYearVertView !== 'undefined') currentYearVertView = year;
    if (typeof currentMonthValue !== 'undefined') currentMonthValue = m;
    if (typeof currentYearValue !== 'undefined') currentYearValue = year;

    if (typeof showCalVertView === 'function') {
      showCalVertView(m, year);
    } else if (typeof updateCalendarWithTasks === 'function') {
      updateCalendarWithTasks(m, year);
    }

    closeYearMap();
  }

  document.addEventListener('DOMContentLoaded', init);

  window.openYearMap = openYearMap;
  window.closeYearMap = closeYearMap;
  window.renderYearMap = renderYearMap;
})();
