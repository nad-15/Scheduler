let isDraggingTask = false;
let startX, startY;
let touchStartTime;
let draggedItem, shadowElement;
let scrollable = `true`;
let highlightedTarget = null; // Track the currently highlighted target

const dragButton = document.querySelector(`.drag-button`);


dragButton.addEventListener(`click`, () => {
    if (scrollable === `false`) {
        dragButton.innerHTML = `Drag<br>OFF`;
        scrollable = `true`;
    } else {
        alert(`this functionality is currently unstable`);
        dragButton.innerHTML = `Drag<br>ON`;
        scrollable = `false`;
    }
});

yearContainer.addEventListener('touchstart', (e) => {
    if (scrollable === `false`) {
        draggedItem = e.target.closest('.morningTask, .afternoonTask, .eveningTask');

        if (!draggedItem) return;

        isDraggingTask = false;
        touchStartTime = Date.now();
        startX = e.touches[0].pageX;
        startY = e.touches[0].pageY;

        // Clone the dragged item
        shadowElement = draggedItem.cloneNode(true);
        shadowElement.style.position = "fixed";
        shadowElement.style.opacity = "0.5"; // Adjust opacity for shadow
        shadowElement.style.pointerEvents = "none";
        shadowElement.style.zIndex = "1000";

        document.body.appendChild(shadowElement);

        // Apply a darkened overlay effect on the dragged item
        draggedItem.style.transition = "opacity 0.3s ease"; // Smooth opacity change
        draggedItem.style.opacity = "0.7"; // Darken the dragged item slightly

        // Ensure correct positioning AFTER it has been rendered
        requestAnimationFrame(() => {
            const rect = draggedItem.getBoundingClientRect();

            shadowElement.style.height = `${rect.height}px`;
            shadowElement.style.width = `${rect.width}px`;

            shadowElement.style.left = `${startX - shadowElement.offsetWidth / 2}px`;
            shadowElement.style.top = `${startY - shadowElement.offsetHeight / 2 - 30}px`;

            // Add border highlight to the dragged item
            draggedItem.style.border = "3px dashed #007bff"; // Highlight dragged item with dashed blue border
        });
    }
});

yearContainer.addEventListener('touchmove', (e) => {
    if (scrollable === `false`) {
        if (!draggedItem) return;

        const deltaX = e.touches[0].pageX - startX;
        const deltaY = e.touches[0].pageY - startY;

        if (!isDraggingTask && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
            isDraggingTask = true;
        }

        if (isDraggingTask) {
            // Move shadow slightly above the finger (30px)
            shadowElement.style.left = `${e.touches[0].pageX - shadowElement.offsetWidth / 2}px`;
            shadowElement.style.top = `${e.touches[0].pageY - shadowElement.offsetHeight / 2 - 30}px`;

            // Highlight the target item
            const targetTaskDiv = document.elementFromPoint(
                e.changedTouches[0].pageX,
                e.changedTouches[0].pageY - 30
            )?.closest('.morningTask, .afternoonTask, .eveningTask');

            // If the touch is outside the valid target divs, cancel the highlight
            if (!targetTaskDiv) {
                if (highlightedTarget) {
                    highlightedTarget.style.border = "";
                    highlightedTarget = null;
                }

            }

            // Only highlight a valid target
            if (targetTaskDiv && targetTaskDiv !== draggedItem) {
                // If the target is different, remove highlight from the previous target
                if (highlightedTarget && highlightedTarget !== targetTaskDiv) {
                    highlightedTarget.style.border = "";
                }

                // Highlight the new target
                // targetTaskDiv.style.border = "2px dashed #28a745"; 
                // Highlight target item with green dashed border
                targetTaskDiv.style.border = "2px solid transparent"; // Create space for border
                targetTaskDiv.style.borderImage = "linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet) 1";

                highlightedTarget = targetTaskDiv; // Update the highlighted target
            }

            e.preventDefault();
        }
    }
});

yearContainer.addEventListener('touchend', (e) => {
    if (scrollable === `false`) {
        if (!draggedItem) return;

        // Reset opacity and remove highlight from the dragged item
        draggedItem.style.opacity = "1"; // Restore original opacity
        draggedItem.style.border = "";

        // If there is a highlighted target, proceed with the swap or reset
        if (highlightedTarget) {
            // If the dragged item is dropped on the target, swap styles and content
            if (highlightedTarget !== draggedItem) {
                [draggedItem.style.backgroundColor, highlightedTarget.style.backgroundColor] =
                    [highlightedTarget.style.backgroundColor, draggedItem.style.backgroundColor];

                [draggedItem.textContent, highlightedTarget.textContent] =
                    [highlightedTarget.textContent, draggedItem.textContent];
            }

            // Remove the target highlight border
            highlightedTarget.style.border = "";
            highlightedTarget = null; // Reset the highlighted target
        }

        document.body.removeChild(shadowElement);
        isDraggingTask = false;
    }
});
