// === SETUP DOM ELEMENTS ===
const calendarContainerVertView = document.getElementById("calendar-container-vert-view");
// const showCalendarBtnVertView = document.getElementById("show-vert-calendar-btn");
const daysGridVertView = document.getElementById("days-grid-vert-view");
const monthLabelVertView = document.getElementById("month-label-vert-view");
const calIconVertView = document.getElementById("icon-month-label-vert-view");
const prevMonthBtnVertView = document.getElementById("prev-month-vert-view");
const nextMonthBtnVertView = document.getElementById("next-month-vert-view");
const monthViewTodoBtn = document.querySelector(".month-view-todo-btn");
if (monthViewTodoBtn) {
  monthViewTodoBtn.addEventListener("click", () => {
    todoMenuItem.click();
  });
}

const yearContainer = document.getElementById('year-container');
let swipeEnabledPopUp = true;

// let selectedTasksPopup = [];

let beforeEditState = null; //for title focus and blur
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


let todayVertView = AppTimezone.now();
let currentMonthVertView = todayVertView.getMonth();
let currentYearVertView = todayVertView.getFullYear();

let currentMonthValue = currentMonthVertView;
let currentYearValue = currentYearVertView;


let popUpDate = `${todayVertView.getFullYear()}-${todayVertView.getMonth()}-${todayVertView.getDate()}`;
console.log("POPUPDATE IS:", popUpDate);

// Re-render calendar when timezone changes mid-session
window.addEventListener('timezone-changed', () => {
    todayVertView = AppTimezone.now();
    currentMonthVertView = todayVertView.getMonth();
    currentYearVertView = todayVertView.getFullYear();
    currentMonthValue = currentMonthVertView;
    currentYearValue = currentYearVertView;
    popUpDate = `${todayVertView.getFullYear()}-${todayVertView.getMonth()}-${todayVertView.getDate()}`;
    if (daysGridVertView && daysGridVertView.children.length >= 42) {
        updateCalendarWithTasks(currentMonthVertView, currentYearVertView);
    }
});


let gestureStartX = 0;
let gestureStartY = 0;
let gestureStartTime = 0;
let gestureStartRow = -1;
let gestureStartScrollTop = 0;
let gestureTargetContainer = null;
let gestureStartedOnHeader = false;
let didTaskContentScroll = false;
let isMonthViewSwiping = false;
let isEditing = false;

function expandGridRow(rowIndex) {
  if (rowIndex < 0 || rowIndex > 5) return;
  if (!daysGridVertView) return;
  daysGridVertView.setAttribute("data-expanded-row", rowIndex.toString());

  Array.from(daysGridVertView.children).forEach((cell, idx) => {
    const row = Math.floor(idx / 7);
    cell.classList.toggle("row-expanded", row === rowIndex);
  });
}

function collapseGridRows() {
  if (!daysGridVertView) return;
  daysGridVertView.removeAttribute("data-expanded-row");
  Array.from(daysGridVertView.children).forEach(cell => {
    cell.classList.remove("row-expanded");
  });
}

// Touch event tracking
calendarContainerVertView.addEventListener("touchstart", (e) => {
  if (e.touches.length > 1) return;
  gestureStartTime = Date.now();
  gestureStartX = e.touches[0].clientX;
  gestureStartY = e.touches[0].clientY;
  isMonthViewSwiping = false;
  didTaskContentScroll = false;

  const targetCell = e.target.closest(".day-vert-view");
  if (targetCell && daysGridVertView) {
    const cellIndex = Array.from(daysGridVertView.children).indexOf(targetCell);
    gestureStartRow = cellIndex >= 0 ? Math.floor(cellIndex / 7) : -1;
    gestureTargetContainer = targetCell.querySelector(".task-container-vert-view");
    gestureStartScrollTop = gestureTargetContainer ? gestureTargetContainer.scrollTop : 0;
    gestureStartedOnHeader = Boolean(e.target.closest(".day-number"));
  } else {
    gestureStartRow = -1;
    gestureTargetContainer = null;
    gestureStartScrollTop = 0;
    gestureStartedOnHeader = false;
  }
}, { passive: true });

calendarContainerVertView.addEventListener("touchmove", (e) => {
  if (e.touches.length > 1) return;
  const currentX = e.touches[0].clientX;
  const currentY = e.touches[0].clientY;
  const dx = currentX - gestureStartX;
  const dy = currentY - gestureStartY;

  // Detect if task container scrolled
  if (gestureTargetContainer) {
    if (Math.abs(gestureTargetContainer.scrollTop - gestureStartScrollTop) > 3) {
      didTaskContentScroll = true;
    }
  }

  if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
    isMonthViewSwiping = true;
  }
}, { passive: true });

calendarContainerVertView.addEventListener("touchend", (e) => {
  const touchEndX = e.changedTouches[0].clientX;
  const touchEndY = e.changedTouches[0].clientY;

  // Final check if container scrolled
  if (gestureTargetContainer) {
    if (Math.abs(gestureTargetContainer.scrollTop - gestureStartScrollTop) > 3) {
      didTaskContentScroll = true;
    }
  }

  handleCalendarGesture(gestureStartX, touchEndX, gestureStartY, touchEndY, Date.now() - gestureStartTime);

  setTimeout(() => {
    isMonthViewSwiping = false;
  }, 120);
});

// Desktop mouse drag support
let isMonthViewMouseDown = false;

calendarContainerVertView.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  if (e.target.closest("#calendar-pop-up") || e.target.closest("#backdrop")) return;

  gestureStartTime = Date.now();
  gestureStartX = e.clientX;
  gestureStartY = e.clientY;
  isMonthViewMouseDown = true;
  isMonthViewSwiping = false;
  didTaskContentScroll = false;

  const targetCell = e.target.closest(".day-vert-view");
  if (targetCell && daysGridVertView) {
    const cellIndex = Array.from(daysGridVertView.children).indexOf(targetCell);
    gestureStartRow = cellIndex >= 0 ? Math.floor(cellIndex / 7) : -1;
    gestureTargetContainer = targetCell.querySelector(".task-container-vert-view");
    gestureStartScrollTop = gestureTargetContainer ? gestureTargetContainer.scrollTop : 0;
    gestureStartedOnHeader = Boolean(e.target.closest(".day-number"));
  } else {
    gestureStartRow = -1;
    gestureTargetContainer = null;
    gestureStartScrollTop = 0;
    gestureStartedOnHeader = false;
  }
});

window.addEventListener("mousemove", (e) => {
  if (!isMonthViewMouseDown) return;
  const dx = e.clientX - gestureStartX;
  const dy = e.clientY - gestureStartY;

  if (gestureTargetContainer) {
    if (Math.abs(gestureTargetContainer.scrollTop - gestureStartScrollTop) > 3) {
      didTaskContentScroll = true;
    }
  }

  if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
    isMonthViewSwiping = true;
  }
});

window.addEventListener("mouseup", (e) => {
  if (!isMonthViewMouseDown) return;
  isMonthViewMouseDown = false;
  const mouseEndX = e.clientX;
  const mouseEndY = e.clientY;

  if (gestureTargetContainer) {
    if (Math.abs(gestureTargetContainer.scrollTop - gestureStartScrollTop) > 3) {
      didTaskContentScroll = true;
    }
  }

  handleCalendarGesture(gestureStartX, mouseEndX, gestureStartY, mouseEndY, Date.now() - gestureStartTime);

  setTimeout(() => {
    isMonthViewSwiping = false;
  }, 120);
});

// Professional Gesture vs Scroll Resolver
function handleCalendarGesture(startX, endX, startY, endY, duration) {
  const dx = endX - startX;
  const dy = endY - startY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const timeMs = Math.max(duration, 1);
  const velocityY = absDy / timeMs;
  const velocityX = absDx / timeMs;

  // 1. Horizontal swipe: Month navigation (Left / Right)
  const isHorizontalSwipe = absDx >= 45 && absDx > absDy * 1.25 && (velocityX > 0.25 || absDx > 70);
  if (isHorizontalSwipe && !didTaskContentScroll) {
    if (dx < 0) {
      // Next month
      currentMonthVertView++;
      if (currentMonthVertView > 11) {
        currentMonthVertView = 0;
        currentYearVertView++;
      }
    } else {
      // Previous month
      currentMonthVertView--;
      if (currentMonthVertView < 0) {
        currentMonthVertView = 11;
        currentYearVertView--;
      }
    }
    collapseGridRows();
    updateCalendarWithTasks(currentMonthVertView, currentYearVertView);
    return;
  }

  // 2. If user was actively scrolling task content inside the cell, NEVER collapse or expand row!
  if (didTaskContentScroll) {
    return;
  }

  // 3. Vertical Gesture Handling
  const isPredominantlyVertical = absDy >= 30 && absDy > absDx * 1.2;
  if (!isPredominantlyVertical) return;

  // --- SWIPE DOWN: Expand the row ---
  if (dy > 0) {
    const atTopBoundary = gestureStartedOnHeader || gestureStartScrollTop <= 3;
    const isIntentionalSwipe = (velocityY >= 0.3 || dy >= 45) && timeMs < 500;

    if (atTopBoundary && isIntentionalSwipe && gestureStartRow >= 0) {
      expandGridRow(gestureStartRow);
    }
  }
  // --- SWIPE UP: Collapse row ---
  else if (dy < 0) {
    const isCurrentlyExpanded = daysGridVertView && daysGridVertView.hasAttribute("data-expanded-row");
    if (!isCurrentlyExpanded) return;

    // A) If started on the day header: immediate collapse
    if (gestureStartedOnHeader) {
      collapseGridRows();
      return;
    }

    // B) If started inside task container:
    const container = gestureTargetContainer;
    const hasScrollableOverflow = container ? (container.scrollHeight > container.clientHeight + 4) : false;

    if (!hasScrollableOverflow) {
      // Content fits without scrollbar -> swipe up collapses
      if (absDy >= 35) {
        collapseGridRows();
      }
    } else {
      // Content has scrollbar -> only fast flick when at bottom boundary collapses
      const isFastFlick = velocityY >= 0.45 && timeMs <= 320 && absDy >= 40;
      const isAtBottom = container && (container.scrollTop + container.clientHeight >= container.scrollHeight - 4);

      if (isFastFlick && isAtBottom) {
        collapseGridRows();
      }
    }
  }
}




// === RESIZE THE CALENDAR VIEW MINUS THE ADDRESS BAR ===
function adjustCalendarHeight() {
  calendarContainerVertView.style.height = `${window.innerHeight}px`;
  menuSlider.style.height = `${window.innerHeight}px`;

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
}

function updateCalendarWithTasks(month, year) {
  if (!daysGridVertView || daysGridVertView.children.length < 42) return;

  document.querySelectorAll(".grid-cell").forEach(cell => {
    cell.classList.remove("is-active");
  });
  collapseGridRows();

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
      const todayVertView = AppTimezone.now();

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
      if (isMonthViewSwiping) return;

      document.querySelectorAll(".grid-cell").forEach(cell => {
        cell.classList.remove("is-active");
      });

      cell.classList.add("is-active");


      clearTimeout(popupTimeout); // Cancel previous popup trigger
      lastClickedCell = cell;

      popupTimeout = setTimeout(() => {
        if (lastClickedCell === cell && !isMonthViewSwiping) {
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

  const content = target.querySelector('.event-content');
  if (!content || !content.parentNode) return;

  const parentElem = content.parentNode;
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

  ghost.style.position = 'fixed';
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${y - offsetYforEditPopUp}px`;
  ghost.style.pointerEvents = 'none';

  document.body.appendChild(ghost);
  target.classList.add('dragging');
  // document.body.classList.add('dragging');
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


      // noTask.addEventListener("click", () => {

      //   const currentState = saveTaskOrderToTemp(); // Get fresh snapshot of current tasks
      //   undoStack.push(currentState);
      //   redoStack.length = 0; // clear redo stack because new action happened
      //   const newEvent = createEventElement({
      //     task: "No Title",
      //     color: chosenColor,
      //     period: period,
      //     index: null,
      //     isSelected: false,
      //   });

      //   section.appendChild(newEvent);
      //   renderAppropriateStyle();
      //   blurCurrentlyEditing();
      //   autoFocusEventTitle(newEvent);

      //   // Optionally, focus and highlight the new event's title:
      //   const newTitle = newEvent.querySelector(".event-title");
      //   if (newTitle) {
      //     newTitle.contentEditable = "true";
      //     // newEvent.style.outline = "none";
      //     newEvent.style.border = "2px solid #00aaff";
      //     newTitle.focus();

      //     const range = document.createRange();
      //     range.selectNodeContents(newTitle);
      //     const sel = window.getSelection();
      //     sel.removeAllRanges();
      //     sel.addRange(range);
      //   }

      //   noTask.remove();
      //   selectAllBtnUpdate();
      // });


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

  // document.body.classList.remove('dragging');
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

    startDraggingPopUp(touch.clientX, touch.clientY, dragTarget);
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

  // if (!draggedItem && canStartDrag && dragTarget) {
  //   startDraggingPopUp(touch.clientX, touch.clientY, dragTarget);
  // }

  if (draggedItem) {
    moveGhostThrottledPopUp(touch.clientY);

    e.preventDefault();
    e.stopPropagation();
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
  const goTodayBtn = document.getElementById('go-to-date-popup-btn') || document.getElementById('go-to-today');
  const copyBtn = document.getElementById("copy-tasks-btn");

  copyBtn.disabled = true;
  copyBtn.classList.add('disabled-btn');
  if (goTodayBtn) {
    goTodayBtn.disabled = true;
    goTodayBtn.classList.add(`disabled-btn`);
  }

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
  const goTodayBtn = document.getElementById('go-to-date-popup-btn') || document.getElementById('go-to-today');
  const copyBtn = document.getElementById("copy-tasks-btn");

  copyBtn.disabled = false;
  copyBtn.classList.remove('disabled-btn');
  if (goTodayBtn) {
    goTodayBtn.disabled = false;
    goTodayBtn.classList.remove(`disabled-btn`);
  }

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


const popupGoDateBtn = document.getElementById('go-to-date-popup-btn') || document.getElementById('go-to-today');
if (popupGoDateBtn) {
  popupGoDateBtn.addEventListener('click', () => {
    if (typeof openGoToDateModal === 'function') {
      openGoToDateModal(null, null, true);
    }
  });
}



const toggleEditBtn = document.getElementById('toggle-edit');


toggleEditBtn.addEventListener('click', () => {

  isEditing = !isEditing;

  // document.querySelector(".popup-header").classList.add("in-edit-mode");

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

    //   document.querySelectorAll(".event").forEach(el => {
    //     el.style.backgroundColor = "rgba(0, 170, 255, 0.1)";
    // });


    document.querySelectorAll(".delete-dayTask, .arrow-up-dayTask, .arrow-down-dayTask").forEach(el => {
      el.style.display = "inline-flex"; // or "block" depending on layout
    });

    document.querySelectorAll(".event").forEach(el => {
      el.style.border = "1px solid #ccc";
      el.style.borderRadius = "2px";
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
        // el.style.backgroundColor = "";
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
  selectAllBtnUpdate();
  document.querySelectorAll(".event-content").forEach(el => {
    el.style.marginLeft = "0";
    el.style.marginRight = "0";
  });

  document.querySelectorAll(".delete-dayTask, .arrow-up-dayTask, .arrow-down-dayTask").forEach(el => {
    el.style.display = "inline-flex"; // or "block" depending on layout
  });

  document.querySelectorAll(".event").forEach(el => {
    el.style.border = "1px solid #ccc";
    el.style.borderRadius = "2px";
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
  selectAllBtnUpdate();
  document.querySelectorAll(".event-content").forEach(el => {
    el.style.marginLeft = "0";
    el.style.marginRight = "0";
  });

  document.querySelectorAll(".delete-dayTask, .arrow-up-dayTask, .arrow-down-dayTask").forEach(el => {
    el.style.display = "inline-flex"; // or "block" depending on layout
  });

  document.querySelectorAll(".event").forEach(el => {
    el.style.border = "1px solid #ccc";
    el.style.borderRadius = "2px";
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

      if (task) {
        addTemplate(task, rgbToHex(color));
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




