/**
 * ==========================================================================
 * Skhayeduler Application Bootstrap & Lifecycle Initialization
 * ==========================================================================
 * Centralizes UI settings binding and startup feature orchestration.
 * Completely eliminates simulated .click() hacks on popups and ensures a
 * clean, race-condition-free startup across all views.
 * ==========================================================================
 */

(function () {
  'use strict';

  /**
   * Load and merge settings with defaults from localStorage
   */
  function loadSettings() {
    const saved = localStorage.getItem("appSettings");
    let settings = saved ? JSON.parse(saved) : {};
    const defaults = window.DEFAULT_SETTINGS || {};
    settings = { ...defaults, ...settings };
    localStorage.setItem("appSettings", JSON.stringify(settings));
    window.appSettings = settings;
    return settings;
  }

  /**
   * Persist updated settings to localStorage and window.appSettings
   */
  function saveSettings(settings) {
    localStorage.setItem("appSettings", JSON.stringify(settings));
    window.appSettings = settings;
  }

  /**
   * Bind event listeners to settings switches and radio options in the menu drawer.
   */
  function initSettingsUI() {
    const settings = loadSettings();

    // Handle checkboxes (toggles)
    document.querySelectorAll(".menu-item input[type='checkbox']").forEach((input) => {
      const settingName = input.id.replace("-toggle", "");
      input.checked = settings[settingName] ?? false;

      input.addEventListener("change", () => {
        settings[settingName] = input.checked;
        if (typeof saveSettings === 'function') {
          saveSettings(settings);
        } else {
          localStorage.setItem("appSettings", JSON.stringify(settings));
        }
        if (typeof appSettings !== "undefined") {
          appSettings[settingName] = input.checked;
        }
      });

      const parentMenuItem = input.closest(".menu-item");
      if (parentMenuItem) {
        parentMenuItem.addEventListener("click", (e) => {
          if (e.target !== input && !e.target.closest(".switch")) {
            input.checked = !input.checked;
            input.dispatchEvent(new Event("change"));
          }
        });
      }
    });

    // Handle radio buttons (view selection, add task modal selection, etc.)
    document.querySelectorAll(".menu-item input[type='radio']").forEach((input) => {
      const settingName = input.name;

      // Restore saved selection
      input.checked = settings[settingName] === input.value;

      input.addEventListener("change", () => {
        if (input.checked) {
          settings[settingName] = input.value;
          if (typeof saveSettings === 'function') {
            saveSettings(settings);
          } else {
            localStorage.setItem("appSettings", JSON.stringify(settings));
          }
          if (typeof appSettings !== "undefined") {
            appSettings[settingName] = input.value;
          }
        }
      });

      const parentMenuItem = input.closest(".menu-item");
      if (parentMenuItem) {
        parentMenuItem.addEventListener("click", (e) => {
          if (e.target !== input) {
            input.checked = true;
            input.dispatchEvent(new Event("change"));
          }
        });
      }
    });
  }

  /**
   * Orchestrate application startup features cleanly.
   */
  function runStartupFeatures() {
    const settings = typeof loadSettings === 'function' ? loadSettings() : (window.appSettings || {});

    // 1. Weather Widget Offset & Weather Fetch
    const offset = 8;
    const weatherWidget = document.getElementById("weather-widget");
    if (weatherWidget && !settings["weather-widget"]) {
      const weatherWidgetWidth = weatherWidget.offsetWidth || 170;
      weatherWidget.style.transform = `translateX(${weatherWidgetWidth + offset}px)`;
      const hideWidgetBtn = document.getElementById("hide-widget-btn") || document.querySelector(".hide-widget");
      if (hideWidgetBtn) {
        hideWidgetBtn.classList.add("is-true");
      }
    }

    if (typeof getWeather === 'function') {
      getWeather();
    }

    // 2. Direct Startup View Initialization (No fake .click() hacks!)
    const activeViewMode = settings["view-mode"] || "list";
    const m = (typeof currentMonthValue !== 'undefined' && currentMonthValue !== null)
      ? currentMonthValue
      : (typeof currentMonthVertView !== 'undefined' ? currentMonthVertView : (new Date()).getMonth());
    const y = (typeof currentYearValue !== 'undefined' && currentYearValue !== null)
      ? currentYearValue
      : (typeof currentYearVertView !== 'undefined' ? currentYearVertView : (new Date()).getFullYear());

    if (activeViewMode === "year") {
      if (typeof openYearMap === "function") {
        openYearMap(y, m);
      }
    } else if (activeViewMode === "month") {
      if (typeof showCalVertView === "function") {
        showCalVertView(m, y);
      }
    } else if (activeViewMode === "todo") {
      if (typeof openTodoView === "function") {
        openTodoView();
      } else {
        const todoBtn = document.getElementById("to-do");
        if (todoBtn) todoBtn.click();
      }
    }
    // Note: If activeViewMode === "list", the application starts on List View by default.

    // 3. Today's Overview Popup
    if (settings["startup-popup"]) {
      const _startupToday = (typeof AppTimezone !== 'undefined' && AppTimezone.now)
        ? AppTimezone.now()
        : new Date();
      const _startupKey = `${_startupToday.getFullYear()}-${_startupToday.getMonth()}-${_startupToday.getDate()}`;
      if (typeof showDayTasks === 'function') {
        showDayTasks(_startupKey);
      }
    }

    // 4. Floating Action Button (To-Do FAB)
    const todoBtn = document.querySelector(".todo-button");
    if (todoBtn) {
      todoBtn.style.display = settings["todo-floating-btn"] ? "flex" : "none";
    }
  }

  function init() {
    initSettingsUI();
    runStartupFeatures();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    // If DOM is already ready, run immediately
    init();
  }

  window.loadSettings = loadSettings;
  window.saveSettings = saveSettings;
  window.initSettings = initSettingsUI;
  window.runStartupFeatures = runStartupFeatures;
})();
