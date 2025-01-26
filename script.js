const taskInput = document.getElementById('taskTitle');
const exitFullscreenBtn = document.getElementById(`exit-flscreen-button`);
const clearButton = document.getElementById('clear-button');
const floatingAddBtn = document.getElementById('floatingAddBtn');
const slidingInputView = document.getElementById('slidingInputView');
const submitTaskBtn = document.getElementById('submitTask');

const yearNameContainer = document.getElementById(`year-name-text-container`);
const yearContainer = document.getElementById('year-container');
const fullScreenButton = document.getElementById(`fullscreen-button`);

let isPopupOpen = false;

const inputField = document.querySelector('#taskTitle');

inputField.addEventListener('focus', () => {
    setTimeout(() => {
        inputField.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300); // Wait for the keyboard to appear
});



fullScreenButton.addEventListener(`click`, enterFullScreen);

let yearNameText = document.getElementById('year-name');
// let monthNameDayContainer = document.getElementById('month-name-day-container');
let currentMonthContainer = null;
let nextMonthContainer = null;
let prevMonthContainer = null;

// Get the current date details
let today = new Date();
let todayDayNumber = today.getDate();
let todayDay = getDayName(today.getDay());
let todayMonth = today.getMonth();
let todayYear = today.getFullYear();

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
console.log(prevDateMonth);
let prevDateYear = prevDate.getFullYear();
console.log(prevDateYear);
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
    } else if (scrollTop + clientHeight >= scrollHeight) {
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
    console.log(`current  is ${monthName}`);
    yearNameText.textContent = currentDateYear;
    let monthNameDayContainer = document.createElement('div');
    monthNameDayContainer.classList.add('month-name-day-container');

    const monthNameContainer = document.createElement('div');
    monthNameContainer.classList.add('month-name-container');

    let FormatMonthName = getMonthName(monthName % 12);
    console.log(FormatMonthName);
    let letters = FormatMonthName.split('');
    monthNameContainer.innerHTML = '';
    letters.forEach(letter => {
        let letterDiv = document.createElement('div');
        letterDiv.textContent = letter;
        monthNameContainer.appendChild(letterDiv);

        if (monthName % 2 == 0) {
            monthNameContainer.style.backgroundColor = '#82c6a2'; //lightgreen
        } else monthNameContainer.style.backgroundColor = '#53ab8b'; //darkgreen
    });
    const monthContainer = document.createElement('div');
    monthContainer.classList.add('month-container');
    let storedData = JSON.parse(localStorage.getItem('tasks')) || {};

    for (i = 1; i <= lastDateOfMonth; i++) {

        const dayContainer = document.createElement('div');
        dayContainer.classList.add('day-container');

        const dateDiv = document.createElement('div');
        dateDiv.classList.add('date');
        dateDiv.textContent = date;
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
        console.log(`current is init`);
    } else if (scroll === "initNext") {
        nextMonthContainer = monthNameDayContainer;
        yearContainer.appendChild(monthNameDayContainer);
        console.log(`next is init`);
    } else if (scroll === "initPrev") {
        prevMonthContainer = monthNameDayContainer;

        const previousScrollHeight = yearContainer.scrollHeight;
        yearContainer.prepend(monthNameDayContainer);
        const newScrollHeight = yearContainer.scrollHeight;
        yearContainer.scrollTop += newScrollHeight - previousScrollHeight;
        console.log(`prev is init`);
    }

}


// let currentMonthDisplay = addDays();
window.addEventListener('DOMContentLoaded', () => {

    // addDays(prevMonth);
    // addDays(currentMonth);
    // addDays(nextDate);
    // loadJobs();
    // loadExpenses();
    // loadBudget();
    // enterFullScreen();

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

    exitFullscreenBtn.style.display = `flex`;
    // Hide the yearNameContainer once fullscreen is entered
    yearNameContainer.style.display = 'none';

    slidingInputView.style.bottom = '-33%'; // Hide popup
// Reset button position and rotation
    floatingAddBtn.style.transform = 'rotate(0)'; 
    // Reset button color to green
    // floatingAddBtn.style.backgroundColor = '#4CAF50'; 
    floatingAddBtn.style.backgroundColor = 'rgba(76, 175, 80, 0.7)'; 

    // const slidingInputHeight = -(33 * window.innerHeight / 100);
    floatingAddBtn.style.bottom = `${20}px`;
    clearButton.style.bottom = `${80}px`;
    isPopupOpen = false;
}
// Exit fullscreen function
function exitFullscreen() {
    if (document.fullscreenElement) { // Check if fullscreen is active
        document.exitFullscreen()
            .then(() => console.log("Exited fullscreen"))
            .catch(err => console.error("Error exiting fullscreen:", err));
    } else {
        console.log("Fullscreen mode is not active");
    }
    exitFullscreenBtn.style.display = `none`;
}



document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        // When exiting fullscreen, show the yearNameContainer again
        yearNameContainer.style.display = 'flex';
        slidingInputView.style.bottom = '-33%'; // Hide popup

        floatingAddBtn.style.transform = 'rotate(0)'; // Reset button position and rotation
        floatingAddBtn.style.backgroundColor = 'rgba(76, 175, 80, 0.7)'; // Reset button color to green

        // const slidingInputHeight = -(33 * window.innerHeight / 100);
        floatingAddBtn.style.bottom = `${20}px`;
        clearButton.style.bottom = `${80}px`;
        isPopupOpen = false;
        exitFullscreenBtn.style.display = `none`;
    }
});



let selectedDivs = []; // Array to track selected divs
let chosenColor = '';  // Store the chosen color

// Event listener for selecting colors
document.querySelectorAll('.color-option').forEach(button => {
    button.addEventListener('click', () => {
        chosenColor = button.getAttribute('data-color'); // Get the selected color
        // Highlight the selected button
        document.querySelectorAll('.color-option').forEach(btn => btn.classList.remove('selected-color'));
        button.classList.add('selected-color');
    });
});

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
    }
});

submitTaskBtn.addEventListener('click', () => {
    const taskTitle = document.getElementById('taskTitle').value;

    if (taskTitle) {
        selectedDivs.forEach(div => {
            // Update task text
            div.textContent = taskTitle;

            // Apply the chosen color to the selected divs
            if (chosenColor) {
                div.style.backgroundColor = chosenColor; // Apply the selected color
            }

            // Save the task data (including color)
            const dayContainer = div.closest('.day-container');
            const date = dayContainer.querySelector('.date').getAttribute('data-full-date');
            const taskType = div.classList.contains('morningTask') ? 'morning' :
                div.classList.contains('afternoonTask') ? 'afternoon' : 'evening';

            saveTaskData(date, taskType, taskTitle, chosenColor); // Pass color along with other task data
        });

        // Clear selection and reset styles
        selectedDivs.forEach(div => div.classList.remove('selected'));
        selectedDivs = []; // Clear the array

        // Reset inputs and hide the sliding input view
        document.getElementById('taskTitle').value = '';
        slidingInputView.style.bottom = '-33%'; // Hide popup
        floatingAddBtn.style.transform = 'rotate(0)'; // Reset button
        floatingAddBtn.style.backgroundColor = 'rgba(76, 175, 80, 0.7)'; // Reset button color
        // const slidingInputHeight = -(33 * window.innerHeight / 100);
        floatingAddBtn.style.bottom = `${20}px`;
        clearButton.style.bottom = `${80}px`;
        isPopupOpen = false;
    } else {
        slidingInputView.style.bottom = '-33%'; // Hide popup
        floatingAddBtn.style.transform = 'rotate(0)'; // Reset button
        floatingAddBtn.style.backgroundColor = 'rgba(76, 175, 80, 0.7)'; // Reset button color
        // const slidingInputHeight = -(33 * window.innerHeight / 100);
        floatingAddBtn.style.bottom = `${20}px`;
        clearButton.style.bottom = `${80}px`;
        isPopupOpen = false;
    }
});




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



clearButton.addEventListener('click', () => {
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
            storedData[fullDate][taskType] = { task: '', color: '' }; // Clear task and color for this type

            if (!storedData[fullDate].morning.task && !storedData[fullDate].afternoon.task && !storedData[fullDate].evening.task) {
                delete storedData[fullDate]; // Remove date if no tasks are left
            }
        }



        // Store the updated data back to localStorage
        localStorage.setItem('tasks', JSON.stringify(storedData));

        // Clear the UI data as well
        selectedDiv.textContent = ''; // Clear task text
        selectedDiv.style.backgroundColor = ''; // Remove background color
    });

    // Clear the selected divs list and update the UI
    selectedDivs.forEach(div => div.classList.remove('selected')); // Remove selected class
    selectedDivs = []; // Clear the array of selected divs

    // Optionally reset UI elements (like task title input and any other related UI)
    document.getElementById('taskTitle').value = ''; // Reset task input field
    slidingInputView.style.bottom = '-33%'; // Hide sliding input view (or adjust to your logic)
    floatingAddBtn.style.transform = 'rotate(0)'; // Reset add button
    floatingAddBtn.style.backgroundColor = 'rgba(76, 175, 80, 0.7)'; // Reset add button color
    floatingAddBtn.style.bottom = `${20}px`; // Reset button position
    clearButton.style.bottom = `${80}px`; // Reset clear button position
    isPopupOpen = false; // Optional: Reset any state flags
});




floatingAddBtn.addEventListener('click', () => {
    isPopupOpen = !isPopupOpen;

    if (isPopupOpen) {
        slidingInputView.style.bottom = '0'; // Show popup

        floatingAddBtn.style.transform = 'rotate(225deg)'; //rotate button
        // floatingAddBtn.style.backgroundColor = '#f44336'; 
        // Change button color to red
        floatingAddBtn.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';

        // Adjust the button positions based on the sliding input view
        const slidingInputHeight = 33 * window.innerHeight / 100;
        floatingAddBtn.style.bottom = `${slidingInputHeight+10}px`;
        clearButton.style.bottom = `${slidingInputHeight + 70}px`;
    } else {
        slidingInputView.style.bottom = '-33%'; // Hide popup

        floatingAddBtn.style.transform = 'rotate(0)'; // Reset button position and rotation
        floatingAddBtn.style.backgroundColor = 'rgba(76, 175, 80, 0.7)'; // Reset button color to green

        // const slidingInputHeight = -(33 * window.innerHeight / 100);
        floatingAddBtn.style.bottom = `${20}px`;
        clearButton.style.bottom = `${80}px`;
    }
});

window.addEventListener('popstate', () => {
    if (taskInput) {
        taskInput.blur(); // Remove focus from the input field
    }
});