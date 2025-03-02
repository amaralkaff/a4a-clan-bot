// src/services/index.ts
import { PrismaClient } from '@prisma/client';
import { CharacterService } from './CharacterService';
import { InventoryService } from './InventoryService';
import { QuestService } from './QuestService';
import { BattleService } from './BattleService';
import { ShopService } from './ShopService';
import { LocationService } from './LocationService';
import { MentorService } from './MentorService';
import { WeaponService } from './WeaponService';
import { EquipmentService } from './EquipmentService';
import { GamblingService } from './GamblingService';
import { DuelService } from './DuelService';
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
  logger: typeof logger;
}

export function createServices(prisma: PrismaClient): ServiceContainer {
  // Create services in correct order (dependency injection)
  const character = new CharacterService(prisma);
  const battle = new BattleService(prisma, character);
  character.setBattleService(battle);
  
  const inventory = new InventoryService(prisma, character);
  const quest = new QuestService(prisma, character);
  const shop = new ShopService(prisma, character);
  const location = new LocationService(prisma, character);
  const mentor = new MentorService(prisma, character);
  const weaponService = new WeaponService(prisma);
  const equipmentService = new EquipmentService(prisma);
  const gambling = new GamblingService(prisma, character);
  const duel = new DuelService(prisma);
  duel.setBattleService(battle);

  return {
    character,
    inventory,
    quest,
    battle,
    shop,
    location,
    mentor,
    weapon: weaponService,
    equipment: equipmentService,
    gambling,
    duel,
    logger
  };
}