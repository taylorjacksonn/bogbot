// loading environment variables from .env file for EC2
require('dotenv').config();

// load command files on startup
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, Guild } = require('discord.js');
// const { VoiceConnectionStatus, AudioPlayerStatus } = require('@discordjs/voice');
const { Player } = require("discord-player");
// const { token } = require('./config.json');

// env token for EC2 //
const token = process.env.DISCORD_TOKEN;

// create client with intents
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages] });

const player = new Player(client);

// dynamically updating guild Id: update the config.json file with the guild ID
function updateConfig(guildId) {
    // read the existing config file
    const configFile = fs.readFileSync('config.json', 'utf8');
    // parse the JSON content of the config file into an object
    const config = JSON.parse(configFile);
    // update the guildId property
    config.guildId = guildId;
    // write updated config object back to the file
    fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
}

// get guild id when joining new server
client.on('guildCreate', guild => {
    const guildId = guild.id;
    console.log(`Joined new guild, ${guild}. Guild ID: ${guildId}`);
    updateConfig(guildId);
});


//
const commands = require('./commands/utility/bog');

// Initialize client.commands as an empty Collection
client.commands = new Collection();

for (let i = 0; i < commands.length; i++) {

    let command = commands[i];

    // Check if the command object has both `data` and `execute` properties
    if (command.hasOwnProperty('data') && command.hasOwnProperty('execute')) {
        // Add the command to the client.commands collection
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command is missing a required "data" or "execute" property.`);
    }
}

client.once(Events.ClientReady, readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});


client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;
	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: '(1) There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: '(2)There was an error while executing this command! Error:' + error, ephemeral: true });
		}
	}
});

client.login(token);