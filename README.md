# A4A CLAN BOT

Bot Discord RPG berbasis One Piece yang dikembangkan khusus untuk komunitas A4A CLAN.

## 🌟 Fitur yang Sudah Tersedia

### 1. Sistem Karakter
- Pembuatan karakter dengan statistik dasar (HP, Attack, Defense)
- Sistem level up dan experience
- Interaksi dengan karakter utama:
  - Luffy (YB) - Spesialis pertarungan dan petualangan
  - Zoro (Tierison) - Ahli pedang dan pelatihan
  - Usopp (LYuka) - Spesialis jarak jauh dan strategi
  - Sanji (GarryAng) - Ahli support dan buff

### 2. Sistem Eksplorasi
- Penjelajahan antar pulau dengan sistem sailing
- Event acak saat berlayar
- Sistem cuaca yang mempengaruhi perjalanan
- Penemuan item dan harta karun

### 3. Sistem Quest
- Quest dari setiap NPC utama
- Sistem reward (EXP dan item)
- Tracking progress quest
- Quest berantai

### 4. Sistem Inventory
- Manajemen item
- Item dengan efek khusus (Heal/Buff)
- Sistem penggunaan item

### 5. Sistem Pertarungan
- Pertarungan berbasis statistik
- Sistem critical hit
- Damage calculation

## 🚧 Fitur yang Sedang Dikembangkan

1. **Sistem Siang-Malam**
   - Pergantian waktu yang mempengaruhi gameplay
   - Event khusus berdasarkan waktu

2. **Sistem Party**
   - Pertarungan tim
   - Bonus statistik dalam party
   - Pembagian experience

3. **Sistem Leaderboard**
   - Ranking pemain
   - Statistik server
   - Pencapaian khusus

4. **Sistem Aliansi**
   - Pembentukan kelompok
   - Quest khusus aliansi
   - Bonus untuk anggota aliansi

5. **Peta Interaktif**
   - Visualisasi peta yang lebih detail
   - Informasi lokasi real-time
   - Marker untuk quest dan event

## 📜 Perintah yang Tersedia

| Kategori | Perintah | Deskripsi |
|----------|----------|-----------|
| Karakter | `/create-character [nama]` | Buat karakter baru |
| | `/status` | Lihat status karakter |
| | `/interact [npc]` | Bicara dengan NPC |
| Eksplorasi | `/sail [pulau]` | Berlayar ke pulau lain |
| | `/explore` | Jelajahi area saat ini |
| | `/weather` | Cek kondisi cuaca |
| Quest | `/quest list` | Lihat quest tersedia |
| | `/quest accept [id]` | Terima quest |
| | `/quest complete [id]` | Selesaikan quest |
| Inventory | `/inventory` | Lihat inventaris |
| | `/use [item]` | Gunakan item |

## 💻 Informasi Teknis

### Database (Prisma Schema)
```prisma
model User {
  id            String    @id
  discordId     String    @unique
  character     Character?
}

model Character {
  id            String    @id
  name          String
  level         Int
  experience    Int
  health        Int
  attack        Int
  defense       Int
  currentIsland String
}

model Inventory {
  id          String    @id
  itemId      String
  quantity    Int
  characterId String
}

model Quest {
  id          String    @id
  name        String
  description String
  reward      Int
  status      String
}
```

### Services
- BaseService: Penanganan error dan logging
- CharacterService: Manajemen karakter
- BattleService: Sistem pertarungan
- ExplorationService: Sistem eksplorasi
- InventoryService: Manajemen item
- NpcService: Interaksi NPC
- QuestService: Manajemen quest
- WeatherService: Sistem cuaca

## 🛠️ Instalasi

1. Clone repository:
   ```bash
   git clone https://github.com/amaralkaff/a4a-clan-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup environment variables:
   ```env
   DISCORD_TOKEN=token_bot_anda
   CLIENT_ID=id_aplikasi_discord
   GUILD_ID=id_server_discord
   ```

4. Setup database:
   ```bash
   npx prisma migrate dev
   ```

5. Jalankan bot:
   ```bash
   npm start
   ```

## 🤝 Kontribusi

1. Fork repository
2. Buat branch: `git checkout -b fitur-baru`
3. Commit perubahan: `git commit -m 'Menambah fitur baru'`
4. Push ke branch: `git push origin fitur-baru`
5. Buat Pull Request

## 📋 Todo List

- [ ] Implementasi sistem siang-malam
- [ ] Pengembangan sistem party
- [ ] Pembuatan leaderboard
- [ ] Sistem aliansi
- [ ] Peta interaktif
- [ ] Sistem achievement
- [ ] Event server mingguan
- [ ] Sistem trading antar pemain

### A4A CLAN BOT - Discord RPG Bot

Bot Discord berbasis One Piece dengan sistem RPG yang mendalam, dibuat khusus untuk komunitas A4A CLAN.

### Fitur Utama

#### 1. Sistem Karakter
- Buat karakter dengan statistik unik
- Level up dan perkembangan karakter
- Status tracking (HP, Attack, Defense)
- Interaksi dengan NPC utama:
  - Luffy (YB) - Spesialis pertarungan
  - Zoro (Tierison) - Pelatih pedang
  - Usopp (LYuka) - Ahli jarak jauh
  - Sanji (GarryAng) - Spesialis buff/support

#### 2. Sistem Eksplorasi
- Peta dunia dinamis dengan berbagai pulau
- Sistem pelayaran dengan event acak
- Cuaca dinamis yang mempengaruhi gameplay
- Penemuan harta karun dan item

#### 3. Sistem Pertarungan
- Pertarungan berbasis giliran
- Statistik karakter mempengaruhi damage
- Critical hit system
- Party system untuk pertarungan tim

#### 4. Ekonomi & Inventory
- Sistem inventaris untuk item
- Item dengan efek khusus (Heal/Buff)
- Trading system antar pemain
- Quest rewards

#### 5. Quest System
- Quest dari setiap NPC utama
- Rewards berupa EXP dan item
- Quest progression tracking
- Quest chain dan cerita

### Perintah Dasar

| Kategori | Perintah | Deskripsi |
|----------|----------|-----------|
| Karakter | `/create-character [nama]` | Buat karakter baru |
| | `/status` | Lihat status karakter |
| | `/interact [npc]` | Interaksi dengan NPC |
| Eksplorasi | `/sail [pulau]` | Berlayar ke pulau lain |
| | `/explore` | Jelajahi lokasi saat ini |
| | `/weather` | Cek cuaca saat ini |
| Quest | `/quest list` | Lihat quest tersedia |
| | `/quest accept [id]` | Terima quest |
| | `/quest complete [id]` | Selesaikan quest |
| Inventory | `/inventory` | Lihat inventaris |
| | `/use [item]` | Gunakan item |
| | `/trade [player]` | Mulai perdagangan |

### Sistem Teknis

#### Database Schema
- Users (Discord ID, Character data)
- Characters (Stats, Level, Experience)
- Inventory (Items, Quantities)
- Quests (Progress, Status)

#### Services
- BaseService - Error handling & logging
- CharacterService - Manajemen karakter
- BattleService - Sistem pertarungan
- ExplorationService - Sistem eksplorasi
- InventoryService - Manajemen item
- NpcService - Interaksi NPC
- QuestService - Manajemen quest
- WeatherService - Sistem cuaca

#### Event System
- Random encounters saat eksplorasi
- Cuaca dinamis
- Quest events
- Battle events

### Pengembangan

Bot ini dikembangkan menggunakan:
- TypeScript
- Discord.js
- Prisma (Database ORM)
- Node.js

Untuk kontribusi:
1. Fork repository
2. Buat branch fitur
3. Commit perubahan
4. Buat pull request

### Key Points
- Create a unique One Piece-themed Discord bot called "A4A CLAN BOT" with RPG elements, focusing on exploration and interaction with Luffy, Zoro, Usopp, and Sanji.
- Features include map-based sailing, quests, battles, and social interactions, with advanced elements like weather and day-night cycles.
- Users can create characters, explore islands, complete quests, and engage in combat, with progress saved for continuous gameplay.
- A step-by-step guide will be provided in the README.md file, including commands and advanced strategies.

### Bot Idea Overview
The "A4A CLAN BOT" is designed as an immersive roleplaying game (RPG) set in the One Piece universe, offering a fresh take compared to typical Discord bots. Users can create their own characters and explore a map inspired by the One Piece world, interacting with key characters Luffy, Zoro, Usopp, and Sanji. The bot includes unique features like map navigation, random sailing events, and advanced gameplay mechanics such as weather and day-night cycles, making it engaging for advanced players.

### Step-by-Step Usage Guide
The bot will come with a comprehensive README.md file, guiding users through setup and gameplay. Here's a preview of how it works:
- **Invite the bot** to your server using the provided invite link.
- **Create a character** with the `!create-character [name]` command to start your journey.
- **Explore the map** using `!map` to see your location and `!sail [island name]` to travel, encountering events like pirate attacks.
- **Undertake quests** with `!quests` to list available missions, `!accept [quest id]` to start, and `!complete [quest id]` to finish, earning rewards.
- **Engage in battles** using `!battle [enemy name]` for combat, and form parties with `!party invite [user]` for teamwork.
- **Check advanced features** like weather with `!weather` and leaderboard with `!leaderboard` for competitive play.

### Surprising Detail: Dynamic World Evolution
One exciting aspect is that the game world evolves based on user actions, with events and storylines progressing over time, adding a dynamic layer to the gameplay that reacts to the server's collective decisions.

---

### Detailed Survey Note: Comprehensive Analysis of A4A CLAN BOT Development

#### Introduction
The development of the "A4A CLAN BOT," a Discord bot themed around the One Piece anime, aims to provide a unique and advanced roleplaying game (RPG) experience. This survey note outlines the ideation process, feature design, and detailed implementation guide, ensuring the bot stands out from existing Discord bots by focusing on exploration, interaction with key characters, and advanced gameplay mechanics. The bot centers around four specified characters—Luffy, Zoro, Usopp, and Sanji—mapped to #YB, #Tierison, #LYuka, and #GarryAng, respectively, and is designed for advanced users seeking a rich gaming experience.

#### Background Research and Ideation
Initial research involved exploring existing One Piece-themed Discord bots to identify common features and gaps. Searches on platforms like Discord Me and Reddit revealed bots with RPG commands, card games, and roleplaying capabilities, such as the "One piece bot(beta RPG)" ([One Piece Bot on DiscordBotList](https://discordbotlist.com/bots/one-piece-botbeta-rpg)) and "One Piece Card Collect" ([One Piece Card Collect Bot](https://discordbotlist.com/bots/one-piece-card-collect)). These bots primarily focus on economy systems, trading, and basic RPG elements, suggesting a need for a more immersive and map-based experience.

To differentiate, the bot concept incorporates a map-based exploration system, inspired by the One Piece world's vast geography. Research into One Piece world maps, such as those on the One Piece Wiki ([World Map on One Piece Wiki](https://onepiece.fandom.com/wiki/Map:Entire_World)) and interactive globes ([One Piece World Globe](https://claystage.com/one-piece-world)), confirmed the feasibility of implementing a navigable map. Further, exploring Discord bots with map gameplay, like "Map-Bot" on GitHub ([Map-Bot GitHub](https://github.com/Map-Bot/Map-Bot)), highlighted potential for integrating graphical or text-based map interfaces within Discord.

#### Feature Design
The "A4A CLAN BOT" is designed as an advanced RPG with the following core features:

1. **Character Creation and Management:**
   - Users create characters with unique names and attributes, tracked in a database for persistent gameplay. This aligns with the user's request for a game involving character interaction, focusing on Luffy, Zoro, Usopp, and Sanji as key NPCs or quest givers.

2. **Map-based Exploration:**
   - A map of the One Piece world, represented as a graph with islands as nodes (e.g., Loguetown, Grand Line), allows users to sail using commands like `!sail [island name]`. Random events, such as pirate attacks or storms, enhance the sailing experience, drawing from the series' nautical theme.

3. **Quests and Missions:**
   - Quests are provided by the four main characters or found on islands, with predefined objectives and rewards. For example, a quest from Luffy might involve finding a treasure, completed using `!complete [quest id]`. This integrates the characters deeply into gameplay, fulfilling the user's specification.

4. **Combat System:**
   - A turn-based combat system enables battles with AI-controlled enemies or other players, with characters having stats like attack and defense. Users can form parties using `!party invite [user]` for cooperative play, adding a social layer.

5. **Social Interaction:**
   - Features like item trading and alliance formation encourage server-wide engagement, aligning with the "CLAN" aspect of the bot name. This fosters a community-driven experience, distinct from solo-focused bots.

6. **Advanced Features:**
   - Weather and day-night cycles, checked via `!weather` and `!time`, affect gameplay, such as slower sailing during storms. A leaderboard (`!leaderboard`) tracks progress, promoting competition. The world evolves based on user actions, a unique feature adding dynamism.

#### Implementation Details
The bot will be implemented using Python and the `discord.py` library, with SQLite for database management. The database setup includes tables for users, characters, items, and quests, ensuring persistent state. For example:

| Table Name | Description                          | Example Fields                     |
|------------|--------------------------------------|------------------------------------|
| users      | Stores user character data           | user_id, character_name, location, experience, level |
| quests     | Lists available quests               | id, name, description, reward, location |
| items      | Tracks user inventory                | item_id, user_id, name, quantity   |

The map is implemented as a dictionary, with islands and their connections, allowing navigation. Combat is handled through a `Character` class with methods for attacks and health tracking, ensuring a balanced gameplay experience.

#### Step-by-Step Usage Guide in README.md
The README.md file will provide a detailed, checkbox-style guide for users, ensuring accessibility for both new and advanced players. Below is a sample structure:

```markdown
# Welcome to A4A CLAN BOT

A4A CLAN BOT is a Discord bot that brings the world of One Piece to your server with an engaging roleplaying game. Create your own pirate or marine character, explore the vast seas, interact with iconic characters, and embark on thrilling quests.

## Getting Started

- [ ] **Invite the Bot:**
  - Click [here](https://yourbotinviteurl.com) to invite A4A CLAN BOT to your Discord server.

- [ ] **Set Up Permissions:**
  - Ensure the bot has the necessary permissions to read and send messages in your server.

- [ ] **Create Your Character:**
  - Use the `!create-character [name]` command to create your character.
  - You can customize your character's attributes and appearance later.

## Exploring the World

- [ ] **View the Map:**
  - Use `!map` to see your current location and nearby islands.

- [ ] **Sail to Islands:**
  - Use `!sail [island name]` to travel to a different island.
  - Be prepared for random events during your journey, such as pirate attacks or storms.

## Quests and Missions

- [ ] **Find Quests:**
  - Talk to NPCs or use `!quests` to see available quests.
  - Quests can be accepted using `!accept [quest id]`.

- [ ] **Complete Quests:**
  - Follow the quest objectives and use `!complete [quest id]` when finished.
  - Earn rewards and experience points upon successful completion.

## Combat System

- [ ] **Engage in Battles:**
  - Use `!battle [enemy name]` to start a battle with an enemy.
  - Use your character's abilities to defeat enemies and gain loot.

- [ ] **Party Battles:**
  - Form a party with other users using `!party invite [user]`.
  - Engage in battles together for tougher challenges.

## Advanced Features

- [ ] **Weather and Time:**
  - The game has a dynamic weather system and day-night cycle that affects gameplay.
  - Check the current conditions with `!weather` and `!time`.

- [ ] **Leaderboard:**
  - See the top players in your server with `!leaderboard`.
  - Compete to be the strongest pirate or marine.

## Commands Reference

| Command                  | Description                              |
|--------------------------|------------------------------------------|
| `!create-character [name]` | Create a new character.                  |
| `!map`                   | Display the current map and location.    |
| `!sail [island name]`    | Sail to a specified island.              |
| `!quests`                | List available quests.                   |
| `!accept [quest id]`     | Accept a quest.                          |
| `!complete [quest id]`   | Complete a quest.                        |
| `!battle [enemy name]`   | Start a battle with an enemy.            |
| `!party invite [user]`   | Invite a user to your party.             |
| `!weather`               | Check current weather conditions.        |
| `!time`                  | Check the current time of day.           |
| `!leaderboard`           | View the server leaderboard.             |

## Tips and Tricks

- **Character Development:** Regularly complete quests to level up and improve your character's stats. Use loot from battles to acquire better equipment.
- **Exploration:** Discover hidden islands and secret locations for unique rewards. Be cautious of dangerous areas and prepare accordingly.
- **Social Interaction:** Form alliances and trade items with other players to enhance your gameplay. Participate in server events and competitions for additional rewards.

## Support and Feedback

For any issues or feedback, please contact the bot developer via [email](mailto:your_email@example.com) or join the support server [here](https://your_support_server_invite.com).

Happy adventuring!
```

This guide ensures users can easily follow steps, with checkboxes for tracking progress, and includes advanced strategies for maximizing gameplay.

#### Conclusion
The "A4A CLAN BOT" offers a unique blend of map-based exploration, character interaction, and advanced RPG mechanics, fulfilling the user's request for an "awesome" and distinct Discord bot. By leveraging the One Piece theme and focusing on Luffy, Zoro, Usopp, and Sanji, the bot provides a rich, immersive experience for advanced players, with a comprehensive README.md ensuring accessibility and engagement.

#### Key Citations
- [One Piece World Map on One Piece Wiki](https://onepiece.fandom.com/wiki/Map:Entire_World)
- [One Piece World Globe Interactive Map](https://claystage.com/one-piece-world)
- [One Piece Bot on DiscordBotList](https://discordbotlist.com/bots/one-piece-botbeta-rpg)
- [One Piece Card Collect Bot on DiscordBotList](https://discordbotlist.com/bots/one-piece-card-collect)
- [Map-Bot GitHub Repository for Map Games](https://github.com/Map-Bot/Map-Bot)