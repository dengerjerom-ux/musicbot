# Bot Deployment – Railway & Hetzner

## Voraussetzungen
- Discord Bot Token (bereits vorhanden)
- Spotify Client ID + Secret (optional, für Spotify-Support)

---

## Option 1: Railway (Empfohlen – einfachste Methode)

**Kosten:** ~5 $/Monat | **Zeit:** ~5 Minuten

### Schritte:

1. **GitHub-Repo erstellen**
   - Gehe zu [github.com/new](https://github.com/new)
   - Erstelle ein neues privates Repository
   - Lade alle Dateien aus diesem Projekt hoch (oder `git push`)

2. **Railway-Account erstellen**
   - Gehe zu [railway.app](https://railway.app)
   - Melde dich mit GitHub an

3. **Neues Projekt erstellen**
   - Klicke auf **"New Project"**
   - Wähle **"Deploy from GitHub repo"**
   - Wähle dein Repository aus

4. **Umgebungsvariablen setzen**
   - Klicke auf deinen Service → **"Variables"**
   - Füge folgende Variablen hinzu:
     ```
     DISCORD_TOKEN=dein_token_hier
     SPOTIFY_CLIENT_ID=deine_id (optional)
     SPOTIFY_CLIENT_SECRET=dein_secret (optional)
     PREFIX=!
     ```

5. **Deploy starten**
   - Railway erkennt das Dockerfile automatisch
   - Der Bot startet in ~2 Minuten
   - Logs siehst du unter **"Deployments"**

---

## Option 2: Hetzner VPS (Günstigster stabiler Weg)

**Kosten:** ab 4 €/Monat | **Zeit:** ~15 Minuten

### Schritte:

1. **VPS erstellen**
   - Gehe zu [hetzner.com](https://www.hetzner.com/cloud)
   - Erstelle einen Account
   - Neues Projekt → **"Add Server"**
   - Wähle: **Ubuntu 22.04**, Typ **CX11** (4€/Monat)

2. **Per SSH verbinden**
   ```bash
   ssh root@DEINE_SERVER_IP
   ```

3. **Docker installieren**
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

4. **Bot-Dateien auf den Server übertragen**
   ```bash
   # Lokal ausführen:
   scp -r /pfad/zum/bot root@DEINE_SERVER_IP:/root/musicbot
   ```
   Oder per Git:
   ```bash
   git clone https://github.com/DEIN_USERNAME/DEIN_REPO.git /root/musicbot
   ```

5. **`.env`-Datei erstellen**
   ```bash
   cd /root/musicbot
   cp .env.example .env
   nano .env
   ```
   Füge ein:
   ```
   DISCORD_TOKEN=dein_token_hier
   SPOTIFY_CLIENT_ID=deine_id (optional)
   SPOTIFY_CLIENT_SECRET=dein_secret (optional)
   PREFIX=!
   ```

6. **Docker-Image bauen und starten**
   ```bash
   cd /root/musicbot
   docker build -t musicbot .
   docker run -d \
     --name musicbot \
     --restart unless-stopped \
     --env-file .env \
     musicbot
   ```

7. **Logs prüfen**
   ```bash
   docker logs -f musicbot
   ```

8. **Bot neustarten nach Änderungen**
   ```bash
   docker stop musicbot && docker rm musicbot
   docker build -t musicbot .
   docker run -d --name musicbot --restart unless-stopped --env-file .env musicbot
   ```

---

## Option 3: Contabo VPS

Gleiche Schritte wie Hetzner. Contabo VPS S: ~5€/Monat, mehr RAM/CPU.
- [contabo.com](https://contabo.com)

---

## Bot aktuell halten

Wenn du den Code änderst:

**Railway:** Einfach per `git push` – Railway deployed automatisch.

**Hetzner/Contabo:**
```bash
cd /root/musicbot
git pull
docker stop musicbot && docker rm musicbot
docker build -t musicbot . && docker run -d --name musicbot --restart unless-stopped --env-file .env musicbot
```

---

## Verfügbare Bot-Befehle

| Befehl | Funktion |
|--------|----------|
| `!play <Song/URL>` | Song abspielen |
| `!pause` / `!resume` | Pause/Fortsetzen |
| `!skip` | Nächster Song |
| `!stop` | Bot stoppen |
| `!queue` | Warteschlange anzeigen |
| `!volume <0-100>` | Lautstärke |
| `!loop [off/song/queue]` | Loop-Modus |
| `!shuffle` | Zufällig mischen |
| `!bassboost <0-20>` | Bassboost |
| `!autoplay` | Autoplay an/aus |
| `!nowplaying` | Aktueller Song |
| `!help` | Alle Befehle |
