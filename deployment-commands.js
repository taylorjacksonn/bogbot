const fs = require('node:fs');
const path = require('node:path');

const commands = [];
// Grab all command folders from commands directory 
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	
	// grab all command files from the commands directory 
	const commandsPath = path.join(foldersPath, folder);	
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const commandsArray = require(filePath); // Require the command file
		for (const command of commandsArray) { // Iterate over the array exported by the command file
			if ('data' in command && 'execute' in command) {
				commands.push(command.data.toJSON());
			} else {
				console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
			}
		}
	}
}