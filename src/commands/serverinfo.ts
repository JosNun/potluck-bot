import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Displays information about the server'),
  
  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply('This command can only be used in a server!');
      return;
    }

    const { guild } = interaction;
    
    const embed = new EmbedBuilder()
      .setTitle(`${guild.name} Server Information`)
      .setThumbnail(guild.iconURL())
      .addFields(
        { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
        { name: '📅 Created', value: guild.createdAt.toDateString(), inline: true },
        { name: '👥 Members', value: guild.memberCount.toString(), inline: true },
        { name: '📁 Channels', value: guild.channels.cache.size.toString(), inline: true },
        { name: '😀 Emojis', value: guild.emojis.cache.size.toString(), inline: true },
        { name: '🎭 Roles', value: guild.roles.cache.size.toString(), inline: true }
      )
      .setColor('#0099ff')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};