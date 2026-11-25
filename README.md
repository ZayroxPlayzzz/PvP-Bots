# Scarlet SMP Bot — configurable build

## Customize everything in `settings.json`
- `server.ip`, `server.port`, `server.version`
- `bot-account.username`
- `utils.auto-auth.registerPassword` and `loginPassword` (separate values)
- `utils.auto-auth.registerCommand` / `loginCommand`
- `playerPvp.targetMode` (`random_online_player`), `excludePlayers`, `tpaCommand`, wait/retry and ranges
- `utils.after-auth-commands` (`/spawn`, `/sm27`, `/rtp`)

Use `{registerPassword}`, `{confirmPassword}`, and `{loginPassword}` in command templates. Example defaults:
- register: `/register {registerPassword} {confirmPassword}`
- login: `/login {loginPassword}`

The auth fallback sends register first for a new account, then login if the server says the account is already registered. Auth plugin messages differ, so check logs and adjust command templates if your server uses different syntax.

## Kit command
Install Skript on the Paper server. Copy `scripts/ScarletBot_Loadout.sk` to `plugins/Skript/scripts/`, then run `/sk reload ScarletBot_Loadout`. Give permission if needed:
`/lp user ShadowMiner27 permission set scarlet.botkit true`

## Run
1. Install Node.js 20+.
2. Run `npm install`.
3. Run `npm start`.
4. Open the dashboard at `http://localhost:5000/` when running locally.

## Hosting / Dashboard URL
The dashboard is served at `/` on the same web port as the app. A hosting provider generates the public URL after you deploy and expose the app's HTTP port (use the provider's assigned `PORT`). The final panel address will be the provider's public URL, e.g. `https://YOUR-APP-DOMAIN/`; that exact URL cannot be known before deployment. The `/logs` and `/tutorial` pages are also available on the same domain.

## Important
- Keep `settings.json` private: it contains server and account credentials. Do not publish it in a public GitHub repository.
- The bot's PvP module selects a random eligible online player, skips names in `excludePlayers`, sends the configured TPA command, and attacks only after an acceptance message is detected.
- This project has passed a Node.js syntax check but has not been live-tested against your Minecraft server. Auth/TPA messages vary by server plugins.


## Hit-to-retaliate PvP mode
The bot runs the configured `/spawn`, `/sm27`, and `/rtp` post-auth commands. It checks for armor from the kit after the kit command has had time to run. Player PvP starts only when a nearby player hits the bot, and it stops when that target is lost or moves beyond the configured range. Set `playerPvp.retaliateRange`, `attackRange`, and `stopRange` in `settings.json` as needed.
