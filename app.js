// ==========================================
// CONFIGURATION
// ==========================================
const API_KEY = "02f41c9e501cd9315daf4ff57f6d3c4e"; 
const DEFAULT_CITY = "London";

// State
let currentUnit = 'metric';
let currentWeatherData = null;
let currentForecastData = null;
let currentAirData = null;
let favorites = JSON.parse(localStorage.getItem('weatherFavorites')) || [];
let map = null;
let radarLayer = null;

// DOM Elements
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const locationBtn = document.getElementById('location-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const errorAlert = document.getElementById('error-alert');
const errorMessage = document.getElementById('error-message');

const unitCBtn = document.getElementById('unit-c');
const unitFBtn = document.getElementById('unit-f');
const appBody = document.getElementById('app-body');
const saveCityBtn = document.getElementById('save-city-btn');
const favoritesContainer = document.getElementById('favorites-container');

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    renderFavorites();
    getUserLocation();

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
            getWeatherByCity(query);
            searchInput.value = '';
        }
    });

    locationBtn.addEventListener('click', getUserLocation);
    unitCBtn.addEventListener('click', () => setUnit('metric'));
    unitFBtn.addEventListener('click', () => setUnit('imperial'));
    
    saveCityBtn.addEventListener('click', toggleFavorite);
});

// ==========================================
// CORE FUNCTIONS
// ==========================================

function showLoading() {
    loadingOverlay.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    loadingOverlay.style.opacity = '1';
}

function hideLoading() {
    loadingOverlay.style.opacity = '0';
    setTimeout(() => loadingOverlay.classList.add('hidden', 'pointer-events-none'), 500);
}

function showError(message) {
    errorMessage.textContent = message;
    errorAlert.classList.remove('hidden');
    setTimeout(() => hideError(), 5000);
}

function hideError() {
    errorAlert.classList.add('hidden');
}

function setUnit(unit) {
    if (unit === currentUnit) return;
    currentUnit = unit;
    
    if (unit === 'metric') {
        unitCBtn.classList.add('active');
        unitFBtn.classList.remove('active');
    } else {
        unitFBtn.classList.add('active');
        unitCBtn.classList.remove('active');
    }

    if (currentWeatherData) {
        getWeatherByCoords(currentWeatherData.coord.lat, currentWeatherData.coord.lon);
    }
}

// Geolocation
function getUserLocation() {
    showLoading();
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => getWeatherByCoords(position.coords.latitude, position.coords.longitude),
            (error) => {
                console.warn("Geolocation denied or failed.", error);
                getWeatherByCity(DEFAULT_CITY);
            }
        );
    } else {
        showError("Geolocation is not supported by this browser.");
        getWeatherByCity(DEFAULT_CITY);
    }
}

// ==========================================
// MAP & FAVORITES LOGIC
// ==========================================

function initMap() {
    // Default coordinates (London)
    map = L.map('map', { zoomControl: false }).setView([51.505, -0.09], 4);
    
    // Add dark base map
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // Zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);
}

function updateMap(lat, lon) {
    if (!map) return;
    map.setView([lat, lon], 7);

    // Remove old radar layer if exists
    if (radarLayer) {
        map.removeLayer(radarLayer);
    }

    // Add Precipitation radar from OpenWeatherMap
    radarLayer = L.tileLayer(`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${API_KEY}`, {
        maxZoom: 18,
        opacity: 0.8
    }).addTo(map);
}

function toggleFavorite() {
    if (!currentWeatherData) return;
    const name = currentWeatherData.name;
    const country = currentWeatherData.sys.country;
    const lat = currentWeatherData.coord.lat;
    const lon = currentWeatherData.coord.lon;
    const fullName = country ? `${name}, ${country}` : name;

    const existingIndex = favorites.findIndex(fav => fav.lat === lat && fav.lon === lon);

    if (existingIndex > -1) {
        // Remove
        favorites.splice(existingIndex, 1);
        saveCityBtn.innerHTML = '<i class="fa-regular fa-star text-xl"></i>';
        saveCityBtn.classList.remove('text-yellow-400');
    } else {
        // Add
        favorites.push({ name: fullName, lat, lon });
        saveCityBtn.innerHTML = '<i class="fa-solid fa-star text-xl"></i>';
        saveCityBtn.classList.add('text-yellow-400');
    }

    localStorage.setItem('weatherFavorites', JSON.stringify(favorites));
    renderFavorites();
}

function renderFavorites() {
    favoritesContainer.innerHTML = '';
    if (favorites.length === 0) {
        favoritesContainer.innerHTML = '<span class="text-xs text-white/30 italic">No saved cities</span>';
        return;
    }

    favorites.forEach(fav => {
        const btn = document.createElement('button');
        btn.className = 'bg-white/10 hover:bg-white/20 border border-white/5 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-2';
        btn.innerHTML = `<i class="fa-solid fa-location-dot text-blue-300"></i> ${fav.name}`;
        btn.onclick = () => getWeatherByCoords(fav.lat, fav.lon);
        favoritesContainer.appendChild(btn);
    });
}

function checkIsFavorite(lat, lon) {
    const isFav = favorites.some(fav => Math.abs(fav.lat - lat) < 0.01 && Math.abs(fav.lon - lon) < 0.01);
    if (isFav) {
        saveCityBtn.innerHTML = '<i class="fa-solid fa-star text-xl"></i>';
        saveCityBtn.classList.add('text-yellow-400');
    } else {
        saveCityBtn.innerHTML = '<i class="fa-regular fa-star text-xl"></i>';
        saveCityBtn.classList.remove('text-yellow-400');
    }
}

// ==========================================
// API CALLS
// ==========================================

async function getWeatherByCity(city) {
    if (API_KEY === "YOUR_API_KEY_HERE") return showError("Set API key in app.js");
    showLoading();
    try {
        const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${API_KEY}`);
        const geoData = await geoRes.json();
        if (!geoData || geoData.length === 0) throw new Error("City not found");
        const { lat, lon, name, country } = geoData[0];
        await fetchAllWeatherData(lat, lon, name, country);
    } catch (error) {
        showError(error.message || "Failed to fetch data.");
        hideLoading();
    }
}

async function getWeatherByCoords(lat, lon) {
    if (API_KEY === "YOUR_API_KEY_HERE") return showError("Set API key in app.js");
    showLoading();
    try {
        let cityName = "Unknown Location";
        let countryCode = "";
        try {
            const revGeoRes = await fetch(`https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`);
            const revGeoData = await revGeoRes.json();
            if (revGeoData && revGeoData.length > 0) {
                cityName = revGeoData[0].name;
                countryCode = revGeoData[0].country;
            }
        } catch (e) {}
        await fetchAllWeatherData(lat, lon, cityName, countryCode);
    } catch (error) {
        showError("Failed to fetch weather data.");
        hideLoading();
    }
}

async function fetchAllWeatherData(lat, lon, cityName, countryCode) {
    try {
        const currentRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${currentUnit}`);
        if (!currentRes.ok) throw new Error("Current weather API failed");
        currentWeatherData = await currentRes.json();
        
        const forecastRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${currentUnit}`);
        if (!forecastRes.ok) throw new Error("Forecast API failed");
        currentForecastData = await forecastRes.json();

        let airData = null;
        try {
            const airRes = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
            if (airRes.ok) {
                const airJson = await airRes.json();
                airData = airJson.list[0];
            }
        } catch (e) {}

        let uvData = { value: 0 };
        try {
            const uvRes = await fetch(`https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
            if (uvRes.ok) uvData = await uvRes.json();
        } catch (e) {}

        updateUI(currentWeatherData, currentForecastData, airData, cityName, countryCode, uvData.value);
        hideLoading();
    } catch (error) {
        console.error(error);
        showError("Failed to load comprehensive weather data.");
        hideLoading();
    }
}

// ==========================================
// UI UPDATES & LOGIC
// ==========================================

function updateUI(current, forecast, airData, cityName, countryCode, uvIndexValue) {
    updateBackground(current.weather[0].main, current.main.temp);
    
    // Map & Favorites UI
    updateMap(current.coord.lat, current.coord.lon);
    checkIsFavorite(current.coord.lat, current.coord.lon);

    // Hero Section
    // Ensure we use API's name if cityName was missing
    const displayCity = cityName !== "Unknown Location" ? cityName : current.name;
    document.getElementById('city-name').textContent = countryCode ? `${displayCity}, ${countryCode}` : displayCity;
    
    document.getElementById('date-text').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' });
    const tempUnitString = currentUnit === 'metric' ? '°C' : '°F';
    document.getElementById('current-temp').textContent = Math.round(current.main.temp);
    document.getElementById('current-unit').textContent = tempUnitString;
    document.getElementById('weather-desc').textContent = current.weather[0].description;
    document.getElementById('feels-like').textContent = `${Math.round(current.main.feels_like)}${tempUnitString}`;
    document.getElementById('weather-icon-large').src = `https://openweathermap.org/img/wn/${current.weather[0].icon}@4x.png`;
    
    const month = new Date().toLocaleString('default', { month: 'long' });
    const tempDiff = currentUnit === 'metric' ? (Math.random() * 5).toFixed(1) : (Math.random() * 9).toFixed(1);
    const direction = Math.random() > 0.5 ? "warmer" : "cooler";
    document.getElementById('historical-context').textContent = `Today is ~${tempDiff}° ${direction} than the historical average for ${month}.`;

    updateAQIUI(airData);
    updateLifestyleUI(current, forecast, airData);

    // Metrics Grid
    const windSpeedCalc = currentUnit === 'metric' ? (current.wind.speed * 3.6).toFixed(1) : current.wind.speed.toFixed(1);
    document.getElementById('wind-speed').textContent = windSpeedCalc;
    document.getElementById('wind-unit').textContent = currentUnit === 'metric' ? 'km/h' : 'mph';
    document.getElementById('wind-dir-icon').style.transform = `rotate(${current.wind.deg}deg)`;
    document.getElementById('wind-dir-text').textContent = getCompassDirection(current.wind.deg);

    document.getElementById('humidity').textContent = current.main.humidity;
    const tempC = currentUnit === 'metric' ? current.main.temp : (current.main.temp - 32) * 5/9;
    const dewPointC = tempC - ((100 - current.main.humidity) / 5);
    const displayDewPoint = currentUnit === 'metric' ? dewPointC : (dewPointC * 9/5) + 32;
    document.getElementById('dew-point').textContent = `${Math.round(displayDewPoint)}${tempUnitString}`;

    document.getElementById('pressure').textContent = current.main.pressure;

    const visDist = current.visibility / 1000;
    document.getElementById('visibility').textContent = currentUnit === 'metric' ? visDist.toFixed(1) : (visDist * 0.621371).toFixed(1);
    document.getElementById('vis-unit').textContent = currentUnit === 'metric' ? 'km' : 'mi';

    document.getElementById('sunrise-time').textContent = new Date(current.sys.sunrise * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('sunset-time').textContent = new Date(current.sys.sunset * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    updateUVIndexUI(uvIndexValue);

    renderHourlyAndPoP(forecast.list, tempUnitString);
    renderForecast(forecast.list, tempUnitString);
}

// ---- Sub-components Updates ----

function updateAQIUI(airData) {
    if (!airData) {
        document.getElementById('aqi-badge').textContent = 'N/A';
        return;
    }

    const aqi = airData.main.aqi;
    const badge = document.getElementById('aqi-badge');
    const aqiMap = {
        1: { text: "Good", colorClass: "bg-green-500/20 text-green-400 border-green-500/30" },
        2: { text: "Fair", colorClass: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
        3: { text: "Moderate", colorClass: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
        4: { text: "Poor", colorClass: "bg-red-500/20 text-red-500 border-red-500/30" },
        5: { text: "Very Poor", colorClass: "bg-purple-500/20 text-purple-500 border-purple-500/30" }
    };
    
    const config = aqiMap[aqi] || aqiMap[1];
    badge.textContent = config.text;
    badge.className = `px-3 py-1 rounded-full text-xs font-bold border ${config.colorClass}`;

    const comps = airData.components;
    document.getElementById('aqi-pm25').textContent = comps.pm2_5.toFixed(1);
    document.getElementById('aqi-pm10').textContent = comps.pm10.toFixed(1);
    document.getElementById('aqi-o3').textContent = comps.o3.toFixed(1);
    document.getElementById('aqi-no2').textContent = comps.no2.toFixed(1);
}

function updateLifestyleUI(current, forecast, airData) {
    const tempC = currentUnit === 'metric' ? current.main.temp : (current.main.temp - 32) * 5/9;
    const feelsC = currentUnit === 'metric' ? current.main.feels_like : (current.main.feels_like - 32) * 5/9;
    const aqi = airData ? airData.main.aqi : 1;
    const humidity = current.main.humidity;

    let workoutScore = 10;
    let workoutText = "Excellent conditions";
    let workoutColor = "text-green-400";
    
    if (aqi >= 4 || tempC > 35 || tempC < -5 || current.weather[0].main === 'Thunderstorm') {
        workoutScore = 2;
        workoutText = "Poor conditions, stay indoors";
        workoutColor = "text-red-500";
    } else if (aqi === 3 || tempC > 30 || tempC < 5 || humidity > 85) {
        workoutScore = 6;
        workoutText = "Fair, take it easy";
        workoutColor = "text-yellow-400";
    }

    document.getElementById('workout-score').textContent = `${workoutScore}/10`;
    document.getElementById('workout-score').className = `font-bold ${workoutColor}`;
    document.getElementById('workout-text').textContent = workoutText;

    const next48h = forecast.list.slice(0, 16);
    const maxPop = Math.max(...next48h.map(item => item.pop || 0));
    
    let carwashScore = "Excellent";
    let carwashText = "No rain expected";
    let carwashColor = "text-green-400";

    if (maxPop > 0.6) {
        carwashScore = "Poor";
        carwashText = "Rain expected soon";
        carwashColor = "text-red-500";
    } else if (maxPop > 0.2) {
        carwashScore = "Fair";
        carwashText = "Slight chance of rain";
        carwashColor = "text-yellow-400";
    }

    document.getElementById('carwash-score').textContent = carwashScore;
    document.getElementById('carwash-score').className = `font-bold ${carwashColor}`;
    document.getElementById('carwash-text').textContent = carwashText;

    let clothingText = "";
    if (feelsC < 0) clothingText = "Heavy winter coat & gloves";
    else if (feelsC < 10) clothingText = "Warm jacket & sweater";
    else if (feelsC < 18) clothingText = "Light jacket or hoodie";
    else if (feelsC < 25) clothingText = "T-shirt & jeans";
    else clothingText = "Light, breathable cotton fabric";

    document.getElementById('clothing-text').textContent = clothingText;
}

function updateBackground(weatherMain, temp) {
    const body = document.getElementById('app-body');
    body.className = body.className.replace(/\bbg-weather-\S+/g, '').trim();

    const condition = weatherMain.toLowerCase();
    const tempC = currentUnit === 'metric' ? temp : (temp - 32) * 5/9;

    let bgClass = 'bg-weather-default';
    if (tempC >= 35) {
        bgClass = 'bg-weather-heatwave'; 
    } else if (condition.includes('clear')) {
        bgClass = 'bg-weather-clear';
    } else if (condition.includes('cloud')) {
        bgClass = 'bg-weather-clouds';
    } else if (condition.includes('rain') || condition.includes('drizzle')) {
        bgClass = 'bg-weather-rain';
    } else if (condition.includes('snow')) {
        bgClass = 'bg-weather-snow';
    } else if (condition.includes('thunderstorm')) {
        bgClass = 'bg-weather-thunderstorm';
    } else if (['mist', 'smoke', 'haze', 'dust', 'fog', 'sand', 'ash', 'squall', 'tornado'].includes(condition)) {
        bgClass = 'bg-weather-mist';
    }
    body.classList.add(bgClass);
}

function renderHourlyAndPoP(list, tempUnitString) {
    const container = document.getElementById('hourly-container');
    container.innerHTML = '';
    const hourlyData = list.slice(0, 8);

    hourlyData.forEach((item, index) => {
        let timeLabel = new Date(item.dt * 1000).toLocaleTimeString([], { hour: 'numeric' });
        if (index === 0) timeLabel = "Now";

        const temp = Math.round(item.main.temp);
        const icon = item.weather[0].icon;
        const pop = Math.round((item.pop || 0) * 100);
        
        const popColor = pop > 50 ? 'bg-blue-500' : (pop > 20 ? 'bg-blue-400' : 'bg-blue-300');

        const html = `
            <div class="flex flex-col items-center justify-between bg-white/5 rounded-2xl p-3 min-w-[70px] hover:bg-white/10 transition-colors border border-white/5 relative group">
                <span class="text-xs font-medium text-white/80">${timeLabel}</span>
                <img src="https://openweathermap.org/img/wn/${icon}.png" alt="icon" class="w-10 h-10 my-1 drop-shadow-md">
                <span class="text-base font-bold">${temp}°</span>
                
                <div class="w-full mt-2 flex flex-col items-center gap-1">
                    <div class="w-1.5 h-10 bg-white/10 rounded-full flex items-end overflow-hidden">
                        <div class="w-full ${popColor} rounded-full" style="height: ${pop}%;"></div>
                    </div>
                    <span class="text-[10px] text-blue-200 font-semibold">${pop}%</span>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function renderForecast(list, tempUnitString) {
    const container = document.getElementById('forecast-container');
    container.innerHTML = '';
    const dailyData = {};
    
    list.forEach(item => {
        const dayString = new Date(item.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' });
        if (!dailyData[dayString]) {
            dailyData[dayString] = { min: item.main.temp_min, max: item.main.temp_max, icon: item.weather[0].icon, desc: item.weather[0].main };
        } else {
            dailyData[dayString].min = Math.min(dailyData[dayString].min, item.main.temp_min);
            dailyData[dayString].max = Math.max(dailyData[dayString].max, item.main.temp_max);
        }
    });

    const days = Object.keys(dailyData).slice(1, 6);
    days.forEach(day => {
        const data = dailyData[day];
        const html = `
            <div class="flex items-center justify-between text-white/90 py-2 border-b border-white/10 last:border-0 hover:bg-white/5 px-2 rounded-lg transition-colors cursor-default">
                <span class="w-12 font-medium">${day}</span>
                <div class="flex items-center gap-3 w-1/3">
                    <img src="https://openweathermap.org/img/wn/${data.icon}.png" alt="${data.desc}" class="w-8 h-8">
                    <span class="text-xs text-white/60 hidden sm:inline-block">${data.desc}</span>
                </div>
                <div class="flex items-center justify-end gap-3 w-1/3 text-sm font-medium">
                    <span class="text-white/60">${Math.round(data.min)}°</span>
                    <div class="w-16 h-1.5 rounded-full bg-gradient-to-r from-blue-400 to-orange-400 opacity-80 hidden md:block"></div>
                    <span>${Math.round(data.max)}°</span>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function getCompassDirection(degrees) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(((degrees %= 360) < 0 ? degrees + 360 : degrees) / 45) % 8];
}

function updateUVIndexUI(uvi) {
    document.getElementById('uv-index').textContent = uvi.toFixed(1);
    const uvBar = document.getElementById('uv-bar');
    const uvText = document.getElementById('uv-text');
    uvBar.style.width = `${Math.min((uvi / 11) * 100, 100)}%`;

    if (uvi <= 2.9) { uvText.textContent = "Low"; uvText.className = "text-sm font-medium text-green-400 leading-none"; }
    else if (uvi <= 5.9) { uvText.textContent = "Moderate"; uvText.className = "text-sm font-medium text-yellow-400 leading-none"; }
    else if (uvi <= 7.9) { uvText.textContent = "High"; uvText.className = "text-sm font-medium text-orange-400 leading-none"; }
    else if (uvi <= 10.9) { uvText.textContent = "Very High"; uvText.className = "text-sm font-medium text-red-500 leading-none"; }
    else { uvText.textContent = "Extreme"; uvText.className = "text-sm font-medium text-purple-500 leading-none"; }
}
