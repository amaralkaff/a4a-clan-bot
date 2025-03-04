import { PrismaClient } from '@prisma/client';
import { BaseService } from './BaseService';
import { LocationId } from '@/types/game';
import { Message, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { CharacterService } from './CharacterService';
import { Cache } from '@/utils/Cache';
import { LOCATIONS, Location } from '@/config/gameData';
import { getTierEmoji } from '@/utils/emojiUtils';
import { PaginationManager } from '@/utils/pagination';
import { ErrorHandler, CharacterError } from '@/utils/errors';

export class LocationError extends Error {
  constructor(message: string, public code: string, public details?: Record<string, any>) {
    super(message);
    this.name = 'LocationError';
  }

  static insufficientLevel(required: number, current: number): LocationError {
    return new LocationError(
      `❌ Level kamu (${current}) tidak cukup untuk ke lokasi ini! Minimal level ${required}.`,
      'INSUFFICIENT_LEVEL',
      { required, current }
    );
  }

  static invalidDestination(destination: string): LocationError {
    return new LocationError(
      `❌ Lokasi "${destination}" tidak ditemukan!`,
      'INVALID_DESTINATION',
      { destination }
    );
  }

  static sameLocation(location: string): LocationError {
    return new LocationError(
      `❌ Kamu sudah berada di ${location}!`,
      'SAME_LOCATION',
      { location }
    );
  }
}

interface LocationCache {
  info: LocationInfo;
  lastUpdated: number;
}

interface LocationInfo {
  description: string;
  recommendedLevel: number;
  dropRate: number;
  monsterLevel: number;
}

interface TravelResult {
  success: boolean;
  message: string;
}

export class LocationService extends BaseService {
  private characterService: CharacterService;
  private locationCache: Cache<LocationCache>;
  private readonly LOCATION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private readonly LOCATION_INFO: Record<LocationId, LocationInfo> = {
    'starter_island': {
      description: 'Pulau pertama dalam petualanganmu',
      recommendedLevel: 1,
      dropRate: 1.0,
      monsterLevel: 1
    },
    'foosha': {
      description: 'Desa kecil tempat Luffy dibesarkan',
      recommendedLevel: 1,
      dropRate: 1.0,
      monsterLevel: 1
    },
    'syrup_village': {
      description: 'Desa tempat tinggal Usopp',
      recommendedLevel: 5,
      dropRate: 1.2,
      monsterLevel: 5
    },
    'baratie': {
      description: 'Restoran terapung milik Zeff',
      recommendedLevel: 10,
      dropRate: 1.3,
      monsterLevel: 10
    },
    'arlong_park': {
      description: 'Markas bajak laut Arlong',
      recommendedLevel: 15,
      dropRate: 1.4,
      monsterLevel: 15
    },
    'loguetown': {
      description: 'Kota terakhir sebelum Grand Line',
      recommendedLevel: 20,
      dropRate: 1.5,
      monsterLevel: 20
    },
    'drum_island': {
      description: 'Pulau musim dingin tempat Chopper tinggal',
      recommendedLevel: 25,
      dropRate: 1.6,
      monsterLevel: 25
    },
    'cocoyashi': {
      description: 'Desa tempat tinggal Nami',
      recommendedLevel: 30,
      dropRate: 1.7,
      monsterLevel: 30
    }
  };

  constructor(prisma: PrismaClient, characterService: CharacterService) {
    super(prisma);
    this.characterService = characterService;
    this.locationCache = new Cache<LocationCache>(this.LOCATION_CACHE_TTL);

    // Set up periodic cache cleanup
    setInterval(() => {
      this.locationCache.cleanup();
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }

  private getLocationCacheKey(locationId: LocationId): string {
    return `location_${locationId}`;
  }

  async getLocationInfo(locationId: LocationId): Promise<LocationInfo> {
    const cacheKey = this.getLocationCacheKey(locationId);
    const cached = this.locationCache.get(cacheKey);
    
    if (cached) {
      return cached.info;
    }

    const info = this.LOCATION_INFO[locationId];
    if (!info) {
      throw LocationError.invalidDestination(locationId);
    }

    this.locationCache.set(cacheKey, {
      info,
      lastUpdated: Date.now()
    });

    return info;
  }

  async travel(characterId: string, destination: LocationId): Promise<TravelResult> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) {
        throw CharacterError.notFound(characterId);
      }

      // Validate destination
      const locationInfo = await this.getLocationInfo(destination);
      if (!locationInfo) {
        throw LocationError.invalidDestination(destination);
      }

      // Check if already at destination
      if (character.currentIsland === destination) {
        throw LocationError.sameLocation(LOCATIONS[destination].name);
      }

      // Check level requirement
      if (character.level < locationInfo.recommendedLevel) {
        throw LocationError.insufficientLevel(locationInfo.recommendedLevel, character.level);
      }

      // Update character location
      await this.prisma.character.update({
        where: { id: characterId },
        data: { 
          currentIsland: destination,
          explorationPoints: { increment: 1 }
        }
      });

      return {
        success: true,
        message: `✅ Berhasil pergi ke ${LOCATIONS[destination].name}!`
      };
    } catch (error) {
      if (error instanceof LocationError || error instanceof CharacterError) {
        return {
          success: false,
          message: error.message
        };
      }
      this.logger.error('Error in travel:', error);
      return {
        success: false,
        message: '❌ Terjadi kesalahan saat berpindah lokasi.'
      };
    }
  }

  async handleMapView(source: Message | ChatInputCommandInteraction): Promise<void> {
    try {
      const userId = source instanceof Message ? source.author.id : source.user.id;
      const character = await this.characterService.getCharacterByDiscordId(userId);
      
      if (!character) {
        throw CharacterError.notFound(userId);
      }

      const currentLocation = LOCATIONS[character.currentIsland as LocationId];

      // Group locations by level requirement
      const groupedLocations = Object.entries(LOCATIONS).reduce<Record<string, Array<{id: string} & Location>>>((acc, [id, loc]) => {
        const tier = loc.level <= 5 ? 'STARTER' :
                    loc.level <= 15 ? 'INTERMEDIATE' :
                    'ADVANCED';
        if (!acc[tier]) {
          acc[tier] = [];
        }
        acc[tier].push({ id, ...loc });
        return acc;
      }, {});

      await PaginationManager.paginate(source, {
        items: Object.entries(groupedLocations),
        itemsPerPage: 2,
        embedBuilder: async (items, currentPage, totalPages) => {
          const embed = new EmbedBuilder()
            .setTitle('🗺️ Peta Dunia')
            .setDescription('Lokasi yang tersedia untuk dijelajahi:')
            .setColor('#0099ff')
            .addFields([
              { 
                name: '📍 Lokasimu Saat Ini', 
                value: `${currentLocation.name}\n${currentLocation.description}`,
                inline: false 
              }
            ]);

          items.forEach(([tier, locations]) => {
            const locationList = locations
              .map(loc => {
                const isCurrentLocation = character.currentIsland === loc.id;
                return `${isCurrentLocation ? '📍 ' : ''}${loc.name} (Lv.${loc.level}+)\n${loc.description}`;
              })
              .join('\n\n');

            embed.addFields([{
              name: `${getTierEmoji(parseInt(tier))} ${tier} ISLANDS`,
              value: locationList || 'No locations available'
            }]);
          });

          if (totalPages > 1) {
            embed.setFooter({ text: `Page ${currentPage}/${totalPages} • Use /map or a m to view` });
          }

          return embed;
        },
        ephemeral: source instanceof ChatInputCommandInteraction
      });
    } catch (error) {
      await ErrorHandler.handle(error, source);
    }
  }

  async handleMap(source: Message | ChatInputCommandInteraction): Promise<void> {
    return this.handleMapView(source);
  }
} 