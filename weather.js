async function getWeather() {
    const apiKey = '65818745c3aa4eed20b6eb5ce62c9c79';
    const lat = 43.4516; // Latitude for Kitchener
    const lon = -80.4925; // Longitude for Kitchener
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        const temperature = data.main.temp;  // Temperature in Celsius
        const timezoneOffset = data.timezone;  // Timezone offset in seconds

        // Function to update the current time
        function updateTime() {
            const today = new Date((Date.now() + timezoneOffset * 1000));  // Adjusting the time using the timezone offset
            const todayDate = today.toLocaleString('en-US', { month: 'short', day: 'numeric' });  // Jan 31
            const todayYear = today.getFullYear();  // 2025
            const currentTime = today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });  // 14:45:30

            // Update the DOM
            const todayNameContainer = document.getElementById('today-name');
            todayNameContainer.innerHTML = `
                <div id="today-location">Kitchener, CA</div>
                <div id="today-temp">${temperature}°C</div>
                <div id="today-date">${todayDate}, ${todayYear}</div>
                <div id="today-time">${currentTime}</div>
            `;
        }

        // Call updateTime immediately to show the current time and refresh every second
        updateTime();
        setInterval(updateTime, 1000);  // Refresh every second

    } catch (error) {
        console.error('Error fetching weather data:', error);
    }
}

document.addEventListener('DOMContentLoaded', getWeather);
