const { SlashCommandBuilder } = require('discord.js');
const { createTicket } = require('../utils/ticketUtils');
const db = require('../database/db');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('request')
        .setDescription('Request an Investigation or Intelligence Log')
        .addStringOption(option => 
            option.setName('type')
                .setDescription('Select the request type')
                .setRequired(true)
                .addChoices(
                    { name: 'Investigation', value: 'V' },
                    { name: 'Intelligence Log', value: 'I' }
                )
        )
        .addStringOption(option => 
            option.setName('clearance')
                .setDescription('Select the clearance level')
                .setRequired(true)
                .addChoices(
                    { name: 'I-CL-01', value: '01' },
                    { name: 'I-CL-02', value: '02' },
                    { name: 'I-CL-03', value: '03' }
                )
        ),

    async execute(interaction) {
        const type = interaction.options.getString('type'); // 'V' or 'I'
        const clearance = interaction.options.getString('clearance'); // '01', '02', '03'
        const userId = interaction.user.id;
        
        // Generate ticket ID
        const [count] = await db.query(`SELECT COUNT(*) AS count FROM ${type === 'V' ? 'investigation_requests' : 'intelligence_requests'}`);
        const ticketId = `${type}-${clearance}-${String(count.count + 1).padStart(4, '0')}`;
        
        // Create the ticket channel
        const channel = await createTicket(interaction, type, clearance, ticketId);
        if (!channel) return interaction.reply({ content: 'Failed to create ticket.', ephemeral: true });

        // Save request to database
        const table = type === 'V' ? 'investigation_requests' : 'intelligence_requests';
        await db.query(`INSERT INTO ${table} (request_id, requested_by, channel_id, created_at, status) VALUES (?, ?, ?, NOW(), 'active')`, [ticketId, userId, channel.id]);

        await interaction.reply({ content: `Ticket **${ticketId}** created: ${channel}`, ephemeral: true });
    }
};