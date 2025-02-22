import { PrismaClient } from '@prisma/client';
import { BaseService } from './BaseService';
import { LocationId } from '@/types/game';
import { Message, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { createEphemeralReply } from '@/utils/helpers';
import { LOCATIONS } from '@/config/gameData';
import { getTierEmoji } from '@/commands/basic/handlers/utils';
import { CharacterService } from './CharacterService';

interface TravelResult {
  success: boolean;
  message: string;
}

type LocationRequirements = {
  [K in LocationId]: number;
};

interface LocationInfo {
  description: string;
  recommendedLevel: number;
  dropRate: number;
  monsterLevel: number;
}

const LOCATION_INFO: Record<LocationId, LocationInfo> = {
  foosha: {
    description: 'Desa kecil dan damai tempat Luffy dibesarkan. Tempat yang cocok untuk pemula.',
    recommendedLevel: 1,
    dropRate: 1.0,
    monsterLevel: 1
  },
  syrup_village: {
    description: 'Desa tempat tinggal Usopp. Banyak monster lemah untuk latihan.',
    recommendedLevel: 3,
    dropRate: 1.2,
    monsterLevel: 3
  },
  baratie: {
    description: 'Restoran terapung terkenal milik Zeff. Tempat Sanji bekerja sebagai koki.',
    recommendedLevel: 5,
    dropRate: 1.3,
    monsterLevel: 5
  },
  arlong_park: {
    description: 'Markas bajak laut Arlong. Tempat yang berbahaya dengan monster kuat.',
    recommendedLevel: 8,
    dropRate: 1.5,
    monsterLevel: 8
  },
  loguetown: {
    description: 'Kota terakhir di East Blue. Tempat eksekusi Gold Roger.',
    recommendedLevel: 10,
    dropRate: 1.6,
    monsterLevel: 10
  },
  drum_island: {
    description: 'Pulau bersalju dengan teknologi medis maju. Tempat Chopper dilatih.',
    recommendedLevel: 12,
    dropRate: 1.8,
    monsterLevel: 12
  },
  cocoyashi: {
    description: 'Desa kelahiran Nami. Dulunya dikuasai oleh Arlong.',
    recommendedLevel: 7,
    dropRate: 1.4,
    monsterLevel: 7
  }
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
      const requirements: LocationRequirements = {
        foosha: 1,
        syrup_village: 3,
        baratie: 5,
        arlong_park: 8,
        loguetown: 10,
        drum_island: 12,
        cocoyashi: 7
      };

      const requiredLevel = requirements[destination];
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
    const groupedLocations = Object.entries(LOCATIONS).reduce((acc, [id, loc]) => {
      const tier = loc.level <= 5 ? 'STARTER' :
                  loc.level <= 15 ? 'INTERMEDIATE' :
                  'ADVANCED';
      if (!acc[tier]) {
        acc[tier] = [];
      }
      acc[tier].push({ id, ...loc });
      return acc;
    }, {} as Record<string, Array<{id: string; name: string; description: string; level: number}>>);

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