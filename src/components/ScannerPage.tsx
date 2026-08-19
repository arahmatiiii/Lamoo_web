import { useState, useEffect, useRef } from 'react';
import { X, Lightbulb, Camera, Image as ImageIcon, KeyRound } from 'lucide-react';
import { useStore, PantryItem, Category } from '../store/useStore';
import { scanProduct, frameToJpegBase64, ScanResult } from '../utils/ai';
import { fa, expiryLabel } from '../utils/format';

export default function ScannerPage() {
  const store = useStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [scanning, setScanning] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [added, setAdded] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const providerKey = {
    gemini: store.geminiApiKey,
    openrouter: store.openrouterApiKey,
    anthropic: store.anthropicApiKey,
  }[store.aiProvider];
  const hasApiKey = providerKey.trim().length > 0;

  useEffect(() => {
    let cancelled = false;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        if (!cancelled) setCameraError(true);
      }
    }
    startCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const toggleFlash = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !flashOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setFlashOn(next);
    } catch {
      /* device has no torch */
    }
  };

  const runScan = async (base64: string) => {
    setScanning(true);
    setScanError(null);
    setScanResult(null);
    setAdded(false);
    try {
      const result = await scanProduct(store.aiProvider, providerKey.trim(), base64);
      setScanResult(result);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'خطای ناشناخته. دوباره امتحان کنید.');
    } finally {
      setScanning(false);
    }
  };

  const handleCapture = () => {
    if (!hasApiKey || scanning) return;
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      fileInputRef.current?.click();
      return;
    }
    runScan(frameToJpegBase64(video));
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !hasApiKey) return;
    const img = new Image();
    img.onload = () => {
      runScan(frameToJpegBase64(img));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };

  const handleAddToStorage = () => {
    if (!scanResult) return;
    const newItem: PantryItem = {
      id: Date.now().toString(),
      name: scanResult.name,
      category: scanResult.category as Category,
      amount: scanResult.amount,
      unit: scanResult.unit,
      expiryDays: scanResult.expiryDays,
      emoji: scanResult.emoji,
      available: true,
    };
    store.addPantryItem(newItem);
    setAdded(true);
    setTimeout(() => {
      store.setActiveTab('pantry');
    }, 1200);
  };

  const handleReset = () => {
    setScanResult(null);
    setScanError(null);
    setAdded(false);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: '#000' }}>
      {/* Camera viewfinder — kept full-bleed and dark for legibility */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {!cameraError && (
          <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 w-full h-full object-cover" />
        )}

        {cameraError && (
          <div className="absolute inset-x-6 top-1/4 text-center text-sm leading-6 text-white/70">
            دسترسی به دوربین ممکن نیست.
            <br />
            می‌توانید از دکمه گالری پایین، عکس محصول را انتخاب کنید.
          </div>
        )}

        {/* Scanner frame */}
        <div className="relative w-64 h-48 pointer-events-none">
          <div className="scanner-frame-corner top-0 right-0 border-r-4 border-t-4 rounded-tr-lg" />
          <div className="scanner-frame-corner top-0 left-0 border-l-4 border-t-4 rounded-tl-lg" />
          <div className="scanner-frame-corner bottom-0 right-0 border-r-4 border-b-4 rounded-br-lg" />
          <div className="scanner-frame-corner bottom-0 left-0 border-l-4 border-b-4 rounded-bl-lg" />

          {scanning && (
            <div
              className="scanner-line absolute inset-x-4"
              style={{ height: 2, background: 'linear-gradient(90deg, transparent, #c67139, transparent)', boxShadow: '0 0 12px rgba(198,113,57,.8)', top: '50%' }}
            />
          )}
        </div>

        {!hasApiKey && (
          <div className="absolute inset-x-6 bottom-40">
            <button onClick={() => store.setActiveTab('settings')} className="callout callout-accent press w-full justify-center" style={{ boxShadow: 'var(--shadow-md)' }}>
              <KeyRound size={16} />
              برای اسکن، ابتدا کلید API را در تنظیمات وارد کنید
            </button>
          </div>
        )}

        {scanError && (
          <div className="absolute inset-x-6 bottom-40">
            <div className="callout callout-accent text-center justify-center" style={{ boxShadow: 'var(--shadow-md)' }}>{scanError}</div>
          </div>
        )}

        <div
          className="absolute bottom-24 text-sm text-center font-semibold px-4 py-2 rounded-full"
          style={{ background: 'rgba(245,234,216,.16)', color: '#f5ead8', backdropFilter: 'blur(4px)' }}
        >
          {scanning ? (
            <span className="flex items-center gap-2">
              <span className="dot-1 w-2 h-2 rounded-full bg-white inline-block" />
              <span className="dot-2 w-2 h-2 rounded-full bg-white inline-block" />
              <span className="dot-3 w-2 h-2 rounded-full bg-white inline-block" />
              در حال تشخیص با هوش مصنوعی...
            </span>
          ) : (
            'محصول یا تاریخ انقضا را بگیرید'
          )}
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelected} />

      {/* Bottom controls — warm chrome */}
      <div
        className="px-6 pt-4 flex items-center justify-between"
        style={{ background: 'var(--bg)', paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center gap-3">
          <button onClick={toggleFlash} className="icon-btn press" style={{ background: flashOn ? 'var(--accent)' : 'var(--card)' }}>
            <Lightbulb size={19} style={{ color: flashOn ? '#fff' : 'var(--neutral-600)' }} />
          </button>
          <button onClick={() => hasApiKey && !scanning && fileInputRef.current?.click()} className="icon-btn press">
            <ImageIcon size={19} style={{ color: 'var(--neutral-600)' }} />
          </button>
        </div>

        <button
          onClick={handleCapture}
          disabled={scanning || !hasApiKey}
          className="press flex items-center justify-center rounded-full"
          style={{
            width: 64,
            height: 64,
            background: scanning ? 'var(--accent-600)' : hasApiKey ? 'var(--accent)' : 'var(--neutral-300)',
            boxShadow: hasApiKey ? '0 0 24px rgba(198,113,57,.5)' : 'none',
          }}
        >
          <Camera size={24} className="text-white" />
        </button>

        <button onClick={() => store.setActiveTab('pantry')} className="icon-btn press">
          <X size={19} style={{ color: 'var(--neutral-600)' }} />
        </button>
      </div>

      {/* Result sheet */}
      {scanResult && (
        <div className="bottom-sheet-overlay" onClick={handleReset}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />

            <div className="px-6 pb-8" style={{ paddingTop: 12 }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="rounded-full" style={{ width: 8, height: 8, background: 'var(--sage)' }} />
                <span className="text-xs font-bold" style={{ color: 'var(--sage-700)' }}>
                  اطمینان: {fa(scanResult.confidence)}٪
                </span>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">{scanResult.emoji || '📷'}</span>
                <h2 className="font-bold" style={{ fontSize: 22, color: 'var(--text)' }}>نتیجه اسکن</h2>
              </div>

              <div className="card-lg mb-4" style={{ padding: '4px 18px' }}>
                {[
                  { label: 'نام', value: scanResult.name },
                  { label: 'مقدار', value: `${scanResult.amount} ${scanResult.unit}` },
                  { label: 'انقضا', value: `✓ ${expiryLabel(scanResult.expiryDays)}`, color: 'var(--sage-700)' },
                  { label: 'دسته', value: scanResult.category },
                ].map((row, idx) => (
                  <div key={idx} className="flex items-center justify-between divider-row" style={{ padding: '13px 0' }}>
                    <span className="text-sm" style={{ color: 'var(--neutral-600)', width: 64 }}>{row.label}</span>
                    <span className="text-sm font-bold" style={{ color: row.color || 'var(--text)' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {added ? (
                <div className="callout callout-sage text-center justify-center">✅ به انبار اضافه شد!</div>
              ) : (
                <div className="space-y-3">
                  <button className="btn-primary" onClick={handleAddToStorage}>
                    افزودن به انبار
                  </button>
                  <button className="w-full text-center text-sm py-2 press" style={{ color: 'var(--neutral-600)' }} onClick={handleReset}>
                    اسکن مجدد
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
