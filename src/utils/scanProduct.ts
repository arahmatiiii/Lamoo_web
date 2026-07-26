import Anthropic from '@anthropic-ai/sdk';

export interface ScanResult {
  name: string;
  category: 'گوشت' | 'سبزیجات' | 'لبنیات' | 'غلات' | 'میوه' | 'سایر';
  amount: string;
  unit: string;
  expiryDays: number;
  emoji: string;
  confidence: number;
}

const scanSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'نام محصول به فارسی' },
    category: { type: 'string', enum: ['گوشت', 'سبزیجات', 'لبنیات', 'غلات', 'میوه', 'سایر'] },
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

/**
 * Identify a food product (and, when visible, its expiry date) from a photo.
 * Runs entirely in the browser against the Claude API using the user's own key.
 */
export async function scanProduct(apiKey: string, jpegBase64: string): Promise<ScanResult> {
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
            {
              type: 'text',
              text:
                'این عکس یک محصول غذایی است. محصول را شناسایی کن و اگر تاریخ انقضا روی بسته‌بندی دیده می‌شود آن را بخوان. ' +
                `تاریخ امروز: ${new Date().toISOString().slice(0, 10)}. ` +
                'نتیجه را مطابق اسکیمای خواسته‌شده برگردان.',
            },
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

  try {
    return JSON.parse(textBlock.text) as ScanResult;
  } catch {
    throw new Error('پاسخ مدل قابل خواندن نبود. دوباره اسکن کنید.');
  }
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
