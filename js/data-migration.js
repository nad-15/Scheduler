/**
 * ==========================================================================
 * Skhayeduler — localStorage Key Reference
 * ==========================================================================
 *
 * All user data is stored in localStorage under the following keys:
 *
 * ┌─────────────────────────┬──────────┬──────────────────────────────────────────────┐
 * │ Key                     │ Type     │ Purpose                                      │
 * ├─────────────────────────┼──────────┼──────────────────────────────────────────────┤
 * │ appSettings             │ Object   │ All user preferences, toggles, theme, etc.   │
 * │ tasks                   │ Object   │ Scheduled tasks keyed by date (YYYY-M-D)     │
 * │ todos                   │ Array    │ To-do items with text, status, subtasks       │
 * │ taskClipboard           │ Array    │ Saved task templates (text, color, favorite)  │
 * │ scheduler_weather_state │ Object   │ Weather location + recent searches            │
 * │ pwa-installed           │ String   │ PWA install state flag ("true")               │
 * └─────────────────────────┴──────────┴──────────────────────────────────────────────┘
 *
 * appSettings contains (see DEFAULT_SETTINGS in hamburger.js):
 *   - theme, hide-all-buttons, view-mode, color-mode, color-shade-name
 *   - startup-popup, weather-widget, todo-sort-mode, todo-filter-mode
 *   - clamp-expanded, todo-collapsed, todo-floating-btn
 *   - sliding-templates, sliding-templates-peek, movable-template-expanded
 *   - dynamic-input-bar, add-task-modal, catrunner-highscore, recent-emojis
 *
 * Deprecated / auto-cleaned standalone keys (migrated into appSettings):
 *   - theme            → appSettings.theme
 *   - hideAllButtons   → appSettings["hide-all-buttons"]
 *   - todoSortMode     → appSettings["todo-sort-mode"]
 *   - clampExpanded    → appSettings["clamp-expanded"]
 *   - movableTemplateExpanded → appSettings["movable-template-expanded"]
 *   - banner-mode      → removed (no longer used)
 *   - lockState-*      → removed (no longer used)
 *   - scheduler_weather_location → migrated into scheduler_weather_state
 */
