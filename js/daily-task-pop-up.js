
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

  const icon = toggleBtn.querySelector('.material-symbols-outlined');
  const label = toggleBtn.querySelector('.calendar-icon-label');
  icon.textContent = 'note_alt';
  icon.style.color = '';
  label.textContent = 'Rearrange';
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

