const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const mcData = require('minecraft-data')

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 56272, // CHANGE THIS
  username: 'Bot'
})

bot.loadPlugin(pathfinder)

bot.once('spawn', () => {
  console.log('🤖 Bot has joined the world!')
})

bot.on('chat', (username, message) => {
  if (message === 'follow me') {
    const player = bot.players[username]
    if (!player) return

    const movements = new Movements(bot, mcData)
    bot.pathfinder.setMovements(movements)

    bot.pathfinder.setGoal(
      new goals.GoalFollow(player.entity, 1),
      true
    )
    bot.chat('Started following you')
  }
})


bot.on('chat', async (username, message) => {
  if (username === bot.username) return

  const args = message.split(' ')
  if (args[0] !== 'mine') return

  const blockName = args[1]
  if (!blockName) {
    bot.chat('❌ Usage: mine <block_name>')
    return
  }

  const mcDataVersioned = mcData(bot.version)
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

  try {
    const movements = new Movements(bot, mcDataVersioned)
    bot.pathfinder.setMovements(movements)

    await bot.pathfinder.goto(
      new goals.GoalBlock(
        block.position.x,
        block.position.y,
        block.position.z
      )
    )

    await bot.dig(block)
    bot.chat(`⛏️ Successfully mined ${blockName}`)
  } catch (err) {
    bot.chat('⚠️ Failed to mine block')
    console.error(err)
  }
})

bot.on('chat', async (username, message) => {
  if (username === bot.username) return

  const args = message.trim().split(' ')
  if (args[0] !== 'give') return

  const blockName = args[1]
  if (!blockName) {
    bot.chat('❌ Usage: give <block_name>')
    return
  }

  const mcDataVersioned = mcData(bot.version)
  const blockItem = mcDataVersioned.itemsByName[blockName]

  if (!blockItem) {
    bot.chat(`❌ Invalid block: ${blockName}`)
    return
  }

  // 🔍 Check inventory
  const item = bot.inventory.items().find(i => i.name === blockName)

  if (!item) {
    bot.chat(`❌ I don't have ${blockName}`)
    return
  }

  const player = bot.players[username]
  if (!player || !player.entity) {
    bot.chat('❌ Cannot see you')
    return
  }

  try {
    // 🚶 Walk to player
    const movements = new Movements(bot, mcDataVersioned)
    bot.pathfinder.setMovements(movements)

    await bot.pathfinder.goto(
      new goals.GoalNear(
        player.entity.position.x,
        player.entity.position.y,
        player.entity.position.z,
        1
      )
    )

    // 📦 Toss item
    await bot.toss(item.type, null, item.count)
    bot.chat(`📦 Dropped ${item.count} ${blockName}`)
  } catch (err) {
    bot.chat('⚠️ Failed to deliver block')
    console.error(err)
  }
})

bot.on('chat', (username, message) => {
  if (username === bot.username) return

  if (message === 'stop follow me') {
    bot.pathfinder.setGoal(null)   // 🔑 THIS STOPS FOLLOWING
    bot.chat('🛑 Stopped following')
  }
})


bot.on('health', () => {
  // 💖 Infinite Health
  if (bot.health < 20) {
    bot.health = 20
  }

  // ⚡ Infinite Hunger (Stamina)
  if (bot.food < 20) {
    bot.food = 20
  }

  // 🛡️ Remove negative effects
  bot.clearControlStates()
})
