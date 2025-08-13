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

// let selectedTasksPopup = [];

const undoStack = [];
const redoStack = [];

let chosenColor = '#6a5044';
let lineDivider = null;  


let dayTasksForEdit = null;
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

      cell.classList.add("is-active");


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



// document.getElementById("
// ").addEventListener("click", () => {
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

  // Instead of querying for .event-content and cloning it,
  // we take the parent node of that content
  const content = target.querySelector('.event-content');
  if (!content || !content.parentNode) return;

  const parentElem = content.parentNode; // 👈 get parent container
  ghost = parentElem.cloneNode(true);
  ghost.classList.add('ghost');

  const computed = getComputedStyle(parentElem);
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
// function cleanUpNoTasksText() {
//   document.querySelectorAll('.period-section').forEach(section => {
//     const events = Array.from(section.children).filter(child => child.classList.contains('event'));
//     const existingNoTask = section.querySelector('.no-tasks-text');

//     if (events.length === 0 && !existingNoTask) {
//       const noTask = document.createElement("p");
//       noTask.className = "no-tasks-text";
//       noTask.textContent = "No tasks for this period.";
//       section.appendChild(noTask);
//     } else if (events.length > 0 && existingNoTask) {
//       existingNoTask.remove();
//     }
//   });
// }

function cleanUpNoTasksText() {
  document.querySelectorAll('.period-section').forEach(section => {


    const events = Array.from(section.children).filter(child => child.classList.contains('event'));
    const existingNoTask = section.querySelector('.no-tasks-text');



    if (events.length === 0 && !existingNoTask) {
      const period = section.querySelector('.section-divider').textContent.toLowerCase();

      const noTask = document.createElement("p");
      noTask.className = "no-tasks-text";
      noTask.textContent = `Click to add new task for ${period}`;
      noTask.style.cursor = "pointer";
      noTask.title = "Click to add a new task";


      noTask.addEventListener("click", () => {
    const currentState = saveTaskOrderToTemp(); // Get fresh snapshot of current tasks
    undoStack.push(currentState);
    redoStack.length = 0; // clear redo stack because new action happened
        const newEvent = createEventElement({
          task: "No Title",
          color: chosenColor,
          period: period,
          index: null,
          isSelected: false,
        });

        section.appendChild(newEvent);
        renderAppropriateStyle();
        blurCurrentlyEditing();
        autoFocusEventTitle(newEvent);

        // Optionally, focus and highlight the new event's title:
        const newTitle = newEvent.querySelector(".event-title");
        if (newTitle) {
          newTitle.contentEditable = "true";
          newEvent.style.outline = "2px solid #00aaff";
          newTitle.focus();

          const range = document.createRange();
          range.selectNodeContents(newTitle);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }

        noTask.remove();
      });


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


// function handlePointerDownPopUp(e) {
//   if (isTouch) return;

//   const target = e.target.closest('.event');
//   if (!target) return;

//   startY = e.clientY;
//   dragTarget = target;
//   canStartDrag = false;

//   dragTimeout = setTimeout(() => {
//     canStartDrag = true;
//   }, 100);
// }

// function handlePointerMovePopUp(e) {
//   const distance = Math.abs(e.clientY - startY);

//   if (dragTimeout && distance > MAX_DRAG_DISTANCE) {
//     clearTimeout(dragTimeout);
//     dragTimeout = null;
//     dragTarget = null;
//     canStartDrag = false;
//   }

//   if (!draggedItem && canStartDrag && dragTarget) {
//     requestAnimationFrame(() => {
//       startDraggingPopUp(e.clientX, e.clientY, dragTarget);
//     });
//   }

//   if (draggedItem) moveGhostThrottledPopUp(e.clientY);
// }

// function handlePointerUpPopUp() {
//   endDraggingPopUp();
// }

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

        // Save pre-drag state to undo only when drag really starts
    undoStack.push(saveTaskOrderToTemp());
    redoStack.length = 0; // Clear redo
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
  // saveTaskOrderToTemp();
  // showDayTasksEditable(popUpDate);
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

  const popupTasks = document.getElementById("popup-tasks");


  // document.addEventListener('pointerdown', handlePointerDownPopUp);
  // document.addEventListener('pointermove', handlePointerMovePopUp);
  // document.addEventListener('pointerup', handlePointerUpPopUp);
  // document.addEventListener('pointercancel', endDraggingPopUp);


  // Add listeners to popupTasks element instead of document
  popupTasks.addEventListener('touchstart', handleTouchStartPopUp, { passive: false });
  popupTasks.addEventListener('touchmove', handleTouchMovePopUp, { passive: false });
  popupTasks.addEventListener('touchend', handleTouchEndPopUp);
  popupTasks.addEventListener('touchcancel', endDraggingPopUp);
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

  const popupTasks = document.getElementById("popup-tasks");


  // document.removeEventListener('pointerdown', handlePointerDownPopUp);
  // document.removeEventListener('pointermove', handlePointerMovePopUp);
  // document.removeEventListener('pointerup', handlePointerUpPopUp);
  // document.removeEventListener('pointercancel', endDraggingPopUp);

  // Later, to remove them:
  popupTasks.removeEventListener('touchstart', handleTouchStartPopUp, { passive: false });
  popupTasks.removeEventListener('touchmove', handleTouchMovePopUp, { passive: false });
  popupTasks.removeEventListener('touchend', handleTouchEndPopUp);
  popupTasks.removeEventListener('touchcancel', endDraggingPopUp);
}


function applyBordersToEventContent() {
  document.querySelectorAll('.event-content').forEach(content => {
    const borderLeftColor = getComputedStyle(content).borderLeftColor;

    // content.style.border = `1px solid ${borderLeftColor}`;
    content.style.borderLeftWidth = '5px'; // keep the left border thick
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



const toggleEditBtn = document.getElementById('toggle-edit');
let isEditing = false;

toggleEditBtn.addEventListener('click', () => {

  isEditing = !isEditing;

  const normalButtons = document.querySelectorAll('.normal-mode');
  const editButtons = document.querySelectorAll('.edit-mode');
  const icon = toggleEditBtn.querySelector('.material-symbols-outlined');
  const label = toggleEditBtn.querySelector('.calendar-icon-label');


  if (isEditing) {
    moveColorOptionsToPopup();
    normalButtons.forEach(btn => btn.classList.add('hidden'));
    editButtons.forEach(btn => btn.classList.remove('hidden'));
    icon.textContent = 'save_as';
    icon.style.color = 'red';     // change icon to "save_as"
    label.textContent = 'Save';
    label.style.color = 'red';     // change text to "Save"
    addDragListeners();

    const storedTasks = JSON.parse(localStorage.getItem("tasks")) || {};
    dayTasksForEdit = storedTasks[popUpDate] ? JSON.parse(JSON.stringify(storedTasks[popUpDate])) : {};
    showDayTasksEditable(popUpDate);


    document.querySelectorAll(".event-content").forEach(el => {
      el.style.marginLeft = "0";
      el.style.marginRight = "0";
    });

    document.querySelectorAll(".delete-dayTask, .arrow-up-dayTask, .arrow-down-dayTask").forEach(el => {
      el.style.display = "inline-flex"; // or "block" depending on layout
    });

    document.querySelectorAll(".event").forEach(el => {
      el.style.border = "1px solid #ccc";
      el.style.borderRadius = "5px";
    });

  } else {
    restoreColorOptions();
    normalButtons.forEach(btn => btn.classList.remove('hidden'));
    editButtons.forEach(btn => btn.classList.add('hidden'));
    // icon.textContent = 'note_alt';
    dayTasksForEdit = null;
    icon.textContent = 'edit_note';

    icon.style.color = '';   // revert back to edit icon
    label.textContent = 'Edit';
    label.style.color = '';   // revert back to edit label
    endDraggingPopUp();

    removeDragListeners();

    if (popUpDate) {
      saveTaskOrderToLocalStorage(popUpDate);
    }

    showDayTasks(popUpDate);

    document.querySelectorAll(".delete-dayTask, .arrow-up-dayTask, .arrow-down-dayTask").forEach(el => {
      el.style.display = "none";

      document.querySelectorAll(".event").forEach(el => {
        el.style.border = "none";
      });
    });

    document.querySelectorAll(".event-content").forEach(el => {
      el.style.marginLeft = "20px";
      el.style.marginRight = "20px";
    });

  }
});

function redo() {
  if (redoStack.length === 0) return;

  // Save current state to undo stack before redoing
undoStack.push(saveTaskOrderToTemp());


  // Restore next state
  const nextState = redoStack.pop();

  dayTasksForEdit = deepClone(nextState);

  showDayTasksEditable(popUpDate);  // re-render your UI with restored state

  document.querySelectorAll(".event-content").forEach(el => {
    el.style.marginLeft = "0";
    el.style.marginRight = "0";
  });

  document.querySelectorAll(".delete-dayTask, .arrow-up-dayTask, .arrow-down-dayTask").forEach(el => {
    el.style.display = "inline-flex"; // or "block" depending on layout
  });

  document.querySelectorAll(".event").forEach(el => {
    el.style.border = "1px solid #ccc";
    el.style.borderRadius = "5px";
  });
}

function undo() {
  if (undoStack.length === 0) return;

  // Save current state to redo stack before undoing
redoStack.push(saveTaskOrderToTemp());


  // Restore previous state
  const previousState = undoStack.pop();

  dayTasksForEdit = deepClone(previousState);
  showDayTasksEditable(popUpDate);  // re-render your UI with restored state

  document.querySelectorAll(".event-content").forEach(el => {
    el.style.marginLeft = "0";
    el.style.marginRight = "0";
  });

  document.querySelectorAll(".delete-dayTask, .arrow-up-dayTask, .arrow-down-dayTask").forEach(el => {
    el.style.display = "inline-flex"; // or "block" depending on layout
  });

  document.querySelectorAll(".event").forEach(el => {
    el.style.border = "1px solid #ccc";
    el.style.borderRadius = "5px";
  });
}

function saveState() {
  undoStack.push(deepClone(dayTasksForEdit));
  // Clear redo stack on new action
  redoStack.length = 0;
}


function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}



document.getElementById('undo-btn-popup').addEventListener('click', () => {
  undo();
});

document.getElementById('redo-btn-popup').addEventListener('click', () => {
  redo();
});





document.getElementById('cancel-btn-popup').addEventListener('click', () => {
  const normalButtons = document.querySelectorAll('.normal-mode');
  const editButtons = document.querySelectorAll('.edit-mode');
  editButtons.forEach(btn => btn.classList.add('hidden'));
  normalButtons.forEach(btn => btn.classList.remove('hidden'));
  console.log("cancel button clicked");
  isEditing = false;
  document.getElementById("closePopupBtn").click();
  showDayTasks(popUpDate);
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

  // Check if all periods are empty or contain only empty tasks (task and color both empty)
  const allEmpty = Object.values(updatedPeriods).every(periodTasks =>
    periodTasks.length === 0 || periodTasks.every(t => t.task === "" && (!t.color || t.color === "" || t.color === "#00000000"))
  );

  if (allEmpty) {
    // Remove the day entry from storedTasks
    if (storedTasks[popUpDate]) {
      delete storedTasks[popUpDate];
      localStorage.setItem("tasks", JSON.stringify(storedTasks));
    }
  } else {
    // Save updated data
    storedTasks[popUpDate] = {
      ...currentData,
      ...updatedPeriods
    };
    localStorage.setItem("tasks", JSON.stringify(storedTasks));
  }
}



function saveTaskOrderToTemp() {
  if (!dayTasksForEdit) return null;

  const container = document.getElementById("popup-tasks");
  const snapshot = {};

  container.querySelectorAll(".period-section").forEach(section => {
    const period = section.querySelector(".section-divider")?.textContent.toLowerCase();

    // Select only real events, ignore placeholders like <p class="no-tasks-text">
    const events = Array.from(section.querySelectorAll(".event"));

    // If no events, save empty array; else map tasks with colors
    snapshot[period] = events.length === 0
      ? []
      : events.map(event => {
          let task = event.querySelector(".event-title")?.textContent.trim() || "";
          const color = getComputedStyle(event.querySelector(".event-content")).borderLeftColor;

          // Normalize placeholder task names
          if (task === "No Title" || task === "No tasks for this period.") {
            task = "";
          }

          return { task, color: rgbToHex(color) };
        });
  });

  return snapshot;
}




function rgbToHex(rgb) {
  const result = rgb.match(/\d+/g).map(n => (+n).toString(16).padStart(2, "0"));
  return `#${result.join("")}`;
}




