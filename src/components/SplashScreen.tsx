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
        background: '#f5ead8',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        opacity: fade ? 0 : 1,
        transition: 'opacity 0.4s ease',
      }}
    >
      <div className="wordmark" style={{ marginBottom: '14px' }}>
        Lamoo
      </div>
      <div
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#645c50',
          fontFamily: 'Vazirmatn, sans-serif',
        }}
      >
        مدیریت هوشمند آشپزخانه
      </div>

      {/* Loading dots */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '32px' }}>
        <span className="dot-1" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7a8a5e', display: 'inline-block' }} />
        <span className="dot-2" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7a8a5e', display: 'inline-block' }} />
        <span className="dot-3" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7a8a5e', display: 'inline-block' }} />
      </div>
    </div>
  );
}
