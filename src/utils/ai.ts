import Anthropic from '@anthropic-ai/sdk';
import type { AiProvider, PantryItem, Recipe, RecipeIngredient } from '../store/useStore';

// ---------------------------------------------------------------------------
// Shared provider call: send a prompt (optionally with an image) to the
// selected provider and get the raw text answer back. Runs entirely in the
// browser with the user's own key.
// ---------------------------------------------------------------------------

interface AiRequest {
  prompt: string;
  imageBase64?: string;
  /** JSON schema enforced on providers that support structured output */
  schema?: object;
}

async function aiJson(
  provider: AiProvider,
  apiKey: string,
  req: AiRequest,
  model?: string,
  ollamaProxyUrl?: string
): Promise<string> {
  switch (provider) {
    case 'gemini':
      return callGemini(apiKey, req);
    case 'openrouter':
      return callOpenRouter(apiKey, req);
    case 'anthropic':
      return callClaude(apiKey, req);
    case 'ollama':
      return callOllama(apiKey, model || 'gpt-oss:20b-cloud', req, ollamaProxyUrl);
  }
}

// --- Google Gemini (free tier at aistudio.google.com) ---
async function callGemini(apiKey: string, req: AiRequest): Promise<string> {
  let res: Response;
  try {
    res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                ...(req.imageBase64
                  ? [{ inline_data: { mime_type: 'image/jpeg', data: req.imageBase64 } }]
                  : []),
                { text: req.prompt },
              ],
            },
          ],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );
  } catch {
    throw new Error('اتصال به سرور برقرار نشد. اینترنت (یا VPN) خود را بررسی کنید.');
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    throw new Error('کلید API جمینای نامعتبر است. آن را در تنظیمات بررسی کنید.');
  }
  if (res.status === 429) {
    throw new Error('سهمیه رایگان جمینای فعلاً پر شده. یک دقیقه صبر کنید.');
  }
  if (!res.ok) {
    throw new Error(`خطای سرویس جمینای (${res.status}). دوباره امتحان کنید.`);
  }
  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? '')
    .join('');
  if (!text) throw new Error('پاسخی از مدل دریافت نشد. دوباره امتحان کنید.');
  return text;
}

// --- OpenRouter (free models via the openrouter/free auto-router) ---
async function callOpenRouter(apiKey: string, req: AiRequest): Promise<string> {
  let res: Response;
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Title': 'Lamoo Kitchen',
      },
      body: JSON.stringify({
        // Auto-router over the currently available free models, filtered to
        // the capabilities the request needs (e.g. image input)
        model: 'openrouter/free',
        messages: [
          {
            role: 'user',
            content: [
              ...(req.imageBase64
                ? [
                    {
                      type: 'image_url',
                      image_url: { url: `data:image/jpeg;base64,${req.imageBase64}` },
                    },
                  ]
                : []),
              { type: 'text', text: req.prompt },
            ],
          },
        ],
      }),
    });
  } catch {
    throw new Error('اتصال به سرور برقرار نشد. اینترنت (یا VPN) خود را بررسی کنید.');
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error('کلید API اوپن‌روتر نامعتبر است. آن را در تنظیمات بررسی کنید.');
  }
  if (res.status === 429) {
    throw new Error('سهمیه رایگان اوپن‌روتر امروز پر شده. بعداً امتحان کنید.');
  }
  if (!res.ok) {
    throw new Error(`خطای سرویس اوپن‌روتر (${res.status}). دوباره امتحان کنید.`);
  }
  const data = await res.json();
  const text: string | undefined = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('پاسخی از مدل دریافت نشد. دوباره امتحان کنید.');
  return text;
}

// --- Ollama Cloud (free-tier cloud models, e.g. gpt-oss:20b-cloud) ---
// Ollama's cloud API sends no CORS headers, so the browser can't call it
// directly — every request must go through a same-purpose proxy (see
// cloudflare-worker/ollama-proxy.js) that adds CORS headers back.
async function callOllama(
  apiKey: string,
  model: string,
  req: AiRequest,
  proxyUrl: string | undefined
): Promise<string> {
  const endpoint = proxyUrl?.trim();
  if (!endpoint) {
    throw new Error(
      'برای اولاما ابتدا باید آدرس پراکسی را در تنظیمات وارد کنید (سرور اولاما مستقیماً از مرورگر قابل دسترس نیست). راهنما: cloudflare-worker/README.md'
    );
  }
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        stream: false,
        ...(req.schema ? { format: req.schema } : { format: 'json' }),
        messages: [
          {
            role: 'user',
            content: req.prompt,
            ...(req.imageBase64 ? { images: [req.imageBase64] } : {}),
          },
        ],
      }),
    });
  } catch {
    throw new Error('اتصال به سرور برقرار نشد. اینترنت (یا VPN) خود را بررسی کنید.');
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error('کلید API اولاما نامعتبر است. آن را در تنظیمات بررسی کنید.');
  }
  if (res.status === 404) {
    throw new Error('مدل انتخاب‌شده در اولاما پیدا نشد. نام مدل را در تنظیمات بررسی کنید.');
  }
  if (res.status === 429) {
    throw new Error('سهمیه رایگان اولاما فعلاً پر شده. کمی بعد دوباره امتحان کنید.');
  }
  if (!res.ok) {
    throw new Error(`خطای سرویس اولاما (${res.status}). دوباره امتحان کنید.`);
  }
  const data = await res.json();
  const text: string | undefined = data?.message?.content;
  if (!text) throw new Error('پاسخی از مدل دریافت نشد. دوباره امتحان کنید.');
  return text;
}

// --- Anthropic Claude (paid; best accuracy) ---
async function callClaude(apiKey: string, req: AiRequest): Promise<string> {
  const client = new Anthropic({
    apiKey,
    // Client-only PWA: the key belongs to the user and stays on their device.
    dangerouslyAllowBrowser: true,
  });

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 8192,
      betas: ['server-side-fallback-2026-07-01'],
      // Safety-classifier declines get rerouted server-side instead of failing
      fallbacks: 'default',
      output_config: {
        effort: 'low',
        ...(req.schema ? { format: { type: 'json_schema', schema: req.schema } } : {}),
      },
      messages: [
        {
          role: 'user',
          content: [
            ...(req.imageBase64
              ? [
                  {
                    type: 'image' as const,
                    source: {
                      type: 'base64' as const,
                      media_type: 'image/jpeg' as const,
                      data: req.imageBase64,
                    },
                  },
                ]
              : []),
            { type: 'text' as const, text: req.prompt },
          ],
        },
      ],
    } as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new Error('کلید API نامعتبر است. آن را در تنظیمات بررسی کنید.');
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new Error('محدودیت تعداد درخواست. کمی صبر کنید و دوباره امتحان کنید.');
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new Error('اتصال به سرور برقرار نشد. اینترنت خود را بررسی کنید.');
    }
    if (err instanceof Anthropic.APIError) {
      throw new Error(`خطای سرویس هوش مصنوعی (${err.status ?? '؟'}). دوباره امتحان کنید.`);
    }
    throw err;
  }

  if (response.stop_reason === 'refusal') {
    throw new Error('درخواست قابل پردازش نبود. دوباره امتحان کنید.');
  }
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('پاسخی از مدل دریافت نشد. دوباره امتحان کنید.');
  }
  return textBlock.text;
}

// ---------------------------------------------------------------------------
// Lenient JSON extraction — free models often wrap JSON in code fences/prose
// ---------------------------------------------------------------------------

function extractJson(text: string, expectArray: boolean): unknown {
  const re = expectArray ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
  const match = text.match(re);
  if (!match) throw new Error('پاسخ مدل قابل خواندن نبود. دوباره امتحان کنید.');
  try {
    return JSON.parse(match[0]);
  } catch {
    throw new Error('پاسخ مدل قابل خواندن نبود. دوباره امتحان کنید.');
  }
}

// ---------------------------------------------------------------------------
// Pantry matching — used to mark which recipe ingredients the user has
// ---------------------------------------------------------------------------

export function ingredientInPantry(pantryItems: PantryItem[], ingName: string): boolean {
  const n = ingName.trim();
  return pantryItems.some(
    (p) => p.available && (p.name.includes(n) || n.includes(p.name.split('(')[0].trim()))
  );
}

// ---------------------------------------------------------------------------
// Product scan (camera / gallery photo → pantry item fields)
// ---------------------------------------------------------------------------

export interface ScanResult {
  name: string;
  category: 'گوشت' | 'سبزیجات' | 'لبنیات' | 'غلات' | 'میوه' | 'سایر';
  amount: string;
  unit: string;
  /** Undefined when no expiry date was visible on the packaging — never guessed */
  expiryDays?: number;
  emoji: string;
  confidence: number;
}

const CATEGORIES = ['گوشت', 'سبزیجات', 'لبنیات', 'غلات', 'میوه', 'سایر'];

const scanSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'نام محصول به فارسی' },
    category: { type: 'string', enum: CATEGORIES },
    amount: { type: 'string', description: 'مقدار/وزن محصول، فقط عدد مثل "500"' },
    unit: { type: 'string', description: 'واحد به فارسی مثل گرم، لیتر، عدد' },
    expiryDays: {
      type: 'integer',
      description:
        'تعداد روز تا انقضا، فقط اگر تاریخ روی بسته‌بندی واقعاً دیده می‌شود. اگر تاریخ دیده نمی‌شود، دقیقاً -1 برگردان — هرگز حدس نزن.',
    },
    emoji: { type: 'string', description: 'یک ایموجی مناسب برای محصول' },
    confidence: { type: 'integer', description: 'میزان اطمینان تشخیص بین 0 تا 100' },
  },
  required: ['name', 'category', 'amount', 'unit', 'expiryDays', 'emoji', 'confidence'],
  additionalProperties: false,
} as const;

export async function scanProduct(
  provider: AiProvider,
  apiKey: string,
  jpegBase64: string,
  model?: string,
  ollamaProxyUrl?: string
): Promise<ScanResult> {
  const prompt =
    'این عکس یک محصول غذایی است. محصول را شناسایی کن و اگر تاریخ انقضا روی بسته‌بندی دیده می‌شود آن را بخوان. ' +
    `تاریخ امروز: ${new Date().toISOString().slice(0, 10)}. ` +
    'فقط یک شیء JSON با دقیقاً این فیلدها برگردان و هیچ متن دیگری ننویس: ' +
    '{"name": نام محصول به فارسی, ' +
    `"category": یکی از [${CATEGORIES.map((c) => `"${c}"`).join('، ')}], ` +
    '"amount": مقدار به صورت رشته عددی مثل "500", ' +
    '"unit": واحد به فارسی مثل "گرم", ' +
    '"expiryDays": تعداد روز تا انقضا به صورت عدد صحیح، فقط اگر تاریخ روی بسته‌بندی واقعاً خوانا است. ' +
    'اگر تاریخ انقضا روی بسته‌بندی دیده نمی‌شود یا نامشخص است، دقیقاً عدد -1 را برگردان و به هیچ‌وجه حدس نزن. ' +
    '"emoji": یک ایموجی مناسب, ' +
    '"confidence": عدد صحیح بین 0 تا 100}';

  const text = await aiJson(
    provider,
    apiKey,
    { prompt, imageBase64: jpegBase64, schema: scanSchema },
    model,
    ollamaProxyUrl
  );
  return parseScanResult(extractJson(text, false));
}

/** Normalise a model's scan JSON into a ScanResult, never trusting it blindly. */
export function parseScanResult(parsed: unknown): ScanResult {
  const p = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
  const category = CATEGORIES.includes(String(p.category))
    ? (String(p.category) as ScanResult['category'])
    : 'سایر';
  const name = typeof p.name === 'string' && p.name.trim() ? p.name.trim() : '';
  if (!name) throw new Error('محصول شناسایی نشد. دوباره امتحان کنید.');

  const expiry = Number(p.expiryDays);
  return {
    name,
    category,
    amount: typeof p.amount === 'string' || typeof p.amount === 'number' ? String(p.amount).trim() : '',
    unit: typeof p.unit === 'string' && p.unit.trim() ? p.unit.trim() : 'عدد',
    // Negative is the model's "I could not read a date" sentinel — never guess.
    expiryDays: Number.isFinite(expiry) && expiry >= 0 ? Math.min(3650, Math.round(expiry)) : undefined,
    emoji: typeof p.emoji === 'string' && p.emoji.trim() ? p.emoji.trim() : '🥫',
    confidence: Number.isFinite(Number(p.confidence))
      ? Math.min(100, Math.max(0, Math.round(Number(p.confidence))))
      : 50,
  };
}

// ---------------------------------------------------------------------------
// Recipe suggestions ("چی بپزم؟" + the add-recipe form)
// ---------------------------------------------------------------------------

const RECIPE_CATEGORIES = ['سالاد', 'سوپ', 'کباب', 'خورشت', 'پلو', 'سایر'];

const recipesSchema = {
  type: 'object',
  properties: {
    recipes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          emoji: { type: 'string' },
          category: { type: 'string', enum: RECIPE_CATEGORIES },
          calories: { type: 'integer' },
          servings: { type: 'integer' },
          timeMinutes: { type: 'integer' },
          ingredients: { type: 'array', items: { type: 'string' } },
          steps: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'emoji', 'category', 'calories', 'servings', 'timeMinutes', 'ingredients', 'steps'],
        additionalProperties: false,
      },
    },
  },
  required: ['recipes'],
  additionalProperties: false,
} as const;

/**
 * Ask the AI for several complete recipes matching the user's request, with
 * full ingredients and steps. Availability is computed locally against the
 * pantry.
 */
export async function suggestRecipes(
  provider: AiProvider,
  apiKey: string,
  query: string,
  pantryItems: PantryItem[],
  model?: string,
  ollamaProxyUrl?: string
): Promise<Recipe[]> {
  const pantryList = pantryItems
    .filter((p) => p.available)
    .map((p) => p.name)
    .join('، ');

  const prompt =
    `تو یک سرآشپز ایرانی حرفه‌ای و مشاور یک اپ آشپزی هستی. کاربر نوشته: «${query}». ` +
    `مواد موجود در انبار خانه‌اش: ${pantryList || 'نامشخص'}. ` +
    'شش دستور پخت کامل، متنوع و واقعی (نه تخیلی) پیشنهاد بده که واقعاً در آشپزی ایرانی یا بین‌المللی شناخته‌شده باشند ' +
    'و تا حد امکان با مواد موجودش قابل پخت باشند. در انتخاب دستورها تنوع را رعایت کن (سبک‌های پخت، مواد اصلی و زمان پخت متفاوت). ' +
    'مواد لازم و مراحل پخت باید دقیق، واقع‌بینانه و کامل باشند — انگار از یک کتاب آشپزی معتبر می‌آیند، نه حدسی و سطحی. ' +
    'فقط یک شیء JSON برگردان و هیچ متن دیگری ننویس، دقیقاً با این ساختار: ' +
    '{"recipes": [{' +
    '"name": نام غذا به فارسی, ' +
    '"emoji": یک ایموجی مناسب, ' +
    `"category": یکی از [${RECIPE_CATEGORIES.map((c) => `"${c}"`).join('، ')}], ` +
    '"calories": کالری هر وعده به صورت عدد صحیح, ' +
    '"servings": تعداد نفرات به صورت عدد صحیح, ' +
    '"timeMinutes": زمان پخت به دقیقه به صورت عدد صحیح, ' +
    '"ingredients": آرایه‌ای از نام مواد لازم به فارسی (فقط نام، بدون مقدار), ' +
    '"steps": آرایه‌ای از مراحل کامل پخت به فارسی' +
    '}]}';

  const text = await aiJson(provider, apiKey, { prompt, schema: recipesSchema }, model, ollamaProxyUrl);
  const recipes = parseRecipeSuggestions(extractJson(text, false), pantryItems);
  if (recipes.length === 0) throw new Error('پیشنهادی دریافت نشد. دوباره امتحان کنید.');
  return recipes;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Turn a model's JSON into recipes, dropping any entry that isn't actually a
 * usable recipe. A hallucinated or truncated answer should yield fewer
 * suggestions — never a half-empty recipe saved into the user's book.
 */
export function parseRecipeSuggestions(parsed: unknown, pantryItems: PantryItem[]): Recipe[] {
  const list = (parsed as { recipes?: unknown })?.recipes;
  if (!Array.isArray(list)) return [];

  return list
    .slice(0, 6)
    .map((raw, idx): Recipe | null => {
      if (!raw || typeof raw !== 'object') return null;
      const r = raw as Record<string, unknown>;

      const name = typeof r.name === 'string' ? r.name.trim() : '';
      const ingredients: RecipeIngredient[] = (Array.isArray(r.ingredients) ? r.ingredients : [])
        .filter((i) => typeof i === 'string')
        .map((i) => (i as string).trim())
        .filter(Boolean)
        .map((n) => ({ name: n, available: ingredientInPantry(pantryItems, n) }));
      const steps = (Array.isArray(r.steps) ? r.steps : [])
        .filter((s) => typeof s === 'string')
        .map((s) => (s as string).trim())
        .filter(Boolean);

      // A recipe without a name, ingredients or steps is not cookable.
      if (!name || ingredients.length === 0 || steps.length === 0) return null;

      const availableCount = ingredients.filter((i) => i.available).length;
      const category = RECIPE_CATEGORIES.includes(String(r.category)) ? String(r.category) : 'سایر';
      return {
        id: `${Date.now()}-${idx}`,
        name,
        emoji: typeof r.emoji === 'string' && r.emoji.trim() ? r.emoji.trim() : '🍽️',
        calories: clampInt(r.calories, 0, 5000, 0),
        servings: clampInt(r.servings, 1, 20, 2),
        timeMinutes: clampInt(r.timeMinutes, 1, 1440, 30),
        availabilityPercent: Math.round((availableCount / ingredients.length) * 100),
        ingredients,
        steps,
        tags: [category],
        category,
      };
    })
    .filter((r): r is Recipe => r !== null);
}

/** Downscale a captured frame and return raw base64 JPEG (no data: prefix). */
export function frameToJpegBase64(source: HTMLVideoElement | HTMLImageElement, maxEdge = 1568): string {
  const srcW = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const srcH = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(srcW * scale);
  canvas.height = Math.round(srcH * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}
