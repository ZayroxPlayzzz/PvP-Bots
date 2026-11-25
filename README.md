# Scarlet SMP — ShadowMiner27 (Railway + config.js)

This project runs **one Mineflayer bot only**: `ShadowMiner27`, with a password-protected dashboard.

## Change all bot settings in GitHub

Open `config.js` in GitHub and press the pencil (Edit) icon. Change these fields:

- `server.host`: Minecraft server IP or hostname (no `https://`)
- `server.port`: Minecraft server port
- `server.version`: optional, e.g. `1.21.11`; leave `""` for auto-detect
- `bot.username`: bot username (default `ShadowMiner27`)
- `bot.loginPassword`: password used by the server `/register` and `/login` commands
- `bot.authType`: `offline` for offline-mode servers; `microsoft` requires a real Microsoft account
- `bot.autoStart`: `true` to start automatically
- `dashboard.password`: password used to open the web dashboard

Keep the quotes around text values. Use a different password for the Minecraft login and dashboard. Do not share the dashboard password. Prefer a **private GitHub repository** because these settings contain passwords.

## Deploy on Railway

1. Extract this ZIP.
2. Create a GitHub repository (private is recommended).
3. Upload the **contents** of this folder to the repository root. `package.json`, `index.js`, `config.js`, and `railway.json` must be at the top level.
4. In Railway choose **New Project → Deploy from GitHub Repo** and select the repository.
5. Generate a public domain in Railway under **Settings → Networking → Generate Domain**.
6. Open that domain and enter `dashboard.password` from `config.js`.

You do **not** need to add Minecraft IP or bot passwords in Railway Variables. Railway supplies its own `PORT` for the dashboard automatically; the code reads it automatically.

## Minecraft server setup (separate from Railway)

Copy `scripts/ScarletBot_Loadout.sk` into `plugins/Skript/scripts/ScarletBot_Loadout.sk`, then run:

```text
/sk reload ScarletBot_Loadout
/lp user ShadowMiner27 permission set scarlet.botkit true
```

The bot uses `/sm27` for its private kit. The server must provide `/spawn`, `/rtp`, and `/tpa`.

## Dashboard

Dashboard has Start, Stop, and Restart controls and shows connection status and recent logs.

## Important

- This is source code, not a prebuilt executable. Upload the extracted files to GitHub and deploy that repository through Railway; Railway does not generally deploy a ZIP directly.
- If `authType` is `microsoft`, use an account you own and complete the authentication flow supported by Mineflayer.
- Register/login chat prompts and TPA acceptance messages vary by server plugins; logs may need adjustment.
- The Skript kit file is installed on the Minecraft server, not on Railway.
- The project has not been live-tested against your Minecraft server. Successful operation depends on server address, auth plugin, permissions, and command/message formats.
