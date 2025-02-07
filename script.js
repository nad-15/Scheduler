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
    clearButton.style.display = clearButton.style.display === 'none' ? 'flex' : 'none';
    floatingAddBtn.style.display = floatingAddBtn.style.display === 'none' ? '' : 'none';
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


function addDays(scroll = "", monthName = 0, date = 1, day = 0, lastDateOfMonth = 0, morningTask = "", afternoonTask = "", eveningTask = "", yearDate) {

    let monthNameDayContainer = document.createElement('div');
    monthNameDayContainer.classList.add('month-name-day-container');


    const monthNameContainer = document.createElement('div');
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
        monthContainer.style.pointerEvents = "none"; // Disable interaction for the month container
        icon.textContent = "lock"; // Change icon to locked
    }

    // Lock/Unlock functionality
    lockButton.addEventListener("click", () => {
        isLocked = !isLocked; // Toggle the lock state

        if (isLocked) {
            console.log(`${FormatMonthName} is locked`);
            monthContainer.style.pointerEvents = "none"; // Disable interaction for the month container
            icon.textContent = "lock"; // Change icon to locked
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

        const morningTaskDiv = document.createElement('div');
        morningTaskDiv.classList.add('morningTask');
        if (taskData && taskData.morning) {
            morningTaskDiv.textContent = taskData.morning.task; // Set the task text
            morningTaskDiv.style.backgroundColor = taskData.morning.color;
            // morningTaskDiv.style.border = `.5px solid ${taskData.morning.color}`;  // Set the task color
        } else {
            morningTaskDiv.textContent = morningTask; // Use default task text
        }

        // morningTaskDiv.textContent = taskData ? taskData.morning : morningTask;
        // morningTaskDiv.textContent = morningTask;

        const afternoonTaskDiv = document.createElement('div');
        afternoonTaskDiv.classList.add('afternoonTask');
        if (taskData && taskData.afternoon) {
            afternoonTaskDiv.textContent = taskData.afternoon.task; // Set the task text
            afternoonTaskDiv.style.backgroundColor = taskData.afternoon.color;
            // afternoonTaskDiv.style.border = `.5px solid ${taskData.afternoon.color}`// Set the task color
        } else {
            afternoonTaskDiv.textContent = afternoonTask; // Use default task text
        }
        // afternoonTaskDiv.textContent = afternoonTask;
        // afternoonTaskDiv.textContent = taskData ? taskData.afternoon : afternoonTask;

        const eveningTaskDiv = document.createElement('div');
        eveningTaskDiv.classList.add('eveningTask');
        if (taskData && taskData.evening) {
            eveningTaskDiv.textContent = taskData.evening.task; // Set the task text
            eveningTaskDiv.style.backgroundColor = taskData.evening.color;
            // eveningTaskDiv.style.border = `.5px solid ${taskData.evening.color}`// Set the task color
        } else {
            eveningTaskDiv.textContent = eveningTask; // Use default task text
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
let chosenColor = '#c2185b';


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
    const taskElement = event.target.closest('.morningTask, .afternoonTask, .eveningTask');

    if (taskElement) {
        // Toggle selection of task div
        if (selectedDivs.includes(taskElement)) {
            selectedDivs = selectedDivs.filter(div => div !== taskElement); //learn
            taskElement.classList.remove('selected');
            // console.log(`colored`);
            // console.log(`Color of Selected Task: ${taskElement.style.backgroundColor ? taskElement.style.backgroundColor : 'none'}`);

            // console.log(getComputedStyle(taskElement).backgroundColor);

        } else {
            selectedDivs.push(taskElement);
            taskElement.classList.add('selected');
            // console.log(`colored`);
            // console.log(`Color of Selected Task: ${taskElement.style.backgroundColor ? taskElement.style.backgroundColor : 'none'}`);

            // console.log(getComputedStyle(taskElement).backgroundColor);
        }

        // selectedTaskCounter.textContent = `${selectedDivs.length}`;
        // deselectTemplateBtn.textContent = `${selectedDivs.length}`;

        [selectedTaskCounter, deselectTemplateBtn].forEach(el => el.textContent = selectedDivs.length);


    }
});

const counterObserver = new MutationObserver(() => {
    if (parseInt(selectedTaskCounter.textContent) > 0) {
        submitTaskBtn.classList.remove('disabled-btn'); // Remove disabled styling
        selectedTaskCounter.classList.add(`selection-true`);
        // submitTaskBtn.disabled = false;
        // selectedTaskCounter.classList.remove('shake-btn'); // Remove shake effect when counter is > 0
    } else {
        submitTaskBtn.classList.add('disabled-btn'); // Add disabled styling
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
    // (taskTitle || chosenColor != ``) && 
    if (selectedDivs.length > 0) {
        selectedDivs.forEach(div => {

            //add
            let taskTitle = document.getElementById('taskTitle').value;

            // Update task text
            if (taskTitle !== ``) {
                div.textContent = taskTitle;
            } else {
                taskTitle = div.textContent;
            }

            addTemplate(taskTitle, chosenColor);
            // Apply the chosen color to the selected divs
            // if (chosenColor) {
            div.style.backgroundColor = chosenColor; // Apply the selected color
            // }

            // Save the task data (including color)
            const dayContainer = div.closest('.day-container');
            const date = dayContainer.querySelector('.date').getAttribute('data-full-date');
            const taskType = div.classList.contains('morningTask') ? 'morning' :
                div.classList.contains('afternoonTask') ? 'afternoon' : 'evening';


            saveTaskData(date, taskType, taskTitle, chosenColor); // Pass color along with other task data
        });

        // Clear selection and reset styles
        // selectedDivs.forEach(div => div.classList.remove('selected'));
        // selectedDivs = []; // Clear the array


        // selectedTaskCounter.textContent = `${selectedDivs.length}`;
        // deselectTemplateBtn.textContent = `${selectedDivs.length}`;

        [selectedTaskCounter, deselectTemplateBtn].forEach(el => el.textContent = selectedDivs.length);


        // Reset inputs and hide the sliding input view
        document.getElementById('taskTitle').value = '';
        // isPopupOpen = true;
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
        selectedDivs.forEach(div => {

            div.textContent = taskText;
            div.style.backgroundColor = taskColor;

            const dayContainer = div.closest('.day-container');
            const date = dayContainer.querySelector('.date').getAttribute('data-full-date');
            const taskType = div.classList.contains('morningTask') ? 'morning' :
                div.classList.contains('afternoonTask') ? 'afternoon' : 'evening';


            saveTaskData(date, taskType, taskText, taskColor); // Pass color along with other task data
        });

        // selectedTaskCounter.textContent = `${selectedDivs.length}`;
        // deselectTemplateBtn.textContent = `${selectedDivs.length}`;

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


function saveTaskData(date, taskType, updatedTask, taskColor) {
    // Get the current data from localStorage (or initialize as an empty object if not yet saved)
    let storedData = JSON.parse(localStorage.getItem('tasks')) || {};

    // Check if the date already exists in stored data
    if (!storedData.hasOwnProperty(date)) {
        // If the date doesn't exist, initialize it with empty tasks and colors
        storedData[date] = {
            morning: { task: '', color: '' },
            afternoon: { task: '', color: '' },
            evening: { task: '', color: '' }
        };
    }

    if (taskColor === "" && updatedTask === "") {
        storedData[date][taskType] = { task: '', color: '' }; // Clear task and color for this type

        if (isEmptyTasks(storedData[date])) {
            delete storedData[date];
        }
    } else {
        // Update the task and color for the specific type (morning, afternoon, or evening)
        storedData[date][taskType] = { task: updatedTask, color: taskColor };
            // Store the updated data back to localStorage
    }

    localStorage.setItem('tasks', JSON.stringify(storedData));
    // console.log(`Saved task for ${taskType} on ${date}: ${updatedTask} with color ${taskColor}`);
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
    // Loop through selected divs and clear their saved data
    selectedDivs.forEach(selectedDiv => {
        const dayContainer = selectedDiv.closest('.day-container');
        const fullDate = dayContainer.querySelector('.date').getAttribute('data-full-date');

        // Get current data from localStorage
        let storedData = JSON.parse(localStorage.getItem('tasks')) || {};

        // Remove the specific task data (morning, afternoon, evening) from the selected div
        const taskType = selectedDiv.classList.contains('morningTask') ? 'morning' :
            selectedDiv.classList.contains('afternoonTask') ? 'afternoon' : 'evening';

        // Check if the data for this date exists, then remove the task data
        if (storedData[fullDate]) {
            console.log(`Deleted Task: ${storedData[fullDate][taskType].task} on ${fullDate}`);
            console.log(`Deleted Color: ${storedData[fullDate][taskType].color} on ${fullDate}`);
            storedData[fullDate][taskType] = { task: '', color: '' }; // Clear task and color for this type

            if (isEmptyTasks(storedData[fullDate])) {
                console.log(`deleteFunction deleting ALL task on ${fullDate}`);
                delete storedData[fullDate]; // Remove date if no tasks are left
            }
        }



        // Store the updated data back to localStorage
        localStorage.setItem('tasks', JSON.stringify(storedData));

        // Clear the UI data as well
        selectedDiv.textContent = ''; // Clear task text
        selectedDiv.style.backgroundColor = '';         // Remove background color


    });

    // Clear the selected divs list and update the UI
    selectedDivs.forEach(div => div.classList.remove('selected')); // Remove selected class
    selectedDivs = []; // Clear the array of selected divs

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
        floatingAddBtn.style.bottom = `${130 + 10}px`;
        clearButton.style.bottom = `${130 + 70}px`;
    } else {
        slidingInputView.classList.toggle("show");

        floatingAddBtn.style.transform = 'rotate(0)'; // Reset button position and rotation
        floatingAddBtn.style.backgroundColor = 'rgba(76, 175, 80, 0.7)'; // Reset button color to green

        // const slidingInputHeight = -(33 * window.innerHeight / 100);
        floatingAddBtn.style.bottom = `${20}px`;
        clearButton.style.bottom = `${80}px`;
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


let chosenColorTemplate = `#c2185b`;
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


