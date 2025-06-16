
const taskInput = document.getElementById('taskTitle');
const exitFullscreenBtn = document.getElementById(`exit-flscreen-button`);
const clearButton = document.getElementById('clear-button');
const floatingAddBtn = document.getElementById('floatingAddBtn');
const slidingInputView = document.getElementById('slidingInputView');
const submitTaskBtn = document.getElementById('submitTask');
const hideAllButtons = document.querySelector(`.hide-all-buttons`);
const templateTaskBtn = document.querySelector(`.template-task-btn`);
const movableTemplate = document.getElementById(`movable-template`);
const flower = document.querySelector(`.flower`);
const closeButton = document.querySelector('.btn-close');
const addButton = document.querySelector('.btn-add');
const deleteButton = document.querySelector('.btn-delete');
const deselectTemplateBtn = document.querySelector('.btn-clear');
const todayName = document.getElementById('today-name');
const hideWidgetBtn = document.querySelector(`.hide-widget`);
const selectedTaskCounter = document.querySelector(`.selected-task`);
const jobTemplateContainer = document.querySelector(`.job-template-container`);
const taskToolbar = document.querySelector(`.task-toolbar-container`);
const arrowLeftSelectedTask = document.querySelector(`.arrow-left_selected`);
const arrowRightSelectedTask = document.querySelector(`.arrow_right_selected`);
const addTaskBtn = document.getElementById(`addTask`);

const showVertViewBtn = document.getElementById('calendar-icon-vertview');
const showHorViewBtn = document.getElementById('calendar-icon-horview');

showVertViewBtn.addEventListener('click', ()=>{
    document.getElementById("calendar-pop-up").style.display = "none";
    document.getElementById("backdrop").style.display = "none";
    showCalVertView();
});


showHorViewBtn.addEventListener('click', ()=>{
    document.getElementById("calendar-pop-up").style.display = "none";
    document.getElementById("backdrop").style.display = "none";
    showCalHorView();
});





console.log("Success");
migrateTaskDataToArrayFormat();
function migrateTaskDataToArrayFormat() {
    const storedData = JSON.parse(localStorage.getItem("tasks")) || {};
    const migratedData = {};

    for (const date in storedData) {
        migratedData[date] = {};

        ["morning", "afternoon", "evening"].forEach(period => {
            const value = storedData[date][period];

            // If it's NOT an array already AND it has task/color keys
            if (value && typeof value === "object" && !Array.isArray(value)) {
                const { task = "", color = "" } = value;
                migratedData[date][period] = [{ task, color }];
            }

            // If it's already in correct format (array of objects), keep as-is
            else if (Array.isArray(value)) {
                migratedData[date][period] = value;
            }

            // If missing or invalid, default to empty array
            else {
                migratedData[date][period] = [];
            }
        });
    }
    localStorage.setItem("tasks", JSON.stringify(migratedData));
    console.log("✅ Task data migrated to array-of-objects format.");
}



// migrateTaskDataToArrayFormat();
// function migrateTaskDataToArrayFormat() {
//     const storedData = JSON.parse(localStorage.getItem("tasks")) || {};
//     const migratedData = {};

//     for (const date in storedData) {
//         migratedData[date] = {};

//         ["morning", "afternoon", "evening"].forEach(period => {
//             const value = storedData[date][period];

//             // If it's NOT an array already AND it has task/color keys
//             if (value && typeof value === "object" && !Array.isArray(value)) {
//                 const { task = "", color = "" } = value;
//                 migratedData[date][period] = [{ task, color }];
//             }

//             // If it's already in correct format (array of objects), keep as-is
//             else if (Array.isArray(value)) {
//                 migratedData[date][period] = value;
//             }

//             // If missing or invalid, default to empty array
//             else {
//                 migratedData[date][period] = [];
//             }
//         });
//     }

//     localStorage.setItem("tasks", JSON.stringify(migratedData));
//     console.log("✅ Task data migrated to array-of-objects format.");
// }














































//revert here again


addTaskBtn.addEventListener('click', () => {
    console.log('add task btn is clicked');

    if (selectedDivs.length === 0) return;

    const storedData = JSON.parse(localStorage.getItem("tasks")) || {};
    const uniqueParents = new Set();

    // 🔹 Collect parent elements first
    selectedDivs.forEach(selected => {
        const parent = selected.classList.contains('morningTaskSub') ||
            selected.classList.contains('afternoonTaskSub') ||
            selected.classList.contains('eveningTaskSub')
            ? selected.parentElement
            : selected;

        uniqueParents.add(parent);
    });

    // 🔹 Clear selectedDivs
    selectedDivs.forEach(div => div.classList.remove('selected'));
    selectedDivs.length = 0;

    uniqueParents.forEach(parent => {
        let taskType, taskKey;

        if (parent.classList.contains('morningTask')) {
            taskType = 'morningTask';
            taskKey = 'morning';
        } else if (parent.classList.contains('afternoonTask')) {
            taskType = 'afternoonTask';
            taskKey = 'afternoon';
        } else if (parent.classList.contains('eveningTask')) {
            taskType = 'eveningTask';
            taskKey = 'evening';
        } else {
            return;
        }

        const dayContainer = parent.closest('.day-container');
        const date = dayContainer.querySelector('.date').getAttribute('data-full-date');

        if (!storedData[date]) storedData[date] = {};
        if (!Array.isArray(storedData[date][taskKey])) storedData[date][taskKey] = [];

        // 🔍 Find the first visually empty div (no text AND no color)
        let taskDivToUse = Array.from(parent.children).find(child =>
            child.classList.contains(`${taskType}Sub`) &&
            child.textContent.trim() === '' &&
            (!child.style.backgroundColor || child.style.backgroundColor === 'transparent')
        );

        // 🔍 Find matching "empty" task object in storage
        const emptyIndex = storedData[date][taskKey].findIndex(t =>
            t.task.trim() === '' && (!t.color || t.color.trim() === '')
        );

        if (taskDivToUse) {
            taskDivToUse.textContent = taskInput.value;
            taskDivToUse.style.backgroundColor = chosenColor || '#ccc';

            if (emptyIndex !== -1) {
                storedData[date][taskKey][emptyIndex] = {
                    task: taskInput.value,
                    color: taskDivToUse.style.backgroundColor
                };
            } else {
                storedData[date][taskKey].push({
                    task: taskInput.value,
                    color: taskDivToUse.style.backgroundColor
                });
            }
        } else {
            taskDivToUse = document.createElement('div');
            taskDivToUse.textContent = taskInput.value;
            taskDivToUse.classList.add(`${taskType}Sub`);
            taskDivToUse.style.backgroundColor = chosenColor || '#ccc';
            parent.appendChild(taskDivToUse);

            storedData[date][taskKey].push({
                task: taskInput.value,
                color: taskDivToUse.style.backgroundColor
            });
        }

        taskDivToUse.style.borderLeft = `4px solid ${chosenColor}`;
        taskDivToUse.style.backgroundColor = fadeColor(chosenColor);

        // 🔹 Select only the newly added/updated task
        taskDivToUse.classList.add('selected');
        selectedDivs.push(taskDivToUse);
    });

    localStorage.setItem("tasks", JSON.stringify(storedData));
    [selectedTaskCounter, deselectTemplateBtn].forEach(el => el.textContent = selectedDivs.length);
});


























window.addEventListener('DOMContentLoaded', () => {
    loadTemplate();
    getWeather();

});


// The 8px offset from the right
const offset = 8;

// Add an event listener to hide the element on button click
hideWidgetBtn.addEventListener('click', () => {
    // Get the width of #today-name element
    const todayNameWidth = todayName.offsetWidth;

    // Toggle the visibility and the arrow
    if (todayName.style.transform === `translateX(${todayNameWidth + offset}px)`) {
        todayName.style.transform = 'translateX(0)'; // Show it again
        hideWidgetBtn.classList.remove('is-true'); // Reset the arrow and button style
    } else {
        todayName.style.transform = `translateX(${todayNameWidth + offset}px)`; // Move it off-screen to the right including the offset
        hideWidgetBtn.classList.add('is-true'); // Apply active class for arrow and background change
    }
});




templateTaskBtn.addEventListener('click', () => {
    movableTemplate.style.display =
        movableTemplate.style.display === 'flex' ? 'none' : 'flex';
    console.log(`drag is cllick`);
});

// submitTaskBtn.disabled = true;
// console.log(submitTaskBtn.disabled);

let isHidden = false;
hideAllButtons.addEventListener(`click`, () => {

    todayNameText.style.display = todayNameText.style.display === 'none' ? 'flex' : 'none';
    hideWidgetBtn.style.display = hideWidgetBtn.style.display === 'none' ? 'flex' : 'none';
    menuButton.style.display = menuButton.style.display === 'none' ? 'flex' : 'none';
    // clearButton.style.display = clearButton.style.display === 'none' ? 'flex' : 'none';
    taskToolbar.style.display = taskToolbar.style.display === 'none' ? 'flex' : 'none';
    // floatingAddBtn.style.display = floatingAddBtn.style.display === 'none' ? '' : 'none';
    slidingInputView.style.display = slidingInputView.style.display !== 'none' ? 'none' : 'flex';

    const isFullScreen = !!document.fullscreenElement;

    if (!isHidden) {
        // console.log(isFullScreen);
        if (isFullScreen) {

            exitFullscreenBtn.style.display = `none`;
        } else {
            fullScreenButton.style.display = `none`;
        }
        isHidden = true;
    } else {
        if (isFullScreen) {
            exitFullscreenBtn.style.display = `flex`;
        } else {
            fullScreenButton.style.display = `flex`;
        }
        isHidden = false;
    }

});

const yearContainer = document.getElementById('year-container');
const fullScreenButton = document.getElementById(`fullscreen-button`);



taskInput.addEventListener('focus', () => {
    const isFullScreen = window.innerHeight === screen.height; // Check if full screen
    const delay = isFullScreen ? 1500 : 500; // Set delay based on full screen status

    setTimeout(() => {
        taskInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, delay);
});



let todayNameText = document.getElementById('today-name');
todayNameText.addEventListener('click', () => {
    location.reload();
});

// let monthNameDayContainer = document.getElementById('month-name-day-container');
let currentMonthContainer = null;
let nextMonthContainer = null;
let prevMonthContainer = null;

const todayDateObj = new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' });

// Convert it back to a Date object
const today = new Date(todayDateObj);

let todayDayNumber = today.getDate(); // Get the day of the month
let todayDay = getDayName(today.getDay()); // Get the weekday name
let todayMonth = today.getMonth(); // Get the month (0-11)
let todayYear = today.getFullYear(); // Get the year

// Get the current date details
// let today = new Date();


// let todayDayNumber = today.getDate();
// let todayDay = getDayName(today.getDay());
// let todayMonth = today.getMonth();
// let todayYear = today.getFullYear();

// Initialize calendar
let currentDate = new Date(todayYear, todayMonth, 1);
let currentDateMonth = currentDate.getMonth();
let currentDateYear = currentDate.getFullYear();
let currentDateFirstDay = getDayName(currentDate.getDay());
let currentDateLastDate = new Date(currentDateYear, currentDateMonth + 1, 0).getDate();

addDays("initCurrent", currentDateMonth, 1, currentDate.getDay(), currentDateLastDate, "", "", "", currentDateYear);

let nextDate = new Date(currentDateYear, currentDateMonth + 1, 1);
let nextDateMonth = nextDate.getMonth();
let nextDateYear = nextDate.getFullYear();
let nextDateLastDate = new Date(nextDateYear, nextDateMonth + 1, 0).getDate();

addDays("initNext", nextDateMonth, 1, nextDate.getDay(), nextDateLastDate, "", "", "", nextDateYear);

let prevDate = new Date(currentDateYear, currentDateMonth - 1, 1);
let prevDateMonth = prevDate.getMonth();
// console.log(prevDateMonth);
let prevDateYear = prevDate.getFullYear();
// console.log(prevDateYear);
let prevDateLastDate = new Date(prevDateYear, prevDateMonth + 1, 0).getDate();




addDays("initPrev", prevDateMonth, 1, prevDate.getDay(), prevDateLastDate, "", "", "", prevDateYear);

// Handle scroll event
yearContainer.addEventListener('scroll', () => {
    const scrollTop = yearContainer.scrollTop;
    const scrollHeight = yearContainer.scrollHeight;
    const clientHeight = yearContainer.clientHeight;

    if (scrollTop === 0) {
        // Scroll to the top
        nextDate = currentDate;
        currentDate = prevDate;

        currentDateMonth = currentDate.getMonth();
        currentDateYear = currentDate.getFullYear();
        currentDateFirstDay = getDayName(currentDate.getDay());
        currentDateLastDate = new Date(currentDateYear, currentDateMonth + 1, 0).getDate();

        prevDate = new Date(currentDateYear, currentDateMonth - 1, 1);
        prevDateMonth = prevDate.getMonth();
        prevDateYear = prevDate.getFullYear();
        prevDateFirstDay = getDayName(prevDate.getDay());
        prevDateLastDate = new Date(prevDateYear, prevDateMonth + 1, 0).getDate();



        addDays("prev", prevDateMonth, 1, prevDate.getDay(), prevDateLastDate, "", "", "", prevDateYear);

        console.log(`Scrolled to the top`);
        // console.log(`Current Month: ${currentDateMonth}, Last Date: ${currentDateLastDate}`);
        // console.log(`Previous Month: ${prevDateMonth}, Last Date: ${prevDateLastDate}`);
    } else if (scrollTop + clientHeight >= scrollHeight - 25) {
        // Scroll to the bottom
        prevDate = currentDate;
        currentDate = nextDate;

        currentDateMonth = currentDate.getMonth();
        currentDateYear = currentDate.getFullYear();
        currentDateFirstDay = getDayName(currentDate.getDay());
        currentDateLastDate = new Date(currentDateYear, currentDateMonth + 1, 0).getDate();

        nextDate = new Date(currentDateYear, currentDateMonth + 1, 1);
        nextDateMonth = nextDate.getMonth();
        nextDateYear = nextDate.getFullYear();
        // nextDateFirstDay = getDayName(nextDate.getDay());
        nextDateLastDate = new Date(nextDateYear, nextDateMonth + 1, 0).getDate();
        addDays("next", nextDateMonth, 1, nextDate.getDay(), nextDateLastDate, "", "", "", nextDateYear);

        console.log(`Scrolled to the bottom`);
        // console.log(`Current Month: ${currentDateMonth}, Last Date: ${currentDateLastDate}`);
        // console.log(`Next Month: ${nextDateMonth}, Last Date: ${nextDateLastDate}`);
    }
});


// todayScroll();
// function todayScroll() {
//     const nowTodayElement = new Date();

//     const yearTodayElement = nowTodayElement.getFullYear();
//     const monthTodayElement = nowTodayElement.getMonth();
//     const dayTodayElement = nowTodayElement.getDate();

//     const todayDate = `${yearTodayElement}-${monthTodayElement}-${dayTodayElement}`;

//     console.log('Built todayDate:', todayDate);

//     const todayElement = document.querySelector(`.date[data-full-date="${todayDate}"]`);
//     console.log('Found todayElement:', todayElement);

//     if (todayElement) {
//       console.log("ENTERED todayElement");
//       todayElement.scrollIntoView({
//         behavior: "smooth",
//         block: "center"
//       });
//     // showDayTasks(todayElement);
//     }
//   }






function addDays(scroll = "", monthName = 0, date = 1, day = 0, lastDateOfMonth = 0, morningTask = "", afternoonTask = "", eveningTask = "", yearDate) {

    let monthNameDayContainer = document.createElement('div');
    monthNameDayContainer.classList.add('month-name-day-container');


    const monthNameContainer = document.createElement('div');
    monthNameContainer.addEventListener('click', showCalVertView);
    monthNameContainer.classList.add('month-name-container');


    let FormatMonthName = getMonthName(monthName % 12);
    let letters = FormatMonthName.split('');
    monthNameContainer.innerHTML = '';


    // Create a wrapper for the letters
    let monthLetterContainer = document.createElement('div');
    monthLetterContainer.classList.add('month-letter-container'); // Add a class for styling

    letters.forEach(letter => {
        let letterDiv = document.createElement('div');
        letterDiv.textContent = letter;
        monthLetterContainer.appendChild(letterDiv); // Append each letter to the wrapper
    });

    // Append the wrapper to the main container
    monthNameContainer.appendChild(monthLetterContainer);

    // Set background color based on monthName
    // if (monthName % 2 == 0) {
    //     monthNameContainer.style.backgroundColor = '#82c6a2'; // Light green
    // } else {
    //     monthNameContainer.style.backgroundColor = '#53ab8b'; // Dark green
    // }

    monthNameContainer.style.backgroundColor =
        monthName % 2 === 0 ? colorThemes[selectedTheme].even : colorThemes[selectedTheme].odd;


    //monthdays and name container
    let yearLetterContainer = document.createElement('div'); // Create a wrapper container
    yearLetterContainer.classList.add('year-letter-container'); // Add a class for styling
    let yearLetters = yearDate.toString().split('');
    yearLetters.forEach(letter => {
        let letterDiv = document.createElement('div');
        letterDiv.textContent = letter;
        yearLetterContainer.appendChild(letterDiv);
    });

    // yearLetterContainer.textContent = yearDate;
    monthNameContainer.appendChild(yearLetterContainer);


    const monthContainer = document.createElement('div');
    monthContainer.classList.add('month-container');
    let storedData = JSON.parse(localStorage.getItem('tasks')) || {};

    // Lock Button
    let lockButton = document.createElement("div");
    lockButton.classList.add("lock-button"); // Assign class for styling
    const icon = document.createElement("span");
    icon.classList.add("material-icons");
    icon.textContent = "lock_open";
    lockButton.appendChild(icon);
    monthNameContainer.prepend(lockButton);

    // Check if lock state exists in localStorage for this month container
    // Check if lock state exists in localStorage for this month container
    let isLocked = localStorage.getItem(`lockState-${FormatMonthName}`) === 'true' ? true : false; // Default to false if not found


    // Apply saved lock state when the page loads
    if (isLocked) {
        console.log(`${FormatMonthName} is locked`);
        monthContainer.style.pointerEvents = "auto"; // Disable interaction for the month container
        icon.textContent = "lock_open"; // Change icon to locked
    }

    // Lock/Unlock functionality
    lockButton.addEventListener("click", () => {
        isLocked = !isLocked; // Toggle the lock state

        if (isLocked) {
            console.log(`${FormatMonthName} is locked`);
            monthContainer.style.pointerEvents = "auto"; // Disable interaction for the month container
            icon.textContent = "lock_open"; // Change icon to locked
        } else {
            console.log(`${FormatMonthName} is unlocked`);
            monthContainer.style.pointerEvents = "auto"; // Enable interaction for the month container
            icon.textContent = "lock_open"; // Change icon back to unlocked
        }

        // Save the lock state to localStorage
        localStorage.setItem(`lockState-${FormatMonthName}`, isLocked.toString());
    });


    for (i = 1; i <= lastDateOfMonth; i++) {


        const dayContainer = document.createElement('div');
        dayContainer.classList.add('day-container');

        const dateDiv = document.createElement('div');

        if (today.toDateString() === new Date(yearDate, monthName, i).toDateString()) {
            dateDiv.style.color = `white`;
            dateDiv.classList.add('aurora');
        }

        dateDiv.textContent = date;
        dateDiv.classList.add('date');
        dateDiv.setAttribute('data-full-date', `${yearDate}-${monthName}-${date}`); // Store the full date as a data attribute
        // console.log(dateDiv.getAttribute('data-full-date')); // ✅ See the real value
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('day');
        // Get the day name
        const dayName = getDayName(day % 7);









        // Make Sunday and Saturday different colors and bigger

        if (dayName === 'Sun' || dayName === 'Sat') {
            dayDiv.style.fontSize = "12px";
            dayDiv.style.fontWeight = "bold";
            dayDiv.style.borderColor = ""; // Make the font larger

            if (dayName === 'Sun') {
                dateDiv.style.color = "red"; // Keep the red text color
                dayDiv.style.backgroundColor = colorThemes[selectedTheme].sunday; // Use theme color
                dayDiv.style.color = "white"; // Ensure text remains readable
            }
        }
















        // if (dayName === 'Sun' || dayName === 'Sat') {
        //     dayDiv.style.fontSize = "12px";
        //     dayDiv.style.fontWeight = "bold";
        //     dayDiv.style.borderColor = ""; // Make the font larger
        //     if (dayName === 'Sun') {
        //         // dayDiv.style.color = "red"; // Set the color for Sunday
        //         // dayDiv.style.backgroundColor = "#e57373"; //red
        //         dateDiv.style.color = "red"; //red
        //         dayDiv.style.backgroundColor = "#3388cc"; //sapphire
        //         // dayDiv.style.backgroundColor = "#1F456E"; //aegeon
        //         // dayDiv.style.borderColor = "#e57373"; //muted red 
        //         dayDiv.style.color = "white";

        //     } else {
        //         // dayDiv.style.color = "blue";
        //         // dateDiv.style.color = "blue";// Set the color for Saturday
        //         // dayDiv.style.borderColor = "#3388cc";
        //     }
        // }

        dayDiv.textContent = dayName;

        const taskData = storedData[`${yearDate}-${monthName}-${date}`];
        // === MORNING TASKS ===
        const morningTaskDiv = document.createElement('div');
        morningTaskDiv.classList.add('morningTask');

        if (taskData && Array.isArray(taskData.morning) && taskData.morning.length > 0) {
            taskData.morning.forEach(({ task, color }) => {
                const taskDiv = document.createElement('div');
                taskDiv.classList.add('morningTaskSub');
                taskDiv.textContent = task;
                // taskDiv.style.backgroundColor = color;
                // morningTaskDiv.appendChild(taskDiv);
                if (color) {
                    taskDiv.style.borderLeft = `4px solid ${color}`;
                    taskDiv.style.backgroundColor = fadeColor(color);
                } else {
                    taskDiv.style.borderLeft = `4px solid transparent`;
                    taskDiv.style.backgroundColor = 'transparent';
                }
                morningTaskDiv.appendChild(taskDiv);
            });
        } else {
            const blankTaskDiv = document.createElement('div');
            blankTaskDiv.classList.add('morningTaskSub');
            morningTaskDiv.appendChild(blankTaskDiv);
        }

        // === AFTERNOON TASKS ===
        const afternoonTaskDiv = document.createElement('div');
        afternoonTaskDiv.classList.add('afternoonTask');

        if (taskData && Array.isArray(taskData.afternoon) && taskData.afternoon.length > 0) {
            taskData.afternoon.forEach(({ task, color }) => {
                const taskDiv = document.createElement('div');
                taskDiv.classList.add('afternoonTaskSub');
                taskDiv.textContent = task;
                // taskDiv.style.backgroundColor = color;
                // afternoonTaskDiv.appendChild(taskDiv);
                if (color) {
                    taskDiv.style.borderLeft = `4px solid ${color}`;
                    taskDiv.style.backgroundColor = fadeColor(color);
                } else {
                    taskDiv.style.borderLeft = `4px solid transparent`;
                    taskDiv.style.backgroundColor = 'transparent';
                }
                afternoonTaskDiv.appendChild(taskDiv);
            });
        } else {
            const blankTaskDiv = document.createElement('div');
            blankTaskDiv.classList.add('afternoonTaskSub');
            afternoonTaskDiv.appendChild(blankTaskDiv);
        }

        // === EVENING TASKS ===
        const eveningTaskDiv = document.createElement('div');
        eveningTaskDiv.classList.add('eveningTask');

        if (taskData && Array.isArray(taskData.evening) && taskData.evening.length > 0) {
            taskData.evening.forEach(({ task, color }) => {
                const taskDiv = document.createElement('div');
                taskDiv.classList.add('eveningTaskSub');
                taskDiv.textContent = task;
                // taskDiv.style.backgroundColor = color;
                // eveningTaskDiv.appendChild(taskDiv);
                if (color) {
                    taskDiv.style.borderLeft = `4px solid ${color}`;
                    taskDiv.style.backgroundColor = fadeColor(color);
                } else {
                    taskDiv.style.borderLeft = `4px solid transparent`;
                    taskDiv.style.backgroundColor = 'transparent';
                }
                eveningTaskDiv.appendChild(taskDiv);
            });
        } else {
            const blankTaskDiv = document.createElement('div');
            blankTaskDiv.classList.add('eveningTaskSub');
            eveningTaskDiv.appendChild(blankTaskDiv);
        }


        // eveningTaskDiv.textContent = taskData ? taskData.evening : eveningTask;
        // eveningTaskDiv.textContent = eveningTask;

        date = date + 1;
        dayContainer.appendChild(dateDiv);
        dayContainer.appendChild(dayDiv);
        dayContainer.appendChild(morningTaskDiv);
        dayContainer.appendChild(afternoonTaskDiv);
        dayContainer.appendChild(eveningTaskDiv);
        monthContainer.appendChild(dayContainer);
        //created 1-30 days
        if (getDayName(day % 7) === "Sat") {
            const weekSpacer = document.createElement('div');
            weekSpacer.classList.add(`week-spacer`);
            monthContainer.appendChild(weekSpacer);
            console.log(`week spacer added`);
        }
        day++;

        monthNameDayContainer.appendChild(monthNameContainer);
        monthNameDayContainer.appendChild(monthContainer);
    }
    if (scroll === "next") {
        // nextMonthContainer = monthContainer;

        if (prevMonthContainer) {
            prevMonthContainer.remove();
            console.log(`prev is remove`);
        }

        prevMonthContainer = currentMonthContainer;
        currentMonthContainer = nextMonthContainer;
        nextMonthContainer = monthNameDayContainer;
        // yearContainer.appendChild(monthContainer);
        yearContainer.appendChild(monthNameDayContainer);

    }
    else if (scroll === "prev") {
        // prevMonthContainer = monthContainer;
        if (nextMonthContainer) {
            nextMonthContainer.remove();
            console.log(`next is remove`);
        }

        nextMonthContainer = currentMonthContainer;
        currentMonthContainer = prevMonthContainer;
        prevMonthContainer = monthNameDayContainer;

        const previousScrollHeight = yearContainer.scrollHeight;
        // yearContainer.prepend(monthContainer);
        yearContainer.prepend(monthNameDayContainer);
        const newScrollHeight = yearContainer.scrollHeight;
        yearContainer.scrollTop += newScrollHeight - previousScrollHeight;
    } else if (scroll === "initCurrent") {
        currentMonthContainer = monthNameDayContainer;
        yearContainer.appendChild(monthNameDayContainer);
        // console.log(`current is init`);
    } else if (scroll === "initNext") {
        nextMonthContainer = monthNameDayContainer;
        yearContainer.appendChild(monthNameDayContainer);
        // console.log(`next is init`);
    } else if (scroll === "initPrev") {
        prevMonthContainer = monthNameDayContainer;

        const previousScrollHeight = yearContainer.scrollHeight;
        yearContainer.prepend(monthNameDayContainer);
        const newScrollHeight = yearContainer.scrollHeight;
        yearContainer.scrollTop += newScrollHeight - previousScrollHeight;
        // console.log(`prev is init`);
    }

    // console.log(monthNameContainer.innerHTML);

}





fullScreenButton.addEventListener(`click`, enterFullScreen);
exitFullscreenBtn.addEventListener("click", exitFullscreen);


function enterFullScreen() {
    const docElement = document.documentElement;
    if (docElement.requestFullscreen) {
        docElement.requestFullscreen();

    } else if (docElement.webkitRequestFullscreen) {
        docElement.webkitRequestFullscreen(); // Safari
    } else if (docElement.msRequestFullscreen) {
        docElement.msRequestFullscreen(); // IE/Edge
    }
    fullScreenButton.style.display = 'none';
    exitFullscreenBtn.style.display = `flex`;

    // slidingInputView.classList.toggle("show");
    // Reset button position and rotation
    // floatingAddBtn.style.transform = 'rotate(0)';
    // Reset button color to green
    // floatingAddBtn.style.backgroundColor = '#4CAF50'; 
    // floatingAddBtn.style.backgroundColor = 'rgba(76, 175, 80, 0.7)';

    // floatingAddBtn.style.bottom = `${20}px`;
    // clearButton.style.bottom = `${80}px`;
    // isPopupOpen = true;
}
// Exit fullscreen function
function exitFullscreen() {
    // if (document.fullscreenElement) { // Check if fullscreen is active
    //     document.exitFullscreen()
    //         .then(() => console.log("Exited fullscreen"))
    //         .catch(err => console.error("Error exiting fullscreen:", err));
    // } else {
    //     console.log("Fullscreen mode is not active");
    // }

    document.exitFullscreen();
    exitFullscreenBtn.style.display = `none`;
    fullScreenButton.style.display = 'flex';
}



document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        if (!isHidden) {
            exitFullscreenBtn.style.display = `none`;
            fullScreenButton.style.display = 'flex';
        }
    } else {
        if (!isHidden) {
            exitFullscreenBtn.style.display = `flex`;
            fullScreenButton.style.display = 'none';
        }
    }
});

let selectedDivs = [];
let chosenColor = '#6a5044';
let currentTask = '';


//add click listener to colors for task
document.querySelectorAll('.color-option').forEach(button => {
    button.addEventListener('click', () => {
        // Get the selected color
        chosenColor = button.getAttribute('data-color');
        // Highlight the selected button
        document.querySelectorAll('.color-option').forEach(btn => btn.classList.remove('selected-color'));
        button.classList.add('selected-color');
        flower.style.color = chosenColor;
    });
});

//add click listeners to task(morning, afternoon, evening) divs
yearContainer.addEventListener('click', (event) => {
    const subTaskElement = event.target.closest('.morningTaskSub, .afternoonTaskSub, .eveningTaskSub');
    const mainTaskElement = event.target.closest('.morningTask, .afternoonTask, .eveningTask');


    if (subTaskElement) {
        handleSubtaskClick(subTaskElement); // Handle child click
        updateUICounters();
        taskInput.value = selectedDivs[selectedDivs.length - 1]?.textContent || '';
        return; // prevent bubbling to parent logic
    }

    if (mainTaskElement) {
        handleParentClick(mainTaskElement); // Handle parent click
        taskInput.value = selectedDivs[selectedDivs.length - 1]?.textContent || '';
        updateUICounters(); // Update the UI counters
    }


});


// Handle selection/deselection for the subtask (child)
function handleSubtaskClick(subTaskElement) {
    toggleSelection(subTaskElement);
}

// Handle selection/deselection for the parent task
function handleParentClick(mainTaskElement) {
    const subtasks = Array.from(mainTaskElement.children);
    const allSelected = subtasks.every(task => selectedDivs.includes(task));

    subtasks.forEach(task => {
        if (allSelected) {
            selectedDivs = selectedDivs.filter(div => div !== task);
            task.classList.remove('selected');
        } else if (!selectedDivs.includes(task)) {
            selectedDivs.push(task);
            task.classList.add('selected');
        }
    });
}

// Update UI counters
function updateUICounters() {
    [selectedTaskCounter, deselectTemplateBtn].forEach(el => el.textContent = selectedDivs.length);
}



function toggleSelection(div) {
    if (selectedDivs.includes(div)) {
        selectedDivs = selectedDivs.filter(d => d !== div);
        div.classList.remove('selected');
    } else {
        selectedDivs.push(div);
        div.classList.add('selected');
    }
}
// Add the touchend event listener
// yearContainer.addEventListener('dblclick', (event) => {
//     handleSubtaskGroupToggle(event);  // Handle double-click directly
// });

// yearContainer.addEventListener('touchend', (event) => {

//     handleTouchEnd(() => handleSubtaskGroupToggle(event));  
// });

function handleSubtaskGroupToggle(event) {
    const subTaskElement = event.target.closest('.morningTaskSub, .afternoonTaskSub, .eveningTaskSub');

    if (subTaskElement) {
        const mainTaskElement = subTaskElement.closest('.morningTask, .afternoonTask, .eveningTask');
        if (mainTaskElement) {
            handleParentClick(mainTaskElement);  // Call the parent click handler for double-clicked subtask
        }
    }
}














// arrowLeftSelectedTask.addEventListener("click", () => {
//     do {
//         if (currentTask > 0) {
//             currentTask -= 1;
//         } else {
//             break;
//         }
//     } while (taskInput.value === selectedDivs[currentTask].textContent);

//     taskInput.value = selectedDivs[currentTask].textContent || '';
// });

// arrowRightSelectedTask.addEventListener("click", () => {
//     if(selectedDivs)
//     do {
//         if (currentTask < selectedDivs.length - 1) {
//             currentTask += 1;
//         } else {
//             break;
//         }
//     } while (taskInput.value === selectedDivs[currentTask].textContent);

//     taskInput.value = selectedDivs[currentTask].textContent || '';
// });



const counterObserver = new MutationObserver(() => {
    if (parseInt(selectedTaskCounter.textContent) > 0) {
        submitTaskBtn.classList.remove('disabled-btn'); // Remove disabled styling
        addTaskBtn.classList.remove('disabled-btn'); // Remove 
        selectedTaskCounter.classList.add(`selection-true`);
        // submitTaskBtn.disabled = false;
        // selectedTaskCounter.classList.remove('shake-btn'); // Remove shake effect when counter is > 0
    } else {
        submitTaskBtn.classList.add('disabled-btn'); // Add 
        addTaskBtn.classList.add('disabled-btn'); // Remove 
        // disabled styling
        // submitTaskBtn.disabled = true;
        selectedTaskCounter.classList.remove(`selection-true`);
        triggerShakeEffect();
    }
});

// Start observing changes in the text of selectedTaskCounter
//learn
counterObserver.observe(selectedTaskCounter, { childList: true });
//for task template
let taskClipboard = [];

submitTaskBtn.addEventListener('click', submitTask);

function submitTask() {
    if (selectedDivs.length > 0) {
        selectedDivs.forEach(div => {
            let taskTitle = document.getElementById('taskTitle').value;

            // Use existing text if none is typed in
            if (taskTitle !== '') {
                div.textContent = taskTitle;
            } else {
                taskTitle = div.textContent;
            }

            addTemplate(taskTitle, chosenColor);
            // div.style.backgroundColor = chosenColor;

            div.style.borderLeft = `4px solid ${chosenColor}`;
            div.style.backgroundColor = fadeColor(chosenColor);



            // === Save to localStorage ===
            const dayContainer = div.closest('.day-container');
            const date = dayContainer.querySelector('.date').getAttribute('data-full-date');
            const parent = div.parentElement;

            const taskType = parent.classList.contains('morningTask') ? 'morning' :
                parent.classList.contains('afternoonTask') ? 'afternoon' :
                    parent.classList.contains('eveningTask') ? 'evening' : null;

            if (!taskType) return;

            const storedData = JSON.parse(localStorage.getItem('tasks')) || {};
            if (!storedData[date]) storedData[date] = {};
            if (!Array.isArray(storedData[date][taskType])) {
                storedData[date][taskType] = [];
            }

            // Get index of the div within its parent
            const subDivs = Array.from(parent.children);
            const index = subDivs.indexOf(div);

            // Update or insert at that index
            storedData[date][taskType][index] = {
                task: taskTitle,
                color: chosenColor
            };

            localStorage.setItem('tasks', JSON.stringify(storedData));
        });

        // Update counter
        [selectedTaskCounter, deselectTemplateBtn].forEach(el => el.textContent = selectedDivs.length);

        // Reset inputs
        document.getElementById('taskTitle').value = '';
    } else {
        triggerShakeEffect();
    }
}

function addTemplate(taskTitle, color) {

    //save task template here
    if (taskTitle !== ``) {

        const taskTemplate = {
            text: taskTitle,
            color: color
        };

        // Check if the task already exists in the array
        const taskExists = taskClipboard.some(task => task.text === taskTemplate.text && task.color === taskTemplate.color);

        if (!taskExists) {
            // If the task doesn't exist, push it to the array
            taskClipboard.push(taskTemplate);

            // Create the div and append it to the container
            const itemDiv = document.createElement('div');


            itemDiv.addEventListener(`dblclick`, () => {
                removeTemplate(itemDiv);
            });


            itemDiv.classList.add('items'); // Add the 'items' class

            // Set the background color of the div based on the task's color
            itemDiv.style.backgroundColor = taskTemplate.color;


            // Set the text content of the div based on the task's title
            itemDiv.textContent = taskTemplate.text;

            // Append the created item div to the container
            jobTemplateContainer.prepend(itemDiv);
            // Save the updated taskClipboard to localStorage
            saveTemplate();
        }
    }
}

// jobTemplateContainer.addEventListener('dblclick', (event) => {
//     if (event.target.classList.contains('items')) {
//         removeTemplate(event.target);
//     }
// });

// jobTemplateContainer.addEventListener('touchend', (event) => {
//     handleTouchEnd(() => {
//         if (event.target.classList.contains('items')) {
//             removeTemplate(event.target);
//         }
//     });
// });

jobTemplateContainer.addEventListener('click', (event) => {
    if (event.target.classList.contains('items')) {
        submitTemplate(event.target);
    }
});


function submitTemplate(item) {
    const taskText = item.textContent;
    const taskColor = rgbToHex(item.style.backgroundColor); // Convert RGB to HEX

    if (selectedDivs.length > 0) {
        const storedData = JSON.parse(localStorage.getItem('tasks')) || {};

        selectedDivs.forEach(div => {
            div.textContent = taskText;
            // div.style.backgroundColor = taskColor;
            div.style.borderLeft = `4px solid ${taskColor}`;
            div.style.backgroundColor = fadeColor(taskColor);


            const dayContainer = div.closest('.day-container');
            const date = dayContainer.querySelector('.date').getAttribute('data-full-date');

            let taskKey;
            if (div.classList.contains('morningTaskSub')) taskKey = 'morning';
            else if (div.classList.contains('afternoonTaskSub')) taskKey = 'afternoon';
            else if (div.classList.contains('eveningTaskSub')) taskKey = 'evening';
            else return;

            const parent = div.parentElement;
            const taskDivs = Array.from(parent.querySelectorAll(`.${taskKey}TaskSub`));
            const index = taskDivs.indexOf(div); // this is key: find position of this subtask in the DOM

            saveTaskData(date, taskKey, taskText, taskColor, index);
        });

        [selectedTaskCounter, deselectTemplateBtn].forEach(el => el.textContent = selectedDivs.length);
    } else {
        triggerShakeEffect();
    }
}



function removeTemplate(item) {
    // Get task text and color from the clicked item
    const taskText = item.textContent;
    const taskColor = rgbToHex(item.style.backgroundColor); // Convert RGB to HEX


    console.log(taskText, taskColor);

    // Load the current taskClipboard from localStorage
    let savedTasks = JSON.parse(localStorage.getItem('taskClipboard')) || [];

    // Filter out the clicked task
    savedTasks = savedTasks.filter(task => !(task.text === taskText && task.color === taskColor));

    // Save the updated taskClipboard back to localStorage
    localStorage.setItem('taskClipboard', JSON.stringify(savedTasks));

    // Update the taskClipboard array in memory
    taskClipboard = savedTasks;

    // Remove the item from the DOM
    item.remove();
}


function saveTemplate() {
    // Save the taskClipboard array to localStorage as a JSON string
    localStorage.setItem('taskClipboard', JSON.stringify(taskClipboard));
}


function loadTemplate() {
    // Load tasks from localStorage
    const savedTemplate = JSON.parse(localStorage.getItem('taskClipboard'));

    // If there are tasks saved in localStorage, load them into taskClipboard
    if (savedTemplate) {
        taskClipboard = savedTemplate;

        // Reverse the order of tasks before rendering
        taskClipboard.reverse();

        // Loop through each saved task and create the corresponding div
        taskClipboard.forEach(task => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('items'); // Add the 'items' class
            itemDiv.addEventListener(`dblclick`, () => {
                removeTemplate(itemDiv);
            });

            // Set the background color of the div based on the task's color
            itemDiv.style.backgroundColor = task.color;

            // Set the text content of the div based on the task's title
            itemDiv.textContent = task.text;

            // Append the created item div to the container
            jobTemplateContainer.appendChild(itemDiv);
        });
    }
}



function saveTaskData(date, taskType, updatedTask, taskColor, taskIndex) {
    let storedData = JSON.parse(localStorage.getItem('tasks')) || {};

    // Ensure structure
    if (!storedData[date]) storedData[date] = {};
    if (!Array.isArray(storedData[date][taskType])) storedData[date][taskType] = [];

    if (updatedTask === "" && taskColor === "") {
        if (taskIndex !== null) {
            storedData[date][taskType].splice(taskIndex, 1);
        }
    } else {
        storedData[date][taskType][taskIndex] = {
            task: updatedTask,
            color: taskColor
        };
    }

    localStorage.setItem('tasks', JSON.stringify(storedData));
}


function isEmptyTasks(dateTasks) {
    return (
        !dateTasks.morning.task && !dateTasks.morning.color &&
        !dateTasks.afternoon.task && !dateTasks.afternoon.color &&
        !dateTasks.evening.task && !dateTasks.evening.color
    );
}

let lastTapTime = 0;
const delay = 300;

// Function for touchend event logic
function handleTouchEnd(callback) {
    let currentTime = Date.now();

    if (currentTime - lastTapTime < delay) {
        callback();
    }

    lastTapTime = currentTime;
}

selectedTaskCounter.addEventListener('dblclick', clearSelection);
selectedTaskCounter.addEventListener('touchend', () => {
    handleTouchEnd(clearSelection);
});

function clearSelection() {
    selectedDivs.forEach(div => div.classList.remove('selected')); // Remove selected class
    selectedDivs = []; // Clear the array of selected divs
    // selectedTaskCounter.textContent = `${selectedDivs.length}`;
    // deselectTemplateBtn.textContent = `${selectedDivs.length}`;

    [selectedTaskCounter, deselectTemplateBtn].forEach(el => el.textContent = selectedDivs.length);

    console.log(`selection cleared`);
}




clearButton.addEventListener('dblclick', deleteFunction);
clearButton.addEventListener('touchend', () => {
    handleTouchEnd(deleteFunction);
});

function deleteFunction() {
    let storedData = JSON.parse(localStorage.getItem('tasks')) || {};

    selectedDivs.forEach(selectedDiv => {
        const dayContainer = selectedDiv.closest('.day-container');
        const fullDate = dayContainer.querySelector('.date').getAttribute('data-full-date');

        const parent = selectedDiv.parentElement;

        const taskType = parent.classList.contains('morningTask') ? 'morning' :
            parent.classList.contains('afternoonTask') ? 'afternoon' :
                parent.classList.contains('eveningTask') ? 'evening' : null;

        if (!taskType || !storedData[fullDate]) return;

        const taskArray = storedData[fullDate][taskType];
        if (!Array.isArray(taskArray)) return;

        // Find index of selectedDiv within its parent's children (same order as task array)
        const subDivs = Array.from(parent.children);
        const index = subDivs.indexOf(selectedDiv);

        if (index !== -1 && index < taskArray.length) {
            taskArray.splice(index, 1); // Remove from localStorage array
        }

        // Remove from DOM if multiple children, else just clear
        if (subDivs.length > 1) {
            selectedDiv.remove();
        } else {
            selectedDiv.textContent = '';
            selectedDiv.style.backgroundColor = '';
            selectedDiv.style.borderLeft = '';
        }

        // If now empty, add one blank subtask to maintain structure
        if (taskArray.length === 0) {
            storedData[fullDate][taskType] = [{ task: '', color: '' }];
        }

        // If all task arrays are empty, remove the full date entry
        const { morning = [], afternoon = [], evening = [] } = storedData[fullDate];
        const allEmpty = [morning, afternoon, evening].every(arr =>
            arr.length === 0 || (arr.length === 1 && arr[0].task === '' && arr[0].color === '')
        );

        if (allEmpty) {
            delete storedData[fullDate];
        }
    });

    localStorage.setItem('tasks', JSON.stringify(storedData));

    // Clear UI state
    selectedDivs.forEach(div => div.classList.remove('selected'));
    selectedDivs = [];
    [selectedTaskCounter, deselectTemplateBtn].forEach(el => el.textContent = selectedDivs.length);
}


let isPopupOpen = false;
floatingAddBtn.addEventListener('click', () => {
    isPopupOpen = !isPopupOpen;

    if (isPopupOpen) {
        // slidingInputView.style.bottom = '0'; // Show popup
        slidingInputView.classList.toggle("show");

        floatingAddBtn.style.transform = 'rotate(225deg)'; //rotate button
        // floatingAddBtn.style.backgroundColor = '#f44336'; 
        // Change button color to red
        floatingAddBtn.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';

        // Adjust the button positions based on the sliding input view
        // const slidingInputHeight = 33 * window.innerHeight / 100;

        //repositioning
        // floatingAddBtn.style.bottom = `${130 + 10}px`;
        // clearButton.style.bottom = `${130 + 70}px`;
        taskToolbar.style.bottom = `${130 + 10}px`;
    } else {
        slidingInputView.classList.toggle("show");

        floatingAddBtn.style.transform = 'rotate(0)'; // Reset button position and rotation
        floatingAddBtn.style.backgroundColor = 'rgba(76, 175, 80, 0.7)'; // Reset button color to green

        // const slidingInputHeight = -(33 * window.innerHeight / 100);
        // floatingAddBtn.style.bottom = `${20}px`;
        // clearButton.style.bottom = `${80}px`;
        taskToolbar.style.bottom = `${20}px`;
    }
});


closeButton.addEventListener('click', () => {
    templateTaskBtn.click();
});





//start of TEMPALTE ADD POP UP
// Clone the container
const clonedSlidingInputView = slidingInputView.cloneNode(true);
clonedSlidingInputView.classList.add('cloned-sliding-view');

// Remove the selected task counter/button
const selectedTask = clonedSlidingInputView.querySelector('.selected-task');
if (selectedTask) {
    selectedTask.remove();  // Remove the selected-task button
}


// Select both arrows
// const arrows = clonedSlidingInputView.querySelector('.template-task-btn1 ');
const arrows = clonedSlidingInputView.querySelector('#addTask ');
//Remove arrow .arrow_right_selected and .arrow_left_selected conatiner
arrows.remove();



//remove the template button toggle
const templateTaskBtnCloned = clonedSlidingInputView.querySelector('.template-task-btn');
if (templateTaskBtnCloned) {
    templateTaskBtnCloned.remove();  // Remove the template-task-btn div
}

const colorIndicatorTemplate = clonedSlidingInputView.querySelector(`.flower`);

//change id of submittask to submittemplate 
const inputTemplate = clonedSlidingInputView.querySelector(`#taskTitle`);
inputTemplate.id = `templateTitle`;
inputTemplate.placeholder = `Add New Template`;

//get new id for submit button
const addTemplateButton = clonedSlidingInputView.querySelector('#submitTask');
addTemplateButton.id = `submitTemplate`;
addTemplateButton.classList.remove(`buttons`);
addTemplateButton.classList.add(`submit-btn-cloned`);
const addTemplateButtonIcon = addTemplateButton.querySelector(`.arrow-upward`);
// console.log(addTemplateButtonIcon.classList);
addTemplateButtonIcon.classList.remove(`arrow-upward`);
addTemplateButtonIcon.classList.add(`add-template-btn-icon`);
addTemplateButtonIcon.textContent = `add`;

//get unique access to color-option
const colorOptionTemplate = clonedSlidingInputView.querySelectorAll('.color-option');
colorOptionTemplate.forEach(option => {
    option.classList.remove('color-option');
    option.classList.add('color-option-template');
});


let chosenColorTemplate = `#6a5044`;
//add click listener to colors
colorOptionTemplate.forEach(button => {
    button.addEventListener('click', () => {
        // Get the selected color
        chosenColorTemplate = button.getAttribute('data-color');
        // Highlight the selected button
        colorOptionTemplate.forEach(btn => btn.classList.remove('selected-color'));
        button.classList.add('selected-color');
        console.log(`color option for template color is ${chosenColorTemplate}`);
        colorIndicatorTemplate.style.color = chosenColorTemplate;
    });
});



addTemplateButton.addEventListener(`click`, () => {
    // console.log(inputTemplate.value);
    addTemplate(inputTemplate.value, chosenColorTemplate);
    inputTemplate.value = '';
    addTemplateButton.classList.add(`disabled-btn`);


    // alert('Development on-going/ functionality unstable yet. Please sleep.');
});
inputTemplate.addEventListener(`input`, () => {
    console.log(inputTemplate.value);
    if (inputTemplate.value !== '') {
        addTemplateButton.classList.remove(`disabled-btn`);
    } else if (inputTemplate.value === ``) {
        addTemplateButton.classList.add(`disabled-btn`);
    }
});


document.body.appendChild(clonedSlidingInputView);



const closeButtonCloned = document.createElement('button');
closeButtonCloned.classList.add('close-btn-cloned');
clonedSlidingInputView.appendChild(closeButtonCloned);
const closeButtonClonedIcon = document.createElement('span');
closeButtonClonedIcon.classList.add('material-icons', 'close-btn-cloned-icon');
closeButtonClonedIcon.textContent = `close`;

closeButtonCloned.appendChild(closeButtonClonedIcon);


closeButtonCloned.addEventListener(`click`, () => {
    clonedSlidingInputView.style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
});


//end of TEMPALTE ADD POP UP


//the add button in movable template
addButton.addEventListener('click', () => {
    clonedSlidingInputView.style.display = 'flex';
    document.getElementById('overlay').style.display = 'block';
    // alert('This button is under construction. Please bear with the developer. You can eat popcorn for now');
    console.log('Add button clicked');
});



deleteButton.addEventListener('dblclick', deleteFunction);
deleteButton.addEventListener('touchend', () => {
    handleTouchEnd(deleteFunction);
    console.log(`deleteButton`);
});

deselectTemplateBtn.addEventListener('dblclick', clearSelection);
deselectTemplateBtn.addEventListener('touchend', () => {
    handleTouchEnd(clearSelection);
});


function rgbToHex(rgb) {

    if (rgb.startsWith('#')) {
        return color;
    }
    //if transparent return ""
    if (!rgb) {
        // console.log(`color is undefined`);
        return "";
    }

    // Extract the RGB values and convert to hex
    const match = rgb.match(/\d+/g);
    if (match) {
        return `#${match.map(x => Number(x).toString(16).padStart(2, '0')).join('')}`;
    }

}

// Function to trigger the shake effect
function triggerShakeEffect() {
    deselectTemplateBtn.classList.add('shake-btn');
    selectedTaskCounter.classList.add('shake-btn'); // Add shake effect

    // Remove the class after the animation ends to allow for future shakes
    selectedTaskCounter.addEventListener('animationend', () => {
        selectedTaskCounter.classList.remove('shake-btn');
    });

    deselectTemplateBtn.addEventListener('animationend', () => {
        deselectTemplateBtn.classList.remove('shake-btn');
    });
}

function getDayName(value) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[value];
}
// format Month Names
function getMonthName(value) {
    switch (value) {
        case 0: return "JANUARY";
        case 1: return "FEBRUARY";
        case 2: return "MARCH";
        case 3: return "APRIL";
        case 4: return "MAY";
        case 5: return "JUNE";
        case 6: return "JULY";
        case 7: return "AUGUST";
        case 8: return "SEPTEMBER";
        case 9: return "OCTOBER";
        case 10: return "NOVEMBER";
        case 11: return "DECEMBER";
    }
}



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

monthLabelVertView.addEventListener('click', showCalHorView);
function showCalHorView() {
    console.log("Vert View Showing");

    // Make sure both elements exist
    const main = document.getElementById('main-container');
    const vert = document.getElementById('calendar-container-vert-view');

    if (!main || !vert) {
        console.error('One or both containers are missing in the DOM.');
        return;
    }

    main.style.display = 'block';
    vert.style.display = 'none'; // Assuming your flex styles are defined in CSS
}

function showCalVertView() {
    console.log("Vert View Showing");

    // Make sure both elements exist
    const main = document.getElementById('main-container');
    const vert = document.getElementById('calendar-container-vert-view');

    if (!main || !vert) {
        console.error('One or both containers are missing in the DOM.');
        return;
    }
    createCalendarGrid();
    updateCalendarWithTasks(currentMonthVertView, currentYearVertView);
    main.style.display = 'none';
    vert.style.display = 'flex'; // Assuming your flex styles are defined in CSS
}
