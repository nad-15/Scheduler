

let cachedWeatherData = null;
let cachedForecastData = null;
let forecastFetchPromise = null;
let isExpandedPanelInitialized = false;
let selectedDayKey = null;

const KITCHENER_API_KEY = '65818745c3aa4eed20b6eb5ce62c9c79';
const KITCHENER_LAT = 43.4516; // Latitude for Kitchener
const KITCHENER_LON = -80.4925; // Longitude for Kitchener

/**
 * Robust date key formatted in America/Toronto timezone (YYYY-MM-DD)
 */
function getTorontoDateKey(dateOrEpochSec) {
    const d = typeof dateOrEpochSec === 'number' ? new Date(dateOrEpochSec * 1000) : dateOrEpochSec;
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Toronto',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(d);
    let y = '', m = '', day = '';
    for (const p of parts) {
        if (p.type === 'year') y = p.value;
        if (p.type === 'month') m = p.value;
        if (p.type === 'day') day = p.value;
    }
    return `${y}-${m}-${day}`;
}

/**
 * Fetches and caches the 5-day / 3-hour forecast for Kitchener.
 * Independent of companion bar dismissal so the expanded dashboard always has data.
 */
async function fetchForecastData(lat = KITCHENER_LAT, lon = KITCHENER_LON, apiKey = KITCHENER_API_KEY) {
    if (cachedForecastData && cachedForecastData.list && cachedForecastData.list.length) {
        return cachedForecastData;
    }
    if (forecastFetchPromise) return forecastFetchPromise;

    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    forecastFetchPromise = (async () => {
        try {
            const response = await fetch(forecastUrl);
            const data = await response.json();
            if (data && data.list && data.list.length) {
                cachedForecastData = data;
                // If expanded dashboard is already open, re-render immediately with full timeline
                const panel = document.getElementById('weather-expanded-panel');
                if (panel && panel.classList.contains('active')) {
                    renderExpandedForecast();
                }
                return data;
            }
        } catch (err) {
            console.warn('Unable to load forecast data:', err);
        } finally {
            forecastFetchPromise = null;
        }
        return null;
    })();

    return forecastFetchPromise;
}

async function getWeather() {
    const apiKey = KITCHENER_API_KEY;
    const lat = KITCHENER_LAT;
    const lon = KITCHENER_LON;
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        cachedWeatherData = data;
        initWeatherExpandedPanel();

        const temperature = data.main.temp.toFixed(1); // Temperature in Celsius (rounded to 1 decimal)
        let weatherDescription = data.weather[0].description;
        const iconCode = data.weather[0].icon;
        const iconUrl = `https://openweathermap.org/img/wn/${iconCode}.png`;

        // Capitalize first letter and add period
        weatherDescription = weatherDescription.charAt(0).toUpperCase() + weatherDescription.slice(1) + ".";

        function updateTime() {
            const today = new Date();
            const options = { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit', 
                hour12: true,  
                timeZone: 'America/Toronto' 
            };

            const formatter = new Intl.DateTimeFormat('en-US', options);
            const parts = formatter.formatToParts(today);

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

            // Update the DOM
            document.getElementById('today-name').innerHTML = `
                <div class="time-container">
                
                    <div id="today-location">Kitchener, ON</div>
                    <div id="today-date">${monthDay}, ${year}</div>
                    <div id="today-time">
                        <span id="today-hour-minute">${hour}:${minute}</span>
                    </div>
                <span id="today-seconds">:${second} ${ampm}</span>
                </div>

                <div class="weather-container">
                    <div id="today-icon">
                         <img src="${iconUrl}" alt="W.icon" onerror="this.onerror=null; this.src='https://fonts.gstatic.com/s/i/materialicons/umbrella/v1/24px.svg';">
                    </div>
                    <div id="today-temp">${temperature}°</div>
                    <div id="today-weather">${weatherDescription}</div>
                </div>
            `;
        }

        updateTime();
        setInterval(updateTime, 1000);

        // Fetch forecast data and companion bar non-blockingly
        fetchForecastData(lat, lon, apiKey);
        getWeatherOutlook(lat, lon, apiKey, data);

    } catch (error) {
    console.error('Error fetching weather data:', error);

    // Fallback content so the widget exists
    const todayName = document.getElementById('today-name');
    if (todayName) {
        todayName.innerHTML = `
            <div class="time-container">
                <div id="today-location">Kitchener, ON</div>
                <div id="today-date">--, ----</div>
                <div id="today-time">
                    <span id="today-hour-minute">--:--</span>
                </div>
                <span id="today-seconds">:-- --</span>
            </div>

            <div class="weather-container">
                <div id="today-icon">
                    <img src="https://fonts.gstatic.com/s/i/materialicons/umbrella/v1/24px.svg" alt="W.icon">
                </div>
                <div id="today-temp">--°</div>
                <div id="today-weather">Weather unavailable</div>
            </div>
        `;
    }
}

}

/**
 * Weather Outlook Companion Bar (Smart Daily Forecast)
 * Fetches 5-day / 3-hour forecast, calculates High/Low, and detects upcoming rain/snow.
 */
async function getWeatherOutlook(lat, lon, apiKey, currentData) {
    const outlookBar = document.getElementById('weather-outlook-bar');
    if (!outlookBar) return;

    // Check if dismissed in this session
    const isDismissed = sessionStorage.getItem('weather-outlook-dismissed') === 'true';
    if (isDismissed) {
        outlookBar.style.display = 'none';
    }

    try {
        const forecast = await fetchForecastData(lat, lon, apiKey);
        if (!forecast || !forecast.list || !forecast.list.length) return;

        // If dismissed, keep bar hidden, but forecast data is safely cached!
        if (isDismissed) return;

        // Determine current date in Kitchener (America/Toronto)
        const now = new Date();
        const localDateStr = getTorontoDateKey(now);

        // Filter upcoming forecast slots for today
        const todaySlots = forecast.list.filter(item => getTorontoDateKey(item.dt) === localDateStr);

        // Use today's slots if at least 2 remaining, or next 6 slots (~18h ahead)
        const upcomingSlots = todaySlots.length >= 2 ? todaySlots : forecast.list.slice(0, 6);

        // Compute High and Low temps
        const currentTemp = currentData && currentData.main && typeof currentData.main.temp === 'number'
            ? currentData.main.temp
            : null;

        const allTemps = upcomingSlots.map(s => s.main.temp);
        if (currentTemp !== null) allTemps.push(currentTemp);

        const highTemp = Math.round(Math.max(...allTemps));
        const lowTemp = Math.round(Math.min(...allTemps));

        // Evaluate Weather Alert Priority:
        // 1. Snow / Sleet
        // 2. Thunderstorm
        // 3. Rain / Drizzle
        // 4. Freezing temperature warning (if low <= 0)
        // 5. High wind gusts (>= 38 km/h)
        // 6. Fog / Low visibility (< 3000m or mist/fog)
        // 7. Clear / Dry conditions

        let alertType = '';
        let alertIcon = '';
        let alertText = '';
        let isPulse = false;

        outlookBar.classList.remove('has-rain', 'has-snow', 'has-freeze', 'has-wind', 'has-fog');

        // Check for Precipitation first (highest daily impact)
        for (const slot of upcomingSlots) {
            const mainWeather = (slot.weather && slot.weather[0] ? slot.weather[0].main : '').toLowerCase();
            const desc = (slot.weather && slot.weather[0] ? slot.weather[0].description : '').toLowerCase();
            const pop = slot.pop || 0;

            const slotDate = new Date(slot.dt * 1000);
            const slotTimeStr = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Toronto',
                hour: 'numeric',
                hour12: true
            }).format(slotDate);

            if (mainWeather.includes('snow') || desc.includes('snow')) {
                const popPercent = Math.round(pop * 100) || 60;
                alertType = 'snow';
                alertIcon = '❄️';
                alertText = `Snow at ${slotTimeStr} (${popPercent}%)`;
                isPulse = true;
                outlookBar.classList.add('has-snow');
                break;
            } else if (mainWeather.includes('thunder') || desc.includes('thunder')) {
                const popPercent = Math.round(pop * 100) || 60;
                alertType = 'storm';
                alertIcon = '⛈️';
                alertText = `Storm at ${slotTimeStr} (${popPercent}%)`;
                isPulse = true;
                outlookBar.classList.add('has-rain');
                break;
            } else if (mainWeather.includes('rain') || mainWeather.includes('drizzle') || desc.includes('rain') || pop >= 0.3) {
                const popPercent = Math.round((pop || 0.4) * 100);
                alertType = 'rain';
                alertIcon = '🌧️';
                alertText = `Rain at ${slotTimeStr} (${popPercent}%)`;
                isPulse = true;
                outlookBar.classList.add('has-rain');
                break;
            }
        }

        // If no rain/snow, check for Freeze / Frost warning
        // (Triggers when daytime is above freezing but overnight drops to or below 0°C, or extreme cold <= -15°C)
        if (!alertType && (lowTemp <= -15 || (lowTemp <= 0 && highTemp > 3))) {
            alertType = 'freeze';
            alertIcon = lowTemp <= -15 ? '🥶' : '🧊';
            alertText = lowTemp <= -15 ? `Extreme cold: Low ${lowTemp}°` : (lowTemp < 0 ? `Freeze alert: Low ${lowTemp}°` : `Frost alert: Low 0°`);
            outlookBar.classList.add('has-freeze');
        }

        // If no alert yet, check for High Wind / Gusts (>= 38 km/h)
        if (!alertType) {
            let maxGustKmh = 0;
            for (const slot of upcomingSlots) {
                const gustMps = slot.wind ? (slot.wind.gust || slot.wind.speed || 0) : 0;
                const gustKmh = Math.round(gustMps * 3.6);
                if (gustKmh >= 38 && gustKmh > maxGustKmh) {
                    maxGustKmh = gustKmh;
                }
            }
            if (maxGustKmh >= 38) {
                alertType = 'wind';
                alertIcon = '💨';
                alertText = `Gusts up to ${maxGustKmh} km/h`;
                outlookBar.classList.add('has-wind');
            }
        }

        // If no alert yet, check for Fog / Low Visibility (< 3000m)
        if (!alertType) {
            for (const slot of upcomingSlots) {
                const mainWeather = (slot.weather && slot.weather[0] ? slot.weather[0].main : '').toLowerCase();
                const desc = (slot.weather && slot.weather[0] ? slot.weather[0].description : '').toLowerCase();
                const vis = typeof slot.visibility === 'number' ? slot.visibility : 10000;
                if (mainWeather.includes('fog') || desc.includes('fog') || mainWeather.includes('mist') || vis < 3000) {
                    alertType = 'fog';
                    alertIcon = '🌫️';
                    alertText = `Fog / low visibility`;
                    outlookBar.classList.add('has-fog');
                    break;
                }
            }
        }

        // Default: Clear / Dry outlook (Temperature-aware: snow when cold, rain when warm)
        if (!alertType) {
            alertType = 'clear';
            alertIcon = '☀️';
            const isColdSeason = (currentTemp !== null && currentTemp <= 3) || (highTemp <= 3);
            alertText = isColdSeason ? `No snow expected` : `No rain expected`;
        }

        const feelsLike = currentData && currentData.main && typeof currentData.main.feels_like === 'number'
            ? Math.round(currentData.main.feels_like)
            : null;

        // Contextual Sub-Info (Option A: "Golden Hours" Model)
        // 1. Morning (4:00 AM – 9:00 AM): Show Sunrise (dawn, waking up, morning commute)
        // 2. Midday (9:00 AM – 4:30 PM): Show Feels Like (peak daily activity & outdoor comfort)
        // 3. Evening (4:30 PM – 9:00 PM): Show Sunset (dusk, winding down, evening plans)
        // 4. Night (9:00 PM – 4:00 AM): Show Feels Like (late night chill / sleep comfort)
        const localHour = parseInt(new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Toronto',
            hour: 'numeric',
            hour12: false
        }).format(now), 10);
        const localMin = parseInt(new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Toronto',
            minute: 'numeric'
        }).format(now), 10);
        const currentDecHour = localHour + (localMin / 60);

        const sunriseUnix = (currentData && currentData.sys && currentData.sys.sunrise) ||
                            (forecast && forecast.city && forecast.city.sunrise) || null;
        const sunsetUnix = (currentData && currentData.sys && currentData.sys.sunset) ||
                           (forecast && forecast.city && forecast.city.sunset) || null;

        let sunriseStr = '';
        if (sunriseUnix) {
            const sunriseDate = new Date(sunriseUnix * 1000);
            const timeStr = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Toronto',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            }).format(sunriseDate);
            sunriseStr = `Sunrise ${timeStr}`;
        }

        let sunsetStr = '';
        if (sunsetUnix) {
            const sunsetDate = new Date(sunsetUnix * 1000);
            const timeStr = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Toronto',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            }).format(sunsetDate);
            sunsetStr = `Sunset ${timeStr}`;
        }

        let extraHtml = '';
        if (currentDecHour >= 4.0 && currentDecHour < 9.0) {
            // Morning Golden Hours (4 AM – 9 AM)
            extraHtml = sunriseStr || (feelsLike !== null ? `Feels ${feelsLike}°` : '');
        } else if (currentDecHour >= 16.5 && currentDecHour < 21.0) {
            // Evening Golden Hours (4:30 PM – 9 PM)
            extraHtml = sunsetStr || (feelsLike !== null ? `Feels ${feelsLike}°` : '');
        } else {
            // Midday & Late Night: Feels Like (with fallback to available sun time)
            extraHtml = feelsLike !== null ? `Feels ${feelsLike}°` : (sunsetStr || sunriseStr || '');
        }

        const primaryHtml = `<span class="outlook-icon ${isPulse ? 'pulse' : ''}">${alertIcon}</span> <span class="outlook-status">${alertText}</span>`;

        outlookBar.innerHTML = `
            <div class="outlook-header">
                <div class="outlook-main-info">
                    ${primaryHtml}
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

        // Position dynamically directly below #today-name and lock to its exact width
        const alignPosition = () => {
            const todayName = document.getElementById('today-name');
            if (todayName && outlookBar) {
                const rect = todayName.getBoundingClientRect();
                if (rect.height > 0) {
                    outlookBar.style.top = `${rect.bottom + 6}px`;
                }
                if (rect.width > 0) {
                    outlookBar.style.width = `${rect.width}px`;
                }
            }
        };

        alignPosition();
        window.addEventListener('resize', alignPosition);
        setTimeout(alignPosition, 150);
        setTimeout(alignPosition, 600);

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

        // Clicking the outlook bar (except dismiss button) opens the full expanded dashboard!
        outlookBar.addEventListener('click', (e) => {
            if (e.target.closest('#close-weather-outlook')) return;
            openWeatherExpandedPanel();
        });

        // Keep synced with todayName's sliding and display state
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

        // Check startup state after short tick
        setTimeout(syncVisibility, 50);
        setTimeout(syncVisibility, 250);

        if (hideWidgetBtn) {
            hideWidgetBtn.addEventListener('click', () => {
                setTimeout(syncVisibility, 20);
            });
        }

        const hideAllBtn = document.querySelector('.hide-all-buttons');
        if (hideAllBtn) {
            hideAllBtn.addEventListener('click', () => {
                setTimeout(syncVisibility, 20);
            });
        }

    } catch (err) {
        console.warn('Unable to load weather forecast outlook:', err);
    }
}

/**
 * ==========================================================================
 * Expanded Weather Dashboard (3-Hour Scrollable Timeline & Today/Tomorrow Tabs)
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
        if (e.key === 'Escape') {
            closeWeatherExpandedPanel();
        }
    });

    window.openWeatherExpandedPanel = openWeatherExpandedPanel;
    window.closeWeatherExpandedPanel = closeWeatherExpandedPanel;
    window.toggleWeatherExpandedPanel = toggleWeatherExpandedPanel;
}

function openWeatherExpandedPanel() {
    const panel = document.getElementById('weather-expanded-panel');
    const backdrop = document.getElementById('weather-expanded-backdrop');
    if (!panel || !backdrop) return;

    selectedDayKey = getTorontoDateKey(new Date());

    initWeatherExpandedPanel();
    renderExpandedForecast();

    // If forecast data isn't loaded yet, fetch and re-render
    if (!cachedForecastData) {
        fetchForecastData().then(() => {
            renderExpandedForecast();
        });
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

// Expose window functions immediately
window.openWeatherExpandedPanel = openWeatherExpandedPanel;
window.closeWeatherExpandedPanel = closeWeatherExpandedPanel;
window.toggleWeatherExpandedPanel = toggleWeatherExpandedPanel;

/**
 * Maps OpenWeatherMap icon codes to beautiful Meteocons Fill SVGs
 */
function getMeteoconUrl(iconCode) {
    if (!iconCode) return 'https://cdn.jsdelivr.net/npm/@meteocons/svg/fill/clear-day.svg';
    const cleanCode = String(iconCode).trim().toLowerCase();
    const map = {
        '01d': 'clear-day',
        '01n': 'clear-night',
        '02d': 'partly-cloudy-day',
        '02n': 'partly-cloudy-night',
        '03d': 'cloudy',
        '03n': 'cloudy',
        '04d': 'overcast-day',
        '04n': 'overcast-night',
        '09d': 'drizzle',
        '09n': 'drizzle',
        '10d': 'rain',
        '10n': 'rain',
        '11d': 'thunderstorms-rain',
        '11n': 'thunderstorms-rain',
        '13d': 'snow',
        '13n': 'snow',
        '50d': 'fog-day',
        '50n': 'fog-night'
    };
    const name = map[cleanCode] || (cleanCode.endsWith('n') ? 'clear-night' : 'clear-day');
    return `https://cdn.jsdelivr.net/npm/@meteocons/svg/fill/${name}.svg`;
}

/**
 * Calculates solar sunrise and sunset in UTC decimal hours for any date and location
 * based on the standard NOAA Solar Calculation algorithm.
 */
function calculateSunTimes(date, lat = KITCHENER_LAT, lon = KITCHENER_LON) {
    const rad = Math.PI / 180;
    const deg = 180 / Math.PI;

    const startOfYear = new Date(Date.UTC(date.getFullYear(), 0, 1));
    const dayOfYear = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000)) + 1;
    const lngHour = lon / 15;

    function calcTime(isSunrise) {
        const t = dayOfYear + ((isSunrise ? 6 : 18) - lngHour) / 24;
        const M = (0.9856 * t) - 3.289;
        let L = M + (1.916 * Math.sin(M * rad)) + (0.020 * Math.sin(2 * M * rad)) + 282.634;
        L = (L + 360) % 360;

        let RA = deg * Math.atan(0.91764 * Math.tan(L * rad));
        RA = (RA + 360) % 360;

        const Lquadrant = Math.floor(L / 90) * 90;
        const RAquadrant = Math.floor(RA / 90) * 90;
        RA = (RA + (Lquadrant - RAquadrant)) / 15;

        const sinDec = 0.39782 * Math.sin(L * rad);
        const cosDec = Math.cos(Math.asin(sinDec));

        // Zenith for official sunrise/sunset (90° 50')
        const cosH = (Math.cos(90.833 * rad) - (sinDec * Math.sin(lat * rad))) / (cosDec * Math.cos(lat * rad));
        if (cosH > 1 || cosH < -1) return null;

        const H = isSunrise ? (360 - deg * Math.acos(cosH)) / 15 : (deg * Math.acos(cosH)) / 15;
        const T = H + RA - (0.06571 * t) - 6.622;
        const UT = (T - lngHour + 24) % 24;
        return UT;
    }

    const sunriseUT = calcTime(true);
    const sunsetUT = calcTime(false);
    return { sunriseUT, sunsetUT };
}

function renderExpandedForecast() {
    const panel = document.getElementById('weather-expanded-panel');
    if (!panel) return;

    const now = new Date();
    const todayKey = getTorontoDateKey(now);

    if (!selectedDayKey) {
        selectedDayKey = todayKey;
    }

    // If forecast data is still loading, show clean loading state
    if (!cachedForecastData || !cachedForecastData.list || !cachedForecastData.list.length) {
        const tempVal = cachedWeatherData && cachedWeatherData.main ? `${Math.round(cachedWeatherData.main.temp)}°` : '--°';
        const condVal = cachedWeatherData && cachedWeatherData.weather && cachedWeatherData.weather[0] ? cachedWeatherData.weather[0].description : 'Loading weather...';
        const iconCode = cachedWeatherData && cachedWeatherData.weather && cachedWeatherData.weather[0] ? cachedWeatherData.weather[0].icon : '01d';
        const meteoUrl = getMeteoconUrl(iconCode);

        panel.innerHTML = `
            <div class="expanded-header-row">
                <div class="expanded-location-box">
                    <span class="expanded-city-name">Kitchener, ON</span>
                    <span class="expanded-day-badge">5-Day Forecast</span>
                </div>
                <div class="expanded-controls-box">
                    <button class="expanded-panel-close" id="expanded-panel-close-btn" title="Close" aria-label="Close dashboard">✕</button>
                </div>
            </div>

            <div class="gw-main-card">
                <div class="gw-hero-header">
                    <div class="gw-hero-left">
                        <span class="gw-hero-day">Now</span>
                        <div class="gw-hero-temp-row">
                            <span class="gw-hero-temp">${tempVal}</span>
                            <img class="gw-hero-icon" src="${meteoUrl}" alt="weather icon" onerror="this.onerror=null; this.src='https://openweathermap.org/img/wn/${iconCode}.png';">
                        </div>
                    </div>
                    <div class="gw-hero-right">
                        <span class="gw-hero-condition">${condVal}</span>
                        <span class="gw-hero-sub">H: --° • L: --°</span>
                    </div>
                </div>
                <div class="expanded-loading-state">
                    <div class="expanded-spinner"></div>
                    <span>Loading forecast details...</span>
                </div>
            </div>
        `;

        const closeBtn = panel.querySelector('#expanded-panel-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', closeWeatherExpandedPanel);
        return;
    }

    const forecastList = cachedForecastData.list;

    // 1. Group all 40 slots into calendar day buckets
    const dayGroupsMap = new Map();
    forecastList.forEach(slot => {
        const key = getTorontoDateKey(slot.dt);
        if (!dayGroupsMap.has(key)) {
            dayGroupsMap.set(key, []);
        }
        dayGroupsMap.get(key).push(slot);
    });

    if (!dayGroupsMap.has(selectedDayKey)) {
        selectedDayKey = dayGroupsMap.has(todayKey) ? todayKey : Array.from(dayGroupsMap.keys())[0];
    }

    // 2. Build Daily Summaries for the Daily Selector Row
    const daySummaries = [];
    for (const [key, slots] of dayGroupsMap.entries()) {
        const isToday = key === todayKey;
        const sDate = new Date(slots[0].dt * 1000);
        const dayShortName = isToday ? 'Today' : new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', weekday: 'short' }).format(sDate);
        const fullDayLabel = isToday ? 'Now' : new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', weekday: 'short', month: 'short', day: 'numeric' }).format(sDate);

        const allTemps = slots.map(s => s.main.temp);
        if (isToday && cachedWeatherData && cachedWeatherData.main && typeof cachedWeatherData.main.temp === 'number') {
            allTemps.push(cachedWeatherData.main.temp);
        }
        const highTemp = Math.round(Math.max(...allTemps));
        const lowTemp = Math.round(Math.min(...allTemps));

        const middaySlot = slots.find(s => s.dt_txt.includes('15:00:00') || s.dt_txt.includes('12:00:00')) || slots[Math.floor(slots.length / 2)] || slots[0];
        const iconCode = middaySlot.weather && middaySlot.weather[0] ? middaySlot.weather[0].icon : '01d';
        const conditionDesc = middaySlot.weather && middaySlot.weather[0] ? middaySlot.weather[0].description : 'Clear';
        const mainDesc = middaySlot.weather && middaySlot.weather[0] ? middaySlot.weather[0].main : 'Clear';

        daySummaries.push({
            key,
            isToday,
            dayShortName,
            fullDayLabel,
            highTemp,
            lowTemp,
            iconCode,
            conditionDesc: conditionDesc.charAt(0).toUpperCase() + conditionDesc.slice(1),
            mainDesc,
            slots
        });
    }

    // Active Selected Day
    const activeSummary = daySummaries.find(d => d.key === selectedDayKey) || daySummaries[0];
    const isTodayActive = activeSummary.isToday;

    // 3. Hero Card details for Active Selected Day
    let heroLabel = isTodayActive ? 'Now' : activeSummary.fullDayLabel;
    let heroTemp = isTodayActive && cachedWeatherData && cachedWeatherData.main 
        ? `${Math.round(cachedWeatherData.main.temp)}°` 
        : `${activeSummary.highTemp}°`;
    let heroCondition = isTodayActive && cachedWeatherData && cachedWeatherData.weather && cachedWeatherData.weather[0]
        ? cachedWeatherData.weather[0].description
        : activeSummary.conditionDesc;
    heroCondition = heroCondition.charAt(0).toUpperCase() + heroCondition.slice(1);
    let heroIconCode = isTodayActive && cachedWeatherData && cachedWeatherData.weather && cachedWeatherData.weather[0]
        ? cachedWeatherData.weather[0].icon
        : activeSummary.iconCode;
    let heroMeteoUrl = getMeteoconUrl(heroIconCode);

    let heroSub = isTodayActive && cachedWeatherData && cachedWeatherData.main && typeof cachedWeatherData.main.feels_like === 'number'
        ? `Feels like ${Math.round(cachedWeatherData.main.feels_like)}°`
        : `H: ${activeSummary.highTemp}° • L: ${activeSummary.lowTemp}°`;

    // Alert Banner for active day
    let alertBannerHtml = '';
    for (const slot of activeSummary.slots) {
        const mainW = (slot.weather && slot.weather[0] ? slot.weather[0].main : '').toLowerCase();
        const descW = (slot.weather && slot.weather[0] ? slot.weather[0].description : '').toLowerCase();
        const pop = slot.pop || 0;
        const slotDate = new Date(slot.dt * 1000);
        const timeStr = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Toronto',
            hour: 'numeric',
            hour12: true
        }).format(slotDate);

        if (mainW.includes('snow') || descW.includes('snow')) {
            alertBannerHtml = `<div class="gw-alert-pill is-alert">❄️ Snow expected at ${timeStr} (${Math.round(pop * 100)}%)</div>`;
            break;
        } else if (mainW.includes('thunder') || descW.includes('thunder')) {
            alertBannerHtml = `<div class="gw-alert-pill is-alert">⛈️ Thunderstorm advisory at ${timeStr} (${Math.round(pop * 100)}%)</div>`;
            break;
        } else if (mainW.includes('rain') || mainW.includes('drizzle') || descW.includes('rain') || pop >= 0.3) {
            const vol = slot.rain && slot.rain['3h'] ? ` • ~${slot.rain['3h']} mm` : '';
            alertBannerHtml = `<div class="gw-alert-pill is-alert">🌧️ Rain expected at ${timeStr} (${Math.round(pop * 100)}%)${vol}</div>`;
            break;
        }
    }

    if (!alertBannerHtml) {
        if (activeSummary.lowTemp <= 0 && activeSummary.highTemp > 3) {
            alertBannerHtml = `<div class="gw-alert-pill">🧊 Overnight frost warning: Low ${activeSummary.lowTemp}°</div>`;
        } else if (activeSummary.lowTemp <= 3) {
            alertBannerHtml = `<div class="gw-alert-pill">☀️ Dry conditions • No snow expected</div>`;
        } else {
            alertBannerHtml = `<div class="gw-alert-pill">☀️ Dry & clear • No rain expected</div>`;
        }
    }

    // 4. Hourly Forecast Strip for Active Selected Day (Google Style Columns)
    let hourlyColumnsHtml = '';
    const currentMs = now.getTime();

    if (isTodayActive) {
        // First column is live "Now"
        const liveTemp = cachedWeatherData && cachedWeatherData.main ? Math.round(cachedWeatherData.main.temp) : activeSummary.highTemp;
        const liveIconCode = cachedWeatherData && cachedWeatherData.weather && cachedWeatherData.weather[0] ? cachedWeatherData.weather[0].icon : '01d';
        const liveMeteo = getMeteoconUrl(liveIconCode);
        const liveMain = (cachedWeatherData?.weather?.[0]?.main || '').toLowerCase();
        const isRainingNow = liveMain.includes('rain') || liveMain.includes('snow') || liveMain.includes('drizzle');

        hourlyColumnsHtml += `
            <div class="gw-hourly-col is-now">
                <span class="gw-hourly-temp">${liveTemp}°</span>
                <span class="gw-hourly-pop ${isRainingNow ? '' : 'is-empty'}">${isRainingNow ? 'Now' : '&nbsp;'}</span>
                <img class="gw-hourly-icon" src="${liveMeteo}" alt="icon" onerror="this.onerror=null; this.src='https://openweathermap.org/img/wn/${liveIconCode}.png';">
                <span class="gw-hourly-time">Now</span>
            </div>
        `;

        // Future upcoming slots for today
        const upcomingToday = activeSummary.slots.filter(s => (s.dt * 1000) > (currentMs + 20 * 60 * 1000));
        upcomingToday.forEach(slot => {
            const sDate = new Date(slot.dt * 1000);
            const timeLabel = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Toronto',
                hour: 'numeric',
                hour12: true
            }).format(sDate);
            const sTemp = Math.round(slot.main.temp);
            const sIcon = slot.weather && slot.weather[0] ? slot.weather[0].icon : '01d';
            const sMeteo = getMeteoconUrl(sIcon);
            const popVal = Math.round((slot.pop || 0) * 100);

            hourlyColumnsHtml += `
                <div class="gw-hourly-col">
                    <span class="gw-hourly-temp">${sTemp}°</span>
                    <span class="gw-hourly-pop ${popVal >= 20 ? '' : 'is-empty'}">${popVal >= 20 ? `${popVal}%` : '&nbsp;'}</span>
                    <img class="gw-hourly-icon" src="${sMeteo}" alt="icon" onerror="this.onerror=null; this.src='https://openweathermap.org/img/wn/${sIcon}.png';">
                    <span class="gw-hourly-time">${timeLabel}</span>
                </div>
            `;
        });
    } else {
        // Future day: render all 8 slots for that day
        activeSummary.slots.forEach(slot => {
            const sDate = new Date(slot.dt * 1000);
            const timeLabel = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Toronto',
                hour: 'numeric',
                hour12: true
            }).format(sDate);
            const sTemp = Math.round(slot.main.temp);
            const sIcon = slot.weather && slot.weather[0] ? slot.weather[0].icon : '01d';
            const sMeteo = getMeteoconUrl(sIcon);
            const popVal = Math.round((slot.pop || 0) * 100);

            hourlyColumnsHtml += `
                <div class="gw-hourly-col">
                    <span class="gw-hourly-temp">${sTemp}°</span>
                    <span class="gw-hourly-pop ${popVal >= 20 ? '' : 'is-empty'}">${popVal >= 20 ? `${popVal}%` : '&nbsp;'}</span>
                    <img class="gw-hourly-icon" src="${sMeteo}" alt="icon" onerror="this.onerror=null; this.src='https://openweathermap.org/img/wn/${sIcon}.png';">
                    <span class="gw-hourly-time">${timeLabel}</span>
                </div>
            `;
        });
    }


    // 5. Daily Selector Row (The 5 Day Cards)
    const dailyCardsHtml = daySummaries.map(day => {
        const isSelected = day.key === selectedDayKey;
        const meteoIcon = getMeteoconUrl(day.iconCode);
        return `
            <div class="gw-daily-card ${isSelected ? 'active' : ''}" data-day-key="${day.key}">
                <span class="gw-daily-name">${day.dayShortName}</span>
                <img class="gw-daily-icon" src="${meteoIcon}" alt="icon" onerror="this.onerror=null; this.src='https://openweathermap.org/img/wn/${day.iconCode}.png';">
                <span class="gw-daily-range">${day.highTemp}°/${day.lowTemp}°</span>
            </div>
        `;
    }).join('');

    // 6. Planning Metrics Grid for Active Selected Day
    const targetSlots = activeSummary.slots.length ? activeSummary.slots : forecastList.slice(0, 8);
    const maxPop = targetSlots.length ? Math.round(Math.max(...targetSlots.map(s => s.pop || 0)) * 100) : 0;
    let totalPrecipMm = 0;
    targetSlots.forEach(s => {
        if (s.rain && s.rain['3h']) totalPrecipMm += s.rain['3h'];
        if (s.snow && s.snow['3h']) totalPrecipMm += s.snow['3h'];
    });

    const maxGustMps = targetSlots.length ? Math.max(...targetSlots.map(s => (s.wind && (s.wind.gust || s.wind.speed)) || 0)) : 0;
    const maxGustKmh = Math.round(maxGustMps * 3.6);
    const avgWindKmh = Math.round(((targetSlots[0] && targetSlots[0].wind && targetSlots[0].wind.speed) || 2) * 3.6);

    const feelsLikeVal = (isTodayActive && cachedWeatherData && cachedWeatherData.main && typeof cachedWeatherData.main.feels_like === 'number')
        ? Math.round(cachedWeatherData.main.feels_like)
        : Math.round((targetSlots[0] && targetSlots[0].main && targetSlots[0].main.feels_like) || activeSummary.highTemp);

    const humidityVal = (isTodayActive && cachedWeatherData && cachedWeatherData.main && typeof cachedWeatherData.main.humidity === 'number')
        ? cachedWeatherData.main.humidity
        : Math.round((targetSlots[0] && targetSlots[0].main && targetSlots[0].main.humidity) || 65);

    const baseSunriseUnix = (cachedWeatherData && cachedWeatherData.sys && cachedWeatherData.sys.sunrise) ||
                            (cachedForecastData && cachedForecastData.city && cachedForecastData.city.sunrise) || null;
    const baseSunsetUnix = (cachedWeatherData && cachedWeatherData.sys && cachedWeatherData.sys.sunset) ||
                           (cachedForecastData && cachedForecastData.city && cachedForecastData.city.sunset) || null;

    let sunriseTimeStr = '--:--';
    let sunsetTimeStr = '--:--';

    if (isTodayActive && baseSunriseUnix && baseSunsetUnix) {
        sunriseTimeStr = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Toronto',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).format(new Date(baseSunriseUnix * 1000));

        sunsetTimeStr = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Toronto',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).format(new Date(baseSunsetUnix * 1000));
    } else {
        // Calculate exact astronomical solar sunrise/sunset for the active day
        const activeDate = activeSummary.slots.length ? new Date(activeSummary.slots[0].dt * 1000) : new Date();
        const sunCalc = calculateSunTimes(activeDate, KITCHENER_LAT, KITCHENER_LON);

        if (sunCalc && sunCalc.sunriseUT !== null && sunCalc.sunsetUT !== null) {
            const y = activeDate.getFullYear();
            const m = activeDate.getMonth();
            const d = activeDate.getDate();

            const riseHours = Math.floor(sunCalc.sunriseUT);
            const riseMinutes = Math.round((sunCalc.sunriseUT - riseHours) * 60);
            const riseDate = new Date(Date.UTC(y, m, d, riseHours, riseMinutes));

            const setHours = Math.floor(sunCalc.sunsetUT);
            const setMinutes = Math.round((sunCalc.sunsetUT - setHours) * 60);
            const setDate = new Date(Date.UTC(y, m, d, setHours, setMinutes));

            sunriseTimeStr = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Toronto',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            }).format(riseDate);

            sunsetTimeStr = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Toronto',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            }).format(setDate);
        } else if (baseSunriseUnix && baseSunsetUnix) {
            sunriseTimeStr = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Toronto',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            }).format(new Date(baseSunriseUnix * 1000));

            sunsetTimeStr = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Toronto',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            }).format(new Date(baseSunsetUnix * 1000));
        }
    }

    // Swap Daylight display order after 12 noon for Today only (Morning = Sunrise above; Afternoon/Evening = Sunset above)
    const torontoHour = parseInt(new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Toronto',
        hour: 'numeric',
        hour12: false
    }).format(now), 10);

    const isAfterNoonToday = isTodayActive && torontoHour >= 12;
    const daylightPrimary = isAfterNoonToday ? `Set ${sunsetTimeStr}` : `Rise ${sunriseTimeStr}`;
    const daylightSecondary = isAfterNoonToday ? `Rise ${sunriseTimeStr}` : `Set ${sunsetTimeStr}`;

    panel.innerHTML = `
        <div class="expanded-header-row">
            <div class="expanded-location-box">
                <span class="expanded-city-name">Kitchener, ON</span>
                <span class="expanded-day-badge">5-Day Forecast</span>
            </div>
            <div class="expanded-controls-box">
                <button class="expanded-panel-close" id="expanded-panel-close-btn" title="Close" aria-label="Close dashboard">✕</button>
            </div>
        </div>

        <!-- The Big Main Card (Selected Day Overview & Hourly Strip) -->
        <div class="gw-main-card">
            <div class="gw-hero-header">
                <div class="gw-hero-left">
                    <span class="gw-hero-day">${heroLabel}</span>
                    <div class="gw-hero-temp-row">
                        <span class="gw-hero-temp">${heroTemp}</span>
                        <img class="gw-hero-icon" src="${heroMeteoUrl}" alt="weather icon" onerror="this.onerror=null; this.src='https://openweathermap.org/img/wn/${heroIconCode}.png';">
                    </div>
                </div>
                <div class="gw-hero-right">
                    <span class="gw-hero-condition">${heroCondition}</span>
                    <span class="gw-hero-sub">${heroSub}</span>
                </div>
            </div>

            ${alertBannerHtml}

            <!-- Hourly Forecast Strip for Selected Day -->
            <div class="gw-hourly-scroll">
                ${hourlyColumnsHtml}
            </div>
        </div>

        <!-- Daily Selector Row (The Days Below the Big Card) -->
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
                <span class="gw-metric-sub">${totalPrecipMm > 0 ? `Est: ${totalPrecipMm.toFixed(1)} mm` : 'No accumulation'}</span>
            </div>
            <div class="gw-metric-card">
                <span class="gw-metric-header">
                    <span class="material-symbols-outlined gw-metric-icon">air</span>
                    Wind & Gusts
                </span>
                <span class="gw-metric-val">${avgWindKmh} km/h</span>
                <span class="gw-metric-sub">Gusts: ${maxGustKmh} km/h</span>
            </div>
            <div class="gw-metric-card">
                <span class="gw-metric-header">
                    <span class="material-symbols-outlined gw-metric-icon">thermostat</span>
                    Feels Like
                </span>
                <span class="gw-metric-val">${feelsLikeVal}°</span>
                <span class="gw-metric-sub">Humidity: ${humidityVal}%</span>
            </div>
            <div class="gw-metric-card">
                <span class="gw-metric-header">
                    <span class="material-symbols-outlined gw-metric-icon">wb_sunny</span>
                    Dawn & Dusk
                </span>
                <span class="gw-metric-val">${daylightPrimary}</span>
                <span class="gw-metric-sub">${daylightSecondary}</span>
            </div>
        </div>
    `;

    // Wire close button
    const closeBtn = panel.querySelector('#expanded-panel-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeWeatherExpandedPanel);
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

