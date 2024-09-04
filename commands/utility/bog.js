// ALL COMMANDS AND THEIR FUNCTIONALITIES FOR BOGBOT

// imports for Discord library usage
const { SlashCommandBuilder } = require('@discordjs/builders');
const { createAudioPlayer, createAudioResource, AudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { joinVoiceChannel } = require('@discordjs/voice');
const voice = require('@discordjs/voice');
const { createReadStream } = require('fs');
const path = require('path');


// create audio player outside of functions so it can be accessed by any command
const player = createAudioPlayer();

// 
module.exports = [
    // command to start the bog
    {
        data: new SlashCommandBuilder()
            .setName('bog')
            .setDescription('Starts the bog.'),
        async execute(interaction) {
            startBog(interaction)
        },
    },
    // command to pause the bog
    {
        data: new SlashCommandBuilder()
            .setName('pause')
            .setDescription('Pauses the bog.'),
        async execute(interaction) {
            pauseBog(interaction)
        },
    },
    // command to stop the bog
    {
        data: new SlashCommandBuilder()
            .setName('stop')
            .setDescription('Stops the bog and BogBot leaves voice channel.'),
        async execute(interaction) {
            stopBog(interaction)
        },
    },
    // command to unpause the bog
    {
        data: new SlashCommandBuilder()
            .setName('play')
            .setDescription('Unpauses the bog.'),
        async execute(interaction) {
            playBog(interaction)
        },
    },
    // command to play in reverse order
    {
        data: new SlashCommandBuilder()
            .setName('bogreverse')
            .setDescription('Starts the bog in reverse order.'),
        async execute(interaction) {
            startBogReverse(interaction)
        },
    },
    // command to take turns at random
    {
        data: new SlashCommandBuilder()
            .setName('bograndom')
            .setDescription('Starts the bog and chooses turns at random. GG.'),
        async execute(interaction) {
            startBogRandom(interaction)
        },
    },
];


// bog command (/bogreverse) calls startBog but reverses order of members in voice call. 
async function startBogReverse(interaction) {
    // Get voice channel and text channel
    let voiceChannel = interaction.member.voice.channel;

    // Check if the user is in a voice channel
    if (!voiceChannel || voiceChannel.size < 1) { 
        await interaction.reply("You need to join a voice channel if you want to bog.");
        return;
    }

    // Get the list of users in the voice channel
    let usersInCall = voiceChannel.members;
    let userIds = usersInCall.map(member => member.user.id);

    // Reverse the list of player names
    // console.log('non reverse userIds: ', userIds);
    userIds = userIds.reverse();
    // console.log('reversed userIds: ', userIds);

    // Call startBog with the reversed order of players
    await startBog(interaction, userIds);
}

// bog command (/bograndom) sends randomOrder as true to enable random turn mode
async function startBogRandom(interaction) {
    await startBog(interaction, null, randomOrder = true);
}

 
/**
 * startBog takes a user interaction command and extracts information
 * needed to allow the bot to join the voice channel, send msgs to the text channel, 
 * create a music player object that can play the song, and collect usernames/ids 
 * @param {Interaction} interaction - user interaction from triggering a command
 */
async function startBog(interaction, playerOrder, randomOrder = false) {

    // clear names/ids  each time bog is started
    // player usernames for non-mention formatting ("Bog started with...")
    let names = [];
    // player ids for discord mention formatting (mentions)
    const playerIds = [];

    // get voiceChannel that BogBot will be connecting to and getting users from
    let voiceChannel = interaction.member.voice.channel;

    // if caller is not in the voice channel, prompt them to join.
    if (!voiceChannel || voiceChannel.size < 1) { 
        const user = interaction.member.user; // users id rather than username so mention will work
        await interaction.reply(`${user}! :point_up::nerd: You need to join a voice channel if you want to bog.`);
        console.log('Member is not in the voice channel.')
    }

    // get text channel that BogBot will send messages mentioning users
    const textChannel = interaction.channel;
    // Check if a default text channel was found
    if (textChannel) {
        console.log('BogBot able to find text channel and send messages.')
    } else {
        console.error('Unable to find a default text channel where the bot has permissions to send messages.');
    }
    try {

        let usersInCall = [];

        // get all users in call then extract ids rather than usernames to use mention (id = <@username>)
        usersInCall = voiceChannel.members;

        // if playerOrder exists, then the reverse command used
        if (playerOrder) {
            userIds = playerOrder;
            console.log('Bog is running in reverse order.')
        } else {
            if (randomOrder) {
                console.log('Bog is running in random order.')
            }
            // if not reverse order, get the users in call based on the order of voice channel
            userIds = usersInCall.map(member => member.user.id);
        }

        // actual usernames for for non-mention use
        let userNames = usersInCall.map(member => member.user.username);

        // remove bogbot from the turn rotation and initial greeting
        for (i = 0; i < userIds.length; i++) {
            if (userIds[i] != '1228082480322445404') {
                playerIds.push(userIds[i]);
            }
        }
         for (i = 0; i < userIds.length; i++) {
            if (userNames[i] != 'BogBot') {
                names.push(userNames[i]);
            }
        }

        // create connection for bot to join voice channel
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: interaction.guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: false,
        });

        console.log('BogBot is in voice chat and ready to play.')
        
        // construct path to mp3 file
        const mp3FilePath = path.join(__dirname, '../../rattlinbog.mp3');

        // subscribe Player to the connection
        connection.subscribe(player);

        // create audio resource
        const stream = createReadStream(mp3FilePath);
        const resource = createAudioResource(stream);
   
        //play audio resource
        player.play(resource);
        mentionPlayerAtTurn(playerIds, textChannel, resource, interaction, randomOrder);
        
        let formattedNames = [...names];
        var namesAsString = formattedNames.join(', '); // gives "name, name, name"

        await interaction.reply(`:star: **Welcome to BogBot Early Access** :star: \n *Available commands: 
**/pause** to pause
**/play** to unpause 
**/stop** to cancel the bog
**/bog** to start the bog in default order 
**/bogreverse** to bog in reverse order
**/bograndom** to choose turns at random*
        \n Rattlin' Bog started with ${namesAsString}. :beers:`);
        
    } catch (error) {
        console.error('Error occurred while joining voice channel:', error);
    }
 }


let interval; // defining interval outside so stopBog can access it

//  mentionPlayerAtTurn takes playerIds, text
function mentionPlayerAtTurn(playerIds, textChannel, resource, interaction, randomOrder = false) {

    // get voice connection so bot can leave once song has finished
    let vc = voice.getVoiceConnection(interaction.guildId);

    // last mention/message sent by BogBot
    let lastMsg;

    // a variety of mention messages
    const mentions = [("it's your turn!"), ("you're up!"), ("your turn!")]
    let mention = "it's your turn!";
    // breakpoints of song in seconds (change of turns)
    const breakpoints = [10, 27, 44, 61, 79, 97, 117, 138, 159, 182, 205, 229, 253, 279];
    let currentPlayerIndex = 0;

    // executes every second (1000 ms)
    interval = setInterval(() => {

        let playbackDuration = resource.audioPlayer._state.resource.playbackDuration;

        // calculate playback time of audio currently being streamed 
        let playbackTime = Math.floor(playbackDuration/1000); // convert ms to seconds, rounding down with Math.floor


        // if the time matches one of the turn breakpoints, then execute
        if (breakpoints.includes(playbackTime)) {
            if (randomOrder) {
                currentPlayerIndex = Math.floor(Math.random() * playerIds.length);
            }
            let currentPlayer = playerIds[currentPlayerIndex];

            // delete previous message if it exists to avoid cluttering text channel with mentions
            if (lastMsg) {
                lastMsg.delete();
            }
            
            // get random mention
            mention = mentions[Math.floor(Math.random() * mentions.length)];
            
            // send new mention
            // after message sent successfully (then) execute: assign/store the sent msg as the last msg
            textChannel.send(`:bangbang: **<@${currentPlayer}>, ${mention}** :bangbang:`)
                .then(message => {
                    lastMsg = message;
                }).catch(console.error);
            
            // console.log(`It's ${currentPlayer} turn.`);    
            currentPlayerIndex = (currentPlayerIndex + 1) % playerIds.length;
        }
        // timing specific additions
        if (playbackTime === 307) {
            textChannel.send('Bog down in the valleyooOOOOOOoooOOo :beers:');
            console.log('Final turn has finished. Exiting voice channel.')
        }
        // once song ends, disconnect from voice chat and clear turns interval
        if (playbackTime === 325 && vc) {
            vc.disconnect();
            clearInterval(interval);
        }
    }, 1000); // check every second for playback time
}
   
// (/pause) if bot is in voice chat, pause song
async function pauseBog(interaction) {
    let vc = voice.getVoiceConnection(interaction.guildId);
    if (!vc) {
        interaction.reply("*I'm not in the voice channel yet.* Use /bog to start.");
    } else {
        interaction.reply('*Bog has been paused.*')
        player.pause();
    }
}
// (/play) if bot is in voice chat, unpause song
async function playBog(interaction) {
    let vc = voice.getVoiceConnection(interaction.guildId);
    if (!vc) {
        interaction.reply("*I'm not in the voice channel.* Use /bog to start.");
    } else {
        interaction.reply('*Bog has been unpaused.*')
        player.unpause();
    }
}


// stopBog stops the Bog: stops the music player, disconnects bot from voice channel,
// and clears the interval to stop the program and avoid mention repeats 

async function stopBog(interaction) {
        
    let vc = voice.getVoiceConnection(interaction.guildId);
    
    if (!vc) {
        interaction.reply("There's nothing to stop, I'm not in the voice channel.");
    } else {
        // stop music playback
        player.stop();

        // disconnect BogBot from voice channel
        vc.disconnect();

        // clear the interval for mentioning players
        clearInterval(interval);

        // reply to user that bot is exiting
        interaction.reply('*Bogbot stopped. Leaving the voice channel. *')
    }
}

    

