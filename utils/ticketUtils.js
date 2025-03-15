const { PermissionsBitField } = require('discord.js');

async function createTicket(interaction, type, clearance, ticketId) {
    const categoryId = process.env[`CATEGORY_${clearance}`]; // Ensure these exist in .env
    if (!categoryId) return null;

    const channel = await interaction.guild.channels.create({
        name: ticketId,
        type: 0, // Text Channel
        parent: categoryId,
        permissionOverwrites: [
            {
                id: interaction.guild.id,
                deny: [PermissionsBitField.Flags.ViewChannel],
            },
            {
                id: interaction.user.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
            },
            {
                id: process.env.COMMAND_ROLE_ID,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels],
            }
        ]
    });

    return channel;
}

module.exports = { createTicket };
