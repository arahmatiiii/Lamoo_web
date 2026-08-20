import { useEffect, useState } from 'react';

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFade(true), 1200);
    const t2 = setTimeout(() => onDone(), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#111827',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        opacity: fade ? 0 : 1,
        transition: 'opacity 0.4s ease',
      }}
    >
      <div style={{ fontSize: '72px', marginBottom: '16px', animation: 'pulse 1s ease infinite' }}>
        🍳
      </div>
      <div
        style={{
          fontSize: '28px',
          fontWeight: '800',
          color: '#f9fafb',
          fontFamily: 'Vazirmatn, sans-serif',
          marginBottom: '8px',
        }}
      >
        آشپزخانه
      </div>
      <div
        style={{
          fontSize: '14px',
          color: '#10b981',
          fontFamily: 'Vazirmatn, sans-serif',
        }}
      >
        مدیریت هوشمند آشپزخانه
      </div>

      {/* Loading dots */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '32px' }}>
        <span className="dot-1" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
        <span className="dot-2" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
        <span className="dot-3" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
      </div>
    </div>
  );
}
