const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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
      const channelName = `X-${clearanceType}-${caseNumber}`;

      // Create the private channel
      const channel = await interaction.guild.channels.create({
        name: channelName,
        type: 'GUILD_TEXT',
        permissionOverwrites: [
          {
            id: interaction.guild.id, // @everyone role
            deny: ['VIEW_CHANNEL'],
          },
          {
            id: userId, // Requester
            allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
          },
          // Add roles based on the investigation's clearance level
          ...getClearanceRoles(clearanceType, interaction.guild),
        ],
      });

      // Log the request in the database
      const query = `INSERT INTO investigation_requests (request_id, requested_by, channel_id) VALUES (?, ?, ?)`;
      await pool.query(query, [channelName, userId, channel.id]);

      // Send a plain text message in the new channel
      await channel.send(`Hi, <@${userId}>. Please fill out the format below, and wait for ${getRolePing(clearanceType)} to answer.`);

      // Send an embed in the new channel
      const embed = new EmbedBuilder()
        .setTitle('Investigation Request')
        .setDescription('Please fill out the following details:')
        .addFields(
          { name: 'Username of Suspect:', value: 'N/A', inline: true },
          { name: 'Rank of Suspect:', value: 'N/A', inline: true },
          { name: 'Reason for Investigation:', value: 'N/A' },
          { name: 'Proof of Reason:', value: 'N/A' },
        )
        .setColor('#FF0000'); // Red color for emphasis

      await channel.send({ embeds: [embed] });

      // Reply to the user
      await interaction.reply({ content: `Investigation request created: ${channelName}`, flags: 'Ephemeral' });
    } catch (error) {
      console.error('Error creating investigation request:', error);
      await interaction.reply({ content: 'There was an error creating your request.', flags: 'Ephemeral' });
    }
  },
};