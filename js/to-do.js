// js/to-do.js
function migrateTodos() {
  let changed = false;

  todos.forEach(todo => {
    if (todo.priority === undefined) {
      todo.priority = null;
      changed = true;
    }
    if (todo.subtasks === undefined) {
      todo.subtasks = [];
      changed = true;
    }
    if (todo.description === undefined) {
      todo.description = "";
      changed = true;
    }
    if (todo.dueDate === undefined) {
      todo.dueDate = null;
      changed = true;
    }
    if (todo.timeEstimate === undefined) {
      todo.timeEstimate = "";
      changed = true;
    }
  });

  if (changed) {
    localStorage.setItem("todos", JSON.stringify(todos));
  }
}

let todos = JSON.parse(localStorage.getItem("todos")) || [];
migrateTodos();

// === Priority colors ===
const TODO_PRIORITY_COLORS = {
  high: "#ff4444",
  medium: "#ff8800",
  low: "#4caf50",
  null: "#cccccc",
};

// === Helper function to ensure 6-digit hex color ===
function todoNormalizeColor(color) {
  if (color.match(/^#[0-9A-Fa-f]{3}$/)) {
    return (
      "#" +
      color[1] +
      color[1] +
      color[2] +
      color[2] +
      color[3] +
      color[3]
    );
  }
  return color;
}

// === Format due date ===
function todoFormatDueDate(dueDate) {
  if (!dueDate) return "";

  const date = new Date(dueDate);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return "Tomorrow";
  } else {
    return date.toLocaleDateString();
  }
}

// === Cycle through priority levels ===
function todoCyclePriority(currentPriority) {
  const cycle = [null, "low", "medium", "high"];
  const currentIndex = cycle.indexOf(currentPriority);
  return cycle[(currentIndex + 1) % cycle.length];
}

// === Render all todos ===
function renderTodos() {
  const list = document.querySelector(".todo-list");
  list.innerHTML = "";

  const sortedTodos = [...todos].sort((a, b) => b.pinned - a.pinned);

  sortedTodos.forEach((todo) => {
    const item = document.createElement("div");
    item.className = "todo-item";

    const normalizedColor = todoNormalizeColor(todo.color);
    // item.style.borderLeft = `6px solid ${normalizedColor}`;

    let contentHTML = `
      <div class="todo-header">
        <input type="checkbox" class="todo-done-checkbox" ${todo.done ? "checked" : ""
      }>
        <div class="todo-title ${todo.done ? "done" : ""}">${todo.text}</div>
        <div class="todo-header-actions">
         <div class="todo-priority">
            <button class="todo-priority-btn" style="color: ${TODO_PRIORITY_COLORS[todo.priority]}">
                <span class="material-symbols-outlined todo-priority-icon">flag</span>
            </button>
              <div class="todo-priority-dropdown" style="display: none;">
                <button data-priority="null">None</button>
                <button data-priority="low">Low</button>
                <button data-priority="medium">Medium</button>
                <button data-priority="high">High</button>
              </div>
          </div>

      <button class="todo-pin-btn ${todo.pinned ? "pinned" : ""}">
            <span class="material-symbols-outlined todo-pin-icon">star</span>
        </button>

        </div>
      </div>
    `;

    if (todo.description.trim()) {
      contentHTML += `<div class="todo-description">${todo.description}</div>`;
    }

    if (todo.subtasks && todo.subtasks.length > 0) {
      contentHTML += '<div class="todo-subtasks">';
      todo.subtasks.forEach((subtask, index) => {
        contentHTML += `
          <div class="todo-subtask-item">
            <input type="checkbox" class="todo-subtask-checkbox" 
                   ${subtask.done ? "checked" : ""} 
                   data-index="${index}">
            <span class="todo-subtask-text ${subtask.done ? "done" : ""
          }">${subtask.title}</span>
          </div>
        `;
      });
      contentHTML += "</div>";
    }

    if (todo.dueDate || todo.timeEstimate || todo.createdAt) {
      contentHTML += '<div class="todo-bottom">';
      if (todo.dueDate) {
        contentHTML += `<span class="todo-due-date">Due: ${todoFormatDueDate(
          todo.dueDate
        )}</span>`;
      } else {
        contentHTML += `<span class="todo-created-at">Created: ${todoFormatDate(
          todo.createdAt
        )}</span>`;
      }

      if (todo.timeEstimate) {
        contentHTML += `<span class="todo-time-estimate">⏱️ ${todo.timeEstimate}</span>`;
      }

       contentHTML += `
      <div class="todo-menu">
        <button class="todo-menu-btn">
            <span class="material-symbols-outlined todo-menu-icon">more_vert</span>
        </button>

        <div class="todo-menu-dropdown" style="display: none;">
          <button class="todo-menu-edit">✏️ Edit</button>
          <button class="todo-menu-delete">🗑️ Delete</button>
        </div>
      </div>
    `;


      contentHTML += "</div>";
    }

   

    item.innerHTML = contentHTML;

    // === Event Listeners ===
    item
      .querySelector(".todo-done-checkbox")
      .addEventListener("change", (e) => {
        todo.done = e.target.checked;
        todoSaveAndRender();
      });

    item.querySelectorAll(".todo-subtask-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", (e) => {
        const index = parseInt(e.target.getAttribute("data-index"));
        todo.subtasks[index].done = e.target.checked;
        todoSaveAndRender();
      });
    });

    const priorityBtn = item.querySelector(".todo-priority-btn");
    const priorityDropdown = item.querySelector(".todo-priority-dropdown");

    // toggle dropdown
    priorityBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelectorAll(".todo-priority-dropdown").forEach((menu) => {
        if (menu !== priorityDropdown) menu.style.display = "none";
      });
      priorityDropdown.style.display =
        priorityDropdown.style.display === "none" ? "block" : "none";
    });

    // handle selection
    priorityDropdown.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const selected = btn.getAttribute("data-priority");
        todo.priority = selected === "null" ? null : selected;
        todoSaveAndRender();
      });
    });


    item.querySelector(".todo-pin-btn").addEventListener("click", () => {
      todo.pinned = !todo.pinned;
      todoSaveAndRender();
    });

    const menuBtn = item.querySelector(".todo-menu-btn");
    const menuDropdown = item.querySelector(".todo-menu-dropdown");

    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelectorAll(".todo-menu-dropdown").forEach((menu) => {
        if (menu !== menuDropdown) menu.style.display = "none";
      });
      menuDropdown.style.display =
        menuDropdown.style.display === "none" ? "block" : "none";
    });

    item.querySelector(".todo-menu-edit").addEventListener("click", () => {
      todoOpenEditModal(todo);
      menuDropdown.style.display = "none";
    });

    item.querySelector(".todo-menu-delete").addEventListener("click", () => {
      if (confirm("Delete this task?")) {
        todos = todos.filter((t) => t.id !== todo.id);
        todoSaveAndRender();
      }
      menuDropdown.style.display = "none";
    });

    list.appendChild(item);
  });

  document.addEventListener("click", () => {
    document.querySelectorAll(".todo-menu-dropdown, .todo-priority-dropdown").forEach((menu) => {
      menu.style.display = "none";
    });
  });

}

// === Edit/Create Modal ===
function todoOpenEditModal(todo = null) {
  console.log("fab clicked");
  const isEdit = todo !== null;

  const modal = document.createElement("div");
  modal.className = "todo-modal-overlay";

  const subtasksHTML = (todo?.subtasks || [])
    .map(
      (subtask, index) => `
    <div class="todo-subtask-input">
      <input type="text" value="${subtask.title}" placeholder="Subtask">
      <button type="button" class="todo-remove-subtask">❌</button>
    </div>
  `
    )
    .join("");

  modal.innerHTML = `
    <div class="todo-modal-content">
      <h3>${isEdit ? "Edit Task" : "New Task"}</h3>
      
      <input type="text" id="todo-task-title" placeholder="Task title" 
             value="${todo?.text || ""}" required>
      
      <textarea id="todo-task-description" placeholder="Description (optional)" 
                rows="3">${todo?.description || ""}</textarea>
      
      <div class="todo-subtasks-section">
        <label>Subtasks:</label>
        <div id="todo-subtasks-container">
          ${subtasksHTML}
        </div>
        <button type="button" id="todo-add-subtask">➕ Add Subtask</button>
      </div>
      
      <div class="todo-modal-row">
        <div>
          <label>Due Date:</label>
          <input type="date" id="todo-due-date" 
                 value="${todo?.dueDate
      ? new Date(todo.dueDate).toISOString().split("T")[0]
      : ""
    }">
        </div>
        <div>
          <label>Time Estimate:</label>
          <input type="text" id="todo-time-estimate" placeholder="2h, 30min..." 
                 value="${todo?.timeEstimate || ""}">
        </div>
      </div>
      
      <div class="todo-modal-actions">
        <button type="button" id="todo-save-task">${isEdit ? "Save" : "Create"
    }</button>
        <button type="button" id="todo-cancel-task">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // subtask add/remove
  const addSubtaskBtn = modal.querySelector("#todo-add-subtask");
  const subtasksContainer = modal.querySelector("#todo-subtasks-container");

  addSubtaskBtn.addEventListener("click", () => {
    const subtaskDiv = document.createElement("div");
    subtaskDiv.className = "todo-subtask-input";
    subtaskDiv.innerHTML = `
      <input type="text" placeholder="Subtask">
      <button type="button" class="todo-remove-subtask">❌</button>
    `;
    subtasksContainer.appendChild(subtaskDiv);
  });

  subtasksContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("todo-remove-subtask")) {
      e.target.parentElement.remove();
    }
  });

  // save
  modal.querySelector("#todo-save-task").addEventListener("click", () => {
    const title = modal.querySelector("#todo-task-title").value.trim();
    if (!title) {
      alert("Task title is required!");
      return;
    }

    const description = modal
      .querySelector("#todo-task-description")
      .value.trim();
    const dueDate = modal.querySelector("#todo-due-date").value || null;
    const timeEstimate = modal
      .querySelector("#todo-time-estimate")
      .value.trim();

    const subtaskInputs = modal.querySelectorAll(".todo-subtask-input input");
    const subtasks = Array.from(subtaskInputs)
      .map((input) => input.value.trim())
      .filter((text) => text)
      .map((title) => ({ title, done: false }));

    if (isEdit) {
      todo.text = title;
      todo.description = description;
      todo.dueDate = dueDate ? new Date(dueDate).getTime() : null;
      todo.timeEstimate = timeEstimate;
      todo.subtasks = subtasks;
    } else {
      todoCreate(title, {
        description,
        dueDate: dueDate ? new Date(dueDate).getTime() : null,
        timeEstimate,
        subtasks,
      });
    }

    document.body.removeChild(modal);
    todoSaveAndRender();
  });

  modal.querySelector("#todo-cancel-task").addEventListener("click", () => {
    document.body.removeChild(modal);
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

// utils
function todoRan(max) {
  return Math.floor(Math.random() * (max + 1));
}

function todoRgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")
  );
}

function todoGetRandomColor() {
  return todoRgbToHex(todoRan(255), todoRan(255), todoRan(255));
}

// create
function todoCreate(
  text,
  {
    pinned = false,
    color = todoGetRandomColor(),
    dueDate = null,
    description = "",
    priority = null,
    subtasks = [],
    timeEstimate = "",
  } = {}
) {
  const todo = {
    id: `todo-${Date.now()}`,
    text,
    pinned,
    color: todoNormalizeColor(color),
    done: false,
    createdAt: Date.now(),
    dueDate,
    description,
    priority,
    subtasks,
    timeEstimate,
  };

  todos.push(todo);
  todoSaveAndRender();
}

// save + render
function todoSaveAndRender() {
  localStorage.setItem("todos", JSON.stringify(todos));
  renderTodos();
}

// fab
document.querySelector(".todo-fab").addEventListener("click", () => {
  console.log("fab clicked");
  todoOpenEditModal();
});

function todoFormatDate(timestamp) {
  if (!timestamp) return "";

  const date = new Date(Number(timestamp));
  return date.toLocaleDateString("en-US");
}



// initial render
renderTodos();
