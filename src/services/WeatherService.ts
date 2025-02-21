// src/services/WeatherService.ts
import { CONFIG } from '../config/config';
import { logger } from '../utils/logger';

export interface Weather {
  type: typeof CONFIG.WEATHER_TYPES[number];
  effects: {
    sailingSpeed?: number;
    battleModifier?: number;
    explorationModifier?: number;
  };
  description: string;
}

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
        explorationModifier: 1
      },
      description: '☀️ Cuaca cerah, sempurna untuk berlayar!'
    },
    'RAINY': {
      type: 'RAINY',
      effects: {
        sailingSpeed: 0.8,
        battleModifier: 0.9,
        explorationModifier: 0.7
      },
      description: '🌧️ Hujan lebat membuat perjalanan lebih lambat.'
    },
    'STORMY': {
      type: 'STORMY',
      effects: {
        sailingSpeed: 0.5,
        battleModifier: 0.7,
        explorationModifier: 0.4
      },
      description: '⛈️ Badai berbahaya! Berhati-hatilah dalam berlayar.'
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

  getWeatherEffect(type: 'sailingSpeed' | 'battleModifier' | 'explorationModifier'): number {
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
}