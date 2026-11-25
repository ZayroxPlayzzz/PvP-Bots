// ScarletBot settings
// GitHub par is file ko Edit karke apni details bharna.
// Strings ke around quotes rehne dena. Example: "play.example.net"

module.exports = {
  // Minecraft server address (IP ya hostname; yahan https:// mat lagana)
  server: {
    host: "scarletsmp.info.gf",
    port: 26139,
    version: "", // Optional: "1.21.11"; blank = automatic detection
  },

  // Bot Minecraft account
  bot: {
    username: "ShadowMiner27",
    loginPassword: "umerking",
    authType: "offline", // "offline" ya "microsoft"
    autoStart: true,
  },

  // Dashboard ka password (Minecraft login password se alag rakho)
  dashboard: {
    password: "Meezan@8899",
  },
}
