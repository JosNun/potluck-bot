# Potluck Bot

A Discord bot for organizing potluck events with interactive item management. Users can create potlucks, claim items, and add custom items through an intuitive interface.

## Features

- 🍽️ **Interactive Potlucks**: Create and manage potluck events with clickable buttons
- 📋 **Item Management**: Users can claim/unclaim items and add custom items
- 💾 **SQLite Storage**: Persistent database for reliable data storage
- ⚡ **Fast**: Built with TypeScript and OXC linting (50-100x faster than ESLint)
- 🎯 **Modern**: Uses discord.js v14 with latest best practices
- 📦 **pnpm**: Package manager for faster installs and better dependency management
- 🛡️ **Type-safe**: Full TypeScript support with strict mode enabled

## Quick Start

### 1. Clone and Install

```bash
# Clone this repository
git clone <your-repo-url>
cd potluck-bot

# Install dependencies
pnpm install
```

### 2. Setup Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your bot credentials
```

Add your Discord bot token and application ID to `.env`:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
```

### 3. Deploy Commands & Start

```bash
# Deploy slash commands to Discord
pnpm run deploy

# Start the bot in development mode
pnpm run dev
```

## Scripts

- `pnpm run dev` - Start bot in development mode with auto-reload
- `pnpm run build` - Compile TypeScript to JavaScript
- `pnpm run start` - Start the compiled bot
- `pnpm run deploy` - Deploy slash commands to Discord
- `pnpm run lint` - Run OXC linter on source files
- `pnpm run clean` - Remove compiled files

## Project Structure

```
src/
├── commands/          # Slash commands
│   ├── potluck.ts    # Main potluck command with modal/button handlers
│   ├── ping.ts       # Ping command with latency
│   ├── hello.ts      # Hello command with user option
│   └── serverinfo.ts # Server information embed
├── events/            # Discord events
│   ├── ready.ts      # Bot ready event
│   ├── interactionCreate.ts  # Handles slash commands, modals & buttons
│   └── messageCreate.ts      # Text command handler
├── storage/          # Data persistence layer
│   ├── potluck.ts    # Potluck data types and interfaces
│   ├── sqlite-potluck-storage.ts   # SQLite implementation
│   ├── storage-factory.ts          # Storage factory
│   └── sqlite-adapter.ts           # SQLite database adapter
├── types/            # TypeScript type definitions
│   └── index.ts      # Command interface & client extensions
├── utils/            # Utility functions
│   └── logger.ts     # Pino structured logging
├── index.ts          # Main bot file
└── deploy-commands.ts # Command deployment script
```

## How to Use

### Creating a Potluck

Use the `/potluck` command to create a new potluck event:

1. Run `/potluck` in any channel
2. Fill out the modal form:
   - **Potluck Name**: Required (e.g., "Team Holiday Party")
   - **Date**: Optional (e.g., "Saturday, Dec 14th at 6pm")
   - **Theme**: Optional (e.g., "Italian", "Tacos", "Holiday treats")
   - **Items needed**: Required, one per line (e.g., "lettuce", "tortillas", "cheese")

### Managing Items

Once created, the potluck displays as an interactive embed with:
- **Claim/Unclaim buttons**: Click any item button to claim or unclaim it
- **Add Custom Item**: Green button to add items not in the original list
- **Real-time updates**: The embed updates automatically as people claim items
- **Multiple claims**: Multiple people can claim the same item if needed

### Other Commands

**Utility Commands:**
- `/ping` - Shows bot latency and heartbeat
- `/hello [@user]` - Greets you or another user
- `/serverinfo` - Displays server information with embed

**Text Commands (prefix: `!`):**
- `!ping` - Simple pong response
- `!hello` - Greets the user
- `!info` - Shows basic bot statistics

## Adding New Commands

### Slash Commands

Create a new file in `src/commands/` following this template:

```typescript
import { SlashCommandBuilder, CommandInteraction } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('yourcommand')
    .setDescription('Your command description'),
  
  async execute(interaction: CommandInteraction) {
    await interaction.reply('Your response here!');
  },
};
```

### Text Commands

Add new cases to the switch statement in `src/events/messageCreate.ts`.

## Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the token to your `.env` file
5. Copy the Application ID to your `.env` file
6. Invite the bot to your server with proper permissions

### Required Permissions
- Send Messages
- Use Slash Commands
- Read Message History
- Embed Links

### Required Intents
- Guilds
- Guild Messages
- Message Content (for text commands)

## Technologies Used

- **[discord.js](https://discord.js.org/)** - Powerful Discord API library
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** - Fast SQLite database for Node.js
- **[Pino](https://getpino.io/)** - High-performance structured logging
- **[OXC](https://oxc.rs/)** - Fast Rust-based linter
- **[tsx](https://github.com/esbuild-kit/tsx)** - TypeScript execution engine
- **[pnpm](https://pnpm.io/)** - Fast, disk space efficient package manager

## License

MIT