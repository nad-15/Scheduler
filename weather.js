async function getWeather() {
    const apiKey = '65818745c3aa4eed20b6eb5ce62c9c79';
    const lat = 43.4516; // Latitude for Kitchener
    const lon = -80.4925; // Longitude for Kitchener
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        const temperature = data.main.temp;  // Temperature in Celsius

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
                hour12: false,  // 24-hour format
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
                <div id="today-date">${monthDay}, ${year}</div>
                <div id="today-time">${time}</div>
            `;
        }

        // Call updateTime immediately to show the current time and refresh every second
        updateTime();
        setInterval(updateTime, 1000);  // Refresh every second

    } catch (error) {
        console.error('Error fetching weather data:', error);
    }
}
