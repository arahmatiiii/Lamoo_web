import { useState, useEffect, createContext, useContext, useCallback } from 'react';

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast }: { toast: ToastItem }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const colors = {
    success: { border: '#7a8a5e', color: '#56633f', icon: '✅' },
    error: { border: '#c67139', color: '#8c491a', icon: '❌' },
    info: { border: '#c67139', color: '#8c491a', icon: 'ℹ️' },
  };

  const c = colors[toast.type];

  return (
    <div
      style={{
        background: '#f9f4ed',
        border: `1px solid ${c.border}`,
        color: c.color,
        padding: '12px 22px',
        borderRadius: '999px',
        fontSize: '13px',
        fontWeight: 600,
        fontFamily: 'Vazirmatn, sans-serif',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        maxWidth: 'min(90vw, 390px)',
        textAlign: 'center',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'all 0.3s ease',
        pointerEvents: 'none',
        boxShadow: '0 3px 10px rgba(46,43,37,0.16)',
        direction: 'rtl',
      }}
    >
      <span>{c.icon}</span>
      {toast.message}
    </div>
  );
}
