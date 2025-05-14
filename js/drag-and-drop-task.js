
// yearContainer.addEventListener('click', (e) => {
//     const day = e.target.closest('.day');
//     const date = e.target.closest('.date');
    
//     if (day && !yearContainer.classList.contains('hide-days')) {
//         // If .day is visible, toggle visibility of .date
//         if (!yearContainer.classList.contains('hide-dates')) {
//             yearContainer.classList.add('hide-dates');
//             console.log('day click - hide date');
//         } else {
//             yearContainer.classList.remove('hide-dates');
//             console.log('day click - show date');
//         }
//     }
    
//     if (date && !yearContainer.classList.contains('hide-dates')) {
//         // If .date is visible, toggle visibility of .day
//         if (!yearContainer.classList.contains('hide-days')) {
//             yearContainer.classList.add('hide-days');
//             console.log('date click - hide day');
//         } else {
//             yearContainer.classList.remove('hide-days');
//             console.log('date click - show day');
//         }
//     }
// });

// Call initially and on resize
adjustCalendarHeight();
window.addEventListener('resize', adjustCalendarHeight);

yearContainer.addEventListener('click', (e) => {
  const dateEl = e.target.closest('.date');
  if (dateEl) {
    const fullDate = dateEl.dataset.fullDate;
    console.log("DATE IS CLICKED:", fullDate);
    showDayTasks(e);
  }
});



todayScroll();
function todayScroll() {
    const nowTodayElement = new Date();
  
    const yearTodayElement = nowTodayElement.getFullYear();
    const monthTodayElement = nowTodayElement.getMonth();
    const dayTodayElement = nowTodayElement.getDate();
  
    const todayDate = `${yearTodayElement}-${monthTodayElement}-${dayTodayElement}`;
  
    console.log('Built todayDate:', todayDate);
  
    const todayElement = document.querySelector(`.date[data-full-date="${todayDate}"]`);
    console.log('Found todayElement:', todayElement);
  
    if (todayElement) {
      console.log("ENTERED todayElement");
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





  function showDayTasks(e) {
  const target = e.target.closest('[data-full-date]');
  if (!target) return;

  const date = target.dataset.fullDate;
  if (!date) return;

    const storedTasks = JSON.parse(localStorage.getItem("tasks")) || {};
    const dayTasks = storedTasks[date];

    const dateObj = new Date(date);
    dateObj.setMonth(dateObj.getMonth() + 1); // Add 1 to the month

    const readable = dateObj.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    document.getElementById("popup-date").textContent = readable;

    const popupTasks = document.getElementById("popup-tasks");
    popupTasks.innerHTML = "";

    if (!dayTasks) {
      const noTask = document.createElement("p");
      noTask.textContent = "No tasks for this day.";
      popupTasks.appendChild(noTask);
    } else {
      const periods = ["morning", "afternoon", "evening"];

      periods.forEach(period => {
        const section = document.createElement("div");
        section.classList.add("period-section");

        // const heading = document.createElement("h3");
        // heading.textContent = period.charAt(0).toUpperCase() + period.slice(1);
        // section.appendChild(heading);

        // const dashedLine = document.createElement("hr");
        // dashedLine.classList.add("dashed-line");
        // section.appendChild(dashedLine);

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
      title.textContent = "No Task";
    }

    content.appendChild(title);
    eventDiv.appendChild(content);
    section.appendChild(eventDiv);
  });
}
else {
          const noTask = document.createElement("p");
          noTask.className = "no-tasks-text";
          noTask.textContent = "No tasks for this period.";
          section.appendChild(noTask);
        }

        popupTasks.appendChild(section);
      });
    }

    document.getElementById("calendar-pop-up").style.display = "block";
    document.getElementById("backdrop").style.display = "block";
  }



  
  // === CLOSE FUNCITONALITY FOR POP UP
  document.getElementById("closePopupBtn").addEventListener("click", () => {
    document.getElementById("calendar-pop-up").style.display = "none";
    document.getElementById("backdrop").style.display = "none";
  });

  document.getElementById("backdrop").addEventListener("click", () => {
    document.getElementById("calendar-pop-up").style.display = "none";
    document.getElementById("backdrop").style.display = "none";
  });


// let isDraggingTask = false;
// let startX, startY;
// let touchStartTime;
// let draggedItem, shadowElement;
// let scrollable = `true`;
// let highlightedTarget = null; // Track the currently highlighted target
// let touchTimer = null; // Variable to store the timeout ID

// const dragButton = document.querySelector(`.drag-button`);



// yearContainer.addEventListener('touchstart', (e) => {


//     draggedItem = e.target.closest('.morningTask, .afternoonTask, .eveningTask');


//     if (draggedItem && scrollable === 'true') {
//         console.log(`touch start goes through triggered at ${draggedItem.classList}`);


//         // Start the timer for 1 second hold
//         touchTimer = setTimeout(() => {
//             yearContainer.style.overflow = "hidden";
//             document.body.style.overflow = 'hidden'; // Prevent page scrolling
//             console.log(document.body.style.overflow );
//             console.log(`yearContainer is NOT scrollable`);

//             // Trigger drag logic only after 1 second
           

//             if (!draggedItem) return;

//             isDraggingTask = false;
//             touchStartTime = Date.now();
//             startX = e.touches[0].pageX;
//             startY = e.touches[0].pageY;

//             // Clone the dragged item
//             shadowElement = draggedItem.cloneNode(true);
//             shadowElement.style.position = "fixed";
//             shadowElement.style.opacity = "0.5"; // Adjust opacity for shadow
//             shadowElement.style.pointerEvents = "none";
//             shadowElement.style.zIndex = "1000";

//             document.body.appendChild(shadowElement);

//             // Apply a darkened overlay effect on the dragged item
//             draggedItem.style.transition = "opacity 0.3s ease"; // Smooth opacity change
//             draggedItem.style.opacity = "0.7"; // Darken the dragged item slightly

//             // Ensure correct positioning AFTER it has been rendered
//             requestAnimationFrame(() => {
//                 const rect = draggedItem.getBoundingClientRect();

//                 shadowElement.style.height = `${rect.height}px`;
//                 shadowElement.style.width = `${rect.width}px`;

//                 shadowElement.style.left = `${startX - shadowElement.offsetWidth / 2}px`;
//                 shadowElement.style.top = `${startY - shadowElement.offsetHeight / 2 - 40}px`;

//                 // Add border highlight to the dragged item
//                 draggedItem.style.border = "3px dashed #007bff"; // Highlight dragged item with dashed blue border
//             });

//             // Set scrollable to false after 1 second
//             scrollable = `false`;
//             dragButton.innerHTML = `Drag<br>ON`;

//         }, 2000); // Trigger after 2 second
//     }

//     console.log(`touchstart is out`);
// });

// yearContainer.addEventListener('touchmove', (e) => {
//     if (scrollable === `false`) {
//         if (!draggedItem) return;

//         const deltaX = e.touches[0].pageX - startX;
//         const deltaY = e.touches[0].pageY - startY;

//         if (!isDraggingTask && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
//             isDraggingTask = true;
//         }

//         if (isDraggingTask) {
//             // Move shadow slightly above the finger (40px)
//             shadowElement.style.left = `${e.touches[0].pageX - shadowElement.offsetWidth / 2}px`;
//             shadowElement.style.top = `${e.touches[0].pageY - shadowElement.offsetHeight / 2 - 40}px`;

//             // Highlight the target item
//             const targetTaskDiv = document.elementFromPoint(
//                 e.changedTouches[0].pageX,
//                 e.changedTouches[0].pageY - 40
//             )?.closest('.morningTask, .afternoonTask, .eveningTask');

//             // If the touch is outside the valid target divs, cancel the highlight
//             if (!targetTaskDiv) {
//                 if (highlightedTarget) {
//                     highlightedTarget.style.border = "";
//                     highlightedTarget = null;
//                 }
//             }

//             // Only highlight a valid target
//             if (targetTaskDiv && targetTaskDiv !== draggedItem) {
//                 // If the target is different, remove highlight from the previous target
//                 if (highlightedTarget && highlightedTarget !== targetTaskDiv) {
//                     highlightedTarget.style.border = "";
//                 }

//                 // Apply the border image gradient highlight
//                 targetTaskDiv.style.border = "2px solid transparent"; // Create space for border
//                 targetTaskDiv.style.borderImage = "linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet) 1";

//                 highlightedTarget = targetTaskDiv; // Update the highlighted target
//             }

//             // e.preventDefault();
//         }
//     }
// });

// yearContainer.addEventListener('touchend', (e) => {
//     // Clear the touch timer if the user ends the touch before 1 second
//     clearTimeout(touchTimer);

//     if (scrollable === `false`) {

//         try {
//             // Reset opacity and remove highlight from the dragged item
//             draggedItem.style.opacity = "1"; // Restore original opacity
//             draggedItem.style.border = "";

//             // If there is a highlighted target, proceed with the swap or reset
//             if (highlightedTarget) {
//                 // If the dragged item is dropped on the target, swap styles and content
//                 if (highlightedTarget !== draggedItem) {


//                     //set properties to be saved for draggedItem
//                     const dayContainerOfDraggedItem = draggedItem.closest('.day-container');
//                     const dateOfDraggedItem = dayContainerOfDraggedItem.querySelector('.date').getAttribute('data-full-date');
//                     const taskTypeOfDraggedItem = draggedItem.classList.contains('morningTask') ? 'morning' :
//                         draggedItem.classList.contains('afternoonTask') ? 'afternoon' : 'evening';
//                     const taskTextOfDraggedItem = draggedItem.textContent;
//                     const taskColorOfDraggedItem = rgbToHex(draggedItem.style.backgroundColor);

//                     //set properties to be saved for targeItem
//                     const dayContainerOfTargetItem = highlightedTarget.closest('.day-container');
//                     const dateOfTargetItem = dayContainerOfTargetItem.querySelector('.date').getAttribute('data-full-date');
//                     const taskTypeOfTargetItem = highlightedTarget.classList.contains('morningTask') ? 'morning' :
//                         highlightedTarget.classList.contains('afternoonTask') ? 'afternoon' : 'evening';
//                     const taskTextOfTargetItem = highlightedTarget.textContent;
//                     const taskColorOfTargetItem = rgbToHex(highlightedTarget.style.backgroundColor);

//                     // Save the dragged item data
                
//                     saveTaskData(dateOfDraggedItem, taskTypeOfDraggedItem, taskTextOfTargetItem, taskColorOfTargetItem);

//                     // Save the target item data
//                     saveTaskData(dateOfTargetItem, taskTypeOfTargetItem, taskTextOfDraggedItem, taskColorOfDraggedItem);


//                     [draggedItem.style.backgroundColor, highlightedTarget.style.backgroundColor] =
//                         [highlightedTarget.style.backgroundColor, draggedItem.style.backgroundColor];

//                     [draggedItem.textContent, highlightedTarget.textContent] =
//                         [highlightedTarget.textContent, draggedItem.textContent];
//                 }

//                 // Remove the target highlight border
//                 highlightedTarget.style.border = "";
//                 highlightedTarget = null; // Reset the highlighted target
//             }

//         } finally {

//             if (shadowElement && shadowElement.parentNode) {
//                 document.body.removeChild(shadowElement);
//             }

//             isDraggingTask = false;

//             // Reset scrollable to true after touch ends
//             scrollable = `true`;
//             yearContainer.style.overflow = "scroll";
    
//             document.body.style.overflow = '';
//             dragButton.innerHTML = `Drag<br>OFF`;
//             console.log(`year container is scrollable`);
//             console.log(document.body.style.overflow );

//         }
//     }
// });
