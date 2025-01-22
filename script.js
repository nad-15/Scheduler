const monthContainer = document.getElementById('month-container');
const daysContainer = document.getElementById('days-container');
// appTitle = document.getElementById('app-title');


function cloneDaysContainer() {
    for (let i = 0; i < 30; i++) {
        const clonedDaysContainer = daysContainer.cloneNode(true);
        monthContainer.appendChild(clonedDaysContainer);
        console.log('cloned');
    }
}

cloneDaysContainer();


// for (let i = 0; i < 30; i++) {
//     const div = document.createElement('div'); // Create a new div element
//     div.classList.add('days');
//     div.innerText = `Div ${i + 1}`;
//     container.appendChild(div);
// }
// console.log(window.getComputedStyle(appTitle).fontSize);