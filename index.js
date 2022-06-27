const Discord = require("discord.js");
const { prefix, token, API_KEY } = require("./config.json");
const { MessageEmbed } = require('discord.js');
const ytdl = require("ytdl-core");
const {YoutubeDataAPI} = require('youtube-v3-api');

const api = new YoutubeDataAPI(API_KEY);
const client = new Discord.Client({intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_PRESENCES", "GUILD_INTEGRATIONS", "GUILD_MESSAGE_TYPING", "GUILD_VOICE_STATES", "GUILD_WEBHOOKS"]});
const queue = new Map();

let songEmbed;

client.once("ready", () => {
  console.log("Ready!");

  client.user.setActivity('nothing... :(', {
    type: 'PLAYING',
  });
});

client.once("reconnecting", () => {
  console.log("Reconnecting!");
});

client.once("disconnect", () => {
  console.log("Disconnect!");
});



client.on("message", async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const serverQueue = queue.get(message.guild.id);

  if (message.content.startsWith(`${prefix}play`)) {
    execute(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}skip`)) {
    skip(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}stop`)) {
    stop(message, serverQueue);
    return;
  } else {
    message.channel.send("You need to enter a valid command!");
  }
});

async function execute(message, serverQueue) {
  const msg = message.content;
  let temp = 0;
  for (let i = 0; i < msg.length; i++){
    if (msg.charAt(i) === ' '){
      temp = i + 1;
      break;
    }
  }

  const args = msg.slice(temp);

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel)
    return message.channel.send(
      "You need to be in a voice channel to play music!"
    );
  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
    return message.channel.send(
      "I need the permissions to join and speak in your voice channel!"
    );
  }

  const songInfo = await api.searchAll(args, 1, {part: 'snippet', type: 'video'} ).then((result) => {
    const songObj = result.items;
    return songObj;
  }, (err) => {
    console.error(err);
  });

  const song = {
    title: songInfo[0].snippet.title,
    id: songInfo[0].id.videoId,
  }

  const videoInfo = await api.searchVideo(song.id, {part: 'contentDetails, statistics', maxResults: 1}).then((result) => {
    const videoObj = result.items;
    return videoObj;
  }, (err) => {
    console.error(err);
  });

  songEmbed = new MessageEmbed()
    .setColor('D30000')
    .setTitle(song.title)
    .setAuthor('Now Playing:')
    .setImage(videoInfo[0].snippet.thumbnails.high.url)
    .setURL(`https://www.youtube.com/watch?v=${videoInfo[0].id}`);

  if (!serverQueue) {
    const queueContruct = {
      textChannel: message.channel,
      voiceChannel: voiceChannel,
      connection: null,
      songs: [],
      volume: 5,
      playing: true
    };

    queue.set(message.guild.id, queueContruct);

    queueContruct.songs.push(song);

    try {
      var connection = await voiceChannel.join();
      queueContruct.connection = connection;
      play(message.guild, queueContruct.songs[0]);
    } 
    catch (err) {
      console.log(err);
      queue.delete(message.guild.id);
      return message.channel.send(err);
    }
  } else {
    serverQueue.songs.push(song);
    return message.channel.send(`${song.title} has been added to the queue!`);
  } 
  
  console.log(`${message.member.user.tag} requested ${song.title}`);

};

function skip(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "You have to be in a voice channel to stop the music!"
    );
  if (!serverQueue)
    return message.channel.send("There is no song that I could skip!");
  serverQueue.connection.dispatcher.end();

  console.log(`${message.member.user.tag} skipped ${song.title}`);

}

function stop(message, serverQueue) {
  if (!message.member.voice.channel)
    return message.channel.send(
      "You have to be in a voice channel to stop the music!"
    );
    
  if (!serverQueue)
    return message.channel.send("There is no song that I could stop!");
    
  serverQueue.songs = [];
  serverQueue.connection.dispatcher.end();

  console.log(`${message.member.user.tag} stopped ${song.title}`);

}

function play(guild, song) {
  const serverQueue = queue.get(guild.id);
  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(guild.id);
    client.user.setActivity('nothing... :(', {
      type: 'PLAYING',
    });
    return;
  }

  client.user.setActivity(song.title, {
    type: 'PLAYING',
  });

  const dispatcher = serverQueue.connection
    .play(ytdl(song.id))
    .on("finish", () => {
      serverQueue.songs.shift();
      play(guild, serverQueue.songs[0]);
    })
    .on("error", error => console.error(error));
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
  serverQueue.textChannel.send(songEmbed);
}

client.login(token);