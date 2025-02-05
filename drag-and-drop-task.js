let draggedItem = null;
let isDraggingTask = false;

// Set draggable to task items
yearContainer.querySelectorAll('.morningTask, .afternoonTask, .eveningTask').forEach(task => {
    task.setAttribute('draggable', 'true');
});

// Prevent scrolling while dragging (for mobile)
const preventScroll = (event) => {
    if (isDraggingTask) {
        event.preventDefault(); // Only prevent scrolling when dragging
    }
};



// Handle drag start
yearContainer.addEventListener('dragstart', (event) => {
    draggedItem = event.target.closest('.morningTask, .afternoonTask, .eveningTask');

    if (draggedItem) {
        draggedItem.classList.add('dragging');
        console.log("Dragging:", draggedItem);
    }

    // Disable scrolling during drag
    isDraggingTask = true;
    document.addEventListener('touchmove', preventScroll, { passive: false });
});

// Handle drag end
yearContainer.addEventListener('dragend', () => {
    if (draggedItem) {
        draggedItem.classList.remove('dragging');
        console.log("Drag ended:", draggedItem);
    }
    isDraggingTask = false;
    document.removeEventListener('touchmove', preventScroll); // Re-enable scrolling
});

// Handle touch start and prevent scroll (only if it's a draggable item)
yearContainer.addEventListener('touchstart', (event) => {
    if (event.target.closest('.morningTask, .afternoonTask, .eveningTask')) {
        isDraggingTask = true;
        document.addEventListener('touchmove', preventScroll, { passive: false });
    }
});

// Handle touch end (drag end for mobile)
document.addEventListener('touchend', () => {
    isDraggingTask = false;
    document.removeEventListener('touchmove', preventScroll); // Re-enable scroll
});

// Handle click events normally
yearContainer.addEventListener('click', (event) => {
    // Your normal click behavior here
    console.log("Click event:", event.target);
});
