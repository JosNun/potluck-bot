# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

**Development:**
- `pnpm run dev` - Start bot in development mode with auto-reload using tsx
- `pnpm run build` - Compile TypeScript to JavaScript in dist/
- `pnpm run start` - Start the compiled bot in production mode
- `pnpm run lint` - Run OXC linter (50-100x faster than ESLint)
- `pnpm run clean` - Remove compiled files

**Deployment:**
- `pnpm run deploy` - Deploy slash commands to Discord (development)
- `pnpm run deploy:prod` - Deploy slash commands to Discord (production)

**Package Manager:** This project uses `pnpm`, not npm. Always use `pnpm` commands.

## Architecture Overview

**Bot Lifecycle:**
1. `src/index.ts` - Main entry point that loads commands and events
2. Dynamic loading system that adapts to dev (.ts) vs production (.js) files
3. Environment-aware file resolution using `getEnvironmentConfig()`

**Command System:**
- **Slash Commands**: Files in `src/commands/` are auto-loaded and registered
- **Text Commands**: Handled via switch statement in `src/events/messageCreate.ts` with `!` prefix
- Commands must export `data` (SlashCommandBuilder) and `execute` function
- Client extended with `commands` Collection via module augmentation in `src/types/index.ts`

**Event System:**
- Event files in `src/events/` are auto-loaded by main bot
- Events can be `once: true` for one-time execution or continuous listeners
- Key events: `ready.ts`, `interactionCreate.ts` (slash commands), `messageCreate.ts` (text commands)

**Environment Configuration:**
- Dual-mode operation: development uses tsx with .ts files, production uses compiled .js files
- Environment variables: `DISCORD_TOKEN`, `CLIENT_ID` required
- `NODE_ENV` determines file extensions and base directories

**Logging System:**
- Uses Pino structured logging (5x faster than alternatives)
- Environment-based: pretty printing in dev, JSON in production
- Context-aware child loggers for commands, events, and bot lifecycle
- Automatic sensitive data redaction (tokens, passwords)
- Logger utilities in `src/utils/logger.ts` provide factories for different contexts

**TypeScript Configuration:**
- Strict mode enabled with comprehensive type checking
- Targets ES2020 with CommonJS modules
- Source maps and declarations generated for debugging

## Key Patterns

**Command Structure:**
```typescript
export default {
  data: new SlashCommandBuilder()
    .setName('command')
    .setDescription('Description'),
  async execute(interaction: CommandInteraction) {
    // Implementation
  },
};
```

**Logging Pattern:**
- Use structured logging with context objects
- Import appropriate logger factory from `src/utils/logger.ts`
- Include relevant metadata (userIds, guildIds, commandNames, etc.)

**Error Handling:**
- Slash commands: Respond with ephemeral error messages
- Text commands: Reply with error message to channel
- All errors logged with full context via Pino

**Development vs Production:**
- Bot automatically detects environment and loads appropriate file types
- Use `tsx` for development hot-reloading
- Compile to `dist/` for production deployment