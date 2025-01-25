const floatingAddBtn = document.getElementById('floatingAddBtn');
const slidingInputView = document.getElementById('slidingInputView');
const submitTaskBtn = document.getElementById('submitTask');

const yearNameContainer = document.getElementById(`year-name-text-container`);
const yearContainer = document.getElementById('year-container');
const fullScreenButton = document.getElementById(`fullscreen-button`);

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
        if(monthName%2==0){
            monthNameContainer.style.backgroundColor = '#157759'; //darkgreen
        } else monthNameContainer.style.backgroundColor = '#53ab8b'; //lightgreen
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
        dayDiv.textContent = getDayName(day % 7);

        const taskData = storedData[`${yearDate}-${monthName}-${date}`];

        const morningTaskDiv = document.createElement('div');
        morningTaskDiv.classList.add('morningTask');
        morningTaskDiv.textContent = taskData ? taskData.morning : morningTask;
        // morningTaskDiv.textContent = morningTask;

        const afternoonTaskDiv = document.createElement('div');
        afternoonTaskDiv.classList.add('afternoonTask');
        // afternoonTaskDiv.textContent = afternoonTask;
        afternoonTaskDiv.textContent = taskData ? taskData.afternoon : afternoonTask;

        const eveningTaskDiv = document.createElement('div');
        eveningTaskDiv.classList.add('eveningTask');
        eveningTaskDiv.textContent = taskData ? taskData.evening : eveningTask;
        // eveningTaskDiv.textContent = eveningTask;
        date = date + 1;
        dayContainer.appendChild(dateDiv);
        dayContainer.appendChild(dayDiv);
        dayContainer.appendChild(morningTaskDiv);
        dayContainer.appendChild(afternoonTaskDiv);
        dayContainer.appendChild(eveningTaskDiv);
        monthContainer.appendChild(dayContainer);
         //created 1-30 days
         if(getDayName(day % 7) === "Sat"){
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


function enterFullScreen() {
    const docElement = document.documentElement;
    if (docElement.requestFullscreen) {
        docElement.requestFullscreen();
    } else if (docElement.webkitRequestFullscreen) {
        docElement.webkitRequestFullscreen(); // Safari
    } else if (docElement.msRequestFullscreen) {
        docElement.msRequestFullscreen(); // IE/Edge
    }
// Hide the yearNameContainer once fullscreen is entered
    yearNameContainer.style.display = 'none';
}

document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        // When exiting fullscreen, show the yearNameContainer again
        yearNameContainer.style.display = 'flex';
    }
});


// addClickListeners(); //put it in its proper place later
// function addClickListeners() {
//     console.log(`listener is called`);

//     // Use event delegation by adding the listener to the container
//     yearContainer.addEventListener('click', (event) => {
//         const taskElement = event.target.closest('.morningTask, .afternoonTask, .eveningTask');

//         if (taskElement) {
//             // Get the parent container (day container) of the clicked task
//             const dayContainer = taskElement.closest('.day-container');

//             const date = dayContainer.querySelector('.date').getAttribute('data-full-date');
//             console.log(date);
//             const morningTask = dayContainer.querySelector('.morningTask').textContent;
//             const afternoonTask = dayContainer.querySelector('.afternoonTask').textContent;
//             const eveningTask = dayContainer.querySelector('.eveningTask').textContent;

//             // Show a popup to input tasks
//             let newMorning = prompt("Enter morning task:", morningTask);
//             let newAfternoon = prompt("Enter afternoon task:", afternoonTask);
//             let newEvening = prompt("Enter evening task:", eveningTask);

//             // Update the task divs with the new data
//             dayContainer.querySelector('.morningTask').textContent = newMorning;
//             dayContainer.querySelector('.afternoonTask').textContent = newAfternoon;
//             dayContainer.querySelector('.eveningTask').textContent = newEvening;

//             // Save updated tasks using saveData
//             saveTaskData(date, newMorning, newAfternoon, newEvening);
//             console.log(date);

//         }
//     });
// }

function addClickListeners() {
    console.log('listener is called');

    // Get the parent container of all tasks (you can replace `yearContainer` with the actual parent container)

    // Event delegation: Listen for clicks on the parent container
    yearContainer.addEventListener('click', (event) => {
        // Check if the clicked element is a task (morning, afternoon, or evening)
        const taskElement = event.target.closest('.morningTask, .afternoonTask, .eveningTask');

        if (taskElement) {
            // Get the parent container (day container) of the clicked task
            const dayContainer = taskElement.closest('.day-container');
            const date = dayContainer.querySelector('.date').getAttribute('data-full-date');
            const taskType = taskElement.classList.contains('morningTask') ? 'morning' :
                             taskElement.classList.contains('afternoonTask') ? 'afternoon' : 'evening';

            // Get the current task text based on the task type
            const currentTask = taskElement.textContent;

            // Prompt to update task
            const updatedTask = prompt(`Enter ${taskType} task:`, currentTask);

            // Update the task in the DOM based on the task type
            if (updatedTask !== null) {
                taskElement.textContent = updatedTask;

                // Save updated task data (for the specific task type)
                saveTaskData(date, taskType, updatedTask);
            }
        }
    });
}

function saveTaskData(date, taskType, updatedTask) {
    // Get the current data from localStorage (or initialize as an empty object if not yet saved)
    let storedData = JSON.parse(localStorage.getItem('tasks')) || {};
    
    // Check if the date already exists in stored data
    if (!storedData[date]) {
        // If the date doesn't exist, initialize it with empty tasks
        storedData[date] = {
            morning: '',
            afternoon: '',
            evening: ''
        };
    }

    // Update the task for the specific type (morning, afternoon, or evening)
    storedData[date][taskType] = updatedTask;

    // Store the updated data back to localStorage
    localStorage.setItem('tasks', JSON.stringify(storedData));
    
    console.log(`Saved task for ${taskType} on ${date}: ${updatedTask}`);
}




// function saveTaskData(date, morningTask, afternoonTask, eveningTask) {
//     // Get the current data from localStorage (or initialize as empty object if not yet saved)
//     let storedData = JSON.parse(localStorage.getItem('tasks')) || {};
//     console.log(date);
//     // Save the new tasks under the specific date (e.g., "2025-01-20")
//     storedData[date] = {
//         morning: morningTask,
//         afternoon: afternoonTask,
//         evening: eveningTask,
//     };

//     // Store the updated data back to localStorage
//     localStorage.setItem('tasks', JSON.stringify(storedData));

// }

// Track popup state
let isPopupOpen = false;

floatingAddBtn.addEventListener('click', () => {
  isPopupOpen = !isPopupOpen;

  if (isPopupOpen) {
    slidingInputView.style.bottom = '0'; // Show popup
    floatingAddBtn.style.transform =  'rotate(225deg)'; //rotate button
    floatingAddBtn.style.backgroundColor = '#f44336'; // Change button color to red
  } else {
    slidingInputView.style.bottom = '-33%'; // Hide popup
    floatingAddBtn.style.transform = 'rotate(0)'; // Reset button position and rotation
    floatingAddBtn.style.backgroundColor = '#4CAF50'; // Reset button color to green
  }
});

submitTaskBtn.addEventListener('click', () => {
  const taskTitle = document.getElementById('taskTitle').value;

  if (taskTitle) {
    // Simulate task submission logic
    console.log(`Task Added: ${taskTitle}`);

    // Reset inputs and hide the sliding input view
    document.getElementById('taskTitle').value = '';
    slidingInputView.style.bottom = '-33%'; // Slide down popup
    floatingAddBtn.style.transform = 'translateY(0) rotate(0)'; // Reset button
    floatingAddBtn.style.backgroundColor = '#4CAF50'; // Reset button color
    isPopupOpen = false;
  } else {
    alert('Please enter a task title.');
  }
});
// window.addEventListener('DOMContentLoaded', () => {
    // Load tasks from localStorage
    // loadTasks();

    // Add click event listeners to the task divs
addClickListeners();
// });

