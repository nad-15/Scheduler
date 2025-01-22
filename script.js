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

const currentCalendarDate = new Date(year, month + 2, 0);
const firstDayOfMonth = currentCalendarDate.getDate();

console.log(firstDayOfMonth);

function addDays(date = "1", day = "Sun", morningTask = "", afternoonTask = "", eveningTask = "") {

    for (i = 1; i < 30; i++) {
        const dayContainer = document.createElement('div');
        dayContainer.classList.add('day-container');

        const dateDiv = document.createElement('div');
        dateDiv = classList.add('date');
        dateDiv.textContent = date;

        const dayDiv = createElement('div');
        dayDiv = classList.add('day');
        dayDiv.textContent = day;

        const morningTaskDiv = document.createElement('div');
        morningTaskDiv.classList.add('morning');
        morningTaskDiv.textContent = morningTask;

        const afternoonTaskDiv = document.createElement('div');
        afternoonTaskDiv.classList.add('afternoon');
        afternoonTaskDiv.textContent = morningTask;

        const eveningTaskDiv = document.createElement('div');
        eveningTaskDiv.classList.add('evening');
        eveningTaskDiv.textContent = morningTask;


        dayContainer.appendChild(dateDiv);
        dayContainer.appendChild(dayDiv);
        dayContainer.appendChild(morningTaskDiv);
        dayContainer.appendChild(afternoonTaskDiv);
        dayContainer.appendChild(eveningTaskDiv);

        monthContainer.appendChild(dayContainer);

    }
}

