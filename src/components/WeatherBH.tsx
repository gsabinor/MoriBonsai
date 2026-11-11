import { useEffect, useState } from 'react';
import { AlertCircle, Cloud, CloudDrizzle, CloudRain, CloudSun, ExternalLink, MapPin, Sun, Wind, Droplets, Thermometer } from 'lucide-react';

type Weather = {
  temperature: number;
  humidity: number;
  code: number;
  rainChance: number | null;
  max: number | null;
  min: number | null;
  time: string;
  wind: number | null;
};

type ForecastPayload = {
  current?: { temperature_2m?: number; relative_humidity_2m?: number; weather_code?: number; wind_speed_10m?: number; time?: string };
  daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: (number | null)[] };
};

const URL = 'https://api.open-meteo.com/v1/forecast?latitude=-19.9167&longitude=-43.9345&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FSao_Paulo&forecast_days=1';
let cache: { value: Weather; fetchedAt: number } | null = null;
const MAX_AGE = 15 * 60 * 1000;

function weatherCondition(code: number) {
  if ([0, 1].includes(code)) return { label: 'Céu aberto', Icon: Sun };
  if ([2, 3].includes(code)) return { label: 'Parcialmente nublado', Icon: CloudSun };
  if ([45, 48].includes(code)) return { label: 'Neblina', Icon: Cloud };
  if ([51, 53, 55, 56, 57].includes(code)) return { label: 'Garoa', Icon: CloudDrizzle };
  if ([61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return { label: 'Chuva', Icon: CloudRain };
  return { label: 'Condições variáveis', Icon: CloudSun };
}

export default function WeatherBH() {
  const [weather, setWeather] = useState<Weather | null>(cache?.value ?? null);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (cache && Date.now() - cache.fetchedAt < MAX_AGE) { setWeather(cache.value); setLoading(false); return; }
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(URL, { signal: controller.signal });
        if (!response.ok) throw new Error('Não foi possível consultar o clima.');
        const data = await response.json() as ForecastPayload;
        if (typeof data.current?.temperature_2m !== 'number' || typeof data.current?.relative_humidity_2m !== 'number' || !data.current.time) throw new Error('Dados meteorológicos incompletos.');
        const value: Weather = {
          temperature: data.current.temperature_2m,
          humidity: data.current.relative_humidity_2m,
          code: data.current.weather_code ?? 3,
          rainChance: data.daily?.precipitation_probability_max?.[0] ?? null,
          max: data.daily?.temperature_2m_max?.[0] ?? null,
          min: data.daily?.temperature_2m_min?.[0] ?? null,
          time: data.current.time,
          wind: data.current.wind_speed_10m ?? null,
        };
        cache = { value, fetchedAt: Date.now() };
        setWeather(value);
        setError(false);
      } catch (cause) {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(true);
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, []);

  const condition = weather ? weatherCondition(weather.code) : null;
  const Icon = condition?.Icon ?? CloudSun;
  return <section className="mori-weather mori-weather--wide" aria-label="Condições meteorológicas em Belo Horizonte">
    <div className="mori-weather-primary">
      <div className="weather-place"><MapPin size={16}/><span>Belo Horizonte, MG</span></div>
      {loading && !weather ? <p className="weather-unavailable">Consultando o clima...</p> : !weather ?
        <div className="weather-error"><AlertCircle size={18}/><span>Clima indisponível agora.</span></div> : <>
          <div className="weather-head"><Icon size={42} strokeWidth={1.7}/><strong>{Math.round(weather.temperature)}°C</strong></div>
          <p className="weather-condition">{condition?.label}</p>
        </>}
      {weather && <small className="weather-time">Dados de {weather.time.slice(11,16)} · {error ? 'última leitura disponível' : 'Open-Meteo'}</small>}
    </div>
    {weather && <div className="mori-weather-secondary">
      <span><Thermometer size={16}/>{weather.max === null || weather.min === null ? 'Máx. / mín.: —' : `Máx. ${Math.round(weather.max)}° · Mín. ${Math.round(weather.min)}°`}</span>
      <span><Droplets size={16}/>Umidade: {Math.round(weather.humidity)}%</span>
      <span><CloudRain size={16}/>Chuva: {weather.rainChance === null ? '—' : `${Math.round(weather.rainChance)}%`}</span>
      <span><Wind size={16}/>Vento: {weather.wind === null ? '—' : `${Math.round(weather.wind)} km/h`}</span>
    </div>}
    <a className="weather-source" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Fonte: Open-Meteo <ExternalLink size={11}/></a>
  </section>;
}
