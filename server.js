require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are "FoodieBot" — a warm, knowledgeable, and enthusiastic AI food assistant. Your personality is like a friendly chef who loves sharing their passion for food.

Your expertise covers:
- Recipes from every cuisine around the world (Indian, Italian, Mexican, Japanese, Thai, French, etc.)
- Cooking techniques, tips, and kitchen hacks
- Ingredient substitutions and dietary adaptations (vegan, gluten-free, keto, etc.)
- Meal planning and nutrition guidance
- Food pairing and flavor combinations
- Restaurant-style plating and presentation tips
- Food history and cultural context

Guidelines:
1. Always format recipes clearly with Ingredients and Steps sections.
2. Use food emojis naturally to make responses feel warm and inviting (🍕🍜🥗🍰 etc.)
3. When sharing recipes, include approximate cook time and serving size.
4. Be encouraging — make cooking feel fun and accessible.
5. If asked about non-food topics, gently steer back: "I'm your food buddy! Let's talk about something delicious instead 🍽️"
6. Use markdown formatting for better readability — bold headings, bullet points, numbered steps.
7. Keep responses concise but helpful. Don't overwhelm with information unless asked for detail.`;

// Store conversation histories per session (in-memory for simplicity)
const conversations = new Map();

// ============================================
//  Built-in fallback food responses
// ============================================
const fallbackResponses = {
  pasta: `## 🍝 Quick 15-Minute Garlic Butter Pasta

**Cook time:** 15 minutes | **Serves:** 2

### Ingredients
- 200g spaghetti or penne
- 3 cloves garlic, minced
- 2 tbsp butter
- 2 tbsp olive oil
- 1/4 tsp red chili flakes
- Fresh parsley, chopped
- Parmesan cheese, grated
- Salt & pepper to taste

### Steps
1. **Boil pasta** in salted water until al dente (about 10 min). Reserve 1/2 cup pasta water before draining.
2. **Heat butter & olive oil** in a pan over medium heat. Add minced garlic and chili flakes — sauté for 1 minute until fragrant (don't burn it! 😅).
3. **Toss in the pasta**, add a splash of pasta water, and mix everything together.
4. **Season** with salt, pepper, fresh parsley, and a generous shower of parmesan 🧀

**Pro tip:** A squeeze of fresh lemon juice at the end makes this absolutely *chef's kiss* 🤌✨`,

  breakfast: `## 🥗 Healthy Avocado Toast with a Twist

**Cook time:** 10 minutes | **Serves:** 1

### Ingredients
- 2 slices whole-grain bread
- 1 ripe avocado 🥑
- 1 egg
- Cherry tomatoes, halved
- Feta cheese crumbles
- Everything bagel seasoning
- Red chili flakes
- Fresh lemon juice
- Salt & pepper

### Steps
1. **Toast your bread** to golden perfection 🍞
2. **Mash the avocado** with a fork, add lemon juice, salt & pepper
3. **Fry or poach an egg** — runny yolk is the way to go! 🍳
4. **Assemble:** Spread avocado on toast, top with egg, cherry tomatoes, feta, and a sprinkle of everything bagel seasoning

**Pro tip:** Drizzle some hot honey on top for a sweet-spicy kick! 🍯🌶️`,

  indian: `## 🍛 Easy Butter Chicken (Murgh Makhani)

**Cook time:** 35 minutes | **Serves:** 4

### Ingredients
- 500g chicken breast, cubed
- 1 cup tomato purée
- 1/2 cup heavy cream
- 2 tbsp butter 🧈
- 1 onion, finely diced
- 3 cloves garlic, minced
- 1 inch ginger, grated
- 1 tsp garam masala
- 1 tsp turmeric
- 1 tsp cumin
- 1 tsp chili powder
- Salt to taste
- Fresh cilantro for garnish

### Steps
1. **Marinate chicken** with turmeric, chili powder, and a pinch of salt for 10 minutes
2. **Melt butter** in a deep pan, sauté onions until golden brown
3. **Add garlic & ginger**, cook for 1 minute until fragrant
4. **Pour in tomato purée**, add garam masala and cumin. Simmer for 5 minutes
5. **Add chicken**, cook on medium heat for 15 minutes
6. **Stir in cream**, simmer for 5 more minutes
7. **Garnish** with fresh cilantro and serve with warm naan or basmati rice 🍚

**Pro tip:** A teaspoon of honey balances the acidity beautifully! 🍯`,

  chicken_rice: `## 🍗 One-Pot Chicken & Rice

**Cook time:** 30 minutes | **Serves:** 4

### Ingredients
- 4 chicken thighs (bone-in, skin-on)
- 1.5 cups long-grain rice
- 2 cups chicken broth
- 1 onion, diced
- 3 cloves garlic, minced
- 1 tsp paprika
- 1 tsp oregano
- 1/2 tsp cumin
- 2 tbsp olive oil
- Fresh lemon wedges
- Salt & pepper

### Steps
1. **Season chicken** with paprika, oregano, cumin, salt & pepper
2. **Sear chicken** skin-side down in olive oil for 5 minutes until crispy. Flip, cook 3 more minutes. Set aside
3. **Sauté onion & garlic** in the same pan for 2 minutes
4. **Add rice**, toast for 1 minute, then pour in chicken broth
5. **Place chicken on top** of rice, cover, and cook on low for 18-20 minutes
6. **Rest for 5 minutes**, then fluff rice and serve with lemon wedges 🍋

**Pro tip:** Adding a pinch of saffron to the broth gives it a gorgeous golden color! ✨`,

  default: [
    `Hey there! 👋 I'm **FoodieBot**, your personal kitchen companion! 🍳

I can help you with:
- 🍝 **Recipes** from any cuisine
- 💡 **Cooking tips** and kitchen hacks
- 🥗 **Meal planning** and healthy eating
- 🔄 **Ingredient substitutions**
- 🍽️ **Plating & presentation** ideas

What are you craving today? Just ask and I'll cook up something amazing for you! 😄`,

    `Great question! 😊 Here are some **quick kitchen tips** that every home cook should know:

- 🧂 **Season in layers** — add salt at each stage of cooking, not just at the end
- 🔪 **Sharp knife = safe knife** — a dull knife is more dangerous because you have to press harder
- 🍳 **Let your pan heat up** before adding food — patience = perfect sear
- 🧄 **Garlic burns fast** — always add it after onions, not before
- 🍋 **Acid brightens everything** — a squeeze of lemon or splash of vinegar at the end lifts any dish
- 🧈 **Butter makes it better** — a small knob at the end adds richness to sauces

Want me to share a specific recipe? Just tell me what ingredients you have! 🛒`,

    `Let me suggest some **amazing dinner ideas** for tonight! 🌙

1. 🍝 **Creamy Tuscan Chicken Pasta** — ready in 25 minutes
2. 🌮 **Fish Tacos** with mango salsa — fresh and zesty!
3. 🍛 **Thai Green Curry** — coconut milk, veggies, and fragrant herbs
4. 🥘 **Shakshuka** — eggs poached in spiced tomato sauce (great for dinner too!)
5. 🍕 **Homemade Flatbread Pizza** — faster than delivery!

Which one catches your eye? I'll give you the full recipe! 😄`,

    `Here's a fun **food fact** for you! 🤓

Did you know that **vanilla** is the second most expensive spice in the world after saffron? 🌿 Each vanilla bean is hand-pollinated, and it takes about 9 months to produce a single pod!

That's why pure vanilla extract is pricey — but SO worth it for baking. The difference between pure vanilla and imitation is like night and day 🌙☀️

Want to learn more food facts, or shall we dive into a recipe? 🍰`,

    `Looking for something **healthy but delicious**? Here are my top picks! 💪

- 🥑 **Mediterranean Bowl** — quinoa, roasted veggies, hummus, and feta
- 🥗 **Asian Sesame Salad** — crunchy cabbage, edamame, and sesame-ginger dressing
- 🍲 **Lentil Soup** — protein-packed, cozy, and so easy to make
- 🐟 **Baked Salmon** with roasted broccoli — 20 minutes, one pan!
- 🌯 **Turkey Lettuce Wraps** — all the flavor, fewer carbs

Eating healthy doesn't mean boring! Which one should we make? 😊`
  ]
};

function getFallbackResponse(message) {
  const msg = message.toLowerCase();

  if (msg.includes('pasta') || msg.includes('spaghetti') || msg.includes('noodle') || msg.includes('penne') || msg.includes('macaroni')) {
    return fallbackResponses.pasta;
  }
  if (msg.includes('breakfast') || msg.includes('morning') || msg.includes('brunch') || msg.includes('avocado') || msg.includes('toast') || msg.includes('egg')) {
    return fallbackResponses.breakfast;
  }
  if (msg.includes('indian') || msg.includes('curry') || msg.includes('butter chicken') || msg.includes('masala') || msg.includes('naan') || msg.includes('biryani') || msg.includes('tikka')) {
    return fallbackResponses.indian;
  }
  if ((msg.includes('chicken') && msg.includes('rice')) || msg.includes('one pot') || msg.includes('one-pot')) {
    return fallbackResponses.chicken_rice;
  }
  if (msg.includes('chicken') || msg.includes('poultry')) {
    return fallbackResponses.chicken_rice;
  }

  // Return a random default response
  const defaults = fallbackResponses.default;
  return defaults[Math.floor(Math.random() * defaults.length)];
}

// Track if API key works
let apiKeyValid = null; // null = untested, true/false after first call

app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get or create conversation history for this session
    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, []);
    }
    const history = conversations.get(sessionId);

    // Add user message to history
    history.push({ role: 'user', content: message });

    // Keep only last 20 messages to manage token usage
    const recentHistory = history.slice(-20);

    // Try OpenAI first if we haven't determined the key is bad
    if (apiKeyValid !== false) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...recentHistory,
          ],
          temperature: 0.7,
          max_tokens: 1000,
        });

        apiKeyValid = true;
        const assistantMessage = completion.choices[0].message.content;
        history.push({ role: 'assistant', content: assistantMessage });
        return res.json({ reply: assistantMessage });
      } catch (apiError) {
        console.warn('⚠️  OpenAI API unavailable, using built-in responses:', apiError.message);
        apiKeyValid = false;
      }
    }

    // Fallback: use built-in responses
    const fallbackReply = getFallbackResponse(message);
    history.push({ role: 'assistant', content: fallbackReply });
    res.json({ reply: fallbackReply });
  } catch (error) {
    console.error('Server error:', error.message);
    res.status(500).json({
      error: 'Something went wrong. Please try again.',
    });
  }
});

// Serve the frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🍕 FoodieBot server running on http://localhost:${PORT}`);
  console.log(`💡 Tip: If your OpenAI API key is invalid, built-in food responses will be used automatically.`);
});
