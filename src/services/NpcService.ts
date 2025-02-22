// src/services/NpcService.ts
import { BaseService } from './BaseService';
import { PrismaClient } from '@prisma/client';
import { NpcCharacter, NpcInteraction, LocationId, MentorType } from '../types/game';
import { CONFIG } from '../config/config';

export class NpcService extends BaseService {
  private readonly clanMemberToNpcId: Record<MentorType, string> = {
    'YB': 'luffy',
    'Tierison': 'zoro',
    'LYuka': 'usopp',
    'GarryAng': 'sanji'
  };

  private readonly npcs: Record<string, NpcCharacter> = {
    luffy: {
      id: 'luffy',
      name: 'Monkey D. Luffy',
      title: 'Raja Bajak Laut',
      clanMember: 'YB',
      location: 'starter_island',
      dialogues: {
        greeting: 'Shishishi! Aku akan menjadi Raja Bajak Laut! Mau bergabung dengan petualanganku?',
        quest: 'Ada misi khusus yang hanya bisa kamu selesaikan. Tertarik?',
        training: 'Ayo berlatih Haki bersama!',
        trade: 'Aku punya Daging berkualitas tinggi, mau menukar dengan hartamu?'
      },
      quests: ['luffy_training_1', 'find_meat_quest', 'haki_mastery'],
      specialItems: ['gomu_gomu_fruit', 'straw_hat']
    },
    zoro: {
      id: 'zoro',
      name: 'Roronoa Zoro',
      title: 'Pendekar Pedang',
      clanMember: 'Tierison',
      location: 'shell_town',
      dialogues: {
        greeting: 'Hmph. Kau terlihat cukup kuat. Tunjukkan kemampuanmu padaku.',
        quest: 'Ada dojo yang perlu dibersihkan dari bandit. Bantu aku?',
        training: 'Mau berlatih teknik pedang?',
        trade: 'Aku punya beberapa pedang bagus untuk dijual.'
      },
      quests: ['zoro_training_1', 'bandit_dojo', 'sword_mastery'],
      specialItems: ['wado_ichimonji', 'training_sword']
    },
    usopp: {
      id: 'usopp',
      name: 'Usopp',
      title: 'Penembak Jitu',
      clanMember: 'LYuka',
      location: 'syrup_village',
      dialogues: {
        greeting: 'Akulah kapten Usopp! Pemimpin dari 8000 pengikut!',
        quest: 'Ada harta karun tersembunyi di pulau ini. Tertarik mencarinya?',
        training: 'Mau belajar teknik menembak dariku?',
        trade: 'Aku punya beberapa alat yang mungkin berguna untukmu.'
      },
      quests: ['usopp_training_1', 'treasure_hunt', 'sniper_mastery'],
      specialItems: ['kabuto', 'special_ammo']
    },
    sanji: {
      id: 'sanji',
      name: 'Sanji',
      title: 'Koki Cinta',
      clanMember: 'GarryAng',
      location: 'baratie',
      dialogues: {
        greeting: 'Selamat datang di Baratie! Mau mencoba masakan spesialku?',
        quest: 'Aku butuh bahan langka untuk resep baruku. Bisa membantuku?',
        training: 'Mau belajar teknik bertarung kakiku?',
        trade: 'Aku punya beberapa resep rahasia yang bisa kuajarkan.'
      },
      quests: ['sanji_training_1', 'rare_ingredient', 'cooking_mastery'],
      specialItems: ['special_recipe', 'black_leg_technique']
    }
  };

  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async getNpcInfo(npcId: string): Promise<NpcCharacter | null> {
    return this.npcs[npcId] || null;
  }

  async interactWithNpc(
    characterId: string,
    clanMemberId: MentorType
  ): Promise<NpcInteraction> {
    try {
      const npcId = this.clanMemberToNpcId[clanMemberId];
      if (!npcId) throw new Error('NPC not found');

      const npc = this.npcs[npcId];
      if (!npc) throw new Error('NPC not found');

      const character = await this.prisma.character.findUnique({
        where: { id: characterId },
        include: {
          quests: true,
          inventory: true
        }
      });

      if (!character) throw new Error('Character not found');

      if (character.currentIsland !== npc.location) {
        return {
          type: 'DIALOGUE',
          requirementsMet: false,
          availableActions: [],
          dialogue: `${npc.name} tidak ada di pulau ini. Kamu bisa menemuinya di ${npc.location}.`
        };
      }

      const availableQuests = npc.quests.filter(
        questId => !character.quests.some(q => q.id === questId)
      );

      const availableActions = ['DIALOGUE'];
      if (availableQuests.length > 0) availableActions.push('QUEST');
      if (this.canTrain(character)) availableActions.push('TRAINING');
      if (this.canTrade(character)) availableActions.push('TRADE');

      return {
        type: availableActions.includes('QUEST') ? 'QUEST' : 'DIALOGUE',
        requirementsMet: true,
        availableActions,
        dialogue: availableQuests.length > 0 ? npc.dialogues.quest : npc.dialogues.greeting
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        return this.handleError(error, 'InteractWithNpc');
      }
      return this.handleError(new Error('Unknown error in InteractWithNpc'), 'InteractWithNpc');
    }
  }

  private canTrain(character: any): boolean {
    return character.level >= 5;
  }

  private canTrade(character: any): boolean {
    return character.inventory && character.inventory.length > 0;
  }
}