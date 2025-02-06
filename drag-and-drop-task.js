

let isDraggingTask = false;
let startX, startY;
let touchStartTime;
let draggedItem, shadowElement;
let scrollable = `true`;
let highlightedTarget = null; // Track the currently highlighted target
let touchTimer = null; // Variable to store the timeout ID

const dragButton = document.querySelector(`.drag-button`);






yearContainer.addEventListener('touchstart', (e) => {

    draggedItem = e.target.closest('.morningTask, .afternoonTask, .eveningTask');

    if (draggedItem && scrollable === 'true') {

        // Start the timer for 1 second hold
        touchTimer = setTimeout(() => {
            yearContainer.style.overflow = "hidden";
            // document.body.style.overflow = 'hidden'; // Prevent page scrolling
            console.log(`yearContainer is NOT scrollable`);

            // Trigger drag logic only after 1 second
           

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

            // Set scrollable to false after 1 second
            scrollable = `false`;
            dragButton.innerHTML = `Drag<br>ON`;

        }, 1500); // Trigger after 1 second
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

                // Apply the border image gradient highlight
                targetTaskDiv.style.border = "2px solid transparent"; // Create space for border
                targetTaskDiv.style.borderImage = "linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet) 1";

                highlightedTarget = targetTaskDiv; // Update the highlighted target
            }

            // e.preventDefault();
        }
    }
});

yearContainer.addEventListener('touchend', (e) => {
    // Clear the touch timer if the user ends the touch before 1 second
    clearTimeout(touchTimer);

    if (scrollable === `false`) {

        try {
            // Reset opacity and remove highlight from the dragged item
            draggedItem.style.opacity = "1"; // Restore original opacity
            draggedItem.style.border = "";

            // If there is a highlighted target, proceed with the swap or reset
            if (highlightedTarget) {
                // If the dragged item is dropped on the target, swap styles and content
                if (highlightedTarget !== draggedItem) {


                    //set properties to be saved for draggedItem
                    const dayContainerOfDraggedItem = draggedItem.closest('.day-container');
                    const dateOfDraggedItem = dayContainerOfDraggedItem.querySelector('.date').getAttribute('data-full-date');
                    const taskTypeOfDraggedItem = draggedItem.classList.contains('morningTask') ? 'morning' :
                        draggedItem.classList.contains('afternoonTask') ? 'afternoon' : 'evening';
                    const taskTextOfDraggedItem = draggedItem.textContent;
                    const taskColorOfDraggedItem = rgbToHex(draggedItem.style.backgroundColor);

                    //set properties to be saved for targeItem
                    const dayContainerOfTargetItem = highlightedTarget.closest('.day-container');
                    const dateOfTargetItem = dayContainerOfTargetItem.querySelector('.date').getAttribute('data-full-date');
                    const taskTypeOfTargetItem = highlightedTarget.classList.contains('morningTask') ? 'morning' :
                        highlightedTarget.classList.contains('afternoonTask') ? 'afternoon' : 'evening';
                    const taskTextOfTargetItem = highlightedTarget.textContent;
                    const taskColorOfTargetItem = rgbToHex(highlightedTarget.style.backgroundColor);





                    // Save the dragged item data
                    saveTaskData(dateOfDraggedItem, taskTypeOfDraggedItem, taskTextOfTargetItem, taskColorOfTargetItem);

                    // Save the target item data
                    saveTaskData(dateOfTargetItem, taskTypeOfTargetItem, taskTextOfDraggedItem, taskColorOfDraggedItem);


                    [draggedItem.style.backgroundColor, highlightedTarget.style.backgroundColor] =
                        [highlightedTarget.style.backgroundColor, draggedItem.style.backgroundColor];

                    [draggedItem.textContent, highlightedTarget.textContent] =
                        [highlightedTarget.textContent, draggedItem.textContent];
                }

                // Remove the target highlight border
                highlightedTarget.style.border = "";
                highlightedTarget = null; // Reset the highlighted target
            }

        } finally {

            if (shadowElement && shadowElement.parentNode) {
                document.body.removeChild(shadowElement);
            }

            isDraggingTask = false;

            // Reset scrollable to true after touch ends
            scrollable = `true`;
            yearContainer.style.overflow = "scroll";
    
            // document.body.style.overflow = '';
            dragButton.innerHTML = `Drag<br>OFF`;
            console.log(`year container is scrollable`);

        }
    }
});
