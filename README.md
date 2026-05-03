# 🎵 Discord Music Bot

Ein leistungsstarker Discord-Musikbot mit YouTube & Spotify-Support.

## 🚀 Setup

### 1. Voraussetzungen
- Node.js 18+
- `yt-dlp` installiert: https://github.com/yt-dlp/yt-dlp#installation
- FFmpeg installiert: https://ffmpeg.org/download.html

### 2. Installation
```bash
npm install
```

### 3. .env konfigurieren
```bash
cp .env.example .env
# Dann .env mit deinen Tokens befüllen
```

### 4. Discord Bot erstellen
1. Gehe zu https://discord.com/developers/applications
2. "New Application" → Name eingeben
3. Bot-Seite → "Add Bot"
4. Token kopieren → in `.env` eintragen
5. Privileged Intents aktivieren: **Server Members**, **Message Content**
6. Bot einladen: OAuth2 → URL Generator → `bot` + `applications.commands`
   - Benötigte Permissions: `Connect`, `Speak`, `Send Messages`, `Read Messages`, `Embed Links`

### 5. Spotify API (optional aber empfohlen)
1. https://developer.spotify.com/dashboard → App erstellen
2. Client ID & Secret → in `.env` eintragen

### 6. Starten
```bash
npm start
```

## 📋 Befehle

| Befehl | Beschreibung |
|--------|-------------|
| `!play <Song/URL>` | Song abspielen (YouTube, Spotify, Playlist) |
| `!search <Begriff>` | Song suchen und abspielen |
| `!pause` | Pausieren / Fortsetzen |
| `!skip` | Nächsten Song |
| `!stop` | Stoppen & Kanal verlassen |
| `!queue` | Warteschlange anzeigen |
| `!nowplaying` | Aktuellen Song anzeigen |
| `!volume <0-100>` | Lautstärke setzen |
| `!loop [off/song/queue]` | Loop-Modus |
| `!shuffle` | Warteschlange mischen |
| `!remove <Nr>` | Song aus Warteschlange entfernen |
| `!jump <Nr>` | Zu Song springen |
| `!help` | Alle Befehle anzeigen |

## 🌐 Unterstützte Quellen
- ✅ YouTube (Songs, Playlists, Livestreams)
- ✅ Spotify (Songs, Alben, Playlists)
- ✅ YouTube Music
- ✅ SoundCloud
- ✅ Direktlinks (MP3, etc.)
