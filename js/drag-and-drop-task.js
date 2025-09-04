
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


///MAYBE A BETTER VERSION OF SHOWDAYTASKEDIT
// function showDayTasksEditable(date, focusInfo = null) {
//   if (!date) return;

//   const popupTasks = document.getElementById("popup-tasks");
//   popupTasks.innerHTML = "";

//   const dayTasks = dayTasksForEdit; // Use copied tasks

//   if (!dayTasks) return;

//   const periods = ["morning", "afternoon", "evening"];
//   let currentlyEditing = null;

//   // Helper: Create task DOM element with all controls and behavior
//   function createTaskElement(period, taskObj, index) {
//     const { task, color, selected } = taskObj;

//     const eventDiv = document.createElement("div");
//     eventDiv.className = "event";

//     // Select button
//     const selectBtn = document.createElement("button");
//     selectBtn.classList.add("select-dayTask");
//     selectBtn.title = "Select task";
//     selectBtn.style.cursor = "pointer";

//     // Set initial selection state based on taskObj.selected
//     updateSelectButton(selectBtn, eventDiv, selected);

//     selectBtn.addEventListener("click", e => {
//       e.stopPropagation();
//       e.preventDefault();

//       taskObj.selected = !taskObj.selected;
//       updateSelectButton(selectBtn, eventDiv, taskObj.selected);
//     });

//     // Event content with task title and colored left border
//     const content = document.createElement("div");
//     content.className = "event-content";
//     if (color) content.style.borderLeft = `5px solid ${color}`;

//     const title = document.createElement("span");
//     title.className = "event-title";
//     title.textContent = task || "No Title";

//     // Arrow buttons
//     const arrowUp = createArrowButton("keyboard_arrow_up", "Add task above");
//     const arrowDown = createArrowButton("keyboard_arrow_down", "Add task below");

//     // Append elements
//     content.appendChild(title);
//     eventDiv.appendChild(selectBtn);
//     eventDiv.appendChild(content);
//     eventDiv.appendChild(arrowUp);
//     eventDiv.appendChild(arrowDown);

//     // Save current task text before inserting new tasks
//     function saveCurrentTask() {
//       if (title.isContentEditable) {
//         const newText = title.textContent.trim();
//         if (dayTasksForEdit && dayTasksForEdit[period] && dayTasksForEdit[period][index]) {
//           dayTasksForEdit[period][index].task = newText;
//         }
//       }
//     }

//     arrowUp.addEventListener("click", e => {
//       e.stopPropagation();
//       e.preventDefault();
//       saveCurrentTask();

//       if (!dayTasksForEdit[period]) dayTasksForEdit[period] = [];
//       dayTasksForEdit[period].splice(index, 0, { task: "No Title", color: "#007bff", selected: false });

//       showDayTasksEditable(date, { period, index });
//     });

//     arrowDown.addEventListener("click", e => {
//       e.stopPropagation();
//       e.preventDefault();
//       saveCurrentTask();

//       if (!dayTasksForEdit[period]) dayTasksForEdit[period] = [];
//       dayTasksForEdit[period].splice(index + 1, 0, { task: "No Title", color: "#007bff", selected: false });

//       showDayTasksEditable(date, { period, index: index + 1 });
//     });

//     // Title editing behavior
//     title.addEventListener("click", () => {
//       if (currentlyEditing && currentlyEditing !== title) {
//         const prevEventDiv = currentlyEditing.closest('.event');
//         if (prevEventDiv) prevEventDiv.style.outline = 'none';
//         currentlyEditing.contentEditable = "false";
//       }

//       const eventDivParent = title.closest('.event');
//       if (eventDivParent) eventDivParent.style.outline = '2px solid #00aaff';

//       currentlyEditing = title;
//       title.contentEditable = "true";
//       title.focus();

//       const range = document.createRange();
//       range.selectNodeContents(title);
//       const sel = window.getSelection();
//       sel.removeAllRanges();
//       sel.addRange(range);
//     });

//     title.addEventListener("blur", () => {
//       title.contentEditable = "false";
//       const eventDivParent = title.closest('.event');
//       if (eventDivParent) eventDivParent.style.outline = 'none';
//       currentlyEditing = null;
//     });

//     return eventDiv;
//   }

//   // Helper: Update select button UI & eventDiv class based on selection
//   function updateSelectButton(button, eventDiv, isSelected) {
//     if (isSelected) {
//       button.innerHTML = `<span class="material-symbols-outlined">check_box</span>`;
//       eventDiv.classList.add("selected-task-popup");
//     } else {
//       button.innerHTML = `<span class="material-symbols-outlined">check_box_outline_blank</span>`;
//       eventDiv.classList.remove("selected-task-popup");
//     }
//   }

//   // Helper: Create arrow button element with icon & title
//   function createArrowButton(iconName, title) {
//     const btn = document.createElement("button");
//     btn.innerHTML = `<span class="material-symbols-outlined">${iconName}</span>`;
//     btn.title = title;
//     btn.style.cursor = "pointer";
//     btn.classList.add(title.toLowerCase().includes("up") ? "arrow-up-dayTask" : "arrow-down-dayTask");
//     return btn;
//   }

//   // Loop through each period and render tasks
//   periods.forEach(period => {
//     const section = document.createElement("div");
//     section.classList.add("period-section");

//     const divider = document.createElement("div");
//     divider.className = "section-divider";
//     divider.textContent = period.charAt(0).toUpperCase() + period.slice(1);
//     section.appendChild(divider);

//     const periodTasks = dayTasks[period];
//     if (periodTasks && periodTasks.length > 0) {
//       periodTasks.forEach((taskObj, index) => {
//         const eventDiv = createTaskElement(period, taskObj, index);
//         section.appendChild(eventDiv);
//       });
//     } else {
//       // No tasks UI
//       const noTask = document.createElement("p");
//       noTask.className = "no-tasks-text";
//       noTask.textContent = `Click to add new task for ${period}`;
//       noTask.style.cursor = "pointer";
//       noTask.title = "Click to add a new task";
//       noTask.addEventListener("click", () => {
//         if (!dayTasksForEdit[period]) dayTasksForEdit[period] = [];
//         dayTasksForEdit[period].push({ task: "No Title", color: "#007bff", selected: false });
//         showDayTasksEditable(date, { period, index: dayTasksForEdit[period].length - 1 });
//       });
//       section.appendChild(noTask);
//     }

//     popupTasks.appendChild(section);
//   });

//   // Focus newly created task if requested
//   if (focusInfo) {
//     setTimeout(() => {
//       const sections = document.querySelectorAll(".period-section");
//       let targetSection = null;

//       sections.forEach(section => {
//         const divider = section.querySelector(".section-divider");
//         if (divider && divider.textContent.toLowerCase() === focusInfo.period) {
//           targetSection = section;
//         }
//       });

//       if (targetSection) {
//         const titles = targetSection.querySelectorAll(".event-title");
//         if (titles[focusInfo.index]) {
//           const title = titles[focusInfo.index];
//           const eventDiv = title.closest('.event');

//           // Remove outlines from all events first
//           document.querySelectorAll('.event').forEach(ev => ev.style.outline = 'none');

//           if (eventDiv) eventDiv.style.outline = '2px solid #00aaff';

//           title.contentEditable = "true";
//           title.focus();

//           const range = document.createRange();
//           range.selectNodeContents(title);
//           const sel = window.getSelection();
//           sel.removeAllRanges();
//           sel.addRange(range);
//         }
//       }
//     }, 0);
//   }

//   // Show editing UI styles if editing mode active
//   if (isEditing) {
//     document.querySelectorAll(".event-content").forEach(el => {
//       el.style.marginLeft = "0";
//       el.style.marginRight = "0";
//     });

//     document.querySelectorAll(".delete-dayTask, .arrow-up-dayTask, .arrow-down-dayTask").forEach(el => {
//       el.style.display = "inline-flex";
//     });

//     document.querySelectorAll(".event").forEach(el => {
//       el.style.border = "1px solid #ccc";
//       el.style.borderRadius = "5px";
//     });
//   }

//   showPopup();
// }
