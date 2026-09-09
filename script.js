// Find the page elements that JavaScript updates or listens to.
const searchForm = document.querySelector("#search-form");
const locationInput = document.querySelector("#location-input");
const statusMessage = document.querySelector("#status-message");
const locationElement = document.querySelector(".location");
const dateElement = document.querySelector(".date");
const temperatureElement = document.querySelector(".temperature");
const conditionElement = document.querySelector(".condition");
const iconElement = document.querySelector(".weather-icon");
const windElement = document.querySelector(".wind");
const humidityElement = document.querySelector(".humidity");
const forecastList = document.querySelector("#forecast-list");
const newsList = document.querySelector("#news-list");
const settingsToggle = document.querySelector("#settings-toggle");
const settingsPanel = document.querySelector("#settings-panel");
const themeButtons = document.querySelectorAll(".theme-btn");
const unitButtons = document.querySelectorAll(".unit-btn");
const radarToggle = document.querySelector("#radar-toggle");
const radarPanel = document.querySelector("#radar-panel");

// Show or hide the radar panel when radar button is clicked
radarToggle.addEventListener("click", function () {
    radarPanel.classList.toggle("hidden");

    radarToggle.textContent =
        radarPanel.classList.contains("hidden")
            ? "Open radar"
            : "Close radar";
});

const appState = {
    theme: "light",
    units: "metric"
};

// Keep the latest search results so the display can be re-rendered when settings change
let lastPlace = null;
let lastWeatherData = null;

// Open or close the settings menu
settingsToggle.addEventListener("click", function () {
    settingsPanel.classList.toggle("hidden");
});

// Apply the selected theme when a theme button is clicked
themeButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        appState.theme = button.dataset.theme;
        updateTheme();
    });
});

// Apply the selected measurement system when a unit button is clicked
unitButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        appState.units = button.dataset.units;
        updateUnits();
    });
});

function updateTheme() {
    // Toggle the theme
    document.body.classList.toggle("dark-theme", appState.theme === "dark");

    themeButtons.forEach(function (button) {
        button.classList.toggle("active", button.dataset.theme === appState.theme);
    });
}

function updateUnits() {
    // current weather and forecast values using the new units
    unitButtons.forEach(function (button) {
        button.classList.toggle("active", button.dataset.units === appState.units);
    });

    renderCurrentWeather();
    renderForecast();
}

function toFahrenheit(celsius) {
    // Convert a Celsius to Fahrenheit 
    return (celsius * 9 / 5) + 32;
}

function toMph(kmh) {
    // Convert kilometers per hour to miles per hour.
    return kmh * 0.621371;
}

function formatTemperature(value) {
    if (appState.units === "metric") {
        return `${Math.round(value)}°C`;
    }

    return `${Math.round(toFahrenheit(value))}°F`;
}

function formatWind(value) {
    if (appState.units === "metric") {
        return `${Math.round(value)} km/h`;
    }

    return `${Math.round(toMph(value))} mph`;
}

function formatForecastTemperature(value) {
    if (appState.units === "metric") {
        return `${Math.round(value)}°`;
    }

    return `${Math.round(toFahrenheit(value))}°`;
}

// Search for city without reloading the page
searchForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const city = locationInput.value.trim();

    if (city === "") {
        statusMessage.textContent = "Please enter a city.";
        return;
    }

    getWeather(city);
});

async function getWeather(city) {
    // Get coordinates then use to request weather data
    statusMessage.textContent = "Loading weather...";

    try {
        const locationResponse = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
        );

        const locationData = await locationResponse.json();

        if (!locationData.results || locationData.results.length === 0) {
            throw new Error("Location not found.");
        }

        const place = locationData.results[0];

        const weatherResponse = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=celsius&wind_speed_unit=kmh&timezone=auto`
        );

        const weatherData = await weatherResponse.json();

        updateCurrentWeather(place, weatherData);
        updateForecast(weatherData);

        statusMessage.textContent = "";
    } catch (error) {
        statusMessage.textContent = error.message;
    }
}

function updateRadar(place) {
    // Center the embedded radar map
    const radarFrame = document.querySelector("#radar-frame")

    radarFrame.src =
     `https://embed.windy.com/embed2.html?lat=${place.latitude}` +
     `&lon=${place.longitude}` +
     `&detailLat=${place.latitude}` +
     `&detailLon=${place.longitude}` +
      `&width=650&height=450&zoom=5` +
        `&level=surface&overlay=radar&product=ecmwf` +
        `&menu=&message=true&marker=true&calendar=now` +
        `&pressure=&type=map&location=coordinates&detail=true` +
        `&metricWind=default&metricTemp=default`;
}

function updateCurrentWeather(place, weatherData) {
    // Store the latest response and update each connected feature.
    lastPlace = place;
    lastWeatherData = weatherData;
    renderCurrentWeather();
    loadLocalNews(place);
    updateRadar(place);
}

async function loadLocalNews(place) {
    // Request headlines for the city
    const location = [place.name, place.admin1, place.country]
        .filter(Boolean)
        .join(", ");

    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(location)}` +
        "&hl=en-US&gl=US&ceid=US:en";
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

    newsList.innerHTML = `<p class="news-status">Loading local headlines...</p>`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error("News request failed.");
        }

        const newsData = await response.json();
        const stories = newsData.items?.slice(0, 3) || [];

        if (stories.length === 0) {
            newsList.innerHTML = `<p class="news-status">No local headlines found.</p>`;
            return;
        }

        newsList.innerHTML = "";

        // Turn each story into clickable article preview
        stories.forEach(function (story) {
            const article = document.createElement("a");
            article.className = "news-story";
            article.href = story.link;
            article.target = "_blank";
            article.rel = "noopener noreferrer";

            const thumbnail = document.createElement("img");
            thumbnail.className = "news-thumbnail";
            thumbnail.src = getThumbnail(story);
            thumbnail.alt = "";
            thumbnail.loading = "lazy";
            thumbnail.addEventListener("error", function () {
                thumbnail.classList.add("missing");
            });

            const content = document.createElement("span");
            content.className = "news-story-content";

            const title = document.createElement("strong");
            title.textContent = story.title;

            const source = document.createElement("small");
            source.textContent = story.author || newsData.feed?.title || "News source";

            content.append(title, source);
            article.append(thumbnail, content);
            newsList.appendChild(article);
        });
    } catch (error) {
        newsList.innerHTML = `<p class="news-status">Local news is unavailable right now.</p>`;
    }
}

function getThumbnail(story) {
    // Try the direct image fields before extracting an image from the RSS HTML (thumbnails not working)
    const imageMatch = story.description?.match(/<img[^>]+src=["']([^"']+)["']/i);

    return (
        story.thumbnail ||
        story.enclosure?.link ||
        imageMatch?.[1] ||
        "fallback-image-url"
    );
}

function renderCurrentWeather() {
    // Fill the current-weather card from the API response
    if (!lastPlace || !lastWeatherData) {
        return;
    }

    locationElement.textContent = `${lastPlace.name}, ${lastPlace.admin1 || lastPlace.country}`;
    dateElement.textContent = formatDate(lastWeatherData.current.time);
    temperatureElement.textContent = formatTemperature(lastWeatherData.current.temperature_2m);
    humidityElement.textContent = `${lastWeatherData.current.relative_humidity_2m}%`;
    windElement.textContent = formatWind(lastWeatherData.current.wind_speed_10m);
    conditionElement.textContent = getWeatherDescription(lastWeatherData.current.weather_code);
    iconElement.textContent = getWeatherIcon(lastWeatherData.current.weather_code);
}

function formatDay(dateString) {
    // Convert API date into short weekday label.
    const date = new Date(`${dateString}T12:00:00`);
    if (Number.isNaN(date.getTime())) return "Day";
    return date.toLocaleDateString("en-US", {
        weekday: "short"
    });
}

function updateForecast(weatherData) {
    // Save forecast response draw the forecast rows.
    lastWeatherData = weatherData;
    renderForecast();
}

function renderForecast() {
    // Rebuild forecast list so unit changes appear 
    if (!lastWeatherData) {
        return;
    }

    forecastList.innerHTML = "";

    lastWeatherData.daily.time.forEach(function (date, index) {
        const forecastDay = document.createElement("div");
        forecastDay.className = "forecast-day";

        const highValue = formatForecastTemperature(lastWeatherData.daily.temperature_2m_max[index]);
        const lowValue = formatForecastTemperature(lastWeatherData.daily.temperature_2m_min[index]);

        forecastDay.innerHTML = `
            <span>${formatDay(date)}</span>
            <span>${getWeatherIcon(lastWeatherData.daily.weather_code[index])}</span>
            <strong>${highValue}</strong>
            <span>${lowValue}</span>
        `;

        forecastList.appendChild(forecastDay);
    });
}

function formatDate(dateString) {
    // Format current weather date for main weather card
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "Today";
    return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric"
    });
}

function getWeatherDescription(code) {
    // Convert Open-Meteo weather codes into readable conditions
    if (code === 0) return "Clear Sky";
    if (code <= 3) return "Partly cloudy";
    if (code <= 48) return "Foggy";
    if (code <= 67) return "Rainy";
    if (code <= 77) return "Snowy";
    if (code <= 82) return "Rain showers";
    return "Thunderstorm";
}

function getWeatherIcon(code) {
    // Convert Open-Meteo weather codes into weather icons
    if (code === 0) return "☀️";
    if (code <= 3) return "🌤️";
    if (code <= 48) return "🌫️";
    if (code <= 67) return "🌧️";
    if (code <= 77) return "❄️";
    if (code <= 82) return "🌦️";
    return "⛈️";
}

// Set the initial theme an load the default city
updateTheme();
getWeather("Portland, Oregon");
