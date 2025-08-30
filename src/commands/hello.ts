import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('hello')
    .setDescription('Greets the user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to greet (optional)')
        .setRequired(false)),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser('user');
    const userToGreet = targetUser ?? interaction.user;
    
    await interaction.reply(`Hello ${userToGreet.displayName}! 👋`);
  },
};