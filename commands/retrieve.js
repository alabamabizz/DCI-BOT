const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Helper function to check if a channel is a ticket
function isTicketChannel(channelName) {
  const prefixes = ['x-', 'i-', 'closed-x-', 'closed-i-'];
  return prefixes.some(prefix => channelName.toLowerCase().startsWith(prefix));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('retrieve')
    .setDescription('Retrieve a transcript by ticket ID.')
    .addStringOption(option =>
      option.setName('ticket_id')
        .setDescription('The ticket ID (e.g., X-01-0001)')
        .setRequired(true)),
  async execute(interaction, pool) {
    const ticketId = interaction.options.getString('ticket_id');
    const userRoles = interaction.member.roles.cache;

    try {
      // Fetch the transcript from the database
      const [rows] = await pool.query('SELECT * FROM ticket_transcripts WHERE ticket_id = ?', [ticketId]);

      if (rows.length === 0) {
        return interaction.reply({ content: 'Transcript not found.', flags: 'Ephemeral' });
      }

      const transcript = rows[0];

      // Determine the clearance level of the ticket
      const clearanceLevel = ticketId.split('-')[1]; // e.g., "01" from "X-01-0001"

      // Check if the user has the required role to retrieve the transcript
      let hasPermission = false;

      if (clearanceLevel === '01') {
        // I-CL-01: Lower Command, Command, High Command
        hasPermission = userRoles.has(process.env.ROLE_LOWER_COMMAND) ||
                        userRoles.has(process.env.ROLE_COMMAND) ||
                        userRoles.has(process.env.ROLE_HIGH_COMMAND);
      } else if (clearanceLevel === '02') {
        // I-CL-02: Command, High Command
        hasPermission = userRoles.has(process.env.ROLE_COMMAND) ||
                        userRoles.has(process.env.ROLE_HIGH_COMMAND);
      } else if (clearanceLevel === '03') {
        // I-CL-03: High Command only
        hasPermission = userRoles.has(process.env.ROLE_HIGH_COMMAND);
      }

      if (!hasPermission) {
        return interaction.reply({ content: 'You do not have permission to retrieve this transcript.', flags: 'Ephemeral' });
      }

      // Send the transcript file to the user
      await interaction.reply({
        content: `Transcript for ${ticketId}:`,
        files: [transcript.file_path],
        flags: 'Ephemeral',
      });

      // Log the command
      await logCommand(interaction, 'retrieve');
    } catch (error) {
      console.error('Error retrieving transcript:', error);
      await interaction.reply({ content: 'There was an error retrieving the transcript.', flags: 'Ephemeral' });
    }
  },
};