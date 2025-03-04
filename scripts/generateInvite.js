import dotenv from 'dotenv';
dotenv.config();

const OAUTH2_SCOPES = [
  'bot',
  'applications.commands'
];

// Required Permissions:
// - View Channels (1 << 10)
// - Send Messages (1 << 11)
// - Send Messages in Threads (1 << 12)
// - Create Public Threads (1 << 13)
// - Create Private Threads (1 << 14)
// - Embed Links (1 << 15)
// - Attach Files (1 << 16)
// - Add Reactions (1 << 17)
// - Use External Emojis (1 << 18)
// - Use External Stickers (1 << 19)
// - Read Message History (1 << 20)
// - Use Application Commands (1 << 31)
// - Use Slash Commands (1 << 32)
const PERMISSION_INTEGER = '326417525824';

const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=${PERMISSION_INTEGER}&scope=${OAUTH2_SCOPES.join('%20')}`;

console.log('Bot invite URL:', inviteUrl); 