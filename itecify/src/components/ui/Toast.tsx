import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { theme as C } from '@/styles/theme';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration = 5000) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, type, message, duration }]);
    
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  const styles = {
    success: { icon: C.green, bg: `${C.green}15`, border: `${C.green}40` },
    error: { icon: C.red, bg: `${C.red}15`, border: `${C.red}40` },
    warning: { icon: C.yellow, bg: `${C.yellow}15`, border: `${C.yellow}40` },
    info: { icon: C.blue, bg: `${C.blue}15`, border: `${C.blue}40` },
  };

  const icons = {
    success: <CheckCircle size={18} />,
    error: <XCircle size={18} />,
    warning: <AlertTriangle size={18} />,
    info: <Info size={18} />,
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="flex items-center gap-3 p-4 rounded-lg border backdrop-blur-sm"
          style={{
            backgroundColor: styles[toast.type].bg,
            borderColor: styles[toast.type].border,
            color: styles[toast.type].icon,
          }}
        >
          {icons[toast.type]}
          <span className="text-sm flex-1" style={{ color: C.text }}>{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            style={{ color: C.muted }}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
