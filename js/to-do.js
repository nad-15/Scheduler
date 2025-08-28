

// === Cycle through priority levels ===// js/to-do.js
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

// === Sort settings ===
// let currentSortMode = localStorage.getItem("todoSortMode") || "date-newest"; // "date-newest", "date-oldest", "group", "due-date", "completion", "time-estimate"
let currentSortMode = appSettings["todo-sort-mode"];


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
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const today = new Date(todayVertView); // your global Toronto time
  today.setHours(0, 0, 0, 0);

  const diffTime = target - today;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Tomorrow";
  } else if (diffDays > 1) {
    return `${target.toLocaleDateString("en-US")} (in ${diffDays} days)`;
  } else {
    return `${target.toLocaleDateString("en-US")} (${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? "s" : ""} ago)`;
  }
}

// === Helper function to parse time estimates ===
function parseTimeEstimate(timeStr) {
  if (!timeStr || timeStr.trim() === "") return 0;

  const str = timeStr.toLowerCase().trim();
  let totalMinutes = 0;

  // Match patterns like: 2h, 30m, 1h 30m, 2 hours, 30 minutes, etc.
  const hourMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)/);
  const minuteMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)/);
  const dayMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:d|day|days)/);

  if (dayMatch) {
    totalMinutes += parseFloat(dayMatch[1]) * 24 * 60; // Convert days to minutes
  }
  if (hourMatch) {
    totalMinutes += parseFloat(hourMatch[1]) * 60; // Convert hours to minutes
  }
  if (minuteMatch) {
    totalMinutes += parseFloat(minuteMatch[1]); // Minutes
  }

  // If no time units found, assume it's just a number (treat as minutes)
  if (totalMinutes === 0) {
    const numMatch = str.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) {
      totalMinutes = parseFloat(numMatch[1]);
    }
  }

  return totalMinutes;
}
function todoCyclePriority(currentPriority) {
  const cycle = [null, "low", "medium", "high"];
  const currentIndex = cycle.indexOf(currentPriority);
  return cycle[(currentIndex + 1) % cycle.length];
}

// === Sort todos based on current mode ===
function sortTodos(todos) {
  switch (currentSortMode) {
    case "date-newest":
      return [...todos].sort((a, b) => {
        // Pinned items always on top
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        // Then by date (newest first)
        return b.createdAt - a.createdAt;
      });

    case "date-oldest":
      return [...todos].sort((a, b) => {
        // Pinned items always on top
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        // Then by date (oldest first)
        return a.createdAt - b.createdAt;
      });

    case "group":
      return [...todos].sort((a, b) => {
        // Define priority order for grouping
        const getPriorityOrder = (todo) => {
          if (todo.pinned) return 0; // Starred
          if (todo.done) return 5; // Completed
          switch (todo.priority) {
            case "high": return 1;
            case "medium": return 2;
            case "low": return 3;
            case null: return 4;
            default: return 4;
          }
        };

        const aOrder = getPriorityOrder(a);
        const bOrder = getPriorityOrder(b);

        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }

        // Within same group, sort by creation date (newest first)
        return b.createdAt - a.createdAt;
      });

    case "due-date":
      return [...todos].sort((a, b) => {
        // Pinned items always on top
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;

        // Handle due dates: overdue first, then by due date, then no due date last
        if (a.dueDate && b.dueDate) {
          return a.dueDate - b.dueDate; // Earlier due dates first
        }
        if (a.dueDate && !b.dueDate) return -1; // Items with due dates before items without
        if (!a.dueDate && b.dueDate) return 1;

        // If both have no due date, sort by creation date (newest first)
        return b.createdAt - a.createdAt;
      });

    case "completion":
      return [...todos].sort((a, b) => {
        // Pinned items always on top (regardless of completion)
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;

        // Then sort by completion status
        if (a.done !== b.done) {
          return a.done ? 1 : -1; // Not completed first, then completed
        }

        // Within same completion status, sort by creation date (newest first)
        return b.createdAt - a.createdAt;
      });

    case "time-estimate":
      return [...todos].sort((a, b) => {
        // Pinned items always on top
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;

        // Parse time estimates
        const aTime = parseTimeEstimate(a.timeEstimate);
        const bTime = parseTimeEstimate(b.timeEstimate);

        // Sort: tasks with estimates first (shorter first), then tasks without estimates
        if (aTime > 0 && bTime > 0) {
          return aTime - bTime; // Shorter tasks first
        }
        if (aTime > 0 && bTime === 0) return -1; // Tasks with estimates before tasks without
        if (aTime === 0 && bTime > 0) return 1;

        // If both have no time estimate, sort by creation date (newest first)
        return b.createdAt - a.createdAt;
      });

    default:
      return todos;
  }
}

// === Get grouped todos for group mode ===
function getGroupedTodos(sortedTodos) {
  if (currentSortMode !== "group" && currentSortMode !== "due-date" && currentSortMode !== "completion" && currentSortMode !== "time-estimate") {
    return [{ title: null, todos: sortedTodos }];
  }

  const groups = [];
  let currentGroup = null;

  if (currentSortMode === "due-date") {
    // Group by due date categories
    sortedTodos.forEach(todo => {
      let groupTitle;

      if (todo.pinned) {
        groupTitle = "⭐ Starred";
      } else if (todo.dueDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(todo.dueDate);
        dueDate.setHours(0, 0, 0, 0);

        const diffTime = dueDate - today;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          groupTitle = "🚨 Overdue";
        } else if (diffDays === 0) {
          groupTitle = "📅 Due Today";
        } else if (diffDays === 1) {
          groupTitle = "⏰ Due Tomorrow";
        } else if (diffDays <= 7) {
          groupTitle = "📆 Due This Week";
        } else {
          groupTitle = "📋 Due Later";
        }
      } else {
        groupTitle = "⏳ No Due Date";
      }

      if (!currentGroup || currentGroup.title !== groupTitle) {
        currentGroup = { title: groupTitle, todos: [] };
        groups.push(currentGroup);
      }

      currentGroup.todos.push(todo);
    });
  } else if (currentSortMode === "completion") {
    // Group by completion status
    sortedTodos.forEach(todo => {
      let groupTitle;

      if (todo.pinned) {
        groupTitle = "⭐ Starred";
      } else if (todo.done) {
        groupTitle = "✅ Completed";
      } else {
        groupTitle = "📋 Not Completed";
      }

      if (!currentGroup || currentGroup.title !== groupTitle) {
        currentGroup = { title: groupTitle, todos: [] };
        groups.push(currentGroup);
      }

      currentGroup.todos.push(todo);
    });
  } else if (currentSortMode === "time-estimate") {
    // Group by time estimate ranges
    sortedTodos.forEach(todo => {
      let groupTitle;

      if (todo.pinned) {
        groupTitle = "⭐ Starred";
      } else {
        const timeMinutes = parseTimeEstimate(todo.timeEstimate);

        if (timeMinutes === 0) {
          groupTitle = "❓ No Time Estimate";
        } else if (timeMinutes <= 15) {
          groupTitle = "⚡ Quick Tasks (≤ 15 min)";
        } else if (timeMinutes <= 30) {
          groupTitle = "🏃 Short Tasks (16-30 min)";
        } else if (timeMinutes <= 60) {
          groupTitle = "🚶 Medium Tasks (31-60 min)";
        } else if (timeMinutes <= 120) {
          groupTitle = "📚 Long Tasks (1-2 hours)";
        } else if (timeMinutes <= 480) {
          groupTitle = "📊 Extended Tasks (2-8 hours)";
        } else {
          groupTitle = "🏔️ Major Projects (8+ hours)";
        }
      }

      if (!currentGroup || currentGroup.title !== groupTitle) {
        currentGroup = { title: groupTitle, todos: [] };
        groups.push(currentGroup);
      }

      currentGroup.todos.push(todo);
    });
  } else {
    // Original group mode by priority
    sortedTodos.forEach(todo => {
      let groupTitle;

      if (todo.pinned) {
        groupTitle = "⭐ Starred";
      } else if (todo.done) {
        groupTitle = "✅ Completed";
      } else {
        switch (todo.priority) {
          case "high":
            groupTitle = "🔴 High Priority";
            break;
          case "medium":
            groupTitle = "🟠 Medium Priority";
            break;
          case "low":
            groupTitle = "🟢 Low Priority";
            break;
          case null:
          default:
            groupTitle = "📋 No Priority";
            break;
        }
      }

      if (!currentGroup || currentGroup.title !== groupTitle) {
        currentGroup = { title: groupTitle, todos: [] };
        groups.push(currentGroup);
      }

      currentGroup.todos.push(todo);
    });
  }

  return groups;
}

// === Change sort mode ===
function changeSortMode(newMode) {
  currentSortMode = newMode;
  appSettings["todo-sort-mode"] = newMode;
  localStorage.setItem("appSettings", JSON.stringify(appSettings)); // save to localStorage
  renderTodos();
}

// === Render all todos ===
function renderTodos() {
  const list = document.querySelector(".todo-list");
  list.innerHTML = "";

  // Add sort controls if they don't exist
  if (!document.querySelector(".todo-sort-controls")) {
    const sortControls = document.createElement("div");
    sortControls.className = "todo-sort-controls";
    sortControls.innerHTML = `
      <div class="todo-sort-buttons">
        <button class="todo-sort-btn ${currentSortMode === 'date-newest' ? 'active' : ''}" data-sort="date-newest">
          📅 Newest First
        </button>
        <button class="todo-sort-btn ${currentSortMode === 'date-oldest' ? 'active' : ''}" data-sort="date-oldest">
          📅 Oldest First
        </button>
        <button class="todo-sort-btn ${currentSortMode === 'group' ? 'active' : ''}" data-sort="group">
          📊 Group by Priority
        </button>
        <button class="todo-sort-btn ${currentSortMode === 'due-date' ? 'active' : ''}" data-sort="due-date">
          📆 By Due Date
        </button>
        <button class="todo-sort-btn ${currentSortMode === 'completion' ? 'active' : ''}" data-sort="completion">
          ✅ By Completion
        </button>
        <button class="todo-sort-btn ${currentSortMode === 'time-estimate' ? 'active' : ''}" data-sort="time-estimate">
          ⏱️ By Time Estimate
        </button>
      </div>
    `;

    // Add event listeners for sort buttons
    sortControls.addEventListener('click', (e) => {
      if (e.target.classList.contains('todo-sort-btn')) {
        const newSort = e.target.getAttribute('data-sort');
        changeSortMode(newSort);

        // Update active button
        sortControls.querySelectorAll('.todo-sort-btn').forEach(btn => {
          btn.classList.remove('active');
        });
        e.target.classList.add('active');
      }
    });

    list.parentNode.insertBefore(sortControls, list);
  }

  const sortedTodos = sortTodos(todos);
  const groupedTodos = getGroupedTodos(sortedTodos);

  groupedTodos.forEach(group => {
    // Add group title if in group mode and group has todos
    if (group.title && group.todos.length > 0) {
      const groupHeader = document.createElement("div");
      groupHeader.className = "todo-group-header";
      groupHeader.innerHTML = `<h4>${group.title}</h4>`;
      list.appendChild(groupHeader);
    }

    group.todos.forEach((todo) => {
      const item = document.createElement("div");
      item.className = "todo-item";

      const normalizedColor = todoNormalizeColor(todo.color);

      let contentHTML = `
        <div class="todo-header">
          <input type="checkbox" class="todo-done-checkbox" ${todo.done ? "checked" : ""}>
          <div class="todo-title ${todo.done ? "done" : ""}">${todo.text}</div>
          <div class="todo-header-actions">
           <div class="todo-priority">
              <button class="todo-priority-btn" style="color: ${TODO_PRIORITY_COLORS[todo.priority]}">
                  <span class="material-symbols-outlined todo-priority-icon">flag</span>
              </button>
                <div class="todo-priority-dropdown" style="display: none;">
  <button data-priority="null">
    <span class="material-symbols-outlined todo-priority-flag">flag</span>
    None
  </button>

  <button data-priority="low">
    <span class="material-symbols-outlined todo-priority-flag">flag</span>
    Low
  </button>

  <button data-priority="medium">
    <span class="material-symbols-outlined todo-priority-flag">flag</span>
    Medium
  </button>

  <button data-priority="high">
    <span class="material-symbols-outlined todo-priority-flag">flag</span>
    High
  </button>

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
              <span class="todo-subtask-text ${subtask.done ? "done" : ""}">${subtask.title}</span>
            </div>
          `;
        });
        contentHTML += "</div>";
      }

      if (todo.dueDate || todo.timeEstimate || todo.createdAt) {
        contentHTML += '<div class="todo-bottom">';
        if (todo.dueDate) {
          contentHTML += `<span class="todo-due-date">Due: ${todoFormatDueDate(todo.dueDate)}</span>`;
        } else {
          contentHTML += `<span class="todo-created-at">Added: ${todoFormatDate(todo.createdAt)}</span>`;
        }

        if (todo.timeEstimate) {
          contentHTML += `<span class="todo-time-estimate">⏱ ${todo.timeEstimate}</span>`;
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
      const titleEl = item.querySelector(".todo-title");
      if (titleEl) {
        titleEl.style.setProperty("--priority-color", normalizedColor);
      }

      // === Event Listeners ===
      item.querySelector(".todo-done-checkbox").addEventListener("change", (e) => {
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
                 value="${todo?.dueDate ? new Date(todo.dueDate).toISOString().split("T")[0] : ""}">
        </div>
        <div>
          <label>Time Estimate:</label>
          <input type="text" id="todo-time-estimate" placeholder="2h, 30min..." 
                 value="${todo?.timeEstimate || ""}">
        </div>
      </div>
      
      <div class="todo-modal-actions">
        <button type="button" id="todo-save-task">${isEdit ? "Save" : "Create"}</button>
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

    const description = modal.querySelector("#todo-task-description").value.trim();
    const dueDate = modal.querySelector("#todo-due-date").value || null;
    const timeEstimate = modal.querySelector("#todo-time-estimate").value.trim();

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

  // normalize the target date (midnight)
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  // use global todayVertView (already set to Toronto midnight)
  const diffTime = targetDate - todayVertView;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const formattedDate = date.toLocaleDateString("en-US");

  if (diffDays > 0) {
    return `${formattedDate} (${diffDays} day${diffDays > 1 ? "s" : ""} remaining)`;
  } else if (diffDays === 0) {
    return `${formattedDate} (Today)`;
  } else {
    return `${formattedDate} (${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? "s" : ""} ago)`;
  }
}

const todoToggleSortBy = document.querySelector(".sort-buttons-toggle");

todoToggleSortBy.addEventListener("click", () => {
  const sortButtons = document.querySelector(".todo-sort-buttons");
  if (sortButtons.classList.contains("open")) {

    sortButtons.style.maxHeight = 0;
    sortButtons.classList.remove("open");
  } else {
    sortButtons.style.maxHeight = sortButtons.scrollHeight + "px";
    sortButtons.classList.add("open");
  }
});
