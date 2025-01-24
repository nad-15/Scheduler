const yearContainer = document.getElementById('year-container');
let monthName = document.getElementById('month-name');
// const daysContainer = document.getElementById('days-container');
// appTitle = document.getElementById('app-title');
let lastScrollTop =0;
yearContainer.addEventListener('scroll', () =>{
    const scrollTop = yearContainer.scrollTop;
    const scrollHeight = yearContainer.scrollHeight;
    const clientHeight =yearContainer.clientHeight;

    if(scrollTop === 0){
        //call prepend function here
        console.log(`scrolled to the top`);

        addDays("prev",0);
    } else if (scrollTop + clientHeight >= scrollHeight){
        //call append function here
        addDays("next",2);
        console.log(`scroll to the bottom`);
    }
    // lastScrollTop = scrollTop;
});

let currentDate = new Date();
let currentDayNumber = currentDate.getDate();
let currentDay = getDayName(currentDate.getDay());
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();

monthName.textContent = getMonthName(currentMonth);

const today = new Date();
const day = today.getDay();
const date = today.getDate();
const month = today.getMonth();
const year = today.getFullYear();

// console.log(day);
// console.log(date);
// console.log(month);
// console.log(year);

const currentCalendarDate = new Date(year, month, 1);
let firstDayOfMonth = currentCalendarDate.getDay();

const nextCalendarDate = new Date(year, month + 1, 0);
let lastDayOfMonth = nextCalendarDate.getDate();

// console.log(firstDayOfMonth);
// console.log(lastDayOfMonth);


function getDayName(value) {

    // console.log(`new value for getDay is ${firstDayOfMonth}`);
    switch(value) {
        case 0: return "Sun";
        case 1: return "Mon";
        case 2: return "Tue";
        case 3: return "Wed";
        case 4: return "Thu";
        case 5: return "Fri";
        case 6: return "Sat";
        default: return "Invalid";
    }
}

// format Month Names
function getMonthName(value) {
    switch(value) {
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

    function addDays(scroll="", date = 1, day = getDayName(firstDayOfMonth%7), morningTask = "", afternoonTask = "", eveningTask = "") {

        const monthContainer = document.createElement('div');
        for (i = 1; i <=lastDayOfMonth; i++) {

            const dayContainer = document.createElement('div');
            dayContainer.classList.add('day-container');

            const dateDiv = document.createElement('div');
            dateDiv.classList.add('date');
            dateDiv.textContent = date;

            const dayDiv = document.createElement('div');
            dayDiv.classList.add('day');
            dayDiv.textContent = day;

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

            firstDayOfMonth++;
            day = getDayName(firstDayOfMonth%7);

        }
        if (scroll==="" || scroll === "next") {
            yearContainer.appendChild(monthContainer);
        }
        else {
            const previousScrollHeight = yearContainer.scrollHeight;
            yearContainer.prepend(monthContainer);
            const newScrollHeight = yearContainer.scrollHeight;
            yearContainer.scrollTop += newScrollHeight - previousScrollHeight;
        }

    }
    // let currentMonthDisplay = addDays();
    addDays("" , 1);


