const yearContainer = document.getElementById('year-container');
let monthName = document.getElementById('month-name');
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
console.log(currentDateYear);
let currentDateFirstDay = getDayName(currentDate.getDay());
let currentDateLastDate = new Date(currentDateYear, currentDateMonth + 1, 0).getDate();

addDays("", 1 , currentDate.getDay(), currentDateLastDate, "", "", "" );

let nextDate = new Date(currentDateYear, currentDateMonth + 1, 1);
let nextDateMonth = nextDate.getMonth();
let nextDateYear = nextDate.getFullYear();
let nextDateLastDate = new Date(nextDateYear, nextDateMonth + 1, 0).getDate();

addDays("next", 1 , nextDate.getDay(), nextDateLastDate, "", "", "" );

let prevDate = new Date(currentDateYear, currentDateMonth - 1, 1);
let prevDateMonth = prevDate.getMonth();
console.log(prevDateMonth);
let prevDateYear = prevDate.getFullYear();
console.log(prevDateYear);
let prevDateLastDate = new Date(prevDateYear, prevDateMonth + 1, 0).getDate();

addDays("prev", 1 , prevDate.getDay(), prevDateLastDate, "", "", "" );

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



    addDays("prev", 1 , prevDate.getDay(), prevDateLastDate, "", "", "" );

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
    addDays("next", 1 , nextDate.getDay(), nextDateLastDate, "", "", "" );
    
    // console.log(`Scrolled to the bottom`);
    // console.log(`Current Month: ${currentDateMonth}, Last Date: ${currentDateLastDate}`);
    // console.log(`Next Month: ${nextDateMonth}, Last Date: ${nextDateLastDate}`);
  }
});


function addDays(scroll="", date = 1, day = 0, lastDateOfMonth = 0, morningTask = "", afternoonTask = "", eveningTask = "") {

    // const monthNameContainer = document.createElement('div');
    // monthNameContainer.classList.add('month-name-container');


    // let monthName = getMonthName();

    // let letters = monthName.split('');
    // monthNameContainer.innerHTML = '';
    // letters.forEach(letter => {
    //     let letterDiv = document.createElement('div');
    //     letterDiv.textContent = letter;
    //     monthNameContainer.appendChild(letterDiv);
    //   });
    // let dayName = 0;
    const monthContainer = document.createElement('div');
    for (i = 1; i <=lastDateOfMonth; i++) {

        const dayContainer = document.createElement('div');
        dayContainer.classList.add('day-container');

        const dateDiv = document.createElement('div');
        dateDiv.classList.add('date');
        dateDiv.textContent = date;

        const dayDiv = document.createElement('div');
        dayDiv.classList.add('day');
        dayDiv.textContent = getDayName(day%7);
        day++;

        const morningTaskDiv = document.createElement('div');
        morningTaskDiv.classList.add('morning');
        morningTaskDiv.textContent = morningTask;

        const afternoonTaskDiv = document.createElement('div');
        afternoonTaskDiv.classList.add('afternoon');
        afternoonTaskDiv.textContent = afternoonTask;

        const eveningTaskDiv = document.createElement('div');
        eveningTaskDiv.classList.add('evening');
        eveningTaskDiv.textContent = eveningTask;

        dayContainer.appendChild(dateDiv);
        dayContainer.appendChild(dayDiv);
        dayContainer.appendChild(morningTaskDiv);
        dayContainer.appendChild(afternoonTaskDiv);
        dayContainer.appendChild(eveningTaskDiv);
        monthContainer.appendChild(dayContainer);
        date = date + 1;



    }
    if (scroll==="" || scroll === "next") {
        nextMonthContainer = monthContainer;
        if (prevMonthContainer) prevMonthContainer.remove();
        yearContainer.appendChild(monthContainer);
    }
    else {
        prevMonthContainer = monthContainer;
        if(nextMonthContainer) nextMonthContainer.remove();
        const previousScrollHeight = yearContainer.scrollHeight;
        yearContainer.prepend(monthContainer);
        const newScrollHeight = yearContainer.scrollHeight;
        yearContainer.scrollTop += newScrollHeight - previousScrollHeight;
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

    // console.log(`new value for getDay is ${firstDayOfMonth}`);
    // switch (value) {
    //     case 0: return "Sun";
    //     case 1: return "Mon";
    //     case 2: return "Tue";
    //     case 3: return "Wed";
    //     case 4: return "Thu";
    //     case 5: return "Fri";
    //     case 6: return "Sat";
    //     default: return "Invalid";
    // }

    // function getDayName(dayNumber) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[value];
}

// format Month Names
function getMonthName(value) {
    switch (value) {
        case 0: return "January";
        case 1: return "February";
        case 2: return "March";
        case 3: return "April";
        case 4: return "May";
        case 5: return "June";
        case 6: return "July";
        case 7: return "August";
        case 8: return "September";
        case 9: return "October";
        case 10: return "November";
        case 11: return "December";
    }
}