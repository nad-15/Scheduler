
// Call initially and on resize
adjustCalendarHeight();
window.addEventListener('resize', adjustCalendarHeight);

yearContainer.addEventListener('click', (e) => {
  const dateEl = e.target.closest('.date');
  const dayEl = e.target.closest('.day');

  let fullDate = null;

  if (dateEl) {
    fullDate = dateEl.dataset.fullDate;
  } else if (dayEl) {
    // Find sibling .date (assumes .day and .date share a common parent)
    const siblingDateEl = dayEl.parentElement.querySelector('.date');
    if (siblingDateEl) {
      fullDate = siblingDateEl.dataset.fullDate;
    }
  }

  if (fullDate) {
    // console.log("DATE IS CLICKED:", fullDate);
    showDayTasks(fullDate);
  }
});


todayScroll();

function todayScroll() {

  const todayDateObj = new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' });
  const nowTodayElement = new Date(todayDateObj);

  const yearTodayElement = nowTodayElement.getFullYear();
  const monthTodayElement = nowTodayElement.getMonth();
  const dayTodayElement = nowTodayElement.getDate();

  const todayDate = `${yearTodayElement}-${monthTodayElement}-${dayTodayElement}`;

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
            // No text and no color
            content.style.borderLeft = "none";
            content.classList.add("no-tasks-for-this-period");
            // title.textContent = "No Task";
            title.textContent = "No tasks for this period.";
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

  // document.getElementById("calendar-pop-up").style.display = "block";
  // document.getElementById("backdrop").style.display = "block";
  showPopup();
}




// === CLOSE FUNCITONALITY FOR POP UP
document.getElementById("closePopupBtn").addEventListener("click", () => {
  hidePopup();
});

document.getElementById("backdrop").addEventListener("click", () => {
  hidePopup();
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
  clearFallingLeaves();
}




// ==============EDIT BUTTON

const editBtn = document.getElementById("edit-btn-dailytask");


editBtn.addEventListener('click', ()=>{

});
  