# VERO9X — Multipurpose Discord Bot

Moderation, leveling, economy, games, utility and AI in one bot. Node.js + TypeScript + discord.js v14 + built-in SQLite
(`node:sqlite`, no native compiling). Purple/blue on charcoal embeds. Every server has fully independent settings.

## Status (Phase 2 — 81 slash commands)

| Area | State |
|---|---|
| **Moderation**: ban, unban, kick, timeout, untimeout, warn, warnings, clear, purge, lock, unlock, slowmode, modlogs, nickname | ✅ |
| **Automod**: anti-spam, anti-flood, anti-raid, mention spam, link filter, invite filter, bad-word filter, warn thresholds | ✅ |
| **Logging**: joins/leaves, message edit/delete, role changes, all mod actions (one log channel) | ✅ |
| **Server**: welcome/goodbye, auto-role, suggestions, per-server config | ✅ |
| **Leveling**: message XP, /rank /level /xp /setxp /leaderboard, role rewards, custom level-up text, cooldowns | ✅ (no image rank card yet) |
| **Economy** (virtual only): balance, daily, weekly, work, deposit, withdraw, pay, shop, inventory, leaderboard | ✅ |
| **Games/fun**: rps, tictactoe, guess, coinflip, 8ball, truthordare, wouldyourather, ship, rate, joke, fact, quote, compliment, roast, dailyquestion | ✅ |
| **Utility**: help (menu), ping, botinfo, serverinfo, userinfo, avatar, banner, invite, uptime, remind, poll, suggest, calculator, timestamp, afk, profile, membercount | ✅ |
| **AI**: /ask /summarize /translate /ai, chat by mention or in AI channels, per-server persona/instructions/daily limits | ✅ |
| **Music** (Lavalink): play, pause, resume, skip, stop, queue, nowplaying, volume, loop, shuffle, remove, clearqueue, join, leave, seek, previous — button player, paginated queue, search autocomplete, DJ role | ✅ needs a Lavalink server (see *Music setup*) |
| Tickets, giveaways, reaction/button roles, verification, voice XP, trivia/quiz/connect4/hangman/wordgame/meme, birthdays, scheduled announcements, message cleanup, multiplayer competitions | ⏳ later phases |

Tested locally: queue/loop/shuffle/previous logic, time parsing, TypeScript build, migrations, all 65 command definitions, leveling math, economy atomicity, XP/rank
ordering, AI quota + injection filter, calculator (no `eval`), timestamp parsing, game logic. **Not yet tested on a live Discord server, and live audio can only be tested once Lavalink is running.**

## Music setup (Lavalink)
VERO9X streams audio through **Lavalink**, a separate small server. Supported sources: **SoundCloud** (text search + links), **Bandcamp**, **Twitch**, **Vimeo** and direct audio/radio stream URLs.
YouTube, Spotify, Apple Music and Deezer links are intentionally **not** supported (their terms forbid ripping/streaming this way).

**On Railway (second service in the same project):**
1. **New → Docker Image** → `ghcr.io/lavalink-devs/lavalink:4`. Name the service `lavalink`.
2. Lavalink service → Variables:
   ```
   LAVALINK_SERVER_PASSWORD=pick-a-long-random-password
   SERVER_PORT=2333
   SERVER_ADDRESS=::
   _JAVA_OPTIONS=-Xmx512m
   ```
   (No Volume needed.) Wait ~1 minute for it to start; its logs should end with `Lavalink is ready to accept connections`.
3. VERO9X service → Variables:
   ```
   LAVALINK_URL=lavalink.railway.internal:2333
   LAVALINK_PASSWORD=the-same-password
   LAVALINK_SECURE=false
   ```
4. VERO9X logs should show `Lavalink node "main" connected`.

*If the private address doesn't connect:* on the Lavalink service click **Settings → Networking → Generate Domain** (port 2333), then set
`LAVALINK_URL=<that-domain>:443` and `LAVALINK_SECURE=true` on the bot. Always use a strong password in that case.

**Using it:** join a voice channel → `/play song name` (autocomplete suggests SoundCloud results) or paste a link.
The now-playing message has buttons (previous, pause, skip, loop, shuffle, volume, stop). `/config dj role:@DJ` restricts
skip/stop/volume etc. to that role (anyone can still queue songs); Manage Server holders always can.
The bot leaves after 3 minutes of nothing playing, or 2 minutes alone in the channel.
VERO9X needs **Connect** and **Speak** — re-invite with the link above (or `/invite`) if it says it lacks them.

## Permissions
Commands use Discord's own permissions (e.g. `/ban` needs Ban Members, `/config` needs Manage Server). They're enforced in code
**and** set as the command's default permission, and server admins can't loosen the in-code check.
Moderators can't act on members whose top role is equal/higher than theirs. Members with *Manage Messages* are exempt from automod.

## 1. Discord Developer Portal
1. https://discord.com/developers/applications → **New Application** → name it VERO9X.
2. **Bot** → Reset Token → copy (`DISCORD_TOKEN`). Never share it. Application ID = `CLIENT_ID`.
3. Bot tab → enable **Server Members Intent** and **Message Content Intent**.
4. Invite: `https://discord.com/oauth2/authorize?client_id=CLIENT_ID&permissions=1099917519958&scope=bot%20applications.commands`
5. Drag the VERO9X role **above** roles it should moderate.
(To make it public later: Installation tab → set the install link to Discord-provided, and turn **Public Bot** on.
Past 100 servers Discord requires verification; message-content intent needs approval at 100+ servers.)

## 2. GitHub + Railway
Put the files at the **root** of a new GitHub repo (`package.json` at top level), then Railway → New Project → Deploy from GitHub.
Variables: `DISCORD_TOKEN`, `CLIENT_ID`, `DATA_DIR=/data`, `NODE_VERSION=22` (optional AI: `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`).
Add a **Volume** mounted at `/data` — without it the database resets on every deploy. Keep **1 replica**.
Commands register automatically on boot (set `DEV_GUILD_ID` for instant updates while testing).

## First-time setup in Discord
```
/config channel type:Logs channel:#logs
/config channel type:Welcome channel:#welcome
/config welcome role:@Member message:Welcome {user} to {server}! You're #{count}.
/config toggle module:Invite filter enabled:true
/config levelreward action:Add level:5 role:@Active
/shop add name:VIP price:5000 role:@VIP
/ai channel action:Add channel:#chat
/config view
```

## Run locally
```bash
cp .env.example .env   # fill DISCORD_TOKEN and CLIENT_ID
npm install && npm run dev      # or: npm run build && npm start
```
Needs **Node 22.13+**. Works on Windows, Linux VPS and Pterodactyl (startup: `npm start`).

## Notes for a public bot
- All data is keyed by guild ID; settings never leak between servers.
- Message-delete logs only cover messages the bot saw since it started (Discord doesn't send content of old messages).
- `/summarize` sends recent channel text to your AI provider — mention this in your privacy policy.
- Over ~2,500 servers Discord requires sharding (discord.js ShardingManager); not needed yet.

## Troubleshooting
- No slash commands: wait a few minutes (global) or set `DEV_GUILD_ID`; invite must include `applications.commands`.
- `Used disallowed intents`: enable the two privileged intents in the Portal.
- "Missing permissions": move VERO9X's role above the target's top role.
- Data vanishes after deploy: Railway Volume missing or `DATA_DIR` isn't `/data`.
- Music says offline: check the Lavalink service is running, `LAVALINK_URL`/`LAVALINK_PASSWORD` match, and the bot logs show `Lavalink node "main" connected`.
- No sound / "missing Connect and Speak": re-invite with the link above or grant those permissions on the voice channel.
- AI silent: set `AI_API_KEY`, then mention the bot or `/ai channel`.
- `node:sqlite` not found: host must run Node 22.13+.
