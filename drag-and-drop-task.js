



let isDraggingTask = false;
let startX, startY;
let touchStartTime;
let draggedItem, shadowElement;
let scrollable = `true`;


const dragButton = document.querySelector(`.drag-button`);

dragButton.addEventListener(`click`,()=> {
    alert(`this functionality is currently unstable`);
    if(scrollable ===`false`) {
        console.log(scrollable);
        dragButton.innerHTML = `Drag<br>OFF`;
        scrollable = `true`;
        
    } else {
        console.log(scrollable);
        dragButton.innerHTML = `Drag<br>ON`;
        scrollable = `false`;
    }

} );

// yearContainer.style.overflow = 'hidden';

yearContainer.addEventListener('touchstart', (e) => {
    if (scrollable === `false`) {
        // Identify the clicked task div
        draggedItem = e.target.closest('.morningTask, .afternoonTask, .eveningTask');

        if (!draggedItem) return; // Exit if no valid task div clicked

        // Initialize drag variables
        isDraggingTask = false;
        touchStartTime = Date.now();
        startX = e.touches[0].pageX;
        startY = e.touches[0].pageY;

        // Clone the dragged item
        shadowElement = draggedItem.cloneNode(true);
        shadowElement.style.position = "fixed";
        // Get the bounding rectangle of the dragged item
        const rect = draggedItem.getBoundingClientRect();

        // Set the height and width using the bounding rectangle
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
});

yearContainer.addEventListener('touchmove', (e) => {
    if (scrollable === `false`) {
        if (!draggedItem) return; // Exit if no task div is being dragged

        // Check if the user has moved the touch significantly to start dragging
        const deltaX = e.touches[0].pageX - startX;
        const deltaY = e.touches[0].pageY - startY;

        if (!isDraggingTask && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
            isDraggingTask = true;
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
    if (scrollable === `false`) {
        if (!draggedItem) return; // Exit if no task div was being dragged

        // If dragging, update the target div with the cloned content
        if (isDraggingTask) {
            const targetTaskDiv = document.elementFromPoint(e.changedTouches[0].pageX, e.changedTouches[0].pageY)
                .closest('.morningTask, .afternoonTask, .eveningTask');

            if (targetTaskDiv && targetTaskDiv !== draggedItem) {
                // Swap the background color and text content of the dragged item and target task div
                const draggedBackground = draggedItem.style.backgroundColor;
                const draggedText = draggedItem.textContent;

                draggedItem.style.backgroundColor = targetTaskDiv.style.backgroundColor;
                draggedItem.textContent = targetTaskDiv.textContent;

                targetTaskDiv.style.backgroundColor = draggedBackground;
                targetTaskDiv.textContent = draggedText;
            }
        }

        // Remove the cloned shadow element after the drop
        document.body.removeChild(shadowElement);

        // Reset dragging state
        isDraggingTask = false;
    }
});



// let isDraggingTask = false;
// let startX, startY;
// let touchStartTime;
// let draggedItem, shadowElement;
// let scrollable = `false`;
// // yearContainer.style.overflow = 'hidden';



// yearContainer.addEventListener('touchstart', (e) => {

//     if (scrollable === `false`) {
//         // Identify the clicked task div
//         draggedItem = e.target.closest('.morningTask, .afternoonTask, .eveningTask');

//         if (!draggedItem) return; // Exit if no valid task div clicked

//         // Initialize drag variables
//         isDraggingTask = false;
//         touchStartTime = Date.now();
//         startX = e.touches[0].pageX;
//         startY = e.touches[0].pageY;


//         // Clone the dragged item
//         shadowElement = draggedItem.cloneNode(true);
//         shadowElement.style.position = "fixed";
//         // Get the bounding rectangle of the dragged item
//         const rect = draggedItem.getBoundingClientRect();

//         // Set the height and width using the bounding rectangle
//         shadowElement.style.height = `${rect.height}px`;
//         shadowElement.style.width = `${rect.width}px`;
//         shadowElement.style.opacity = "0.5"; // Semi-transparent effect
//         shadowElement.style.pointerEvents = "none"; // Ignore events on the shadow
//         shadowElement.style.zIndex = "1000";
//         shadowElement.style.left = `${startX}px`;
//         shadowElement.style.top = `${startY}px`;

//         // Append cloned shadow element to body
//         document.body.appendChild(shadowElement);
//     }
// });

// yearContainer.addEventListener('touchmove', (e) => {

//     if (scrollable === `false`) {
//         if (!draggedItem) return; // Exit if no task div is being dragged

//         // Check if the user has moved the touch significantly to start dragging
//         const deltaX = e.touches[0].pageX - startX;
//         const deltaY = e.touches[0].pageY - startY;

//         if (!isDraggingTask && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
//             isDraggingTask = true;
//         }

//         if (isDraggingTask) {
//             // Move the cloned shadow element with the touch
//             shadowElement.style.left = `${e.touches[0].pageX - shadowElement.offsetWidth / 2}px`;
//             shadowElement.style.top = `${e.touches[0].pageY - shadowElement.offsetHeight / 2}px`;

//             // Prevent default behavior during dragging
//             e.preventDefault();
//         }

//     }


// });

// yearContainer.addEventListener('touchend', (e) => {

//     if (scrollable === `false`) {
//         if (!draggedItem) return; // Exit if no task div was being dragged

//         // If dragging, update the target div with the cloned content
//         if (isDraggingTask) {
//             const targetTaskDiv = document.elementFromPoint(e.changedTouches[0].pageX, e.changedTouches[0].pageY)
//                 .closest('.morningTask, .afternoonTask, .eveningTask');

//             if (targetTaskDiv && targetTaskDiv !== draggedItem) {
//                 // Copy the background color and text content of the dragged item to the target
//                 targetTaskDiv.style.backgroundColor = shadowElement.style.backgroundColor;
//                 targetTaskDiv.textContent = shadowElement.textContent;
//             }


//         }

//         // Remove the cloned shadow element after the drop
//         document.body.removeChild(shadowElement);

//         // Reset dragging state
//         isDraggingTask = false;
//     }
// });
