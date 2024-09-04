// loading environment variables from .env file for EC2
require('dotenv').config();

// load command files on startup
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, Guild } = require('discord.js');
const { REST, Routes } = require('discord.js');

const { Player } = require("discord-player");


// env token for EC2
const token = process.env.DISCORD_TOKEN;
const { clientId } = require('./config.json');

// create client with intents
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages] });
const player = new Player(client);

// function to deploy commands
async function deployCommands(guildId) {
    try {
        console.log("Guild ID: ", guildId);
        const commands = [];
        const foldersPath = path.join(__dirname, 'commands');
        const commandFolders = fs.readdirSync(foldersPath);

        for (const folder of commandFolders) {
            const commandsPath = path.join(foldersPath, folder);
            const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const filePath = path.join(commandsPath, file);
                const commandsArray = require(filePath);
                for (const command of commandsArray) {
                    if ('data' in command && 'execute' in command) {
                        commands.push(command.data.toJSON());
                    } else {
                        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
                    }
                }
            }
        }

        const rest = new REST().setToken(token);
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands for guild ID ${guildId}.`);
    } catch (error) {
        console.error(`Failed to reload commands for guild ID ${guildId}:`, error);
    }
}

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
client.on('guildCreate', async guild => {
    const guildId = guild.id;
    console.log(`Joined new guild, ${guild}. Guild ID: ${guildId}`);
    updateConfig(guildId);

    // deploy commands for new guild!
    await deployCommands(guildId);
});

const commands = require('./commands/utility/bog.js');

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