require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

const commands = [
  new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get weather information')
    .addStringOption(option => 
      option.setName('location')
        .setDescription('The location to get weather for (optional)')
        .setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('addlocation')
    .setDescription('Add a location to saved locations')
    .addStringOption(option => 
      option.setName('location')
        .setDescription('The location to add')
        .setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('removelocation')
    .setDescription('Remove a location from saved locations')
    .addStringOption(option => 
      option.setName('location')
        .setDescription('The location to remove')
        .setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('listlocations')
    .setDescription('List all saved locations'),
  
  new SlashCommandBuilder()
    .setName('forecast')
    .setDescription('Get 5-day weather forecast')
    .addStringOption(option => 
      option.setName('location')
        .setDescription('The location to get forecast for')
        .setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('weatherhelp')
    .setDescription('Show help for weather bot commands'),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');
    
    // The .put() method is used to fully refresh all commands with the current set
    const clientId = process.env.CLIENT_ID; // Add this to your .env file
    const guildId = process.env.GUILD_ID; // Optional - add for guild-specific commands
    
    if (guildId) {
      // Guild commands - update faster but only work in the specified guild
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands },
      );
      console.log('Successfully reloaded guild application (/) commands.');
    } else {
      // Global commands - can take up to an hour to update
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands },
      );
      console.log('Successfully reloaded global application (/) commands.');
    }
  } catch (error) {
    console.error(error);
  }
})();