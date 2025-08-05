// === SETUP DOM ELEMENTS ===
const calendarContainerVertView = document.getElementById("calendar-container-vert-view");
// const showCalendarBtnVertView = document.getElementById("show-vert-calendar-btn");
const daysGridVertView = document.getElementById("days-grid-vert-view");
const monthLabelVertView = document.getElementById("month-label-vert-view");
const calIconVertView = document.getElementById("icon-month-label-vert-view");
const prevMonthBtnVertView = document.getElementById("prev-month-vert-view");
const nextMonthBtnVertView = document.getElementById("next-month-vert-view");

const yearContainer = document.getElementById('year-container');
let swipeEnabledPopUp = true;

let popupTimeout;
let lastClickedCell = null;


// === TIME VARIABLES ===
let currentMonthContainer = null;
let nextMonthContainer = null;
let prevMonthContainer = null;


let todayVertView = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }));
let currentMonthVertView = todayVertView.getMonth();
let currentYearVertView = todayVertView.getFullYear();

let currentMonthValue = currentMonthVertView;
let currentYearValue = currentYearVertView;


let popUpDate = `${todayVertView.getFullYear()}-${todayVertView.getMonth()}-${todayVertView.getDate()}`;
console.log("POPUPDATE IS:", popUpDate);


let touchStartX = 0;
let touchStartY = 0;

calendarContainerVertView.addEventListener("touchstart", (e) => {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
});

calendarContainerVertView.addEventListener("touchend", (e) => {
  const touchEndX = e.changedTouches[0].screenX;
  const touchEndY = e.changedTouches[0].screenY;
  handleMobileSwipe(touchStartX, touchEndX, touchStartY, touchEndY);
});

function handleMobileSwipe(startX, endX, startY, endY) {
  const dx = endX - startX;
  const dy = endY - startY;

  const minSwipeDistance = 50;
  if (Math.abs(dx) < minSwipeDistance) return; // too short

  const slope = Math.abs(dy / dx);
  const maxAllowedSlope = Math.tan(30 * Math.PI / 180); // ~0.7

  if (slope > maxAllowedSlope) return; // too vertical

  if (dx < 0) {
    // Swipe left → next month
    currentMonthVertView++;
    if (currentMonthVertView > 11) {
      currentMonthVertView = 0;
      currentYearVertView++;
    }
  } else {
    // Swipe right → previous month
    currentMonthVertView--;
    if (currentMonthVertView < 0) {
      currentMonthVertView = 11;
      currentYearVertView--;
    }
  }

  updateCalendarWithTasks(currentMonthVertView, currentYearVertView);
}




// === RESIZE THE CALENDAR VIEW MINUS THE ADDRESS BAR ===
function adjustCalendarHeight() {
  calendarContainerVertView.style.height = `${window.innerHeight}px`;

  // Adjust popup max-height as well
  const popup = document.getElementById("calendar-pop-up");
  if (popup) {
    popup.style.maxHeight = `${window.innerHeight * 0.8}px`;
    popup.style.height = `${window.innerHeight * 0.8}px`;
  }
}


// Call initially and on resize
adjustCalendarHeight();
window.addEventListener('resize', adjustCalendarHeight);



// === LOAD TASKS ===
function loadTasksFromLocalStorage() {
  const tasks = JSON.parse(localStorage.getItem('tasks'));
  return tasks || {};
}

function createCalendarGrid() {
  daysGridVertView.innerHTML = "";

  for (let i = 0; i < 42; i++) {
    const dayCell = document.createElement("div");
    dayCell.classList.add("day-vert-view");
    // dayCell.addEventListener(`click`, showDayTasks);

    const dayNumber = document.createElement("div");
    dayNumber.classList.add("day-number");

    const taskContainer = document.createElement("div");
    taskContainer.classList.add("task-container-vert-view");

    dayCell.appendChild(dayNumber);
    dayCell.appendChild(taskContainer);
    daysGridVertView.appendChild(dayCell);
  }



  // === SET MAX HEIGHT for each task container after DOM elements are in place
  const allDayCells = daysGridVertView.querySelectorAll(".day-vert-view");
  allDayCells.forEach(cell => {
    const dayNumber = cell.querySelector(".day-number");
    const taskContainer = cell.querySelector(".task-container-vert-view");

    const cellHeight = cell.clientHeight;
    const dayNumberHeight = dayNumber.offsetHeight;

    const marginTop = 4; // matches CSS: margin-top: 4px
    const availableHeight = cellHeight - dayNumberHeight - marginTop;

    taskContainer.style.maxHeight = `${availableHeight}px`;
  });
}

function updateCalendarWithTasks(month, year) {


  document.querySelectorAll(".grid-cell").forEach(cell => {
    cell.classList.remove("is-active");
  });

  const tasks = loadTasksFromLocalStorage();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const totalDaysLastMonth = new Date(year, month, 0).getDate();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  monthLabelVertView.textContent = `${monthNames[month]} ${year}`;

  const dayCells = daysGridVertView.children;



  for (let i = 0; i < 42; i++) {
    const cell = dayCells[i];
    const dayNumber = cell.querySelector(".day-number");
    const taskContainer = cell.querySelector(".task-container-vert-view");

    cell.classList.remove("adjacent-month-vert-view", "today-vert-view");
    taskContainer.innerHTML = "";

    let currentDay, dateKey;

    cell.classList.add("grid-cell");

    // === PREVIOUS MONTH ===
    if (i < firstDayOfMonth) {
      currentDay = totalDaysLastMonth - firstDayOfMonth + 1 + i;
      dayNumber.textContent = currentDay;
      cell.classList.add("adjacent-month-vert-view");

      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      dateKey = `${prevYear}-${prevMonth}-${currentDay}`;
      cell.setAttribute("data-full-date", dateKey);

    }

    // === CURRENT MONTH ===
    else if (i < firstDayOfMonth + totalDaysInMonth) {
      currentDay = i - firstDayOfMonth + 1;
      dayNumber.textContent = currentDay;
      dateKey = `${year}-${month}-${currentDay}`;
      cell.setAttribute("data-full-date", dateKey);


      // Restore the "today" highlight
      const todayVertView = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }));

      if (
        currentDay === todayVertView.getDate() &&
        month === todayVertView.getMonth() &&
        year === todayVertView.getFullYear()
      ) {
        cell.classList.add("today-vert-view");

      }
    }

    // === NEXT MONTH ===
    else {
      currentDay = i - (firstDayOfMonth + totalDaysInMonth) + 1;
      dayNumber.textContent = currentDay;
      cell.classList.add("adjacent-month-vert-view");

      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      dateKey = `${nextYear}-${nextMonth}-${currentDay}`;
      cell.setAttribute("data-full-date", dateKey);

    }

    // === TASK INJECTION (for all dates) ===
    const dayTasks = tasks[dateKey];
    if (dayTasks) {
      ['morning', 'afternoon', 'evening'].forEach(period => {
        if (Array.isArray(dayTasks[period])) {
          dayTasks[period].forEach(task => {
            if (task.color) {
              const taskDiv = document.createElement("div");
              taskDiv.classList.add(`task-${period}`);
              taskDiv.style.borderLeft = `3px solid ${task.color}`;
              taskDiv.style.backgroundColor = fadeColor(task.color);
              taskDiv.textContent = task.task || "";
              taskContainer.appendChild(taskDiv);
            }
          });
        }
      });
    }
    //here
    // cell.addEventListener("click", () => {
    //   const fullDate = cell.getAttribute("data-full-date");
    //   showDayTasks(fullDate);
    // });
    cell.addEventListener('click', () => {

      document.querySelectorAll(".grid-cell").forEach(cell => {
        cell.classList.remove("is-active");
      });

      // cell.classList.add("is-active");


      clearTimeout(popupTimeout); // Cancel previous popup trigger
      lastClickedCell = cell;

      popupTimeout = setTimeout(() => {
        if (lastClickedCell === cell) {
          const fullDate = cell.getAttribute("data-full-date");
          showDayTasks(fullDate); // Only show if this is still the last clicked
        }
      }, 60);
    });
  }
}



// === REMOVE THIS HELPER FUNCTION ONCE PUT IN SHCEDULER ===
function fadeColor(color, alpha = 0.6) {
  // If color is in rgb format, return it with the alpha applied
  if (color.startsWith('rgb')) {
    return color.replace(')', `, ${alpha})`).replace('rgba', 'rgb');
  }

  // Otherwise, treat it as a hex color and convert to rgba
  const r = parseInt(color.substr(1, 2), 16);
  const g = parseInt(color.substr(3, 2), 16);
  const b = parseInt(color.substr(5, 2), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}


// === NAVIGATION ===
prevMonthBtnVertView.addEventListener("click", () => {
  currentMonthVertView--;
  if (currentMonthVertView < 0) {
    currentMonthVertView = 11;
    currentYearVertView--;
  }
  updateCalendarWithTasks(currentMonthVertView, currentYearVertView);
});

nextMonthBtnVertView.addEventListener("click", () => {
  currentMonthVertView++;
  if (currentMonthVertView > 11) {
    currentMonthVertView = 0;
    currentYearVertView++;
  }
  updateCalendarWithTasks(currentMonthVertView, currentYearVertView);
});



// document.getElementById("closePopupBtn").addEventListener("click", () => {
//   document.getElementById("calendar-pop-up").style.display = "none";
//   document.getElementById("backdrop").style.display = "none";
// });

// document.getElementById("backdrop").addEventListener("click", () => {
//   document.getElementById("calendar-pop-up").style.display = "none";
//   document.getElementById("backdrop").style.display = "none";
// });


// === INITIAL SETUP ===
// createCalendarGrid();
// updateCalendarWithTasks(currentMonthVertView, currentYearVertView);




let draggedItem = null;
let ghost = null;
let offsetYforEditPopUp = 0;
let dragTimeout = null;
let startY = 0;
let animationFrameId = null;
let canStartDrag = false;
let dragTarget = null;
let isTouch = false;

const MAX_DRAG_DISTANCE = 30;

function startDraggingPopUp(x, y, target) {

  if (ghost && ghost.parentNode) {
    console.log("GHOST REMOVE");
    ghost.remove();
  }
  draggedItem = target;

  const rect = target.getBoundingClientRect();
  offsetYforEditPopUp = y - rect.top;

  const content = target.querySelector('.event-content');
  if (!content) return;

  ghost = content.cloneNode(true);
  ghost.classList.add('ghost');

  const computed = getComputedStyle(content);
  for (let prop of [
    'width', 'height', 'padding', 'margin',
    'font', 'fontSize', 'fontWeight',
    'border', 'borderLeft', 'borderRadius', 'boxSizing'
  ]) {
    ghost.style[prop] = computed[prop];
  }


  ghost.style.position = 'absolute';
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  ghost.style.pointerEvents = 'none';

  document.body.appendChild(ghost);
  target.classList.add('dragging');
}


function moveGhostThrottledPopUp(y) {
  if (animationFrameId) return;
  animationFrameId = requestAnimationFrame(() => {
    moveGhost(y);
    animationFrameId = null;
  });
}

function moveGhost(y) {
  if (!ghost) return;
  ghost.style.top = `${y - offsetYforEditPopUp}px`;

  const midX = window.innerWidth / 2;
  const target = document.elementFromPoint(midX, y);

  const dropTarget = target?.closest('.event');
  const sectionTarget = target?.closest('.period-section');

  if (dropTarget && dropTarget !== draggedItem) {
    const rect = dropTarget.getBoundingClientRect();
    const insertBefore = y < rect.top + rect.height / 2;
    const parent = dropTarget.parentElement;
    parent.insertBefore(draggedItem, insertBefore ? dropTarget : dropTarget.nextSibling);
  } else if (sectionTarget && !sectionTarget.contains(draggedItem)) {
    sectionTarget.appendChild(draggedItem);
  }

  cleanUpNoTasksText();
}
function cleanUpNoTasksText() {
  document.querySelectorAll('.period-section').forEach(section => {
    const events = Array.from(section.children).filter(child => child.classList.contains('event'));
    const existingNoTask = section.querySelector('.no-tasks-text');

    if (events.length === 0 && !existingNoTask) {
      const noTask = document.createElement("p");
      noTask.className = "no-tasks-text";
      noTask.textContent = "No tasks for this period.";
      section.appendChild(noTask);
    } else if (events.length > 0 && existingNoTask) {
      existingNoTask.remove();
    }
  });
}


function endDraggingPopUp() {
  // Remove ALL ghost elements from DOM
  document.querySelectorAll(".ghost").forEach(el => {
    // console.log("Removing lingering ghost:", el);
    el.remove();
  });

  ghost = null;

  if (dragTimeout) {
    clearTimeout(dragTimeout);
    dragTimeout = null;
  }

  canStartDrag = false;
  dragTarget = null;

  if (draggedItem) {
    draggedItem.classList.remove('dragging');
    draggedItem = null;
  }
}


function handlePointerDownPopUp(e) {
  if (isTouch) return;

  const target = e.target.closest('.event');
  if (!target) return;

  startY = e.clientY;
  dragTarget = target;
  canStartDrag = false;

  dragTimeout = setTimeout(() => {
    canStartDrag = true;
  }, 100);
}

function handlePointerMovePopUp(e) {
  const distance = Math.abs(e.clientY - startY);

  if (dragTimeout && distance > MAX_DRAG_DISTANCE) {
    clearTimeout(dragTimeout);
    dragTimeout = null;
    dragTarget = null;
    canStartDrag = false;
  }

  if (!draggedItem && canStartDrag && dragTarget) {
    requestAnimationFrame(() => {
      startDraggingPopUp(e.clientX, e.clientY, dragTarget);
    });
  }

  if (draggedItem) moveGhostThrottledPopUp(e.clientY);
}

function handlePointerUpPopUp() {
  endDraggingPopUp();
}

function handleTouchStartPopUp(e) {
  isTouch = true;
  setTimeout(() => isTouch = false, 1000);

  const touch = e.touches[0];
  const target = e.target.closest('.event');
  if (!target) return;

  startY = touch.clientY;
  dragTarget = target;
  canStartDrag = false;

  dragTimeout = setTimeout(() => {
    canStartDrag = true;
  }, 300);
}

function handleTouchMovePopUp(e) {
  const touch = e.touches[0];
  const distance = Math.abs(touch.clientY - startY);

  if (dragTimeout && distance > MAX_DRAG_DISTANCE) {
    clearTimeout(dragTimeout);
    dragTimeout = null;
    dragTarget = null;
    canStartDrag = false;



  }

  if (!draggedItem && canStartDrag && dragTarget) {
    startDraggingPopUp(touch.clientX, touch.clientY, dragTarget);
  }

  if (draggedItem) {
    moveGhostThrottledPopUp(touch.clientY);
    e.preventDefault(); // prevent scroll
  }
}

function handleTouchEndPopUp() {
  endDraggingPopUp();
}
function addDragListeners() {
  applyBordersToEventContent();
  swipeEnabledPopUp = false;
  const goTodayBtn = document.getElementById('go-to-today');
  const copyBtn = document.getElementById("copy-tasks-btn");

  copyBtn.disabled = true;
  copyBtn.classList.add('disabled-btn');
  goTodayBtn.disabled = true;
  goTodayBtn.classList.add(`disabled-btn`);


  document.addEventListener('pointerdown', handlePointerDownPopUp);
  document.addEventListener('pointermove', handlePointerMovePopUp);
  document.addEventListener('pointerup', handlePointerUpPopUp);
  document.addEventListener('pointercancel', endDraggingPopUp);

  document.addEventListener('touchstart', handleTouchStartPopUp, { passive: false });
  document.addEventListener('touchmove', handleTouchMovePopUp, { passive: false });
  document.addEventListener('touchend', handleTouchEndPopUp);
  document.addEventListener('touchcancel', endDraggingPopUp);
}

function removeDragListeners() {
  removeExtraBordersFromEventContent();
  swipeEnabledPopUp = true;
  const goTodayBtn = document.getElementById('go-to-today');
  const copyBtn = document.getElementById("copy-tasks-btn");

  copyBtn.disabled = false;
  copyBtn.classList.remove('disabled-btn');
  goTodayBtn.disabled = false;
  goTodayBtn.classList.remove(`disabled-btn`);


  document.removeEventListener('pointerdown', handlePointerDownPopUp);
  document.removeEventListener('pointermove', handlePointerMovePopUp);
  document.removeEventListener('pointerup', handlePointerUpPopUp);
  document.removeEventListener('pointercancel', endDraggingPopUp);

  document.removeEventListener('touchstart', handleTouchStartPopUp, { passive: false });
  document.removeEventListener('touchmove', handleTouchMovePopUp, { passive: false });
  document.removeEventListener('touchend', handleTouchEndPopUp);
  document.removeEventListener('touchcancel', endDraggingPopUp);
}


function applyBordersToEventContent() {
  document.querySelectorAll('.event-content').forEach(content => {
    const borderLeftColor = getComputedStyle(content).borderLeftColor;

    content.style.border = `1px solid ${borderLeftColor}`;
    content.style.borderLeftWidth = '8px'; // keep the left border thick
  });
}

function removeExtraBordersFromEventContent() {
  document.querySelectorAll('.event-content').forEach(content => {
    const borderLeftColor = getComputedStyle(content).borderLeftColor;

    content.style.border = 'none';
    content.style.borderLeft = `5px solid ${borderLeftColor}`; // restore only the left border
  });
}


document.getElementById('go-to-today').addEventListener('click', () => {
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }));
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  showDayTasks(todayKey);
});



const toggleBtn = document.getElementById('toggle-edit');
let isEditing = false;

toggleBtn.addEventListener('click', () => {
  isEditing = !isEditing;

  const icon = toggleBtn.querySelector('.material-symbols-outlined');
  const label = toggleBtn.querySelector('.calendar-icon-label');


  if (isEditing) {
    icon.textContent = 'save_as';
    icon.style.color = 'red';     // change icon to "save_as"
    label.textContent = 'Save';
    label.style.color = 'red';     // change text to "Save"
    addDragListeners();


  } else {
    icon.textContent = 'note_alt';
    icon.style.color = '';   // revert back to edit icon
    label.textContent = 'Rearrange';
    label.style.color = '';   // revert back to edit label
    endDraggingPopUp();

    removeDragListeners();

    if (popUpDate) {
      saveTaskOrderToLocalStorage(popUpDate);
    }
  }
});




function saveTaskOrderToLocalStorage(popUpDate) {


  const storedTasks = JSON.parse(localStorage.getItem("tasks")) || {};
  const currentData = storedTasks[popUpDate] || {};

  const updatedPeriods = {};
  const container = document.getElementById("popup-tasks");

  container.querySelectorAll(".period-section").forEach(section => {
    const period = section.querySelector(".section-divider")?.textContent.toLowerCase();
    const events = Array.from(section.querySelectorAll(".event"));

    updatedPeriods[period] = events.map(event => {
      let task = event.querySelector(".event-title")?.textContent.trim();
      const color = getComputedStyle(event.querySelector(".event-content")).borderLeftColor;

      // Handle fake task label like "No Title"
      if (task === "No Title" || task === "No tasks for this period.") {
        task = "";
      }

      return { task, color: rgbToHex(color) };
    });
  });

  storedTasks[popUpDate] = {
    ...currentData,
    ...updatedPeriods
  };

  localStorage.setItem("tasks", JSON.stringify(storedTasks));
}

function rgbToHex(rgb) {
  const result = rgb.match(/\d+/g).map(n => (+n).toString(16).padStart(2, "0"));
  return `#${result.join("")}`;
}



