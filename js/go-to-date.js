// ==========================================================================
// Go to Date Feature Module
// ==========================================================================

(function () {
  'use strict';

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  let modalEl = null;
  let backdropEl = null;
  let monthSelect = null;
  let daySelect = null;
  let yearSelect = null;
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
        closeGoToDateModal();
      }
    });

    return true;
  }

  function isModalOpen() {
    return modalEl && modalEl.classList.contains('active');
  }

  function populateMonths() {
    monthSelect.innerHTML = '';
    MONTH_NAMES.forEach((name, idx) => {
      const opt = document.createElement('option');
      opt.value = idx.toString();
      opt.textContent = name;
      monthSelect.appendChild(opt);
    });
  }

  function populateYears() {
    yearSelect.innerHTML = '';
    for (let y = 2025; y <= 2100; y++) {
      const opt = document.createElement('option');
      opt.value = y.toString();
      opt.textContent = y.toString();
      yearSelect.appendChild(opt);
    }
  }

  function updateDays(selectedMonth, selectedYear, preferredDay) {
    const safeYear = isNaN(selectedYear) ? 2025 : selectedYear;
    const daysInMonth = new Date(safeYear, selectedMonth + 1, 0).getDate();
    const currentVal = preferredDay || parseInt(daySelect.value, 10) || 1;

    daySelect.innerHTML = '';
    for (let d = 1; d <= daysInMonth; d++) {
      const opt = document.createElement('option');
      opt.value = d.toString();
      opt.textContent = d.toString();
      daySelect.appendChild(opt);
    }

    const safeDay = Math.min(Math.max(1, currentVal), daysInMonth);
    daySelect.value = safeDay.toString();
  }

  function onMonthOrYearChange() {
    const m = parseInt(monthSelect.value, 10);
    let y = parseInt(yearSelect.value, 10);
    if (isNaN(y)) y = 2025;
    const currentDay = parseInt(daySelect.value, 10);
    updateDays(m, y, currentDay);
    updatePreview();
  }

  function updatePreview() {
    if (!previewTextEl) return;
    const m = parseInt(monthSelect.value, 10);
    const d = parseInt(daySelect.value, 10);
    let y = parseInt(yearSelect.value, 10);
    if (isNaN(y)) y = 2025;

    if (isNaN(m) || isNaN(d)) return;

    const dateObj = new Date(y, m, d);
    const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const month = dateObj.toLocaleDateString('en-US', { month: 'long' });
    const day = dateObj.getDate();

    previewTextEl.textContent = `${weekday}, ${month} ${day}, ${y}`;
  }

  function setSelectorsToToday() {
    const now = typeof AppTimezone !== 'undefined' ? AppTimezone.now() : new Date();
    const targetY = now.getFullYear();
    const targetM = now.getMonth();
    const targetD = now.getDate();

    yearSelect.value = targetY.toString();
    monthSelect.value = targetM.toString();
    updateDays(targetM, targetY, targetD);
    updatePreview();
  }

  let openedFromPopup = false;

  function openGoToDateModal(targetMonth, targetYear, fromPopup) {
    if (!modalEl && !initElements()) {
      return;
    }

    openedFromPopup = Boolean(fromPopup);

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

    initialYear = Math.max(2025, initialYear);

    // Apply active theme colors
    applyThemeColors();

    // Set selectors
    yearSelect.value = initialYear.toString();
    monthSelect.value = initialMonth.toString();
    updateDays(initialMonth, initialYear, initialDay);
    updatePreview();

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
    const m = parseInt(monthSelect.value, 10);
    const d = parseInt(daySelect.value, 10);
    let y = parseInt(yearSelect.value, 10);

    if (isNaN(m) || isNaN(d)) {
      closeGoToDateModal();
      return;
    }

    if (isNaN(y) || y < 2025) {
      y = 2025;
      yearSelect.value = '2025';
    }

    const targetDateKey = `${y}-${m}-${d}`;

    closeGoToDateModal();

    // Update global month/year state
    if (typeof currentMonthVertView !== 'undefined') currentMonthVertView = m;
    if (typeof currentYearVertView !== 'undefined') currentYearVertView = y;
    if (typeof currentMonthValue !== 'undefined') currentMonthValue = m;
    if (typeof currentYearValue !== 'undefined') currentYearValue = y;

    if (openedFromPopup) {
      // Triggered from daily task popup: keep popup open and navigate it
      if (typeof updateCalendarWithTasks === 'function') {
        updateCalendarWithTasks(m, y);
      }
      if (typeof showDayTasks === 'function') {
        showDayTasks(targetDateKey);
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
