/*
  Warnings:

  - You are about to alter the column `value` on the `Item` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" BIGINT NOT NULL DEFAULT 0,
    "effect" TEXT NOT NULL DEFAULT '{}',
    "maxDurability" INTEGER,
    "stackLimit" INTEGER NOT NULL DEFAULT 999,
    "rarity" TEXT NOT NULL DEFAULT 'COMMON',
    "baseStats" TEXT DEFAULT '{}',
    "upgradeStats" TEXT DEFAULT '{}',
    "maxLevel" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Item" ("baseStats", "createdAt", "description", "effect", "id", "maxDurability", "maxLevel", "name", "rarity", "stackLimit", "type", "updatedAt", "upgradeStats", "value") SELECT "baseStats", "createdAt", "description", "effect", "id", "maxDurability", "maxLevel", "name", "rarity", "stackLimit", "type", "updatedAt", "upgradeStats", "value" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE INDEX "Item_type_rarity_idx" ON "Item"("type", "rarity");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
