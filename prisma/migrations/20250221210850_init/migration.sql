-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discordId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    "currentIsland" TEXT NOT NULL DEFAULT 'starter_island',
    "mentor" TEXT,
    "luffyProgress" INTEGER NOT NULL DEFAULT 0,
    "zoroProgress" INTEGER NOT NULL DEFAULT 0,
    "usoppProgress" INTEGER NOT NULL DEFAULT 0,
    "sanjiProgress" INTEGER NOT NULL DEFAULT 0,
    "dailyHealCount" INTEGER NOT NULL DEFAULT 0,
    "lastHealTime" DATETIME,
    "combo" INTEGER NOT NULL DEFAULT 0,
    "questPoints" INTEGER NOT NULL DEFAULT 0,
    "explorationPoints" INTEGER NOT NULL DEFAULT 0,
    "lastDailyReset" DATETIME,
    "statusEffects" TEXT NOT NULL DEFAULT '{}',
    "activeBuffs" TEXT NOT NULL DEFAULT '{}',
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Character_currentIsland_fkey" FOREIGN KEY ("currentIsland") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "characterId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Inventory_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'COMBAT',
    "objectives" TEXT NOT NULL DEFAULT '{"tasks":[]}',
    "reward" INTEGER NOT NULL,
    "requiredLevel" INTEGER NOT NULL DEFAULT 1,
    "mentor" TEXT,
    "isDaily" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "characterId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quest_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BattleLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "enemyType" TEXT NOT NULL,
    "enemyLevel" INTEGER NOT NULL,
    "damage" INTEGER NOT NULL,
    "experience" INTEGER NOT NULL,
    "rewards" TEXT NOT NULL DEFAULT '{}',
    "won" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BattleLog_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "Character_userId_key" ON "Character"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_characterId_itemId_key" ON "Inventory"("characterId", "itemId");

-- Initial data
INSERT INTO "Location" ("id", "name", "description", "level", "weather", "lastWeatherUpdate") VALUES
('starter_island', 'Starter Island', 'A peaceful island where new adventures begin', 1, 'sunny', CURRENT_TIMESTAMP),
('shell_town', 'Shell Town', 'A marine base town where Zoro was first met', 5, 'sunny', CURRENT_TIMESTAMP),
('orange_town', 'Orange Town', 'A small port town once terrorized by Buggy the Clown', 8, 'sunny', CURRENT_TIMESTAMP),
('syrup_village', 'Syrup Village', 'Usopps hometown with its peaceful shores', 12, 'sunny', CURRENT_TIMESTAMP),
('baratie', 'Baratie', 'A floating restaurant run by fighting chefs', 15, 'sunny', CURRENT_TIMESTAMP);
