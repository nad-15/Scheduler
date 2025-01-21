const container = document.getElementById('date-container'); 
appTitle = document.getElementById('app-title');

for (let i = 0; i < 30; i++) {
    const div = document.createElement('div'); // Create a new div element
    div.classList.add('days'); 
    div.innerText = `Div ${i + 1}`; 
    container.appendChild(div); 
}
console.log(window.getComputedStyle(appTitle).fontSize);