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

  function openGoToDateModal() {
    if (!modalEl && !initElements()) {
      return;
    }

    const now = typeof AppTimezone !== 'undefined' ? AppTimezone.now() : new Date();
    let initialYear = now.getFullYear();
    let initialMonth = now.getMonth();
    let initialDay = now.getDate();

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

    initialYear = Math.max(2025, initialYear);

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

    // Update month view variables & calendar grid
    if (typeof currentMonthVertView !== 'undefined') currentMonthVertView = m;
    if (typeof currentYearVertView !== 'undefined') currentYearVertView = y;
    if (typeof currentMonthValue !== 'undefined') currentMonthValue = m;
    if (typeof currentYearValue !== 'undefined') currentYearValue = y;

    if (typeof updateCalendarWithTasks === 'function') {
      updateCalendarWithTasks(m, y);
    }

    // Open daily tasks popup for the selected date
    if (typeof showDayTasks === 'function') {
      showDayTasks(targetDateKey);
    }

    // Highlight active cell in month view grid if present
    const activeCell = document.querySelector(`.grid-cell[data-full-date="${targetDateKey}"]`);
    if (activeCell) {
      document.querySelectorAll('.grid-cell').forEach(c => c.classList.remove('is-active'));
      activeCell.classList.add('is-active');
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
        openGoToDateModal();
      });
    }

    // Day popup Go to button
    const popupGoToBtn = document.getElementById('go-to-date-popup-btn');
    if (popupGoToBtn) {
      popupGoToBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openGoToDateModal();
      });
    }
  });

  // Expose global methods for cal-month-view and other scripts
  window.openGoToDateModal = openGoToDateModal;
  window.closeGoToDateModal = closeGoToDateModal;
})();
