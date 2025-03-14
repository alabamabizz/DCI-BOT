// index.js
require('dotenv').config(); // Load environment variables from .env
const { Client, GatewayIntentBits, Collection, Routes, REST, EmbedBuilder } = require('discord.js');
const mysql = require('mysql2/promise'); // Import the MySQL library
const fs = require('fs');
const path = require('path');

// Create a new Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Create a database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306, // Use the specified port or default to 3306
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test the database connection
async function testDatabaseConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Connected to the database!');
    connection.release();
  } catch (error) {
    console.error('Error connecting to the database:', error);
    throw error; // Re-throw the error to stop the bot
  }
}

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

    // Register global commands
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error refreshing application (/) commands:', error);
  }
})();

// Event: When the bot is ready
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Test the database connection when the bot starts
  try {
    await testDatabaseConnection();
  } catch (error) {
    console.error('Failed to connect to the database. Exiting...');
    process.exit(1); // Exit the bot if the database connection fails
  }
});

// Event: When a slash command is executed
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    // Execute the command with the database connection pool
    await command.execute(interaction, pool); // Pass the pool object here
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'There was an error while executing this command!', flags: 'Ephemeral' });
  }
});

// Logging function
async function logCommand(interaction, commandName) {
  const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('Command Executed')
    .setDescription(`**Command:** ${commandName}`)
    .addFields(
      { name: 'User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
      { name: 'Channel', value: `${interaction.channel.name} (${interaction.channel.id})`, inline: true },
    )
    .setThumbnail(interaction.user.displayAvatarURL())
    .setColor('#00FF00') // Green color for logs
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
}

// Log bot startup
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const logChannel = client.channels.cache.get(process.env.LOG_CHANNEL_ID);
  if (logChannel) {
    const embed = new EmbedBuilder()
      .setTitle('Bot Started')
      .setDescription('The bot has successfully started.')
      .setColor('#00FF00') // Green color for logs
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  }

  // Test the database connection
  try {
    await testDatabaseConnection();
  } catch (error) {
    console.error('Failed to connect to the database. Exiting...');
    process.exit(1); // Exit the bot if the database connection fails
  }
});

// Log in to Discord
client.login(process.env.TOKEN);