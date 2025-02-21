// src/services/WeatherService.ts
import { CONFIG } from '../config/config';
import { logger } from '../utils/logger';
import { Weather } from '../types/game';

export class WeatherService {
  private currentWeather: Weather;
  private weatherInterval: NodeJS.Timer | null = null;
  private isActive: boolean = false;

  private weatherEffects: Record<typeof CONFIG.WEATHER_TYPES[number], Weather> = {
    'SUNNY': {
      type: 'SUNNY',
      effects: {
        sailingSpeed: 1,
        battleModifier: 1,
        explorationModifier: 1,
        dropRateModifier: 1
      },
      description: '☀️ Cuaca cerah, sempurna untuk berlayar!'
    },
    'RAINY': {
      type: 'RAINY',
      effects: {
        sailingSpeed: 0.8,
        battleModifier: 0.9,
        explorationModifier: 0.7,
        dropRateModifier: 1.3
      },
      description: '🌧️ Hujan lebat membuat perjalanan lebih lambat, tapi kesempatan mendapat item lebih tinggi!'
    },
    'STORMY': {
      type: 'STORMY',
      effects: {
        sailingSpeed: 0.5,
        battleModifier: 0.7,
        explorationModifier: 0.4,
        dropRateModifier: 1.5
      },
      description: '⛈️ Badai berbahaya! Tapi harta karun sering muncul dalam badai!'
    }
  };

  constructor() {
    this.currentWeather = this.weatherEffects['SUNNY'];
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
      const weatherTypes = CONFIG.WEATHER_TYPES;
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
    if (this.currentWeather.type !== 'SUNNY') {
      throw new Error('Hanya bisa memicu hujan saat cuaca cerah');
    }

    this.currentWeather = this.weatherEffects['RAINY'];
    
    setTimeout(() => {
      if (this.currentWeather.type === 'RAINY') {
        this.currentWeather = this.weatherEffects['SUNNY'];
      }
    }, 30 * 60 * 1000);

    return this.currentWeather;
  }
}