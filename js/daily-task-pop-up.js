
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



const todayDateObjScroll = new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' });
const nowTodayElementScroll = new Date(todayDateObjScroll);

const yearTodayElementScroll = nowTodayElementScroll.getFullYear();
const monthTodayElementScroll = nowTodayElementScroll.getMonth();
const dayTodayElementScroll = nowTodayElementScroll.getDate();

const todayDateScroll = `${yearTodayElementScroll}-${monthTodayElementScroll}-${dayTodayElementScroll}`;

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

  if (!dayTasks) {
    const noTask = document.createElement("p");
    noTask.textContent = "No tasks for this day.";
    // noTask.className = "no-tasks-text"; 
    popupTasks.appendChild(noTask);
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
  // popUpDate = date;
  if (!date) return;

  // Use the copied tasks instead of fetching from localStorage
  const dayTasks = dayTasksForEdit;
  // console.log(dayTasks);

  // Fix date padding for JS Date
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
    const shortWeekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const shortDate = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    bottomLine = `${shortWeekday}, ${shortDate}`;
  } else {
    label = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    bottomLine = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  document.getElementById("popup-date").innerHTML = `
    <div class="weekday">${label}</div>
    <div class="month-year">${bottomLine}</div>
  `;

  const popupTasks = document.getElementById("popup-tasks");
  popupTasks.innerHTML = "";

  if (!dayTasks) {
    const noTask = document.createElement("p");
    noTask.textContent = "No tasks for this day.";
    popupTasks.appendChild(noTask);
  } else {
    const periods = ["morning", "afternoon", "evening"];
    let currentlyEditing = null;

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

          // Delete button on left
          const deleteBtn = document.createElement("button");
          deleteBtn.classList.add("delete-dayTask");
          deleteBtn.title = "Delete task";
          deleteBtn.style.cursor = "pointer";
          deleteBtn.innerHTML = `<span class="material-symbols-outlined">delete_forever</span>`;

          // event-content with task title and colored left border
          const content = document.createElement("div");
          content.className = "event-content";
          if (color) content.style.borderLeft = `5px solid ${color}`;

          const title = document.createElement("span");
          title.className = "event-title";
          title.textContent = task || "No Title";

          // Arrow buttons on right
          const arrowUp = document.createElement("button");
          arrowUp.innerHTML = `<span class="material-symbols-outlined">
keyboard_arrow_up
</span>`;
          arrowUp.title = "Add task above";
          arrowUp.style.cursor = "pointer";
          arrowUp.classList.add("arrow-up-dayTask");

          const arrowDown = document.createElement("button");
          arrowDown.innerHTML = `<span class="material-symbols-outlined">
keyboard_arrow_down
</span>`;
          arrowDown.classList.add("arrow-down-dayTask");
          arrowDown.title = "Add task below";
          arrowDown.style.cursor = "pointer";

          // Append title inside content
          content.appendChild(title);

          // Append all inside eventDiv
          eventDiv.appendChild(deleteBtn);
          eventDiv.appendChild(content);
          eventDiv.appendChild(arrowUp);
          eventDiv.appendChild(arrowDown);

          // DELETE button logic updates dayTasksForEdit
          deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (dayTasksForEdit && dayTasksForEdit[period]) {
              dayTasksForEdit[period].splice(index, 1);
              // Rerender with updated data
              showDayTasksEditable(date);
            }
          });

          // Save current task before insertion (on arrow clicks)
          function saveCurrentTask() {
            if (title.isContentEditable) {
              const newText = title.textContent.trim();
              if (dayTasksForEdit && dayTasksForEdit[period] && dayTasksForEdit[period][index]) {
                dayTasksForEdit[period][index].task = newText;
              }
            }
          }

          arrowUp.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            saveCurrentTask();

            if (!dayTasksForEdit[period]) dayTasksForEdit[period] = [];
            dayTasksForEdit[period].splice(index, 0, { task: "No Title", color: "#007bff" });

            showDayTasksEditable(date, { period, index });
          });

          arrowDown.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            saveCurrentTask();

            if (!dayTasksForEdit[period]) dayTasksForEdit[period] = [];
            dayTasksForEdit[period].splice(index + 1, 0, { task: "No Title", color: "#007bff" });

            showDayTasksEditable(date, { period, index: index + 1 });
          });

          title.addEventListener("click", () => {
            // Remove outline from previously editing title's parent if any
            if (currentlyEditing && currentlyEditing !== title) {
              const prevEventDiv = currentlyEditing.closest('.event');
              if (prevEventDiv) {
                prevEventDiv.style.outline = 'none';
              }
              currentlyEditing.contentEditable = "false";
            }

            // Add outline to current .event parent
            const eventDiv = title.closest('.event');
            if (eventDiv) {
              eventDiv.style.outline = '2px solid #00aaff';
            }

            currentlyEditing = title;
            title.contentEditable = "true";
            title.focus();

            // Select all text inside the title for highlight
            const range = document.createRange();
            range.selectNodeContents(title);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          });

          title.addEventListener("blur", () => {
            title.contentEditable = "false";

            // Remove outline from .event parent
            const eventDiv = title.closest('.event');
            if (eventDiv) {
              eventDiv.style.outline = 'none';
            }

            currentlyEditing = null;
          });



          // Store period and index on title for saving on switching edits
          title.dataset.period = period;
          title.dataset.index = index;

          section.appendChild(eventDiv);
        });
      } else {
        const noTask = document.createElement("p");
        noTask.className = "no-tasks-text";
        noTask.textContent = `Click to add new task for  ${period}`;

        noTask.style.cursor = "pointer";
        noTask.title = "Click to add a new task";

        noTask.addEventListener("click", () => {
          if (!dayTasksForEdit[period]) dayTasksForEdit[period] = [];

          dayTasksForEdit[period].push({ task: "No Title", color: "#007bff" });

          showDayTasksEditable(date, { period, index: dayTasksForEdit[period].length - 1 });
        });

        section.appendChild(noTask);
      }

      popupTasks.appendChild(section);
    });
  }

// Focus newly created task if requested
if (focusInfo) {
  setTimeout(() => {
    const sections = document.querySelectorAll(".period-section");
    let targetSection = null;
    sections.forEach(section => {
      const divider = section.querySelector(".section-divider");
      if (divider && divider.textContent.toLowerCase() === focusInfo.period) {
        targetSection = section;
      }
    });

    if (targetSection) {
      const titles = targetSection.querySelectorAll(".event-title");
      if (titles[focusInfo.index]) {
        const title = titles[focusInfo.index];
        const eventDiv = title.closest('.event');

        // Remove outline from any previously editing event
        document.querySelectorAll('.event').forEach(ev => ev.style.outline = 'none');

        // Add outline to newly focused event
        if (eventDiv) {
          eventDiv.style.outline = '2px solid #00aaff';
        }

        title.contentEditable = "true";
        title.focus();

        // Select all text inside title
        const range = document.createRange();
        range.selectNodeContents(title);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }, 0);
}



  // Show editing UI styles
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
      el.style.borderRadius = "5px";
    });
  }

  showPopup();
}




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

