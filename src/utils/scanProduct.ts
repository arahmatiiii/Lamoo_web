import Anthropic from '@anthropic-ai/sdk';
import type { AiProvider } from '../store/useStore';

export interface ScanResult {
  name: string;
  category: 'گوشت' | 'سبزیجات' | 'لبنیات' | 'غلات' | 'میوه' | 'سایر';
  amount: string;
  unit: string;
  expiryDays: number;
  emoji: string;
  confidence: number;
}

const CATEGORIES = ['گوشت', 'سبزیجات', 'لبنیات', 'غلات', 'میوه', 'سایر'];

const PROMPT =
  'این عکس یک محصول غذایی است. محصول را شناسایی کن و اگر تاریخ انقضا روی بسته‌بندی دیده می‌شود آن را بخوان. ' +
  `تاریخ امروز: ${new Date().toISOString().slice(0, 10)}. ` +
  'فقط یک شیء JSON با دقیقاً این فیلدها برگردان و هیچ متن دیگری ننویس: ' +
  '{"name": نام محصول به فارسی, ' +
  `"category": یکی از [${CATEGORIES.map((c) => `"${c}"`).join('، ')}], ` +
  '"amount": مقدار به صورت رشته عددی مثل "500", ' +
  '"unit": واحد به فارسی مثل "گرم", ' +
  '"expiryDays": تعداد روز تا انقضا به صورت عدد صحیح (اگر تاریخ دیده نمی‌شود بر اساس نوع محصول تخمین بزن), ' +
  '"emoji": یک ایموجی مناسب, ' +
  '"confidence": عدد صحیح بین 0 تا 100}';

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
        'تعداد روز تا انقضا. اگر تاریخ انقضا روی محصول دیده می‌شود از آن حساب کن، وگرنه بر اساس نوع محصول تخمین بزن',
    },
    emoji: { type: 'string', description: 'یک ایموجی مناسب برای محصول' },
    confidence: { type: 'integer', description: 'میزان اطمینان تشخیص بین 0 تا 100' },
  },
  required: ['name', 'category', 'amount', 'unit', 'expiryDays', 'emoji', 'confidence'],
  additionalProperties: false,
} as const;

function parseScanJson(text: string): ScanResult {
  // Free models sometimes wrap JSON in code fences or add prose — extract the first object
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('پاسخ مدل قابل خواندن نبود. دوباره اسکن کنید.');
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new Error('پاسخ مدل قابل خواندن نبود. دوباره اسکن کنید.');
  }
  const category = CATEGORIES.includes(String(parsed.category))
    ? (String(parsed.category) as ScanResult['category'])
    : 'سایر';
  return {
    name: String(parsed.name ?? 'محصول ناشناخته'),
    category,
    amount: String(parsed.amount ?? '1'),
    unit: String(parsed.unit ?? 'عدد'),
    expiryDays: Number.isFinite(Number(parsed.expiryDays)) ? Math.max(0, Math.round(Number(parsed.expiryDays))) : 30,
    emoji: String(parsed.emoji ?? '🥫'),
    confidence: Number.isFinite(Number(parsed.confidence))
      ? Math.min(100, Math.max(0, Math.round(Number(parsed.confidence))))
      : 50,
  };
}

/**
 * Identify a food product (and, when visible, its expiry date) from a photo.
 * Runs entirely in the browser using the user's own key for the selected
 * provider — Gemini and OpenRouter both have free tiers for the testing phase.
 */
export async function scanProduct(
  provider: AiProvider,
  apiKey: string,
  jpegBase64: string
): Promise<ScanResult> {
  switch (provider) {
    case 'gemini':
      return scanWithGemini(apiKey, jpegBase64);
    case 'openrouter':
      return scanWithOpenRouter(apiKey, jpegBase64);
    case 'anthropic':
      return scanWithClaude(apiKey, jpegBase64);
  }
}

// --- Google Gemini (free tier at aistudio.google.com) ---
async function scanWithGemini(apiKey: string, jpegBase64: string): Promise<ScanResult> {
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
                { inline_data: { mime_type: 'image/jpeg', data: jpegBase64 } },
                { text: PROMPT },
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
  return parseScanJson(text);
}

// --- OpenRouter (free models via the openrouter/free auto-router) ---
async function scanWithOpenRouter(apiKey: string, jpegBase64: string): Promise<ScanResult> {
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
        // ones that accept image input
        model: 'openrouter/free',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${jpegBase64}` },
              },
              { type: 'text', text: PROMPT },
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
  return parseScanJson(text);
}

// --- Anthropic Claude (paid; best accuracy) ---
async function scanWithClaude(apiKey: string, jpegBase64: string): Promise<ScanResult> {
  const client = new Anthropic({
    apiKey,
    // Client-only PWA: the key belongs to the user and stays on their device.
    dangerouslyAllowBrowser: true,
  });

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 4096,
      betas: ['server-side-fallback-2026-07-01'],
      // Safety-classifier declines get rerouted server-side instead of failing the scan
      fallbacks: 'default',
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: scanSchema },
      },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: jpegBase64 },
            },
            { type: 'text', text: PROMPT },
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
    throw new Error('تصویر قابل پردازش نبود. عکس دیگری امتحان کنید.');
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('پاسخی از مدل دریافت نشد. دوباره امتحان کنید.');
  }
  return parseScanJson(textBlock.text);
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
