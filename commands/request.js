const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

// Helper function to get the next case number
async function getNextCaseNumber(pool, tableName, clearanceType) {
  // Query the database to find the highest case number for the given clearance level
  const query = `SELECT request_id FROM ${tableName} WHERE request_id LIKE ? ORDER BY request_id DESC LIMIT 1`;
  const [rows] = await pool.query(query, [`X-${clearanceType}-%`]);

  let nextCaseNumber = 1;
  if (rows.length > 0) {
    const lastRequestId = rows[0].request_id;
    const lastCaseNumber = parseInt(lastRequestId.split('-')[2], 10);
    nextCaseNumber = lastCaseNumber + 1;
  }

  return String(nextCaseNumber).padStart(4, '0');
}

// Helper function to get roles based on the investigation's clearance level
function getClearanceRoles(clearanceType, guild) {
  const roles = [];

  // Add High Command role (always has access)
  const highCommandRole = guild.roles.cache.get(process.env.ROLE_HIGH_COMMAND);
  if (highCommandRole) {
    roles.push({
      id: highCommandRole.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
    });
  }

  // Add Command role for I-CL-01 and I-CL-02
  if (clearanceType === '01' || clearanceType === '02') {
    const commandRole = guild.roles.cache.get(process.env.ROLE_COMMAND);
    if (commandRole) {
      roles.push({
        id: commandRole.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      });
    }
  }

  // Add Lower Command role for I-CL-01
  if (clearanceType === '01') {
    const lowerCommandRole = guild.roles.cache.get(process.env.ROLE_LOWER_COMMAND);
    if (lowerCommandRole) {
      roles.push({
        id: lowerCommandRole.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      });
    }
  }

  return roles;
}

// Helper function to get the role ping based on the investigation's clearance level
function getRolePing(clearanceType) {
  switch (clearanceType) {
    case '01':
      return `<@&${process.env.ROLE_LOWER_COMMAND}>`; // Ping Lower Command
    case '02':
      return `<@&${process.env.ROLE_COMMAND}>`; // Ping Command
    case '03':
      return `<@&${process.env.ROLE_HIGH_COMMAND}>`; // Ping High Command
    default:
      return 'the appropriate role'; // Fallback
  }
}

// Helper function to get the category ID based on the clearance level
function getCategoryId(clearanceType) {
  switch (clearanceType) {
    case '01':
      return process.env.CATEGORY_I_CL_01;
    case '02':
      return process.env.CATEGORY_I_CL_02;
    case '03':
      return process.env.CATEGORY_I_CL_03;
    default:
      return null; // Fallback (no category)
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('investigationrequest')
    .setDescription('Create an investigation request.')
    .addStringOption(option =>
      option.setName('clearance')
        .setDescription('The clearance level of the investigation')
        .setRequired(true)
        .addChoices(
          { name: 'I-CL-01', value: '01' },
          { name: 'I-CL-02', value: '02' },
          { name: 'I-CL-03', value: '03' },
        )),
  async execute(interaction, isEphemeral, pool) {
    const clearanceType = interaction.options.getString('clearance');
    const userId = interaction.user.id;

    try {
      // Get the next case number for the given clearance level
      const caseNumber = await getNextCaseNumber(pool, 'investigation_requests', clearanceType);

      // Generate the channel name in X-YY-ZZZZ format
      const requestId = `X-${clearanceType}-${caseNumber}`;

      // Get the category ID for the clearance level
      const categoryId = getCategoryId(clearanceType);

      // Create the private channel under the appropriate category
      const channel = await interaction.guild.channels.create({
        name: requestId,
        type: ChannelType.GuildText,
        parent: categoryId, // Set the parent category
        permissionOverwrites: [
          {
            id: interaction.guild.id, // @everyone role
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: userId, // Requester
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
          },
          // Add roles based on the investigation's clearance level
          ...getClearanceRoles(clearanceType, interaction.guild),
        ],
      });

      // Log the request in the database
      const query = `INSERT INTO investigation_requests (request_id, requested_by, channel_id) VALUES (?, ?, ?)`;
      await pool.query(query, [requestId, userId, channel.id]);

      // Send a plain text message in the new channel
      await channel.send(`Hi, <@${userId}>. Please fill out the format below, and wait for ${getRolePing(clearanceType)} to answer.`);

      // Send an embed in the new channel
      const embed = new EmbedBuilder()
        .setTitle('Investigation Request')
        .setDescription('Please fill out the following details:')
        .addFields(
          {
            name: 'Format',
            value: '```\nUsername of Suspect: \nRank of Suspect: \nReason for Investigation: \nProof of Reason:\n```',
          },
        )
        .setColor('#FF0000'); // Red color for emphasis

      await channel.send({ embeds: [embed] });

      // Reply to the user
      await interaction.reply({ content: `Investigation request created: ${requestId}`, flags: 'Ephemeral' });
    } catch (error) {
      console.error('Error creating investigation request:', error);
      await interaction.reply({ content: 'There was an error creating your request.', flags: 'Ephemeral' });
    }
  },
};