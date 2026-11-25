Spawn/RTP cycle update

Configured flow after auth: /spawn -> /sm27 -> equip available armor and best sword -> /rtp -> enable player PvP and begin periodic /tpa <player> requests. On death/respawn, PvP is disabled during the kit/spawn sequence and the same cycle is restarted.

The bot excludes its configured username and names in playerPvp.excludePlayers. The included ten-name exclusion list is retained.

Important: Bot-side gating prevents the bot from attacking while at spawn; it cannot stop other players from hitting the bot. Configure your server spawn-protection/region PvP deny for that. Attack-on-sight is enabled after RTP, so it may engage eligible nearby players whether or not they accepted a TPA request. Configure this only on a server where that behavior is allowed.

Commands and waits are configurable in settings.json: utils.spawnCommand, kitCommand, rtpCommand, spawnWaitMs, kitWaitMs, rtpWaitMs; playerPvp.tpaCommand and tpaIntervalMs.

Checks performed: Node.js syntax check and settings JSON parse. Not live-tested on a Minecraft server. Actual behavior depends on the server's commands, Skript kit permissions, version, and plugins.
