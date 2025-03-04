// src/services/index.ts
import { PrismaClient } from '@prisma/client';
import { CharacterService } from './CharacterService';
import { InventoryService } from './InventoryService';
import { QuestService } from './QuestService';
import { BattleService } from './combat/BattleService';
import { ShopService } from './ShopService';
import { LocationService } from './LocationService';
import { MentorService } from './MentorService';
import { WeaponService } from './WeaponService';
import { EquipmentService } from './EquipmentService';
import { GamblingService } from './GamblingService';
import { DuelService } from './combat/DuelService';
import { HelpService } from './HelpService';
import { LeaderboardService } from './LeaderboardService';
import { logger } from '@/utils/logger';

export interface ServiceContainer {
  character: CharacterService;
  inventory: InventoryService;
  quest: QuestService;
  battle: BattleService;
  shop: ShopService;
  location: LocationService;
  mentor: MentorService;
  weapon: WeaponService;
  equipment: EquipmentService;
  gambling: GamblingService;
  duel: DuelService;
  help: HelpService;
  leaderboard: LeaderboardService;
  logger: typeof logger;
}

export async function createServices(prisma: PrismaClient): Promise<ServiceContainer> {
  // Create services in correct order (dependency injection)
  const character = new CharacterService(prisma);
  const battle = new BattleService(prisma, character);
  const inventory = new InventoryService(prisma, character);
  const quest = new QuestService(prisma, character);
  const shop = new ShopService(prisma, character, inventory);
  const location = new LocationService(prisma, character);
  const mentor = new MentorService(prisma, character);
  const weapon = new WeaponService(prisma);
  const equipment = new EquipmentService(prisma);
  const gambling = new GamblingService(prisma, character);
  const duel = new DuelService(prisma, character);
  const help = new HelpService(prisma);
  const leaderboard = new LeaderboardService(prisma);

  // Set up battle service
  character.setBattleService(battle);

  return {
    character,
    inventory,
    quest,
    battle,
    shop,
    location,
    mentor,
    weapon,
    equipment,
    gambling,
    duel,
    help,
    leaderboard,
    logger
  };
}