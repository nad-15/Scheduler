// async function getWeather() {
//     const apiKey = '65818745c3aa4eed20b6eb5ce62c9c79';
//     const lat = 43.4516; // Latitude for Kitchener
//     const lon = -80.4925; // Longitude for Kitchener
//     const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

//     try {
//         const response = await fetch(url);
//         const data = await response.json();

//         const temperature = data.main.temp.toFixed(1); // Temperature in Celsius (rounded to 1 decimal)
//         let weatherDescription = data.weather[0].description;
//         const iconCode = data.weather[0].icon;
//         const iconUrl = `http://openweathermap.org/img/wn/${iconCode}.png`;

//         // Capitalize first letter and add period
//         weatherDescription = weatherDescription.charAt(0).toUpperCase() + weatherDescription.slice(1) + ".";

//         function updateTime() {
//             const today = new Date();
//             const options = { 
//                 month: 'short', 
//                 day: 'numeric', 
//                 year: 'numeric', 
//                 hour: '2-digit', 
//                 minute: '2-digit', 
//                 second: '2-digit', 
//                 hour12: true,  
//                 timeZone: 'America/Toronto' 
//             };

//             const formatter = new Intl.DateTimeFormat('en-US', options);
//             const parts = formatter.formatToParts(today);

//             let monthDay = "", year = "", hour = "", minute = "", second = "", ampm = "";

//             parts.forEach(({ type, value }) => {
//                 if (type === "month") monthDay += value + " ";
//                 if (type === "day") monthDay += value;
//                 if (type === "year") year = value;
//                 if (type === "hour") hour = value;
//                 if (type === "minute") minute = value;
//                 if (type === "second") second = value;
//                 if (type === "dayPeriod") ampm = value.toUpperCase();
//             });

//             // Update the content dynamically
//             const locationElement = document.getElementById('today-location');
//             locationElement.textContent = 'Kitchener, ON';

//             const dateElement = document.getElementById('today-date');
//             dateElement.textContent = `${monthDay}, ${year}`;

//             const hourMinuteElement = document.getElementById('today-hour-minute');
//             hourMinuteElement.textContent = `${hour}:${minute}`;

//             const secondsElement = document.getElementById('today-seconds');
//             secondsElement.textContent = `:${second}`;

//             const ampmElement = document.getElementById('today-ampm');
//             ampmElement.textContent = ampm;

//             const iconElement = document.getElementById('today-icon').querySelector('img');
//             iconElement.src = iconUrl;
//             iconElement.alt = 'Weather icon';
//             iconElement.onerror = () => {
//                 iconElement.src = 'https://fonts.gstatic.com/s/i/materialicons/umbrella/v1/24px.svg';
//             };

//             const tempElement = document.getElementById('today-temp');
//             tempElement.textContent = `${temperature}°`;

//             const weatherElement = document.getElementById('today-weather');
//             weatherElement.textContent = weatherDescription;
//         }

//         updateTime();
//         setInterval(updateTime, 1000);

//     } catch (error) {
//         console.error('Error fetching weather data:', error);
//     }
// }

//good one below

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
    }
}

//good one above

// function updateTime() {
//     const today = new Date();
//     const options = { 
//         month: 'short', day: 'numeric', year: 'numeric', 
//         hour: '2-digit', minute: '2-digit', second: '2-digit', 
//         hour12: true, timeZone: 'America/Toronto' 
//     };

//     const formatter = new Intl.DateTimeFormat('en-US', options);
//     const parts = formatter.formatToParts(today);

//     let monthDay = "", year = "", hour = "", minute = "", second = "", ampm = "";

//     parts.forEach(({ type, value }) => {
//         if (type === "month") monthDay += value + " ";
//         if (type === "day") monthDay += value;
//         if (type === "year") year = value;
//         if (type === "hour") hour = value;
//         if (type === "minute") minute = value;
//         if (type === "second") second = value;
//         if (type === "dayPeriod") ampm = value.toUpperCase();
//     });

//     document.getElementById('today-name').innerHTML = `
//         <div class="time-container">
//             <div id="today-location">Kitchener, ON</div>
//             <div id="today-date">${monthDay}, ${year}</div>
//             <div id="today-time">
//                 <span id="today-hour-minute">${hour}:${minute}</span>
//             </div>
//             <span id="today-seconds">:${second} ${ampm}</span>
//         </div>


//     `;
// }

// async function getWeather() {
//     const apiKey = '65818745c3aa4eed20b6eb5ce62c9c79';
//     const lat = 43.4516, lon = -80.4925;
//     const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

//     try {
//         const response = await fetch(url);
//         if (!response.ok) throw new Error("Failed to fetch weather data");
        
//         const data = await response.json();
//         const temperature = data.main.temp.toFixed(1);
//         let weatherDescription = data.weather[0].description;
//         const iconCode = data.weather[0].icon;
//         const iconUrl = `http://openweathermap.org/img/wn/${iconCode}.png`;

//         weatherDescription = weatherDescription.charAt(0).toUpperCase() + weatherDescription.slice(1) + ".";

//         // Append weather data to the DOM **only if the API call is successful**
//         document.getElementById('today-name').innerHTML += `
//             <div class="weather-container">
//                 <div id="today-icon"><img src="${iconUrl}" alt="Weather icon"></div>
//                 <div id="today-temp">${temperature}°</div>
//                 <div id="today-weather">${weatherDescription}</div>
//             </div>
//         `;

//         console.error('Data fetch');
//     } catch (error) {
//         console.error('Error fetching weather:', error);
//         // No weather elements will be added if the call fails
//     }
// }

// bad one above


// async function getWeather() {
//     const apiKey = '65818745c3aa4eed20b6eb5ce62c9c79';
//     const lat = 43.4516; // Latitude for Kitchener
//     const lon = -80.4925; // Longitude for Kitchener
//     const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

//     try {
//         const response = await fetch(url);
//         const data = await response.json();

//         const temperature = data.main.temp.toFixed(1); // Temperature in Celsius (rounded to 1 decimal)
//         let weatherDescription = data.weather[0].description;
//         const iconCode = data.weather[0].icon;
//         const iconUrl = `http://openweathermap.org/img/wn/${iconCode}.png`;

//         // Capitalize first letter and add period
//         weatherDescription = weatherDescription.charAt(0).toUpperCase() + weatherDescription.slice(1) + ".";

//         // Store weather data for later use
//         window.weatherData = { iconUrl, temperature, weatherDescription };

//         updateTime();  // Update time initially
//         setInterval(updateTime, 1000);  // Update time every second

//     } catch (error) {
//         console.error('Error fetching weather data:', error);
//     }
// }

// function updateTime() {
//     const today = new Date();
//     const options = { 
//         month: 'short', 
//         day: 'numeric', 
//         year: 'numeric', 
//         hour: '2-digit', 
//         minute: '2-digit', 
//         second: '2-digit', 
//         hour12: true,  
//         timeZone: 'America/Toronto' 
//     };

//     const formatter = new Intl.DateTimeFormat('en-US', options);
//     const parts = formatter.formatToParts(today);

//     let monthDay = "", year = "", hour = "", minute = "", second = "", ampm = "";

//     parts.forEach(({ type, value }) => {
//         if (type === "month") monthDay += value + " ";
//         if (type === "day") monthDay += value;
//         if (type === "year") year = value;
//         if (type === "hour") hour = value;
//         if (type === "minute") minute = value;
//         if (type === "second") second = value;
//         if (type === "dayPeriod") ampm = value.toUpperCase();
//     });

//     // Get the stored weather data
//     const { iconUrl, temperature, weatherDescription } = window.weatherData || {};

//     // Update the DOM with the current time and weather data
//     document.getElementById('today-name').innerHTML = `
//         <div class="time-container">
//             <div id="today-location">Kitchener, ON</div>
//             <div id="today-date">${monthDay}, ${year}</div>
//             <div id="today-time">
//                 <span id="today-hour-minute">${hour}:${minute}</span>
//             </div>
//             <span id="today-seconds">:${second} ${ampm}</span>
//         </div>

//         <div class="weather-container">
//             <div id="today-icon">
//                 <img src="${iconUrl || 'https://fonts.gstatic.com/s/i/materialicons/umbrella/v1/24px.svg'}" alt="W.icon">
//             </div>
//             <div id="today-temp">${temperature}°</div>
//             <div id="today-weather">${weatherDescription}</div>
//         </div>
//     `;
// }

//also good one above



