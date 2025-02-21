// src/services/WeatherService.ts
import { CONFIG } from '../config/config';
import { logger } from '../utils/logger';
import { Weather, WeatherType } from '../types/game';

export class WeatherService {
  private currentWeather: Weather;
  private weatherInterval: NodeJS.Timer | null = null;
  private isActive: boolean = false;

  private weatherEffects: Record<WeatherType, Weather> = {
    sunny: {
      type: 'sunny',
      name: '☀️ Cerah',
      description: 'Cuaca normal, sempurna untuk berlayar!',
      effects: {
        sailingSpeed: 1,
        battleModifier: 1,
        explorationModifier: 1,
        dropRateModifier: 1
      }
    },
    rainy: {
      type: 'rainy',
      name: '🌧️ Hujan lebat',
      description: 'Hujan lebat membuat perjalanan lebih lambat, tapi kesempatan mendapat item lebih tinggi!',
      effects: {
        sailingSpeed: 0.8,
        battleModifier: 0.9,
        explorationModifier: 0.7,
        dropRateModifier: 1.3
      }
    },
    stormy: {
      type: 'stormy',
      name: '⛈️ Badai',
      description: 'Badai berbahaya! Tapi harta karun sering muncul dalam badai!',
      effects: {
        sailingSpeed: 0.5,
        battleModifier: 0.7,
        explorationModifier: 0.4,
        dropRateModifier: 1.5
      }
    },
    foggy: {
      type: 'foggy',
      name: '🌫️ Berkabut',
      description: 'Visibilitas rendah, cocok untuk sembunyi',
      effects: {
        sailingSpeed: 0.7,
        battleModifier: 0.8,
        explorationModifier: 0.8,
        dropRateModifier: 1.2
      }
    },
    windy: {
      type: 'windy',
      name: '💨 Berangin',
      description: 'Angin kencang mempengaruhi pertarungan jarak jauh',
      effects: {
        sailingSpeed: 1.2,
        battleModifier: 0.9,
        explorationModifier: 0.9,
        dropRateModifier: 1.0
      }
    }
  };

  constructor() {
    this.currentWeather = this.weatherEffects.sunny;
    this.startWeatherCycle();
  }

  private startWeatherCycle() {
    if (this.weatherInterval) {
      this.stopWeatherCycle();
    }
    
    this.isActive = true;
    this.weatherInterval = setInterval(() => {
      if (!this.isActive) {
        this.stopWeatherCycle();
        return;
      }
      this.changeWeather();
    }, CONFIG.WEATHER_CHANGE_INTERVAL);

    logger.info('Weather cycle started');
  }

  private changeWeather() {
    try {
      const weatherTypes: WeatherType[] = ['sunny', 'rainy', 'stormy', 'foggy', 'windy'];
      const newWeather = weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
      this.currentWeather = this.weatherEffects[newWeather];
      logger.info(`Weather changed to: ${newWeather}`);
    } catch (error) {
      logger.error('Error changing weather:', error);
    }
  }

  getCurrentWeather(): Weather {
    return this.currentWeather;
  }

  getWeatherEffect(type: keyof Weather['effects']): number {
    return this.currentWeather.effects[type] || 1;
  }

  stopWeatherCycle() {
    this.isActive = false;
    if (this.weatherInterval) {
      clearInterval(this.weatherInterval);
      this.weatherInterval = null;
      logger.info('Weather cycle stopped');
    }
  }

  async triggerRain(): Promise<Weather> {
    if (this.currentWeather.type !== 'sunny') {
      throw new Error('Hanya bisa memicu hujan saat cuaca cerah');
    }

    this.currentWeather = this.weatherEffects.rainy;
    
    setTimeout(() => {
      if (this.currentWeather.type === 'rainy') {
        this.currentWeather = this.weatherEffects.sunny;
      }
    }, 30 * 60 * 1000);

    return this.currentWeather;
  }
}