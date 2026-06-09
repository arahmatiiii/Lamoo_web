import { useState, useEffect } from 'react';
import { X, Lightbulb, Camera } from 'lucide-react';
import { useStore, PantryItem } from '../store/useStore';

const mockScanResults = [
  { name: 'ماست یونانی', amount: '500', unit: 'گرم', expiryDays: 14, category: 'لبنیات', emoji: '🥛', confidence: 92 },
  { name: 'شیر پاستوریزه', amount: '1', unit: 'لیتر', expiryDays: 5, category: 'لبنیات', emoji: '🥛', confidence: 88 },
  { name: 'پنیر سفید', amount: '200', unit: 'گرم', expiryDays: 10, category: 'لبنیات', emoji: '🧀', confidence: 95 },
];

export default function ScannerPage() {
  const store = useStore();
  const [scanning, setScanning] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [added, setAdded] = useState(false);

  // Auto-scan simulation
  useEffect(() => {
    if (scanning) {
      const timer = setTimeout(() => {
        const result = mockScanResults[Math.floor(Math.random() * mockScanResults.length)];
        setScanResult(result);
        setScanning(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [scanning]);

  function toPersianNum(n: number): string {
    return n.toString().replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
  }

  const handleAddToStorage = () => {
    if (!scanResult) return;
    const newItem: PantryItem = {
      id: Date.now().toString(),
      name: scanResult.name,
      category: scanResult.category as any,
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
    setAdded(false);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: '#000' }}>
      {/* Camera viewfinder */}
      <div className="flex-1 relative flex items-center justify-center">
        {/* Grid overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(16,185,129,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(16,185,129,0.05) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Scanner frame */}
        <div className="relative w-64 h-48">
          {/* Corners */}
          <div className="scanner-frame-corner top-0 right-0 border-r-4 border-t-4 rounded-tr-lg" />
          <div className="scanner-frame-corner top-0 left-0 border-l-4 border-t-4 rounded-tl-lg" />
          <div className="scanner-frame-corner bottom-0 right-0 border-r-4 border-b-4 rounded-br-lg" />
          <div className="scanner-frame-corner bottom-0 left-0 border-l-4 border-b-4 rounded-bl-lg" />

          {/* Scan line */}
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

        {/* Instruction */}
        <div
          className="absolute bottom-24 text-sm text-center"
          style={{ color: '#10b981' }}
        >
          {scanning ? (
            <span className="flex items-center gap-2">
              <span className="dot-1 w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span className="dot-2 w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span className="dot-3 w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              در حال اسکن...
            </span>
          ) : (
            'محصول یا تاریخ انقضا را بگیرید'
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="px-6 pb-8 pt-4 flex items-center justify-between" style={{ background: '#000' }}>
        <button
          onClick={() => setFlashOn(!flashOn)}
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: flashOn ? '#f59e0b' : '#1f2937' }}
        >
          <Lightbulb size={20} style={{ color: flashOn ? '#000' : '#9ca3af' }} />
        </button>

        <button
          onClick={() => {
            setScanning(true);
            setScanResult(null);
            setAdded(false);
          }}
          disabled={scanning}
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            background: scanning ? '#059669' : '#10b981',
            boxShadow: '0 0 24px rgba(16,185,129,0.5)',
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
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: '#10b981' }}
                />
                <span className="text-xs font-semibold" style={{ color: '#10b981' }}>
                  اطمینان: {toPersianNum(scanResult.confidence)}٪
                </span>
              </div>

              {/* Title */}
              <div className="flex items-center gap-2">
                <span className="text-xl">📷</span>
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
