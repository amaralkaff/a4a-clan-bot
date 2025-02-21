-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Location" (
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
INSERT INTO "new_Location" ("activeEvent", "createdAt", "description", "id", "lastWeatherUpdate", "level", "name", "updatedAt", "weather") SELECT "activeEvent", "createdAt", "description", "id", "lastWeatherUpdate", "level", "name", "updatedAt", "weather" FROM "Location";
DROP TABLE "Location";
ALTER TABLE "new_Location" RENAME TO "Location";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
