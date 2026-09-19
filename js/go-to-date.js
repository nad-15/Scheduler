// ==========================================================================
// Go to Date Feature Module
// ==========================================================================

(function () {
  'use strict';

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const YEAR_OFFSET_PAST = 50;
  const YEAR_OFFSET_FUTURE = 50;

  let modalEl = null;
  let backdropEl = null;
  let monthSelect = null;
  let daySelect = null;
  let yearSelect = null;
  let monthBtn = null;
  let monthTextEl = null;
  let monthMenuEl = null;
  let dayBtn = null;
  let dayTextEl = null;
  let dayMenuEl = null;
  let yearBtn = null;
  let yearArrowBtn = null;
  let yearInputEl = null;
  let yearTextEl = null;
  let yearMenuEl = null;
  let previewTextEl = null;
  let todayBtn = null;
  let confirmBtn = null;
  let cancelBtn = null;
  let closeBtn = null;

  function initElements() {
    modalEl = document.getElementById('goto-date-modal');
    backdropEl = document.getElementById('goto-date-backdrop');
    monthSelect = document.getElementById('goto-date-month-select');
    daySelect = document.getElementById('goto-date-day-select');
    yearSelect = document.getElementById('goto-date-year-select');

    monthBtn = document.getElementById('goto-date-month-btn');
    monthTextEl = document.getElementById('goto-date-month-text');
    monthMenuEl = document.getElementById('goto-date-month-menu');

    dayBtn = document.getElementById('goto-date-day-btn');
    dayTextEl = document.getElementById('goto-date-day-text');
    dayMenuEl = document.getElementById('goto-date-day-menu');

    yearBtn = document.getElementById('goto-date-year-btn');
    yearArrowBtn = document.getElementById('goto-date-year-arrow-btn');
    yearInputEl = document.getElementById('goto-date-year-input');
    yearTextEl = document.getElementById('goto-date-year-text');
    yearMenuEl = document.getElementById('goto-date-year-menu');

    previewTextEl = document.getElementById('goto-date-preview-text');
    todayBtn = document.getElementById('goto-date-today-btn');
    confirmBtn = document.getElementById('goto-date-confirm-btn');
    cancelBtn = document.getElementById('goto-date-cancel-btn');
    closeBtn = document.getElementById('goto-date-close-btn');

    if (!modalEl || !monthSelect || !daySelect || !yearSelect) {
      return false;
    }

    populateMonths();
    populateYears();

    // Trigger buttons toggle custom dropdown menus
    if (monthBtn) {
      monthBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown('month');
      });
    }

    if (dayBtn) {
      dayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown('day');
      });
    }

    // Clicking the arrow shows the year dropdown selector
    if (yearArrowBtn) {
      yearArrowBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown('year');
      });
    }

    // Clicking the text label makes the year editable
    if (yearBtn) {
      yearBtn.addEventListener('click', (e) => {
        if (e.target.closest('#goto-date-year-arrow-btn')) return;
        e.stopPropagation();
        closeAllDropdowns();
        startYearEdit();
      });
    }

    if (yearInputEl) {
      yearInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finishYearEdit(true);
          onConfirm();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          finishYearEdit(false);
        }
      });
      yearInputEl.addEventListener('blur', () => {
        finishYearEdit(true);
      });
    }

    // Dismiss custom dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (modalEl && modalEl.contains(e.target) && e.target.closest('.goto-date-select-wrapper')) {
        return;
      }
      closeAllDropdowns();
    });

    monthSelect.addEventListener('change', onMonthOrYearChange);
    yearSelect.addEventListener('change', onMonthOrYearChange);
    yearSelect.addEventListener('input', onMonthOrYearChange);
    daySelect.addEventListener('change', updatePreview);

    if (todayBtn) {
      todayBtn.addEventListener('click', setSelectorsToToday);
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', onConfirm);
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeGoToDateModal);
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeGoToDateModal);
    }

    if (backdropEl) {
      backdropEl.addEventListener('click', closeGoToDateModal);
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isModalOpen()) {
        if (hasOpenDropdown()) {
          closeAllDropdowns();
        } else if (yearInputEl && yearInputEl.style.display !== 'none') {
          finishYearEdit(false);
        } else {
          closeGoToDateModal();
        }
      }
    });

    return true;
  }

  function startYearEdit() {
    if (!yearInputEl || !yearBtn) return;
    yearBtn.style.display = 'none';
    yearInputEl.style.display = 'block';
    yearInputEl.value = yearSelect ? yearSelect.value : '2026';
    yearInputEl.focus();
    yearInputEl.select();
  }

  function finishYearEdit(save) {
    if (!yearInputEl || !yearBtn || yearInputEl.style.display === 'none') return;
    if (save) {
      const val = yearInputEl.value.trim();
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && Number.isInteger(parsed)) {
        // Let the browser decide if year is valid
        const testDate = new Date(0);
        testDate.setFullYear(parsed, 0, 1);
        if (!isNaN(testDate.getTime())) {
          let existingOpt = yearSelect.querySelector(`option[value="${parsed}"]`);
          if (!existingOpt) {
            const opt = document.createElement('option');
            opt.value = parsed.toString();
            opt.textContent = parsed.toString();
            const allOpts = Array.from(yearSelect.querySelectorAll('option'));
            const nextOpt = allOpts.find(o => parseInt(o.value, 10) > parsed);
            if (nextOpt) {
              yearSelect.insertBefore(opt, nextOpt);
            } else {
              yearSelect.appendChild(opt);
            }
          }
          yearSelect.value = parsed.toString();
          syncAllDropdownLabels();
          onMonthOrYearChange();
        }
      }
    }
    yearInputEl.style.display = 'none';
    yearBtn.style.display = 'flex';
  }

  function isModalOpen() {
    return modalEl && modalEl.classList.contains('active');
  }

  function hasOpenDropdown() {
    return (
      (monthMenuEl && !monthMenuEl.classList.contains('hidden')) ||
      (dayMenuEl && !dayMenuEl.classList.contains('hidden')) ||
      (yearMenuEl && !yearMenuEl.classList.contains('hidden'))
    );
  }

  function closeAllDropdowns() {
    if (monthMenuEl) monthMenuEl.classList.add('hidden');
    if (dayMenuEl) dayMenuEl.classList.add('hidden');
    if (yearMenuEl) yearMenuEl.classList.add('hidden');

    if (monthBtn) {
      monthBtn.classList.remove('is-open');
      monthBtn.setAttribute('aria-expanded', 'false');
    }
    if (dayBtn) {
      dayBtn.classList.remove('is-open');
      dayBtn.setAttribute('aria-expanded', 'false');
    }
    if (yearBtn) {
      yearBtn.classList.remove('is-open');
      yearBtn.setAttribute('aria-expanded', 'false');
    }
  }

  function toggleDropdown(type) {
    let targetBtn = null;
    let targetMenu = null;

    if (type === 'month') {
      targetBtn = monthBtn;
      targetMenu = monthMenuEl;
    } else if (type === 'day') {
      targetBtn = dayBtn;
      targetMenu = dayMenuEl;
    } else if (type === 'year') {
      targetBtn = yearBtn;
      targetMenu = yearMenuEl;
    }

    if (!targetBtn || !targetMenu) return;

    const isCurrentlyOpen = !targetMenu.classList.contains('hidden');
    closeAllDropdowns();

    if (!isCurrentlyOpen) {
      targetMenu.classList.remove('hidden');
      targetBtn.classList.add('is-open');
      targetBtn.setAttribute('aria-expanded', 'true');

      // Scroll active item smoothly into view
      const activeItem = targetMenu.querySelector('.goto-date-dropdown-item.active');
      if (activeItem) {
        requestAnimationFrame(() => {
          activeItem.scrollIntoView({ block: 'center' });
        });
      }
    }
  }

  function populateMonths() {
    monthSelect.innerHTML = '';
    if (monthMenuEl) monthMenuEl.innerHTML = '';

    MONTH_NAMES.forEach((name, idx) => {
      // Hidden select option
      const opt = document.createElement('option');
      opt.value = idx.toString();
      opt.textContent = name;
      monthSelect.appendChild(opt);

      // Custom dropdown item
      if (monthMenuEl) {
        const itemBtn = document.createElement('button');
        itemBtn.type = 'button';
        itemBtn.className = 'goto-date-dropdown-item';
        itemBtn.dataset.value = idx.toString();
        itemBtn.setAttribute('role', 'option');
        itemBtn.textContent = name;
        itemBtn.title = name;
        itemBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          monthSelect.value = idx.toString();
          syncAllDropdownLabels();
          closeAllDropdowns();
          onMonthOrYearChange();
        });
        monthMenuEl.appendChild(itemBtn);
      }
    });
  }

  function populateYears() {
    yearSelect.innerHTML = '';
    if (yearMenuEl) yearMenuEl.innerHTML = '';

    const now = typeof AppTimezone !== 'undefined' ? AppTimezone.now() : new Date();
    const currentYear = now.getFullYear();
    const startYear = currentYear - YEAR_OFFSET_PAST;
    const endYear = currentYear + YEAR_OFFSET_FUTURE;

    for (let y = startYear; y <= endYear; y++) {
      // Hidden select option
      const opt = document.createElement('option');
      opt.value = y.toString();
      opt.textContent = y.toString();
      yearSelect.appendChild(opt);

      // Custom dropdown item
      if (yearMenuEl) {
        const itemBtn = document.createElement('button');
        itemBtn.type = 'button';
        itemBtn.className = 'goto-date-dropdown-item';
        itemBtn.dataset.value = y.toString();
        itemBtn.setAttribute('role', 'option');
        itemBtn.textContent = y.toString();
        itemBtn.title = y.toString();
        itemBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          yearSelect.value = y.toString();
          syncAllDropdownLabels();
          closeAllDropdowns();
          onMonthOrYearChange();
        });
        yearMenuEl.appendChild(itemBtn);
      }
    }
  }

  function updateDays(selectedMonth, selectedYear, preferredDay) {
    const safeYear = isNaN(selectedYear) ? (typeof currentYearVertView !== 'undefined' ? currentYearVertView : 2026) : selectedYear;
    const d = new Date(0);
    d.setFullYear(safeYear, selectedMonth + 1, 0);
    const daysInMonth = (!isNaN(d.getTime()) && d.getDate() >= 28 && d.getDate() <= 31) ? d.getDate() : 31;
    const currentVal = preferredDay || parseInt(daySelect.value, 10) || 1;

    daySelect.innerHTML = '';
    if (dayMenuEl) dayMenuEl.innerHTML = '';

    for (let d = 1; d <= daysInMonth; d++) {
      // Hidden select option
      const opt = document.createElement('option');
      opt.value = d.toString();
      opt.textContent = d.toString();
      daySelect.appendChild(opt);

      // Custom dropdown item
      if (dayMenuEl) {
        const itemBtn = document.createElement('button');
        itemBtn.type = 'button';
        itemBtn.className = 'goto-date-dropdown-item';
        itemBtn.dataset.value = d.toString();
        itemBtn.setAttribute('role', 'option');
        itemBtn.textContent = d.toString();
        itemBtn.title = d.toString();
        itemBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          daySelect.value = d.toString();
          syncAllDropdownLabels();
          closeAllDropdowns();
          updatePreview();
        });
        dayMenuEl.appendChild(itemBtn);
      }
    }

    const safeDay = Math.min(Math.max(1, currentVal), daysInMonth);
    daySelect.value = safeDay.toString();
    syncAllDropdownLabels();
  }

  function syncAllDropdownLabels() {
    const m = parseInt(monthSelect.value, 10);
    const y = parseInt(yearSelect.value, 10);
    const d = parseInt(daySelect.value, 10);

    // Month label & active state
    if (monthTextEl && !isNaN(m) && MONTH_NAMES[m]) {
      monthTextEl.textContent = MONTH_NAMES[m];
      monthTextEl.title = MONTH_NAMES[m];
      if (monthBtn) monthBtn.title = MONTH_NAMES[m];
    }
    if (monthMenuEl) {
      monthMenuEl.querySelectorAll('.goto-date-dropdown-item').forEach((item) => {
        item.classList.toggle('active', item.dataset.value === monthSelect.value);
      });
    }

    // Day label & active state
    if (dayTextEl && !isNaN(d)) {
      dayTextEl.textContent = d.toString();
      dayTextEl.title = d.toString();
      if (dayBtn) dayBtn.title = `Day ${d}`;
    }
    if (dayMenuEl) {
      dayMenuEl.querySelectorAll('.goto-date-dropdown-item').forEach((item) => {
        item.classList.toggle('active', item.dataset.value === daySelect.value);
      });
    }

    // Year label & active state
    if (yearTextEl && !isNaN(y)) {
      yearTextEl.textContent = y.toString();
      yearTextEl.title = y.toString();
      if (yearBtn) yearBtn.title = `Year ${y} (click to edit)`;
    }
    if (yearMenuEl) {
      let matchingItem = yearMenuEl.querySelector(`.goto-date-dropdown-item[data-value="${y}"]`);
      if (!matchingItem && !isNaN(y)) {
        matchingItem = document.createElement('button');
        matchingItem.type = 'button';
        matchingItem.className = 'goto-date-dropdown-item';
        matchingItem.dataset.value = y.toString();
        matchingItem.setAttribute('role', 'option');
        matchingItem.textContent = y.toString();
        matchingItem.title = y.toString();
        matchingItem.addEventListener('click', (e) => {
          e.stopPropagation();
          let opt = yearSelect.querySelector(`option[value="${y}"]`);
          if (!opt) {
            opt = document.createElement('option');
            opt.value = y.toString();
            opt.textContent = y.toString();
            const allOpts = Array.from(yearSelect.querySelectorAll('option'));
            const nextOpt = allOpts.find(o => parseInt(o.value, 10) > y);
            if (nextOpt) {
              yearSelect.insertBefore(opt, nextOpt);
            } else {
              yearSelect.appendChild(opt);
            }
          }
          yearSelect.value = y.toString();
          syncAllDropdownLabels();
          closeAllDropdowns();
          onMonthOrYearChange();
        });

        // Insert in sorted order among elements with data-value
        const items = Array.from(yearMenuEl.querySelectorAll('.goto-date-dropdown-item[data-value]'));
        const nextItem = items.find(item => parseInt(item.dataset.value, 10) > y);
        if (nextItem) {
          yearMenuEl.insertBefore(matchingItem, nextItem);
        } else {
          yearMenuEl.appendChild(matchingItem);
        }
      }
      yearMenuEl.querySelectorAll('.goto-date-dropdown-item[data-value]').forEach((item) => {
        item.classList.toggle('active', item.dataset.value === yearSelect.value);
      });
    }
  }

  function onMonthOrYearChange() {
    const m = parseInt(monthSelect.value, 10);
    let y = parseInt(yearSelect.value, 10);
    if (isNaN(y)) y = typeof currentYearVertView !== 'undefined' ? currentYearVertView : 2026;
    const currentDay = parseInt(daySelect.value, 10);
    updateDays(m, y, currentDay);
    updatePreview();
  }

  function updatePreview() {
    if (!previewTextEl) return;
    const m = parseInt(monthSelect.value, 10);
    const d = parseInt(daySelect.value, 10);
    let y = parseInt(yearSelect.value, 10);
    if (isNaN(y)) y = typeof currentYearVertView !== 'undefined' ? currentYearVertView : 2026;

    if (isNaN(m) || isNaN(d)) return;

    try {
      const dateObj = new Date(0);
      dateObj.setFullYear(y, m, d);
      if (isNaN(dateObj.getTime())) {
        previewTextEl.textContent = 'Invalid Date';
        return;
      }
      const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
      const month = dateObj.toLocaleDateString('en-US', { month: 'long' });
      const day = dateObj.getDate();

      previewTextEl.textContent = `${weekday}, ${month} ${day}, ${y}`;
    } catch (e) {
      previewTextEl.textContent = 'Invalid Date';
    }
  }

  function setSelectorsToToday() {
    const now = typeof AppTimezone !== 'undefined' ? AppTimezone.now() : new Date();
    const targetY = now.getFullYear();
    const targetM = now.getMonth();
    const targetD = now.getDate();

    yearSelect.value = targetY.toString();
    monthSelect.value = targetM.toString();
    updateDays(targetM, targetY, targetD);
    syncAllDropdownLabels();
    updatePreview();
  }

  let openedFromPopup = false;
  let openedFromYearMap = false;

  function openGoToDateModal(targetMonth, targetYear, fromPopup, fromYearMap) {
    if (!modalEl && !initElements()) {
      return;
    }

    openedFromPopup = Boolean(fromPopup);
    const yearMapContainer = document.getElementById('year-map-container');
    const isYearMapCurrentlyOpen = (typeof window.currentActiveViewName !== 'undefined' && window.currentActiveViewName === 'year') ||
      (yearMapContainer && getComputedStyle(yearMapContainer).display !== 'none');
    openedFromYearMap = Boolean(fromYearMap) || Boolean(isYearMapCurrentlyOpen);

    const now = typeof AppTimezone !== 'undefined' ? AppTimezone.now() : new Date();
    let initialYear = now.getFullYear();
    let initialMonth = now.getMonth();
    let initialDay = now.getDate();

    if (typeof targetMonth === 'number' && typeof targetYear === 'number') {
      initialMonth = targetMonth;
      initialYear = targetYear;
      if (initialMonth === now.getMonth() && initialYear === now.getFullYear()) {
        initialDay = now.getDate();
      } else {
        initialDay = 1;
      }
    } else {
      // Context check: If daily popup is open, use its date
      const popupEl = document.getElementById('calendar-pop-up');
      const isPopupOpen = popupEl && getComputedStyle(popupEl).display !== 'none';

      if (isPopupOpen && typeof popUpDate === 'string' && popUpDate) {
        const parts = popUpDate.split('-').map(Number);
        if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
          initialYear = parts[0];
          initialMonth = parts[1];
          initialDay = parts[2];
        }
      } else if (typeof currentMonthVertView !== 'undefined' && typeof currentYearVertView !== 'undefined') {
        initialMonth = currentMonthVertView;
        initialYear = currentYearVertView;
        if (initialMonth === now.getMonth() && initialYear === now.getFullYear()) {
          initialDay = now.getDate();
        } else {
          initialDay = 1;
        }
      }
    }

    if (isNaN(initialYear)) {
      initialYear = now.getFullYear();
    }

    // Apply active theme colors
    applyThemeColors();

    // Ensure yearSelect has an option for initialYear
    let existingOpt = yearSelect.querySelector(`option[value="${initialYear}"]`);
    if (!existingOpt && !isNaN(initialYear)) {
      const opt = document.createElement('option');
      opt.value = initialYear.toString();
      opt.textContent = initialYear.toString();
      const allOpts = Array.from(yearSelect.querySelectorAll('option'));
      const nextOpt = allOpts.find(o => parseInt(o.value, 10) > initialYear);
      if (nextOpt) {
        yearSelect.insertBefore(opt, nextOpt);
      } else {
        yearSelect.appendChild(opt);
      }
    }

    // Set selectors
    yearSelect.value = initialYear.toString();
    monthSelect.value = initialMonth.toString();
    updateDays(initialMonth, initialYear, initialDay);
    syncAllDropdownLabels();
    updatePreview();

    // Close any open custom dropdown menus and reset year input
    closeAllDropdowns();
    finishYearEdit(false);

    // Show modal & backdrop
    if (backdropEl) {
      backdropEl.style.display = 'block';
      // Force reflow
      void backdropEl.offsetWidth;
      backdropEl.classList.add('active');
    }

    modalEl.style.display = 'flex';
    void modalEl.offsetWidth;
    modalEl.classList.add('active');
  }

  function applyThemeColors() {
    if (!modalEl) return;
    const themeKey = localStorage.getItem('theme') || 'default';
    let evenColor = '#2196f3';
    if (typeof colorThemes !== 'undefined' && colorThemes && colorThemes[themeKey] && colorThemes[themeKey].even) {
      evenColor = colorThemes[themeKey].even;
    }
    modalEl.style.setProperty('--goto-theme-color', evenColor);

    if (evenColor.startsWith('#') && (evenColor.length === 7 || evenColor.length === 4)) {
      let r, g, b;
      if (evenColor.length === 7) {
        r = parseInt(evenColor.substr(1, 2), 16) || 0;
        g = parseInt(evenColor.substr(3, 2), 16) || 0;
        b = parseInt(evenColor.substr(5, 2), 16) || 0;
      } else {
        r = parseInt(evenColor[1] + evenColor[1], 16) || 0;
        g = parseInt(evenColor[2] + evenColor[2], 16) || 0;
        b = parseInt(evenColor[3] + evenColor[3], 16) || 0;
      }
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      modalEl.style.setProperty('--goto-theme-text-color', brightness > 165 ? '#1a1a1a' : '#ffffff');
    }
  }

  function closeGoToDateModal() {
    closeAllDropdowns();
    finishYearEdit(false);
    openedFromPopup = false;
    openedFromYearMap = false;

    if (backdropEl) {
      backdropEl.classList.remove('active');
      setTimeout(() => {
        if (!backdropEl.classList.contains('active')) {
          backdropEl.style.display = 'none';
        }
      }, 200);
    }

    if (modalEl) {
      modalEl.classList.remove('active');
      setTimeout(() => {
        if (!modalEl.classList.contains('active')) {
          modalEl.style.display = 'none';
        }
      }, 200);
    }
  }

  function onConfirm() {
    if (yearInputEl && yearInputEl.style.display !== 'none') {
      finishYearEdit(true);
    }

    const m = parseInt(monthSelect.value, 10);
    const d = parseInt(daySelect.value, 10);
    let y = parseInt(yearSelect.value, 10);

    if (isNaN(m) || isNaN(d) || isNaN(y)) {
      closeGoToDateModal();
      return;
    }

    // Let the browser decide if it's a valid date
    const testDate = new Date(0);
    testDate.setFullYear(y, m, d);
    if (isNaN(testDate.getTime())) {
      if (previewTextEl) {
        previewTextEl.textContent = 'Invalid Date';
      }
      return;
    }

    const targetDateKey = `${y}-${m}-${d}`;

    const fromPopup = openedFromPopup;
    const yearMapContainer = document.getElementById('year-map-container');
    const isFromYearMap = openedFromYearMap ||
      (typeof window.currentActiveViewName !== 'undefined' && window.currentActiveViewName === 'year') ||
      (yearMapContainer && getComputedStyle(yearMapContainer).display !== 'none');

    closeGoToDateModal();

    // Update global month/year state
    if (typeof currentMonthVertView !== 'undefined') currentMonthVertView = m;
    if (typeof currentYearVertView !== 'undefined') currentYearVertView = y;
    if (typeof currentMonthValue !== 'undefined') currentMonthValue = m;
    if (typeof currentYearValue !== 'undefined') currentYearValue = y;
    if (typeof popUpDate !== 'undefined') popUpDate = targetDateKey;

    if (fromPopup) {
      // Triggered from daily task popup: keep popup open and navigate it
      if (typeof updateCalendarWithTasks === 'function') {
        updateCalendarWithTasks(m, y);
      }
      if (typeof showDayTasks === 'function') {
        showDayTasks(targetDateKey);
      }
    } else if (isFromYearMap) {
      // Triggered from Year Map: keep Year Map open and re-render with new year & month
      if (typeof window.updateYearMapFromGoToDate === 'function') {
        window.updateYearMapFromGoToDate(y, m);
      }
      if (typeof updateCalendarWithTasks === 'function') {
        updateCalendarWithTasks(m, y);
      }
    } else {
      // Triggered from arrow (Month View or List View):
      // DO NOT show daily task popup. Navigate and highlight the date.
      const main = document.getElementById('main-container');
      const isListView = main && getComputedStyle(main).display === 'block';

      if (isListView) {
        // In List View: render the month/year if needed and scroll with blue flash
        if (typeof showCalHorView === 'function') {
          showCalHorView(m, y);
        }
        setTimeout(() => {
          if (typeof currentDayScroll === 'function') {
            currentDayScroll(targetDateKey);
          }
        }, 80);
      } else {
        // In Month View: update grid and highlight date cell with blue outline
        if (typeof updateCalendarWithTasks === 'function') {
          updateCalendarWithTasks(m, y);
        }
        setTimeout(() => {
          document.querySelectorAll('.grid-cell').forEach(c => c.classList.remove('is-active'));
          const activeCell = document.querySelector(`.grid-cell[data-full-date="${targetDateKey}"]`);
          if (activeCell) {
            activeCell.classList.add('is-active');
          }
        }, 80);
      }
    }
  }

  // Bind trigger buttons once DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    initElements();

    // Month view header date picker trigger
    const monthViewPickerBtn = document.getElementById('month-view-date-picker-btn');
    if (monthViewPickerBtn) {
      monthViewPickerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const m = (typeof currentMonthVertView !== 'undefined') ? currentMonthVertView : null;
        const y = (typeof currentYearVertView !== 'undefined') ? currentYearVertView : null;
        openGoToDateModal(m, y, false);
      });
    }

    // Day popup Go to button
    const popupGoToBtn = document.getElementById('go-to-date-popup-btn');
    if (popupGoToBtn) {
      popupGoToBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openGoToDateModal(null, null, true);
      });
    }
  });

  // Expose global methods for cal-month-view and other scripts
  window.openGoToDateModal = openGoToDateModal;
  window.closeGoToDateModal = closeGoToDateModal;
})();
