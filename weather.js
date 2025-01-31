async function getWeather() {
    const apiKey = '65818745c3aa4eed20b6eb5ce62c9c79';
    const lat = 43.4516; // Latitude
    const lon = -80.4925; // Longitude
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        const today = new Date();
        const todayDate = today.toLocaleString('en-US', { month: 'short', day: 'numeric' });  // Jan 31
        const todayYear = today.getFullYear();  // 2025
        const temperature = data.main.temp;  // Temperature in Celsius

        const todayNameContainer = document.getElementById('today-name');
        todayNameContainer.innerHTML = `
            <div id="today-location">Kitchener, CA</div>
            <div id="today-date">${todayDate}</div>
            <div id="today-temp">${temperature}°C</div>
                        <div id="today-year">${todayYear}</div>
        `;
    } catch (error) {
        console.error('Error fetching weather data:', error);
    }
}


