/**
 * ==========================================================================
 * Weather System (Open-Meteo Worldwide Integration)
 * Features:
 *   - Interactive City Selector (Default: Kitchener, ON) with Free Geocoding
 *   - Strict City Timezone Locking (Zero Local Device Time Leakage)
 *   - 1-Hour Granular Timeline (24 hours per day)
 *   - 7-Day Planning Horizon
 *   - Native Sunrise / Sunset Directly from API
 *   - High/Low Temperature, Precipitation Probability, Volume (mm) & Snow (cm)
 *   - Wind & Gusts, Humidity, UV Index, and Feels Like
 *   - Google Weather Design System & Animated Meteocons SVGs
 *   - Living Translucent Aurora Glassmorphism
 * ==========================================================================
 */

const DEFAULT_LOCATION = {
    name: 'Kitchener',
    admin: 'ON',
    country: 'Canada',
    countryCode: 'CA',
    lat: 43.4516,
    lon: -80.4925,
    timezone: 'America/Toronto'
};

const WEATHER_STORAGE_KEY = 'scheduler_weather_state';
const MAX_RECENT_CITIES = 3;

/**
 * Single unified storage manager for all weather preferences (location + recent searches)
 */
function getWeatherStoredState() {
    try {
        const raw = localStorage.getItem(WEATHER_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') return parsed;
        }
    } catch (e) {
        console.warn('Could not read weather storage state:', e);
    }

    // Smooth migration from legacy standalone location key if present
    try {
        const oldLocationRaw = localStorage.getItem('scheduler_weather_location');
        if (oldLocationRaw) {
            const oldLoc = JSON.parse(oldLocationRaw);
            if (oldLoc && typeof oldLoc.lat === 'number' && typeof oldLoc.lon === 'number') {
                const migrated = { location: oldLoc, recentSearches: [] };
                localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(migrated));
                localStorage.removeItem('scheduler_weather_location');
                return migrated;
            }
        }
    } catch (e) {}

    return { location: { ...DEFAULT_LOCATION }, recentSearches: [] };
}

function saveWeatherStoredState(state) {
    try {
        localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.warn('Could not save weather storage state:', e);
    }
}

function getSavedLocation() {
    const state = getWeatherStoredState();
    if (state.location && typeof state.location.lat === 'number' && typeof state.location.lon === 'number' && state.location.timezone) {
        return state.location;
    }
    return { ...DEFAULT_LOCATION };
}

function getRecentCities() {
    const state = getWeatherStoredState();
    return Array.isArray(state.recentSearches) ? state.recentSearches.slice(0, MAX_RECENT_CITIES) : [];
}

function saveRecentCity(cityObj) {
    if (!cityObj || !cityObj.name) return;
    const state = getWeatherStoredState();
    let recents = Array.isArray(state.recentSearches) ? state.recentSearches : [];

    // Deduplicate by name/country or proximity
    recents = recents.filter(c => !(
        (Math.abs(c.lat - cityObj.lat) < 0.01 && Math.abs(c.lon - cityObj.lon) < 0.01) ||
        (c.name === cityObj.name && c.country === cityObj.country && c.admin === cityObj.admin)
    ));

    recents.unshift({
        name: cityObj.name,
        admin: cityObj.admin || '',
        country: cityObj.country || '',
        countryCode: cityObj.countryCode || '',
        lat: cityObj.lat,
        lon: cityObj.lon,
        timezone: cityObj.timezone
    });

    state.recentSearches = recents.slice(0, MAX_RECENT_CITIES);
    saveWeatherStoredState(state);
}

function removeRecentCity(indexToRemove) {
    const state = getWeatherStoredState();
    if (Array.isArray(state.recentSearches)) {
        state.recentSearches.splice(indexToRemove, 1);
        saveWeatherStoredState(state);
    }
}

let currentLocation = getSavedLocation();
let isCitySearchOpen = false;
let searchDebounceTimer = null;

let cachedWeatherData = null;
let weatherFetchPromise = null;
let isExpandedPanelInitialized = false;
let selectedDayKey = null;
let timeTickerInterval = null;

/**
 * Robust date key in target city's timezone (YYYY-MM-DD)
 */
function getCityDateKey(date = new Date(), tz = currentLocation.timezone) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    let y = '', m = '', d = '';
    for (const p of parts) {
        if (p.type === 'year') y = p.value;
        if (p.type === 'month') m = p.value;
        if (p.type === 'day') d = p.value;
    }
    return `${y}-${m}-${d}`;
}

/**
 * Robust hour (0-23) in target city's timezone
 */
function getCityHour24(date = new Date(), tz = currentLocation.timezone) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        hour12: false
    }).formatToParts(date);
    const hourPart = parts.find(p => p.type === 'hour');
    let h = hourPart ? parseInt(hourPart.value, 10) : date.getUTCHours() - 4;
    if (h === 24) h = 0;
    return h;
}

/**
 * Formats weekday short name ("Sat", "Sun", etc.) deterministically using UTC noon
 * so calendar dates never shift backwards across international timezones.
 */
function formatWeekday(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' }).format(date);
}

/**
 * Formats full day label ("Sat, Sep 5") deterministically using UTC noon
 */
function formatFullDateLabel(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(date);
}

/**
 * Format ISO datetime string ("2026-09-05T06:50") to 12-hour time ("6:50 AM")
 */
function formatIsoTime(isoStr) {
    if (!isoStr) return '--:--';
    const parts = isoStr.split('T');
    if (parts.length < 2) return isoStr;
    const timeParts = parts[1].split(':');
    let hour = parseInt(timeParts[0], 10);
    const minute = timeParts[1];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${hour}:${minute} ${ampm}`;
}

/**
 * Format ISO datetime string ("2026-09-05T14:00") to 12-hour hour label ("2 PM")
 */
function formatIsoHour(isoStr) {
    if (!isoStr) return '--';
    const parts = isoStr.split('T');
    if (parts.length < 2) return isoStr;
    let hour = parseInt(parts[1].split(':')[0], 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${hour} ${ampm}`;
}

/**
 * Maps WMO Weather Interpretation Codes to human-friendly text and animated Meteocon SVG URLs
 */
function getWmoDetails(code, isDay = true) {
    const c = Number(code);
    let text = 'Clear';
    let icon = isDay ? 'clear-day' : 'clear-night';

    if (c === 0) {
        text = isDay ? 'Sunny' : 'Clear Sky';
        icon = isDay ? 'clear-day' : 'clear-night';
    } else if (c === 1) {
        text = 'Mainly Clear';
        icon = isDay ? 'clear-day' : 'clear-night';
    } else if (c === 2) {
        text = 'Partly Cloudy';
        icon = isDay ? 'partly-cloudy-day' : 'partly-cloudy-night';
    } else if (c === 3) {
        text = 'Overcast';
        icon = isDay ? 'overcast-day' : 'overcast-night';
    } else if (c === 45 || c === 48) {
        text = 'Foggy';
        icon = isDay ? 'fog-day' : 'fog-night';
    } else if (c === 51 || c === 53 || c === 55) {
        text = 'Drizzle';
        icon = 'drizzle';
    } else if (c === 56 || c === 57) {
        text = 'Freezing Drizzle';
        icon = 'sleet';
    } else if (c === 61) {
        text = 'Light Rain';
        icon = 'rain';
    } else if (c === 63) {
        text = 'Rain';
        icon = 'rain';
    } else if (c === 65) {
        text = 'Heavy Rain';
        icon = 'rain';
    } else if (c === 66 || c === 67) {
        text = 'Freezing Rain';
        icon = 'sleet';
    } else if (c === 71) {
        text = 'Light Snow';
        icon = 'snow';
    } else if (c === 73) {
        text = 'Snow';
        icon = 'snow';
    } else if (c === 75 || c === 77) {
        text = 'Heavy Snow';
        icon = 'snow';
    } else if (c === 80 || c === 81) {
        text = 'Rain Showers';
        icon = isDay ? 'partly-cloudy-day-rain' : 'partly-cloudy-night-rain';
    } else if (c === 82) {
        text = 'Violent Showers';
        icon = 'rain';
    } else if (c === 85 || c === 86) {
        text = 'Snow Showers';
        icon = isDay ? 'partly-cloudy-day-snow' : 'partly-cloudy-night-snow';
    } else if (c === 95) {
        text = 'Thunderstorm';
        icon = 'thunderstorms-rain';
    } else if (c === 96 || c === 99) {
        text = 'Severe Thunderstorm';
        icon = 'thunderstorms-rain';
    }

    return {
        code: c,
        text: text,
        icon: icon,
        iconUrl: `./images/weather/${icon}.svg`
    };
}

/**
 * Searches worldwide cities via Open-Meteo free Geocoding API
 * Robust to casing (lowercase, uppercase, Title Case) and compound queries (e.g. "toronto on", "toronto, canada")
 */
async function searchCities(query) {
    if (!query || typeof query !== 'string') return [];
    const rawTrimmed = query.trim();
    if (rawTrimmed.length < 2) return [];

    // Extract potential city name and qualifiers (e.g. "Toronto, ON" or "Toronto Canada")
    const commaParts = rawTrimmed.split(',').map(s => s.trim()).filter(Boolean);
    const primaryCity = commaParts[0] || rawTrimmed;
    const qualifier = commaParts.length > 1 ? commaParts[1].toLowerCase() : '';

    // Also handle space separation (e.g. "Toronto ON" or "Toronto Canada")
    const words = rawTrimmed.split(/\s+/);
    const firstWord = words[0];
    const trailingWords = words.slice(1).join(' ').toLowerCase();

    // Candidate search queries to try in order
    const candidates = [];
    const addCandidate = (c) => {
        if (!c) return;
        const cleaned = c.trim();
        if (cleaned.length >= 2 && !candidates.includes(cleaned)) {
            candidates.push(cleaned);
        }
        // Title Case: e.g. "new york" -> "New York", "paris" -> "Paris"
        const titleCased = cleaned.replace(/\b[a-z]/g, ch => ch.toUpperCase());
        if (titleCased.length >= 2 && !candidates.includes(titleCased)) {
            candidates.push(titleCased);
        }
        // Unaccented ASCII: e.g. "Montréal" -> "Montreal", "São Paulo" -> "Sao Paulo"
        const unaccented = cleaned.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (unaccented.length >= 2 && !candidates.includes(unaccented)) {
            candidates.push(unaccented);
        }
    };

    addCandidate(rawTrimmed);
    addCandidate(primaryCity);

    // Progressive word stripping from end for multi-word cities (e.g. "new york usa" -> "new york")
    if (words.length > 1) {
        for (let i = words.length - 1; i >= 1; i--) {
            addCandidate(words.slice(0, i).join(' '));
        }
    }

    const tryFetch = async (searchName) => {
        try {
            const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchName)}&count=10&language=en&format=json`;
            const res = await fetch(url);
            if (!res.ok) return null;
            const data = await res.json();
            if (data && data.results && Array.isArray(data.results) && data.results.length > 0) {
                return data.results.map(r => ({
                    name: r.name,
                    admin: r.admin1 || '',
                    country: r.country || '',
                    countryCode: r.country_code || '',
                    lat: r.latitude,
                    lon: r.longitude,
                    timezone: r.timezone || 'UTC',
                    population: r.population || 0
                }));
            }
        } catch (e) {
            console.warn(`Geocoding fetch failed for "${searchName}":`, e);
        }
        return null;
    };

    // Try candidates in sequence until we get results
    let results = null;
    let matchedCandidate = null;
    for (const cand of candidates) {
        results = await tryFetch(cand);
        if (results && results.length > 0) {
            matchedCandidate = cand;
            break;
        }
    }

    if (!results || !results.length) return [];

    // Extract any qualifier words that weren't part of the matched candidate (e.g. "usa" or "on" or "japan")
    const lowerRaw = rawTrimmed.toLowerCase();
    const lowerMatched = (matchedCandidate || '').toLowerCase();
    const trailingContext = lowerRaw.replace(lowerMatched, '').replace(/[,]/g, ' ').trim();

    results.sort((a, b) => {
        if (trailingContext) {
            const aAdmin = (a.admin || '').toLowerCase();
            const aCountry = (a.country || '').toLowerCase();
            const aCode = (a.countryCode || '').toLowerCase();

            const bAdmin = (b.admin || '').toLowerCase();
            const bCountry = (b.country || '').toLowerCase();
            const bCode = (b.countryCode || '').toLowerCase();

            const aMatch = aAdmin.includes(trailingContext) || aCountry.includes(trailingContext) || aCode === trailingContext;
            const bMatch = bAdmin.includes(trailingContext) || bCountry.includes(trailingContext) || bCode === trailingContext;

            if (aMatch && !bMatch) return -1;
            if (!aMatch && bMatch) return 1;
        }
        return (b.population || 0) - (a.population || 0);
    });

    return results.slice(0, 6);
}

/**
 * Switches current location, updates persistence, and re-renders entire weather system
 */
async function selectLocation(newLoc) {
    currentLocation = { ...newLoc };
    const state = getWeatherStoredState();
    state.location = { ...currentLocation };
    saveWeatherStoredState(state);

    if (newLoc && !(newLoc.name === DEFAULT_LOCATION.name && Math.abs(newLoc.lat - DEFAULT_LOCATION.lat) < 0.01)) {
        saveRecentCity(newLoc);
    }

    cachedWeatherData = null;
    isCitySearchOpen = false;
    selectedDayKey = null;

    // Refresh weather & update all UI
    await getWeather();
    const panel = document.getElementById('weather-expanded-panel');
    if (panel && panel.classList.contains('active')) {
        renderExpandedForecast();
    }
}

/**
 * Fetches comprehensive forecast data from Open-Meteo for currentLocation
 */
async function fetchWeatherData(forceRefresh = false) {
    const { lat, lon, timezone } = currentLocation;
    const cacheKey = `${lat},${lon}`;
    if (!forceRefresh && cachedWeatherData && cachedWeatherData._locationKey === cacheKey && cachedWeatherData._fetchedAt && (Date.now() - cachedWeatherData._fetchedAt < 10 * 60 * 1000)) {
        return cachedWeatherData;
    }
    if (weatherFetchPromise) return weatherFetchPromise;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,uv_index` +
        `&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day,uv_index` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,daylight_duration,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,snowfall_sum` +
        `&timezone=${encodeURIComponent(timezone)}&forecast_days=7`;

    weatherFetchPromise = (async () => {
        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data && data.current && data.hourly && data.daily) {
                data._fetchedAt = Date.now();
                data._locationKey = cacheKey;
                cachedWeatherData = data;

                // Re-render expanded panel if open
                const panel = document.getElementById('weather-expanded-panel');
                if (panel && panel.classList.contains('active')) {
                    renderExpandedForecast();
                }
                return data;
            }
        } catch (err) {
            console.warn('Unable to load Open-Meteo weather data:', err);
        } finally {
            weatherFetchPromise = null;
        }
        return cachedWeatherData;
    })();

    return weatherFetchPromise;
}

/**
 * Primary startup function called by daily-task-pop-up.js
 */
async function getWeather() {
    try {
        const todayName = document.getElementById('today-name');
        if (todayName && !todayName.querySelector('.time-container') && !todayName.querySelector('.today-loading-state')) {
            todayName.innerHTML = `
                <div class="today-loading-state">
                    <div class="today-spinner"></div>
                    <span class="today-loading-text">Loading weather...</span>
                </div>
            `;
        }

        const data = await fetchWeatherData();
        if (!data || !data.current) throw new Error('No weather data received');

        initWeatherExpandedPanel();

        const current = data.current;
        const tempVal = Math.round(current.temperature_2m);
        const wmo = getWmoDetails(current.weather_code, Boolean(current.is_day));
        const weatherDescription = `${wmo.text}.`;
        const iconUrl = wmo.iconUrl;

        const locationLabel = `${currentLocation.name}, ${currentLocation.admin || currentLocation.countryCode || currentLocation.country}`;

        if (todayName) {
            // Render structure once if not already rendered
            if (!todayName.querySelector('.time-container')) {
                todayName.innerHTML = `
                    <div class="time-container">
                        <div id="today-location">${locationLabel}</div>
                        <div id="today-date"></div>
                        <div id="today-time">
                            <span id="today-hour-minute"></span>
                        </div>
                        <span id="today-seconds"></span>
                    </div>

                    <div class="weather-container">
                        <div id="today-icon">
                             <img src="${iconUrl}" alt="weather icon" onerror="this.onerror=null; this.src='./images/weather/umbrella.svg';">
                        </div>
                        <div id="today-temp">${tempVal}°</div>
                        <div id="today-weather">${weatherDescription}</div>
                    </div>
                `;
            } else {
                const locEl = todayName.querySelector('#today-location');
                if (locEl) locEl.textContent = locationLabel;
                const tempEl = todayName.querySelector('#today-temp');
                if (tempEl) tempEl.textContent = `${tempVal}°`;
                const weatherEl = todayName.querySelector('#today-weather');
                if (weatherEl) weatherEl.textContent = weatherDescription;
                const iconImg = todayName.querySelector('#today-icon img');
                if (iconImg && iconImg.getAttribute('src') !== iconUrl) {
                    iconImg.src = iconUrl;
                }
            }

            const dateEl = todayName.querySelector('#today-date');
            const hourMinuteEl = todayName.querySelector('#today-hour-minute');
            const secondsEl = todayName.querySelector('#today-seconds');

            function updateTime() {
                const now = new Date();
                const options = { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric', 
                    hour: 'numeric', 
                    minute: '2-digit', 
                    second: '2-digit', 
                    hour12: true,  
                    timeZone: currentLocation.timezone 
                };

                const formatter = new Intl.DateTimeFormat('en-US', options);
                const parts = formatter.formatToParts(now);

                let monthDay = "", year = "", hour = "", minute = "", second = "", ampm = "";

                parts.forEach(({ type, value }) => {
                    if (type === "month") monthDay += value + " ";
                    if (type === "day") monthDay += value;
                    if (type === "year") year = value;
                    if (type === "hour") hour = value;
                    if (type === "minute") minute = value;
                    if (type === "second") second = value;
                    if (type === "dayPeriod") ampm = value.toUpperCase();
                });

                if (dateEl) dateEl.textContent = `${monthDay}, ${year}`;
                if (hourMinuteEl) hourMinuteEl.textContent = `${hour}:${minute}`;
                if (secondsEl) secondsEl.textContent = `:${second} ${ampm}`;
            }

            updateTime();
            if (timeTickerInterval) clearInterval(timeTickerInterval);
            timeTickerInterval = setInterval(updateTime, 1000);
        }

        // Render Companion Forecast Bar
        renderWeatherOutlook(data);

    } catch (error) {
        console.error('Error fetching weather data:', error);
        const todayName = document.getElementById('today-name');
        if (todayName) {
            todayName.innerHTML = `
                <div class="time-container">
                    <div id="today-location">${currentLocation.name}</div>
                    <div id="today-date">--, ----</div>
                    <div id="today-time">
                        <span id="today-hour-minute">--:--</span>
                    </div>
                    <span id="today-seconds">:-- --</span>
                </div>

                <div class="weather-container">
                    <div id="today-icon">
                        <img src="./images/weather/umbrella.svg" alt="icon">
                    </div>
                    <div id="today-temp">--°</div>
                    <div id="today-weather">Weather unavailable</div>
                </div>
            `;
        }
    }
}

/**
 * Companion Forecast Outlook Bar (Under #today-name)
 */
function renderWeatherOutlook(data) {
    const outlookBar = document.getElementById('weather-outlook-bar');
    if (!outlookBar || !data || !data.daily || !data.hourly) return;

    const isDismissed = sessionStorage.getItem('weather-outlook-dismissed') === 'true';
    if (isDismissed) {
        outlookBar.style.display = 'none';
        return;
    }

    const todayDateKey = getCityDateKey(new Date(), currentLocation.timezone);
    const todayIndex = data.daily.time.indexOf(todayDateKey);
    const highTemp = todayIndex >= 0 ? Math.round(data.daily.temperature_2m_max[todayIndex]) : Math.round(data.current.temperature_2m);
    const lowTemp = todayIndex >= 0 ? Math.round(data.daily.temperature_2m_min[todayIndex]) : Math.round(data.current.temperature_2m);

    // Look ahead at next 18 hours of 1-hour slots in city's local time
    const now = new Date();
    const cityHour = getCityHour24(now, currentLocation.timezone);
    const nowIsoHour = `${todayDateKey}T${String(cityHour).padStart(2, '0')}:00`;
    let startIndex = data.hourly.time.findIndex(t => t >= nowIsoHour);
    if (startIndex === -1) startIndex = 0;
    const upcomingHourlyIndices = [];
    for (let i = startIndex; i < Math.min(startIndex + 18, data.hourly.time.length); i++) {
        upcomingHourlyIndices.push(i);
    }

    const isCurrentDaytime = Boolean(data.current.is_day);

    let alertType = '';
    let alertIconUrl = '';
    let alertText = '';
    let isPulse = false;

    outlookBar.classList.remove('has-rain', 'has-snow', 'has-freeze', 'has-wind', 'has-fog');

    for (const idx of upcomingHourlyIndices) {
        const code = data.hourly.weather_code[idx];
        const pop = data.hourly.precipitation_probability[idx] || 0;
        const precip = data.hourly.precipitation[idx] || 0;
        const timeLabel = formatIsoHour(data.hourly.time[idx]);

        // Snow detection
        if ([71, 73, 75, 77, 85, 86].includes(code)) {
            alertType = 'snow';
            alertIconUrl = './images/weather/snow.svg';
            alertText = `Snow at ${timeLabel} (${pop}%)`;
            isPulse = true;
            outlookBar.classList.add('has-snow');
            break;
        }
        // Thunderstorm
        if ([95, 96, 99].includes(code)) {
            alertType = 'storm';
            alertIconUrl = './images/weather/thunderstorms-rain.svg';
            alertText = `Storm at ${timeLabel} (${pop}%)`;
            isPulse = true;
            outlookBar.classList.add('has-rain');
            break;
        }
        // Rain / Showers / Drizzle
        if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code) || pop >= 30 || precip >= 0.2) {
            alertType = 'rain';
            alertIconUrl = './images/weather/rain.svg';
            alertText = `Rain at ${timeLabel} (${pop}%)`;
            isPulse = true;
            outlookBar.classList.add('has-rain');
            break;
        }
    }

    // Freeze / Frost Alert
    if (!alertType && (lowTemp <= -15 || (lowTemp <= 0 && highTemp > 3))) {
        alertType = 'freeze';
        alertIconUrl = './images/weather/sleet.svg';
        alertText = lowTemp <= -15 ? `Extreme cold: Low ${lowTemp}°` : (lowTemp < 0 ? `Freeze alert: Low ${lowTemp}°` : `Frost alert: Low 0°`);
        outlookBar.classList.add('has-freeze');
    }

    // High Wind / Gusts (>= 38 km/h)
    if (!alertType) {
        let maxGust = 0;
        for (const idx of upcomingHourlyIndices) {
            const g = data.hourly.wind_gusts_10m[idx] || 0;
            if (g > maxGust) maxGust = g;
        }
        if (maxGust >= 38) {
            alertType = 'wind';
            alertIconUrl = './images/weather/wind.svg';
            alertText = `Gusts up to ${Math.round(maxGust)} km/h`;
            outlookBar.classList.add('has-wind');
        }
    }

    // Fog / Low Visibility
    if (!alertType) {
        for (const idx of upcomingHourlyIndices) {
            if ([45, 48].includes(data.hourly.weather_code[idx])) {
                alertType = 'fog';
                alertIconUrl = `./images/weather/${isCurrentDaytime ? 'fog-day' : 'fog-night'}.svg`;
                alertText = `Fog / low visibility`;
                outlookBar.classList.add('has-fog');
                break;
            }
        }
    }

    // Default: Clear / Dry Conditions
    if (!alertType) {
        alertType = 'clear';
        alertIconUrl = `./images/weather/${isCurrentDaytime ? 'clear-day' : 'clear-night'}.svg`;
        const isColdSeason = highTemp <= 3;
        alertText = isColdSeason ? `No snow expected` : `No rain expected`;
    }

    // Contextual Sub-Info (Golden Hours Model)
    const cityMin = parseInt(new Intl.DateTimeFormat('en-US', {
        timeZone: currentLocation.timezone,
        minute: 'numeric'
    }).format(now), 10);
    const decHour = cityHour + (cityMin / 60);

    const sunriseStr = todayIndex >= 0 ? `Sunrise ${formatIsoTime(data.daily.sunrise[todayIndex])}` : '';
    const sunsetStr = todayIndex >= 0 ? `Sunset ${formatIsoTime(data.daily.sunset[todayIndex])}` : '';
    const feelsLikeVal = Math.round(data.current.apparent_temperature);

    let extraHtml = '';
    if (decHour >= 4.0 && decHour < 9.0) {
        extraHtml = sunriseStr || `Feels ${feelsLikeVal}°`;
    } else if (decHour >= 16.5 && decHour < 21.0) {
        extraHtml = sunsetStr || `Feels ${feelsLikeVal}°`;
    } else {
        extraHtml = `Feels ${feelsLikeVal}°`;
    }

    outlookBar.innerHTML = `
        <div class="outlook-header">
            <div class="outlook-main-info">
                <span class="outlook-icon ${isPulse ? 'pulse' : ''}">
                    <img class="outlook-meteo-icon" src="${alertIconUrl}" alt="${alertType}" onerror="this.onerror=null; this.src='./images/weather/umbrella.svg';">
                </span>
                <span class="outlook-status">${alertText}</span>
            </div>
            <button id="close-weather-outlook" class="outlook-close-btn" title="Dismiss forecast" aria-label="Close forecast">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
        <div class="outlook-sub-info">
            <span class="outlook-temps">H: ${highTemp}° L: ${lowTemp}°</span>
            <span class="outlook-extra">${extraHtml}</span>
        </div>
    `;

    outlookBar.style.display = 'flex';

    // Position dynamically directly below #today-name and lock exact width matching
    const alignPosition = () => {
        const todayName = document.getElementById('today-name');
        if (todayName && outlookBar) {
            const rect = todayName.getBoundingClientRect();
            if (rect.height > 0) outlookBar.style.top = `${rect.bottom + 6}px`;
            if (rect.width > 0) {
                outlookBar.style.width = `${rect.width}px`;
                outlookBar.style.minWidth = `${rect.width}px`;
                outlookBar.style.maxWidth = `${rect.width}px`;
            }
        }
    };

    alignPosition();
    window.addEventListener('resize', alignPosition);
    setTimeout(alignPosition, 50);
    setTimeout(alignPosition, 150);
    setTimeout(alignPosition, 600);

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(alignPosition);
    }

    const todayNameEl = document.getElementById('today-name');
    if (window.ResizeObserver && todayNameEl) {
        const ro = new ResizeObserver(() => {
            alignPosition();
        });
        ro.observe(todayNameEl);
    }

    // Dismiss action
    const closeBtn = document.getElementById('close-weather-outlook');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            outlookBar.classList.add('dismissed');
            sessionStorage.setItem('weather-outlook-dismissed', 'true');
            setTimeout(() => {
                outlookBar.style.display = 'none';
            }, 350);
        });
    }

    // Clicking outlook bar opens expanded dashboard
    outlookBar.addEventListener('click', (e) => {
        if (e.target.closest('#close-weather-outlook')) return;
        openWeatherExpandedPanel();
    });

    // Sync visibility with #today-name sliding state
    const todayName = document.getElementById('today-name');
    const hideWidgetBtn = document.getElementById('hide-widget-btn') || document.querySelector('.hide-widget');

    const syncVisibility = () => {
        if (!todayName || outlookBar.classList.contains('dismissed')) return;
        const isSlideHidden = todayName.style.transform &&
            todayName.style.transform !== 'translateX(0px)' &&
            todayName.style.transform !== 'translateX(0)';
        const isDisplayNone = todayName.style.display === 'none' || getComputedStyle(todayName).display === 'none';

        if (isDisplayNone) {
            outlookBar.style.display = 'none';
        } else if (isSlideHidden) {
            const barWidth = outlookBar.offsetWidth || 220;
            outlookBar.style.transform = `translateX(${barWidth + 24}px)`;
            outlookBar.style.opacity = '0';
            outlookBar.style.pointerEvents = 'none';
        } else {
            outlookBar.style.display = 'flex';
            outlookBar.style.transform = 'translateX(0)';
            outlookBar.style.opacity = '1';
            outlookBar.style.pointerEvents = 'auto';
            alignPosition();
        }
    };

    setTimeout(syncVisibility, 50);
    setTimeout(syncVisibility, 250);

    if (hideWidgetBtn) {
        hideWidgetBtn.addEventListener('click', () => setTimeout(syncVisibility, 20));
    }
    const hideAllBtn = document.querySelector('.hide-all-buttons');
    if (hideAllBtn) {
        hideAllBtn.addEventListener('click', () => setTimeout(syncVisibility, 20));
    }
}

/**
 * ==========================================================================
 * Expanded Weather Dashboard (Google Weather Flyout Modal)
 * ==========================================================================
 */
function initWeatherExpandedPanel() {
    if (isExpandedPanelInitialized) return;
    isExpandedPanelInitialized = true;

    const backdrop = document.getElementById('weather-expanded-backdrop');
    if (backdrop) {
        backdrop.addEventListener('click', closeWeatherExpandedPanel);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeWeatherExpandedPanel();
    });

    // Make #today-name also open the expanded dashboard on click
    const todayName = document.getElementById('today-name');
    if (todayName) {
        todayName.addEventListener('click', (e) => {
            if (e.target.closest('.hide-widget') || e.target.closest('#hide-widget-btn')) return;
            openWeatherExpandedPanel();
        });
    }

    window.openWeatherExpandedPanel = openWeatherExpandedPanel;
    window.closeWeatherExpandedPanel = closeWeatherExpandedPanel;
    window.toggleWeatherExpandedPanel = toggleWeatherExpandedPanel;
}

function openWeatherExpandedPanel() {
    const panel = document.getElementById('weather-expanded-panel');
    const backdrop = document.getElementById('weather-expanded-backdrop');
    if (!panel || !backdrop) return;

    selectedDayKey = getCityDateKey(new Date(), currentLocation.timezone);

    initWeatherExpandedPanel();
    renderExpandedForecast();

    if (!cachedWeatherData) {
        fetchWeatherData().then(() => renderExpandedForecast());
    }

    backdrop.style.display = 'block';
    panel.style.display = 'flex';

    requestAnimationFrame(() => {
        backdrop.classList.add('active');
        panel.classList.add('active');
    });
}

function closeWeatherExpandedPanel() {
    const panel = document.getElementById('weather-expanded-panel');
    const backdrop = document.getElementById('weather-expanded-backdrop');
    if (!panel || !backdrop) return;

    backdrop.classList.remove('active');
    panel.classList.remove('active');

    setTimeout(() => {
        backdrop.style.display = 'none';
        panel.style.display = 'none';
        isCitySearchOpen = false; // Reset search open state on close
    }, 260);
}

function toggleWeatherExpandedPanel() {
    const panel = document.getElementById('weather-expanded-panel');
    if (panel && panel.classList.contains('active')) {
        closeWeatherExpandedPanel();
    } else {
        openWeatherExpandedPanel();
    }
}

window.openWeatherExpandedPanel = openWeatherExpandedPanel;
window.closeWeatherExpandedPanel = closeWeatherExpandedPanel;
window.toggleWeatherExpandedPanel = toggleWeatherExpandedPanel;

/**
 * Renders the full expanded weather dashboard
 */
function renderExpandedForecast() {
    const panel = document.getElementById('weather-expanded-panel');
    if (!panel) return;

    const data = cachedWeatherData;
    const locationTitle = `${currentLocation.name}, ${currentLocation.admin || currentLocation.countryCode || currentLocation.country}`;

    if (!data || !data.daily || !data.hourly) {
        panel.innerHTML = `
            <div class="expanded-header-row">
                <div class="expanded-location-box">
                    <div class="expanded-city-selector" id="expanded-city-selector-btn">
                        <span class="expanded-city-name">${locationTitle}</span>
                        <span class="material-symbols-outlined expanded-city-arrow">expand_more</span>
                    </div>
                    <span class="expanded-day-badge">7-Day Forecast</span>
                </div>
                <div class="expanded-controls-box">
                    <button class="expanded-panel-close" id="expanded-panel-close-btn" title="Close" aria-label="Close dashboard">✕</button>
                </div>
            </div>
            <div class="gw-main-card">
                <div class="expanded-loading-state">
                    <div class="expanded-spinner"></div>
                    <span>Loading forecast details for ${currentLocation.name}...</span>
                </div>
            </div>
        `;
        const closeBtn = panel.querySelector('#expanded-panel-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', closeWeatherExpandedPanel);
        return;
    }

    const todayDateKey = getCityDateKey(new Date(), currentLocation.timezone);
    if (!selectedDayKey || !data.daily.time.includes(selectedDayKey)) {
        selectedDayKey = todayDateKey;
    }

    const activeIndex = data.daily.time.indexOf(selectedDayKey);
    const isTodayActive = selectedDayKey === todayDateKey;

    // 1. Build Daily Selector Cards (7 Days)
    const dailyCardsHtml = data.daily.time.map((dateStr, i) => {
        const isSelected = dateStr === selectedDayKey;
        const isCurrentDay = dateStr === todayDateKey;
        const dayShortName = isCurrentDay ? 'Today' : formatWeekday(dateStr);
        const wmo = getWmoDetails(data.daily.weather_code[i], true);
        const maxT = Math.round(data.daily.temperature_2m_max[i]);
        const minT = Math.round(data.daily.temperature_2m_min[i]);

        return `
            <div class="gw-daily-card ${isSelected ? 'active' : ''}" data-day-key="${dateStr}">
                <span class="gw-daily-name">${dayShortName}</span>
                <img class="gw-daily-icon" src="${wmo.iconUrl}" alt="icon" onerror="this.onerror=null; this.src='./images/weather/umbrella.svg';">
                <span class="gw-daily-range">${maxT}°/${minT}°</span>
            </div>
        `;
    }).join('');

    // 2. Active Day Overview Details
    const activeDayLabel = isTodayActive ? 'Now' : formatFullDateLabel(selectedDayKey);

    const activeHigh = Math.round(data.daily.temperature_2m_max[activeIndex]);
    const activeLow = Math.round(data.daily.temperature_2m_min[activeIndex]);
    const activeCode = isTodayActive ? data.current.weather_code : data.daily.weather_code[activeIndex];
    const activeIsDay = isTodayActive ? Boolean(data.current.is_day) : true;
    const activeWmo = getWmoDetails(activeCode, activeIsDay);

    const heroTemp = isTodayActive ? `${Math.round(data.current.temperature_2m)}°` : `${activeHigh}°`;
    const heroCondition = activeWmo.text;
    const heroMeteoUrl = activeWmo.iconUrl;

    // 3. Hourly Slots for Selected Day (24 individual 1-Hour increments)
    const dayIndices = [];
    data.hourly.time.forEach((t, idx) => {
        if (t.startsWith(selectedDayKey)) {
            dayIndices.push(idx);
        }
    });

    let alertBannerHtml = '';
    for (const idx of dayIndices) {
        const code = data.hourly.weather_code[idx];
        const pop = data.hourly.precipitation_probability[idx] || 0;
        const precip = data.hourly.precipitation[idx] || 0;
        const timeLabel = formatIsoHour(data.hourly.time[idx]);

        if ([71, 73, 75, 77, 85, 86].includes(code)) {
            alertBannerHtml = `
                <div class="gw-alert-pill is-snow is-alert">
                    <div class="gw-alert-icon-box">
                        <img class="gw-alert-meteo-icon" src="./images/weather/snow.svg" alt="Snow" onerror="this.style.display='none'">
                    </div>
                    <div class="gw-alert-text-group">
                        <div class="gw-alert-title"><span class="gw-alert-dot-pulse"></span>Snow Expected</div>
                        <div class="gw-alert-desc">At ${timeLabel} (${pop}% chance)</div>
                    </div>
                </div>
            `;
            break;
        } else if ([95, 96, 99].includes(code)) {
            alertBannerHtml = `
                <div class="gw-alert-pill is-storm is-alert">
                    <div class="gw-alert-icon-box">
                        <img class="gw-alert-meteo-icon" src="./images/weather/thunderstorms-rain.svg" alt="Storm" onerror="this.style.display='none'">
                    </div>
                    <div class="gw-alert-text-group">
                        <div class="gw-alert-title"><span class="gw-alert-dot-pulse"></span>Storm Alert</div>
                        <div class="gw-alert-desc">At ${timeLabel} (${pop}% chance)</div>
                    </div>
                </div>
            `;
            break;
        } else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code) || pop >= 30 || precip >= 0.2) {
            const vol = precip > 0 ? ` • ~${precip.toFixed(1)} mm` : '';
            alertBannerHtml = `
                <div class="gw-alert-pill is-rain is-alert">
                    <div class="gw-alert-icon-box">
                        <img class="gw-alert-meteo-icon" src="./images/weather/rain.svg" alt="Rain" onerror="this.style.display='none'">
                    </div>
                    <div class="gw-alert-text-group">
                        <div class="gw-alert-title"><span class="gw-alert-dot-pulse"></span>Rain Expected</div>
                        <div class="gw-alert-desc">At ${timeLabel} (${pop}% chance)${vol}</div>
                    </div>
                </div>
            `;
            break;
        }
    }

    if (!alertBannerHtml) {
        const isDayForAlert = isTodayActive ? Boolean(data.current.is_day) : true;
        const clearMeteoIcon = isDayForAlert ? 'clear-day' : 'clear-night';
        const dayNightClass = isDayForAlert ? 'is-day' : 'is-night';

        if (activeLow <= 0 && activeHigh > 3) {
            alertBannerHtml = `
                <div class="gw-alert-pill is-freeze is-alert">
                    <div class="gw-alert-icon-box">
                        <img class="gw-alert-meteo-icon" src="./images/weather/sleet.svg" alt="Frost" onerror="this.style.display='none'">
                    </div>
                    <div class="gw-alert-text-group">
                        <div class="gw-alert-title"><span class="gw-alert-dot-pulse"></span>Frost Warning</div>
                        <div class="gw-alert-desc">Overnight low dropping to ${activeLow}°</div>
                    </div>
                </div>
            `;
        } else if (activeLow <= 3) {
            const dryColdSub = isTodayActive ? 'No snow or precipitation expected' : 'Dry weather expected';
            alertBannerHtml = `
                <div class="gw-alert-pill is-clear ${dayNightClass}">
                    <div class="gw-alert-icon-box">
                        <img class="gw-alert-meteo-icon" src="./images/weather/${clearMeteoIcon}.svg" alt="Dry" onerror="this.style.display='none'">
                    </div>
                    <div class="gw-alert-text-group">
                        <div class="gw-alert-title"><span class="gw-alert-dot-pulse"></span>Dry Conditions</div>
                        <div class="gw-alert-desc">${dryColdSub}</div>
                    </div>
                </div>
            `;
        } else {
            const clearSub = isTodayActive
                ? (isDayForAlert ? 'No rain expected through tonight' : 'No rain expected overnight')
                : 'No rain expected for this day';
            alertBannerHtml = `
                <div class="gw-alert-pill is-clear ${dayNightClass}">
                    <div class="gw-alert-icon-box">
                        <img class="gw-alert-meteo-icon" src="./images/weather/${clearMeteoIcon}.svg" alt="Clear" onerror="this.style.display='none'">
                    </div>
                    <div class="gw-alert-text-group">
                        <div class="gw-alert-title"><span class="gw-alert-dot-pulse"></span>Dry & Clear</div>
                        <div class="gw-alert-desc">${clearSub}</div>
                    </div>
                </div>
            `;
        }
    }

    // 4. Hourly Forecast Strip (True 1-Hour Step in City's Local Time)
    let hourlyColumnsHtml = '';
    const now = new Date();
    const cityHour24 = getCityHour24(now, currentLocation.timezone);

    if (isTodayActive) {
        // First column is live Now
        const liveTemp = Math.round(data.current.temperature_2m);
        const liveWmo = getWmoDetails(data.current.weather_code, Boolean(data.current.is_day));
        const livePrecip = data.current.precipitation || 0;
        const isRainingNow = livePrecip > 0 || [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(data.current.weather_code);

        hourlyColumnsHtml += `
            <div class="gw-hourly-col is-now">
                <span class="gw-hourly-temp">${liveTemp}°</span>
                <span class="gw-hourly-pop ${isRainingNow ? '' : 'is-empty'}">${isRainingNow ? 'Now' : '&nbsp;'}</span>
                <img class="gw-hourly-icon" src="${liveWmo.iconUrl}" alt="icon" onerror="this.onerror=null; this.src='./images/weather/umbrella.svg';">
                <span class="gw-hourly-time">Now</span>
            </div>
        `;

        // Remaining 1-hour slots for today (starting from next city hour)
        dayIndices.forEach(idx => {
            const tStr = data.hourly.time[idx];
            const slotHour = parseInt(tStr.split('T')[1].split(':')[0], 10);
            if (slotHour > cityHour24) {
                const sTemp = Math.round(data.hourly.temperature_2m[idx]);
                const popVal = data.hourly.precipitation_probability[idx] || 0;
                const isDaySlot = Boolean(data.hourly.is_day[idx]);
                const sWmo = getWmoDetails(data.hourly.weather_code[idx], isDaySlot);
                const timeLabel = formatIsoHour(tStr);

                hourlyColumnsHtml += `
                    <div class="gw-hourly-col">
                        <span class="gw-hourly-temp">${sTemp}°</span>
                        <span class="gw-hourly-pop ${popVal >= 20 ? '' : 'is-empty'}">${popVal >= 20 ? `${popVal}%` : '&nbsp;'}</span>
                        <img class="gw-hourly-icon" src="${sWmo.iconUrl}" alt="icon" onerror="this.onerror=null; this.src='./images/weather/umbrella.svg';">
                        <span class="gw-hourly-time">${timeLabel}</span>
                    </div>
                `;
            }
        });
    } else {
        // Future Day: Display all 24 individual hours
        dayIndices.forEach(idx => {
            const tStr = data.hourly.time[idx];
            const sTemp = Math.round(data.hourly.temperature_2m[idx]);
            const popVal = data.hourly.precipitation_probability[idx] || 0;
            const isDaySlot = Boolean(data.hourly.is_day[idx]);
            const sWmo = getWmoDetails(data.hourly.weather_code[idx], isDaySlot);
            const timeLabel = formatIsoHour(tStr);

            hourlyColumnsHtml += `
                <div class="gw-hourly-col">
                    <span class="gw-hourly-temp">${sTemp}°</span>
                    <span class="gw-hourly-pop ${popVal >= 20 ? '' : 'is-empty'}">${popVal >= 20 ? `${popVal}%` : '&nbsp;'}</span>
                    <img class="gw-hourly-icon" src="${sWmo.iconUrl}" alt="icon" onerror="this.onerror=null; this.src='./images/weather/umbrella.svg';">
                    <span class="gw-hourly-time">${timeLabel}</span>
                </div>
            `;
        });
    }

    // 5. Planning Metrics Calculation
    const maxPop = data.daily.precipitation_probability_max[activeIndex] || 0;
    const precipSum = data.daily.precipitation_sum[activeIndex] || 0;
    const snowfallSum = (data.daily.snowfall_sum && data.daily.snowfall_sum[activeIndex]) || 0;
    const windSpeedMax = Math.round(data.daily.wind_speed_10m_max[activeIndex] || 0);
    const windGustMax = Math.round(data.daily.wind_gusts_10m_max[activeIndex] || 0);

    const feelsLikeVal = isTodayActive
        ? Math.round(data.current.apparent_temperature)
        : Math.round(data.daily.apparent_temperature_max[activeIndex]);

    let feelsLikeSub = '';
    if (isTodayActive) {
        const uv = data.current.uv_index !== undefined ? Math.round(data.current.uv_index) : (data.daily.uv_index_max ? Math.round(data.daily.uv_index_max[activeIndex]) : null);
        feelsLikeSub = uv !== null ? `Humidity: ${data.current.relative_humidity_2m}% • UV: ${uv}` : `Humidity: ${data.current.relative_humidity_2m}%`;
    } else {
        const maxUv = data.daily.uv_index_max ? Math.round(data.daily.uv_index_max[activeIndex]) : null;
        feelsLikeSub = maxUv !== null ? `Low: ${Math.round(data.daily.apparent_temperature_min[activeIndex])}° • Max UV: ${maxUv}` : `Low Feels: ${Math.round(data.daily.apparent_temperature_min[activeIndex])}°`;
    }

    const precipSubText = snowfallSum > 0
        ? `Est: ${snowfallSum.toFixed(1)} cm snow`
        : (precipSum > 0 ? `Est: ${precipSum.toFixed(1)} mm` : 'No accumulation');

    const sunriseStr = formatIsoTime(data.daily.sunrise[activeIndex]);
    const sunsetStr = formatIsoTime(data.daily.sunset[activeIndex]);

    // Smart noon swap for Today only (Morning = Sunrise above; Afternoon/Evening = Sunset above)
    const cityHour = getCityHour24(now, currentLocation.timezone);
    const isAfterNoonToday = isTodayActive && cityHour >= 12;
    const dawnDuskPrimary = isAfterNoonToday ? `Set ${sunsetStr}` : `Rise ${sunriseStr}`;
    const dawnDuskSecondary = isAfterNoonToday ? `Rise ${sunriseStr}` : `Set ${sunsetStr}`;

    // Render Completed Panel
    panel.innerHTML = `
        <div class="expanded-header-row">
            <div class="expanded-location-box">
                <div class="expanded-city-selector ${isCitySearchOpen ? 'is-open' : ''}" id="expanded-city-selector-btn" title="Click to search & change city">
                    <span class="expanded-city-name">${locationTitle}</span>
                    <span class="material-symbols-outlined expanded-city-arrow">expand_more</span>
                </div>
                <span class="expanded-day-badge">7-Day Forecast</span>
            </div>
            <div class="expanded-controls-box">
                <button class="expanded-panel-close" id="expanded-panel-close-btn" title="Close" aria-label="Close dashboard">✕</button>
            </div>
        </div>

        ${isCitySearchOpen ? `
            <div class="expanded-search-container" id="expanded-search-container">
                <div class="expanded-search-input-row">
                    <span class="material-symbols-outlined expanded-search-icon">search</span>
                    <input type="text" class="expanded-search-input" id="expanded-city-search-input" placeholder="Search any city in the world..." autocomplete="off">
                </div>
                <div class="expanded-search-results" id="expanded-search-results" style="display: none;"></div>
                <button class="expanded-search-reset-btn" id="expanded-search-reset-btn">
                    <span class="material-symbols-outlined" style="font-size: 13px !important;">restart_alt</span>
                    Reset to Kitchener, ON (Default)
                </button>
            </div>
        ` : ''}

        <!-- Hero Overview Card -->
        <div class="gw-main-card">
            <div class="gw-hero-header">
                <div class="gw-hero-left">
                    <span class="gw-hero-day">${activeDayLabel}</span>
                    <div class="gw-hero-temp-row">
                        <span class="gw-hero-temp">${heroTemp}</span>
                        <img class="gw-hero-icon" src="${heroMeteoUrl}" alt="weather icon" onerror="this.onerror=null; this.src='./images/weather/umbrella.svg';">
                    </div>
                </div>
                <div class="gw-hero-right">
                    <span class="gw-hero-condition">${heroCondition}</span>
                    <span class="gw-hero-sub">H: ${activeHigh}° • L: ${activeLow}°</span>
                </div>
            </div>

            <!-- Dynamic Weather Advisory Pill -->
            ${alertBannerHtml}

            <!-- Google-Style 1-Hour Granular Timeline Strip -->
            <div class="gw-hourly-scroll">
                ${hourlyColumnsHtml}
            </div>
        </div>

        <!-- 7-Day Selector Row -->
        <div class="gw-daily-row">
            ${dailyCardsHtml}
        </div>

        <!-- Planning Metrics Grid (Using Google Material Symbols) -->
        <div class="gw-metrics-grid">
            <div class="gw-metric-card">
                <span class="gw-metric-header">
                    <span class="material-symbols-outlined gw-metric-icon">weather_mix</span>
                    Precipitation
                </span>
                <span class="gw-metric-val">${maxPop}% Chance</span>
                <span class="gw-metric-sub">${precipSubText}</span>
            </div>
            <div class="gw-metric-card">
                <span class="gw-metric-header">
                    <span class="material-symbols-outlined gw-metric-icon">air</span>
                    Wind & Gusts
                </span>
                <span class="gw-metric-val">${windSpeedMax} km/h</span>
                <span class="gw-metric-sub">Gusts: ${windGustMax} km/h</span>
            </div>
            <div class="gw-metric-card">
                <span class="gw-metric-header">
                    <span class="material-symbols-outlined gw-metric-icon">thermostat</span>
                    Feels Like
                </span>
                <span class="gw-metric-val">${feelsLikeVal}°</span>
                <span class="gw-metric-sub">${feelsLikeSub}</span>
            </div>
            <div class="gw-metric-card">
                <span class="gw-metric-header">
                    <span class="material-symbols-outlined gw-metric-icon">wb_sunny</span>
                    Dawn & Dusk
                </span>
                <span class="gw-metric-val">${dawnDuskPrimary}</span>
                <span class="gw-metric-sub">${dawnDuskSecondary}</span>
            </div>
        </div>

        <!-- Subtle Open-Meteo Attribution -->
        <div class="gw-attribution">
            Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>
        </div>
    `;

    // Wire close button
    const closeBtn = panel.querySelector('#expanded-panel-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeWeatherExpandedPanel);

    // Wire city selector button
    const citySelectorBtn = panel.querySelector('#expanded-city-selector-btn');
    if (citySelectorBtn) {
        citySelectorBtn.addEventListener('click', () => {
            isCitySearchOpen = !isCitySearchOpen;
            renderExpandedForecast();
        });
    }

    // Wire search input and results if search is open
    if (isCitySearchOpen) {
        const searchInput = panel.querySelector('#expanded-city-search-input');
        const resultsEl = panel.querySelector('#expanded-search-results');
        const resetBtn = panel.querySelector('#expanded-search-reset-btn');

        function renderRecentSearches(container) {
            if (!container) return;
            const recents = getRecentCities();
            if (!recents || !recents.length) {
                container.style.display = 'none';
                container.innerHTML = '';
                return;
            }

            container.style.display = 'flex';
            container.innerHTML = `
                <div class="expanded-search-recents-header">
                    <span class="expanded-search-recents-title">Recent Searches</span>
                </div>
                ${recents.map((loc, idx) => {
                    const locSub = [loc.admin, loc.countryCode || loc.country].filter(Boolean).join(', ');
                    const tzLabel = (loc.timezone || '').split('/').pop().replace(/_/g, ' ');
                    return `
                        <div class="expanded-search-item recent-search-item" data-idx="${idx}" data-loc='${JSON.stringify(loc).replace(/'/g, "&apos;")}'>
                            <div class="recent-search-item-left">
                                <span class="material-symbols-outlined recent-search-history-icon">history</span>
                                <span class="recent-search-item-name"><strong>${loc.name}</strong>${locSub ? `, ${locSub}` : ''}</span>
                            </div>
                            <div class="recent-search-item-right">
                                <span class="expanded-search-item-tz">${tzLabel}</span>
                                <button class="recent-search-remove-btn" title="Remove from recent searches" aria-label="Remove" data-remove-idx="${idx}">✕</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            `;

            // Click on a recent city item to select it
            container.querySelectorAll('.recent-search-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (e.target.closest('.recent-search-remove-btn')) return;
                    const locData = JSON.parse(item.getAttribute('data-loc'));
                    selectLocation(locData);
                });
            });

            // Click on remove button to delete an entry
            container.querySelectorAll('.recent-search-remove-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(btn.getAttribute('data-remove-idx'), 10);
                    removeRecentCity(idx);
                    renderRecentSearches(container);
                });
            });
        }

        if (searchInput) {
            setTimeout(() => {
                searchInput.focus();
                renderRecentSearches(resultsEl);
            }, 50);

            searchInput.addEventListener('focus', () => {
                if (searchInput.value.trim().length < 2) {
                    renderRecentSearches(resultsEl);
                }
            });

            searchInput.addEventListener('input', () => {
                clearTimeout(searchDebounceTimer);
                const query = searchInput.value.trim();
                if (query.length < 2) {
                    renderRecentSearches(resultsEl);
                    return;
                }

                if (resultsEl) {
                    resultsEl.style.display = 'flex';
                    resultsEl.innerHTML = `<div class="expanded-search-empty">Searching cities...</div>`;
                }

                searchDebounceTimer = setTimeout(async () => {
                    const results = await searchCities(query);
                    if (!resultsEl) return;

                    if (!results || !results.length) {
                        resultsEl.style.display = 'flex';
                        resultsEl.innerHTML = `<div class="expanded-search-empty">No matching cities found</div>`;
                        return;
                    }

                    resultsEl.style.display = 'flex';

                    resultsEl.innerHTML = results.map(loc => {
                        const locSub = [loc.admin, loc.countryCode || loc.country].filter(Boolean).join(', ');
                        const tzLabel = loc.timezone.split('/').pop().replace(/_/g, ' ');
                        return `
                            <div class="expanded-search-item" data-loc='${JSON.stringify(loc).replace(/'/g, "&apos;")}'>
                                <span><strong>${loc.name}</strong>${locSub ? `, ${locSub}` : ''}</span>
                                <span class="expanded-search-item-tz">${tzLabel}</span>
                            </div>
                        `;
                    }).join('');

                    resultsEl.querySelectorAll('.expanded-search-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const locData = JSON.parse(item.getAttribute('data-loc'));
                            selectLocation(locData);
                        });
                    });
                }, 280);
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                selectLocation(DEFAULT_LOCATION);
            });
        }
    }

    // Wire daily selector card clicks
    const dayCards = panel.querySelectorAll('.gw-daily-card');
    dayCards.forEach(card => {
        card.addEventListener('click', (e) => {
            const clickedKey = e.currentTarget.getAttribute('data-day-key');
            if (clickedKey && clickedKey !== selectedDayKey) {
                selectedDayKey = clickedKey;
                renderExpandedForecast();
            }
        });
    });
}
