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




const jobTemplateContainer = document.querySelector(`.job-template-container`);

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

let isPopupOpen = false;

taskInput.addEventListener('focus', () => {
    const isFullScreen = window.innerHeight === screen.height; // Check if full screen
    const delay = isFullScreen ? 1500 : 500; // Set delay based on full screen status

    setTimeout(() => {
        taskInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, delay);
});



window.addEventListener('popstate', () => {
    if (taskInput) {
        taskInput.blur(); // Remove focus from the input field
        console.log(`popstate`);
    }
});


fullScreenButton.addEventListener(`click`, enterFullScreen);

let todayNameText = document.getElementById('today-name');
todayNameText.addEventListener('click', () => {
    location.reload()
});

// let monthNameDayContainer = document.getElementById('month-name-day-container');
let currentMonthContainer = null;
let nextMonthContainer = null;
let prevMonthContainer = null;

const todayDateObj= new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' });

// Convert it back to a Date object
const  today = new Date(todayDateObj);

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

        // console.log(`Scrolled to the top`);
        // console.log(`Current Month: ${currentDateMonth}, Last Date: ${currentDateLastDate}`);
        // console.log(`Previous Month: ${prevDateMonth}, Last Date: ${prevDateLastDate}`);
    } else if (scrollTop + clientHeight >= scrollHeight - 10) {
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

        // console.log(`Scrolled to the bottom`);
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
    if (monthName % 2 == 0) {
        monthNameContainer.style.backgroundColor = '#82c6a2'; // Light green
    } else {
        monthNameContainer.style.backgroundColor = '#53ab8b'; // Dark green
    }

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
        //make sun and sat differenct colors and bigger
        // Get the day name
        const dayName = getDayName(day % 7);

        // Make Sunday and Saturday different colors and bigger
        if (dayName === 'Sun' || dayName === 'Sat') {
            dayDiv.style.fontSize = "12px";
            dayDiv.style.fontWeight = "bold";
            dayDiv.style.color = "white";
            dayDiv.style.borderColor = ""; // Make the font larger
            if (dayName === 'Sun') {
                // dayDiv.style.color = "red"; // Set the color for Sunday
                dayDiv.style.backgroundColor = "#e57373"; //red
                dateDiv.style.color = "red"; //red
                // dayDiv.style.borderColor = "#e57373";

            } else {
                // dayDiv.style.color = "blue";
                dayDiv.style.backgroundColor = "#3388cc";
                dateDiv.style.color = "blue";// Set the color for Saturday
                // dayDiv.style.borderColor = "#3388cc";
            }
        }

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
            // console.log(`prev is remove`);
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
            // console.log(`next is remove`);
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

}


window.addEventListener('DOMContentLoaded', () => {
    loadTemplate();
    getWeather();
});


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
        // slidingInputView.classList.toggle("show");

        // floatingAddBtn.style.transform = 'rotate(0)'; // Reset button position and rotation
        // floatingAddBtn.style.backgroundColor = 'rgba(76, 175, 80, 0.7)'; // Reset button color to green

        // const slidingInputHeight = -(33 * window.innerHeight / 100);
        // floatingAddBtn.style.bottom = `${20}px`;
        // clearButton.style.bottom = `${80}px`;
        // isPopupOpen = true;
        exitFullscreenBtn.style.display = `none`;
    }
});




let selectedDivs = []; // Array to track selected divs
let chosenColor = '#e27396';  // Store the chosen color
const selectedTaskCounter = document.querySelector(`.selected-task`);

// selectedTaskCounter.addEventListener('dblclick', () => {
//     selectedDivs.forEach(div => div.classList.remove('selected')); // Remove selected class
//     selectedDivs = []; // Clear the array of selected divs
//     selectedTaskCounter.textContent = `${selectedDivs.length}`;
// });


// Event listener for selecting colors
document.querySelectorAll('.color-option').forEach(button => {
    button.addEventListener('click', () => {
        chosenColor = button.getAttribute('data-color'); // Get the selected color
        // Highlight the selected button
        document.querySelectorAll('.color-option').forEach(btn => btn.classList.remove('selected-color'));
        button.classList.add('selected-color');
        flower.style.color = chosenColor;
    });
});

//add click listeners to task divs
yearContainer.addEventListener('click', (event) => {
    const taskElement = event.target.closest('.morningTask, .afternoonTask, .eveningTask');

    if (taskElement) {
        // Toggle selection of task div
        if (selectedDivs.includes(taskElement)) {
            selectedDivs = selectedDivs.filter(div => div !== taskElement);
            taskElement.classList.remove('selected');
        } else {
            selectedDivs.push(taskElement);
            taskElement.classList.add('selected');
        }

        selectedTaskCounter.textContent = `${selectedDivs.length}`;
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

// Function to trigger the shake effect
function triggerShakeEffect() {
    selectedTaskCounter.classList.add('shake-btn'); // Add shake effect

    // Remove the class after the animation ends to allow for future shakes
    selectedTaskCounter.addEventListener('animationend', () => {
        selectedTaskCounter.classList.remove('shake-btn');
    });
}


// Start observing changes in the text of selectedTaskCounter
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

            addTemplate(taskTitle);
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
        selectedTaskCounter.textContent = `${selectedDivs.length}`;

        // Reset inputs and hide the sliding input view
        document.getElementById('taskTitle').value = '';
        isPopupOpen = true;
    } else {
        triggerShakeEffect();
    }

}

function addTemplate(taskTitle) {

    //save task template here
    if (taskTitle !== ``) {

        const taskTemplate = {
            text: taskTitle,
            color: chosenColor
        };

        // Check if the task already exists in the array
        const taskExists = taskClipboard.some(task => task.text === taskTemplate.text && task.color === taskTemplate.color);

        if (!taskExists) {
            // If the task doesn't exist, push it to the array
            taskClipboard.push(taskTemplate);

            // Create the div and append it to the container
            const itemDiv = document.createElement('div');
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

jobTemplateContainer.addEventListener('dblclick', (event) => {
    if (event.target.classList.contains('items')) {
        removeTemplate(event.target);
    }
});

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

        selectedTaskCounter.textContent = `${selectedDivs.length}`;

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

function rgbToHex(rgb) {
    const match = rgb.match(/\d+/g); // Extract numbers
    return `#${match.map(x => Number(x).toString(16).padStart(2, '0')).join('')}`;
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
    if (!storedData[date]) {
        // If the date doesn't exist, initialize it with empty tasks and colors
        storedData[date] = {
            morning: { task: '', color: '' },
            afternoon: { task: '', color: '' },
            evening: { task: '', color: '' }
        };
    }

    // Update the task and color for the specific type (morning, afternoon, or evening)
    storedData[date][taskType] = { task: updatedTask, color: taskColor };

    // Store the updated data back to localStorage
    localStorage.setItem('tasks', JSON.stringify(storedData));

    console.log(`Saved task for ${taskType} on ${date}: ${updatedTask} with color ${taskColor}`);
}















// let lastTapTime = 0;
// const delay = 300;
// clearButton.addEventListener(`touchend`, touchEnd);

// function touchEnd() {

//     let currentTime = Date.now();

//     if (currentTime - lastTapTime < delay) {
//         deleteFunction();
//     }

//     lastTapTime = currentTime;

// }


selectedTaskCounter.addEventListener('dblclick', () => {
    selectedDivs.forEach(div => div.classList.remove('selected')); // Remove selected class
    selectedDivs = []; // Clear the array of selected divs
    selectedTaskCounter.textContent = `${selectedDivs.length}`;
});


// Declare these variables once
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

// selectedTaskCounter touchend
selectedTaskCounter.addEventListener('touchend', () => {
    handleTouchEnd(() => {
        selectedDivs.forEach(div => div.classList.remove('selected')); // Remove selected class
        selectedDivs = []; // Clear the array of selected divs
        selectedTaskCounter.textContent = `${selectedDivs.length}`;
    });
}); 

// clearButton touchend
clearButton.addEventListener('touchend', () => {
    handleTouchEnd(deleteFunction);
});

jobTemplateContainer.addEventListener('touchend', (event) => {
    handleTouchEnd(() => {
        if (event.target.classList.contains('items')) {
            removeTemplate(event.target);
        }
    });
});















clearButton.addEventListener('dblclick', deleteFunction);

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
            console.log(`deletefunciton deleting ${storedData[fullDate]}`);
            storedData[fullDate][taskType] = { task: '', color: '' }; // Clear task and color for this type

            if (!storedData[fullDate].morning.task && !storedData[fullDate].afternoon.task && !storedData[fullDate].evening.task) {
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
    selectedTaskCounter.textContent = `${selectedDivs.length}`;

    // Optionally reset UI elements (like task title input and any other related UI)
    // document.getElementById('taskTitle').value = ''; // Reset task input field
    // slidingInputView.classList.toggle("show");
    // floatingAddBtn.style.transform = 'rotate(0)'; // Reset add button
    // floatingAddBtn.style.backgroundColor = 'rgba(76, 175, 80, 0.7)'; // Reset add button color
    // floatingAddBtn.style.bottom = `${20}px`; // Reset button position
    // clearButton.style.bottom = `${80}px`; // Reset clear button position
    // isPopupOpen = true; 
}




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