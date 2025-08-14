const jumPingText = document.querySelector(".jumping-text");
const taskInput = document.getElementById('taskTitle');
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
const allColorsIcon = document.getElementById("recentcolors-icon");

const paletteBtn = document.getElementById("showRecentColors");
const dropdown = document.getElementById("color-mode-dropdown");
const colorPicker = document.getElementById("colorPicker");

paletteBtn.addEventListener("click", () => {
    dropdown.classList.toggle("hidden");
});


// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
    const isClickInsideDropdown = dropdown.contains(e.target);

    if (!paletteBtn.closest(".palette-wrapper").contains(e.target) || isClickInsideDropdown) {
        dropdown.classList.add("hidden");
    }
});


document.querySelector('.dropdown-option[data-mode="all"]').addEventListener('click', () => {

    allColorsIcon.textContent = "palette";
    const originalHTML = document.getElementById("colorPicker").dataset.originalHtml;
    document.getElementById("colorPicker").innerHTML = originalHTML;



    // ✅ NOW select the first new button (within colorPicker)
    const firstButton = colorPicker.querySelector('.color-option');
    if (firstButton) {
        chosenColor = firstButton.getAttribute('data-color');

        colorPicker.querySelectorAll('.color-option').forEach(btn =>
            btn.classList.remove('selected-color')
        );
        firstButton.classList.add('selected-color');

        flower.style.color = chosenColor;
    }
});


document.querySelector('.dropdown-option[data-mode="recent"]').addEventListener('click', () => {
    allColorsIcon.textContent = "star";
    const tasks = JSON.parse(localStorage.getItem('tasks') || '{}');
    const colorFrequency = {};

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const dates = Object.keys(tasks)
        .filter(date => new Date(date) >= oneYearAgo)
        .sort((a, b) => new Date(b) - new Date(a)); // Sort: newest to oldest

    let colorChecks = 0;
    const maxChecks = 1000;

    for (const date of dates) {
        const dayData = tasks[date];
        for (const period in dayData) {
            for (const entry of dayData[period]) {
                if (colorChecks >= maxChecks) break;

                let color = entry.color;
                if (color) {
                    // Convert RGB to HEX if necessary
                    if (color.startsWith("rgb")) {
                        const rgb = color.match(/\d+/g);
                        color = "#" + rgb.map(x => (+x).toString(16).padStart(2, '0')).join("");
                    }

                    color = color.toLowerCase();
                    colorFrequency[color] = (colorFrequency[color] || 0) + 1;
                    colorChecks++;
                }
            }
            if (colorChecks >= maxChecks) break;
        }
        if (colorChecks >= maxChecks) break;
    }

    const topColors = Object.entries(colorFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 13)
        .map(([color]) => color);

    const colorPicker = document.getElementById("colorPicker");
    colorPicker.innerHTML = "";

    topColors.forEach(color => {
        const container = document.createElement("div");
        container.className = "color-option-container";

        const btn = document.createElement("button");
        btn.className = "color-option";
        btn.dataset.color = color;
        btn.style.backgroundColor = color;

        container.appendChild(btn);
        colorPicker.appendChild(container);
    });


    // ✅ NOW select the first new button (within colorPicker)
    const firstButton = colorPicker.querySelector('.color-option');
    if (firstButton) {
        chosenColor = firstButton.getAttribute('data-color');

        colorPicker.querySelectorAll('.color-option').forEach(btn =>
            btn.classList.remove('selected-color')
        );
        firstButton.classList.add('selected-color');

        flower.style.color = chosenColor;
    }
});

const shadesBtn = document.querySelector('[data-mode="shades"]');
const shadeSubmenu = document.getElementById('shadeSubmenu');

// Toggle the submenu when "Shades" is clicked
shadesBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent global dropdown closing
    shadeSubmenu.classList.toggle('hidden');
});
// Listener: When user clicks a shade color button (e.g. Red, Blue, etc.)
document.addEventListener("click", (e) => {
    const btn = e.target.closest(".shade-color-btn");
    if (!btn) return;

    const baseColor = btn.dataset.color;
    if (!baseColor) return;

    generateShadesFor(baseColor);
});

// Generate 13 shades for a named base color (like "red", "blue", etc.)
function generateShadesFor(colorName) {

    allColorsIcon.textContent = "opacity";
    const baseColors = {
        red: "#e53935",
        orange: "#fb8c00",
        yellow: "#fdd835",
        green: "#43a047",
        blue: "#1e88e5",
        purple: "#8e24aa",
        pink: "#d81b60",
        teal: "#009688",
        peach: "#ffb88c",
        coral: "#ff6f61",
        lavender: "#b39ddb",
        brown: "#6d4c41",
        grey: "#998c80"
    };

    const baseHex = baseColors[colorName];
    if (!baseHex) return;

    const shades = generateShadesForPicker(baseHex, 13);
    renderColorOptions(shades);
}

// Generate lighter/darker shades from a base hex color
function generateShadesForPicker(hex, count) {
    const shades = [];
    const [r, g, b] = colorPickerHexToRgb(hex);

    for (let i = 0; i < count; i++) {
        const factor = 1 - (i - count / 2) * 0.08; // range from darker to lighter
        const shade = colorPickerRgbToHex(
            Math.min(255, Math.max(0, r * factor)),
            Math.min(255, Math.max(0, g * factor)),
            Math.min(255, Math.max(0, b * factor))
        );
        shades.push(shade);
    }

    return shades.reverse();
}

// Convert HEX to RGB
function colorPickerHexToRgb(hex) {
    const cleanHex = hex.replace("#", "");
    return [
        parseInt(cleanHex.substring(0, 2), 16),
        parseInt(cleanHex.substring(2, 4), 16),
        parseInt(cleanHex.substring(4, 6), 16)
    ];
}

// Convert RGB to HEX
function colorPickerRgbToHex(r, g, b) {
    return "#" + [r, g, b].map(x =>
        Math.round(x).toString(16).padStart(2, '0')
    ).join("");
}

// Render color buttons into #colorPicker
function renderColorOptions(colors) {
    const colorPicker = document.getElementById("colorPicker");
    colorPicker.innerHTML = "";

    colors.forEach(color => {
        const container = document.createElement("div");
        container.className = "color-option-container";

        const btn = document.createElement("button");
        btn.className = "color-option";
        btn.dataset.color = color;
        btn.style.backgroundColor = color;

        container.appendChild(btn);
        colorPicker.appendChild(container);
    });

    // Auto-select the first button
    const first = colorPicker.querySelector(".color-option");
    if (first) {
        chosenColor = first.dataset.color;

        document.querySelectorAll('.color-option').forEach(btn =>
            btn.classList.remove('selected-color')
        );
        first.classList.add('selected-color');

        flower.style.color = chosenColor;
    }
}

// Hide submenu when clicking outside
document.addEventListener('click', (e) => {
    const isInside = document.querySelector('.shades-wrapper')?.contains(e.target);
    if (!isInside) {
        const shadeSubmenu = document.querySelector('#shade-submenu');
        if (shadeSubmenu) shadeSubmenu.classList.add('hidden');
    }
});


// Hide submenu when clicking outside
document.addEventListener('click', (e) => {
    const isInside = document.querySelector('.shades-wrapper')?.contains(e.target);
    if (!isInside) shadeSubmenu.classList.add('hidden');
});



document.addEventListener("DOMContentLoaded", () => {
    const picker = document.getElementById("colorPicker");
    picker.dataset.originalHtml = picker.innerHTML;

    document.querySelector('.dropdown-option[data-mode="recent"]').click();

});




let selectedDivs = [];
let hasSuggestionContent = false;

const blankSuggestion = document.querySelector('.blank-suggestion');

blankSuggestion.addEventListener('click', () => {
    taskInput.value = '';
});

const showVertViewBtn = document.getElementById('calendar-icon-vertview');
const showHorViewBtn = document.getElementById('calendar-icon-horview');


window.addEventListener('DOMContentLoaded', () => {
    loadTemplate();
    getWeather();
});

let expanded = false;
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('toggleClampBtn');
    const toggleIcon = document.getElementById('toggleIcon');

    expanded = localStorage.getItem('clampExpanded') === 'true';

    document.querySelectorAll('.clamp-text').forEach(span => {
        span.classList.toggle('expanded', expanded);
    });

    toggleIcon.textContent = expanded ? 'compress' : 'expand';

    toggleBtn.addEventListener('click', () => {
        expanded = !expanded;

        document.querySelectorAll('.clamp-text').forEach(span => {
            span.classList.toggle('expanded', expanded);
        });

        // Toggle icon
        toggleIcon.textContent = expanded ? 'compress' : 'expand';

        localStorage.setItem('clampExpanded', expanded ? 'true' : 'false');

    });

});



showVertViewBtn.addEventListener('click', () => {

    hidePopup();
    currentMonthVertView = currentMonthValue;
    currentYearVertView = currentYearValue;
    showCalVertView(currentMonthValue, currentYearValue);
});


showHorViewBtn.addEventListener('click', () => {
    hidePopup();
    showCalHorView(currentMonthValue, currentYearValue);
});


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
            taskDivToUse.textContent = "";
            taskDivToUse.style.backgroundColor = chosenColor || '#ccc';

            if (emptyIndex !== -1) {
                storedData[date][taskKey][emptyIndex] = {
                    task: taskDivToUse.textContent,
                    color: taskDivToUse.style.backgroundColor
                };
            } else {
                storedData[date][taskKey].push({
                    task: taskDivToUse.textContent,
                    color: taskDivToUse.style.backgroundColor
                });
            }

            taskDivToUse.style.borderLeft = `4px solid ${chosenColor}`;
            taskDivToUse.style.backgroundColor = fadeColor(chosenColor);
        }
        taskDivToUse = document.createElement('div');
        // taskDivToUse.textContent = taskInput.value;
        taskDivToUse.textContent = "";
        taskDivToUse.classList.add(`${taskType}Sub`);
        taskDivToUse.style.backgroundColor = chosenColor || '#ccc';
        parent.appendChild(taskDivToUse);

        storedData[date][taskKey].push({
            // task: taskInput.value,
            task: taskDivToUse.textContent,
            color: taskDivToUse.style.backgroundColor
        });


        taskDivToUse.style.borderLeft = `4px solid ${chosenColor}`;
        taskDivToUse.style.backgroundColor = fadeColor(chosenColor);

        // 🔹 Select only the newly added/updated task
        taskDivToUse.classList.add('selected');
        selectedDivs.push(taskDivToUse);
    });

    localStorage.setItem("tasks", JSON.stringify(storedData));
    [selectedTaskCounter, deselectTemplateBtn].forEach(el => el.textContent = selectedDivs.length);
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

hideAllButtons.addEventListener('click', () => {
    const extrasToolbar = document.querySelector(".extras-toolbar");

    extrasToolbar.style.display = extrasToolbar.style.display === 'none' ? 'flex' : 'none';
    todayNameText.style.display = todayNameText.style.display === 'none' ? 'flex' : 'none';
    hideWidgetBtn.style.display = hideWidgetBtn.style.display === 'none' ? 'flex' : 'none';
    taskToolbar.style.display = taskToolbar.style.display === 'none' ? 'flex' : 'none';
    slidingInputView.style.display = slidingInputView.style.display !== 'none' ? 'none' : 'flex';

    // const isFullScreen = !!document.fullscreenElement;
    // fullscreenIcon.textContent = isFullScreen ? 'fullscreen_exit' : 'fullscreen';
});


// const yearContainer = document.getElementById('year-container');
const fullScreenButton = document.getElementById(`fullscreen-button`);
const fullscreenIcon = document.getElementById('fullscreen-icon');



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
// let currentMonthContainer = null;
// let nextMonthContainer = null;
// let prevMonthContainer = null;

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
// console.log("real current month at init", currentDateMonth);

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
yearContainer.addEventListener('scroll', handleYearContainerScroll);


function cleanupSelectedDivs() {
    selectedDivs = selectedDivs.filter(el => document.body.contains(el));
    updateUICounters();
}


function handleYearContainerScroll() {

    cleanupSelectedDivs();

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
}







function addDays(scroll = "", monthName = 0, date = 1, day = 0, lastDateOfMonth = 0, morningTask = "", afternoonTask = "", eveningTask = "", yearDate) {
    // console.log("SCROLL IS:", scroll);
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


    monthLetterContainer.addEventListener('click', () => {
        popUpDate = null;
        swapToGridView(monthName, yearDate);
    });


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

    yearLetterContainer.addEventListener('click', () => {
        popUpDate = null;
        swapToGridView(monthName, yearDate);
    });

    // yearLetterContainer.textContent = yearDate;
    monthNameContainer.appendChild(yearLetterContainer);


    const monthContainer = document.createElement('div');
    monthContainer.classList.add('month-container');
    let storedData = JSON.parse(localStorage.getItem('tasks')) || {};

    // Lock Button
    let toGridCalBtn = document.createElement("div");
    toGridCalBtn.classList.add("grid-cal-btn"); // Assign class for styling
    const icon = document.createElement("span");
    icon.classList.add("material-icons");
    // icon.textContent = "lock_open";
    icon.textContent = "calendar_month";


    toGridCalBtn.appendChild(icon);
    monthNameContainer.prepend(toGridCalBtn);


    toGridCalBtn.addEventListener('click', () => {
        popUpDate = null;
        swapToGridView(monthName, yearDate);
    });



    function swapToGridView(monthName, yearDate) {
        currentMonthValue = monthName;
        currentYearValue = yearDate;
        currentMonthVertView = monthName;
        currentYearVertView = yearDate;
        showCalVertView(monthName, yearDate);
    }

    // Check if lock state exists in localStorage for this month container
    // Check if lock state exists in localStorage for this month container
    // let isLocked = localStorage.getItem(`lockState-${FormatMonthName}`) === 'true' ? true : false; // Default to false if not found


    // Apply saved lock state when the page loads
    // if (isLocked) {
    //     // console.log(`${FormatMonthName} is locked`);
    //     monthContainer.style.pointerEvents = "auto"; // Disable interaction for the month container
    //     // icon.textContent = "lock_open"; // Change icon to locked
    //     icon.textContent = "calendar_month";
    // }

    // Lock/Unlock functionality
    // toGridCalBtn.addEventListener("click", () => {
    //     isLocked = !isLocked; // Toggle the lock state

    //     if (isLocked) {
    //         // console.log(`${FormatMonthName} is locked`);
    //         monthContainer.style.pointerEvents = "auto"; // Disable interaction for the month container
    //         icon.textContent = "calendar_month"; // Change icon to locked
    //     } else {
    //         // console.log(`${FormatMonthName} is unlocked`);
    //         monthContainer.style.pointerEvents = "auto"; // Enable interaction for the month container
    //         icon.textContent = "calendar_month"; // Change icon back to unlocked
    //     }

    //     // Save the lock state to localStorage
    //     localStorage.setItem(`lockState-${FormatMonthName}`, isLocked.toString());
    // });




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

            dayDiv.classList.add("weekends");

            // dayDiv.style.fontSize = "12px";
            // dayDiv.style.fontWeight = "bold";
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

                // taskDiv.textContent = task;

                //webkit
                if (task.trim()) {
                    const span = document.createElement('span');
                    span.className = 'clamp-text';

                    if (expanded) {
                        span.classList.add('expanded');
                    }

                    span.textContent = task;
                    taskDiv.innerHTML = ''; // clear existing content
                    taskDiv.appendChild(span);
                } else {
                    taskDiv.textContent = ''; // or some fallback if empty
                }

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

                // taskDiv.textContent = task;

                //webkit
                if (task.trim()) {
                    const span = document.createElement('span');
                    span.className = 'clamp-text';

                    if (expanded) {
                        span.classList.add('expanded');
                    }

                    span.textContent = task;
                    taskDiv.innerHTML = ''; // clear existing content
                    taskDiv.appendChild(span);
                } else {
                    taskDiv.textContent = ''; // or some fallback if empty
                }


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

                // taskDiv.textContent = task;

                //webkit
                if (task.trim()) {
                    const span = document.createElement('span');
                    span.className = 'clamp-text';

                    if (expanded) {
                        span.classList.add('expanded');
                    }

                    span.textContent = task;
                    taskDiv.innerHTML = ''; // clear existing content
                    taskDiv.appendChild(span);
                } else {
                    taskDiv.textContent = ''; // or some fallback if empty
                }

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
            // console.log(`week spacer added`);
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
        // console.log(`current is init`, currentDate);
    } else if (scroll === "initNext") {
        nextMonthContainer = monthNameDayContainer;
        yearContainer.appendChild(monthNameDayContainer);
        // console.log(`next is init`, nextDate);
    } else if (scroll === "initPrev") {
        prevMonthContainer = monthNameDayContainer;

        const previousScrollHeight = yearContainer.scrollHeight;
        yearContainer.prepend(monthNameDayContainer);
        const newScrollHeight = yearContainer.scrollHeight;
        // yearContainer.scrollTop += newScrollHeight - previousScrollHeight;
        // console.log(`prev is init`, prevDate);

    }

    // console.log(monthNameContainer.innerHTML);

}





// fullScreenButton.addEventListener(`click`, enterFullScreen);
fullScreenButton.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        enterFullScreen();
    } else {
        exitFullScreen();
    }
});
// exitFullscreenBtn.addEventListener("click", exitFullscreen);


function enterFullScreen() {
    const docElement = document.documentElement;
    if (docElement.requestFullscreen) {
        docElement.requestFullscreen();
    } else if (docElement.webkitRequestFullscreen) {
        docElement.webkitRequestFullscreen(); // Safari
    } else if (docElement.msRequestFullscreen) {
        docElement.msRequestFullscreen(); // IE/Edge
    }
}
// Exit fullscreen function
function exitFullScreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    }
}



document.addEventListener('fullscreenchange', () => {
    const isFullScreen = !!document.fullscreenElement;
    fullscreenIcon.textContent = isFullScreen ? 'fullscreen_exit' : 'fullscreen';
});




let currentTask = '';


// //add click listener to colors for task
// document.querySelectorAll('.color-option').forEach(button => {
//     button.addEventListener('click', () => {
//         // Get the selected color
//         chosenColor = button.getAttribute('data-color');
//         // Highlight the selected button
//         document.querySelectorAll('.color-option').forEach(btn => btn.classList.remove('selected-color'));
//         button.classList.add('selected-color');
//         flower.style.color = chosenColor;


//     });
// });
document.getElementById('colorPicker').addEventListener('click', (e) => {
    const button = e.target.closest('.color-option');
    if (!button) return; // Clicked outside a button

    // Get the selected color
    chosenColor = button.getAttribute('data-color');

    // Highlight the selected button
    document.querySelectorAll('.color-option').forEach(btn =>
        btn.classList.remove('selected-color')
    );
    button.classList.add('selected-color');

    // Update flower color
    flower.style.color = chosenColor;

    // Additional: if editing mode, update selected tasks border color
    if (isEditing) {
        // Save undo state just once after updating all selected tasks

        const selectedTasks = document.querySelectorAll('.selected-task-popup');

        if (selectedTasks.length === 0) return;
        const currentState = saveTaskOrderToTemp();
        undoStack.push(currentState);
        redoStack.length = 0; // clear redo stack because new action happened
        selectedTasks.forEach(eventDiv => {
            const content = eventDiv.querySelector('.event-content');
            if (content) {
                content.style.borderLeft = `5px solid ${chosenColor}`;
            }
        });
    }
});



// ✅ NOW select the first new button (within colorPicker)
const firstButton = colorPicker.querySelector('.color-option');
if (firstButton) {
    chosenColor = firstButton.getAttribute('data-color');

    colorPicker.querySelectorAll('.color-option').forEach(btn =>
        btn.classList.remove('selected-color')
    );
    firstButton.classList.add('selected-color');

    flower.style.color = chosenColor;
}


//add click listeners to task(morning, afternoon, evening) divs
yearContainer.addEventListener('click', (event) => {
    const subTaskElement = event.target.closest('.morningTaskSub, .afternoonTaskSub, .eveningTaskSub');
    const mainTaskElement = event.target.closest('.morningTask, .afternoonTask, .eveningTask');


    if (subTaskElement) {
        handleSubtaskClick(subTaskElement); // Handle child click

        // taskInput.value = selectedDivs[selectedDivs.length - 1]?.textContent || '';
        updateSuggestionFromSelected();
        updateUICounters();


        const lastDiv = selectedDivs[selectedDivs.length - 1];
        if (lastDiv) {

            const computedStyle = getComputedStyle(lastDiv);
            const rgbColor = computedStyle.borderLeftColor;
            const hexColor = rgbToHex(rgbColor);

            if (hexColor) {
                const colorBtn = document.querySelector(`button.color-option[data-color="${hexColor}"]`);
                if (colorBtn) {
                    colorBtn.click();

                    const scrollContainer = document.querySelector('.color-picker'); // scrollable container

                    // Center the button horizontally inside the scroll container
                    const containerRect = scrollContainer.getBoundingClientRect();
                    const targetRect = colorBtn.getBoundingClientRect();

                    const offset = targetRect.left - containerRect.left;
                    const centerOffset = offset - (scrollContainer.clientWidth / 2) + (colorBtn.clientWidth / 2);

                    scrollContainer.scrollTo({
                        left: scrollContainer.scrollLeft + centerOffset,
                        behavior: 'smooth'
                    });
                }
            }

        }


        return; // prevent bubbling to parent logic
    }

    if (mainTaskElement) {
        handleParentClick(mainTaskElement); // Handle parent click
        updateSuggestionFromSelected();
        updateUICounters();
        // taskInput.value = selectedDivs[selectedDivs.length - 1]?.textContent || '';


        const lastDiv = selectedDivs[selectedDivs.length - 1];
        if (lastDiv) {
            const computedStyle = getComputedStyle(lastDiv);
            const rgbColor = computedStyle.borderLeftColor;
            const hexColor = rgbToHex(rgbColor);

            if (hexColor) {
                const colorBtn = document.querySelector(`button.color-option[data-color="${hexColor}"]`);
                if (colorBtn) colorBtn.click();
            }
        }

    }


});


function addToSuggestionText(text) {
    const suggestionContainer = document.querySelector('.suggestion-text');
    const existingButtons = Array.from(suggestionContainer.querySelectorAll('.paste-button'));

    // Check if the text already exists
    const alreadyExists = existingButtons.some(btn => btn.textContent === text);
    if (alreadyExists) return;

    // Create a new paste button
    const button = document.createElement('div');
    button.classList.add('paste-button');
    button.textContent = text;

    // When clicked, send the text to the taskInput
    button.addEventListener('click', () => {
        taskInput.value = text;
    });

    const blankBtn = suggestionContainer.querySelector('.blank-suggestion');
    if (blankBtn && blankBtn.nextSibling) {
        suggestionContainer.insertBefore(button, blankBtn.nextSibling);
    } else {
        suggestionContainer.appendChild(button);
    }
}


function updateSuggestionFromSelected() {
    const suggestionContainer = document.querySelector('.suggestion-text');
    suggestionContainer.innerHTML = '';

    const added = new Set();
    hasSuggestionContent = false;

    // Insert the last selected first
    const lastDiv = selectedDivs[selectedDivs.length - 1];
    if (lastDiv) {
        const lastText = lastDiv.textContent?.trim();
        if (lastText && !added.has(lastText)) {
            added.add(lastText);
            const button = document.createElement('div');
            button.classList.add('paste-button');
            button.textContent = lastText;
            button.addEventListener('click', () => {
                taskInput.value = lastText;
            });
            suggestionContainer.appendChild(button);
            hasSuggestionContent = true;
        }
    }

    // Add the rest (excluding last)
    for (let i = 0; i < selectedDivs.length - 1; i++) {
        const text = selectedDivs[i].textContent?.trim();
        if (!text || added.has(text)) continue;
        added.add(text);

        const button = document.createElement('div');
        button.classList.add('paste-button');
        button.textContent = text;
        button.addEventListener('click', () => {
            taskInput.value = text;
        });
        suggestionContainer.appendChild(button);
        hasSuggestionContent = true;
    }
}





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

        if (hasSuggestionContent) {
            const suggestionWrapper = document.querySelector('.suggestion-wrapper');
            const jumpingTextBox = document.querySelector(".jumping-text-box");
            jumpingTextBox.style.display = "none";
            suggestionWrapper.style.display = "flex";
        } else {
            const suggestionWrapper = document.querySelector('.suggestion-wrapper');
            const jumpingTextBox = document.querySelector(".jumping-text-box");
            jumpingTextBox.style.display = "flex";
            suggestionWrapper.style.display = "none";
        }

        submitTaskBtn.classList.remove('disabled-btn'); // Remove disabled styling
        addTaskBtn.classList.remove('disabled-btn'); // Remove 
        selectedTaskCounter.classList.add(`selection-true`);
        // submitTaskBtn.disabled = false;
        // selectedTaskCounter.classList.remove('shake-btn'); // Remove shake effect when counter is > 0
    } else {

        const suggestionWrapper = document.querySelector('.suggestion-wrapper');
        const jumpingTextBox = document.querySelector(".jumping-text-box");
        jumpingTextBox.style.display = "flex";
        suggestionWrapper.style.display = "none";


        // taskInput.value = "";

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
                // div.textContent = taskTitle;

                //webkit
                const span = document.createElement('span');
                span.className = 'clamp-text';

                if (expanded) {
                    span.classList.add('expanded');
                }

                span.textContent = taskTitle;

                div.innerHTML = '';       // Clear any existing content
                div.appendChild(span);    // Add styled span

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

    if (taskColor) {
        const colorBtn = document.querySelector(`button.color-option[data-color="${taskColor}"]`);
        if (colorBtn) {
            colorBtn.click();

            const scrollContainer = document.querySelector('.color-picker'); // scrollable container

            // Center the button horizontally inside the scroll container
            const containerRect = scrollContainer.getBoundingClientRect();
            const targetRect = colorBtn.getBoundingClientRect();

            const offset = targetRect.left - containerRect.left;
            const centerOffset = offset - (scrollContainer.clientWidth / 2) + (colorBtn.clientWidth / 2);

            scrollContainer.scrollTo({
                left: scrollContainer.scrollLeft + centerOffset,
                behavior: 'smooth'
            });
        }
    }

    if (selectedDivs.length > 0) {
        const storedData = JSON.parse(localStorage.getItem('tasks')) || {};

        selectedDivs.forEach(div => {
            // div.textContent = taskText;

            //webkit
            const span = document.createElement('span');
            span.className = 'clamp-text';

            if (expanded) {
                span.classList.add('expanded');
            }

            span.textContent = taskText;
            div.innerHTML = '';       // Clear any existing content
            div.appendChild(span);    // Add styled span

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
        //color here

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
    // taskInput.value = "";
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

        floatingAddBtn.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';

        taskToolbar.style.bottom = `${130 + 10}px`;
    } else {
        slidingInputView.classList.toggle("show");

        floatingAddBtn.style.transform = 'rotate(0)'; // Reset button position and rotation
        floatingAddBtn.style.backgroundColor = 'rgba(76, 175, 80, 0.7)'; // Reset button color to green
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

const cloneColorMenu = clonedSlidingInputView.querySelector(".palette-button");
if (cloneColorMenu) {
    cloneColorMenu.remove();
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
inputTemplate.placeholder = `Add new template.`;

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

jumPingText.addEventListener("click", () => {

    jumPingText.classList.add("wiggle");

    // Remove the class after animation ends so it can be triggered again
    setTimeout(() => {
        jumPingText.classList.remove("wiggle");
    }, 600);
    console.log("jumping text is clicked");
    taskInput.value = '';


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

monthLabelVertView.addEventListener('click', () => {
    popUpDate = null;
    showCalHorView(currentMonthVertView, currentYearVertView);
});
calIconVertView.addEventListener('click', () => {
    showCalHorView(currentMonthVertView, currentYearVertView);

});

function showCalHorView(m, y) {

    cleanupSelectedDivs();
    // Make sure both elements exist
    const main = document.getElementById('main-container');
    const vert = document.getElementById('calendar-container-vert-view');
    main.style.display = 'block';
    vert.style.display = 'none'; // Assuming your flex styles are defined in CSS
    if (!main || !vert) {
        console.error('One or both containers are missing in the DOM.');
        return;
    }
    // yearContainer.innerHTML = "";
    yearContainer.removeEventListener('scroll', handleYearContainerScroll);
    while (yearContainer.firstChild) {
        yearContainer.removeChild(yearContainer.firstChild);
    }
    updateVertViewCalendarFromMonthYear(m, y);

    requestAnimationFrame(() => {
        currentMonthContainer.scrollIntoView({
            block: "start",
            // behavior: "smooth"
            behavior: "auto"
        });

        // Delay listener until after scroll finishes
        requestAnimationFrame(() => {
            yearContainer.addEventListener('scroll', handleYearContainerScroll);
        });
        currentDayScroll(popUpDate);
    });
}

function showCalVertView(month, year) {

    cleanupSelectedDivs();
    // console.log("Vert View Showing");

    // Make sure both elements exist
    const main = document.getElementById('main-container');
    const vert = document.getElementById('calendar-container-vert-view');

    if (!main || !vert) {
        console.error('One or both containers are missing in the DOM.');
        return;
    }
    createCalendarGrid();
    updateCalendarWithTasks(month, year);
    main.style.display = 'none';
    vert.style.display = 'flex'; // Assuming your flex styles are defined in CSS

    const todayElement = document.querySelector(`.grid-cell[data-full-date="${popUpDate}"]`);
    if (todayElement) todayElement.classList.add('is-active');
}


function updateVertViewCalendarFromMonthYear(currentMonth, currentYear) {
    cleanupSelectedDivs();
    console.log("FIND ERROR the current now is:");
    console.log(currentMonth);
    console.log(currentYear);

    // 🔵 Current Month
    currentDate = new Date(currentYear, currentMonth, 1);
    const currentDateMonth = currentDate.getMonth();
    const currentDateYear = currentDate.getFullYear();
    const currentDateLastDate = new Date(currentDateYear, currentDateMonth + 1, 0).getDate();

    // 🔴 Next Month
    nextDate = new Date(currentDateYear, currentDateMonth + 1, 1);
    const nextDateMonth = nextDate.getMonth();
    const nextDateYear = nextDate.getFullYear();
    const nextDateLastDate = new Date(nextDateYear, nextDateMonth + 1, 0).getDate();

    // 🟢 Previous Month
    prevDate = new Date(currentDateYear, currentDateMonth - 1, 1);
    const prevDateMonth = prevDate.getMonth();
    const prevDateYear = prevDate.getFullYear();
    const prevDateLastDate = new Date(prevDateYear, prevDateMonth + 1, 0).getDate();



    addDays(
        "initPrev",
        prevDateMonth,
        1,
        prevDate.getDay(),
        prevDateLastDate,
        "",
        "",
        "",
        prevDateYear
    );


    addDays(
        "initCurrent",
        currentDateMonth,
        1,
        currentDate.getDay(),
        currentDateLastDate,
        "",
        "",
        "",
        currentDateYear
    );


    addDays(
        "initNext",
        nextDateMonth,
        1,
        nextDate.getDay(),
        nextDateLastDate,
        "",
        "",
        "",
        nextDateYear
    );


}


