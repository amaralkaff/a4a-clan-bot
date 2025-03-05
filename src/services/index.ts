// src/services/index.ts
import { PrismaClient } from '@prisma/client';
import { CharacterService } from './CharacterService';
import { BattleService } from './combat/BattleService';
import { InventoryService } from './InventoryService';
import { QuizService } from './QuizService';
import { ShopService } from './ShopService';
import { MentorService } from './MentorService';
import { LocationService } from './LocationService';
import { GamblingService } from './GamblingService';
import { DuelService } from './DuelService';
import { WeaponService } from './WeaponService';
import { EquipmentService } from './EquipmentService';
import { HelpService } from './HelpService';
import { LeaderboardService } from './LeaderboardService';
import { logger } from '@/utils/logger';
import { DataCache } from './DataCache';
import { Client } from 'discord.js';

export interface ServiceContainer {
  character: CharacterService;
  battle: BattleService;
  inventory: InventoryService;
  quiz: QuizService;
  shop: ShopService;
  mentor: MentorService;
  location: LocationService;
  gambling: GamblingService;
  duel: DuelService;
  weapon: WeaponService;
  equipment: EquipmentService;
  help: HelpService;
  leaderboard: LeaderboardService;
}

export function createServices(prisma: PrismaClient, client: Client): ServiceContainer {
  try {
    // Initialize DataCache singleton
    const dataCache = DataCache.getInstance();

    // Initialize base services first
    const character = new CharacterService(prisma);
    const equipment = new EquipmentService(prisma);
    const weapon = new WeaponService(prisma);
    const quiz = new QuizService(prisma, character);
    const battle = new BattleService(prisma, character, dataCache);

    // Initialize dependent services
    const inventory = new InventoryService(prisma, character);
    const location = new LocationService(prisma, character);
    const shop = new ShopService(prisma, character, inventory);
    const help = new HelpService(prisma);
    const leaderboard = new LeaderboardService(prisma);
    const duel = new DuelService(prisma);
    const mentor = new MentorService(prisma, character);
    const gambling = new GamblingService(prisma, character);

    // Set up cross-service dependencies
    character.setBattleService(battle);
    duel.setBattleService(battle);
    inventory.setEquipmentService(equipment);
    shop.setEquipmentService(equipment);

    logger.info('Services initialized successfully');

    return {
      character,
      battle,
      inventory,
      quiz,
      shop,
      mentor,
      location,
      gambling,
      duel,
      weapon,
      equipment,
      help,
      leaderboard
    };
  } catch (error) {
    logger.error('Error creating services:', error);
    throw error;
  }
}