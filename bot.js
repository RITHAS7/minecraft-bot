import 'dotenv/config'
import mineflayer from 'mineflayer'
import pkg from 'mineflayer-pathfinder'
import mcData from 'minecraft-data'
import parseNLP from './nlp.js'

const { pathfinder, Movements, goals } = pkg
import { mineflayer as viewer } from 'prismarine-viewer'
import express from 'express'
import { WebSocketServer } from 'ws'

// ===================== BOT SETUP =====================
const bot = mineflayer.createBot({
  host: 'localhost',
  port: 56272,            // 🔴 CHANGE TO YOUR LAN PORT
  username: 'roboboy'  // 🔴 CHANGE BOT ACCOUNT NAME
})

bot.loadPlugin(pathfinder)

const app = express()
const WEB_PORT = 3000

app.use(express.static('public'))

const server = app.listen(WEB_PORT, () => {
  console.log(`🌐 Bot POV available at http://localhost:${WEB_PORT}`)
})

// ===================== WEBSOCKET SERVER =====================
const wss = new WebSocketServer({ server })

wss.on('connection', (ws) => {
  console.log('🔌 Frontend connected')

  // Send bot stats every second
  const interval = setInterval(() => {
    if (ws.readyState === ws.OPEN && bot.entity) {
      ws.send(JSON.stringify({
        type: 'stats',
        data: {
          health: bot.health || 20,
          food: bot.food || 20,
          position: bot.entity.position || { x: 0, y: 0, z: 0 },
          username: bot.username
        }
      }))
    }
  }, 1000)

  ws.on('close', () => {
    clearInterval(interval)
    console.log('🔌 Frontend disconnected')
  })

  // Handle commands from frontend
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data)
      if (msg.type === 'command') {
        console.log('📥 Command from frontend:', msg.command)
        // Simulate as if a player said it in chat
        bot.emit('chat', 'WebUI', msg.command)
      }
    } catch (err) {
      console.error('WebSocket message error:', err)
    }
  })
})


// ===================== SPAWN =====================
bot.once('spawn', () => {
  console.log('🤖 Bot has joined the world!')

  bot.trackEntity = () => {}

  viewer(bot, {
    port: 3001,
    firstPerson: true,
    follow: true,
  })

})


// ===================== INFINITE HEALTH & STAMINA =====================
bot.on('health', () => {
  if (bot.health < 20) bot.health = 20
  if (bot.food < 20) bot.food = 20
})


function waitForPlayerEntity(username, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()

    const interval = setInterval(() => {
      const player = bot.players[username]
      if (player && player.entity) {
        clearInterval(interval)
        resolve(player.entity)
      }

      if (Date.now() - start > timeout) {
        clearInterval(interval)
        reject(new Error('Player entity not found'))
      }
    }, 200)
  })
}


// ===================== NLP CHAT HANDLER =====================
bot.on('chat', async (username, message) => {
  if (username === bot.username) return

  let command
  try {
    command = (await parseNLP(message)).trim().toLowerCase()
    console.log('🧠 Gemini raw:', command)
  } catch (err) {
    console.error('NLP error:', err)
    bot.chat('❌ NLP failed')
    return
  }

  const mcDataVersioned = mcData(bot.version)
  const player = bot.players[username]

  if (command === 'none') {
    bot.chat("🤖 I didn't understand that")
    return
  }

  // ---------- FOLLOW ----------
  if (command === 'follow') {
    let targetEntity

    try {
      targetEntity = await waitForPlayerEntity(username)
    } catch (err) {
      bot.chat("❌ I still can't see you. Try moving closer or teleport me.")
      return
    }

    console.log('✅ Player entity found:', targetEntity.position)

    const mcDataVersioned = mcData(bot.version)
    const movements = new Movements(bot, mcDataVersioned)
    bot.pathfinder.setMovements(movements)

    bot.pathfinder.setGoal(
      new goals.GoalFollow(targetEntity, 2),
      true
    )

    bot.chat('👣 Following you')
  }


  // ---------- STOP FOLLOW ----------
  else if (command === 'stop_follow') {
    bot.pathfinder.setGoal(null)
    bot.chat('🛑 Stopped following')
  }

  // ---------- COME ----------
  else if (command === 'come') {
    if (!player || !player.entity) return

    const movements = new Movements(bot, mcDataVersioned)
    bot.pathfinder.setMovements(movements)
    bot.pathfinder.setGoal(
      new goals.GoalNear(
        player.entity.position.x,
        player.entity.position.y,
        player.entity.position.z,
        1
      )
    )

    bot.chat('🚶 Coming to you')
  }

  // ---------- MINE BLOCK ----------
  else if (command.startsWith('mine')) {
    const blockName = command.split(' ')[1]
    if (!blockName) {
      bot.chat('❌ No block specified')
      return
    }

    const blockType = mcDataVersioned.blocksByName[blockName]
    if (!blockType) {
      bot.chat(`❌ Unknown block: ${blockName}`)
      return
    }

    const block = bot.findBlock({
      matching: blockType.id,
      maxDistance: 32
    })

    if (!block) {
      bot.chat(`❌ No ${blockName} nearby`)
      return
    }

    const movements = new Movements(bot, mcDataVersioned)
    bot.pathfinder.setMovements(movements)

    try {
      await bot.pathfinder.goto(
        new goals.GoalBlock(
          block.position.x,
          block.position.y,
          block.position.z
        )
      )
      await bot.dig(block)
      bot.chat(`⛏️ Mined ${blockName}`)
    } catch (err) {
      console.error(err)
      bot.chat('⚠️ Mining failed')
    }
  }

  // ---------- GIVE ITEM ----------
  else if (command.startsWith('give')) {
    const itemName = command.split(' ')[1]
    if (!itemName) {
      bot.chat('❌ No item specified')
      return
    }

    const item = bot.inventory.items().find(i => i.name === itemName)
    if (!item) {
      bot.chat(`❌ I don't have ${itemName}`)
      return
    }

    if (!player || !player.entity) return

    const movements = new Movements(bot, mcDataVersioned)
    bot.pathfinder.setMovements(movements)

    try {
      await bot.pathfinder.goto(
        new goals.GoalNear(
          player.entity.position.x,
          player.entity.position.y,
          player.entity.position.z,
          1
        )
      )

      await bot.toss(item.type, null, item.count)
      bot.chat(`📦 Gave you ${item.count} ${itemName}`)
    } catch (err) {
      console.error(err)
      bot.chat('⚠️ Could not give item')
    }
  }

  // ---------- UNKNOWN ----------
  else {
    bot.chat("🤖 I didn't understand that")
  }
})
