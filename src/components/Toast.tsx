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
          bottom: '80px',
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
    success: { bg: '#1f2937', border: '#10b981', icon: '✅' },
    error: { bg: '#1f2937', border: '#ef4444', icon: '❌' },
    info: { bg: '#1f2937', border: '#3b82f6', icon: 'ℹ️' },
  };

  const c = colors[toast.type];

  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: '#f9fafb',
        padding: '10px 20px',
        borderRadius: '10px',
        fontSize: '13px',
        fontFamily: 'Vazirmatn, sans-serif',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        whiteSpace: 'nowrap',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'all 0.3s ease',
        pointerEvents: 'none',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        direction: 'rtl',
      }}
    >
      <span>{c.icon}</span>
      {toast.message}
    </div>
  );
}
