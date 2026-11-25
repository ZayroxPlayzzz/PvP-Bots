const express = require('express')
const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const { plugin: pvpPlugin } = require('mineflayer-pvp')

const app = express()
app.use(express.json({ limit: '16kb' }))

const CONFIG = require('./config')
const PORT = Number(process.env.PORT || 3000) // Railway web port; set automatically by Railway
const PANEL_PASSWORD = String(CONFIG.dashboard.password || '')
const HOST = String(CONFIG.server.host || '').trim()
const MC_PORT = Number(CONFIG.server.port || 25565)
const USERNAME = String(CONFIG.bot.username || 'ShadowMiner27')
const AUTH_PASSWORD = String(CONFIG.bot.loginPassword || '')
const AUTH_TYPE = String(CONFIG.bot.authType || 'offline')
const VERSION = String(CONFIG.server.version || '').trim() || false
const AUTO_START = CONFIG.bot.autoStart !== false

let bot = null
let running = false
let connected = false
let authenticated = false
let flowStarted = false
let reconnectTimer = null
let retryTimer = null
let targetName = null
let pendingTpa = false
let lastTpaAt = 0
let playerJoinTimers = new Map()
let logs = []
let startTime = null
let lastError = ''

const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  logs.push(line)
  if (logs.length > 160) logs.shift()
}
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const eligiblePlayers = () => {
  if (!bot) return []
  return Object.keys(bot.players || {}).filter(n =>
    n.toLowerCase() !== USERNAME.toLowerCase() &&
    n.toLowerCase() !== 'opgamer'
  )
}
const sendChat = (message) => {
  if (!bot || !connected) return false
  try { bot.chat(message); log(`CHAT > ${message}`); return true }
  catch (e) { log(`Chat error: ${e.message}`); return false }
}

function panelAuth(req, res, next) {
  if (!PANEL_PASSWORD) return res.status(503).json({ error: 'Set dashboard.password in config.js first.' })
  const supplied = req.get('x-panel-password') || req.body?.password || ''
  if (supplied !== PANEL_PASSWORD) return res.status(401).json({ error: 'Wrong panel password.' })
  next()
}

function nearestMob() {
  if (!bot?.entity) return null
  const hostile = new Set([
    'zombie','husk','drowned','skeleton','stray','bogged','creeper',
    'spider','cave_spider','witch','pillager','vindicator','evoker',
    'ravager','phantom','enderman','slime','magma_cube','blaze',
    'ghast','guardian','elder_guardian','piglin_brute','hoglin',
    ' zoglin','silverfish','endermite','warden'
  ])
  return Object.values(bot.entities).filter(e =>
    e && e.type === 'mob' && e.position && e.name &&
    hostile.has(e.name) &&
    bot.entity.position.distanceTo(e.position) < 12
  ).sort((a,b) =>
    bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position)
  )[0] || null
}

async function equipBestWeapon() {
  if (!bot) return
  const sword = bot.inventory.items().find(i => i.name.includes('netherite_sword') || i.name.includes('diamond_sword') || i.name.includes('iron_sword'))
  if (sword) {
    try { await bot.equip(sword, 'hand') } catch {}
  }
}
async function autoEat() {
  if (!bot || !connected || !bot.food || bot.food > 16 || bot.__eating) return
  const food = bot.inventory.items().find(i =>
    ['cooked_beef','cooked_porkchop','cooked_chicken','cooked_mutton','cooked_rabbit','bread','golden_carrot','baked_potato','golden_apple'].includes(i.name)
  )
  if (!food) return
  bot.__eating = true
  try {
    await bot.equip(food, 'hand')
    await bot.consume()
    log(`Ate ${food.name}; food=${bot.food}`)
    await equipBestWeapon()
  } catch (e) {
    log(`Auto-eat: ${e.message}`)
  } finally {
    bot.__eating = false
  }
}
async function attackMobPractice() {
  if (!bot || !connected || !authenticated || !bot.pvp || pendingTpa || targetName) return
  const mob = nearestMob()
  if (!mob) {
    if (bot.pvp.target) bot.pvp.stop()
    return
  }
  await equipBestWeapon()
  if (bot.pvp.target?.id !== mob.id) {
    try { bot.pvp.attack(mob); log(`Mob practice target: ${mob.name}`) } catch (e) { log(`Mob PvE error: ${e.message}`) }
  }
}

function choosePlayer(except = []) {
  const pool = eligiblePlayers().filter(n => !except.some(x => x.toLowerCase() === n.toLowerCase()))
  if (!pool.length) return null
  return pool[Math.floor(Math.random() * pool.length)]
}
function sendTpa(name, reason) {
  if (!name || !connected || !authenticated) return
  targetName = name
  pendingTpa = true
  lastTpaAt = Date.now()
  if (bot.pvp) bot.pvp.stop()
  sendChat(`/tpa ${name}`)
  log(`TPA sent to ${name} (${reason}); next retry in 15 minutes if still alone`)
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = setTimeout(() => {
    if (!connected || !authenticated || !pendingTpa) return
    const current = eligiblePlayers()
    if (current.length === 1 && current[0].toLowerCase() === name.toLowerCase()) {
      sendTpa(name, '15-minute retry; only one eligible player online')
    } else if (current.length > 1) {
      const next = choosePlayer([name]) || choosePlayer()
      if (next) sendTpa(next, '15-minute retry; random online player')
      else { pendingTpa = false; targetName = null }
    } else {
      pendingTpa = false
      targetName = null
      log('TPA retry paused: no eligible players online')
    }
  }, 15 * 60 * 1000)
}
function scheduleJoinTpa(name) {
  if (!name || name.toLowerCase() === USERNAME.toLowerCase() || name.toLowerCase() === 'opgamer') return
  const old = playerJoinTimers.get(name)
  if (old) clearTimeout(old)
  const timer = setTimeout(() => {
    playerJoinTimers.delete(name)
    if (!connected || !authenticated || pendingTpa) return
    if ((bot.players[name]) && eligiblePlayers().includes(name)) sendTpa(name, 'player joined; 90-second delay')
  }, 90 * 1000)
  playerJoinTimers.set(name, timer)
}

async function beginPostAuthFlow() {
  if (flowStarted || !bot || !connected) return
  flowStarted = true
  authenticated = true
  log('Authentication complete; starting spawn → private kit → RTP sequence')
  await wait(1800)
  sendChat('/spawn')
  await wait(6500)
  sendChat('/sm27')
  await wait(3500)
  await equipBestWeapon()
  sendChat('/rtp')
  log('RTP requested; mob practice is enabled')
  for (const name of eligiblePlayers()) scheduleJoinTpa(name)
}

function handleAuthMessage(message) {
  const m = String(message || '').toLowerCase()
  if (!m) return
  const registerPrompt = /\/register|please register|register your|регистрац|зарегистрир/
  const loginPrompt = /\/login|please log in|please login|log in to|login to|войдите|авторизац/
  const success = /successfully (logged|registered)|you are now logged|успешно вош|успешно зарегистр|logged in successfully|registration successful/
  const failed = /already registered|already logged|incorrect password|wrong password|пароль невер|already authenticated/
  if (success) {
    beginPostAuthFlow()
    return
  }
  if (failed && /already logged|already authenticated/.test(m)) {
    beginPostAuthFlow()
    return
  }
  if (registerPrompt.test(m) && !authenticated) {
    sendChat(`/register ${AUTH_PASSWORD} ${AUTH_PASSWORD}`)
    log('Register prompt detected; /register sent')
    setTimeout(() => { if (connected && !flowStarted) beginPostAuthFlow() }, 2500)
  } else if (loginPrompt.test(m) && !authenticated) {
    sendChat(`/login ${AUTH_PASSWORD}`)
    log('Login prompt detected; /login sent')
    setTimeout(() => { if (connected && !flowStarted) beginPostAuthFlow() }, 2500)
  }
}

function createBot() {
  if (!running || bot) return
  if (!HOST) { lastError = 'server.host is not configured in config.js'; log(lastError); return }
  if (!AUTH_PASSWORD) { lastError = 'bot.loginPassword is not configured in config.js'; log(lastError); return }
  log(`Connecting ${USERNAME} to ${HOST}:${MC_PORT}`)
  try {
    bot = mineflayer.createBot({
      username: USERNAME,
      auth: AUTH_TYPE,
      host: HOST,
      port: MC_PORT,
      version: VERSION,
      hideErrors: false,
      checkTimeoutInterval: 120000
    })
    bot.loadPlugin(pathfinder)
    bot.loadPlugin(pvpPlugin)
    let pendingAuthMessage = null

    bot.once('spawn', async () => {
      connected = true
      authenticated = false
      flowStarted = false
      startTime = Date.now()
      lastError = ''
      log(`Connected in world; server version ${bot.version}. Waiting for auth prompt.`)
      const mcData = require('minecraft-data')(bot.version)
      const movements = new Movements(bot, mcData)
      movements.allowSprinting = true
      movements.canDig = false
      bot.pathfinder.setMovements(movements)
      if (pendingAuthMessage) {
        const queued = pendingAuthMessage
        pendingAuthMessage = null
        handleAuthMessage(queued)
      }
      setTimeout(() => {
        if (!connected || flowStarted) return
        log('No auth prompt detected in 12 seconds; trying /login as fallback')
        sendChat(`/login ${AUTH_PASSWORD}`)
        setTimeout(() => {
          if (connected && !flowStarted) beginPostAuthFlow()
        }, 3500)
      }, 12000)
    })

    bot.on('messagestr', (message) => {
      log(`SERVER: ${String(message).slice(0, 240)}`)
      if (!connected && /\/register|\/login|please register|please log in|please login|регистрац|войдите/i.test(String(message))) {
        pendingAuthMessage = message
      } else {
        handleAuthMessage(message)
      }
      const m = String(message).toLowerCase()
      if (pendingTpa && targetName) {
        const accepted = /accepted your teleport|teleport request accepted|teleporting you|teleported you|has accepted.*request|request.*accepted/.test(m)
        if (accepted) startPlayerFight(targetName, 'server acceptance message')
      }
    })
    bot.on('playerJoined', (player) => {
      if (!player?.username || player.username.toLowerCase() === USERNAME.toLowerCase()) return
      log(`Player joined: ${player.username}`)
      if (authenticated) scheduleJoinTpa(player.username)
    })
    bot.on('playerLeft', (player) => {
      const name = player?.username
      if (name && targetName && name.toLowerCase() === targetName.toLowerCase()) {
        stopPlayerFight('target left')
      }
    })
    bot.on('physicsTick', () => {
      if (!connected || !authenticated) return
      autoEat().catch(() => {})
      if (!targetName) attackMobPractice().catch(() => {})
      if (pendingTpa && targetName && bot.entity) {
        const p = bot.players[targetName]?.entity
        if (p && bot.entity.position.distanceTo(p.position) <= 5) startPlayerFight(targetName, 'target is within combat range')
      }
    })
    bot.on('death', () => {
      log('Bot died; stopping current fight and waiting for respawn')
      stopPlayerFight('bot died')
    })
    bot.on('respawn', () => {
      setTimeout(() => {
        if (connected && authenticated) {
          sendChat('/spawn')
          setTimeout(() => sendChat('/sm27'), 3000)
          setTimeout(() => sendChat('/rtp'), 5000)
        }
      }, 2500)
    })
    bot.on('kicked', reason => { lastError = `Kicked: ${String(reason).slice(0,180)}`; log(lastError) })
    bot.on('error', err => { lastError = err.message || String(err); log(`Bot error: ${lastError}`) })
    bot.on('end', () => {
      log('Bot disconnected')
      connected = false
      authenticated = false
      flowStarted = false
      pendingTpa = false
      targetName = null
      if (bot?.pvp) { try { bot.pvp.stop() } catch {} }
      bot = null
      clearPlayerTimers()
      if (running) {
        if (reconnectTimer) clearTimeout(reconnectTimer)
        reconnectTimer = setTimeout(createBot, 8000)
        log('Reconnect scheduled in 8 seconds')
      }
    })
  } catch (e) {
    lastError = e.message
    log(`Create bot failed: ${e.message}`)
    bot = null
    if (running) reconnectTimer = setTimeout(createBot, 10000)
  }
}

function startPlayerFight(name, reason) {
  if (!bot || !connected || !authenticated || !name) return
  const entity = bot.players[name]?.entity
  if (!entity) {
    log(`TPA accepted but target ${name} is not currently visible`)
    pendingTpa = false
    return
  }
  pendingTpa = false
  targetName = name
  if (retryTimer) clearTimeout(retryTimer)
  log(`Starting PvP against ${name} (${reason})`)
  equipBestWeapon().then(() => {
    try { bot.pvp.attack(entity) } catch (e) { log(`PvP start error: ${e.message}`) }
  })
}
function stopPlayerFight(reason) {
  if (bot?.pvp) { try { bot.pvp.stop() } catch {} }
  log(`Stopping target fight (${reason})`)
  targetName = null
  pendingTpa = false
  if (retryTimer) clearTimeout(retryTimer)
}
function clearPlayerTimers() {
  for (const t of playerJoinTimers.values()) clearTimeout(t)
  playerJoinTimers.clear()
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
}
function startBot() {
  if (running) return
  running = true
  log('Bot start requested')
  createBot()
}
function stopBot() {
  running = false
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = null
  clearPlayerTimers()
  if (bot) {
    const old = bot
    bot = null
    connected = false
    authenticated = false
    try { old.quit('Panel stop') } catch { try { old.end() } catch {} }
  }
  log('Bot stopped from panel')
}

app.get('/health', (_req,res) => res.json({ ok: true, service: 'ScarletBot' }))
app.get('/', (_req,res) => res.type('html').send(PANEL_HTML))
app.get('/api/status', panelAuth, (_req,res) => res.json({
  running, connected, authenticated, username: USERNAME, host: HOST,
  targetName, pendingTpa, uptimeSeconds: startTime && connected ? Math.floor((Date.now()-startTime)/1000) : 0,
  lastError, logs: logs.slice(-70)
}))
app.post('/api/start', panelAuth, (_req,res) => { startBot(); res.json({ ok: true, message: 'Start requested' }) })
app.post('/api/stop', panelAuth, (_req,res) => { stopBot(); res.json({ ok: true, message: 'Stop requested' }) })
app.post('/api/restart', panelAuth, (_req,res) => { stopBot(); setTimeout(startBot, 1200); res.json({ ok: true, message: 'Restart requested' }) })

app.listen(PORT, '0.0.0.0', () => {
  log(`Control panel listening on port ${PORT}`)
  if (AUTO_START) startBot()
})

const PANEL_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Scarlet Bot Control</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0b1020;color:#edf2ff;font:15px Inter,system-ui,sans-serif;padding:22px}.wrap{max-width:850px;margin:auto}.top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.brand{font-size:23px;font-weight:800;letter-spacing:.3px}.muted{color:#9aa7c2}.card{background:#131c32;border:1px solid #273552;border-radius:16px;padding:18px;margin-top:16px}.status{display:flex;align-items:center;gap:10px;font-weight:700}.dot{width:10px;height:10px;border-radius:50%;background:#e05252}.dot.on{background:#38d996;box-shadow:0 0 14px #38d99688}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:14px}.stat{background:#0d1528;border-radius:12px;padding:13px}.stat small{display:block;color:#9aa7c2;margin-bottom:5px}.stat b{font-size:17px;overflow-wrap:anywhere}.actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:16px}button{border:0;border-radius:10px;padding:11px 16px;color:#fff;font-weight:700;cursor:pointer;background:#4858d6}button.stop{background:#b33b54}button.restart{background:#8a5bd6}input{background:#0d1528;border:1px solid #354666;border-radius:10px;padding:12px;color:#fff;width:min(100%,340px)}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:340px;overflow:auto;background:#080e1b;border-radius:12px;padding:13px;color:#b8c7e8;font-size:12px}.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.hidden{display:none}.notice{color:#ffcc82;margin-top:9px;font-size:13px}</style></head><body><main class="wrap"><div class="top"><div><div class="brand">⚔ SCARLET BOT CONTROL</div><div class="muted">Single PvP bot dashboard</div></div><div class="muted">ShadowMiner27</div></div><section class="card" id="login"><h2>Panel Login</h2><p class="muted">Enter the BOT_PANEL_PASSWORD from Railway Variables.</p><div class="row"><input id="pw" type="password" placeholder="Panel password"><button onclick="login()">Unlock Panel</button></div><div id="loginMsg" class="notice"></div></section><div id="app" class="hidden"><section class="card"><div class="status"><span id="dot" class="dot"></span><span id="state">Checking status…</span></div><div class="grid"><div class="stat"><small>Bot</small><b id="name">—</b></div><div class="stat"><small>Server</small><b id="server">—</b></div><div class="stat"><small>Authentication</small><b id="auth">—</b></div><div class="stat"><small>Current target</small><b id="target">—</b></div><div class="stat"><small>TPA</small><b id="tpa">—</b></div><div class="stat"><small>Uptime</small><b id="uptime">—</b></div></div><div class="actions"><button onclick="action('start')">▶ Start</button><button class="stop" onclick="action('stop')">■ Stop</button><button class="restart" onclick="action('restart')">↻ Restart</button></div><div id="err" class="notice"></div></section><section class="card"><h3>Live Logs</h3><pre id="logs">Waiting for logs…</pre></section><button onclick="logout()" style="background:#34415e">Lock panel</button></div></main><script>
let pass=sessionStorage.getItem('scarletPanelPass')||'';function login(){pass=document.getElementById('pw').value;sessionStorage.setItem('scarletPanelPass',pass);refresh().then(ok=>{if(!ok)document.getElementById('loginMsg').textContent='Login failed. Check the panel password.'})}function logout(){sessionStorage.removeItem('scarletPanelPass');pass='';document.getElementById('app').classList.add('hidden');document.getElementById('login').classList.remove('hidden')}async function api(path,method='GET'){let r=await fetch(path,{method,headers:{'Content-Type':'application/json','x-panel-password':pass},body:method==='POST'?'{}':undefined});if(!r.ok)throw Error((await r.json()).error||'Request failed');return r.json()}async function refresh(){try{let s=await api('/api/status');document.getElementById('login').classList.add('hidden');document.getElementById('app').classList.remove('hidden');document.getElementById('dot').className='dot'+(s.connected?' on':'');document.getElementById('state').textContent=s.connected?'BOT ONLINE':s.running?'CONNECTING / RUNNING':'BOT OFFLINE';document.getElementById('name').textContent=s.username;document.getElementById('server').textContent=s.host;document.getElementById('auth').textContent=s.authenticated?'Authenticated':'Waiting';document.getElementById('target').textContent=s.targetName||'None';document.getElementById('tpa').textContent=s.pendingTpa?'Waiting for accept':'Idle';document.getElementById('uptime').textContent=s.uptimeSeconds+' sec';document.getElementById('err').textContent=s.lastError||'';document.getElementById('logs').textContent=s.logs.join('\\n');return true}catch(e){return false}}async function action(a){try{await api('/api/'+a,'POST');await refresh()}catch(e){alert(e.message)}}if(pass){refresh()}setInterval(()=>{if(pass)refresh()},5000)
</script></body></html>`
