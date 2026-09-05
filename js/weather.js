

async function getWeather() {
    const apiKey = '65818745c3aa4eed20b6eb5ce62c9c79';
    const lat = 43.4516; // Latitude for Kitchener
    const lon = -80.4925; // Longitude for Kitchener
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

    try {
        const response = await fetch(url);
        const data = await response.json();

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

        // Fetch daily forecast outlook non-blockingly
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
    if (sessionStorage.getItem('weather-outlook-dismissed') === 'true') {
        outlookBar.style.display = 'none';
        return;
    }

    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

    try {
        const response = await fetch(forecastUrl);
        const forecast = await response.json();

        if (!forecast || !forecast.list || !forecast.list.length) return;

        // Determine current date in Kitchener (America/Toronto)
        const now = new Date();
        const localDateStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Toronto',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(now); // "YYYY-MM-DD"

        // Filter upcoming forecast slots for today
        const todaySlots = forecast.list.filter(item => {
            const slotDate = new Date(item.dt * 1000);
            const slotDateStr = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'America/Toronto',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(slotDate);
            return slotDateStr === localDateStr;
        });

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

