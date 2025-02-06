let isDraggingTask = false;
let startX, startY;
let touchStartTime, touchEndTime;
let draggedItem, shadowElement;
let scrollable = true;

yearContainer.addEventListener('touchstart', (e) => {
    if (!scrollable) {
        // Identify the clicked task div
        draggedItem = e.target.closest('.morningTask, .afternoonTask, .eveningTask');
        if (!draggedItem) return; // Exit if no valid task div clicked

        // Initialize drag variables
        isDraggingTask = false;
        touchStartTime = Date.now(); // Store start time
        startX = e.touches[0].pageX;
        startY = e.touches[0].pageY;
    }
});

yearContainer.addEventListener('touchmove', (e) => {
    if (!scrollable && draggedItem) {
        // Check if the user has moved the touch significantly to start dragging
        const deltaX = e.touches[0].pageX - startX;
        const deltaY = e.touches[0].pageY - startY;

        // Only start dragging if the movement is significant (long press, not tap)
        if (!isDraggingTask && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
            isDraggingTask = true;

            // Clone the dragged item for dragging (only after long press)
            shadowElement = draggedItem.cloneNode(true);
            shadowElement.style.position = "fixed";
            const rect = draggedItem.getBoundingClientRect();
            shadowElement.style.height = `${rect.height}px`;
            shadowElement.style.width = `${rect.width}px`;
            shadowElement.style.opacity = "0.5"; // Semi-transparent effect
            shadowElement.style.pointerEvents = "none"; // Ignore events on the shadow
            shadowElement.style.zIndex = "1000";
            shadowElement.style.left = `${startX}px`;
            shadowElement.style.top = `${startY}px`;

            // Append cloned shadow element to body
            document.body.appendChild(shadowElement);
        }

        if (isDraggingTask) {
            // Move the cloned shadow element with the touch
            shadowElement.style.left = `${e.touches[0].pageX - shadowElement.offsetWidth / 2}px`;
            shadowElement.style.top = `${e.touches[0].pageY - shadowElement.offsetHeight / 2}px`;

            // Prevent default behavior during dragging
            e.preventDefault();
        }
    }
});

yearContainer.addEventListener('touchend', (e) => {
    if (!scrollable && draggedItem) {
        touchEndTime = Date.now(); // Store the end time

        // If it's a short tap (quick duration), just click without dragging
        if (touchEndTime - touchStartTime < 500) {
            // draggedItem.click(); // Simulate a normal click
            return;
        }

        // If dragging, update the target div with the cloned content
        if (isDraggingTask) {
            const targetTaskDiv = document.elementFromPoint(e.changedTouches[0].pageX, e.changedTouches[0].pageY)
                .closest('.morningTask, .afternoonTask, .eveningTask');

            if (targetTaskDiv && targetTaskDiv !== draggedItem) {
                // Copy the background color and text content of the dragged item to the target
                targetTaskDiv.style.backgroundColor = shadowElement.style.backgroundColor;
                targetTaskDiv.textContent = shadowElement.textContent;
            }
        }

        // Remove the cloned shadow element after the drop
        if (shadowElement) {
            document.body.removeChild(shadowElement);
        }

        // Reset dragging state
        isDraggingTask = false;
    }
});
