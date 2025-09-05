const DEFAULT_SETTINGS = {
  "startup-popup": true,
  "weather-widget": true,
  "view-mode": "list",
  "todo-sort-mode": "date-newest",
  "clamp-expanded": true,
  "todo-collapsed": false,
  "todo-filter-mode": "not-archived", 
  "todo-floating-btn": false         
};



if (localStorage.getItem("todoSortMode") !== null) {
  localStorage.removeItem("todoSortMode");
}

if (localStorage.getItem("clampExpanded") !== null) {
  localStorage.removeItem("clampExpanded");
}

// load from localStorage or use defaults
let appSettings = JSON.parse(localStorage.getItem("appSettings")) || { ...DEFAULT_SETTINGS };

// make sure all new defaults are added even if user already has saved settings
appSettings = { ...DEFAULT_SETTINGS, ...appSettings };

// save back in case defaults added something new
localStorage.setItem("appSettings", JSON.stringify(appSettings));

// Select elements
const menuButton = document.querySelector('.menu-button');
const menuButtonMonthView = document.querySelector(".hamburger-month-view");
const menuSlider = document.querySelector('.menu-slider');
const overlayMenu = document.querySelector('.overlay-menu');
const closeButtonMenu = document.querySelector('.close-button-menu');

// Menu button to toggle the menu
menuButton.addEventListener('click', () => {
  menuSlider.classList.toggle('open');
  overlayMenu.classList.add('show');
});

menuButtonMonthView.addEventListener("click", () => {
  menuButton.click();
});

// Close the menu
closeButtonMenu.addEventListener('click', closeMenu);
overlayMenu.addEventListener('click', closeMenu);

function closeMenu() {
  menuSlider.classList.remove('open');
  overlayMenu.classList.remove('show');
}

const todoMenuItem = document.getElementById("to-do");
const todoContainer = document.getElementById("todo-container");
const todoCloseBtn = todoContainer.querySelector(".todo-close-btn");

// Open when clicking menu
todoMenuItem.addEventListener("click", () => {
  todoContainer.classList.add("active");
  renderTodos();
  
const activeButton = document.querySelector(`[data-filter="${filterMode}"]`);
  if (activeButton) {
    activeButton.classList.add("active");

    // Add this line to scroll active button into center on page load
    activeButton.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center'
    });
  }

});

// Close when clicking ×
todoCloseBtn.addEventListener("click", () => {
  todoContainer.classList.remove("active");
});


// ===== Hook Settings Toggles =====
document.getElementById("todo-floating-btn-toggle").addEventListener("change", (e) => {
  const settings = loadSettings();
  settings["todo-floating-btn"] = e.target.checked;
  saveSettings(settings);

  const todoBtn = document.querySelector(".todo-button");
  if (todoBtn) {
    todoBtn.style.display = e.target.checked ? "flex" : "none";
  }
});



const colorThemes = {
  // Default / Gray (neutral)
  default: { even: '#bdbdbd', odd: '#9e9e9e', sunday: '#616161' },

  // Browns / Neutrals
  rustic: { even: '#c8b7a6', odd: '#5c4033', sunday: '#3e2723' },
  mocha: { even: '#a1887f', odd: '#5d4037', sunday: '#432d1f' },
  espresso: { even: '#bfa58a', odd: '#704214', sunday: '#68291cff' },
  cocoa: { even: '#bcaaa4', odd: '#6d4c41', sunday: '#4e342e' },
  almond: { even: '#dac0a3', odd: '#6f4e37', sunday: '#5d4037' },
  tan: { even: '#ccb59d', odd: '#795548', sunday: '#6d4c41' },
  latte: { even: '#e0c3a5', odd: '#8b5e3c', sunday: '#5d4037' },


  // Blues & Indigo
  legacy: { even: '#82c6a2', odd: '#53ab8b', sunday: '#3388cc' }, // your old theme
  indigo: { even: '#7986cb', odd: '#3f51b5', sunday: '#1a237e' },
  blue: { even: '#6a8caf', odd: '#4a6a8a', sunday: '#1a3d5f' },
  slate: { even: '#90a4ae', odd: '#455a64', sunday: '#1F456E' },
  cyan: { even: '#4dd0e1', odd: '#0288d1', sunday: '#01579b' },
  turquoise: { even: '#80deea', odd: '#00bcd4', sunday: '#00838f' },
  teal: { even: '#4db6ac', odd: '#00897b', sunday: '#00695c' },

  // Greens
  fatigue: { even: '#6c7c47', odd: '#3e4d34', sunday: '#2b3d28' },
  green: { even: '#82c6a2', odd: '#53ab8b', sunday: '#4a7c59' },
  mint: { even: '#a5d6a7', odd: '#388e3c', sunday: '#1b5e20' },
  lime: { even: '#dce775', odd: '#8bc34a', sunday: '#558b2f' },
  earthy: { even: '#d7ccc8', odd: '#8d6e63', sunday: '#5c4033' },

  // Reds / Oranges
  red: { even: '#ef9a9a', odd: '#e57373', sunday: '#d32f2f' },
  coral: { even: '#ff8a65', odd: '#d32f2f', sunday: '#bf360c' },
  pink: { even: '#f48fb1', odd: '#f06292', sunday: '#ad1457' },
  orange: { even: '#f5a623', odd: '#d48806', sunday: '#bf360c' },
  peach: { even: '#ffcc80', odd: '#f57c00', sunday: '#e65100' },
  gold: { even: '#ffb74d', odd: '#f57c00', sunday: '#e65100' },
  yellow: { even: '#fff176', odd: '#ffd54f', sunday: '#fbc02d' },

  // Purples / Lavenders
  purple: { even: '#b39ddb', odd: '#9575cd', sunday: '#673ab7' },
  lavender: { even: '#e1bee7', odd: '#ab47bc', sunday: '#6a1b9a' },
};



// Load the selected theme from localStorage or use 'default'
let selectedTheme = localStorage.getItem('theme') || 'default';


const themeItem = document.querySelector('.menu-item.has-submenu[data-setting="theme"]');
const themeSubmenu = themeItem.querySelector('.sub-submenu');
let themeRendered = false;

themeSubmenu.addEventListener("click", (event) => {
  const div = event.target.closest("div[data-theme]");
  if (!div) return;

  const theme = div.dataset.theme;
  console.log("theme selected", theme);

  if (theme && colorThemes[theme]) {
    selectedTheme = theme;
    localStorage.setItem("theme", theme);
    window.location.reload();
  }
});

function renderThemeSubmenu(themeSubmenu) {
  themeSubmenu.innerHTML = "";
  const selectedTheme = localStorage.getItem('theme') || 'default';

  Object.entries(colorThemes).forEach(([key, theme]) => {
    const div = document.createElement("div");
    div.classList.add("color-theme-container");
    div.dataset.theme = key;
    div.innerHTML = `
      <div class="theme-swatch" style="background-color:${theme.sunday}">
        <span class="theme-letter" style="color: white">K</span>
      </div>
    `;

    // Highlight selected theme
    if (key === selectedTheme) {
      div.style.outline = "2px solid white"; // or any thickness you prefer


    }

    themeSubmenu.appendChild(div);
  });
}


// Select all menu items
const menuItems = document.querySelectorAll(".menu-item");

menuItems.forEach(item => {
  item.addEventListener("click", e => {
    e.stopPropagation();

    // Special case: THEME submenu
    if (item.dataset.setting === "theme") {
      if (!themeRendered) {
        renderThemeSubmenu(item.querySelector(".sub-submenu"));
        themeRendered = true;
      }
    }

    // Now toggle submenu normally
    if (item.classList.contains("has-submenu")) {
      const submenu = item.querySelector(".submenu, .sub-submenu");
      const indicator = item.querySelector(".submenu-indicator");
      if (submenu) {
        submenu.classList.toggle("open");
        if (indicator) {
          indicator.classList.toggle("rotated", submenu.classList.contains("open"));
        }
      }
    } else {
      runMenuAction(item);
    }
  });
});


// Example action handler
function runMenuAction(item) {
  // Get useful attributes to decide action
  const section = item.dataset.section;
  const setting = item.dataset.setting;
  const backup = item.dataset.backup;
  const view = item.dataset.view;

  if (section) {
    if (section === "about") {
      alert("All about you...");
      // or call a function to show About content
    } else {
      console.log(`Opening section: ${section}`);
      // runSection(section);
    }
  }

  if (setting) {
    console.log(`Changing setting: ${setting}`);
  }
  if (backup) {
    console.log(`Backup action: ${backup}`);

    if (backup === "download") {
      const backupData = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        backupData[key] = localStorage.getItem(key);
      }

      // Add signature & version
      const wrappedBackup = {
        signature: "SkhayedulerBackup_v1",
        data: backupData
      };

      const dataStr = "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(wrappedBackup));

      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "Skhayeduler_localStorage_backup.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }
    if (backup === "upload") {
      // Trigger hidden file input
      const uploadInput = document.getElementById("uploadBackup");
      if (uploadInput) uploadInput.click();
    }
  }

  if (view) {
    console.log(`Switching view: ${view}`);
    // runView(view);
  }
}


document.getElementById("uploadBackup").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    try {
      const parsed = JSON.parse(event.target.result);

      // Check signature
      if (!parsed.signature || parsed.signature !== "SkhayedulerBackup_v1") {
        throw new Error("Invalid backup signature.");
      }

      const backupData = parsed.data;

      for (const key in backupData) {
        localStorage.setItem(key, backupData[key]);
      }

      alert("Backup restored successfully! Reloading...");
      setTimeout(() => location.reload(), 500);

    } catch (err) {
      alert("Invalid backup file. " + err.message);
    }
  };
  reader.readAsText(file);

  // Reset input
  e.target.value = "";
});

