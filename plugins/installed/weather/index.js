const { PluginBase } = require('../../base');
const { request } = require('../../../core/http-client');

class WeatherPlugin extends PluginBase {
  constructor(manifest) {
    super(manifest);

    this.registerCommand({
      name: 'weather',
      aliases: ['forecast', 'temperature'],
      description: 'Get current weather for a location',
      usage: 'weather <city>',
      run: (args) => this.getWeather(args),
    });
  }

  async getWeather(args) {
    const query = args.join(' ') || 'London';

    const geoRes = await request(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1`,
      { timeout: 5000 }
    );
    const geoData = JSON.parse(geoRes.body);
    if (!geoData.results?.length) {
      return { type: 'text', content: `Could not find location: ${query}` };
    }

    const loc = geoData.results[0];
    const weatherRes = await request(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`,
      { timeout: 5000 }
    );
    const weather = JSON.parse(weatherRes.body);
    const current = weather.current;

    const weatherCodes = {
      0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Foggy', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
      55: 'Dense drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
      71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 80: 'Slight showers',
      81: 'Moderate showers', 82: 'Violent showers', 95: 'Thunderstorm',
    };

    const condition = weatherCodes[current.weather_code] || 'Unknown';

    return {
      type: 'card',
      title: `Weather in ${loc.name}, ${loc.country || ''}`,
      content: [
        `Condition: ${condition}`,
        `Temperature: ${current.temperature_2m}°C`,
        `Humidity: ${current.relative_humidity_2m}%`,
        `Wind: ${current.wind_speed_10m} km/h`,
      ].join('\n'),
    };
  }
}

module.exports = WeatherPlugin;
