export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
}

type ToastListener = (toasts: ToastMessage[]) => void;

class NotificationServiceImpl {
  private toasts: ToastMessage[] = [];
  private listeners: Set<ToastListener> = new Set();

  public subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener([...this.toasts]);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l([...this.toasts]));
  }

  public show(toast: Omit<ToastMessage, 'id'>): string {
    const id = 'toast_' + Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = {
      ...toast,
      id,
      duration: toast.duration ?? 4500,
    };

    this.toasts.push(newToast);
    this.notify();

    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, newToast.duration);
    }

    return id;
  }

  public error(title: string, message: string): string {
    return this.show({ type: 'error', title, message });
  }

  public warning(title: string, message: string): string {
    return this.show({ type: 'warning', title, message });
  }

  public success(title: string, message: string): string {
    // Ordinary success notifications are silent per user requirements
    console.debug(`[Notification:Success] ${title}: ${message}`);
    return '';
  }

  public info(title: string, message: string): string {
    // Ordinary info notifications are silent per user requirements
    console.debug(`[Notification:Info] ${title}: ${message}`);
    return '';
  }

  public dismiss(id: string): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  public formatUserError(err: unknown): { title: string; message: string } {
    if (err instanceof Error) {
      const msg = err.message;
      if (msg.includes('Network access is disabled') || msg.includes('Air-Gap')) {
        return {
          title: 'Network Locked',
          message: 'Internet access is blocked by Air-Gap mode. Unlock network access to proceed.',
        };
      }
      if (msg.includes('HTTPS')) {
        return {
          title: 'Security Notice',
          message: 'Only secure "https://" audio streams are allowed.',
        };
      }
      if (msg.includes('Invalid') || msg.includes('Malformed')) {
        return {
          title: 'Invalid URL',
          message: 'Please provide a valid streaming URL.',
        };
      }
      return {
        title: 'Operation Failed',
        message: msg,
      };
    }
    return {
      title: 'Unexpected Error',
      message: 'An unexpected issue occurred while executing this action.',
    };
  }
}

export const notificationService = new NotificationServiceImpl();
