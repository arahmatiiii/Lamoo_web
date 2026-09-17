import { useState, useEffect, createContext, useContext, useCallback } from 'react';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info', action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  action?: ToastAction;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success', action?: ToastAction) => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, message, type, action }]);
      // An undoable toast sticks around longer — 3s is not enough to react to.
      setTimeout(() => dismiss(id), action ? 6000 : 3000);
    },
    [dismiss]
  );

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
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const colors = {
    success: { border: 'var(--sage)', color: 'var(--sage-700)', icon: '✅' },
    error: { border: 'var(--accent)', color: 'var(--accent-700)', icon: '❌' },
    info: { border: 'var(--accent)', color: 'var(--accent-700)', icon: 'ℹ️' },
  };

  const c = colors[toast.type];

  return (
    <div
      style={{
        background: 'var(--card)',
        border: `1px solid ${c.border}`,
        color: c.color,
        padding: toast.action ? '10px 14px 10px 10px' : '12px 22px',
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
        // Only an actionable toast takes pointer events; plain ones stay
        // click-through so they never block the UI underneath.
        pointerEvents: toast.action ? 'auto' : 'none',
        boxShadow: 'var(--shadow-md)',
        direction: 'rtl',
      }}
    >
      <span>{c.icon}</span>
      <span className="min-w-0">{toast.message}</span>
      {toast.action && (
        <button
          className="press flex-shrink-0 font-bold"
          style={{
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: 999,
            padding: '7px 14px',
            fontSize: 12,
          }}
          onClick={() => {
            toast.action?.onClick();
            onDismiss();
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
