const jobTemplate = document.getElementById('movable-template');
const dragHandle = document.querySelector('.drag-handle');

let isDragging = false;
let offsetX = 0;
let offsetY = 0;

function startDrag(e) {
    e.preventDefault();
    isDragging = true;

    // Determine touch or mouse position
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    offsetX = clientX - jobTemplate.offsetLeft;
    offsetY = clientY - jobTemplate.offsetTop;
}

function onDrag(e) {
    if (isDragging) {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        let x = clientX - offsetX;
        let y = clientY - offsetY;

        const maxX = window.innerWidth - jobTemplate.offsetWidth;
        const maxY = window.innerHeight - jobTemplate.offsetHeight;

        x = Math.max(0, Math.min(x, maxX));
        y = Math.max(0, Math.min(y, maxY));

        jobTemplate.style.left = `${x}px`;
        jobTemplate.style.top = `${y}px`;

    }
}

function endDrag() {
    isDragging = false;
}

// Attach drag handlers only to the drag handle
dragHandle.addEventListener('mousedown', startDrag);
document.addEventListener('mousemove', onDrag);
document.addEventListener('mouseup', endDrag);

// For mobile (touch events)
dragHandle.addEventListener('touchstart', startDrag);
document.addEventListener('touchmove', onDrag);
document.addEventListener('touchend', endDrag);