// ─── Replit-Fix: IPv4 vor IPv6 erzwingen (KRITISCH für Voice) ────────────────
require('dns').setDefaultResultOrder('ipv4first');

// ─── Voraussetzungen prüfen ───────────────────────────────────────────────────
try {
  require('@discordjs/voice');
  console.log('[BOOT] @discordjs/voice ✅');
} catch {
  console.error('[BOOT] @discordjs/voice FEHLT – bitte installieren!');
  process.exit(1);
}
try {
  require('ffmpeg-static');
  console.log('[BOOT] ffmpeg-static ✅');
} catch {
  console.error('[BOOT] ffmpeg-static FEHLT – bitte installieren!');
  process.exit(1);
}

const {
  Client, GatewayIntentBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { DisTube } = require('distube');
const { SpotifyPlugin } = require('@distube/spotify');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
require('dotenv').config();

// ─── Discord Client ───────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

// ─── Voice-Join Helper (Reconnect + Replit-Kill-Schutz) ──────────────────────
async function joinVC(channel) {
  console.log(`[VOICE] Versuche Channel "${channel.name}" (${channel.id}) beizutreten...`);

  const perms = channel.permissionsFor(channel.guild.members.me);
  if (!perms?.has('Connect') || !perms?.has('Speak')) {
    console.error('[VOICE] Fehlende Berechtigungen: Connect oder Speak nicht vorhanden!');
    return null;
  }

  let connection;
  try {
    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
    });

    connection.on('stateChange', (oldState, newState) => {
      console.log(`[VOICE] STATE: ${oldState.status} -> ${newState.status}`);
    });

    connection.on('error', (err) => {
      console.error('[VOICE] Verbindungsfehler:', err.message);
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.warn('[VOICE] Getrennt – versuche Reconnect (Replit-Kill-Schutz)...');
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        console.log('[VOICE] Reconnect eingeleitet.');
      } catch {
        console.error('[VOICE] Reconnect fehlgeschlagen – zerstöre Verbindung sauber.');
        try { connection.destroy(); } catch {}
      }
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    console.log('[VOICE] ✅ Verbunden!');
    return connection;

  } catch (err) {
    console.error('[VOICE] ❌ Fehler beim Verbinden:', err.message);
    console.error(`[VOICE] Letzter Status: ${connection?.state?.status ?? 'unbekannt'}`);

    if (connection) {
      try { connection.destroy(); } catch {}
    }
    return null;
  }
}

// ─── DisTube Setup ────────────────────────────────────────────────────────────
const distube = new DisTube(client, {
  plugins: [
    new SpotifyPlugin({
      api: {
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      },
    }),
    new YtDlpPlugin({ update: false }),
  ],
  emitNewSongOnly: true,
});

// ─── Bassboost Filter ─────────────────────────────────────────────────────────
function buildBassFilter(level) {
  const g60  = level;
  const g120 = Math.round(level * 0.75);
  const g250 = Math.round(level * 0.4);
  const g500 = level >= 10 ? Math.round(level * 0.2) : 0;
  let filter = `equalizer=f=60:width_type=o:width=2:g=${g60},equalizer=f=120:width_type=o:width=2:g=${g120}`;
  if (g250 > 0) filter += `,equalizer=f=250:width_type=o:width=2:g=${g250}`;
  if (g500 > 0) filter += `,equalizer=f=500:width_type=o:width=2:g=${g500}`;
  return filter;
}

// ─── Per-Guild State ──────────────────────────────────────────────────────────
const guildState = new Map();
function getState(guildId) {
  if (!guildState.has(guildId)) {
    guildState.set(guildId, { bassboost: 0, autoplay: false });
  }
  return guildState.get(guildId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PREFIX = process.env.PREFIX || '!';

function formatDuration(seconds) {
  if (!seconds) return '🔴 LIVE';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function progressBar(current, total, length = 15) {
  if (!total) return '▬'.repeat(length);
  const filled = Math.round((current / total) * length);
  return '▇'.repeat(filled) + '▬'.repeat(length - filled);
}

function bassboostLabel(level) {
  if (level === 0) return '🔈 Aus';
  if (level <= 5)  return `🔉 Stufe ${level}`;
  if (level <= 10) return `🔊 Stufe ${level}`;
  if (level <= 15) return `💥 Stufe ${level}`;
  return `🤯 Stufe ${level}`;
}

function songEmbed(song, queue, title = '🎵 Spielt jetzt') {
  const state = getState(queue.id);
  return new EmbedBuilder()
    .setColor('#1DB954')
    .setTitle(title)
    .setDescription(`**[${song.name}](${song.url})**`)
    .setThumbnail(song.thumbnail)
    .addFields(
      { name: '⏱ Dauer',         value: formatDuration(song.duration), inline: true },
      { name: '👤 Angefragt von', value: song.user.toString(),          inline: true },
      { name: '🔊 Lautstärke',   value: `${queue.volume}%`,            inline: true },
      { name: '🎸 Bassboost',    value: bassboostLabel(state.bassboost), inline: true },
      { name: '📻 Autoplay',     value: state.autoplay ? '✅ An' : '❌ Aus', inline: true },
    )
    .setFooter({ text: `Warteschlange: ${queue.songs.length - 1} Song(s) übrig` });
}

function queueEmbed(queue) {
  const current = queue.songs[0];
  const elapsed = Math.floor(queue.currentTime);
  const total   = current.duration;
  const state   = getState(queue.id);

  const list = queue.songs
    .slice(1, 11)
    .map((s, i) => `\`${i + 1}.\` [${s.name}](${s.url}) — ${formatDuration(s.duration)}`)
    .join('\n') || '*Keine weiteren Songs*';

  return new EmbedBuilder()
    .setColor('#1DB954')
    .setTitle('🎶 Warteschlange')
    .setDescription(
      `**Jetzt:** [${current.name}](${current.url})\n` +
      `\`${progressBar(elapsed, total)}\` ${formatDuration(elapsed)} / ${formatDuration(total)}\n\n` +
      `**Als nächstes:**\n${list}`
    )
    .setFooter({
      text: `${queue.songs.length} Song(s) | Loop: ${queue.repeatMode === 2 ? 'Queue' : queue.repeatMode === 1 ? 'Song' : 'Aus'} | Bass: ${state.bassboost} | Autoplay: ${state.autoplay ? 'An' : 'Aus'}`,
    });
}

function controlButtons(queue) {
  const state = getState(queue.id);
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('pause').setEmoji('⏸').setLabel('Pause').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('skip').setEmoji('⏭').setLabel('Skip').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('stop').setEmoji('⏹').setLabel('Stop').setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('bassboost_cycle')
      .setEmoji('🎸')
      .setLabel(`Bass: ${state.bassboost === 0 ? 'Aus' : state.bassboost + '/20'}`)
      .setStyle(state.bassboost === 0 ? ButtonStyle.Secondary : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('autoplay_toggle')
      .setEmoji('📻')
      .setLabel(state.autoplay ? 'Autoplay: An' : 'Autoplay: Aus')
      .setStyle(state.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary),
  );
}

async function applyBassboost(queue, level) {
  if (level === 0) {
    await queue.setFilter(false);
  } else {
    await queue.setFilter(buildBassFilter(level));
  }
}

async function triggerAutoplay(queue) {
  const state = getState(queue.id);
  if (!state.autoplay) return;
  const lastSong = queue.previousSongs?.[queue.previousSongs.length - 1];
  if (!lastSong) return;
  try {
    await distube.play(queue.voiceChannel, `${lastSong.name} mix`, {
      member: null, textChannel: queue.textChannel, skip: false,
    });
    queue.textChannel?.send({
      embeds: [
        new EmbedBuilder()
          .setColor('#1DB954')
          .setTitle('📻 Autoplay')
          .setDescription(`Suche ähnlichen Song für: **${lastSong.name}**...`)
          .setFooter({ text: `Autoplay ist aktiv | ${PREFIX}autoplay zum Deaktivieren` }),
      ],
    });
  } catch (err) {
    console.error('[AUTOPLAY] Fehler:', err.message);
    queue.textChannel?.send('⚠️ Autoplay konnte keinen ähnlichen Song finden.');
  }
}

// ─── Commands ─────────────────────────────────────────────────────────────────
const commands = {
  async play(message, args) {
    if (!args.length) return message.reply('❌ Bitte gib einen Song-Namen oder eine URL an!');

    const vc = message.member.voice.channel;
    if (!vc) return message.reply('❌ Du musst zuerst einem Sprachkanal beitreten!');

    console.log(`[PLAY] Befehl von ${message.author.tag} – Channel: "${vc.name}" – Suche: "${args.join(' ')}"`);

    const conn = await joinVC(vc);
    if (!conn) {
      return message.reply(
        '❌ **Voice-Verbindung fehlgeschlagen.**\n' +
        'Das ist ein bekanntes Replit-Problem (UDP-Blockade).\n' +
        'Der Bot läuft – aber Voice-Audio funktioniert auf Replit nicht zuverlässig.\n' +
        '**Lösung:** Bot auf Railway, Hetzner oder einem VPS hosten.'
      );
    }
    conn.destroy();

    try {
      await distube.play(vc, args.join(' '), {
        member: message.member,
        textChannel: message.channel,
        message,
      });
    } catch (err) {
      console.error('[PLAY] DisTube-Fehler:', err.message);
      return message.reply(`❌ Fehler beim Abspielen: ${err.message}`);
    }
  },

  async skip(message) {
    const queue = distube.getQueue(message.guild.id);
    if (!queue) return message.reply('❌ Es läuft gerade keine Musik!');
    if (queue.songs.length <= 1) return queue.stop();
    await queue.skip();
    message.react('⏭');
  },

  async pause(message) {
    const queue = distube.getQueue(message.guild.id);
    if (!queue) return message.reply('❌ Es läuft gerade keine Musik!');
    if (queue.paused) { queue.resume(); message.react('▶️'); }
    else              { queue.pause();  message.react('⏸'); }
  },

  async resume(message) {
    const queue = distube.getQueue(message.guild.id);
    if (!queue || !queue.paused) return message.reply('❌ Musik ist nicht pausiert!');
    queue.resume();
    message.react('▶️');
  },

  async stop(message) {
    const queue = distube.getQueue(message.guild.id);
    if (!queue) return message.reply('❌ Es läuft gerade keine Musik!');
    queue.stop();
    message.react('⏹');
  },

  async queue(message) {
    const queue = distube.getQueue(message.guild.id);
    if (!queue) return message.reply('❌ Die Warteschlange ist leer!');
    message.channel.send({ embeds: [queueEmbed(queue)] });
  },

  async volume(message, args) {
    const queue = distube.getQueue(message.guild.id);
    if (!queue) return message.reply('❌ Es läuft gerade keine Musik!');
    const vol = parseInt(args[0]);
    if (isNaN(vol) || vol < 0 || vol > 100) return message.reply('❌ Lautstärke muss zwischen 0 und 100 liegen!');
    queue.setVolume(vol);
    message.reply(`🔊 Lautstärke auf **${vol}%** gesetzt!`);
  },

  async loop(message, args) {
    const queue = distube.getQueue(message.guild.id);
    if (!queue) return message.reply('❌ Es läuft gerade keine Musik!');
    const modes = { off: 0, song: 1, queue: 2 };
    const mode  = args[0];
    if (mode && modes[mode] !== undefined) {
      queue.setRepeatMode(modes[mode]);
      message.reply(`🔁 Loop-Modus: **${mode}**`);
    } else {
      const next = (queue.repeatMode + 1) % 3;
      queue.setRepeatMode(next);
      message.reply(`🔁 Loop-Modus: **${['Aus', 'Song', 'Queue'][next]}**`);
    }
  },

  async shuffle(message) {
    const queue = distube.getQueue(message.guild.id);
    if (!queue) return message.reply('❌ Es läuft gerade keine Musik!');
    await queue.shuffle();
    message.react('🔀');
  },

  async nowplaying(message) {
    const queue = distube.getQueue(message.guild.id);
    if (!queue) return message.reply('❌ Es läuft gerade keine Musik!');
    const song    = queue.songs[0];
    const elapsed = Math.floor(queue.currentTime);
    const embed   = songEmbed(song, queue).addFields({
      name: '⏳ Fortschritt',
      value: `\`${progressBar(elapsed, song.duration)}\` ${formatDuration(elapsed)} / ${formatDuration(song.duration)}`,
    });
    message.channel.send({ embeds: [embed], components: [controlButtons(queue)] });
  },

  async remove(message, args) {
    const queue = distube.getQueue(message.guild.id);
    if (!queue) return message.reply('❌ Die Warteschlange ist leer!');
    const index = parseInt(args[0]);
    if (isNaN(index) || index < 1 || index >= queue.songs.length) return message.reply('❌ Ungültige Position!');
    const removed = queue.songs.splice(index, 1)[0];
    message.reply(`🗑 **${removed.name}** aus der Warteschlange entfernt!`);
  },

  async jump(message, args) {
    const queue = distube.getQueue(message.guild.id);
    if (!queue) return message.reply('❌ Die Warteschlange ist leer!');
    const index = parseInt(args[0]);
    if (isNaN(index) || index < 1 || index >= queue.songs.length) return message.reply('❌ Ungültige Position!');
    await queue.jump(index);
    message.react('⏩');
  },

  async search(message, args) {
    if (!args.length) return message.reply('❌ Bitte gib einen Suchbegriff an!');
    const vc = message.member.voice.channel;
    if (!vc) return message.reply('❌ Du musst in einem Sprachkanal sein!');
    try {
      await distube.play(vc, args.join(' '), {
        member: message.member, textChannel: message.channel, message, search: true,
      });
    } catch (err) {
      console.error('[SEARCH] Fehler:', err.message);
      message.reply(`❌ Fehler: ${err.message}`);
    }
  },

  async bassboost(message, args) {
    const queue = distube.getQueue(message.guild.id);
    if (!queue) return message.reply('❌ Es läuft gerade keine Musik!');

    const input = args[0];
    if (!input) {
      const state = getState(message.guild.id);
      return message.reply(
        `🎸 Aktueller Bassboost: **${bassboostLabel(state.bassboost)}**\n` +
        `Nutzung: \`${PREFIX}bassboost <0–20>\` — 0 = aus, 20 = Maximum`
      );
    }

    const level = parseInt(input);
    if (isNaN(level) || level < 0 || level > 20)
      return message.reply('❌ Stufe muss zwischen **0** (aus) und **20** (Maximum) liegen!');

    const state     = getState(message.guild.id);
    state.bassboost = level;
    await applyBassboost(queue, level);

    const descriptions = {
      0: '🔈 Bassboost **deaktiviert**.', 5: '🔉 Sanfter Bass — kaum merklich.',
      10: '🔊 Mittlerer Bass — spürbar im Beat.', 15: '💥 Starker Bass — Club-Feeling!',
      20: '🤯 MAXIMUM BASS — Lautsprecher-Risiko!',
    };
    const closest = [0, 5, 10, 15, 20].reduce((a, b) => Math.abs(b - level) < Math.abs(a - level) ? b : a);

    message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(level === 0 ? '#888888' : '#1DB954')
          .setTitle('🎸 Bassboost')
          .setDescription(level === 0 ? descriptions[0] : `${bassboostLabel(level)} gesetzt!\n${descriptions[closest]}`)
          .addFields(
            { name: 'Stufe',   value: `${level}/20`,                                                       inline: true },
            { name: '60 Hz',  value: `+${level} dB`,                                                       inline: true },
            { name: '120 Hz', value: `+${Math.round(level * 0.75)} dB`,                                    inline: true },
            { name: '250 Hz', value: `+${Math.round(level * 0.4)} dB`,                                     inline: true },
            { name: '500 Hz', value: level >= 10 ? `+${Math.round(level * 0.2)} dB` : '0 dB',             inline: true },
          ),
      ],
    });
  },

  async autoplay(message) {
    const state    = getState(message.guild.id);
    state.autoplay = !state.autoplay;
    message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(state.autoplay ? '#1DB954' : '#888888')
          .setTitle('📻 Autoplay')
          .setDescription(
            state.autoplay
              ? '✅ Autoplay **aktiviert**! Nach dem letzten Song wird automatisch ein ähnlicher Song gesucht.'
              : '❌ Autoplay **deaktiviert**.'
          )
          .setFooter({ text: state.autoplay ? 'Ähnliche Songs via YouTube-Suche.' : '' }),
      ],
    });
  },

  async help(message) {
    const embed = new EmbedBuilder()
      .setColor('#1DB954')
      .setTitle('🎵 MusicBot – Befehle')
      .setDescription(`Prefix: \`${PREFIX}\``)
      .addFields(
        { name: '▶️ Abspielen',     value: `\`${PREFIX}play <Song/URL>\` \`${PREFIX}search <Begriff>\``, inline: false },
        { name: '⏸ Steuerung',     value: `\`${PREFIX}pause\` \`${PREFIX}resume\` \`${PREFIX}skip\` \`${PREFIX}stop\``, inline: false },
        { name: '📋 Warteschlange', value: `\`${PREFIX}queue\` \`${PREFIX}remove <Nr>\` \`${PREFIX}jump <Nr>\` \`${PREFIX}shuffle\``, inline: false },
        { name: '⚙️ Einstellungen', value: `\`${PREFIX}volume <0-100>\` \`${PREFIX}loop [off/song/queue]\``, inline: false },
        { name: '🎸 Bassboost',    value: `\`${PREFIX}bassboost <0–20>\` (Alias: \`${PREFIX}bb\`)\n0 = aus, 1–20 = Stufen`, inline: false },
        { name: '📻 Autoplay',     value: `\`${PREFIX}autoplay\` (Alias: \`${PREFIX}ap\`)`, inline: false },
        { name: '📊 Info',          value: `\`${PREFIX}nowplaying\` / \`${PREFIX}np\``, inline: false },
        { name: '🌐 Quellen',       value: 'YouTube, Spotify (Songs/Alben/Playlists), YouTube Music', inline: false },
      )
      .setFooter({ text: 'Bassboost & Autoplay auch per Button steuerbar!' });
    message.channel.send({ embeds: [embed] });
  },
};

// Aliases
commands.p   = commands.play;
commands.s   = commands.skip;
commands.q   = commands.queue;
commands.np  = commands.nowplaying;
commands.vol = commands.volume;
commands.bb  = commands.bassboost;
commands.ap  = commands.autoplay;

// ─── Message Event ────────────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild || !message.content.startsWith(PREFIX)) return;
  const [cmd, ...args] = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = commands[cmd.toLowerCase()];
  if (!command) return;
  try {
    await command(message, args);
  } catch (err) {
    console.error(`[CMD] Unbehandelter Fehler bei "${cmd}":`, err);
    message.reply(`❌ Fehler: ${err.message}`).catch(() => {});
  }
});

// ─── Button Interactions ──────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  const queue = distube.getQueue(interaction.guild.id);
  if (!queue) return interaction.reply({ content: '❌ Keine Musik aktiv!', ephemeral: true });

  await interaction.deferUpdate().catch(() => {});
  const state = getState(interaction.guild.id);

  try {
    switch (interaction.customId) {
      case 'pause':
        queue.paused ? queue.resume() : queue.pause();
        break;
      case 'skip':
        queue.songs.length > 1 ? await queue.skip() : queue.stop();
        break;
      case 'stop':
        queue.stop();
        break;
      case 'bassboost_cycle': {
        const next = state.bassboost >= 20 ? 0 : state.bassboost + 1;
        state.bassboost = next;
        await applyBassboost(queue, next);
        break;
      }
      case 'autoplay_toggle':
        state.autoplay = !state.autoplay;
        break;
    }
  } catch (err) {
    console.error('[BUTTON] Fehler:', err.message);
  }
});

// ─── DisTube Events ───────────────────────────────────────────────────────────
distube
  .on('playSong', (queue, song) => {
    console.log(`[DISTUBE] Spielt: "${song.name}"`);
    queue.textChannel?.send({
      embeds: [songEmbed(song, queue)],
      components: [controlButtons(queue)],
    });
  })
  .on('addSong', (queue, song) => {
    queue.textChannel?.send({
      embeds: [
        new EmbedBuilder()
          .setColor('#1DB954')
          .setTitle('✅ Song hinzugefügt')
          .setDescription(`**[${song.name}](${song.url})**`)
          .setThumbnail(song.thumbnail)
          .addFields(
            { name: '⏱ Dauer',    value: formatDuration(song.duration), inline: true },
            { name: '📋 Position', value: `#${queue.songs.length - 1}`,  inline: true },
          ),
      ],
    });
  })
  .on('addList', (queue, playlist) => {
    queue.textChannel?.send({
      embeds: [
        new EmbedBuilder()
          .setColor('#1DB954')
          .setTitle('✅ Playlist hinzugefügt')
          .setDescription(`**${playlist.name}** — ${playlist.songs.length} Songs`)
          .setThumbnail(playlist.thumbnail),
      ],
    });
  })
  .on('error', (channel, error) => {
    console.error('[DISTUBE] Fehler:', error.message);
    channel?.send(`❌ Fehler: ${error.message}`);
  })
  .on('finish', async (queue) => {
    const state = getState(queue.id);
    if (state.autoplay) {
      await triggerAutoplay(queue);
    } else {
      queue.textChannel?.send('✅ Warteschlange beendet. Bis zum nächsten Mal! 👋');
    }
  })
  .on('disconnect', (queue) => {
    console.log(`[DISTUBE] Getrennt von Guild ${queue.id}`);
    guildState.delete(queue.id);
    queue.textChannel?.send('🔌 Bot getrennt!');
  });

// ─── Ready ────────────────────────────────────────────────────────────────────
client.once('clientReady', () => {
  console.log(`✅ Eingeloggt als ${client.user.tag}`);
  client.user.setActivity(`${PREFIX}help | Musik spielen`, { type: 2 });
});

client.login(process.env.DISCORD_TOKEN);
