import { PrismaClient } from '@prisma/client';
import { CONFIG } from '../config/config';
import { logger } from '../utils/logger';
import { EmbedBuilder } from 'discord.js';
import { LOCATIONS, WEATHER_EFFECTS, SPECIAL_EVENTS } from '../config/gameData';
import { QuestService } from './QuestService';
import { CharacterService } from './CharacterService';
import { BaseService } from './BaseService';
import { 
  LocationId, 
  WeatherType, 
  SpecialEventType, 
  Character,
  ExplorationResult,
  MarineInvasionEffects,
  PirateFestivalEffects,
  GrandLineStormEffects
} from '@/types/game';

interface ExplorationState {
  currentLocation: LocationId;
  weatherEffect: WeatherType;
  activeEvent?: SpecialEventType;
  explorationPoints: number;
  discoveredSecrets: Set<string>;
  lastExploredTime: number;
}

export class ExplorationService extends BaseService {
  private explorationStates: Map<string, ExplorationState>;
  private characterService: CharacterService;
  private questService: QuestService;
  private readonly WEATHER_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly DEFAULT_WEATHER: WeatherType = 'sunny';

  constructor(prisma: PrismaClient, characterService: CharacterService) {
    super(prisma);
    this.explorationStates = new Map();
    this.characterService = characterService;
    this.questService = new QuestService(prisma, characterService);
  }

  private initExplorationState(location: string): ExplorationState {
    if (!LOCATIONS[location as LocationId]) {
      throw new Error(`Invalid location: ${location}`);
    }

    return {
      currentLocation: location as LocationId,
      weatherEffect: this.DEFAULT_WEATHER,
      explorationPoints: 0,
      discoveredSecrets: new Set(),
      lastExploredTime: Date.now()
    };
  }

  private shouldUpdateWeather(state: ExplorationState): boolean {
    return Date.now() - state.lastExploredTime > this.WEATHER_UPDATE_INTERVAL;
  }

  private updateStateWeather(state: ExplorationState): void {
    if (this.shouldUpdateWeather(state)) {
      state.weatherEffect = this.updateWeather();
      state.activeEvent = this.checkForSpecialEvent();
      state.lastExploredTime = Date.now();
    }
  }

  private async applyMentorEffects(character: Character, state: ExplorationState): Promise<{ 
    bonusPoints: number;
    messages: string[];
  }> {
    const messages: string[] = [];
    let bonusPoints = 0;

    switch (character.mentor) {
      case 'Tierison': // Zoro
        // 30% chance to get lost but find something valuable
        if (Math.random() < 0.3) {
          bonusPoints += 50;
          messages.push('🗺️ Zoro tersesat... tapi menemukan sesuatu yang menarik!');
          
          // 10% chance to discover secret location
          if (Math.random() < 0.1) {
            messages.push('🏝️ Menemukan lokasi tersembunyi!');
            state.discoveredSecrets.add(`secret_${state.currentLocation}_${Date.now()}`);
          }
        }
        break;

      case 'LYuka': // Usopp
        // 20% chance to spot valuable items from afar
        if (Math.random() < 0.2) {
          bonusPoints += 30;
          messages.push('🔭 Usopp melihat sesuatu yang berharga dari kejauhan!');
        }
        break;

      case 'YB': // Luffy
        // 25% chance for adventure event
        if (Math.random() < 0.25) {
          bonusPoints += 40;
          messages.push('🌟 Luffy mencium petualangan!');
        }
        break;

      case 'GarryAng': // Sanji
        // 20% chance to find rare cooking ingredients
        if (Math.random() < 0.2) {
          bonusPoints += 35;
          messages.push('🍳 Sanji menemukan bahan makanan langka!');
        }
        break;
    }

    return { bonusPoints, messages };
  }

  private isMarineInvasion(effects: any): effects is MarineInvasionEffects {
    return 'marineSpawnRate' in effects && 'rewardMultiplier' in effects;
  }

  private isPirateFestival(effects: any): effects is PirateFestivalEffects {
    return 'expGain' in effects && 'merchantPrices' in effects;
  }

  private isGrandLineStorm(effects: any): effects is GrandLineStormEffects {
    return 'sailingSpeed' in effects && 'shipDamage' in effects;
  }

  private calculateExplorationRewards(character: Character, state: ExplorationState): {
    exp: number;
    items: string[];
    messages: string[];
  } {
    const messages: string[] = [];
    const items: string[] = [];
    let expMultiplier = 1;

    // Apply weather effects
    const weather = WEATHER_EFFECTS[state.weatherEffect];
    expMultiplier *= weather.effects.sailingSpeed;
    messages.push(`${weather.name} ${weather.description}`);

    // Apply special event effects if any
    if (state.activeEvent) {
      const event = SPECIAL_EVENTS[state.activeEvent];
      const effects = event.effects;

      if (this.isMarineInvasion(effects)) {
        expMultiplier *= effects.rewardMultiplier;
      } else if (this.isPirateFestival(effects)) {
        expMultiplier *= effects.expGain;
      }

      messages.push(`${event.name} ${event.description}`);
    }

    // Calculate base exp
    const baseExp = 50 + (state.explorationPoints * 0.5);
    const finalExp = Math.floor(baseExp * expMultiplier);

    return {
      exp: finalExp,
      items,
      messages
    };
  }

  private updateWeather(): WeatherType {
    const weathers = Object.keys(WEATHER_EFFECTS) as WeatherType[];
    return weathers[Math.floor(Math.random() * weathers.length)];
  }

  private checkForSpecialEvent(): SpecialEventType | undefined {
    if (Math.random() < 0.1) { // 10% chance for special event
      const events = Object.keys(SPECIAL_EVENTS) as SpecialEventType[];
      return events[Math.floor(Math.random() * events.length)];
    }
    return undefined;
  }

  getIslandConfig(islandId: LocationId) {
    const location = LOCATIONS[islandId];
    if (!location) throw new Error('Lokasi tidak ditemukan');
    return location;
  }

  private validateLocation(location: string): asserts location is LocationId {
    if (!LOCATIONS[location as LocationId]) {
      throw new Error(`Lokasi tidak valid: ${location}`);
    }
  }

  private validateConnection(from: LocationId, to: LocationId): void {
    const fromLocation = LOCATIONS[from];
    if (!fromLocation.connections.includes(to)) {
      throw new Error(`Tidak dapat berlayar dari ${from} ke ${to} secara langsung`);
    }
  }

  private validateWeather(weather: string): asserts weather is WeatherType {
    if (!['sunny', 'rainy', 'stormy', 'foggy', 'windy'].includes(weather)) {
      throw new Error(`Invalid weather type: ${weather}`);
    }
  }

  async exploreLocation(characterId: string): Promise<ExplorationResult> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId },
        select: {
          id: true,
          name: true,
          level: true,
          experience: true,
          health: true,
          maxHealth: true,
          attack: true,
          defense: true,
          currentIsland: true,
          mentor: true,
          luffyProgress: true,
          zoroProgress: true,
          usoppProgress: true,
          sanjiProgress: true,
          dailyHealCount: true,
          lastHealTime: true,
          combo: true,
          questPoints: true,
          explorationPoints: true,
          lastDailyReset: true,
          statusEffects: true,
          activeBuffs: true,
          userId: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!character) throw new Error('Character not found');
      this.validateLocation(character.currentIsland);

      // Get or initialize exploration state
      let state = this.explorationStates.get(characterId) || 
                  this.initExplorationState(character.currentIsland);

      // Update weather if needed
      this.updateStateWeather(state);

      // Apply mentor effects
      const { bonusPoints, messages: mentorMessages } = await this.applyMentorEffects(character as Character, state);
      state.explorationPoints += bonusPoints;

      // Calculate rewards
      const { exp, items, messages: rewardMessages } = this.calculateExplorationRewards(character as Character, state);

      // Update quest progress
      await this.questService.updateQuestProgress(characterId, 'EXPLORATION', 1);

      // Update gathering progress if items were found
      if (items.length > 0) {
        await this.questService.updateQuestProgress(characterId, 'GATHERING', items.length);
      }

      // Update secret discovery progress for Zoro
      if (character.mentor === 'Tierison' && state.discoveredSecrets.size > 0) {
        await this.questService.updateQuestProgress(characterId, 'SECRET_DISCOVERY', 1);
      }

      // Create exploration result embed
      const exploreEmbed = new EmbedBuilder()
        .setTitle('🗺️ Hasil Eksplorasi')
        .setColor('#00ff00')
        .setDescription(`Menjelajahi ${LOCATIONS[state.currentLocation].name}`)
        .addFields(
          { 
            name: '🌤️ Kondisi', 
            value: `${WEATHER_EFFECTS[state.weatherEffect].name}\n${WEATHER_EFFECTS[state.weatherEffect].description}`,
            inline: true 
          }
        );

      if (state.activeEvent) {
        exploreEmbed.addFields({
          name: '📢 Event Spesial',
          value: `${SPECIAL_EVENTS[state.activeEvent].name}\n${SPECIAL_EVENTS[state.activeEvent].description}`,
          inline: true
        });
      }

      if (mentorMessages.length > 0) {
        exploreEmbed.addFields({
          name: '👥 Efek Mentor',
          value: mentorMessages.join('\n')
        });
      }

      if (rewardMessages.length > 0) {
        exploreEmbed.addFields({
          name: '🎁 Hasil Penemuan',
          value: rewardMessages.join('\n')
        });
      }

      exploreEmbed.addFields(
        { name: '✨ EXP', value: `+${exp} EXP`, inline: true },
        { name: '📊 Total Poin Eksplorasi', value: `${state.explorationPoints} poin`, inline: true }
      );

      // Update character stats in transaction
      await this.prisma.$transaction([
        this.prisma.character.update({
          where: { id: characterId },
          data: {
            experience: { increment: exp },
            explorationPoints: { increment: state.explorationPoints }
          }
        })
      ]);

      // Update exploration state
      this.explorationStates.set(characterId, state);

      // Update mentor progress
      if (character.mentor === 'Tierison' && state.discoveredSecrets.size > 0) {
        await this.characterService.updateMentorProgress(characterId, 'Tierison', 5);
      }

      return {
        embed: exploreEmbed,
        exp,
        items,
        messages: [...mentorMessages, ...rewardMessages]
      };
    } catch (error) {
      logger.error('Error in exploration:', error);
      throw error;
    }
  }

  async sail(characterId: string, destination: LocationId) {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId },
        select: {
          id: true,
          name: true,
          level: true,
          experience: true,
          health: true,
          maxHealth: true,
          attack: true,
          defense: true,
          currentIsland: true,
          mentor: true,
          luffyProgress: true,
          zoroProgress: true,
          usoppProgress: true,
          sanjiProgress: true,
          dailyHealCount: true,
          lastHealTime: true,
          combo: true,
          questPoints: true,
          explorationPoints: true,
          lastDailyReset: true,
          statusEffects: true,
          activeBuffs: true,
          userId: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!character) throw new Error('Character not found');
      
      this.validateLocation(character.currentIsland);
      this.validateLocation(destination);
      this.validateConnection(character.currentIsland as LocationId, destination);

      // Initialize state with currentIsland
      const state = this.explorationStates.get(characterId) || 
                   this.initExplorationState(character.currentIsland);

      // Update weather if needed
      this.updateStateWeather(state);

      // Calculate sailing time based on weather and events
      let sailingTime = 1.0;
      sailingTime *= WEATHER_EFFECTS[state.weatherEffect].effects.sailingSpeed;
      
      if (state.activeEvent === 'grand_line_storm') {
        sailingTime *= SPECIAL_EVENTS.grand_line_storm.effects.sailingSpeed || 0.5;
      }

      // Zoro's special effect: chance to get lost but find shortcuts
      let foundShortcut = false;
      if (character.mentor === 'Tierison' && Math.random() < 0.3) {
        sailingTime *= Math.random() < 0.5 ? 0.5 : 2.0;
        if (sailingTime < 1.0) {
          foundShortcut = true;
        }
      }

      // Update quest progress
      await this.questService.updateQuestProgress(characterId, 'SAILING', 1);

      // Update navigation progress for Zoro if shortcut found
      if (foundShortcut) {
        await this.questService.updateQuestProgress(characterId, 'NAVIGATION', 1);
        await this.characterService.updateMentorProgress(characterId, 'Tierison', 3);
      }

      const currentLocation = LOCATIONS[character.currentIsland as LocationId];
      const destinationLocation = LOCATIONS[destination];

      // Create sailing result embed
      const sailEmbed = new EmbedBuilder()
        .setTitle('⛵ Pelayaran')
        .setColor('#0099ff')
        .setDescription(`Berlayar dari ${currentLocation.name} ke ${destinationLocation.name}`)
        .addFields(
          { 
            name: '🌤️ Cuaca', 
            value: `${WEATHER_EFFECTS[state.weatherEffect].name}\n${WEATHER_EFFECTS[state.weatherEffect].description}`,
            inline: true 
          },
          {
            name: '⏱️ Waktu Tempuh',
            value: `${Math.ceil(sailingTime * 100)}% dari normal${foundShortcut ? ' (Menemukan jalan pintas!)' : ''}`,
            inline: true
          }
        );

      if (state.activeEvent) {
        sailEmbed.addFields({
          name: '📢 Event Spesial',
          value: `${SPECIAL_EVENTS[state.activeEvent].name}\n${SPECIAL_EVENTS[state.activeEvent].description}`
        });
      }

      // Update character location in transaction
      await this.prisma.$transaction([
        this.prisma.character.update({
          where: { id: characterId },
          data: {
            currentIsland: destination
          }
        })
      ]);

      // Update exploration state
      state.currentLocation = destination;
      this.explorationStates.set(characterId, state);

      return {
        embed: sailEmbed,
        newLocation: destination,
        sailingTime,
        previousIsland: character.currentIsland,
        newIsland: destination,
        event: {
          type: state.activeEvent ? 'WEATHER' : 'NONE',
          description: state.activeEvent ? 
            `${SPECIAL_EVENTS[state.activeEvent].name}\n${SPECIAL_EVENTS[state.activeEvent].description}` :
            'Pelayaran lancar',
          data: {}
        }
      };
    } catch (error) {
      logger.error('Error in sailing:', error);
      throw error;
    }
  }
}