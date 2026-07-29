require('dotenv').config();

const config = {
  port: process.env.PORT || '3000',
  openMeteo: {
    geocodingUrl:
      process.env.OPEN_METEO_GEOCODING_URL ||
      'https://geocoding-api.open-meteo.com/v1/search',
    forecastUrl:
      process.env.OPEN_METEO_FORECAST_URL ||
      'https://api.open-meteo.com/v1/forecast'
  },
  weatherTimeoutMs: Number(process.env.WEATHER_TIMEOUT_MS || 3000)
};

module.exports = config;
