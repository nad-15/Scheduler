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
AppTimezone.set(currentLocation.timezone);
let isCitySearchOpen = false;
let searchDebounceTimer = null;

let cachedWeatherData = null;
let weatherFetchPromise = null;
let isExpandedPanelInitialized = false;
let selectedDayKey = null;
let timeTickerInterval = null;
let isExtendedForecast = false;
const EXTENDED_FORECAST_DAYS = 14;

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
 * Formats short date ("Sep 12") deterministically using UTC noon
 */
function formatShortDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(date);
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
        text = c === 48 ? 'Depositing Rime Fog' : 'Foggy';
        icon = isDay ? 'fog-day' : 'fog-night';
    } else if (c === 51) {
        text = 'Light Drizzle';
        icon = 'drizzle';
    } else if (c === 53) {
        text = 'Drizzle';
        icon = 'drizzle';
    } else if (c === 55) {
        text = 'Heavy Drizzle';
        icon = 'drizzle';
    } else if (c === 56) {
        text = 'Light Freezing Drizzle';
        icon = 'sleet';
    } else if (c === 57) {
        text = 'Dense Freezing Drizzle';
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
    } else if (c === 66) {
        text = 'Light Freezing Rain';
        icon = 'sleet';
    } else if (c === 67) {
        text = 'Heavy Freezing Rain';
        icon = 'sleet';
    } else if (c === 71) {
        text = 'Light Snow';
        icon = 'snow';
    } else if (c === 73) {
        text = 'Snow';
        icon = 'snow';
    } else if (c === 75) {
        text = 'Heavy Snow';
        icon = 'snow';
    } else if (c === 77) {
        text = 'Snow Grains';
        icon = 'snow';
    } else if (c === 80) {
        text = 'Light Showers';
        icon = isDay ? 'partly-cloudy-day-rain' : 'partly-cloudy-night-rain';
    } else if (c === 81) {
        text = 'Rain Showers';
        icon = isDay ? 'partly-cloudy-day-rain' : 'partly-cloudy-night-rain';
    } else if (c === 82) {
        text = 'Violent Showers';
        icon = 'rain';
    } else if (c === 85) {
        text = 'Light Snow Showers';
        icon = isDay ? 'partly-cloudy-day-snow' : 'partly-cloudy-night-snow';
    } else if (c === 86) {
        text = 'Heavy Snow Showers';
        icon = isDay ? 'partly-cloudy-day-snow' : 'partly-cloudy-night-snow';
    } else if (c === 95) {
        text = 'Thunderstorm';
        icon = isDay ? 'thunderstorms-day-rain' : 'thunderstorms-night-rain';
    } else if (c === 96) {
        text = 'Thunderstorm with Hail';
        icon = 'hail';
    } else if (c === 99) {
        text = 'Severe Hailstorm';
        icon = 'hail';
    }

    return {
        code: c,
        text: text,
        icon: icon,
        iconUrl: `./images/weather/${icon}.svg`
    };
}

const weatherSvgCache = new Map();
const weatherSvgPromises = new Map();
let svgInstanceCounter = 0;
const svgDomParser = new DOMParser();

/**
 * Loads and caches SVG content text from URL, sharing pending promises across concurrent requests
 */
async function loadWeatherSvg(url) {
    if (!url) return null;
    if (weatherSvgCache.has(url)) return weatherSvgCache.get(url);
    if (weatherSvgPromises.has(url)) return weatherSvgPromises.get(url);

    const p = (async () => {
        try {
            const res = await fetch(url);
            if (!res.ok) return null;
            let text = await res.text();
            text = text.replace(/<\?xml.*?\?>/i, '').trim();
            weatherSvgCache.set(url, text);
            return text;
        } catch (e) {
            return null;
        } finally {
            weatherSvgPromises.delete(url);
        }
    })();

    weatherSvgPromises.set(url, p);
    return p;
}

/**
 * Safely parses an SVG string into a valid SVGSVGElement using DOMParser in image/svg+xml mode
 */
function parseSvgString(svgText) {
    if (!svgText) return null;
    try {
        const doc = svgDomParser.parseFromString(svgText, 'image/svg+xml');
        if (doc.querySelector('parsererror')) return null;
        const svg = doc.documentElement;
        if (!svg || svg.nodeName.toLowerCase() !== 'svg') return null;
        return document.importNode(svg, true);
    } catch (e) {
        return null;
    }
}

/**
 * Scopes internal IDs (linearGradient, clipPath, mask, filter) inside an SVG element
 * to unique names, preventing document-wide collision across multiple inlined instances.
 */
function scopeSvgInternalIds(svgElem) {
    if (!svgElem) return;
    const elementsWithId = svgElem.querySelectorAll('[id]');
    if (!elementsWithId.length) return;

    const prefix = `wsvg_${++svgInstanceCounter}_`;
    const idMap = new Map();

    elementsWithId.forEach(el => {
        const oldId = el.getAttribute('id');
        if (oldId) {
            const newId = `${prefix}${oldId}`;
            idMap.set(oldId, newId);
            el.setAttribute('id', newId);
        }
    });

    if (!idMap.size) return;

    const allDescendants = svgElem.querySelectorAll('*');
    allDescendants.forEach(el => {
        for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i];
            const val = attr.value;
            if (val && val.includes('url(#')) {
                let updated = val;
                idMap.forEach((newId, oldId) => {
                    const searchTarget = `url(#${oldId})`;
                    if (updated.includes(searchTarget)) {
                        updated = updated.split(searchTarget).join(`url(#${newId})`);
                    }
                });
                if (updated !== val) {
                    attr.value = updated;
                }
            } else if (val && (attr.name === 'href' || attr.name === 'xlink:href') && val.startsWith('#')) {
                const targetId = val.slice(1);
                if (idMap.has(targetId)) {
                    attr.value = `#${idMap.get(targetId)}`;
                }
            }
        }
    });
}

/**
 * Preloads unique weather SVGs in the forecast data into memory
 */
function preloadWeatherSvgs(data) {
    if (!data || !data.daily || !data.hourly) return;
    const urls = new Set();
    if (data.current) {
        const curWmo = getWmoDetails(data.current.weather_code, Boolean(data.current.is_day));
        if (curWmo?.iconUrl) urls.add(curWmo.iconUrl);
    }
    data.daily.weather_code?.forEach((code, i) => {
        const wmo = getWmoDetails(code, true);
        if (wmo?.iconUrl) urls.add(wmo.iconUrl);
    });
    data.hourly.weather_code?.forEach((code, i) => {
        const isDay = Boolean(data.hourly.is_day?.[i]);
        const wmo = getWmoDetails(code, isDay);
        if (wmo?.iconUrl) urls.add(wmo.iconUrl);
    });
    urls.add('./images/weather/umbrella.svg');
    urls.add('./images/weather/wind-spinner.svg');
    urls.add('./images/weather/not-available.svg');
    urls.add('./images/weather/rain.svg');
    urls.add('./images/weather/snow.svg');
    urls.add('./images/weather/wind.svg');
    urls.add('./images/weather/sleet.svg');
    urls.add('./images/weather/clear-day.svg');
    urls.add('./images/weather/clear-night.svg');
    urls.add('./images/weather/thunderstorms-rain.svg');
    urls.add('./images/weather/fog-day.svg');
    urls.add('./images/weather/fog-night.svg');
    urls.add('./images/weather/extreme-sleet.svg');
    urls.add('./images/weather/wind-alert.svg');
    urls.add('./images/weather/raindrops.svg');
    urls.add('./images/weather/thunderstorms.svg');
    urls.add('./images/weather/thunderstorms-extreme.svg');
    urls.add('./images/weather/snowflake.svg');
    urls.add('./images/weather/sun-hot.svg');
    urls.add('./images/weather/uv-index.svg');
    urls.add('./images/weather/thermometer-colder.svg');
    urls.add('./images/weather/thermometer.svg');
    urls.add('./images/weather/fog.svg');
    urls.add('./images/weather/horizon.svg');
    urls.add('./images/weather/rainbow-clear.svg');
    urls.add('./images/weather/starry-night.svg');
    urls.add('./images/weather/barometer.svg');

    urls.forEach(url => loadWeatherSvg(url));
}

/**
 * Upgrades <img> tags for weather icons into living inline <svg> elements.
 * Preserves classes, dimensions, styles, accessibility labels, and prevents ID collisions.
 */
async function inlineWeatherSvgs(container) {
    if (!container) return;
    const imgElements = Array.from(container.querySelectorAll('img[src*="/images/weather/"]'));
    if (!imgElements.length) return;

    await Promise.all(imgElements.map(async (img) => {
        const src = img.getAttribute('src');
        if (!src) return;
        const svgText = await loadWeatherSvg(src);
        if (!svgText || !img.parentNode) return;

        const svgElem = parseSvgString(svgText);
        if (!svgElem || !img.parentNode) return;

        // Scope internal gradient/clipPath/mask IDs to avoid document-wide collisions
        scopeSvgInternalIds(svgElem);

        // Preserve presentation & accessibility attributes
        if (img.className) {
            svgElem.setAttribute('class', (svgElem.getAttribute('class') || '') + ' ' + img.className);
        }
        if (img.id) svgElem.id = img.id;
        if (img.style.cssText) {
            svgElem.style.cssText = (svgElem.style.cssText ? svgElem.style.cssText + ';' : '') + img.style.cssText;
        }
        if (img.getAttribute('width')) svgElem.setAttribute('width', img.getAttribute('width'));
        if (img.getAttribute('height')) svgElem.setAttribute('height', img.getAttribute('height'));

        Array.from(img.attributes).forEach(attr => {
            if (attr.name.startsWith('data-')) {
                svgElem.setAttribute(attr.name, attr.value);
            }
        });

        const alt = img.getAttribute('alt');
        if (alt) {
            svgElem.setAttribute('aria-label', alt);
            svgElem.setAttribute('role', 'img');
        } else {
            svgElem.setAttribute('aria-hidden', 'true');
        }

        svgElem.style.pointerEvents = 'none';
        svgElem.setAttribute('data-weather-src', src);

        img.replaceWith(svgElem);
    }));
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
    AppTimezone.set(newLoc.timezone);
    const state = getWeatherStoredState();
    state.location = { ...currentLocation };
    saveWeatherStoredState(state);

    if (newLoc && !(newLoc.name === DEFAULT_LOCATION.name && Math.abs(newLoc.lat - DEFAULT_LOCATION.lat) < 0.01)) {
        saveRecentCity(newLoc);
    }

    cachedWeatherData = null;
    isCitySearchOpen = false;
    selectedDayKey = null;
    isExtendedForecast = false;

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
async function fetchWeatherData(forceRefresh = false, targetDays = 7) {
    const { lat, lon, timezone } = currentLocation;
    const cacheKey = `${lat},${lon}`;
    const daysToFetch = Math.max(targetDays, 7);

    const isCacheValid = cachedWeatherData &&
        cachedWeatherData._locationKey === cacheKey &&
        cachedWeatherData._fetchedAt &&
        (Date.now() - cachedWeatherData._fetchedAt < 10 * 60 * 1000);

    if (!forceRefresh && isCacheValid) {
        const availableDays = cachedWeatherData.daily?.time?.length || 0;
        if (availableDays >= daysToFetch) {
            return cachedWeatherData;
        }
    }
    if (weatherFetchPromise) return weatherFetchPromise;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,uv_index` +
        `&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day,uv_index` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,daylight_duration,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,snowfall_sum` +
        `&timezone=${encodeURIComponent(timezone)}&forecast_days=${daysToFetch}`;

    weatherFetchPromise = (async () => {
        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data && data.current && data.hourly && data.daily) {
                data._fetchedAt = Date.now();
                data._locationKey = cacheKey;
                cachedWeatherData = data;
                preloadWeatherSvgs(data);

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
        const weatherWidget = document.getElementById('weather-widget');
        if (weatherWidget && !weatherWidget.querySelector('.time-container') && !weatherWidget.querySelector('.weather-widget-loading')) {
            weatherWidget.innerHTML = `
                <div class="weather-widget-loading">
                    <div class="weather-widget-spinner"></div>
                    <span class="weather-widget-loading-text">Loading weather...</span>
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

        if (weatherWidget) {
            // Render structure once if not already rendered
            if (!weatherWidget.querySelector('.time-container')) {
                weatherWidget.innerHTML = `
                    <div class="time-container">
                        <div id="weather-location" title="${locationLabel}">${locationLabel}</div>
                        <div id="weather-date"></div>
                        <div id="weather-time">
                            <span id="weather-hour-minute"></span>
                        </div>
                        <span id="weather-seconds"></span>
                    </div>

                    <div class="weather-container">
                        <div id="weather-icon">
                             <img src="${iconUrl}" alt="weather icon" onerror="this.onerror=null; this.src='./images/weather/wind-spinner.svg';">
                        </div>
                        <div id="weather-temp">${tempVal}°</div>
                        <div id="weather-desc">${weatherDescription}</div>
                    </div>
                `;
            } else {
                const locEl = weatherWidget.querySelector('#weather-location');
                if (locEl) {
                    locEl.textContent = locationLabel;
                    locEl.title = locationLabel;
                }
                const tempEl = weatherWidget.querySelector('#weather-temp');
                if (tempEl) tempEl.textContent = `${tempVal}°`;
                const weatherEl = weatherWidget.querySelector('#weather-desc');
                if (weatherEl) weatherEl.textContent = weatherDescription;
                const iconContainer = weatherWidget.querySelector('#weather-icon');
                if (iconContainer) {
                    const currentSrc = iconContainer.querySelector('img')?.getAttribute('src') ||
                                       iconContainer.querySelector('svg')?.getAttribute('data-weather-src');
                    if (currentSrc !== iconUrl) {
                        iconContainer.innerHTML = `<img src="${iconUrl}" alt="weather icon" onerror="this.onerror=null; this.src='./images/weather/wind-spinner.svg';">`;
                    }
                }
            }
            inlineWeatherSvgs(weatherWidget);

            const dateEl = weatherWidget.querySelector('#weather-date');
            const hourMinuteEl = weatherWidget.querySelector('#weather-hour-minute');
            const secondsEl = weatherWidget.querySelector('#weather-seconds');

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
        const weatherWidget = document.getElementById('weather-widget');
        if (weatherWidget) {
            weatherWidget.innerHTML = `
                <div class="time-container">
                    <div id="weather-location">${currentLocation.name}</div>
                    <div id="weather-date">--, ----</div>
                    <div id="weather-time">
                        <span id="weather-hour-minute">--:--</span>
                    </div>
                    <span id="weather-seconds">:-- --</span>
                </div>

                <div class="weather-container">
                    <div id="weather-icon">
                        <img src="./images/weather/wind-spinner.svg" alt="icon">
                    </div>
                    <div id="weather-temp">--°</div>
                    <div id="weather-desc">Weather unavailable</div>
                </div>
            `;
        }
    }
}

/**
 * Companion Forecast Outlook Bar (Under #weather-widget)
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
        const slotDateKey = data.hourly.time[idx].split('T')[0];
        const dateSuffix = slotDateKey !== todayDateKey ? ` · ${formatShortDate(slotDateKey)}` : '';

        // Freezing Rain / Ice Hazard
        if ([56, 57, 66, 67].includes(code)) {
            alertType = 'freeze';
            alertIconUrl = './images/weather/extreme-sleet.svg';
            alertText = `Freezing rain at ${timeLabel} (${pop}%)${dateSuffix}`;
            isPulse = true;
            outlookBar.classList.add('has-freeze');
            break;
        }
        // Snow detection
        if ([71, 73, 75, 77, 85, 86].includes(code)) {
            alertType = 'snow';
            alertIconUrl = './images/weather/snowflake.svg';
            alertText = `Snow at ${timeLabel} (${pop}%)${dateSuffix}`;
            isPulse = true;
            outlookBar.classList.add('has-snow');
            break;
        }
        // Thunderstorm
        if ([95, 96, 99].includes(code)) {
            alertType = 'storm';
            alertIconUrl = './images/weather/thunderstorms-extreme.svg';
            alertText = `Storm at ${timeLabel} (${pop}%)${dateSuffix}`;
            isPulse = true;
            outlookBar.classList.add('has-rain');
            break;
        }
        // Rain / Showers / Drizzle
        if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code) || pop >= 30 || precip >= 0.2) {
            alertType = 'rain';
            alertIconUrl = './images/weather/umbrella.svg';
            alertText = `Rain at ${timeLabel} (${pop}%)${dateSuffix}`;
            isPulse = true;
            outlookBar.classList.add('has-rain');
            break;
        }
    }

    // Freeze / Frost Alert
    const curApparent = Math.round(data.current.apparent_temperature);
    if (!alertType && (lowTemp <= -12 || curApparent <= -16 || (lowTemp <= 0 && highTemp > 3))) {
        alertType = 'freeze';
        alertIconUrl = './images/weather/thermometer-colder.svg';
        alertText = (lowTemp <= -12 || curApparent <= -16)
            ? `Extreme cold: Low ${lowTemp}°`
            : (lowTemp < 0 ? `Freeze alert: Low ${lowTemp}°` : `Frost alert: Low 0°`);
        outlookBar.classList.add('has-freeze');
    }

    // High Wind / Gusts (>= 38 km/h)
    if (!alertType) {
        let maxGust = 0;
        let gustTimeIdx = -1;
        for (const idx of upcomingHourlyIndices) {
            const g = data.hourly.wind_gusts_10m[idx] || 0;
            if (g > maxGust) {
                maxGust = g;
                gustTimeIdx = idx;
            }
        }
        if (maxGust >= 38) {
            alertType = 'wind';
            alertIconUrl = './images/weather/wind-alert.svg';
            const gustSlotDate = gustTimeIdx >= 0 ? data.hourly.time[gustTimeIdx].split('T')[0] : todayDateKey;
            const gustSuffix = gustSlotDate !== todayDateKey ? ` · ${formatShortDate(gustSlotDate)}` : '';
            alertText = `Gusts up to ${Math.round(maxGust)} km/h${gustSuffix}`;
            outlookBar.classList.add('has-wind');
        }
    }

    // Fog / Low Visibility
    if (!alertType) {
        for (const idx of upcomingHourlyIndices) {
            if ([45, 48].includes(data.hourly.weather_code[idx])) {
                alertType = 'fog';
                alertIconUrl = './images/weather/fog.svg';
                const fogSlotDate = data.hourly.time[idx].split('T')[0];
                const fogSuffix = fogSlotDate !== todayDateKey ? ` · ${formatShortDate(fogSlotDate)}` : '';
                alertText = `Fog / low visibility${fogSuffix}`;
                outlookBar.classList.add('has-fog');
                break;
            }
        }
    }

    // Heat & High UV Alert
    if (!alertType && (highTemp >= 30 || Math.round(data.current.apparent_temperature) >= 35 || (data.current.uv_index && data.current.uv_index >= 8))) {
        alertType = 'heat';
        alertIconUrl = './images/weather/sun-hot.svg';
        const feels = Math.round(data.current.apparent_temperature);
        alertText = `Heat advisory: Feels ${feels}°`;
        outlookBar.classList.add('has-rain');
    }

    // Default: Clear / Dry Conditions
    if (!alertType) {
        alertType = 'clear';
        let maxGust = 0;
        let maxPop = 0;
        for (const idx of upcomingHourlyIndices) {
            const g = data.hourly.wind_gusts_10m[idx] || 0;
            if (g > maxGust) maxGust = g;
            const p = data.hourly.precipitation_probability[idx] || 0;
            if (p > maxPop) maxPop = p;
        }
        const isIdeal = highTemp >= 19 && highTemp <= 26 && maxGust < 30 && maxPop < 25;
        if (isIdeal) {
            alertIconUrl = isCurrentDaytime ? './images/weather/rainbow-clear.svg' : './images/weather/starry-night.svg';
            alertText = `Pleasant & mild conditions`;
        } else {
            const isColdSeason = lowTemp <= 3 || highTemp <= 3;
            if (isColdSeason) {
                alertIconUrl = './images/weather/thermometer.svg';
                alertText = `No snow expected`;
            } else {
                alertIconUrl = isCurrentDaytime ? './images/weather/horizon.svg' : './images/weather/starry-night.svg';
                alertText = `No rain expected`;
            }
        }
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
            <div class="outlook-status" title="${alertText}"><span class="outlook-icon ${isPulse ? 'pulse' : ''}"><img class="outlook-meteo-icon" src="${alertIconUrl}" alt="${alertType}" onerror="this.onerror=null; this.src='./images/weather/wind-spinner.svg';"></span>${alertText}</div>
        </div>
        <div class="outlook-sub-info">
            <span class="outlook-temps">H: ${highTemp}° L: ${lowTemp}°</span>
            <span class="outlook-extra">${extraHtml}</span>
        </div>
    `;

    inlineWeatherSvgs(outlookBar);

    // Position dynamically directly below #weather-widget and lock exact width matching
    const alignPosition = () => {
        const weatherWidget = document.getElementById('weather-widget');
        if (weatherWidget && outlookBar) {
            const rect = weatherWidget.getBoundingClientRect();
            if (rect.height > 0) outlookBar.style.top = `${rect.bottom + 6}px`;
            if (rect.width > 0) {
                outlookBar.style.width = `${rect.width}px`;
                outlookBar.style.minWidth = `${rect.width}px`;
                outlookBar.style.maxWidth = `${rect.width}px`;
            }
        }
    };

    // Sync visibility with #weather-widget and global hide-all-buttons state
    const weatherWidget = document.getElementById('weather-widget');
    const hideWidgetBtn = document.getElementById('hide-widget-btn') || document.querySelector('.hide-widget');

    const syncVisibility = () => {
        if (!weatherWidget || outlookBar.classList.contains('dismissed')) return;

        const isButtonsHidden = (typeof isAllButtonsHidden !== 'undefined' && isAllButtonsHidden) ||
            (typeof appSettings !== 'undefined' && appSettings["hide-all-buttons"]) ||
            (localStorage.getItem("hideAllButtons") === 'true');

        const isSlideHidden = weatherWidget.style.transform &&
            weatherWidget.style.transform !== 'translateX(0px)' &&
            weatherWidget.style.transform !== 'translateX(0)';

        const isDisplayNone = isButtonsHidden ||
            weatherWidget.style.display === 'none' ||
            getComputedStyle(weatherWidget).display === 'none';

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

    // Expose for external controls (e.g. script.js unhide button)
    window.syncWeatherOutlookVisibility = syncVisibility;

    // Apply visibility immediately & synchronously (eliminates any 50ms async glimpse/flash)
    syncVisibility();

    window.addEventListener('resize', alignPosition);
    setTimeout(syncVisibility, 50);
    setTimeout(syncVisibility, 150);
    setTimeout(syncVisibility, 600);

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(syncVisibility);
    }

    const weatherWidgetEl = document.getElementById('weather-widget');
    if (window.ResizeObserver && weatherWidgetEl) {
        const ro = new ResizeObserver(() => {
            alignPosition();
        });
        ro.observe(weatherWidgetEl);
    }

    // Slide left / right gesture to dismiss companion outlook bar
    let touchStartX = 0;
    let touchStartY = 0;
    let touchDeltaX = 0;
    let isSwiping = false;
    let hasMoved = false;

    function handleDragStart(x, y) {
        touchStartX = x;
        touchStartY = y;
        touchDeltaX = 0;
        isSwiping = false;
        hasMoved = false;
    }

    function handleDragMove(x, y) {
        const diffX = x - touchStartX;
        const diffY = y - touchStartY;

        // If predominantly horizontal movement > 7px, engage swipe
        if (!isSwiping) {
            if (Math.abs(diffX) > 7 && Math.abs(diffX) > Math.abs(diffY)) {
                isSwiping = true;
                hasMoved = true;
                outlookBar.style.transition = 'none';
            }
        }

        if (isSwiping) {
            touchDeltaX = diffX;
            outlookBar.style.transform = `translateX(${touchDeltaX}px)`;
            const opacityVal = Math.max(0.2, 1 - (Math.abs(touchDeltaX) / 220));
            outlookBar.style.opacity = String(opacityVal);
        }
    }

    function handleDragEnd() {
        if (!isSwiping) {
            outlookBar.style.transition = '';
            outlookBar.style.transform = '';
            outlookBar.style.opacity = '';
            return;
        }

        outlookBar.style.transition = 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.28s ease';

        // Threshold to dismiss: 40px in either direction
        if (Math.abs(touchDeltaX) > 40) {
            const dismissDirection = touchDeltaX > 0 ? 'translateX(150%)' : 'translateX(-150%)';
            outlookBar.style.transform = dismissDirection;
            outlookBar.style.opacity = '0';
            outlookBar.classList.add('dismissed');
            sessionStorage.setItem('weather-outlook-dismissed', 'true');
            setTimeout(() => {
                outlookBar.style.display = 'none';
                outlookBar.style.transition = '';
            }, 300);
        } else {
            // Snap back
            outlookBar.style.transform = 'translateX(0)';
            outlookBar.style.opacity = '1';
            setTimeout(() => {
                outlookBar.style.transition = '';
            }, 300);
        }
    }

    // Touch events for mobile devices
    outlookBar.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });

    outlookBar.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
            handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
            if (isSwiping && e.cancelable) {
                e.preventDefault();
            }
        }
    }, { passive: false });

    outlookBar.addEventListener('touchend', () => {
        handleDragEnd();
    });

    outlookBar.addEventListener('touchcancel', () => {
        handleDragEnd();
    });

    // Pointer events for desktop drag support
    let isPointerDown = false;
    outlookBar.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') {
            isPointerDown = true;
            handleDragStart(e.clientX, e.clientY);
        }
    });

    window.addEventListener('pointermove', (e) => {
        if (isPointerDown && e.pointerType === 'mouse') {
            handleDragMove(e.clientX, e.clientY);
        }
    });

    window.addEventListener('pointerup', (e) => {
        if (isPointerDown && e.pointerType === 'mouse') {
            isPointerDown = false;
            handleDragEnd();
        }
    });

    window.addEventListener('pointercancel', (e) => {
        if (isPointerDown && e.pointerType === 'mouse') {
            isPointerDown = false;
            handleDragEnd();
        }
    });

    // Clicking outlook bar opens expanded dashboard (only if not dragging/swiping)
    outlookBar.addEventListener('click', (e) => {
        if (hasMoved) {
            e.stopPropagation();
            hasMoved = false;
            return;
        }
        openWeatherExpandedPanel();
    });

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

    // Make #weather-widget also open the expanded dashboard on click
    const weatherWidget = document.getElementById('weather-widget');
    if (weatherWidget) {
        weatherWidget.addEventListener('click', (e) => {
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
        scrollHourlyStripToNow(panel);
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
 * Smoothly positions the hourly forecast strip to 'Now' for today, or start of day for other days
 */
function scrollHourlyStripToNow(panel) {
    if (!panel) panel = document.getElementById('weather-expanded-panel');
    if (!panel) return;
    const hourlyScroll = panel.querySelector('.gw-hourly-scroll');
    if (!hourlyScroll) return;

    const doScroll = () => {
        const nowCol = hourlyScroll.querySelector('.gw-hourly-col.is-now');
        if (nowCol) {
            const colRect = nowCol.getBoundingClientRect();
            const scrollRect = hourlyScroll.getBoundingClientRect();
            if (scrollRect.width > 0) {
                const diff = colRect.left - scrollRect.left;
                hourlyScroll.scrollLeft = Math.max(0, hourlyScroll.scrollLeft + diff);
            }
        } else {
            hourlyScroll.scrollLeft = 0;
        }
    };

    doScroll();
    requestAnimationFrame(doScroll);
}

/**
 * Computes and renders HTML for the active day's Hero Overview Card and Planning Metrics Grid
 */
function buildDayForecastDetails(data, dayKey) {
    const todayDateKey = getCityDateKey(new Date(), currentLocation.timezone);
    if (!dayKey || !data.daily.time.includes(dayKey)) {
        dayKey = todayDateKey;
    }

    const activeIndex = data.daily.time.indexOf(dayKey);
    const isTodayActive = dayKey === todayDateKey;

    const activeDayLabel = isTodayActive ? 'Now' : formatFullDateLabel(dayKey);
    const activeHigh = Math.round(data.daily.temperature_2m_max[activeIndex]);
    const activeLow = Math.round(data.daily.temperature_2m_min[activeIndex]);
    const activeCode = isTodayActive ? data.current.weather_code : data.daily.weather_code[activeIndex];
    const activeIsDay = isTodayActive ? Boolean(data.current.is_day) : true;
    const activeWmo = getWmoDetails(activeCode, activeIsDay);

    const heroTemp = isTodayActive ? `${Math.round(data.current.temperature_2m)}°` : `${activeHigh}°`;
    const heroCondition = activeWmo.text;
    const heroMeteoUrl = activeWmo.iconUrl;

    // Hourly Slots for Selected Day (24 individual 1-Hour increments)
    const dayIndices = [];
    data.hourly.time.forEach((t, idx) => {
        if (t.startsWith(dayKey)) {
            dayIndices.push(idx);
        }
    });

    // Planning Metrics Calculation
    const maxPop = data.daily.precipitation_probability_max[activeIndex] || 0;
    const precipSum = data.daily.precipitation_sum[activeIndex] || 0;
    const snowfallSum = (data.daily.snowfall_sum && data.daily.snowfall_sum[activeIndex]) || 0;
    const windSpeedMax = Math.round(data.daily.wind_speed_10m_max[activeIndex] || 0);
    const windGustMax = Math.round(data.daily.wind_gusts_10m_max[activeIndex] || 0);

    const feelsLikeVal = isTodayActive
        ? Math.round(data.current.apparent_temperature)
        : Math.round(data.daily.apparent_temperature_max[activeIndex]);

    const uvVal = isTodayActive
        ? (data.current.uv_index !== undefined ? Math.round(data.current.uv_index) : (data.daily.uv_index_max ? Math.round(data.daily.uv_index_max[activeIndex]) : 0))
        : (data.daily.uv_index_max ? Math.round(data.daily.uv_index_max[activeIndex]) : 0);

    const now = new Date();
    const cityHour24 = getCityHour24(now, currentLocation.timezone);

    // For Today, prioritize remaining hours so past morning rain doesn't show in the evening
    let alertIndices = isTodayActive
        ? dayIndices.filter(idx => parseInt(data.hourly.time[idx].split('T')[1], 10) >= cityHour24)
        : dayIndices;
    if (alertIndices.length === 0) alertIndices = dayIndices;

    let alertBannerHtml = '';

    // 1. Freezing Rain / Ice Hazard (Highest hazard priority)
    for (const idx of alertIndices) {
        const code = data.hourly.weather_code[idx];
        const pop = data.hourly.precipitation_probability[idx] || 0;
        const timeLabel = formatIsoHour(data.hourly.time[idx]);

        if ([56, 57, 66, 67].includes(code)) {
            alertBannerHtml = `
                <div class="gw-alert-pill is-freeze is-alert">
                    <div class="gw-alert-icon-box">
                        <img class="gw-alert-meteo-icon" src="./images/weather/extreme-sleet.svg" alt="Ice Hazard" onerror="this.style.display='none'">
                    </div>
                    <div class="gw-alert-text-group">
                        <div class="gw-alert-title">Ice Hazard Warning</div>
                        <div class="gw-alert-desc">Slippery freezing rain around ${timeLabel} (${pop}% chance)</div>
                    </div>
                </div>
            `;
            break;
        }
    }

    // 2. Severe Storm Alert
    if (!alertBannerHtml) {
        for (const idx of alertIndices) {
            const code = data.hourly.weather_code[idx];
            const pop = data.hourly.precipitation_probability[idx] || 0;
            const timeLabel = formatIsoHour(data.hourly.time[idx]);

            if ([95, 96, 99].includes(code)) {
                alertBannerHtml = `
                    <div class="gw-alert-pill is-storm is-alert">
                        <div class="gw-alert-icon-box">
                            <img class="gw-alert-meteo-icon" src="./images/weather/thunderstorms-extreme.svg" alt="Storm" onerror="this.style.display='none'">
                        </div>
                        <div class="gw-alert-text-group">
                            <div class="gw-alert-title">Storm Alert</div>
                            <div class="gw-alert-desc">Thunderstorms expected at ${timeLabel} (${pop}% chance)</div>
                        </div>
                    </div>
                `;
                break;
            }
        }
    }

    // 3. Snow Expected / Accumulation
    if (!alertBannerHtml) {
        for (const idx of alertIndices) {
            const code = data.hourly.weather_code[idx];
            const pop = data.hourly.precipitation_probability[idx] || 0;
            const timeLabel = formatIsoHour(data.hourly.time[idx]);

            if ([71, 73, 75, 77, 85, 86].includes(code) || (snowfallSum > 0 && pop >= 30)) {
                const isHeavy = snowfallSum >= 2 || [75, 86].includes(code);
                const snowTitle = isHeavy ? 'Snow Accumulation' : 'Snow Expected';
                const snowDesc = isHeavy && snowfallSum > 0
                    ? `~${snowfallSum.toFixed(1)} cm expected starting around ${timeLabel}`
                    : `At ${timeLabel} (${pop}% chance)`;
                alertBannerHtml = `
                    <div class="gw-alert-pill is-snow is-alert">
                        <div class="gw-alert-icon-box">
                            <img class="gw-alert-meteo-icon" src="./images/weather/snowflake.svg" alt="Snow" onerror="this.style.display='none'">
                        </div>
                        <div class="gw-alert-text-group">
                            <div class="gw-alert-title">${snowTitle}</div>
                            <div class="gw-alert-desc">${snowDesc}</div>
                        </div>
                    </div>
                `;
                break;
            }
        }
    }

    // 4. Rain Expected / Heavy Rain
    if (!alertBannerHtml) {
        for (const idx of alertIndices) {
            const code = data.hourly.weather_code[idx];
            const pop = data.hourly.precipitation_probability[idx] || 0;
            const precip = data.hourly.precipitation[idx] || 0;
            const timeLabel = formatIsoHour(data.hourly.time[idx]);

            if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code) || pop >= 30 || precip >= 0.2) {
                const vol = precip > 0 ? ` • ~${precip.toFixed(1)} mm` : (precipSum > 0 ? ` • ~${precipSum.toFixed(1)} mm` : '');
                const isHeavy = precip >= 4 || [65, 82].includes(code);
                const rainTitle = isHeavy ? 'Heavy Rain Alert' : 'Rain Expected';
                alertBannerHtml = `
                    <div class="gw-alert-pill is-rain is-alert">
                        <div class="gw-alert-icon-box">
                            <img class="gw-alert-meteo-icon" src="./images/weather/umbrella.svg" alt="Rain" onerror="this.style.display='none'">
                        </div>
                        <div class="gw-alert-text-group">
                            <div class="gw-alert-title">${rainTitle}</div>
                            <div class="gw-alert-desc">At ${timeLabel} (${pop}% chance)${vol}</div>
                        </div>
                    </div>
                `;
                break;
            }
        }
    }

    // 5. High Wind Advisory
    if (!alertBannerHtml && windGustMax >= 38) {
        alertBannerHtml = `
            <div class="gw-alert-pill is-wind is-alert">
                <div class="gw-alert-icon-box">
                    <img class="gw-alert-meteo-icon" src="./images/weather/wind-alert.svg" alt="Wind" onerror="this.style.display='none'">
                </div>
                <div class="gw-alert-text-group">
                    <div class="gw-alert-title">Wind Advisory</div>
                    <div class="gw-alert-desc">Strong gusts up to ${windGustMax} km/h expected</div>
                </div>
            </div>
        `;
    }

    // 6. Dense Fog / Low Visibility
    if (!alertBannerHtml) {
        for (const idx of alertIndices) {
            const code = data.hourly.weather_code[idx];
            if ([45, 48].includes(code)) {
                alertBannerHtml = `
                    <div class="gw-alert-pill is-fog is-alert">
                        <div class="gw-alert-icon-box">
                            <img class="gw-alert-meteo-icon" src="./images/weather/fog.svg" alt="Fog" onerror="this.style.display='none'">
                        </div>
                        <div class="gw-alert-text-group">
                            <div class="gw-alert-title">Dense Fog Advisory</div>
                            <div class="gw-alert-desc">Low driving visibility expected</div>
                        </div>
                    </div>
                `;
                break;
            }
        }
    }

    // 7. Extreme Heat & High UV Alert
    if (!alertBannerHtml && (activeHigh >= 30 || feelsLikeVal >= 35 || uvVal >= 8)) {
        const heatSub = uvVal >= 6 ? `Feels like ${feelsLikeVal}° • Peak UV ${uvVal} (Sun protection needed)` : `Feels like ${feelsLikeVal}° • Stay hydrated`;
        alertBannerHtml = `
            <div class="gw-alert-pill is-heat is-alert">
                <div class="gw-alert-icon-box">
                    <img class="gw-alert-meteo-icon" src="./images/weather/sun-hot.svg" alt="Heat and UV" onerror="this.style.display='none'">
                </div>
                <div class="gw-alert-text-group">
                    <div class="gw-alert-title">Heat & UV Alert</div>
                    <div class="gw-alert-desc">${heatSub}</div>
                </div>
            </div>
        `;
    }

    // 8. Extreme Cold Warning
    if (!alertBannerHtml && (activeLow <= -12 || feelsLikeVal <= -16)) {
        alertBannerHtml = `
            <div class="gw-alert-pill is-freeze is-alert">
                <div class="gw-alert-icon-box">
                    <img class="gw-alert-meteo-icon" src="./images/weather/thermometer-colder.svg" alt="Extreme Cold" onerror="this.style.display='none'">
                </div>
                <div class="gw-alert-text-group">
                    <div class="gw-alert-title">Extreme Cold Warning</div>
                    <div class="gw-alert-desc">Low dropping to ${activeLow}° • Dress in warm layers</div>
                </div>
            </div>
        `;
    }

    // 9. Frost Advisory (Freeze-thaw frost risk)
    if (!alertBannerHtml && activeLow <= 0 && activeHigh > 3) {
        alertBannerHtml = `
            <div class="gw-alert-pill is-freeze is-alert">
                <div class="gw-alert-icon-box">
                    <img class="gw-alert-meteo-icon" src="./images/weather/thermometer-colder.svg" alt="Frost" onerror="this.style.display='none'">
                </div>
                <div class="gw-alert-text-group">
                    <div class="gw-alert-title">Frost Advisory</div>
                    <div class="gw-alert-desc">Overnight low dropping to ${activeLow}° • Frost expected</div>
                </div>
            </div>
        `;
    }

    const isDayForAlert = isTodayActive ? Boolean(data.current.is_day) : true;
    const dayNightClass = isDayForAlert ? 'is-day' : 'is-night';

    // 10. Cold & Dry Season
    if (!alertBannerHtml && activeLow <= 3) {
        const dryColdSub = isTodayActive ? 'No snow or precipitation expected' : 'Dry weather expected';
        alertBannerHtml = `
            <div class="gw-alert-pill is-neutral is-cold ${dayNightClass}">
                <div class="gw-alert-icon-box">
                    <img class="gw-alert-meteo-icon" src="./images/weather/thermometer.svg" alt="Cold Dry" onerror="this.style.display='none'">
                </div>
                <div class="gw-alert-text-group">
                    <div class="gw-alert-title">Cold & Dry</div>
                    <div class="gw-alert-desc">${dryColdSub}</div>
                </div>
            </div>
        `;
    }

    // 11. Pleasant & Mild / Dry & Clear
    if (!alertBannerHtml) {
        const isIdeal = activeHigh >= 19 && activeHigh <= 26 && windGustMax < 30 && maxPop < 25;
        const bannerTitle = isIdeal ? 'Pleasant & Mild' : 'Dry & Clear';
        const clearSub = isIdeal
            ? 'Comfortable temperatures and calm conditions'
            : (isTodayActive
                ? (isDayForAlert ? 'No rain expected through tonight' : 'No rain expected overnight')
                : 'No rain expected for this day');
        const clearIconUrl = isDayForAlert
            ? (isIdeal ? './images/weather/rainbow-clear.svg' : './images/weather/horizon.svg')
            : './images/weather/starry-night.svg';
        alertBannerHtml = `
            <div class="gw-alert-pill is-neutral is-clear ${isIdeal ? 'is-pleasant' : ''} ${dayNightClass}">
                <div class="gw-alert-icon-box">
                    <img class="gw-alert-meteo-icon" src="${clearIconUrl}" alt="Clear" onerror="this.style.display='none'">
                </div>
                <div class="gw-alert-text-group">
                    <div class="gw-alert-title">${bannerTitle}</div>
                    <div class="gw-alert-desc">${clearSub}</div>
                </div>
            </div>
        `;
    }

    // Hourly Forecast Strip (True 1-Hour Step in City's Local Time)
    let hourlyColumnsHtml = '';

    if (isTodayActive) {
        const liveTemp = Math.round(data.current.temperature_2m);
        const liveWmo = getWmoDetails(data.current.weather_code, Boolean(data.current.is_day));
        const livePrecip = data.current.precipitation || 0;
        const isRainingNow = livePrecip > 0 || [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(data.current.weather_code);

        let nowInserted = false;
        dayIndices.forEach(idx => {
            const tStr = data.hourly.time[idx];
            const slotHour = parseInt(tStr.split('T')[1].split(':')[0], 10);
            const sTemp = Math.round(data.hourly.temperature_2m[idx]);
            const popVal = data.hourly.precipitation_probability[idx] || 0;
            const isDaySlot = Boolean(data.hourly.is_day[idx]);
            const sWmo = getWmoDetails(data.hourly.weather_code[idx], isDaySlot);
            const timeLabel = formatIsoHour(tStr);

            if (slotHour === cityHour24) {
                nowInserted = true;
                hourlyColumnsHtml += `
                    <div class="gw-hourly-col is-now">
                        <span class="gw-hourly-temp">${liveTemp}°</span>
                        <span class="gw-hourly-pop ${isRainingNow ? '' : 'is-empty'}">${isRainingNow ? 'Now' : '&nbsp;'}</span>
                        <img class="gw-hourly-icon" src="${liveWmo.iconUrl}" alt="icon" onerror="this.onerror=null; this.src='./images/weather/wind-spinner.svg';">
                        <span class="gw-hourly-time">Now</span>
                    </div>
                `;
            } else if (slotHour < cityHour24) {
                hourlyColumnsHtml += `
                    <div class="gw-hourly-col is-past">
                        <span class="gw-hourly-temp">${sTemp}°</span>
                        <span class="gw-hourly-pop ${popVal >= 20 ? '' : 'is-empty'}">${popVal >= 20 ? `${popVal}%` : '&nbsp;'}</span>
                        <img class="gw-hourly-icon" src="${sWmo.iconUrl}" alt="icon" onerror="this.onerror=null; this.src='./images/weather/wind-spinner.svg';">
                        <span class="gw-hourly-time">${timeLabel}</span>
                    </div>
                `;
            } else {
                hourlyColumnsHtml += `
                    <div class="gw-hourly-col">
                        <span class="gw-hourly-temp">${sTemp}°</span>
                        <span class="gw-hourly-pop ${popVal >= 20 ? '' : 'is-empty'}">${popVal >= 20 ? `${popVal}%` : '&nbsp;'}</span>
                        <img class="gw-hourly-icon" src="${sWmo.iconUrl}" alt="icon" onerror="this.onerror=null; this.src='./images/weather/wind-spinner.svg';">
                        <span class="gw-hourly-time">${timeLabel}</span>
                    </div>
                `;
            }
        });

        if (!nowInserted) {
            hourlyColumnsHtml = `
                <div class="gw-hourly-col is-now">
                    <span class="gw-hourly-temp">${liveTemp}°</span>
                    <span class="gw-hourly-pop ${isRainingNow ? '' : 'is-empty'}">${isRainingNow ? 'Now' : '&nbsp;'}</span>
                    <img class="gw-hourly-icon" src="${liveWmo.iconUrl}" alt="icon" onerror="this.onerror=null; this.src='./images/weather/wind-spinner.svg';">
                    <span class="gw-hourly-time">Now</span>
                </div>
            ` + hourlyColumnsHtml;
        }
    } else {
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
                    <img class="gw-hourly-icon" src="${sWmo.iconUrl}" alt="icon" onerror="this.onerror=null; this.src='./images/weather/wind-spinner.svg';">
                    <span class="gw-hourly-time">${timeLabel}</span>
                </div>
            `;
        });
    }

    // Calculate Humidity for Selected Day
    let humidityVal = 0;
    if (isTodayActive && data.current.relative_humidity_2m !== undefined) {
        humidityVal = Math.round(data.current.relative_humidity_2m);
    } else if (dayIndices.length > 0 && data.hourly && data.hourly.relative_humidity_2m) {
        const dayHumidities = dayIndices.map(idx => data.hourly.relative_humidity_2m[idx]).filter(v => v !== undefined && v !== null);
        if (dayHumidities.length > 0) {
            humidityVal = Math.round(dayHumidities.reduce((a, b) => a + b, 0) / dayHumidities.length);
        } else if (data.current && data.current.relative_humidity_2m !== undefined) {
            humidityVal = Math.round(data.current.relative_humidity_2m);
        }
    } else if (data.current && data.current.relative_humidity_2m !== undefined) {
        humidityVal = Math.round(data.current.relative_humidity_2m);
    }

    let humiditySub = '';
    if (isTodayActive) {
        const uv = data.current.uv_index !== undefined ? Math.round(data.current.uv_index) : (data.daily.uv_index_max ? Math.round(data.daily.uv_index_max[activeIndex]) : null);
        humiditySub = uv !== null ? `Feels like ${feelsLikeVal}° • UV: ${uv}` : `Feels like ${feelsLikeVal}°`;
    } else {
        const maxUv = data.daily.uv_index_max ? Math.round(data.daily.uv_index_max[activeIndex]) : null;
        humiditySub = maxUv !== null ? `Feels like ${feelsLikeVal}° • Max UV: ${maxUv}` : `Feels like ${feelsLikeVal}°`;
    }

    const precipSubText = snowfallSum > 0
        ? `Est: ${snowfallSum.toFixed(1)} cm snow`
        : (precipSum > 0 ? `Est: ${precipSum.toFixed(1)} mm` : 'No accumulation');

    const sunriseStr = formatIsoTime(data.daily.sunrise[activeIndex]);
    const sunsetStr = formatIsoTime(data.daily.sunset[activeIndex]);

    const cityHour = getCityHour24(now, currentLocation.timezone);
    const isAfterNoonToday = isTodayActive && cityHour >= 12;
    const dawnDuskPrimary = isAfterNoonToday ? `Set ${sunsetStr}` : `Rise ${sunriseStr}`;
    const dawnDuskSecondary = isAfterNoonToday ? `Rise ${sunriseStr}` : `Set ${sunsetStr}`;

    const mainCardInnerHtml = `
        <div class="gw-hero-header">
            <div class="gw-hero-left">
                <span class="gw-hero-day">${activeDayLabel}</span>
                <div class="gw-hero-temp-row">
                    <span class="gw-hero-temp">${heroTemp}</span>
                    <img class="gw-hero-icon" src="${heroMeteoUrl}" alt="weather icon" onerror="this.onerror=null; this.src='./images/weather/wind-spinner.svg';">
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
    `;

    const metricsGridInnerHtml = `
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
                <span class="material-symbols-outlined gw-metric-icon">cool_to_dry</span>
                Humidity
            </span>
            <span class="gw-metric-val">${humidityVal}%</span>
            <span class="gw-metric-sub">${humiditySub}</span>
        </div>
        <div class="gw-metric-card">
            <span class="gw-metric-header">
                <span class="material-symbols-outlined gw-metric-icon">wb_sunny</span>
                Dawn & Dusk
            </span>
            <span class="gw-metric-val">${dawnDuskPrimary}</span>
            <span class="gw-metric-sub">${dawnDuskSecondary}</span>
        </div>
    `;

    return { mainCardInnerHtml, metricsGridInnerHtml };
}

/**
 * Handles selecting a day in the 7-day row without re-rendering the whole panel.
 * The daily row survives completely in the DOM, preserving its scroll position.
 */
function selectExpandedDay(clickedKey) {
    if (!clickedKey || clickedKey === selectedDayKey) return;
    selectedDayKey = clickedKey;

    const panel = document.getElementById('weather-expanded-panel');
    if (!panel || !cachedWeatherData) return;

    const mainCard = panel.querySelector('.gw-main-card');
    const metricsGrid = panel.querySelector('.gw-metrics-grid');
    const dailyRow = panel.querySelector('.gw-daily-row');

    // If components are missing, fall back to full render
    if (!mainCard || !metricsGrid || !dailyRow) {
        renderExpandedForecast();
        return;
    }

    const { mainCardInnerHtml, metricsGridInnerHtml } = buildDayForecastDetails(cachedWeatherData, selectedDayKey);

    // Re-render only the updated content cards
    mainCard.innerHTML = mainCardInnerHtml;
    metricsGrid.innerHTML = metricsGridInnerHtml;
    // Inlined animated SVGs are focused on Hero header and Alert pill only
    const heroHeader = mainCard.querySelector('.gw-hero-header');
    if (heroHeader) inlineWeatherSvgs(heroHeader);
    const alertPill = mainCard.querySelector('.gw-alert-pill');
    if (alertPill) inlineWeatherSvgs(alertPill);

    // The day row SURVIVES the re-render completely! Update active state in-place
    dailyRow.querySelectorAll('.gw-daily-card[data-day-key]').forEach(card => {
        const isCardActive = card.getAttribute('data-day-key') === selectedDayKey;
        card.classList.toggle('active', isCardActive);
    });

    // Ensure the clicked card stays comfortably in view without snapping back to start
    const activeCard = dailyRow.querySelector(`.gw-daily-card[data-day-key="${selectedDayKey}"]`);
    if (activeCard) {
        activeCard.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }

    scrollHourlyStripToNow(panel);
}

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
                    <span class="expanded-day-badge">${isExtendedForecast ? EXTENDED_FORECAST_DAYS : '7'}-Day Forecast</span>
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
    const availableDays = data.daily.time || [];
    const displayedDayKeys = isExtendedForecast ? availableDays.slice(0, EXTENDED_FORECAST_DAYS) : availableDays.slice(0, 7);

    if (!selectedDayKey || !displayedDayKeys.includes(selectedDayKey)) {
        selectedDayKey = todayDateKey;
    }

    // Preserve scroll position of daily row if panel was already rendered
    const prevDailyScroll = panel.querySelector('.gw-daily-row')?.scrollLeft;

    // 1. Build Daily Selector Cards
    const dailyCardsHtml = displayedDayKeys.map((dateStr, i) => {
        const isSelected = dateStr === selectedDayKey;
        const isCurrentDay = dateStr === todayDateKey;
        const dayShortName = isCurrentDay ? 'Today' : formatWeekday(dateStr);
        const wmo = getWmoDetails(data.daily.weather_code[i], true);
        const maxT = Math.round(data.daily.temperature_2m_max[i]);
        const minT = Math.round(data.daily.temperature_2m_min[i]);

        return `
            <div class="gw-daily-card ${isSelected ? 'active' : ''}" data-day-key="${dateStr}">
                <span class="gw-daily-name">${dayShortName}</span>
                <img class="gw-daily-icon" src="${wmo.iconUrl}" alt="icon" onerror="this.onerror=null; this.src='./images/weather/wind-spinner.svg';">
                <span class="gw-daily-range">${maxT}°/${minT}°</span>
            </div>
        `;
    }).join('');

    // Trigger action card (Minimalist single centered arrow_forward_ios button)
    const actionCardHtml = !isExtendedForecast ? `
        <div class="gw-daily-action-card" id="gw-daily-more-btn" role="button" tabindex="0" title="Extend to 14-day forecast" aria-label="Extend to 14-day forecast">
            <div class="gw-daily-plus-circle">
                <span class="material-symbols-outlined gw-daily-action-icon">arrow_forward_ios</span>
            </div>
        </div>
    ` : '';

    // 2. Build Hero Card & Metrics Details for Active Day
    const { mainCardInnerHtml, metricsGridInnerHtml } = buildDayForecastDetails(data, selectedDayKey);

    // Render Completed Panel
    panel.innerHTML = `
        <div class="expanded-header-row">
            <div class="expanded-location-box">
                <div class="expanded-city-selector ${isCitySearchOpen ? 'is-open' : ''}" id="expanded-city-selector-btn" title="Click to search & change city">
                    <span class="expanded-city-name">${locationTitle}</span>
                    <span class="material-symbols-outlined expanded-city-arrow">expand_more</span>
                </div>
                <span class="expanded-day-badge">${displayedDayKeys.length}-Day Forecast</span>
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
            ${mainCardInnerHtml}
        </div>

        <!-- Daily Selector Row -->
        <div class="gw-daily-row">
            ${dailyCardsHtml}
            ${actionCardHtml}
        </div>

        <!-- Planning Metrics Grid (Using Google Material Symbols) -->
        <div class="gw-metrics-grid">
            ${metricsGridInnerHtml}
        </div>

        <!-- Subtle Open-Meteo Attribution -->
        <div class="gw-attribution">
            Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>
        </div>
    `;

    // Inlined animated SVGs are focused on Hero header and Alert pill only
    const heroHeader = panel.querySelector('.gw-hero-header');
    if (heroHeader) inlineWeatherSvgs(heroHeader);
    const alertPill = panel.querySelector('.gw-alert-pill');
    if (alertPill) inlineWeatherSvgs(alertPill);

    // Restore daily row scroll position if it existed
    const newDailyRow = panel.querySelector('.gw-daily-row');
    if (newDailyRow && prevDailyScroll !== undefined && prevDailyScroll > 0) {
        newDailyRow.scrollLeft = prevDailyScroll;
    }

    scrollHourlyStripToNow(panel);

    // Wire close button
    const closeBtn = panel.querySelector('#expanded-panel-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeWeatherExpandedPanel);

    // Wire city selector button
    const citySelectorBtn = panel.querySelector('#expanded-city-selector-btn');
    if (citySelectorBtn) {
        citySelectorBtn.addEventListener('click', () => {
            isCitySearchOpen = !isCitySearchOpen;
            renderExpandedForecast();
            if (isCitySearchOpen) {
                panel.scrollTo({ top: 0, behavior: 'smooth' });
            }
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
            // Render recent searches synchronously to avoid layout shift
            renderRecentSearches(resultsEl);

            setTimeout(() => {
                try {
                    searchInput.focus({ preventScroll: true });
                } catch (_) {
                    searchInput.focus();
                }
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
    const dayCards = panel.querySelectorAll('.gw-daily-card[data-day-key]');
    dayCards.forEach(card => {
        card.addEventListener('click', (e) => {
            const clickedKey = e.currentTarget.getAttribute('data-day-key');
            selectExpandedDay(clickedKey);
        });
    });

    // Wire 'More Days' trigger
    const moreBtn = panel.querySelector('#gw-daily-more-btn');
    if (moreBtn) {
        moreBtn.addEventListener('click', async () => {
            if (moreBtn.classList.contains('is-loading')) return;
            moreBtn.classList.add('is-loading');
            const circle = moreBtn.querySelector('.gw-daily-plus-circle');
            if (circle) {
                circle.innerHTML = `
                    <svg class="gw-daily-action-svg gw-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
                        <path d="M12 2 A 10 10 0 0 1 22 12"></path>
                    </svg>
                `;
            }

            try {
                isExtendedForecast = true;
                await fetchWeatherData(false, EXTENDED_FORECAST_DAYS);
                renderExpandedForecast();

                const dailyRow = panel.querySelector('.gw-daily-row');
                if (dailyRow) {
                    const cards = dailyRow.querySelectorAll('.gw-daily-card[data-day-key]');
                    if (cards.length > 7) {
                        cards[7].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
                    }
                }
            } catch (err) {
                console.error('Failed to extend weather forecast:', err);
                moreBtn.classList.remove('is-loading');
                if (circle) {
                    circle.innerHTML = `
                        <span class="material-symbols-outlined gw-daily-action-icon">arrow_forward_ios</span>
                    `;
                }
            }
        });
    }
}
