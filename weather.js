async function getWeather() {
    const apiKey = '65818745c3aa4eed20b6eb5ce62c9c79';
    const lat = 43.4516; // Latitude for Kitchener
    const lon = -80.4925; // Longitude for Kitchener
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        const temperature = data.main.temp;  // Temperature in Celsius
        const weatherDescription = data.weather[0].description;  // Weather condition (e.g. "rain", "snow", "clear sky")
        const iconCode = data.weather[0].icon;  // Weather icon code
        const iconUrl = `http://openweathermap.org/img/wn/${iconCode}.png`;  // URL for the weather icon

        // Function to update the current time using Toronto timezone
        function updateTime() {
            const today = new Date();

            // Set the date and year to Toronto timezone
            const timeOptions = {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,  
                timeZone: 'America/Toronto',  // Toronto timezone
            };

            // Format the time, date, and year to match the Toronto timezone
            const formattedDate = new Intl.DateTimeFormat('en-US', timeOptions).format(today);

            // Split the formatted string into its components
            const [monthDay, year, time] = formattedDate.split(', ');

            // Update the DOM with the correct information
            const todayNameContainer = document.getElementById('today-name');
            todayNameContainer.innerHTML = `
                <div id="today-location">Kitchener, CA</div>
                <div id="today-temp">${temperature}°C</div>
                <div id="today-weather">${weatherDescription}</div>  <!-- Weather description -->
                <div id="today-date">${monthDay}, ${year}</div>
                <div id="today-time">${time}</div>
                <div id="today-icon">
                    <img src="${iconUrl}" alt="Weather icon">
                </div>
            `;
        }

        // Call updateTime immediately to show the current time and refresh every second
        updateTime();
        setInterval(updateTime, 1000);  // Refresh every second

    } catch (error) {
        console.error('Error fetching weather data:', error);

        function updateTime() {
            const today = new Date();

            // Set the date and year to Toronto timezone
            const timeOptions = {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,  
                timeZone: 'America/Toronto',  // Toronto timezone
            };

            // Format the time, date, and year to match the Toronto timezone
            const formattedDate = new Intl.DateTimeFormat('en-US', timeOptions).format(today);

            // Split the formatted string into its components
            const [monthDay, year, time] = formattedDate.split(', ');

            // Update the DOM with the correct information
            const todayNameContainer = document.getElementById('today-name');
            todayNameContainer.innerHTML = `
                <div id="today-location">Kitchener, CA</div>
                <div id="today-date">${monthDay}, ${year}</div>
                <div id="today-time">${time}</div>
            `;
        }

        // Call updateTime immediately to show the current time and refresh every second
        updateTime();
        setInterval(updateTime, 1000); 
    }
}
