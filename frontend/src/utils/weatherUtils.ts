export interface WeatherForecast {
  date: string;
  weather_code: number | null;
  temperature_max: number | null;
  temperature_min: number | null;
  precipitation_probability: number | null;
}

export interface WeatherDisplay {
  icon: string;
  label: string;
  temperature: string;
  unavailable: boolean;
}

const weatherCodeMap: Record<number, { icon: string; label: string }> = {
  0: { icon: '☀️', label: '晴' },
  1: { icon: '🌤️', label: '少云' },
  2: { icon: '⛅', label: '多云' },
  3: { icon: '☁️', label: '阴' },
  45: { icon: '🌫️', label: '雾' },
  48: { icon: '🌫️', label: '雾凇' },
  51: { icon: '🌦️', label: '小毛毛雨' },
  53: { icon: '🌦️', label: '毛毛雨' },
  55: { icon: '🌧️', label: '大毛毛雨' },
  56: { icon: '🌧️', label: '冻毛毛雨' },
  57: { icon: '🌧️', label: '强冻毛毛雨' },
  61: { icon: '🌦️', label: '小雨' },
  63: { icon: '🌧️', label: '中雨' },
  65: { icon: '🌧️', label: '大雨' },
  66: { icon: '🌧️', label: '冻雨' },
  67: { icon: '🌧️', label: '强冻雨' },
  71: { icon: '🌨️', label: '小雪' },
  73: { icon: '🌨️', label: '中雪' },
  75: { icon: '❄️', label: '大雪' },
  77: { icon: '❄️', label: '雪粒' },
  80: { icon: '🌦️', label: '阵雨' },
  81: { icon: '🌧️', label: '强阵雨' },
  82: { icon: '⛈️', label: '暴雨' },
  85: { icon: '🌨️', label: '小阵雪' },
  86: { icon: '❄️', label: '强阵雪' },
  95: { icon: '⛈️', label: '雷雨' },
  96: { icon: '⛈️', label: '雷雨冰雹' },
  99: { icon: '⛈️', label: '强雷雨冰雹' },
};

function formatTemperature(value: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '';
  }
  return `${Math.round(value)}°`;
}

export function getWeatherDisplay(forecast?: WeatherForecast): WeatherDisplay {
  if (!forecast) {
    return {
      icon: '◇',
      label: '暂无预报',
      temperature: '',
      unavailable: true,
    };
  }

  const codeInfo = typeof forecast.weather_code === 'number'
    ? weatherCodeMap[forecast.weather_code] || { icon: '◇', label: '未知' }
    : { icon: '◇', label: '未知' };

  const min = formatTemperature(forecast.temperature_min);
  const max = formatTemperature(forecast.temperature_max);

  return {
    ...codeInfo,
    temperature: min && max ? `${min}/${max}` : max || min,
    unavailable: forecast.weather_code === null,
  };
}
