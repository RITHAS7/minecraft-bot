// import { GoogleGenAI } from '@google/genai'
// import 'dotenv/config'

// // Client automatically reads GEMINI_API_KEY from .env
// const ai = new GoogleGenAI({})

// async function parseNLP(text) {
//   const prompt = `
// You are a STRICT command generator for a Minecraft bot.

// You MUST output EXACTLY ONE command from this list:
// follow
// stop_follow
// come
// mine <block>
// give <item>
// none

// Rules:
// - Output MUST be lowercase
// - Use underscores only
// - No extra words
// - No punctuation
// - No explanations

// Examples:
// "follow me" -> follow
// "stop following me" -> stop_follow
// "come here" -> come
// "mine iron ore" -> mine iron_ore
// "bring me diamonds" -> give diamond
// "what's up?" -> none

// User message:
// "${text}"

// Output:
// `


//   const response = await ai.models.generateContent({
//     model: 'gemini-3-flash-preview',
//     contents: prompt
//   })

//   return response.text.trim().toLowerCase()
// }


// export default parseNLP


import OpenAI from 'openai'
import 'dotenv/config'

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'http://localhost', // required by OpenRouter
    'X-Title': 'Minecraft NLP Bot'
  }
})

export default async function parseNLP(text) {
  const completion = await client.chat.completions.create({
    model: 'openai/gpt-4o-mini',
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: `
You are a STRICT command generator for a Minecraft bot.

Output EXACTLY one command from:
follow
stop_follow
come
mine <block>
give <item>
none

Rules:
- lowercase only
- underscores only
- no extra words
        `
      },
      { role: 'user', content: text }
    ]
  })

  return completion.choices[0].message.content.trim().toLowerCase()
}
