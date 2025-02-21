/*
  Warnings:

  - You are about to drop the column `mentor` on the `Quest` table. All the data in the column will be lost.
  - You are about to drop the column `requiredLevel` on the `Quest` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Quest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "objectives" TEXT NOT NULL DEFAULT '{"tasks":[]}',
    "rewards" TEXT NOT NULL DEFAULT '{}',
    "reward" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "characterId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'MISC',
    "isDaily" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME,
    CONSTRAINT "Quest_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Quest" ("characterId", "createdAt", "description", "expiresAt", "id", "isDaily", "name", "objectives", "reward", "status", "type", "updatedAt") SELECT "characterId", "createdAt", "description", "expiresAt", "id", "isDaily", "name", "objectives", "reward", "status", "type", "updatedAt" FROM "Quest";
DROP TABLE "Quest";
ALTER TABLE "new_Quest" RENAME TO "Quest";
CREATE INDEX "Quest_characterId_idx" ON "Quest"("characterId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
