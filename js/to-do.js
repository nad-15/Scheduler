const toggleLabel = document.querySelector(".sort-label");
const controls = document.querySelector(".todo-sort-controls");
const sortIcon = document.querySelector(".sort-icon");

const deleteBtn = document.querySelector(".todo-delete-btn");
const deleteDropdown = document.querySelector(".todo-delete-dropdown");
const deleteAllBtn = document.querySelector(".delete-all-btn");
const deleteCompletedBtn = document.querySelector(".delete-completed-btn");


const filterToggleBtn = document.querySelector(".todo-filter-mode-btn");
const filterDropdown = document.querySelector(".todo-filter-dropdown");


let filterMode = (appSettings["todo-filter-mode"] || DEFAULT_SETTINGS["todo-filter-mode"]);
function filterTodosByMode(todos, mode) {
  switch (mode) {
    case "all":
      return todos;
    case "archive":
      return todos.filter(t => t.isArchive);
    case "not-archived":
      return todos.filter(t => !t.isArchive);
    case "done":
      return todos.filter(t => t.done && !t.isArchive);
    case "incomplete":
    default:
      return todos.filter(t => !t.done && !t.isArchive);
  }
}

// === Cycle through priority levels ===// js/to-do.js
// function migrateTodos() {
//   let changed = false;

//   todos.forEach(todo => {
//     if (todo.priority === undefined) {
//       todo.priority = null;
//       changed = true;
//     }
//     if (todo.subtasks === undefined) {
//       todo.subtasks = [];
//       changed = true;
//     }
//     if (todo.description === undefined) {
//       todo.description = "";
//       changed = true;
//     }
//     if (todo.dueDate === undefined) {
//       todo.dueDate = null;
//       changed = true;
//     }
//     if (todo.timeEstimate === undefined) {
//       todo.timeEstimate = "";
//       changed = true;
//     }
//   });

//   if (changed) {
//     localStorage.setItem("todos", JSON.stringify(todos));
//   }
// }

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
    if (todo.isArchive === undefined) {
      todo.isArchive = false; // default for existing todos
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


function getTorontoNow() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Toronto" })
  ).getTime();
}
// === Format due date ===
// function todoFormatDueDate(dueDate) {
//   if (!dueDate) return "";

//   let target;
//   if (typeof dueDate === "string") {
//     // If from date picker → "YYYY-MM-DD"
//     const [year, month, day] = dueDate.split("-").map(Number);
//     target = new Date(getTorontoNow());
//     target.setFullYear(year, month - 1, day);
//     target.setHours(0, 0, 0, 0);
//   } else {
//     // If already a Date / timestamp
//     target = new Date(dueDate);
//   }

//   // Today in Toronto at midnight
//   const today = new Date(getTorontoNow());
//   today.setHours(0, 0, 0, 0);

//   const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));

//   if (diffDays === 0) return "Today";
//   if (diffDays === 1) return "Tomorrow";
//   if (diffDays > 1) return `${diffDays}d left`;
//   return `${Math.abs(diffDays)}d ago`;
// }


function todoFormatDueDate(dueDate) {
  if (!dueDate) return "";

  let target;
  if (typeof dueDate === "string") {
    const [year, month, day] = dueDate.split("-").map(Number);
    target = new Date(getTorontoNow());
    target.setFullYear(year, month - 1, day);
  } else {
    target = new Date(dueDate);
  }

  // Only compare dates, ignore hours
  target.setHours(0, 0, 0, 0);
  const today = new Date(getTorontoNow());
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
  const monthDay = target.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1) return `${monthDay} (${diffDays}d left)`;
  return `${monthDay} (${Math.abs(diffDays)}d ago)`;
}

// function todoFormatDueDate(dueDate) {
//   if (!dueDate) return "";

//   let target;
//   if (typeof dueDate === "string") {
//     const [year, month, day] = dueDate.split("-").map(Number);
//     target = new Date(getTorontoNow());
//     target.setFullYear(year, month - 1, day);
//   } else {
//     target = new Date(dueDate);
//   }

//   // Only compare dates, ignore hours
//   target.setHours(0, 0, 0, 0);
//   const today = new Date(getTorontoNow());
//   today.setHours(0, 0, 0, 0);

//   const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
//   const monthDayWeek = target.toLocaleDateString("en-US", {
//     weekday: "short",
//     month: "short",
//     day: "numeric",
//   });

//   if (diffDays === 0) return "Today";
//   if (diffDays === 1) return "Tomorrow";
//   if (diffDays > 1) return `${monthDayWeek} (${diffDays}d left)`;
//   return `${monthDayWeek} (${Math.abs(diffDays)}d ago)`;
// }

function todoFormatDate(timestamp) {
  if (!timestamp) return "";

  const date = new Date(Number(timestamp));
  const nowToronto = getTorontoNow(); // ✅ recalc live Toronto time
  const diffMs = nowToronto - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) {
    return `${diffHours}h ago`;
  } else {
    return `${diffDays}d ago`;
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

function parseTimeEstimateToSaveInLocal(timeString) {
  console.log(`parsed time estiamte function`);
  if (!timeString) return { hours: 0, minutes: 0 };

  const hoursMatch = timeString.match(/(\d+)\s*(?:h|hr|hrs|hour|hours)/i);
  const minutesMatch = timeString.match(/(\d+)\s*(?:m|min|mins|minute|minutes)/i);


  return {
    hours: hoursMatch ? parseInt(hoursMatch[1]) : 0,
    minutes: minutesMatch ? parseInt(minutesMatch[1]) : 0
  };
}

// === Sort todos based on current mode ===
// function sortTodos(todos) {
//   switch (currentSortMode) {
//     case "date-newest":
//       return [...todos].sort((a, b) => {
//         // Pinned items always on top
//         if (a.pinned && !b.pinned) return -1;
//         if (!a.pinned && b.pinned) return 1;
//         // Then by date (newest first)
//         return b.createdAt - a.createdAt;
//       });

//     case "date-oldest":
//       return [...todos].sort((a, b) => {
//         // Pinned items always on top
//         if (a.pinned && !b.pinned) return -1;
//         if (!a.pinned && b.pinned) return 1;
//         // Then by date (oldest first)
//         return a.createdAt - b.createdAt;
//       });

//     case "group":
//       return [...todos].sort((a, b) => {
//         // Define priority order for grouping
//         const getPriorityOrder = (todo) => {
//           if (todo.pinned) return 0; // Important
//           if (todo.done) return 5; // Completed
//           switch (todo.priority) {
//             case "high": return 1;
//             case "medium": return 2;
//             case "low": return 3;
//             case null: return 4;
//             default: return 4;
//           }
//         };

//         const aOrder = getPriorityOrder(a);
//         const bOrder = getPriorityOrder(b);

//         if (aOrder !== bOrder) {
//           return aOrder - bOrder;
//         }

//         // Within same group, sort by creation date (newest first)
//         return b.createdAt - a.createdAt;
//       });

//     case "due-date":
//       return [...todos].sort((a, b) => {
//         // Pinned items always on top
//         if (a.pinned && !b.pinned) return -1;
//         if (!a.pinned && b.pinned) return 1;

//         // Handle due dates: overdue first, then by due date, then no due date last
//         if (a.dueDate && b.dueDate) {
//           return a.dueDate - b.dueDate; // Earlier due dates first
//         }
//         if (a.dueDate && !b.dueDate) return -1; // Items with due dates before items without
//         if (!a.dueDate && b.dueDate) return 1;

//         // If both have no due date, sort by creation date (newest first)
//         return b.createdAt - a.createdAt;
//       });

//     case "completion":
//       return [...todos].sort((a, b) => {
//         // Pinned items always on top (regardless of completion)
//         if (a.pinned && !b.pinned) return -1;
//         if (!a.pinned && b.pinned) return 1;

//         // Then sort by completion status
//         if (a.done !== b.done) {
//           return a.done ? 1 : -1; // Not completed first, then completed
//         }

//         // Within same completion status, sort by creation date (newest first)
//         return b.createdAt - a.createdAt;
//       });

//     case "time-estimate":
//       return [...todos].sort((a, b) => {
//         // Pinned items always on top
//         if (a.pinned && !b.pinned) return -1;
//         if (!a.pinned && b.pinned) return 1;

//         // Parse time estimates
//         const aTime = parseTimeEstimate(a.timeEstimate);
//         const bTime = parseTimeEstimate(b.timeEstimate);

//         // Sort: tasks with estimates first (shorter first), then tasks without estimates
//         if (aTime > 0 && bTime > 0) {
//           return aTime - bTime; // Shorter tasks first
//         }
//         if (aTime > 0 && bTime === 0) return -1; // Tasks with estimates before tasks without
//         if (aTime === 0 && bTime > 0) return 1;

//         // If both have no time estimate, sort by creation date (newest first)
//         return b.createdAt - a.createdAt;
//       });

//     default:
//       return todos;
//   }
// }
function sortTodos(todos) {
  // Separate todos into categories
  const pinnedTodos = todos.filter(todo => todo.pinned);
  const incompleteTodos = todos.filter(todo => !todo.pinned && !todo.done);
  const completedTodos = todos.filter(todo => !todo.pinned && todo.done);

  // Helper function to sort a group of todos
  const sortGroup = (todoGroup) => {
    switch (currentSortMode) {
      case "date-newest":
        return [...todoGroup].sort((a, b) => b.createdAt - a.createdAt);

      case "date-oldest":
        return [...todoGroup].sort((a, b) => a.createdAt - b.createdAt);

      case "group":
        return [...todoGroup].sort((a, b) => {
          // Define priority order for grouping (without pinned since we handle that separately)
          const getPriorityOrder = (todo) => {
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
        return [...todoGroup].sort((a, b) => {
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
        // For completion sorting, we still sort by creation date within each group
        return [...todoGroup].sort((a, b) => b.createdAt - a.createdAt);

      case "time-estimate":
        return [...todoGroup].sort((a, b) => {
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
        return todoGroup;
    }
  };

  // Sort each group independently
  const sortedPinned = sortGroup(pinnedTodos);
  const sortedIncomplete = sortGroup(incompleteTodos);
  const sortedCompleted = sortGroup(completedTodos);

  // Combine: pinned first, then incomplete, then completed
  return [...sortedPinned, ...sortedIncomplete, ...sortedCompleted];
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
        groupTitle = "Important";
      } else if (todo.dueDate) {
        const today = new Date(todayVertView);
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(todo.dueDate);
        dueDate.setHours(0, 0, 0, 0);

        const diffTime = dueDate - today;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          groupTitle = "Overdue";
        } else if (diffDays === 0) {
          groupTitle = "Due Today";
        } else if (diffDays === 1) {
          groupTitle = "Due Tomorrow";
        } else if (diffDays <= 7) {
          groupTitle = "Due This Week";
        } else {
          groupTitle = "Due Later";
        }
      } else {
        groupTitle = "No Due Date";
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
        groupTitle = "Important";
      } else if (todo.done) {
        groupTitle = "Completed";
      } else {
        groupTitle = "To do";
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
        groupTitle = "Important";
      } else {
        const timeMinutes = parseTimeEstimate(todo.timeEstimate);

        if (timeMinutes === 0) {
          groupTitle = "No Estimate";
        } else if (timeMinutes <= 15) {
          groupTitle = "Quick (≤15m)";
        } else if (timeMinutes <= 30) {
          groupTitle = "Short (16-30m)";
        } else if (timeMinutes <= 60) {
          groupTitle = "Medium (31-60m)";
        } else if (timeMinutes <= 120) {
          groupTitle = "Long (1-2h)";
        } else if (timeMinutes <= 480) {
          groupTitle = "Extended (2-8h)";
        } else {
          groupTitle = "Major (8+h)";
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
        groupTitle = "Important";
      } else if (todo.done) {
        groupTitle = "Completed";
      } else {
        switch (todo.priority) {
          case "high":
            groupTitle = "High Priority";
            break;
          case "medium":
            groupTitle = "Medium Priority";
            break;
          case "low":
            groupTitle = "Low Priority";
            break;
          case null:
          default:
            groupTitle = "No Priority";
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

  const visibleTodos = filterTodosByMode(todos, filterMode);

  const sortedTodos = sortTodos(visibleTodos);
  const groupedTodos = getGroupedTodos(sortedTodos);

  groupedTodos.forEach(group => {
    // Add group title if in group mode and group has todos
    if (group.title && group.todos.length > 0) {
      const groupHeader = document.createElement("div");
      groupHeader.className = "todo-group-header";
      // groupHeader.innerHTML = `<span>• ${group.title}</span>`;
      groupHeader.innerHTML = `
            <div class="pill">
              <span class="bullet"></span>
              <span class="group-title">${group.title}</span>
            </div>
          `;
      list.appendChild(groupHeader);
    }

    group.todos.forEach((todo) => {
      const item = document.createElement("div");
      item.className = "todo-item";

      const normalizedColor = todoNormalizeColor(todo.color);
      //here
      let contentHTML = `
        <div class="todo-header">
          <input type="checkbox" class="todo-done-checkbox" ${todo.done ? "checked" : ""}>
                <div class="todo-title">

                  <span class="title-text ${todo.done ? "done" : ""}">${todo.text}</span>
                                    
                  <span class="time-estimate-container"> 
                    <span class="material-symbols-outlined time-estimate-icon">hourglass_top</span>
                    <span class="todo-time-estimate">
                      ${todo.timeEstimate === "0m" ? "--" : todo.timeEstimate}
                    </span>
                  </span>


                  <span class="todo-seemore hidden material-symbols-outlined">chevron_right</span>

                </div>
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
      contentHTML += '<div class="todo-bottom">';
      // Created date
      contentHTML += `
              <span class="todo-date-container">
                <span class="bullet created-bullet"></span>
                <span class="todo-created-at">Created: ${todoFormatDate(todo.createdAt)}</span>
              </span>
            `;
      // Due date
      contentHTML += `
            <span class="todo-date-container">
              <span class="bullet due-bullet"></span>
              <span class="todo-due-date">Due: ${todo.dueDate ? todoFormatDueDate(todo.dueDate) : '--'}</span>
            </span>
          `;

      //Menu more options ...
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

      item.innerHTML = contentHTML;
      const titleEl = item.querySelector(".title-text");
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
        closeAllDropdowns();
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
        closeAllDropdowns();
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

  // document.addEventListener("click", () => {
  //   document.querySelectorAll(".todo-menu-dropdown, .todo-priority-dropdown").forEach((menu) => {
  //     menu.style.display = "none";
  //   });
  // });


  if (appSettings["todo-collapsed"]) {
    document.querySelectorAll(".todo-item").forEach(item => {
      const hasDescription = !!item.querySelector(".todo-description");
      const hasSubtasks = !!item.querySelector(".todo-subtasks");
      const seeMore = item.querySelector(".todo-seemore");

      // only collapse and show arrow if it has something to hide
      if (hasDescription || hasSubtasks) {
        item.classList.add("collapsed");
        seeMore?.classList.remove("hidden");
      } else {
        // no description/subtasks -> keep expanded & no arrow
        item.classList.remove("collapsed");
        seeMore?.classList.add("hidden");
      }
    });

    const icon = document.querySelector(".collapse-toggle-btn .material-icons");
    if (icon) icon.textContent = "expand";

  } else {
    document.querySelectorAll(".todo-item").forEach(item => {
      const hasDescription = !!item.querySelector(".todo-description");
      const hasSubtasks = !!item.querySelector(".todo-subtasks");
      const seeMore = item.querySelector(".todo-seemore");

      // expand all
      item.classList.remove("collapsed");
      // arrow only if it actually has description/subtasks
      if (hasDescription || hasSubtasks) {
        seeMore?.classList.add("hidden");
      } else {
        seeMore?.classList.add("hidden"); // stays hidden anyway
      }
    });

    const icon = document.querySelector(".collapse-toggle-btn .material-icons");
    if (icon) icon.textContent = "compress";
  }


  document.querySelectorAll(".todo-seemore").forEach(seemore => {
    seemore.addEventListener("click", () => {
      console.log("todo seemore clicked");

      const todoItem = seemore.closest(".todo-item");
      const todoTitle = todoItem.querySelector(".todo-title");

      // toggle collapsed state on parent
      todoItem.classList.toggle("collapsed");

      // rotate arrow
      todoTitle.classList.toggle("expanded");
    });
  });



}
function formatTimeEstimate(hours, minutes) {
  const h = parseInt(hours) || 0;
  const m = parseInt(minutes) || 0;

  let timeString = '';
  if (h > 0) timeString += `${h}h`;
  if (m > 0) timeString += (h > 0 ? ', ' : '') + `${m}m`;

  return timeString || '0m';
}

// === Edit/Create Modal ===
function todoOpenEditModal(todo = null) {
  const isEdit = todo !== null;

  const modal = document.createElement("div");
  modal.className = "todo-modal-overlay";

  console.log(todo?.timeEstimate);

  const { hours, minutes } = parseTimeEstimateToSaveInLocal(todo?.timeEstimate || "");

  console.log(hours, minutes);

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
                      <fieldset class="time-estimate-box">
                        <legend>Time Estimate</legend>
                        <div class="time-input-group">
                          <div class="time-input-field">
                            <label>Hours</label>
                            <input type="number" id="hoursInput" min="0" max="23" placeholder="0" value="${hours || ""}">
                          </div>
                          <div class="time-input-field">
                            <label>Minutes</label>
                            <input type="number" id="minutesInput" min="0" max="59" placeholder="0" value="${minutes || ""}">
                          </div>
                        </div>
                      </fieldset>
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

    const hoursInput = document.getElementById('hoursInput');
    const minutesInput = document.getElementById('minutesInput');
    const timeEstimate = formatTimeEstimate(hoursInput.value, minutesInput.value);

    // const timeEstimate = modal.querySelector("#todo-time-estimate").value.trim();

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
// function todoCreate(
//   text,
//   {
//     pinned = false,
//     color = todoGetRandomColor(),
//     dueDate = null,
//     description = "",
//     priority = null,
//     subtasks = [],
//     timeEstimate = "",
//   } = {}
// ) {
//   const todo = {
//     id: `todo-${Date.now()}`,
//     text,
//     pinned,
//     color: todoNormalizeColor(color),
//     done: false,
//     createdAt: getTorontoNow(),
//     dueDate,
//     description,
//     priority,
//     subtasks,
//     timeEstimate,
//   };

//   todos.push(todo);
//   todoSaveAndRender();
// }

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
    isArchive = false, // <-- new flag
  } = {}
) {
  const todo = {
    id: `todo-${Date.now()}`,
    text,
    pinned,
    color: todoNormalizeColor(color),
    done: false,
    createdAt: getTorontoNow(),
    dueDate,
    description,
    priority,
    subtasks,
    timeEstimate,
    isArchive, // <-- added here
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

document.querySelector(".collapse-toggle-btn").addEventListener("click", () => {
  const icon = document.querySelector(".collapse-toggle-btn .material-icons");

  // flip the state
  appSettings["todo-collapsed"] = !appSettings["todo-collapsed"];

  // update the icon
  icon.textContent = appSettings["todo-collapsed"]
    ? "expand"
    : "compress";

  // persist setting
  localStorage.setItem("appSettings", JSON.stringify(appSettings));

  // let renderTodos handle the collapsed/expanded UI
  renderTodos();
});



toggleLabel.addEventListener("click", () => {
  controls.classList.toggle("show");
  sortIcon.classList.toggle("rotated");
});

controls.addEventListener("click", (e) => {
  if (e.target.classList.contains("todo-sort-btn")) {
    const newSort = e.target.dataset.sort;
    changeSortMode(newSort);

    controls.querySelectorAll(".todo-sort-btn").forEach(btn => btn.classList.remove("active"));
    e.target.classList.add("active");

    controls.classList.remove("show");
    sortIcon.classList.remove("rotated");


  }
});
// Close popup if clicking outside
// document.addEventListener("click", (e) => {
//   if (!toggleLabel.contains(e.target) && !controls.contains(e.target)) {
//     controls.classList.remove("show");
//     sortIcon.classList.remove("rotated");
//   }
// });

// Toggle dropdown
deleteBtn.addEventListener("click", (e) => {
  closeAllDropdowns();
  deleteDropdown.style.display = deleteDropdown.style.display === "block" ? "none" : "block";
  e.stopPropagation();
});
// Delete all except pinned (Important)
deleteAllBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to delete all tasks? Important/pinned tasks will be kept.")) {
    todos = todos.filter(todo => todo.pinned); // keep pinned (Important) todos
    localStorage.setItem("todos", JSON.stringify(todos));
    todoSaveAndRender();
  }
  deleteDropdown.style.display = "none";
});

// Delete completed except pinned
deleteCompletedBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to delete all completed tasks? Important/pinned tasks will be kept.")) {
    todos = todos.filter(todo => todo.pinned || !todo.done); // keep pinned and incomplete
    localStorage.setItem("todos", JSON.stringify(todos));
    todoSaveAndRender();
  }
  deleteDropdown.style.display = "none";
});

// Close dropdown when clicking outside
// document.addEventListener("click", (e) => {
//   if (!deleteDropdown.contains(e.target) && !deleteBtn.contains(e.target)) {
//     deleteDropdown.style.display = "none";
//   }
// });


filterToggleBtn.addEventListener("click", (e) => {
  // closeAllDropdowns();
  e.stopPropagation(); // prevent bubbling to document
  filterDropdown.classList.toggle("show");
});




document.addEventListener("click", (e) => {
  // --- close all dropdowns by default
  document.querySelectorAll(".todo-menu-dropdown, .todo-priority-dropdown").forEach((menu) => {
    if (!menu.contains(e.target)) {
      menu.style.display = "none";
    }
  });

  // --- close sort controls if clicked outside
  if (typeof toggleLabel !== "undefined" && typeof controls !== "undefined") {
    if (!toggleLabel.contains(e.target) && !controls.contains(e.target)) {
      controls.classList.remove("show");
      sortIcon.classList.remove("rotated");
    }
  }

  // --- close delete dropdown if clicked outside
  if (typeof deleteDropdown !== "undefined" && typeof deleteBtn !== "undefined") {
    if (!deleteDropdown.contains(e.target) && !deleteBtn.contains(e.target)) {
      deleteDropdown.style.display = "none";
    }
  }
  // --- close filter dropdown if clicked outside
  if (typeof filterDropdown !== "undefined" && typeof filterToggleBtn !== "undefined") {
    if (!filterDropdown.contains(e.target) && !filterToggleBtn.contains(e.target)) {
      filterDropdown.classList.remove("show");
    }
  }

});


function closeAllDropdowns() {
  document.querySelectorAll(
    ".todo-menu-dropdown, .todo-priority-dropdown, .todo-delete-dropdown").forEach(menu => {
      menu.style.display = "none";
      menu.classList.remove("show");
    });

  filterDropdown.classList.remove("show");

  const controls = document.querySelector(".todo-sort-controls");
  const sortIcon = document.querySelector(".sort-icon");

  if (controls) controls.classList.remove("show");
  if (sortIcon) sortIcon.classList.remove("rotated");
}


document.querySelectorAll(".todo-filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const selectedFilter = btn.dataset.filter;

    appSettings["todo-filter-mode"] = selectedFilter;
    localStorage.setItem("appSettings", JSON.stringify(appSettings));

    // now this works because mode was declared with let
    filterMode = selectedFilter;

    // applyTodoFilter(mode);
    renderTodos();
    closeFilterPopup();
  });
});

function closeFilterPopup() {
  filterDropdown.classList.remove("show");
}