import { PrismaClient } from '@prisma/client';
import { BaseService } from './BaseService';
import { LocationId } from '@/types/game';
import { Message, EmbedBuilder } from 'discord.js';

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

export class LocationService extends BaseService {
  constructor(prisma: PrismaClient) {
    super(prisma);
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

  async handleMap(message: Message) {
    // Implementation will be added later
    return message.reply('🔄 Fitur map dalam pengembangan...');
  }
} 