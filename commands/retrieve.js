// retrieve.js - Retrieves saved transcript with role checks
const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../database/db');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('retrieve')
        .setDescription('Retrieve a saved transcript')
        .addStringOption(option =>
            option.setName('ticket_id')
                .setDescription('The ticket ID to retrieve')
                .setRequired(true)
        ),

    async execute(interaction) {
        const ticketId = interaction.options.getString('ticket_id');
        const userRoles = interaction.member.roles.cache.map(role => role.id);
        
        // Extract ticket type (V/I) and clearance level (01/02/03)
        const match = ticketId.match(/^([VI])-(\d{2})-\d{4}$/);
        if (!match) return interaction.reply({ content: 'Invalid ticket ID format.', ephemeral: true });
        
        const [_, type, clearance] = match;
        const requiredRoles = {
            '01': [process.env.ROLE_LOWER_COMMAND, process.env.ROLE_COMMAND, process.env.ROLE_HIGH_COMMAND],
            '02': [process.env.ROLE_COMMAND, process.env.ROLE_HIGH_COMMAND],
            '03': [process.env.ROLE_HIGH_COMMAND]
        };

        if (!userRoles.some(role => requiredRoles[clearance].includes(role))) {
            return interaction.reply({ content: 'You do not have permission to retrieve this transcript.', ephemeral: true });
        }

        // Get transcript file path from database
        const [result] = await db.query(`SELECT file_path FROM ticket_transcripts WHERE request_id = ?`, [ticketId]);
        if (!result.length) return interaction.reply({ content: 'No transcript found for this ticket.', ephemeral: true });
        
        const transcriptPath = result[0].file_path;
        if (!fs.existsSync(transcriptPath)) return interaction.reply({ content: 'Transcript file is missing from the server.', ephemeral: true });
        
        const file = new AttachmentBuilder(transcriptPath, { name: `${ticketId}.html` });
        await interaction.reply({ content: `Here is the transcript for **${ticketId}**`, files: [file], ephemeral: true });
    }
};
