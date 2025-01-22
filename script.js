const monthContainer = document.getElementById('month-container');
// const daysContainer = document.getElementById('days-container');
// appTitle = document.getElementById('app-title');

const today = new Date();
const day = today.getDay();
const date = today.getDate();
const month = today.getMonth();
const year = today.getFullYear();

console.log(day);
console.log(date);
console.log(month);
console.log(year);

const currentCalendarDate = new Date(year, month, 1);
let firstDayOfMonth = currentCalendarDate.getDay();

const nextCalendarDate = new Date(year, month + 1, 0);
let lastDayOfMonth = nextCalendarDate.getDate();

console.log(firstDayOfMonth);
console.log(lastDayOfMonth);

function getDayName(value) {

    console.log(`value is ${firstDayOfMonth}`);
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

    console.log(`value is ${firstDayOfMonth}`);
}

    function addDays(date = "1", day = getDayName(firstDayOfMonth%7), morningTask = "", afternoonTask = "", eveningTask = "") {


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
            date = parseInt(date) + 1;

            firstDayOfMonth++;
            day = getDayName(firstDayOfMonth%7);

        }
    }
    addDays();
