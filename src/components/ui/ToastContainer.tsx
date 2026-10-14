import React, { useEffect, useState } from 'react';
import { notificationService, ToastMessage } from '../../services/errorService';
import { AlertCircle, CheckCircle, Info, TriangleAlert, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return notificationService.subscribe((msgs) => {
      setToasts(msgs);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-6 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none">
      {toasts.map((toast) => {
        let borderClass = 'border-[var(--border)]';
        let Icon = Info;
        let iconColor = 'text-[var(--accent)]';

        if (toast.type === 'error') {
          borderClass = 'border-[var(--danger)]';
          Icon = AlertCircle;
          iconColor = 'text-[var(--danger)]';
        } else if (toast.type === 'warning') {
          borderClass = 'border-[var(--warning)]';
          Icon = TriangleAlert;
          iconColor = 'text-[var(--warning)]';
        } else if (toast.type === 'success') {
          borderClass = 'border-[var(--success)]';
          Icon = CheckCircle;
          iconColor = 'text-[var(--success)]';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl bg-[var(--surface-card)] border ${borderClass} shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-2`}
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-[var(--text-primary)] leading-tight">{toast.title}</h4>
              <p className="text-xs text-[var(--text-secondary)] mt-1 break-words">{toast.message}</p>
            </div>
            <button
              onClick={() => notificationService.dismiss(toast.id)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-md transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
