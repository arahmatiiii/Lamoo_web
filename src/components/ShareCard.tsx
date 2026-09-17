import { useEffect, useRef, useState } from 'react';
import { X, ImagePlus, Download, Share2 } from 'lucide-react';
import type { Recipe } from '../store/useStore';
import { fa } from '../utils/format';

const W = 1080;
const H = 1920;

/** Draw the photo cropped to fill, so it never squashes. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * A story-shaped card of the cook's own photo. Deliberately just an image to
 * share elsewhere — no feed, no accounts, nothing social inside the app.
 */
export default function ShareCard({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cancelled = false;
    const render = async () => {
      // Wait for Vazirmatn, or the Persian text falls back to a system font.
      await document.fonts?.ready;
      if (cancelled) return;

      if (photo) {
        drawCover(ctx, photo);
      } else {
        ctx.fillStyle = '#ebddc5';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#c0b6a5';
        ctx.font = '500 52px Vazirmatn, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('عکس غذات رو اضافه کن', W / 2, H / 2);
      }

      // Warm gradient so the text stays readable over any photo.
      const grad = ctx.createLinearGradient(0, H * 0.35, 0, H);
      grad.addColorStop(0, 'rgba(28,23,18,0)');
      grad.addColorStop(1, 'rgba(28,23,18,0.88)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      ctx.textAlign = 'right';
      ctx.direction = 'rtl';

      // Badge
      const badge = 'با لامو پختم';
      ctx.font = '700 40px Vazirmatn, sans-serif';
      const badgeW = ctx.measureText(badge).width + 64;
      ctx.fillStyle = '#c67139';
      roundRect(ctx, W - 88 - badgeW, H - 620, badgeW, 84, 42);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(badge, W - 120, H - 565);

      // Recipe name
      ctx.fillStyle = '#f9f4ed';
      ctx.font = '800 92px Vazirmatn, sans-serif';
      ctx.fillText(recipe.name, W - 88, H - 420);

      // Meta
      ctx.fillStyle = 'rgba(249,244,237,0.82)';
      ctx.font = '500 44px Vazirmatn, sans-serif';
      ctx.fillText(
        `${fa(recipe.timeMinutes)} دقیقه · برای ${fa(recipe.servings)} نفر`,
        W - 88,
        H - 330
      );

      // Wordmark
      ctx.fillStyle = 'rgba(249,244,237,0.55)';
      ctx.font = '700 38px Vazirmatn, sans-serif';
      ctx.fillText('لامو', W - 88, H - 180);

      if (!cancelled) setPreview(canvas.toDataURL('image/jpeg', 0.9));
    };

    render();
    return () => {
      cancelled = true;
    };
  }, [photo, recipe]);

  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const img = new Image();
    img.onload = () => setPhoto(img);
    img.src = URL.createObjectURL(file);
  };

  const share = async () => {
    const canvas = canvasRef.current;
    if (!canvas || busy) return;
    setBusy(true);
    try {
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
      if (!blob) return;
      const file = new File([blob], `lamoo-${recipe.name}.jpg`, { type: 'image/jpeg' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
      // No share sheet (desktop, or an unsupported browser) — save it instead.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* the user dismissed the share sheet */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bottom-sheet-overlay" style={{ zIndex: 60 }} onClick={onClose}>
      <div className="bottom-sheet" style={{ zIndex: 61 }} onClick={(e) => e.stopPropagation()}>
        <div className="bottom-sheet-handle" />
        <div className="px-6 pb-8" style={{ paddingTop: 12 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold" style={{ fontSize: 21, color: 'var(--text)' }}>با لامو پختم</h2>
            <button className="sheet-close press" onClick={onClose}>
              <X size={17} />
            </button>
          </div>

          <canvas ref={canvasRef} width={W} height={H} style={{ display: 'none' }} />
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickPhoto} />

          {preview && (
            <img
              src={preview}
              alt=""
              className="w-full mb-4"
              style={{ borderRadius: 24, aspectRatio: '9 / 16', objectFit: 'cover' }}
            />
          )}

          <div className="space-y-3">
            <button
              className="btn-ghost flex items-center justify-center gap-2"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus size={17} />
              {photo ? 'عکس دیگه' : 'عکس غذات رو انتخاب کن'}
            </button>
            <button className="btn-primary flex items-center justify-center gap-2" onClick={share} disabled={busy}>
              {navigator.canShare ? <Share2 size={17} /> : <Download size={17} />}
              {navigator.canShare ? 'هم‌رسانی' : 'ذخیره عکس'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
