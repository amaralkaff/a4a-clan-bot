import { PrismaClient } from '@prisma/client';
import { BaseService } from './BaseService';
import { LocationId } from '@/types/game';
import { Message, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { createEphemeralReply } from '@/utils/helpers';
import { LOCATIONS, Location } from '@/config/gameData';
import { getTierEmoji } from '@/commands/basic/handlers/utils';
import { CharacterService } from './CharacterService';

interface TravelResult {
  success: boolean;
  message: string;
}

type LocationRequirements = Record<LocationId, number>;

interface LocationInfo {
  description: string;
  recommendedLevel: number;
  dropRate: number;
  monsterLevel: number;
}

const LOCATION_INFO: Record<LocationId, LocationInfo> = {
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

const LEVEL_REQUIREMENTS: LocationRequirements = {
  'starter_island': 1,
  'foosha': 1,
  'syrup_village': 5,
  'baratie': 10,
  'arlong_park': 15,
  'loguetown': 20,
  'drum_island': 25,
  'cocoyashi': 30
};

const NO_CHARACTER_MSG = '❌ Kamu belum memiliki karakter! Gunakan `/start` untuk membuat karakter.';

export class LocationService extends BaseService {
  private characterService: CharacterService;

  constructor(prisma: PrismaClient, characterService: CharacterService) {
    super(prisma);
    this.characterService = characterService;
  }

  async travel(characterId: string, destination: LocationId): Promise<TravelResult> {
    try {
      const character = await this.prisma.character.findUnique({
        where: { id: characterId }
      });

      if (!character) {
        throw new Error('Character not found');
      }

      // Get location requirements
      const requiredLevel = LEVEL_REQUIREMENTS[destination];
      if (!requiredLevel) {
        throw new Error('Invalid destination');
      }

      // Check if character meets level requirement
      if (character.level < requiredLevel) {
        return {
          success: false,
          message: `❌ Level kamu (${character.level}) tidak cukup untuk ke lokasi ini! Minimal level ${requiredLevel}.`
        };
      }

      // Update character location
      await this.prisma.character.update({
        where: { id: characterId },
        data: { currentIsland: destination }
      });

      return {
        success: true,
        message: `✅ Berhasil pergi ke ${destination}!`
      };
    } catch (error) {
      return this.handleError(error, 'Travel');
    }
  }

  async getLocationInfo(locationId: LocationId): Promise<LocationInfo> {
    return LOCATION_INFO[locationId];
  }

  async handleMapView(source: Message | ChatInputCommandInteraction) {
    const userId = source instanceof Message ? source.author.id : source.user.id;
    const character = await this.characterService.getCharacterByDiscordId(userId);
    
    if (!character) {
      return source instanceof Message 
        ? source.reply(NO_CHARACTER_MSG)
        : source.reply(createEphemeralReply({ content: NO_CHARACTER_MSG }));
    }

    const currentLocation = LOCATIONS[character.currentIsland as LocationId];
    const embed = new EmbedBuilder()
      .setTitle('🗺️ Peta Dunia')
      .setColor('#0099ff')
      .setDescription('Lokasi yang tersedia untuk dijelajahi:')
      .addFields([
        { 
          name: '📍 Lokasimu Saat Ini', 
          value: `${currentLocation.name}\n${currentLocation.description}`,
          inline: false 
        }
      ]);

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

    // Add fields for each tier
    for (const [tier, locations] of Object.entries(groupedLocations)) {
      const locationList = locations.map(loc => 
        `${loc.name} (Lv.${loc.level}+)\n` +
        `${character.currentIsland === loc.id ? '📍 ' : ''}${loc.description}`
      ).join('\n\n');

      embed.addFields([{
        name: `${getTierEmoji(tier)} ${tier} ISLANDS`,
        value: locationList
      }]);
    }

    // Add travel tip
    embed.setFooter({ 
      text: 'Gunakan /a m untuk melihat peta' 
    });

    return source.reply({ 
      embeds: [embed], 
      ephemeral: source instanceof ChatInputCommandInteraction 
    });
  }

  async handleMap(source: Message | ChatInputCommandInteraction) {
    return this.handleMapView(source);
  }
} 