const popupTasks = document.getElementById("popup-tasks");

const todayDateObjScroll = new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' });
const nowTodayElementScroll = new Date(todayDateObjScroll);

const yearTodayElementScroll = nowTodayElementScroll.getFullYear();
const monthTodayElementScroll = nowTodayElementScroll.getMonth();
const dayTodayElementScroll = nowTodayElementScroll.getDate();

const todayDateScroll = `${yearTodayElementScroll}-${monthTodayElementScroll}-${dayTodayElementScroll}`;

// Call initially and on resize
adjustCalendarHeight();
window.addEventListener('resize', adjustCalendarHeight);


const calendarPopup = document.getElementById('calendar-pop-up');

calendarPopup.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
});

calendarPopup.addEventListener('touchend', (e) => {
  if (!swipeEnabledPopUp) return;

  const touchEndX = e.changedTouches[0].screenX;
  const touchEndY = e.changedTouches[0].screenY;

  const dx = touchEndX - touchStartX;
  const dy = touchEndY - touchStartY;

  const minSwipeDistance = 50;
  if (Math.abs(dx) < minSwipeDistance) return; // too short

  const slope = Math.abs(dy / dx);
  const maxAllowedSlope = Math.tan(30 * Math.PI / 180); // ~0.7

  if (slope > maxAllowedSlope) return; // too vertical

  if (dx < 0) {
    // Swipe left → next day
    goToNextDay();
  } else {
    // Swipe right → previous day
    goToPreviousDay();

  }

});

function goToNextDay() {
  const dateObj = safeDateFromPopUpDate(popUpDate);
  dateObj.setDate(dateObj.getDate() + 1);
  const fixedDate = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;
  //   console.log("POPUPDATE IS:", popUpDate);
  showDayTasks(fixedDate);
}

function goToPreviousDay() {
  const dateObj = safeDateFromPopUpDate(popUpDate);
  dateObj.setDate(dateObj.getDate() - 1);
  const fixedDate = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;
  //   console.log("POPUPDATE IS:", popUpDate);
  showDayTasks(fixedDate);
}

function safeDateFromPopUpDate(str) {
  const [year, month, day] = str.split('-').map(Number);
  return new Date(year, month, day);
}


yearContainer.addEventListener('click', (e) => {
  const dateEl = e.target.closest('.date');
  const dayEl = e.target.closest('.day');

  let fullDate = null;
  let clickedEl = null;

  if (dateEl) {
    fullDate = dateEl.dataset.fullDate;
    clickedEl = dateEl;
  } else if (dayEl) {
    // Find sibling .date (assumes .day and .date share a common parent)
    const siblingDateEl = dayEl.parentElement.querySelector('.date');
    if (siblingDateEl) {
      fullDate = siblingDateEl.dataset.fullDate;
      clickedEl = dayEl;
    }
  }

  if (fullDate) {
    clearTimeout(popupTimeout);
    lastClickedEl = clickedEl;

    popupTimeout = setTimeout(() => {
      if (lastClickedEl === clickedEl) {
        showDayTasks(fullDate);
      }
    }, 60);
  }
});


todayScroll(todayDateScroll);
function todayScroll(todayDate) {

  // console.log('Built todayDate:', todayDate);

  const todayElement = document.querySelector(`.date[data-full-date="${todayDate}"]`);
  // console.log('Found todayElement:', todayElement);

  if (todayElement) {
    // console.log("ENTERED todayElement");
    todayElement.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
    todayElement.click();
  }
}


function currentDayScroll(todayDate) {

  // console.log('Built todayDate:', todayDate);

  const todayElement = document.querySelector(`.date[data-full-date="${todayDate}"]`);
  // console.log('Found todayElement:', todayElement);

  if (todayElement) {
    // console.log("ENTERED todayElement", todayElement);
    todayElement.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  } else {
    return;
  }

  setTimeout(() => {
    todayElement.classList.add('is-active');

    setTimeout(() => {
      todayElement.classList.remove('is-active');
    }, 300); // how long the effect lasts
  }, 350); // delay should roughly match scroll duration

}



// === RESIZE THE CALENDAR VIEW MINUS THE ADDRESS BAR ===
function adjustCalendarHeight() {
  //   calendarContainerVertView.style.height = `${window.innerHeight}px`;

  // Adjust popup max-height as well
  const popup = document.getElementById("calendar-pop-up");
  if (popup) {
    popup.style.maxHeight = `${window.innerHeight * 0.8}px`;
    popup.style.height = `${window.innerHeight * 0.8}px`;
  }
}




function showDayTasks(d) {

  undoStack.length = 0;
  redoStack.length = 0;
  // const target = e.target.closest('[data-full-date]');
  // if (!target) return;
  // console.log("call to showDayTask succesful from grid");
  // const date = target.dataset.fullDate;
  const date = d;
  popUpDate = date;
  // console.log("POPUPDATE IS:", date);
  if (!date) return;

  const storedTasks = JSON.parse(localStorage.getItem("tasks")) || {};
  const dayTasks = storedTasks[date];

  // Split and pad manually
  const [year, month, day] = date.split('-');
  const paddedMonth = String(Number(month) + 1).padStart(2, '0');
  const paddedDay = String(day).padStart(2, '0');
  const fixedDate = `${year}-${paddedMonth}-${paddedDay}`;

  const dateObj = new Date(fixedDate);

  currentMonthValue = dateObj.getMonth();
  currentYearValue = dateObj.getFullYear();

  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }));
  const target = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());

  const dayDiff = Math.floor((target - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / (1000 * 60 * 60 * 24));

  let label;
  let bottomLine;

  if (dayDiff === 0) {
    label = "Today";
  } else if (dayDiff === -1) {
    label = "Yesterday";
  } else if (dayDiff === 1) {
    label = "Tomorrow";
  }

  if (label) {
    const shortWeekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' }); // "Mon"
    const shortDate = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }); // "June 22"
    bottomLine = `${shortWeekday}, ${shortDate}`;
  } else {
    label = dateObj.toLocaleDateString('en-US', { weekday: 'long' }); // "Monday"
    bottomLine = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  document.getElementById("popup-date").innerHTML = `
  <div class="weekday">${label}</div>
  <div class="month-year">${bottomLine}</div>
`;



  const popupTasks = document.getElementById("popup-tasks");
  popupTasks.innerHTML = "";

if (
  !dayTasks || 
  (
    (!dayTasks.morning || dayTasks.morning.length === 0) &&
    (!dayTasks.afternoon || dayTasks.afternoon.length === 0) &&
    (!dayTasks.evening || dayTasks.evening.length === 0)
  )
) {
  const noTask = document.createElement("p");
  noTask.textContent = "No tasks for this day.";
  popupTasks.appendChild(noTask);

  // Also remove this date from localStorage to save space
  const storedTasks = JSON.parse(localStorage.getItem("tasks")) || {};
  if (storedTasks[date]) {
    delete storedTasks[date];
    localStorage.setItem("tasks", JSON.stringify(storedTasks));
  }
}



else {
    const periods = ["morning", "afternoon", "evening"];

    periods.forEach(period => {
      const section = document.createElement("div");
      section.classList.add("period-section");


      const divider = document.createElement("div");
      divider.className = "section-divider";
      divider.textContent = period.charAt(0).toUpperCase() + period.slice(1);
      section.appendChild(divider);


      const periodTasks = dayTasks[period];
      if (periodTasks && periodTasks.length > 0) {
        periodTasks.forEach(({ task, color }) => {
          const eventDiv = document.createElement("div");
          eventDiv.className = "event";

          const content = document.createElement("div");
          content.className = "event-content";

          const title = document.createElement("span");
          title.className = "event-title";

          const hasText = task && task.trim() !== "";
          const hasColor = color && color.trim() !== "";

          if (hasText && hasColor) {
            content.style.borderLeft = `5px solid ${color}`;
            title.textContent = task;
          } else if (!hasText && hasColor) {
            content.style.borderLeft = `5px solid ${color}`;
            title.textContent = "No Title";
          } else {
            // Don't create an event, create a <p> instead
            const noTask = document.createElement("p");
            noTask.className = "no-tasks-text";
            noTask.textContent = "No tasks for this period.";
            section.appendChild(noTask);
            return; // skip appending the .event
          }


          content.appendChild(title);
          eventDiv.appendChild(content);
          section.appendChild(eventDiv);
        });
      }
      else {
        const noTask = document.createElement("p");
        noTask.className = "no-tasks-text";
        // content.classList.add("no-tasks-for-this-period");
        noTask.textContent = "No tasks for this period.";
        section.appendChild(noTask);
      }

      popupTasks.appendChild(section);
    });
  }

  showPopup();
}


// Assume dayTasksForEdit is a global or passed in variable representing the day's tasks copy for editing
function showDayTasksEditable(date, focusInfo = null) {
  console.log("rerendering");

  // console.log("Clicked element:", event.currentTarget); // The element that the listener is attached to
  // console.log("Clicked element (actual target):", event.target); // The actual element clicked (might be child)

  if (!date) return;
  const dayTasks = dayTasksForEdit;
  popupTasks.innerHTML = "";

  if (!dayTasks) {
    // const noTask = document.createElement("p");
    // noTask.textContent = "No tasks for this day.";
    // popupTasks.appendChild(noTask);
  } else {
    const periods = ["morning", "afternoon", "evening"];

    periods.forEach(period => {
      const section = document.createElement("div");
      section.classList.add("period-section");

      const divider = document.createElement("div");
      divider.className = "section-divider";
      divider.textContent = period.charAt(0).toUpperCase() + period.slice(1);
      section.appendChild(divider);

      const periodTasks = dayTasks[period];
      if (periodTasks && periodTasks.length > 0) {
        periodTasks.forEach(({ task, color }, index) => {
          const eventDiv = document.createElement("div");
          eventDiv.className = "event";

          //Select button checkbox
          const selectBtn = document.createElement("button");
          selectBtn.classList.add("select-dayTask");
          selectBtn.title = "Select task";
          selectBtn.style.cursor = "pointer";

          selectBtn.innerHTML = `<span class="material-symbols-outlined " id="check_box">check_box_outline_blank</span>`;


          // event-content with task title and colored left border
          const content = document.createElement("div");
          content.className = "event-content";
          if (color) content.style.borderLeft = `5px solid ${color}`;

          const title = document.createElement("span");
          title.className = "event-title";
          title.textContent = task || "No Title";

          // Arrow buttons on right
          const arrowUp = document.createElement("button");
          arrowUp.innerHTML = `<span class="material-symbols-outlined" id="arrows-popup">first_page</span>`;
          arrowUp.title = "Add task above";
          arrowUp.style.cursor = "pointer";
          arrowUp.classList.add("arrow-up-dayTask");

          const arrowDown = document.createElement("button");
          arrowDown.innerHTML = `<span class="material-symbols-outlined"id="arrows-popup">first_page</span>`;
          arrowDown.classList.add("arrow-down-dayTask");
          arrowDown.title = "Add task below";
          arrowDown.style.cursor = "pointer";

          // Append title inside content
          content.appendChild(title);

          // Append all inside eventDiv
          // eventDiv.appendChild(deleteBtn);
          eventDiv.appendChild(selectBtn);

          eventDiv.appendChild(content);
          eventDiv.appendChild(arrowUp);
          eventDiv.appendChild(arrowDown);

          title.addEventListener("blur", () => {
            title.contentEditable = "false";
            // Remove outline from .event parent
            const eventDiv = title.closest('.event');
            if (eventDiv) {
              eventDiv.style.outline = 'none';
              eventDiv.style.border = "1px solid #ccc";
            }
          });

          section.appendChild(eventDiv);
        });
      } else {
        const noTask = document.createElement("p");
        noTask.className = "no-tasks-text";
        noTask.textContent = `Click to add new task for  ${period}`;

        noTask.style.cursor = "pointer";
        noTask.title = "Click to add a new task";

        noTask.addEventListener("click", () => {
          const currentState = saveTaskOrderToTemp(); // Get fresh snapshot of current tasks
          undoStack.push(currentState);
          redoStack.length = 0; // clear redo stack because new action happened
          // const clickToAddNewTaskParagraph = section.querySelector()
          // existingNoTask.remove();
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
            newEvent.stylel.border = "2px solid #00aaff";
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
      }

      popupTasks.appendChild(section);
    });
  }
  showPopup();
}


function blurCurrentlyEditing() {
  const editingTitle = popupTasks.querySelector(".event-title[contenteditable='true']");
  if (editingTitle) {
    editingTitle.contentEditable = "false";
    const eventDiv = editingTitle.closest(".event");
    if (eventDiv){
      eventDiv.style.outline = 'none';
       eventDiv.style.border = "1px solid #ccc";
    }
    editingTitle.blur();
  }
}

function autoFocusEventTitle(eventDiv) {
  const title = eventDiv.querySelector(".event-title");
  if (!title) return;

  title.contentEditable = "true";
  eventDiv.style.border = "2px solid #00aaff";
  title.focus();

  const range = document.createRange();
  range.selectNodeContents(title);

  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}


// Delegate clicks inside popupTasks
const handlePopupClick = (e) => {

  if (!isEditing) return;
  const target = e.target;

  // Title clicked?
  const title = target.closest(".event-title");
  if (title && popupTasks.contains(title)) {
    e.stopPropagation();
    e.preventDefault();

    const eventDiv = title.closest(".event");

    // First click → make editable + select all
    if (title.contentEditable !== "true") {
      title.contentEditable = "true";
      if (eventDiv) {
        eventDiv.style.border = "2px solid #00aaff";
      }
      title.focus();

      // Select all text
      const range = document.createRange();
      range.selectNodeContents(title);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

    } else {
      // Already editable → place caret at click position
      const sel = window.getSelection();
      sel.removeAllRanges();

      const range = document.createRange();

      if (document.caretRangeFromPoint) {
        const caretRange = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (caretRange) {
          range.setStart(caretRange.startContainer, caretRange.startOffset);
        }
      } else if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
        if (pos) {
          range.setStart(pos.offsetNode, pos.offset);
        }
      }

      range.collapse(true);
      sel.addRange(range);
    }

    return;
  }




  // Select button clicked?
  const selectBtn = target.closest(".select-dayTask");
  if (selectBtn && popupTasks.contains(selectBtn)) {

    // Toggle selection on click

    e.stopPropagation();
    e.preventDefault();
    const eventDiv = e.target.closest(".event");

    if (selectBtn.innerHTML.includes("check_box_outline_blank")) {
      selectBtn.innerHTML = `<span class="material-symbols-outlined " id="check_box">check_box</span>`;
      eventDiv.classList.add("selected-task-popup");
    } else {
      selectBtn.innerHTML = `<span class="material-symbols-outlined " id="check_box">check_box_outline_blank</span>`;
      eventDiv.classList.remove("selected-task-popup");
    }


    return;


  }

  // Arrow Up button clicked?
  const arrowUp = target.closest(".arrow-up-dayTask");
  if (arrowUp && popupTasks.contains(arrowUp)) {

    const currentState = saveTaskOrderToTemp(); // Get fresh snapshot of current tasks
    undoStack.push(currentState);
    redoStack.length = 0;
    e.stopPropagation();
    e.preventDefault();

    console.log("trieggerred CREATEEVENTELEMENT");

    const currentEvent = e.target.closest(".event");
    const period = currentEvent.querySelector(".event-title").dataset.period;

    // Create a new event element (new task)
    const newEvent = createEventElement({
      task: "No Title",
      color: chosenColor,
      period: period,
      index: null, // index can be updated later if needed
      isSelected: false,
    });


    // Insert new event before the current event
    currentEvent.parentNode.insertBefore(newEvent, currentEvent);
    console.log("inserting");
    renderAppropriateStyle();
    blurCurrentlyEditing();
    autoFocusEventTitle(newEvent);

    return;

  }

  // Arrow Down button clicked?
  const arrowDown = target.closest(".arrow-down-dayTask");
  if (arrowDown && popupTasks.contains(arrowDown)) {

    const currentState = saveTaskOrderToTemp(); // Get fresh snapshot of current tasks
    undoStack.push(currentState);
    redoStack.length = 0;

    e.stopPropagation();
    e.preventDefault();

    const currentEvent = e.target.closest(".event");
    const period = currentEvent.querySelector(".event-title").dataset.period;

    const newEvent = createEventElement({
      task: "No Title",
      color: chosenColor,
      period: period,
      index: null,
      isSelected: false,
    });

    // Insert new event after the current event
    if (currentEvent.nextSibling) {
      currentEvent.parentNode.insertBefore(newEvent, currentEvent.nextSibling);
    } else {
      currentEvent.parentNode.appendChild(newEvent);
    }
    renderAppropriateStyle();
    blurCurrentlyEditing();
    autoFocusEventTitle(newEvent);

    return;
  }



}

function createEventElement({ task = "No Title", color = "#007bff", period, index, isSelected = false }) {
  const eventDiv = document.createElement("div");
  eventDiv.className = "event";

  // Select button
  const selectBtn = document.createElement("button");
  selectBtn.classList.add("select-dayTask");
  selectBtn.title = "Select task";
  selectBtn.style.cursor = "pointer";
  selectBtn.innerHTML = isSelected
    ? `<span class="material-symbols-outlined " id="check_box">check_box</span>`
    : `<span class="material-symbols-outlined " id="check_box">check_box_outline_blank</span>`;
  if (isSelected) eventDiv.classList.add("selected-task-popup");

  // Task content with colored left border
  const content = document.createElement("div");
  content.className = "event-content";
  if (color) content.style.borderLeft = `5px solid ${color}`;

  const title = document.createElement("span");
  title.className = "event-title";
  title.textContent = task;

  content.appendChild(title);


  title.addEventListener("blur", function onBlur() {
    console.log("blurred");
    title.contentEditable = "false";
     eventDiv.style.border = "1px solid #ccc";
    eventDiv.style.border = "1px solid #ccc";
    // title.removeEventListener("blur", onBlur);
  });


  // Arrow Up button
  const arrowUp = document.createElement("button");
  arrowUp.innerHTML = `<span class="material-symbols-outlined"id="arrows-popup">first_page</span>`;
  arrowUp.title = "Add task above";
  arrowUp.style.cursor = "pointer";
  arrowUp.classList.add("arrow-up-dayTask");

  // Arrow Down button
  const arrowDown = document.createElement("button");
  arrowDown.innerHTML = `<span class="material-symbols-outlined"id="arrows-popup">first_page</span>`;
  arrowDown.title = "Add task below";
  arrowDown.style.cursor = "pointer";
  arrowDown.classList.add("arrow-down-dayTask");

  // Append buttons and content to eventDiv
  eventDiv.appendChild(selectBtn);
  eventDiv.appendChild(content);
  eventDiv.appendChild(arrowUp);
  eventDiv.appendChild(arrowDown);

  // Store period and index for reference (optional)
  title.dataset.period = period;
  title.dataset.index = index;

  return eventDiv;
}

popupTasks.addEventListener("click", handlePopupClick);

function renderAppropriateStyle() {
  if (isEditing) {
    document.querySelectorAll(".event-content").forEach(el => {
      el.style.marginLeft = "0";
      el.style.marginRight = "0";
    });

    document.querySelectorAll(".delete-dayTask, .arrow-up-dayTask, .arrow-down-dayTask").forEach(el => {
      el.style.display = "inline-flex";
    });

    document.querySelectorAll(".event").forEach(el => {
      el.style.border = "1px solid #ccc";
      el.style.borderRadius = "2px";
    });
  }
}


document.getElementById("delete-btn-popup").addEventListener("click", () => {

  const currentState = saveTaskOrderToTemp(); // Get fresh snapshot of current tasks

  undoStack.push(currentState);
  redoStack.length = 0; // clear redo stack because new action happened

  // Select all .event elements that are selected (have class .selected-task-popup)
  const selectedEvents = document.querySelectorAll("#popup-tasks .event.selected-task-popup");

  if (selectedEvents.length === 0) {
    alert("No tasks selected to delete.");
    return;
  }

  selectedEvents.forEach(eventDiv => {
    // Remove from DOM
    eventDiv.remove();

    // TODO: Also remove from your data model (like dayTasksForEdit) here if applicable
    // For example, find the period and index from eventDiv and update your data accordingly
  });

  // Optionally, re-render or update your UI after deletion
  // For example, if you keep dayTasksForEdit updated, call your showDayTasksEditable() here

  cleanUpNoTasksText();

});


// === CLOSE FUNCITONALITY FOR POP UP
document.getElementById("closePopupBtn").addEventListener("click", () => {
  hidePopup();

  const main = document.getElementById('main-container');

  if (getComputedStyle(main).display === "block") {
    // It's flex, run your function
    showHorViewBtn.click();
  } else {
    showVertViewBtn.click();
  }
});

document.getElementById("backdrop").addEventListener("click", () => {
  hidePopup();

  const main = document.getElementById('main-container');

  if (getComputedStyle(main).display === "block") {
    // It's flex, run your function
    showHorViewBtn.click();
  } else {
    showVertViewBtn.click();
  }

});


function showPopup() {

  const popup = document.getElementById("calendar-pop-up");
  const backdrop = document.getElementById("backdrop");
  backdrop.style.display = "block";
  popup.style.display = "flex";
}

function hidePopup() {
  if (isEditing && undoStack.length > 0) {
    if (confirm("Do you want to save changes?")) {
      document.getElementById("toggle-edit").click();
    }
  }

  if (isEditing) {
    const normalButtons = document.querySelectorAll('.normal-mode');
    const editButtons = document.querySelectorAll('.edit-mode');

    normalButtons.forEach(btn => btn.classList.remove('hidden'));
    editButtons.forEach(btn => btn.classList.add('hidden'));
  }

  restoreColorOptions();

  undoStack.length = 0;
  redoStack.length = 0;




  const popup = document.getElementById("calendar-pop-up");
  const backdrop = document.getElementById("backdrop");
  backdrop.style.display = "none";
  popup.style.display = "none";
  removeDragListeners();

  isEditing = false;

  const icon = toggleEditBtn.querySelector('.material-symbols-outlined');
  const label = toggleEditBtn.querySelector('.calendar-icon-label');
  icon.textContent = 'edit_note';
  icon.style.color = '';
  label.textContent = 'Edit';
  label.style.color = '';
}




// ==============EDIT BUTTON remove this its above

// const editBtn = document.getElementById("edit-btn-dailytask");

// editBtn.addEventListener('click', () => {

// });


document.getElementById("copy-tasks-btn").addEventListener("click", () => {
  copyTasksForDate(popUpDate);
});



function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.opacity = 1;

  setTimeout(() => {
    toast.style.opacity = 0;
  }, 2000); // Toast stays visible for 2 seconds
}


function copyTasksForDate(dateKey) {
  const allTasks = JSON.parse(localStorage.getItem("tasks"));
  const data = allTasks?.[dateKey];

  if (!data) {
    showToast("No tasks found for this date.");
    console.log("Missing dateKey in tasks:", dateKey);
    return;
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  const dateObj = new Date(year, month, day);
  const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });

  let output = `${dayName}\n`;
  const periods = ['morning', 'afternoon', 'evening'];
  let taskFound = false;

  periods.forEach(period => {
    const tasks = data[period];
    if (Array.isArray(tasks)) {
      tasks.forEach(taskObj => {
        const name = taskObj.task?.trim();
        if (name && name.toLowerCase() !== "invalid date") {
          output += `- ${name}\n`;
          taskFound = true;
        }
      });
    }
  });

  if (!taskFound) {
    showToast("No valid tasks to copy.");
    return;
  }

  navigator.clipboard.writeText(output)
    // .then(() => showToast("Tasks copied!"))
    .then()
    .catch(err => showToast("Failed to copy!"));
}


let originalColorOptionsParent = null;
let originalColorOptionsNextSibling = null;


function moveColorOptionsToPopup() {
  const colorOptions = document.querySelector(".color-button-options");
  if (!colorOptions) return;

  if (!originalColorOptionsParent) {
    originalColorOptionsParent = colorOptions.parentElement;
    originalColorOptionsNextSibling = colorOptions.nextElementSibling;
  }

  const popup = document.getElementById("calendar-pop-up");
  const nav = popup.querySelector(".pop-up-calview-navi");

  if (nav) {
    nav.parentElement.insertBefore(colorOptions, nav);

    const colorPickerContainer = colorOptions.querySelector(".color-picker");
    colorPickerContainer.style.borderRadius = "10px";
    colorOptions.style.transform = "scale(0.87)";
    colorOptions.style.width = "100%";


    if (!lineDivider) {
      lineDivider = document.createElement("div");
      lineDivider.style.height = "1px";
      lineDivider.style.backgroundColor = "#ccc";
      lineDivider.style.width = "100%";
      lineDivider.style.marginTop = "5px";
    }

    // Insert divider before colorOptions if it's not already there
    if (!lineDivider.parentElement) {
      nav.parentElement.insertBefore(lineDivider, colorOptions);
    }
  }
}

function restoreColorOptions() {
  const colorOptions = document.querySelector(".color-button-options");
  if (!colorOptions || !originalColorOptionsParent) return;

  // Remove divider if present
  if (lineDivider && lineDivider.parentElement) {
    lineDivider.parentElement.removeChild(lineDivider);
  }

  if (originalColorOptionsNextSibling) {
    originalColorOptionsParent.insertBefore(colorOptions, originalColorOptionsNextSibling);
  } else {
    originalColorOptionsParent.appendChild(colorOptions);
  }

  // Reset styles
  const colorPickerContainer = colorOptions.querySelector(".color-picker");
  colorPickerContainer.style.borderRadius = "";
  colorOptions.style.transform = "";
  colorOptions.style.width = "";
}


