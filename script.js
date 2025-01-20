const sourceContainer = document.getElementById('source-container');
const targetContainer = document.getElementById('target-container');
let draggedItem = null;

// Add dragstart event to items in the source container
sourceContainer.addEventListener('dragstart', (e) => {
    if (e.target.classList.contains('flex-item')) {
        draggedItem = e.target.cloneNode(true); // Clone the dragged item
        e.dataTransfer.effectAllowed = 'copy'; // Indicate this is a copy operation
    }
});

// Prevent default behavior to allow dropping in the target container
targetContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
});

// Handle drop event in the target container
targetContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    if (draggedItem) {
        targetContainer.appendChild(draggedItem); // Append the cloned item
        draggedItem = null; // Reset draggedItem after dropping
    }
});
