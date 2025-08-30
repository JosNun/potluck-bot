# Discord Bot Starter (TypeScript)

A modern Discord bot starter template built with TypeScript, discord.js v14, and OXC for fast linting.

## Features

- ⚡ **Fast**: Built with TypeScript and OXC linting (50-100x faster than ESLint)
- 🎯 **Modern**: Uses discord.js v14 with latest best practices
- 🔧 **Ready to use**: Includes example slash commands and text commands
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
│   ├── ping.ts       # Ping command with latency
│   ├── hello.ts      # Hello command with user option
│   └── serverinfo.ts # Server information embed
├── events/            # Discord events
│   ├── ready.ts      # Bot ready event
│   ├── interactionCreate.ts  # Slash command handler
│   └── messageCreate.ts      # Text command handler
├── types/            # TypeScript type definitions
│   └── index.ts      # Command interface & client extensions
├── utils/            # Utility functions (empty for now)
├── index.ts          # Main bot file
└── deploy-commands.ts # Command deployment script
```

## Example Commands

### Slash Commands
- `/ping` - Shows bot latency and heartbeat
- `/hello [@user]` - Greets you or another user
- `/serverinfo` - Displays server information with embed

### Text Commands (prefix: `!`)
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
- **[OXC](https://oxc.rs/)** - Fast Rust-based linter
- **[tsx](https://github.com/esbuild-kit/tsx)** - TypeScript execution engine
- **[pnpm](https://pnpm.io/)** - Fast, disk space efficient package manager

## License

ISC