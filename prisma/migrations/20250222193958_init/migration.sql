-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discordId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "health" INTEGER NOT NULL DEFAULT 100,
    "maxHealth" INTEGER NOT NULL DEFAULT 100,
    "attack" INTEGER NOT NULL DEFAULT 10,
    "defense" INTEGER NOT NULL DEFAULT 10,
    "currentIsland" TEXT NOT NULL DEFAULT 'foosha',
    "mentor" TEXT,
    "luffyProgress" INTEGER NOT NULL DEFAULT 0,
    "zoroProgress" INTEGER NOT NULL DEFAULT 0,
    "usoppProgress" INTEGER NOT NULL DEFAULT 0,
    "sanjiProgress" INTEGER NOT NULL DEFAULT 0,
    "dailyHealCount" INTEGER NOT NULL DEFAULT 0,
    "lastHealTime" DATETIME,
    "lastDailyReset" DATETIME,
    "combo" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "winStreak" INTEGER NOT NULL DEFAULT 0,
    "highestStreak" INTEGER NOT NULL DEFAULT 0,
    "questPoints" INTEGER NOT NULL DEFAULT 0,
    "explorationPoints" INTEGER NOT NULL DEFAULT 0,
    "statusEffects" TEXT NOT NULL DEFAULT '{"effects":[]}',
    "activeBuffs" TEXT NOT NULL DEFAULT '{"buffs":[]}',
    "coins" INTEGER NOT NULL DEFAULT 0,
    "bank" INTEGER NOT NULL DEFAULT 0,
    "totalGambled" INTEGER NOT NULL DEFAULT 0,
    "totalWon" INTEGER NOT NULL DEFAULT 0,
    "lastGambleTime" DATETIME,
    "equippedWeapon" TEXT,
    "equippedArmor" TEXT,
    "equippedAccessory" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Character_currentIsland_fkey" FOREIGN KEY ("currentIsland") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Battle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "enemyType" TEXT NOT NULL,
    "enemyLevel" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "turns" TEXT NOT NULL DEFAULT '[]',
    "finalStats" TEXT DEFAULT '{}',
    "rewards" TEXT DEFAULT '{}',
    CONSTRAINT "Battle_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "durability" INTEGER,
    "isEquipped" BOOLEAN NOT NULL DEFAULT false,
    "slot" TEXT,
    "expiresAt" DATETIME,
    "characterId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Inventory_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inventory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "effect" TEXT NOT NULL DEFAULT '{}',
    "maxDurability" INTEGER,
    "stackLimit" INTEGER NOT NULL DEFAULT 999,
    "rarity" TEXT NOT NULL DEFAULT 'COMMON',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL DEFAULT 'none',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "objectives" TEXT NOT NULL DEFAULT '{}',
    "rewards" TEXT NOT NULL DEFAULT '{}',
    "progress" TEXT NOT NULL DEFAULT '{"current": 0, "required": 1}',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "characterId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "expiresAt" DATETIME,
    CONSTRAINT "Quest_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "requirements" TEXT NOT NULL DEFAULT '{}',
    "objectives" TEXT NOT NULL DEFAULT '{}',
    "rewards" TEXT NOT NULL DEFAULT '{}',
    "isRepeatable" BOOLEAN NOT NULL DEFAULT false,
    "cooldown" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "weather" TEXT NOT NULL DEFAULT 'sunny',
    "lastWeatherUpdate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeEvent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateIndex
CREATE INDEX "User_discordId_idx" ON "User"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "Character_userId_key" ON "Character"("userId");

-- CreateIndex
CREATE INDEX "Character_level_currentIsland_idx" ON "Character"("level", "currentIsland");

-- CreateIndex
CREATE INDEX "Character_mentor_idx" ON "Character"("mentor");

-- CreateIndex
CREATE INDEX "Character_lastDailyReset_idx" ON "Character"("lastDailyReset");

-- CreateIndex
CREATE INDEX "Battle_characterId_status_idx" ON "Battle"("characterId", "status");

-- CreateIndex
CREATE INDEX "Inventory_characterId_isEquipped_slot_idx" ON "Inventory"("characterId", "isEquipped", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_characterId_itemId_key" ON "Inventory"("characterId", "itemId");

-- CreateIndex
CREATE INDEX "Item_type_rarity_idx" ON "Item"("type", "rarity");

-- CreateIndex
CREATE INDEX "Quest_characterId_status_idx" ON "Quest"("characterId", "status");

-- CreateIndex
CREATE INDEX "Quest_templateId_idx" ON "Quest"("templateId");

-- CreateIndex
CREATE INDEX "Location_level_idx" ON "Location"("level");

-- CreateIndex
CREATE INDEX "Location_weather_idx" ON "Location"("weather");

-- CreateIndex
CREATE INDEX "Transaction_characterId_type_createdAt_idx" ON "Transaction"("characterId", "type", "createdAt");
