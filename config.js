// ScarletBot settings
// GitHub par is file ko Edit karke apni details bharna.
// Strings ke around quotes rehne dena. Example: "play.example.net"

module.exports = {
  // Minecraft server address (IP ya hostname; yahan https:// mat lagana)
  server: {
    host: "YOUR_SERVER_IP",
    port: 25565,
    version: "", // Optional: "1.21.11"; blank = automatic detection
  },

  // Bot Minecraft account
  bot: {
    username: "ShadowMiner27",
    loginPassword: "CHANGE_THIS_MINECRAFT_LOGIN_PASSWORD",
    authType: "offline", // "offline" ya "microsoft"
    autoStart: true,
  },

  // Dashboard ka password (Minecraft login password se alag rakho)
  dashboard: {
    password: "CHANGE_THIS_DASHBOARD_PASSWORD",
  },
}
