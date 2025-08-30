import { SlashCommandBuilder, CommandInteraction } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),
  
  async execute(interaction: CommandInteraction) {
    await interaction.reply('Pinging...');
    const sent = await interaction.fetchReply();
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const heartbeat = Math.round(interaction.client.ws.ping);
    
    await interaction.editReply(`🏓 Pong!\n**Roundtrip**: ${roundtrip}ms\n**Heartbeat**: ${heartbeat}ms`);
  },
};