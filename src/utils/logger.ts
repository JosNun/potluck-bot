import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  redact: {
    paths: [
      'token',
      'password',
      '*.token',
      'DISCORD_TOKEN',
      'user.email',
      'member.user.email'
    ],
    censor: '[REDACTED]'
  },
  transport: isDev ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  } : undefined,
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err
  }
});

export const createBotLogger = (botId?: string) => {
  return logger.child({
    service: 'discord-bot',
    ...(botId && { botId })
  });
};

export const createCommandLogger = (interaction: any) => {
  return logger.child({
    service: 'discord-bot',
    event: 'slash_command',
    commandName: interaction.commandName,
    userId: interaction.user.id,
    guildId: interaction.guild?.id,
    interactionId: interaction.id
  });
};

export const createEventLogger = (eventName: string, context: Record<string, any> = {}) => {
  return logger.child({
    service: 'discord-bot',
    event: eventName,
    ...context
  });
};

export default logger;