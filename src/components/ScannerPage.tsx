import { useState, useEffect, useRef } from 'react';
import { X, Lightbulb, Camera, Image as ImageIcon, KeyRound } from 'lucide-react';
import { useStore, PantryItem, Category } from '../store/useStore';
import { scanProduct, frameToJpegBase64, ScanResult } from '../utils/scanProduct';

function toPersianNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
}

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

  // Start the rear camera on mount, stop it on unmount
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
      // Torch is Android-only and not in the standard TS lib types
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
      {/* Camera viewfinder */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Live camera preview */}
        {!cameraError && (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {cameraError && (
          <div className="absolute inset-x-6 top-1/4 text-center text-sm text-gray-400 leading-6">
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
              style={{
                height: '2px',
                background: 'linear-gradient(90deg, transparent, #10b981, transparent)',
                boxShadow: '0 0 12px rgba(16,185,129,0.8)',
                top: '50%',
              }}
            />
          )}
        </div>

        {/* Missing API key notice */}
        {!hasApiKey && (
          <div className="absolute inset-x-6 bottom-40">
            <button
              onClick={() => store.setActiveTab('settings')}
              className="w-full alert-banner alert-warn justify-center"
            >
              <KeyRound size={16} />
              برای اسکن، ابتدا کلید API را در تنظیمات وارد کنید
            </button>
          </div>
        )}

        {/* Scan error */}
        {scanError && (
          <div className="absolute inset-x-6 bottom-40">
            <div className="alert-banner alert-danger justify-center text-center">{scanError}</div>
          </div>
        )}

        {/* Instruction */}
        <div className="absolute bottom-24 text-sm text-center" style={{ color: '#10b981' }}>
          {scanning ? (
            <span className="flex items-center gap-2">
              <span className="dot-1 w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span className="dot-2 w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span className="dot-3 w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              در حال تشخیص با هوش مصنوعی...
            </span>
          ) : (
            'محصول یا تاریخ انقضا را بگیرید'
          )}
        </div>
      </div>

      {/* Hidden gallery input (also the fallback when camera is unavailable) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      {/* Bottom controls */}
      <div
        className="px-6 pt-4 flex items-center justify-between"
        style={{ background: '#000', paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={toggleFlash}
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: flashOn ? '#f59e0b' : '#1f2937' }}
          >
            <Lightbulb size={20} style={{ color: flashOn ? '#000' : '#9ca3af' }} />
          </button>
          <button
            onClick={() => hasApiKey && !scanning && fileInputRef.current?.click()}
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: '#1f2937' }}
          >
            <ImageIcon size={20} className="text-gray-400" />
          </button>
        </div>

        <button
          onClick={handleCapture}
          disabled={scanning || !hasApiKey}
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            background: scanning ? '#059669' : hasApiKey ? '#10b981' : '#374151',
            boxShadow: hasApiKey ? '0 0 24px rgba(16,185,129,0.5)' : 'none',
          }}
        >
          <Camera size={24} className="text-black" />
        </button>

        <button
          onClick={() => store.setActiveTab('pantry')}
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: '#1f2937' }}
        >
          <X size={20} className="text-gray-400" />
        </button>
      </div>

      {/* Result sheet */}
      {scanResult && (
        <div className="bottom-sheet-overlay" onClick={handleReset}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />

            <div className="px-5 pb-8 space-y-4">
              {/* Confidence */}
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: '#10b981' }} />
                <span className="text-xs font-semibold" style={{ color: '#10b981' }}>
                  اطمینان: {toPersianNum(scanResult.confidence)}٪
                </span>
              </div>

              {/* Title */}
              <div className="flex items-center gap-2">
                <span className="text-xl">{scanResult.emoji || '📷'}</span>
                <h2 className="text-xl font-bold text-white">نتیجه اسکن</h2>
              </div>

              {/* Info table */}
              <div className="card space-y-0">
                {[
                  { label: 'نام', value: scanResult.name },
                  { label: 'مقدار', value: `${scanResult.amount} ${scanResult.unit}` },
                  {
                    label: 'انقضا',
                    value: `✓ روز ${toPersianNum(scanResult.expiryDays)}`,
                    color: '#10b981',
                  },
                  { label: 'دسته', value: scanResult.category },
                ].map((row, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-3"
                    style={{ borderBottom: idx < 3 ? '1px solid #1e2d3d' : 'none' }}
                  >
                    <span className="text-sm text-gray-400 w-16">{row.label}</span>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: row.color || '#f9fafb' }}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Buttons */}
              {added ? (
                <div className="alert-banner alert-success text-center">
                  ✅ به انبار اضافه شد!
                </div>
              ) : (
                <>
                  <button className="btn-primary" onClick={handleAddToStorage}>
                    افزودن به انبار
                  </button>
                  <button
                    className="w-full text-center text-sm text-gray-400 py-2"
                    onClick={handleReset}
                  >
                    اسکن مجدد
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
