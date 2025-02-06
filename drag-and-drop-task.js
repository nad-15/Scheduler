let isDraggingTask = false;
let startX, startY;
let touchStartTime;
let draggedItem, shadowElement;
let scrollable = `true`;

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

        // Get the bounding rectangle of the dragged item
        const rect = draggedItem.getBoundingClientRect();

        // Set size & appearance
        shadowElement.style.height = `${rect.height}px`;
        shadowElement.style.width = `${rect.width}px`;
        shadowElement.style.opacity = "0.5";
        shadowElement.style.pointerEvents = "none";
        shadowElement.style.zIndex = "1000";

        // Adjust shadow position slightly above the touch point
        shadowElement.style.left = `${startX - shadowElement.offsetWidth / 2}px`;
        shadowElement.style.top = `${startY - shadowElement.offsetHeight / 2 - 20}px`;

        document.body.appendChild(shadowElement);
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
            // Move shadow slightly above the finger
            shadowElement.style.left = `${e.touches[0].pageX - shadowElement.offsetWidth / 2}px`;
            shadowElement.style.top = `${e.touches[0].pageY - shadowElement.offsetHeight / 2 - 20}px`;

            e.preventDefault();
        }
    }
});

yearContainer.addEventListener('touchend', (e) => {
    if (scrollable === `false`) {
        if (!draggedItem) return;

        if (isDraggingTask) {
            // Find the target div slightly above the touch point
            const targetTaskDiv = document.elementFromPoint(
                e.changedTouches[0].pageX,
                e.changedTouches[0].pageY - 20 // Shift detection upwards
            )?.closest('.morningTask, .afternoonTask, .eveningTask');

            if (targetTaskDiv && targetTaskDiv !== draggedItem) {
                // Swap styles & text
                [draggedItem.style.backgroundColor, targetTaskDiv.style.backgroundColor] =
                    [targetTaskDiv.style.backgroundColor, draggedItem.style.backgroundColor];

                [draggedItem.textContent, targetTaskDiv.textContent] =
                    [targetTaskDiv.textContent, draggedItem.textContent];
            }
        }

        document.body.removeChild(shadowElement);
        isDraggingTask = false;
    }
});
