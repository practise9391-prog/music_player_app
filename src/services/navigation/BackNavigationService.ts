import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { notificationService } from '../errorService';

export type BackHandler = () => boolean;

class BackNavigationService {
  private handlers: BackHandler[] = [];
  private lastBackPressTime = 0;
  private routeHistory: string[] = ['home'];
  private isNativeListenerRegistered = false;

  constructor() {
    this.initNativeListener();
  }

  private initNativeListener() {
    if (this.isNativeListenerRegistered) return;

    if (Capacitor.isNativePlatform()) {
      try {
        App.addListener('backButton', () => {
          this.triggerBack();
        });
        this.isNativeListenerRegistered = true;
      } catch (err) {
        console.warn('Failed to register Capacitor backButton listener:', err);
      }
    }

    // Also support keyboard Escape on desktop/web
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.triggerBack();
        }
      });
    }
  }

  /**
   * Register a modal or view handler.
   * Return true from the handler if the back action was consumed.
   * Returns an unregister function.
   */
  public registerHandler(handler: BackHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.lastIndexOf(handler);
      if (idx !== -1) {
        this.handlers.splice(idx, 1);
      }
    };
  }

  /**
   * Track route transitions for the back stack
   */
  public pushRoute(route: string) {
    const current = this.routeHistory[this.routeHistory.length - 1];
    if (current !== route) {
      this.routeHistory.push(route);
      // Keep max 20 history entries
      if (this.routeHistory.length > 20) {
        this.routeHistory.shift();
      }
    }
  }

  public popRoute(): string | null {
    if (this.routeHistory.length > 1) {
      this.routeHistory.pop(); // Remove current
      return this.routeHistory[this.routeHistory.length - 1] || 'home';
    }
    return null;
  }

  /**
   * Main back trigger: checks modals/drawers first, then route history, then double-tap exit
   */
  public triggerBack(onRouteBack?: (targetRoute: string) => void): boolean {
    // 1. Check registered modal/view handlers in LIFO order
    for (let i = this.handlers.length - 1; i >= 0; i--) {
      try {
        const handled = this.handlers[i]();
        if (handled) {
          return true;
        }
      } catch (err) {
        console.error('Error in back navigation handler:', err);
      }
    }

    // 2. Check route history
    const prevRoute = this.popRoute();
    if (prevRoute && onRouteBack) {
      onRouteBack(prevRoute);
      return true;
    }

    // 3. Double-tap to exit when on root screen
    const now = Date.now();
    if (now - this.lastBackPressTime < 2000) {
      if (Capacitor.isNativePlatform()) {
        App.exitApp();
      }
      return true;
    }

    this.lastBackPressTime = now;
    notificationService.info('Press back again to exit', 'Tap once more to close application');
    return true;
  }
}

export const backNavigationService = new BackNavigationService();
