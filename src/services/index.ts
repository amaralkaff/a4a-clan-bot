// src/services/index.ts
import { PrismaClient } from '@prisma/client';
import { CharacterService } from './CharacterService';
import { InventoryService } from './InventoryService';
import { QuestService } from './QuestService';
import { BattleService } from './BattleService';
import { ShopService } from './ShopService';
import { LocationService } from './LocationService';
import { MentorService } from './MentorService';
import { logger } from '@/utils/logger';

export interface ServiceContainer {
  character: CharacterService;
  inventory: InventoryService;
  quest: QuestService;
  battle: BattleService;
  shop: ShopService;
  location: LocationService;
  mentor: MentorService;
  logger: typeof logger;
}

export function createServices(prisma: PrismaClient): ServiceContainer {
  // Create services in correct order (dependency injection)
  const character = new CharacterService(prisma);
  const battle = new BattleService(prisma, character);
  character.setBattleService(battle);
  
  const inventory = new InventoryService(prisma);
  const quest = new QuestService(prisma, character);
  const shop = new ShopService(prisma);
  const location = new LocationService(prisma);
  const mentor = new MentorService(prisma);

  return {
    character,
    inventory,
    quest,
    battle,
    shop,
    location,
    mentor,
    logger
  };
}