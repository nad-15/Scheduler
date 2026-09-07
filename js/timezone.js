/**
 * ==========================================================================
 * Centralized Timezone Manager
 * ==========================================================================
 * Single source of truth for the app's active timezone.
 * 
 * Boot: Reads the user's saved city timezone from localStorage (read-only).
 *       Falls back to America/Toronto (Kitchener) if nothing is saved.
 * 
 * Runtime: Updated by weather.js when the user changes cities.
 *          Dispatches 'timezone-changed' event so components can re-render.
 * ==========================================================================
 */
const AppTimezone = (() => {
    const DEFAULT_TZ = 'America/Toronto';

    function _isValidTimezone(tz) {
        if (!tz || typeof tz !== 'string') return false;
        try {
            Intl.DateTimeFormat(undefined, { timeZone: tz });
            return true;
        } catch (e) {
            return false;
        }
    }

    // Read-only: peek at the existing weather state for the saved timezone
    function _readSavedTimezone() {
        try {
            const raw = localStorage.getItem('scheduler_weather_state');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.location && parsed.location.timezone && _isValidTimezone(parsed.location.timezone)) {
                    return parsed.location.timezone;
                }
            }
        } catch (e) {}
        return DEFAULT_TZ;
    }

    let _tz = _readSavedTimezone();

    return {
        /** Get the current app timezone (IANA string) */
        get() { return _tz; },

        /**
         * Called by weather.js to sync timezone.
         * Dispatches 'timezone-changed' event if the timezone actually changed.
         */
        set(tz) {
            if (tz && typeof tz === 'string' && tz !== _tz && _isValidTimezone(tz)) {
                _tz = tz;
                window.dispatchEvent(new CustomEvent('timezone-changed', { detail: { timezone: _tz } }));
            }
        },

        /** Date object for "now" in the app timezone */
        now() {
            try {
                return new Date(new Date().toLocaleString('en-US', { timeZone: _tz }));
            } catch (e) {
                return new Date(new Date().toLocaleString('en-US', { timeZone: DEFAULT_TZ }));
            }
        },

        /** Timestamp (ms) for "now" in the app timezone — drop-in for getTorontoNow() */
        nowMs() {
            try {
                return new Date(new Date().toLocaleString('en-US', { timeZone: _tz })).getTime();
            } catch (e) {
                return new Date(new Date().toLocaleString('en-US', { timeZone: DEFAULT_TZ })).getTime();
            }
        }
    };
})();
