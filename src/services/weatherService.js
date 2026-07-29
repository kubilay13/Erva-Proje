function createWeatherService(options = {}) {
  const fetchImpl = options.fetchImpl || global.fetch;
  const geocodingUrl = options.geocodingUrl;
  const forecastUrl = options.forecastUrl;
  const timeoutMs = options.timeoutMs || 3000;

  async function fetchJson(url) {
    if (!fetchImpl) {
      throw new Error('Fetch API is not available.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(url, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(`Open-Meteo request failed with ${response.status}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function getWeatherForCity(city) {
    try {
      const locationUrl = new URL(geocodingUrl);
      locationUrl.searchParams.set('name', city);
      locationUrl.searchParams.set('count', '1');
      locationUrl.searchParams.set('language', 'en');
      locationUrl.searchParams.set('format', 'json');

      const locationData = await fetchJson(locationUrl);
      const location = locationData.results && locationData.results[0];

      if (!location) {
        return null;
      }

      const weatherUrl = new URL(forecastUrl);
      weatherUrl.searchParams.set('latitude', String(location.latitude));
      weatherUrl.searchParams.set('longitude', String(location.longitude));
      weatherUrl.searchParams.set('current', 'temperature_2m');
      weatherUrl.searchParams.set('timezone', 'auto');

      const weatherData = await fetchJson(weatherUrl);
      const temperature = weatherData.current && weatherData.current.temperature_2m;

      if (typeof temperature !== 'number') {
        return null;
      }

      return {
        temperature,
        unit: weatherData.current_units && weatherData.current_units.temperature_2m
          ? weatherData.current_units.temperature_2m
          : 'celsius',
        city: location.name,
        country: location.country || null,
        latitude: location.latitude,
        longitude: location.longitude,
        fetchedAt: new Date().toISOString()
      };
    } catch (error) {
      return null;
    }
  }

  return {
    getWeatherForCity
  };
}

module.exports = createWeatherService;
