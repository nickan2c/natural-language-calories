import axios from 'axios';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const MODEL = 'llama-3.3-70b-versatile'; // Smarter model for better accuracy

// Warn if API key is missing
if (!GROQ_API_KEY) {
  console.warn('⚠️ GROQ_API_KEY is not set. Please add VITE_GROQ_API_KEY to your .env.local file.');
}

/**
 * Extract foods from natural language text
 * Returns { foods: array, rawResponse: string }
 */
export async function extractFoods(text) {
  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a food extraction assistant. Extract all foods mentioned in the user's message and return them as a JSON array. Each item should have "food" (name of the food, lowercase) and "quantity" (number/amount). If no quantity is mentioned, use "1". Return ONLY valid JSON, no other text.

Example input: "2 eggs and a banana"
Example output: [{"food": "eggs", "quantity": "2"}, {"food": "banana", "quantity": "1"}]`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const content = response.data.choices[0].message.content.trim();

    // Parse JSON response
    const foods = JSON.parse(content);

    if (!Array.isArray(foods)) {
      throw new Error('LLM did not return an array');
    }

    return { foods, rawResponse: content };
  } catch (error) {
    console.error('Error extracting foods:', error);

    // Log more detailed error info
    if (error.response) {
      console.error('API Error Response:', error.response.data);
      console.error('Status:', error.response.status);
    }

    // Provide more helpful error messages
    if (error.response?.status === 401) {
      throw new Error('Invalid Groq API key. Please check your .env.local file.');
    } else if (error.response?.status === 400) {
      throw new Error('Bad request to Groq API. Please check your input.');
    } else if (!GROQ_API_KEY) {
      throw new Error('Groq API key not found. Please add VITE_GROQ_API_KEY to .env.local');
    }

    throw new Error('Failed to parse food input. Please try again.');
  }
}

/**
 * Estimate nutrition for a food item
 * Returns {calories: number, protein: number, rawResponse: string}
 */
export async function estimateNutrition(foodName, quantity) {
  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a nutrition estimation assistant. Given a food name and quantity, estimate the total calories and protein in grams. Return ONLY valid JSON with "calories" and "protein" as numbers, no other text.

Example input: "eggs, quantity: 2"
Example output: {"calories": 156, "protein": 12}

Be accurate and use standard serving sizes. Round to whole numbers.`
          },
          {
            role: 'user',
            content: `${foodName}, quantity: ${quantity}`
          }
        ],
        temperature: 0.1,
        max_tokens: 100
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const content = response.data.choices[0].message.content.trim();

    // Parse JSON response
    const nutrition = JSON.parse(content);

    return {
      calories: nutrition.calories || 0,
      protein: nutrition.protein || 0,
      rawResponse: content
    };
  } catch (error) {
    console.error('Error estimating nutrition:', error);

    // Log more detailed error info
    if (error.response) {
      console.error('API Error Response:', error.response.data);
      console.error('Status:', error.response.status);
    }

    // Return fallback values instead of failing
    return { calories: 0, protein: 0 };
  }
}

/**
 * Check if user is providing a new food with known nutrition
 * Returns { hasNutrition: boolean, food: string, quantity: number, calories: number, protein: number, isPerItem: boolean, rawResponse: string }
 */
export async function parseKnownNutrition(text) {
  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a food parser. Determine if the user is providing a NEW food with known nutrition values. Extract quantity and whether nutrition is per item or total. Return ONLY valid JSON, no other text.

If they're providing a food WITH nutrition info, return:
{
  "hasNutrition": true,
  "food": "food name (lowercase)",
  "quantity": number (default 1),
  "calories": number (per item if isPerItem=true, otherwise total),
  "protein": number (per item if isPerItem=true, otherwise total),
  "isPerItem": boolean (true if they say "each" or "per", false otherwise)
}

If they're NOT providing nutrition info, return:
{
  "hasNutrition": false
}

Examples:
Input: "2 myprotein layered bars, they are 208kcal 20g each"
Output: {"hasNutrition": true, "food": "myprotein layered bars", "quantity": 2, "calories": 208, "protein": 20, "isPerItem": true}

Input: "I had a simmer jerk today, it was 640 kcal 40g"
Output: {"hasNutrition": true, "food": "simmer jerk", "quantity": 1, "calories": 640, "protein": 40, "isPerItem": false}

Input: "3 protein bars, 200 calories 15g protein each"
Output: {"hasNutrition": true, "food": "protein bars", "quantity": 3, "calories": 200, "protein": 15, "isPerItem": true}

Input: "I ate a sandwich with 300kcal and 12g protein"
Output: {"hasNutrition": true, "food": "sandwich", "quantity": 1, "calories": 300, "protein": 12, "isPerItem": false}

Input: "2 eggs and a banana"
Output: {"hasNutrition": false}

Look for quantity numbers at the start. Look for "each", "per", "apiece" to determine if values are per item.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.1,
        max_tokens: 200
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const content = response.data.choices[0].message.content.trim();
    const result = JSON.parse(content);

    return {
      ...result,
      rawResponse: content
    };
  } catch (error) {
    console.error('Error parsing known nutrition:', error);

    if (error.response) {
      console.error('API Error Response:', error.response.data);
    }

    return { hasNutrition: false };
  }
}

/**
 * Generate a Gen Z style response after logging food
 * Returns { message: string, rawResponse: string }
 */
export async function generateGenZResponse(foodsLogged, totalCalories, totalProtein, dailyCalories, dailyProtein, weeklyContext = null) {
  try {
    let weeklyInfo = '';
    if (weeklyContext && weeklyContext.length > 0) {
      const recentDays = weeklyContext.map(d =>
        `${d.date}: ${d.calories ?? '?'} cal, ${d.protein ?? '?'}g protein, ${d.steps ?? '?'} steps`
      ).join('\n');
      const avgCal = Math.round(weeklyContext.reduce((s, d) => s + (d.calories || 0), 0) / weeklyContext.filter(d => d.calories).length) || 0;
      const avgProtein = Math.round(weeklyContext.reduce((s, d) => s + (d.protein || 0), 0) / weeklyContext.filter(d => d.protein).length) || 0;
      weeklyInfo = `\n\nRecent days (for context on trends):\n${recentDays}\nWeekly avg: ${avgCal} cal, ${avgProtein}g protein. Target: 2700 cal.`;
    }

    const response = await axios.post(
      GROQ_API_URL,
      {
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a Gen Z fitness buddy who's supportive, funny, and uses modern slang. Generate a short (1-2 sentences) response after someone logs their food. Be encouraging, use Gen Z slang naturally (bestie, ngl, slaps, ate, slay, lowkey, highkey, fr, no cap, etc.), and reference their progress. If you have weekly context, reference trends (e.g. streak of hitting target, binge recovery, protein consistency). Keep it fun and casual. Don't use emojis excessively - maybe 1-2 max. Return ONLY the message text, no JSON.

Examples:
- "logged bestie! that's 420 cals, you're at 1240/2700 today. 3 days under target in a row, we're locked in fr"
- "yesss 35g protein fr? that's giving health icon, you're slaying today ngl"
- "ok lowkey that's a lot of calories but yesterday you were under so it balances out bestie"
- "560 cals logged! you're at 1800 today which slaps, keep it up bestie"
- "protein been hitting different this week, averaging 160g no cap 💪"`
          },
          {
            role: 'user',
            content: `Foods logged: ${foodsLogged.join(', ')}. Total added: ${totalCalories} calories, ${totalProtein}g protein. Daily total so far: ${dailyCalories} calories, ${dailyProtein}g protein.${weeklyInfo}`
          }
        ],
        temperature: 0.9,
        max_tokens: 150
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const content = response.data.choices[0].message.content.trim();

    return {
      message: content,
      rawResponse: content
    };
  } catch (error) {
    console.error('Error generating Gen Z response:', error);

    // Return a fallback message
    return {
      message: `Logged ${totalCalories} calories and ${totalProtein}g protein! You're at ${dailyCalories} calories today.`
    };
  }
}

/**
 * Route a user message to the right intent
 * Returns { intent: "food"|"chat"|"correction"|"known_nutrition"|"data_update", mealType?: string, date?: string, field?: string, value?: number }
 */
export async function routeMessage(text) {
  try {
    const now = new Date();
    const hour = now.getHours();
    const defaultMeal = hour < 11 ? 'breakfast' : hour < 15 ? 'lunch' : hour < 20 ? 'dinner' : 'snack';
    const today = now.toISOString().split('T')[0];

    const response = await axios.post(
      GROQ_API_URL,
      {
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a message router for a calorie tracking chatbot. Classify the user's message into one of these intents and return ONLY valid JSON:

1. "food" - User is logging food they ate. Return:
   {"intent": "food", "mealType": "breakfast|lunch|dinner|snack"}

2. "known_nutrition" - User is logging food AND providing specific calorie/protein values. Return:
   {"intent": "known_nutrition"}

3. "correction" - User is correcting a previously logged food's nutrition. Look for "actually", "should be", etc. Return:
   {"intent": "correction"}

4. "data_update" - User wants to update a Notion field like steps, weight, calories, protein for a specific date. Return:
   {"intent": "data_update", "date": "YYYY-MM-DD", "updates": {"steps": number, "calories": number, "protein": number}}
   Only include fields the user mentions. For "yesterday" use the day before today. For "today" use today's date.

5. "chat" - Casual conversation, greetings, questions about progress, anything not food-related. Return:
   {"intent": "chat"}

Today is ${today}. Default meal type based on current time: ${defaultMeal}.

Examples:
"2 eggs and toast" → {"intent": "food", "mealType": "${defaultMeal}"}
"had a protein bar for lunch, 200cal 20g" → {"intent": "known_nutrition"}
"actually the eggs were 180cal" → {"intent": "correction"}
"steps yesterday were 12000" → {"intent": "data_update", "date": "${new Date(now - 86400000).toISOString().split('T')[0]}", "updates": {"steps": 12000}}
"14k steps today" → {"intent": "data_update", "date": "${today}", "updates": {"steps": 14000}}
"sup bro" → {"intent": "chat"}
"how am i doing this week" → {"intent": "chat"}`
          },
          { role: 'user', content: text }
        ],
        temperature: 0.1,
        max_tokens: 200
      },
      { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' } }
    );

    const content = response.data.choices[0].message.content.trim();
    return JSON.parse(content);
  } catch (error) {
    console.error('Error routing message:', error);
    return { intent: 'food', mealType: 'snack' };
  }
}

/**
 * Generate a casual chat response (non-food messages)
 * Returns { message: string }
 */
export async function generateChatResponse(text, weeklyContext = null, dailyCalories = 0, dailyProtein = 0) {
  try {
    let contextInfo = '';
    if (weeklyContext && weeklyContext.length > 0) {
      const recentDays = weeklyContext.map(d =>
        `${d.date}: ${d.calories ?? '?'} cal, ${d.protein ?? '?'}g protein, ${d.steps ?? '?'} steps`
      ).join('\n');
      contextInfo = `\n\nUser's recent data:\n${recentDays}\nToday so far: ${dailyCalories} cal, ${dailyProtein}g protein. Target: 2700 cal, 180g protein.`;
    }

    const response = await axios.post(
      GROQ_API_URL,
      {
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a Gen Z fitness buddy chatbot. You're supportive, funny, and use modern slang naturally. You help track calories and fitness. Keep responses short (1-3 sentences). Use Gen Z slang (bestie, ngl, fr, no cap, lowkey, etc.) but don't overdo it. If the user asks about their progress, reference their data. Don't use emojis excessively - maybe 1-2 max.${contextInfo}`
          },
          { role: 'user', content: text }
        ],
        temperature: 0.9,
        max_tokens: 150
      },
      { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' } }
    );

    return { message: response.data.choices[0].message.content.trim() };
  } catch (error) {
    console.error('Error generating chat response:', error);
    return { message: "yo my brain glitched for a sec, try again bestie" };
  }
}

/**
 * Parse a correction message
 * Returns { isCorrection: boolean, food: string, calories: number, protein: number, rawResponse: string }
 */
export async function parseCorrection(text) {
  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a correction parser. Determine if the user is trying to correct nutrition information for a previously logged food. If they are, extract the food name, calories, and protein. Return ONLY valid JSON, no other text.

If it's a correction, return:
{
  "isCorrection": true,
  "food": "food name (lowercase)",
  "calories": number,
  "protein": number
}

If it's NOT a correction, return:
{
  "isCorrection": false
}

Examples:
Input: "actually the bread i had is 130kcal 8g protein"
Output: {"isCorrection": true, "food": "bread", "calories": 130, "protein": 8}

Input: "the eggs were actually 200 calories and 15g protein"
Output: {"isCorrection": true, "food": "eggs", "calories": 200, "protein": 15}

Input: "2 eggs and toast"
Output: {"isCorrection": false}

Look for correction indicators like: "actually", "correction", "should be", "was really", "were actually", etc.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.1,
        max_tokens: 200
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const content = response.data.choices[0].message.content.trim();
    const result = JSON.parse(content);

    return {
      ...result,
      rawResponse: content
    };
  } catch (error) {
    console.error('Error parsing correction:', error);

    if (error.response) {
      console.error('API Error Response:', error.response.data);
    }

    // If parsing fails, assume it's not a correction
    return { isCorrection: false };
  }
}
