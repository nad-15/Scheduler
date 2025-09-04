

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
