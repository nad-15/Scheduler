// js/to-do.js

let todos = JSON.parse(localStorage.getItem("todos")) || [];

// === Helper function to ensure 6-digit hex color ===
function normalizeColor(color) {
  // If it's a 3-digit hex, expand to 6-digit
  if (color.match(/^#[0-9A-Fa-f]{3}$/)) {
    return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
  }
  // If it's already 6-digit or other format, return as-is
  return color;
}

// === Render all todos ===
function renderTodos() {
  const list = document.querySelector(".todos-list");
  list.innerHTML = "";

  const sortedTodos = [...todos].sort((a, b) => b.pinned - a.pinned);

  sortedTodos.forEach(todo => {
    const item = document.createElement("div");
    item.className = "todo-item";
    
    // Normalize color before using it
    const normalizedColor = normalizeColor(todo.color);
    item.style.borderLeft = `6px solid ${normalizedColor}`;

    item.innerHTML = `
      <input type="checkbox" class="done-checkbox" ${todo.done ? "checked" : ""}>

      <div class="todo-text ${todo.done ? "done" : ""}">
        ${todo.text}
      </div>

      <div class="todo-actions">
        <button class="pin-btn material-symbols-outlined">
          ${todo.pinned ? "keep" : "keep_off"}
        </button>

        <button class="color-btn material-symbols-outlined">palette</button>
        <input type="color" class="color-picker" style="display: none;" value="${normalizedColor}" hidden>

        <button class="edit-btn material-symbols-outlined">draw</button>
        <button class="delete-btn material-symbols-outlined">delete</button>
      </div>
    `;

    // === Event Listeners ===
    // done toggle
    item.querySelector(".done-checkbox").addEventListener("change", (e) => {
      todo.done = e.target.checked;
      saveAndRender();
    });

    // pin toggle
    item.querySelector(".pin-btn").addEventListener("click", () => {
      todo.pinned = !todo.pinned;
      saveAndRender();
    });

    // color picker
    const colorBtn = item.querySelector(".color-btn");
    const colorPicker = item.querySelector(".color-picker");
    colorBtn.addEventListener("click", () => colorPicker.click());
    colorPicker.addEventListener("input", (e) => {
      todo.color = e.target.value; // Color picker always returns 6-digit format
      saveAndRender();
    });

    // edit
    item.querySelector(".edit-btn").addEventListener("click", () => {
      const newText = prompt("Edit todo:", todo.text);
      if (newText) {
        todo.text = newText;
        saveAndRender();
      }
    });

    // delete
    item.querySelector(".delete-btn").addEventListener("click", () => {
      todos = todos.filter(t => t.id !== todo.id);
      saveAndRender();
    });

    list.appendChild(item);
  });
}

// === Create a todo ===
function createTodo(text, { pinned = false, color = "#cccccc", dueDate = null } = {}) {
  const todo = {
    id: `todo-${Date.now()}`,
    text,
    pinned,
    color: normalizeColor(color), // Normalize the color when creating
    done: false,
    createdAt: Date.now(),
    dueDate
  };

  todos.push(todo);
  saveAndRender();
}

// === Save + re-render ===
function saveAndRender() {
  localStorage.setItem("todos", JSON.stringify(todos));
  renderTodos();
}

// === Floating button click ===
document.querySelector(".todo-fab").addEventListener("click", () => {
  const todoText = prompt("Enter new todo:");
  if (todoText) createTodo(todoText);
});

// === Initial render ===
renderTodos();