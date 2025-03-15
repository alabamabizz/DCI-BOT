// index.js (Updated - Removed MySQL Connection)
require('dotenv').config(); // Load environment variables from .env
const { Client, GatewayIntentBits, Collection, Routes, REST, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('./database/db'); // Import the new MySQL connection

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Load commands from the /commands folder
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  client.commands.set(command.data.name, command);
}

// Register global commands
const commands = [];
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error refreshing application (/) commands:', error);
  }
})();

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try {
    await db.testConnection(); // Test database connection from db.js
  } catch (error) {
    console.error('Failed to connect to the database. Exiting...');
    process.exit(1);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction, db); // Pass db instead of MySQL pool
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
  }
});

client.login(process.env.TOKEN);