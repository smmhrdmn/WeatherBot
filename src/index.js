require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  Collection,
  Events,
  REST,
  Routes 
} = require('discord.js');
const axios = require('axios');

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Collection for slash commands
client.commands = new Collection();

// Weather API settings
const WEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/weather';
const FORECAST_API_URL = 'https://api.openweathermap.org/data/2.5/forecast';
const ONECALL_API_URL = 'https://api.openweathermap.org/data/3.0/onecall';
const AIR_POLLUTION_API_URL = 'https://api.openweathermap.org/data/2.5/air_pollution';
const GEOCODING_API_URL = 'https://api.openweathermap.org/geo/1.0/direct';
const WEATHER_ICON_URL = 'https://openweathermap.org/img/wn/';

// Debug - Log API key status (not the actual key)
console.log('API Key defined:', !!WEATHER_API_KEY);

// Path to locations data file
const LOCATIONS_FILE = path.join(__dirname, '../data/locations.json');

// Weather condition to color mapping
const getWeatherColor = (weatherId) => {
  // Color scheme based on weather condition codes
  // https://openweathermap.org/weather-conditions
  if (weatherId >= 200 && weatherId < 300) return 0x5A5A5A; // Thunderstorm - dark gray
  if (weatherId >= 300 && weatherId < 400) return 0x89CFF0; // Drizzle - light blue
  if (weatherId >= 500 && weatherId < 600) return 0x0066CC; // Rain - darker blue
  if (weatherId >= 600 && weatherId < 700) return 0xFFFFFF; // Snow - white
  if (weatherId >= 700 && weatherId < 800) return 0xAAAAAA; // Atmosphere - light gray
  if (weatherId === 800) return 0xFFD700; // Clear - gold
  if (weatherId > 800) return 0x87CEEB; // Clouds - sky blue
  return 0x0099FF; // Default blue
};

// Get temperature color based on value
const getTempColor = (temp) => {
  if (temp <= 32) return 0x00FFFF; // Freezing - cyan
  if (temp <= 50) return 0x0099FF; // Cold - light blue
  if (temp <= 65) return 0x00FF00; // Cool - green
  if (temp <= 75) return 0xFFFF00; // Moderate - yellow
  if (temp <= 85) return 0xFFA500; // Warm - orange
  return 0xFF0000; // Hot - red
};

// Helper function to get cardinal direction from degrees
const getWindDirection = (degrees) => {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
};

// Helper function to format time from unix timestamp
const formatTime = (unixTime) => {
  const date = new Date(unixTime * 1000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Get AQI description based on index value
const getAqiDescription = (aqi) => {
  switch(aqi) {
    case 1: return { label: 'Good', emoji: '🟢', description: 'Air quality is considered satisfactory, and air pollution poses little or no risk.' };
    case 2: return { label: 'Fair', emoji: '🟡', description: 'Air quality is acceptable; however, some pollutants may be moderate.' };
    case 3: return { label: 'Moderate', emoji: '🟠', description: 'Members of sensitive groups may experience health effects.' };
    case 4: return { label: 'Poor', emoji: '🔴', description: 'Everyone may begin to experience health effects; sensitive groups may experience more serious effects.' };
    case 5: return { label: 'Very Poor', emoji: '🟣', description: 'Health warnings of emergency conditions. The entire population is more likely to be affected.' };
    default: return { label: 'Unknown', emoji: '❓', description: 'No air quality data available.' };
  }
};

// Helper function to create clean, organized sections
const createBox = (title, content) => {
  const contentLines = Array.isArray(content) ? content : [content];
  
  return [
    `### ${title}`,
    ...contentLines.map(line => line),
    ''
  ].join('\n');
};

// Helper function to create a clean forecast display
function createForecastDisplay(forecastData, dayForecasts, mapUrls) {
  // Get basic info
  const cityName = forecastData.locationName || forecastData.city.name;
  const stateInfo = forecastData.locationState ? `, ${forecastData.locationState}` : '';
  const countryCode = forecastData.locationCountry || forecastData.city.country;
  
  // Find the dominant weather for title display
  const allWeatherIds = [];
  Object.values(dayForecasts).forEach(forecasts => {
    allWeatherIds.push(...forecasts.map(f => f.weather[0].id));
  });
  let dominantWeatherId = allWeatherIds[0];
  
  // Prefer severe weather conditions for dominant display
  for (const id of allWeatherIds) {
    if (id < dominantWeatherId || 
        (id >= 500 && id < 600 && dominantWeatherId >= 800) || // Rain over clear
        (id >= 600 && id < 700 && dominantWeatherId >= 800)) { // Snow over clear
      dominantWeatherId = id;
    }
  }
  
  // Get emoji for dominant weather
  let weatherEmoji = '☁️';
  if (dominantWeatherId >= 200 && dominantWeatherId < 300) weatherEmoji = '⚡'; // Thunderstorm
  else if (dominantWeatherId >= 300 && dominantWeatherId < 500) weatherEmoji = '🌧️'; // Drizzle
  else if (dominantWeatherId >= 500 && dominantWeatherId < 600) weatherEmoji = '🌧️'; // Rain
  else if (dominantWeatherId >= 600 && dominantWeatherId < 700) weatherEmoji = '❄️'; // Snow
  else if (dominantWeatherId >= 700 && dominantWeatherId < 800) weatherEmoji = '🌫️'; // Atmosphere
  else if (dominantWeatherId === 800) weatherEmoji = '☀️'; // Clear
  else if (dominantWeatherId > 800) weatherEmoji = '⛅'; // Partly cloudy
  
  // Create a summary of next few days overview
  const forecastSummary = [];
  forecastSummary.push('### 5-Day Forecast Overview');
  
  // Process each day's forecast
  Object.entries(dayForecasts).forEach(([day, forecasts]) => {
    // Min/max temps
    const temps = forecasts.map(f => f.main.temp);
    const minTemp = Math.min(...temps).toFixed(0);
    const maxTemp = Math.max(...temps).toFixed(0);
    
    // Precipitation probability
    const precipProb = forecasts.some(f => f.pop) ? 
      Math.round(Math.max(...forecasts.map(f => f.pop || 0)) * 100) : null;
    
    // Most severe weather condition
    let dominantWeather = forecasts[0].weather[0];
    forecasts.forEach(forecast => {
      const weatherId = forecast.weather[0].id;
      if (weatherId < dominantWeather.id || 
          (weatherId >= 500 && weatherId < 600 && dominantWeather.id >= 800) || // Rain over clear
          (weatherId >= 600 && weatherId < 700 && dominantWeather.id >= 800)) { // Snow over clear
        dominantWeather = forecast.weather[0];
      }
    });
    
    // Get emoji for this day's weather
    let emoji = '☁️';
    if (dominantWeather.id >= 200 && dominantWeather.id < 300) emoji = '⚡';
    else if (dominantWeather.id >= 300 && dominantWeather.id < 500) emoji = '🌧️';
    else if (dominantWeather.id >= 500 && dominantWeather.id < 600) emoji = '🌧️';
    else if (dominantWeather.id >= 600 && dominantWeather.id < 700) emoji = '❄️';
    else if (dominantWeather.id >= 700 && dominantWeather.id < 800) emoji = '🌫️';
    else if (dominantWeather.id === 800) emoji = '☀️';
    else if (dominantWeather.id > 800) emoji = '⛅';
    
    // Format day name
    const date = new Date(day);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    
    // Create a clean, readable forecast line for each day
    const precipInfo = precipProb !== null ? `☔ ${precipProb}% chance of precipitation` : '';
    forecastSummary.push(`**${dayName}**: ${emoji} ${dominantWeather.description.charAt(0).toUpperCase() + dominantWeather.description.slice(1)}, 🌡️ ${minTemp}°F to ${maxTemp}°F ${precipInfo}`);
  });
  
  // Weather maps - simplified and clean
  const mapsSection = [
    `[🌧️ Rain Map](${mapUrls.rainMap}) • [🌡️ Temperature Map](${mapUrls.tempMap}) • [☁️ Cloud Map](${mapUrls.cloudMap})`
  ].join('\n');
  
  // Create embed with dynamic color based on weather
  const embed = new EmbedBuilder()
    .setTitle(`${weatherEmoji} 5-Day Forecast for ${cityName}${stateInfo}, ${countryCode}`)
    .setColor(0x0099FF)
    .setDescription([
      `**Coordinates:** ${forecastData.city.coord.lat.toFixed(2)}, ${forecastData.city.coord.lon.toFixed(2)}`,
      '',
      ...forecastSummary
    ].join('\n'))
    .setThumbnail(`https://openweathermap.org/img/wn/${dayForecasts[Object.keys(dayForecasts)[0]][0].weather[0].icon}@4x.png`)
    .setFooter({ text: `Data provided by OpenWeatherMap • Updated ${new Date().toLocaleTimeString()}` })
    .setTimestamp();
  
  // Add maps section
  embed.addFields({ name: 'Weather Maps', value: mapsSection, inline: false });
  
  return embed;
}

// Get weather map URLs
const getWeatherMapUrls = (lat, lon) => {
  return {
    rainMap: `https://openweathermap.org/weathermap?basemap=map&cities=false&layer=radar&lat=${lat}&lon=${lon}&zoom=6`,
    tempMap: `https://openweathermap.org/weathermap?basemap=map&cities=false&layer=temperature&lat=${lat}&lon=${lon}&zoom=6`,
    cloudMap: `https://openweathermap.org/weathermap?basemap=map&cities=false&layer=clouds&lat=${lat}&lon=${lon}&zoom=6`
  };
};

// Load locations from file
function loadLocations() {
  try {
    const data = fs.readFileSync(LOCATIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading locations:', error);
    return [];
  }
}

// Save locations to file
function saveLocations(locations) {
  try {
    fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(locations, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving locations:', error);
    return false;
  }
}

// Get weather data for a location
async function getWeather(location) {
  try {
    // First get coordinates for more accurate data
    const coords = await getCoordinates(location);
    if (!coords) {
      // Fall back to direct query if geocoding fails
      const response = await axios.get(WEATHER_API_URL, {
        params: {
          q: location,
          appid: WEATHER_API_KEY,
          units: 'imperial',
        },
      });
      return response.data;
    }
    
    // Get weather using coordinates
    const weatherData = await getWeatherByCoords(coords.lat, coords.lon);
    
    // Get air quality data if available
    const airQualityData = await getAirQuality(coords.lat, coords.lon);
    
    // If we got weather data, attach the air quality and full location info
    if (weatherData) {
      if (airQualityData) {
        weatherData.airQuality = airQualityData;
      }
      
      // Add full location name if available
      weatherData.locationName = coords.name;
      if (coords.state) weatherData.locationState = coords.state;
      weatherData.locationCountry = coords.country;
    }
    
    return weatherData;
  } catch (error) {
    console.error(`Error fetching weather for ${location}:`, error.message);
    console.error('Full error:', error);
    return null;
  }
}

// Format weather data for display with enhanced visuals
function formatWeather(weatherData) {
  if (!weatherData) return null;
  
  // Get basic weather data
  const name = weatherData.locationName || weatherData.name;
  let displayName = name;
  
  // Add state if available (for US locations)
  if (weatherData.locationState) {
    displayName += `, ${weatherData.locationState}`;
  }
  
  const country = weatherData.locationCountry || weatherData.sys.country;
  const temp = Math.round(weatherData.main.temp);
  const feelsLike = Math.round(weatherData.main.feels_like);
  const description = weatherData.weather[0].description;
  const weatherId = weatherData.weather[0].id;
  const weatherIcon = weatherData.weather[0].icon;
  const humidity = weatherData.main.humidity;
  const pressure = weatherData.main.pressure;
  const windSpeed = weatherData.wind.speed;
  const windDirection = weatherData.wind.deg ? getWindDirection(weatherData.wind.deg) : '';
  const windGust = weatherData.wind.gust;
  const visibility = weatherData.visibility ? Math.round(weatherData.visibility / 1609.34 * 10) / 10 : null; // Convert meters to miles
  const cloudiness = weatherData.clouds ? weatherData.clouds.all : null;
  
  // Precipitation data if available
  const rain1h = weatherData.rain && weatherData.rain['1h'] ? weatherData.rain['1h'] : null;
  const snow1h = weatherData.snow && weatherData.snow['1h'] ? weatherData.snow['1h'] : null;
  
  // Sunrise and sunset
  const sunrise = weatherData.sys && weatherData.sys.sunrise ? formatTime(weatherData.sys.sunrise) : null;
  const sunset = weatherData.sys && weatherData.sys.sunset ? formatTime(weatherData.sys.sunset) : null;
  
  // Air quality data if available
  let aqi = null;
  if (weatherData.airQuality && weatherData.airQuality.list && weatherData.airQuality.list.length > 0) {
    aqi = weatherData.airQuality.list[0].main.aqi;
  }
  
  // Get detailed air pollutant data if available
  let pollutants = null;
  if (weatherData.airQuality && weatherData.airQuality.list && weatherData.airQuality.list.length > 0) {
    const components = weatherData.airQuality.list[0].components;
    if (components) {
      pollutants = {
        co: components.co,
        no2: components.no2,
        o3: components.o3,
        pm2_5: components.pm2_5,
        pm10: components.pm10,
        so2: components.so2
      };
    }
  }
  
  // Get weather icon URL
  const iconUrl = `${WEATHER_ICON_URL}${weatherIcon}@4x.png`; // Use larger icon
  
  // Get color based on weather condition
  const weatherColor = getWeatherColor(weatherId);
  const tempColor = getTempColor(temp);
  
  // Format min/max temperatures if available
  const tempMin = weatherData.main.temp_min ? Math.round(weatherData.main.temp_min) : null;
  const tempMax = weatherData.main.temp_max ? Math.round(weatherData.main.temp_max) : null;
  
  // Get weather emoji based on weather ID
  let weatherEmoji = '☁️'; // Default cloud
  if (weatherId >= 200 && weatherId < 300) weatherEmoji = '⚡'; // Thunderstorm
  else if (weatherId >= 300 && weatherId < 500) weatherEmoji = '🌧️'; // Drizzle
  else if (weatherId >= 500 && weatherId < 600) weatherEmoji = '🌧️'; // Rain
  else if (weatherId >= 600 && weatherId < 700) weatherEmoji = '❄️'; // Snow
  else if (weatherId >= 700 && weatherId < 800) weatherEmoji = '🌫️'; // Atmosphere
  else if (weatherId === 800) weatherEmoji = '☀️'; // Clear
  else if (weatherId > 800) weatherEmoji = '⛅'; // Partly cloudy
  
  // Create improved temperature visual bar using Unicode block elements
  // This creates a more visually appealing gradient
  const tempGradientChars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const getGradientBar = (value, min, max, width) => {
    // Normalize the value to a 0-1 range
    const normalizedValue = Math.max(0, Math.min(1, (value - min) / (max - min)));
    // Calculate position in the bar
    const position = Math.floor(normalizedValue * width);
    
    let bar = '';
    for (let i = 0; i < width; i++) {
      // Use different block characters based on proximity to the position
      const distance = Math.abs(i - position);
      const charIndex = distance >= tempGradientChars.length ? 
                        tempGradientChars.length - 1 : 
                        tempGradientChars.length - 1 - distance;
      bar += tempGradientChars[Math.max(0, charIndex)];
    }
    return bar;
  };
  
  // Temperature bar (for temperatures from -20°F to 120°F)
  const tempBar = getGradientBar(temp, -20, 120, 10);
  
  // MinMax Temperature Range Bar
  let tempRangeBar = '';
  if (tempMin !== null && tempMax !== null) {
    // Create a range bar for min to max temp with gradient in between
    const rangeWidth = 10;
    const minPos = Math.max(0, Math.min(rangeWidth - 1, Math.round((tempMin + 20) / 140 * rangeWidth)));
    const maxPos = Math.max(0, Math.min(rangeWidth - 1, Math.round((tempMax + 20) / 140 * rangeWidth)));
    
    for (let i = 0; i < rangeWidth; i++) {
      if (i < minPos) {
        tempRangeBar += '▁';
      } else if (i > maxPos) {
        tempRangeBar += '▁';
      } else {
        // Add a gradient between min and max
        const gradientPos = Math.floor(((i - minPos) / (maxPos - minPos + 0.1)) * tempGradientChars.length);
        tempRangeBar += tempGradientChars[Math.min(tempGradientChars.length - 1, Math.max(0, gradientPos))];
      }
    }
  }
  
  // Create improved cloudiness bar
  let cloudinessBar = '';
  if (cloudiness !== null) {
    const cloudLevel = Math.round(cloudiness / 100 * 8); // 0-8 scale matching our gradient chars
    for (let i = 0; i < 8; i++) {
      cloudinessBar += i < cloudLevel ? '█' : '▁';
    }
  }
  
  // Humidity bar using the same gradient system
  const humidityBar = getGradientBar(humidity, 0, 100, 8);
  
  // Visibility bar - full visibility is typically 10 miles
  const visibilityBar = visibility ? getGradientBar(visibility, 0, 10, 8) : '';
  
  // Wind speed bar - 0-50 mph range
  const windBar = getGradientBar(windSpeed, 0, 50, 8);
  
  // Time of day indicator (day/night)
  const currentTime = Math.floor(Date.now() / 1000); // Current time in Unix timestamp
  const isDaytime = sunrise && sunset ? (currentTime > weatherData.sys.sunrise && currentTime < weatherData.sys.sunset) : null;
  const timeOfDayEmoji = isDaytime === null ? '' : (isDaytime ? '☀️' : '🌙');
  
  // Create fancy card-style boxes using Unicode box drawing characters
  const createHeaderBox = (title) => {
    const boxWidth = title.length + 4;
    return `┌${'─'.repeat(boxWidth)}┐\n│  ${title}  │\n└${'─'.repeat(boxWidth)}┘`;
  };
  
  const createDataBox = (title, value, barValue = '') => {
    const boxWidth = Math.max(title.length, value.length, barValue.length) + 4;
    let box = `┌${'─'.repeat(boxWidth)}┐\n`;
    box += `│  ${title.padEnd(boxWidth - 4)}  │\n`;
    box += `│  ${value.padEnd(boxWidth - 4)}  │\n`;
    if (barValue) {
      box += `│  ${barValue.padEnd(boxWidth - 4)}  │\n`;
    }
    box += `└${'─'.repeat(boxWidth)}┘`;
    return box;
  };
  
  // Create compass rose for wind direction
  let compassRose = '';
  if (windDirection) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const dirIndex = Math.round(weatherData.wind.deg / 45) % 8;
    const highlighedDir = dirs[dirIndex];
    
    compassRose = `    N    \n    ${highlighedDir === 'N' ? '↑' : '|'}    \nNW ${highlighedDir === 'NW' ? '←' : '-'} + ${highlighedDir === 'NE' ? '→' : '-'} NE\n ${highlighedDir === 'W' ? '←' : '-'}  🌬️  ${highlighedDir === 'E' ? '→' : '-'} \nSW ${highlighedDir === 'SW' ? '←' : '-'} + ${highlighedDir === 'SE' ? '→' : '-'} SE\n    ${highlighedDir === 'S' ? '↓' : '|'}    \n    S    `;
  }
  
  // Card layouts for different data sections
  const tempCard = createDataBox('TEMPERATURE', `${temp}°F (Feels ${feelsLike}°F)`, tempBar);
  const humidityCard = createDataBox('HUMIDITY', `${humidity}%`, humidityBar);
  const windCard = createDataBox('WIND', `${windSpeed} mph ${windDirection}`, windBar);
  const cloudsCard = createDataBox('CLOUDINESS', `${cloudiness}%`, cloudinessBar);
  
  return {
    name: displayName,
    country,
    temp,
    feelsLike,
    description,
    weatherId,
    weatherIcon,
    iconUrl,
    humidity,
    pressure,
    windSpeed,
    windDirection,
    windGust,
    visibility,
    cloudiness,
    cloudinessBar,
    humidityBar,
    visibilityBar,
    windBar,
    compassRose,
    rain1h,
    snow1h,
    sunrise,
    sunset,
    aqi,
    pollutants,
    weatherColor,
    tempColor,
    tempMin,
    tempMax,
    tempBar,
    tempRangeBar,
    tempCard,
    humidityCard, 
    windCard,
    cloudsCard,
    weatherEmoji,
    timeOfDayEmoji,
    isDaytime,
    createHeaderBox,
    createDataBox,
    coords: {
      lat: weatherData.coord.lat,
      lon: weatherData.coord.lon
    }
  };
}

// Geocoding function to get coordinates from location name
async function getCoordinates(location) {
  try {
    const response = await axios.get(GEOCODING_API_URL, {
      params: {
        q: location,
        limit: 1,
        appid: WEATHER_API_KEY,
      },
    });
    
    if (response.data && response.data.length > 0) {
      const { lat, lon, name, country, state } = response.data[0];
      return {
        lat,
        lon,
        name,
        country,
        state
      };
    }
    return null;
  } catch (error) {
    console.error(`Error geocoding ${location}:`, error.message);
    return null;
  }
}

// Get weather data for a location using coordinates
async function getWeatherByCoords(lat, lon) {
  try {
    const response = await axios.get(WEATHER_API_URL, {
      params: {
        lat,
        lon,
        appid: WEATHER_API_KEY,
        units: 'imperial',
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching weather for coordinates (${lat},${lon}):`, error.message);
    return null;
  }
}

// Get air quality data for coordinates
async function getAirQuality(lat, lon) {
  try {
    const response = await axios.get(AIR_POLLUTION_API_URL, {
      params: {
        lat,
        lon,
        appid: WEATHER_API_KEY,
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching air quality for coordinates (${lat},${lon}):`, error.message);
    return null;
  }
}

// Get OneCall API data (comprehensive weather)
async function getOneCallData(lat, lon) {
  try {
    const response = await axios.get(ONECALL_API_URL, {
      params: {
        lat,
        lon,
        exclude: 'minutely', // Exclude minutely forecasts to reduce data
        appid: WEATHER_API_KEY,
        units: 'imperial',
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching OneCall data for coordinates (${lat},${lon}):`, error.message);
    return null;
  }
}

// Get forecast data for a location
async function getForecast(location) {
  try {
    // First get coordinates for more accurate data
    const coords = await getCoordinates(location);
    if (!coords) {
      // Fall back to direct query if geocoding fails
      const response = await axios.get(FORECAST_API_URL, {
        params: {
          q: location,
          appid: WEATHER_API_KEY,
          units: 'imperial',
        },
      });
      return response.data;
    }
    
    // Use coordinates for forecast
    const response = await axios.get(FORECAST_API_URL, {
      params: {
        lat: coords.lat,
        lon: coords.lon,
        appid: WEATHER_API_KEY,
        units: 'imperial',
      },
    });
    
    // Add the full location name to the response
    response.data.locationName = coords.name;
    if (coords.state) response.data.locationState = coords.state;
    response.data.locationCountry = coords.country;
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching forecast for ${location}:`, error.message);
    console.error('Full error:', error);
    return null;
  }
}

// Client ready event
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// Helper function to create a clean, sleek weather display
function createWeatherDisplay(formattedWeather, mapUrls) {
  // Create capitalized description
  const capitalizedDescription = formattedWeather.description.charAt(0).toUpperCase() + formattedWeather.description.slice(1);
  
  // Create a cleaner temperature display
  const tempDisplay = `${formattedWeather.temp}°F (Feels like ${formattedWeather.feelsLike}°F)`;
  const tempRangeDisplay = formattedWeather.tempMin !== null && formattedWeather.tempMax !== null ? 
    `Range: ${formattedWeather.tempMin}°F - ${formattedWeather.tempMax}°F` : '';
  
  // Current conditions section
  const currentConditionsSection = [
    `🌡️ **Temperature:** ${tempDisplay}`,
    tempRangeDisplay ? `${tempRangeDisplay}` : '',
    `💧 **Humidity:** ${formattedWeather.humidity}%`,
    `🌬️ **Wind:** ${formattedWeather.windSpeed} mph ${formattedWeather.windDirection || ''}${formattedWeather.windGust ? ` (Gusts: ${Math.round(formattedWeather.windGust)} mph)` : ''}`,
  ].filter(Boolean).join('\n');
  
  // Create a less detailed but more readable details section
  const detailsSection = [
    `☁️ **Cloudiness:** ${formattedWeather.cloudiness !== null ? formattedWeather.cloudiness + '%' : 'N/A'}`,
    `👁️ **Visibility:** ${formattedWeather.visibility ? formattedWeather.visibility + ' miles' : 'N/A'}`,
    `🧭 **Pressure:** ${formattedWeather.pressure ? formattedWeather.pressure + ' hPa' : 'N/A'}`
  ].join('\n');
  
  // Sun times section - simpler
  const sunTimesSection = [
    `🌅 **Sunrise:** ${formattedWeather.sunrise || 'N/A'}`,
    `🌇 **Sunset:** ${formattedWeather.sunset || 'N/A'}`
  ].join('\n');
  
  // Air quality section - only if available
  let airQualitySection = '';
  if (formattedWeather.aqi !== null) {
    const aqiInfo = getAqiDescription(formattedWeather.aqi);
    
    airQualitySection = [
      `${aqiInfo.emoji} **Air Quality:** ${aqiInfo.label} (${formattedWeather.aqi}/5)`,
      aqiInfo.description
    ].join('\n');
  }
  
  // Precipitation - only if available
  let precipitationSection = '';
  if (formattedWeather.rain1h !== null || formattedWeather.snow1h !== null) {
    const precipType = formattedWeather.rain1h !== null ? 'Rainfall' : 'Snowfall';
    const precipValue = formattedWeather.rain1h !== null ? formattedWeather.rain1h : formattedWeather.snow1h;
    const precipEmoji = formattedWeather.rain1h !== null ? '☔' : '❄️';
    
    precipitationSection = `${precipEmoji} **${precipType}:** ${precipValue} mm`;
  }
  
  // Maps section - clean links
  const mapsSection = [
    `[🌧️ Rain Map](${mapUrls.rainMap}) • [🌡️ Temperature Map](${mapUrls.tempMap}) • [☁️ Cloud Map](${mapUrls.cloudMap})`
  ].join('\n');
  
  // Create embed with dynamic color based on weather
  const embed = new EmbedBuilder()
    .setTitle(`${formattedWeather.weatherEmoji} Weather in ${formattedWeather.name}, ${formattedWeather.country}`)
    .setColor(formattedWeather.weatherColor)
    .setThumbnail(formattedWeather.iconUrl)
    .setDescription([
      `**${capitalizedDescription}**`,
      `**Coordinates:** ${formattedWeather.coords.lat.toFixed(2)}, ${formattedWeather.coords.lon.toFixed(2)}`,
      '',
      '### Current Conditions',
      currentConditionsSection,
      '',
      '### Details',
      detailsSection,
      '',
      '### Sun Times',
      sunTimesSection
    ].filter(Boolean).join('\n'))
    .setFooter({ text: `Data provided by OpenWeatherMap • Updated ${new Date().toLocaleTimeString()}` })
    .setTimestamp();
  
  // Add air quality if available
  if (airQualitySection) {
    embed.addFields({ name: 'Air Quality', value: airQualitySection, inline: false });
  }
  
  // Add precipitation if available
  if (precipitationSection) {
    embed.addFields({ name: 'Precipitation', value: precipitationSection, inline: false });
  }
  
  // Add maps section
  embed.addFields({ name: 'Weather Maps', value: mapsSection, inline: false });
  
  return embed;
}

// Slash command interaction handler
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  // Handle weather command
  if (commandName === 'weather') {
    const location = interaction.options.getString('location');
    
    if (location) {
      // If location is provided with the command
      await interaction.deferReply();
      const weatherData = await getWeather(location);
      
      if (!weatherData) {
        return interaction.editReply(`Could not find weather data for ${location}.`);
      }
      
      const formattedWeather = formatWeather(weatherData);
      
      // Generate weather maps
      const mapUrls = getWeatherMapUrls(formattedWeather.coords.lat, formattedWeather.coords.lon);
      
      // Use our helper function to create a visually enhanced weather display
      const embed = createWeatherDisplay(formattedWeather, mapUrls);
      
      // Send the response
      interaction.editReply({ embeds: [embed] });
    } else {
      // Show weather for all saved locations
      await interaction.deferReply();
      const locations = loadLocations();
      
      if (locations.length === 0) {
        return interaction.editReply('No locations are saved. Add locations with `/addlocation <location_name>`.');
      }
      
      const weatherPromises = locations.map(location => getWeather(location));
      const weatherDataArray = await Promise.all(weatherPromises);
      
      const validWeatherData = weatherDataArray.filter(data => data !== null);
      
      if (validWeatherData.length === 0) {
        return interaction.editReply('Could not fetch weather data for any saved locations.');
      }
      
      // Main embed for saved locations
      const embed = new EmbedBuilder()
        .setTitle('📍 Weather for Your Saved Locations')
        .setColor(0x0099FF)
        .setDescription('Current weather conditions for your saved locations.')
        .setTimestamp();
      
      // Add each location as a clean, formatted field
      validWeatherData.forEach(data => {
        const formatted = formatWeather(data);
        
        // Create a clean, consistent display similar to the single location view
        const tempDisplay = `${formatted.temp}°F (Feels like: ${formatted.feelsLike}°F)`;
        const tempRange = formatted.tempMin !== null && formatted.tempMax !== null ? 
          `Range: ${formatted.tempMin}°F - ${formatted.tempMax}°F` : '';
        
        // Format wind with direction if available
        const windInfo = formatted.windDirection ? 
          `${formatted.windSpeed} mph ${formatted.windDirection}` : 
          `${formatted.windSpeed} mph`;
        
        // Air quality info if available
        const aqiDisplay = formatted.aqi !== null ? 
          `| ${getAqiDescription(formatted.aqi).emoji} AQI: ${getAqiDescription(formatted.aqi).label}` : 
          '';
        
        // Capitalize weather description
        const capitalizedDescription = formatted.description.charAt(0).toUpperCase() + formatted.description.slice(1);
        
        // Create a consistent, clean field for each location
        embed.addFields({
          name: `${formatted.weatherEmoji} ${formatted.name}, ${formatted.country}`,
          value: [
            `**${capitalizedDescription}**`,
            '',
            `🌡️ **Temperature:** ${tempDisplay}`,
            tempRange ? `${tempRange}` : '',
            `💧 **Humidity:** ${formatted.humidity}% | 🌬️ **Wind:** ${windInfo} ${aqiDisplay}`,
            `🌅 **Sunrise:** ${formatted.sunrise || 'N/A'} | 🌇 **Sunset:** ${formatted.sunset || 'N/A'}`,
            '',
            `[View detailed forecast](/weather ${formatted.name})`
          ].filter(Boolean).join('\n'),
          inline: false,
        });
      });
      
      // Add a helpful tip
      embed.addFields({
        name: 'Need more details?',
        value: 'Use `/weather <location_name>` to get detailed weather for a specific location.',
        inline: false
      });
      
      interaction.editReply({ embeds: [embed] });
    }
  }
  
  // Handle addlocation command
  if (commandName === 'addlocation') {
    const location = interaction.options.getString('location');
    await interaction.deferReply();
    
    // Test if the location is valid by trying to get weather data
    const weatherData = await getWeather(location);
    
    if (!weatherData) {
      return interaction.editReply(`Could not find weather data for ${location}. Please check the spelling and try again.`);
    }
    
    const locations = loadLocations();
    
    // Check if location is already saved
    if (locations.includes(location)) {
      return interaction.editReply(`${location} is already in the saved locations.`);
    }
    
    // Add new location
    locations.push(location);
    
    if (saveLocations(locations)) {
      interaction.editReply(`Added ${location} to saved locations.`);
    } else {
      interaction.editReply('Failed to save location. Please try again later.');
    }
  }
  
  // Handle removelocation command
  if (commandName === 'removelocation') {
    const location = interaction.options.getString('location');
    await interaction.deferReply();
    
    const locations = loadLocations();
    
    const index = locations.indexOf(location);
    if (index === -1) {
      return interaction.editReply(`${location} is not in the saved locations.`);
    }
    
    // Remove location
    locations.splice(index, 1);
    
    if (saveLocations(locations)) {
      interaction.editReply(`Removed ${location} from saved locations.`);
    } else {
      interaction.editReply('Failed to remove location. Please try again later.');
    }
  }
  
  // Handle listlocations command
  if (commandName === 'listlocations') {
    await interaction.deferReply();
    const locations = loadLocations();
    
    if (locations.length === 0) {
      return interaction.editReply('No locations are saved. Add locations with `/addlocation <location_name>`.');
    }
    
    const locationList = locations.map((loc, index) => `${index + 1}. ${loc}`).join('\n');
    
    const embed = new EmbedBuilder()
      .setTitle('Saved Locations')
      .setDescription(locationList)
      .setColor(0x0099FF)
      .setTimestamp();
    
    interaction.editReply({ embeds: [embed] });
  }
  
  // Handle forecast command - simplified implementation
  if (commandName === 'forecast') {
    try {
      // Get location 
      const location = interaction.options.getString('location');
      if (!location) {
        return interaction.reply('Please provide a location for the forecast.');
      }
      
      // Log that we received the command
      console.log(`Slash command: Fetching forecast for ${location}`);
      
      // Defer reply to prevent timeout
      await interaction.deferReply();
      
      // Get forecast data
      const forecastData = await getForecast(location);
      
      if (!forecastData) {
        return interaction.editReply(`Could not find forecast data for ${location}.`);
      }
      
      console.log(`Received forecast data for ${location}`);
      
      // Group forecast data by day
      const dailyData = {};
      
      forecastData.list.forEach(forecast => {
        const date = new Date(forecast.dt * 1000);
        const day = date.toDateString();
        
        if (!dailyData[day]) {
          dailyData[day] = [];
        }
        
        dailyData[day].push(forecast);
      });
      
      // Generate weather maps for the location
      const mapUrls = getWeatherMapUrls(forecastData.city.coord.lat, forecastData.city.coord.lon);
      
      // Create the main forecast embed using our helper function
      const mainEmbed = createForecastDisplay(forecastData, dailyData, mapUrls);
      
      // Send the main forecast overview
      await interaction.editReply({ embeds: [mainEmbed] });
      console.log(`Successfully sent forecast response`);
      
      // Add a simple follow-up with today's hourly breakdown
      try {
        // Get the first day only
        const firstDay = Object.keys(dailyData)[0];
        if (firstDay) {
          const dayForecasts = dailyData[firstDay];
          
          // Format the day
          const date = new Date(firstDay);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
          
          // Find the dominant weather
          let dominantWeather = dayForecasts[0].weather[0];
          dayForecasts.forEach(forecast => {
            const weatherId = forecast.weather[0].id;
            if (weatherId < dominantWeather.id || 
                (weatherId >= 500 && weatherId < 600 && dominantWeather.id >= 800) || 
                (weatherId >= 600 && weatherId < 700 && dominantWeather.id >= 800)) {
              dominantWeather = forecast.weather[0];
            }
          });
          
          // Weather emoji
          let weatherEmoji = '☁️';
          if (dominantWeather.id >= 200 && dominantWeather.id < 300) weatherEmoji = '⚡'; 
          else if (dominantWeather.id >= 300 && dominantWeather.id < 500) weatherEmoji = '🌧️';
          else if (dominantWeather.id >= 500 && dominantWeather.id < 600) weatherEmoji = '🌧️';
          else if (dominantWeather.id >= 600 && dominantWeather.id < 700) weatherEmoji = '❄️';
          else if (dominantWeather.id >= 700 && dominantWeather.id < 800) weatherEmoji = '🌫️';
          else if (dominantWeather.id === 800) weatherEmoji = '☀️';
          else if (dominantWeather.id > 800) weatherEmoji = '⛅';
          
          // Calculate statistics
          const temps = dayForecasts.map(f => f.main.temp);
          const minTemp = Math.min(...temps).toFixed(0);
          const maxTemp = Math.max(...temps).toFixed(0);
          
          // Create a simple hourly forecast
          const hourlyBreakdown = [];
          hourlyBreakdown.push(`## ${weatherEmoji} Today's Hourly Forecast: ${dayName}`);
          hourlyBreakdown.push('');
          
          // Get the first 6 forecasts for today (usually 3-hour intervals)
          dayForecasts.slice(0, 6).forEach(forecast => {
            const time = new Date(forecast.dt * 1000).toLocaleTimeString([], { hour: 'numeric' });
            const temp = Math.round(forecast.main.temp);
            const condition = forecast.weather[0].description;
            const precip = forecast.pop ? `${Math.round(forecast.pop * 100)}% chance of precipitation` : '';
            
            // Get appropriate emoji
            let emoji = '☁️';
            if (forecast.weather[0].id >= 200 && forecast.weather[0].id < 300) emoji = '⚡';
            else if (forecast.weather[0].id >= 300 && forecast.weather[0].id < 500) emoji = '🌧️';
            else if (forecast.weather[0].id >= 500 && forecast.weather[0].id < 600) emoji = '🌧️';
            else if (forecast.weather[0].id >= 600 && forecast.weather[0].id < 700) emoji = '❄️';
            else if (forecast.weather[0].id >= 700 && forecast.weather[0].id < 800) emoji = '🌫️';
            else if (forecast.weather[0].id === 800) emoji = '☀️';
            else if (forecast.weather[0].id > 800) emoji = '⛅';
            
            hourlyBreakdown.push(`**${time}**: ${emoji} ${temp}°F - ${condition.charAt(0).toUpperCase() + condition.slice(1)} ${precip ? `(${precip})` : ''}`);
          });
          
          // Send a follow-up message after a short delay
          setTimeout(() => {
            interaction.channel.send(hourlyBreakdown.join('\n'))
              .catch(err => console.error('Error sending hourly breakdown:', err));
          }, 500);
        }
      } catch (followUpError) {
        console.error('Error sending hourly details:', followUpError);
        // Continue execution - don't let this secondary error affect the main response
      }
      
    } catch (error) {
      console.error('Error in forecast command:', error);
      
      // Attempt to send an error message
      try {
        if (interaction.deferred) {
          await interaction.editReply('There was an error processing your forecast request. Please try again later.');
        } else {
          await interaction.reply({ content: 'There was an error processing your forecast request. Please try again later.', ephemeral: true });
        }
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    }
  }
  
  // Handle weatherhelp command
  if (commandName === 'weatherhelp') {
    const embed = new EmbedBuilder()
      .setTitle('🌦️ Weather Bot Commands')
      .setDescription('Here are all the available commands and features you can use with the Weather Bot:')
      .setColor(0x0099FF)
      .addFields(
        { 
          name: '📊 Weather Information', 
          value: [
            '`/weather` - Show detailed weather for all saved locations',
            '`/weather [location]` - Show comprehensive weather for a specific location',
            '`/forecast <location>` - Get detailed 5-day weather forecast with time breakdown'
          ].join('\n'),
          inline: false 
        },
        { 
          name: '📝 Location Management', 
          value: [
            '`/addlocation <location>` - Add a location to your saved locations',
            '`/removelocation <location>` - Remove a location from your saved locations',
            '`/listlocations` - List all your saved locations'
          ].join('\n'),
          inline: false 
        },
        { 
          name: '🌟 Enhanced Features', 
          value: [
            '• **Visual Weather Indicators** - Temperature bars, cloud coverage visualization',
            '• **Dynamic Weather Colors** - UI colors change based on weather conditions',
            '• **Interactive Weather Maps** - Access to rain, temperature and cloud maps',
            '• **Air Quality Information** - AQI and detailed pollutant data where available',
            '• **Time-of-Day Awareness** - Day/night indicators based on sunrise/sunset',
            '• **Daily Breakdown** - Morning, afternoon, and evening forecasts',
            '• **Hourly Forecasts** - Detailed hourly weather for the current day',
            '• **Weather Trends** - Temperature ranges and precipitation probabilities'
          ].join('\n'),
          inline: false 
        },
        { 
          name: '🔍 Detailed Weather Data', 
          value: [
            '• Wind speed, direction, and gusts',
            '• Humidity and atmospheric pressure',
            '• Visibility and cloudiness percentage',
            '• Precipitation measurements and probabilities',
            '• Sunrise and sunset times',
            '• Temperature feels-like and min/max values'
          ].join('\n'),
          inline: false 
        },
        { 
          name: '❓ Help', 
          value: '`/weatherhelp` - Show this help message',
          inline: false 
        }
      )
      .setFooter({ text: 'Data provided by OpenWeatherMap • Weather Bot v3.0' })
      .setTimestamp();
    
    interaction.reply({ embeds: [embed] });
  }
});

// Message event handler
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  
  const prefix = '!';
  if (!message.content.startsWith(prefix)) return;
  
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  
  // Log the command for debugging
  console.log(`Processing command: ${command} with args: ${args.join(' ')}`);
  
  if (command === 'weather') {
    // If location is provided with the command
    if (args.length > 0) {
      const location = args.join(' ');
      // Let the user know we're processing
      const loadingMessage = await message.reply('⌛ Fetching the latest weather data...');
      
      const weatherData = await getWeather(location);
      
      if (!weatherData) {
        return loadingMessage.edit(`Could not find weather data for ${location}.`);
      }
      
      const formattedWeather = formatWeather(weatherData);
      
      // Generate weather maps
      const mapUrls = getWeatherMapUrls(formattedWeather.coords.lat, formattedWeather.coords.lon);
      
      // Use our helper function to create a clean weather display
      const embed = createWeatherDisplay(formattedWeather, mapUrls);
      
      // Edit the loading message with the weather data
      loadingMessage.edit({ content: null, embeds: [embed] });
    } else {
      // Show weather for all saved locations
      const locations = loadLocations();
      
      if (locations.length === 0) {
        return message.reply('No locations are saved. Add locations with `!addlocation <location_name>`.');
      }
      
      // Let user know we're fetching data
      const loadingMessage = await message.reply('⌛ Fetching weather for all saved locations...');
      
      const weatherPromises = locations.map(location => getWeather(location));
      const weatherDataArray = await Promise.all(weatherPromises);
      
      const validWeatherData = weatherDataArray.filter(data => data !== null);
      
      if (validWeatherData.length === 0) {
        return loadingMessage.edit('Could not fetch weather data for any saved locations.');
      }
      
      // Create a clean overview embed with consistent styling
      const mainEmbed = new EmbedBuilder()
        .setTitle('📍 Weather for Your Saved Locations')
        .setColor(0x0099FF)
        .setDescription('Current weather conditions for your saved locations.')
        .setTimestamp();
      
      // Add each location as a clean, formatted field (consistent with slash command)
      validWeatherData.forEach(data => {
        const formatted = formatWeather(data);
        
        // Create a clean, consistent display similar to the single location view
        const tempDisplay = `${formatted.temp}°F (Feels like: ${formatted.feelsLike}°F)`;
        const tempRange = formatted.tempMin !== null && formatted.tempMax !== null ? 
          `Range: ${formatted.tempMin}°F - ${formatted.tempMax}°F` : '';
        
        // Format wind with direction if available
        const windInfo = formatted.windDirection ? 
          `${formatted.windSpeed} mph ${formatted.windDirection}` : 
          `${formatted.windSpeed} mph`;
        
        // Air quality info if available
        const aqiDisplay = formatted.aqi !== null ? 
          `| ${getAqiDescription(formatted.aqi).emoji} AQI: ${getAqiDescription(formatted.aqi).label}` : 
          '';
        
        // Capitalize weather description
        const capitalizedDescription = formatted.description.charAt(0).toUpperCase() + formatted.description.slice(1);
        
        // Create a consistent, clean field for each location
        mainEmbed.addFields({
          name: `${formatted.weatherEmoji} ${formatted.name}, ${formatted.country}`,
          value: [
            `**${capitalizedDescription}**`,
            '',
            `🌡️ **Temperature:** ${tempDisplay}`,
            tempRange ? `${tempRange}` : '',
            `💧 **Humidity:** ${formatted.humidity}% | 🌬️ **Wind:** ${windInfo} ${aqiDisplay}`,
            `🌅 **Sunrise:** ${formatted.sunrise || 'N/A'} | 🌇 **Sunset:** ${formatted.sunset || 'N/A'}`
          ].filter(Boolean).join('\n'),
          inline: false,
        });
      });
      
      // Add a helpful tip
      mainEmbed.addFields({
        name: 'Need more details?',
        value: 'Use `!weather <location_name>` to get detailed weather for a specific location.',
        inline: false
      });
      
      // Edit the loading message with the full weather data
      loadingMessage.edit({ content: null, embeds: [mainEmbed] });
    }
  }
  
  if (command === 'addlocation') {
    if (args.length === 0) {
      return message.reply('Please provide a location to add.');
    }
    
    const location = args.join(' ');
    
    // Test if the location is valid by trying to get weather data
    const weatherData = await getWeather(location);
    
    if (!weatherData) {
      return message.reply(`Could not find weather data for ${location}. Please check the spelling and try again.`);
    }
    
    const locations = loadLocations();
    
    // Check if location is already saved
    if (locations.includes(location)) {
      return message.reply(`${location} is already in the saved locations.`);
    }
    
    // Add new location
    locations.push(location);
    
    if (saveLocations(locations)) {
      message.reply(`Added ${location} to saved locations.`);
    } else {
      message.reply('Failed to save location. Please try again later.');
    }
  }
  
  if (command === 'removelocation') {
    if (args.length === 0) {
      return message.reply('Please provide a location to remove.');
    }
    
    const location = args.join(' ');
    const locations = loadLocations();
    
    const index = locations.indexOf(location);
    if (index === -1) {
      return message.reply(`${location} is not in the saved locations.`);
    }
    
    // Remove location
    locations.splice(index, 1);
    
    if (saveLocations(locations)) {
      message.reply(`Removed ${location} from saved locations.`);
    } else {
      message.reply('Failed to remove location. Please try again later.');
    }
  }
  
  if (command === 'listlocations') {
    const locations = loadLocations();
    
    if (locations.length === 0) {
      return message.reply('No locations are saved. Add locations with `!addlocation <location_name>`.');
    }
    
    const locationList = locations.map((loc, index) => `${index + 1}. ${loc}`).join('\n');
    
    const embed = new EmbedBuilder()
      .setTitle('Saved Locations')
      .setDescription(locationList)
      .setColor(0x0099FF)
      .setTimestamp();
    
    message.reply({ embeds: [embed] });
  }
  
  if (command === 'forecast') {
    if (args.length === 0) {
      return message.reply('Please provide a location for the forecast.');
    }
    
    const location = args.join(' ');
    
    // Let user know we're fetching data
    const loadingMessage = await message.reply('⌛ Fetching forecast data...');
    
    try {
      console.log(`Text command: Fetching forecast for ${location}`);
      
      // Get forecast data
      const forecastData = await getForecast(location);
      
      if (!forecastData) {
        return loadingMessage.edit(`Could not find forecast data for ${location}.`);
      }
      
      console.log(`Received forecast data for ${location}`);
      
      // Group forecast data by day
      const dailyData = {};
      
      forecastData.list.forEach(forecast => {
        const date = new Date(forecast.dt * 1000);
        const day = date.toDateString();
        
        if (!dailyData[day]) {
          dailyData[day] = [];
        }
        
        dailyData[day].push(forecast);
      });
      
      // Generate weather maps for the location
      const mapUrls = getWeatherMapUrls(forecastData.city.coord.lat, forecastData.city.coord.lon);
      
      // Create the main forecast embed using our helper function
      const mainEmbed = createForecastDisplay(forecastData, dailyData, mapUrls);
      
      // Send the main forecast overview
      await loadingMessage.edit({ content: null, embeds: [mainEmbed] });
      console.log(`Successfully sent forecast response for text command`);
      
      // Add a simple follow-up with today's hourly breakdown (consistent with slash command)
      try {
        // Get the first day only
        const firstDay = Object.keys(dailyData)[0];
        if (firstDay) {
          const dayForecasts = dailyData[firstDay];
          
          // Format the day
          const date = new Date(firstDay);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
          
          // Find the dominant weather
          let dominantWeather = dayForecasts[0].weather[0];
          dayForecasts.forEach(forecast => {
            const weatherId = forecast.weather[0].id;
            if (weatherId < dominantWeather.id || 
                (weatherId >= 500 && weatherId < 600 && dominantWeather.id >= 800) || 
                (weatherId >= 600 && weatherId < 700 && dominantWeather.id >= 800)) {
              dominantWeather = forecast.weather[0];
            }
          });
          
          // Weather emoji
          let weatherEmoji = '☁️';
          if (dominantWeather.id >= 200 && dominantWeather.id < 300) weatherEmoji = '⚡'; 
          else if (dominantWeather.id >= 300 && dominantWeather.id < 500) weatherEmoji = '🌧️';
          else if (dominantWeather.id >= 500 && dominantWeather.id < 600) weatherEmoji = '🌧️';
          else if (dominantWeather.id >= 600 && dominantWeather.id < 700) weatherEmoji = '❄️';
          else if (dominantWeather.id >= 700 && dominantWeather.id < 800) weatherEmoji = '🌫️';
          else if (dominantWeather.id === 800) weatherEmoji = '☀️';
          else if (dominantWeather.id > 800) weatherEmoji = '⛅';
          
          // Create a simple hourly forecast
          const hourlyBreakdown = [];
          hourlyBreakdown.push(`## ${weatherEmoji} Today's Hourly Forecast: ${dayName}`);
          hourlyBreakdown.push('');
          
          // Get the first 6 forecasts for today (usually 3-hour intervals)
          dayForecasts.slice(0, 6).forEach(forecast => {
            const time = new Date(forecast.dt * 1000).toLocaleTimeString([], { hour: 'numeric' });
            const temp = Math.round(forecast.main.temp);
            const condition = forecast.weather[0].description;
            const precip = forecast.pop ? `${Math.round(forecast.pop * 100)}% chance of precipitation` : '';
            
            // Get appropriate emoji
            let emoji = '☁️';
            if (forecast.weather[0].id >= 200 && forecast.weather[0].id < 300) emoji = '⚡';
            else if (forecast.weather[0].id >= 300 && forecast.weather[0].id < 500) emoji = '🌧️';
            else if (forecast.weather[0].id >= 500 && forecast.weather[0].id < 600) emoji = '🌧️';
            else if (forecast.weather[0].id >= 600 && forecast.weather[0].id < 700) emoji = '❄️';
            else if (forecast.weather[0].id >= 700 && forecast.weather[0].id < 800) emoji = '🌫️';
            else if (forecast.weather[0].id === 800) emoji = '☀️';
            else if (forecast.weather[0].id > 800) emoji = '⛅';
            
            hourlyBreakdown.push(`**${time}**: ${emoji} ${temp}°F - ${condition.charAt(0).toUpperCase() + condition.slice(1)} ${precip ? `(${precip})` : ''}`);
          });
          
          // Send a follow-up message after a short delay (same format as slash command)
          setTimeout(() => {
            message.channel.send(hourlyBreakdown.join('\n'))
              .catch(err => console.error('Error sending hourly breakdown:', err));
          }, 500);
        }
      } catch (followUpError) {
        console.error('Error sending hourly details:', followUpError);
        // Continue execution - don't let this secondary error affect the main response
      }
      
    } catch (error) {
      console.error('Error in forecast command:', error);
      loadingMessage.edit('There was an error processing your forecast request. Please try again later.');
    }
  }
  
  if (command === 'help') {
    const embed = new EmbedBuilder()
      .setTitle('🌦️ Weather Bot Commands')
      .setDescription('Here are all the available commands and features you can use with the Weather Bot:')
      .setColor(0x0099FF)
      .addFields(
        { 
          name: '📊 Weather Information', 
          value: [
            '`!weather` - Show detailed weather for all saved locations',
            '`!weather <location>` - Show comprehensive weather for a specific location',
            '`!forecast <location>` - Get detailed 5-day weather forecast with time breakdown'
          ].join('\n'),
          inline: false 
        },
        { 
          name: '📝 Location Management', 
          value: [
            '`!addlocation <location>` - Add a location to your saved locations',
            '`!removelocation <location>` - Remove a location from your saved locations',
            '`!listlocations` - List all your saved locations'
          ].join('\n'),
          inline: false 
        },
        { 
          name: '🌟 Enhanced Features', 
          value: [
            '• **Visual Weather Indicators** - Temperature bars, cloud coverage visualization',
            '• **Dynamic Weather Colors** - UI colors change based on weather conditions',
            '• **Interactive Weather Maps** - Access to rain, temperature and cloud maps',
            '• **Air Quality Information** - AQI and detailed pollutant data where available',
            '• **Time-of-Day Awareness** - Day/night indicators based on sunrise/sunset',
            '• **Daily Breakdown** - Morning, afternoon, and evening forecasts',
            '• **Hourly Forecasts** - Detailed hourly weather for the current day',
            '• **Weather Trends** - Temperature ranges and precipitation probabilities'
          ].join('\n'),
          inline: false 
        },
        { 
          name: '🔍 Detailed Weather Data', 
          value: [
            '• Wind speed, direction, and gusts',
            '• Humidity and atmospheric pressure',
            '• Visibility and cloudiness percentage',
            '• Precipitation measurements and probabilities',
            '• Sunrise and sunset times',
            '• Temperature feels-like and min/max values'
          ].join('\n'),
          inline: false 
        },
        { 
          name: '❓ Help & Debug', 
          value: [
            '`!help` - Show this help message',
            '`!debugweather <location>` - Debug weather API call (admin only)'
          ].join('\n'),
          inline: false 
        },
        {
          name: '💡 Pro Tip',
          value: 'Use slash commands (`/weather`, `/forecast`, etc.) for the best experience and faster responses!',
          inline: false
        }
      )
      .setFooter({ text: 'Data provided by OpenWeatherMap • Weather Bot v3.0' })
      .setTimestamp();
    
    message.reply({ embeds: [embed] });
  }
  
  if (command === 'debugweather') {
    if (args.length === 0) {
      return message.reply('Please provide a location for debugging.');
    }
    
    const location = args.join(' ');
    message.reply(`Attempting to get weather for: "${location}"`);
    
    console.log('Making API request for location:', location);
    console.log('API Key defined:', !!WEATHER_API_KEY);
    console.log('API URL:', WEATHER_API_URL);
    
    try {
      axios.get(WEATHER_API_URL, {
        params: {
          q: location,
          appid: WEATHER_API_KEY,
          units: 'imperial',
        },
      })
      .then(response => {
        console.log('API response successful!');
        message.reply(`API call successful! Found weather for ${response.data.name}, ${response.data.sys.country}`);
      })
      .catch(error => {
        console.error('API error:', error.message);
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
          message.reply(`API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else {
          message.reply(`API Error: ${error.message}`);
        }
      });
    } catch (error) {
      console.error('Exception during API call:', error);
      message.reply(`Exception during API call: ${error.message}`);
    }
  }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);