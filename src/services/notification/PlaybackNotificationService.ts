/**
 * Service to manage playback confirmation notifications with 30-minute deduplication window.
 * Routine success notifications are suppressed for 30 minutes per stable song identifier,
 * while playback errors are always reported.
 */

const NOTIFICATION_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const STORAGE_KEY = 'melo_playback_notification_timestamps';

export class PlaybackNotificationService {
  private static timestamps: Map<string, number> = new Map();

  static {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const now = Date.now();
          Object.entries(parsed).forEach(([k, v]) => {
            if (typeof v === 'number' && now - v < NOTIFICATION_WINDOW_MS) {
              this.timestamps.set(k, v);
            }
          });
        }
      }
    } catch {
      // ignore
    }
  }

  /**
   * Checks whether a routine playback notification should be shown for the given song identifier.
   * If shown, updates the timestamp and persists to localStorage.
   */
  public static shouldNotify(songId: string): boolean {
    if (!songId) return false;

    const now = Date.now();
    const lastNotified = this.timestamps.get(songId);

    if (lastNotified && now - lastNotified < NOTIFICATION_WINDOW_MS) {
      // Suppress within 30 minutes
      return false;
    }

    this.timestamps.set(songId, now);

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const obj: Record<string, number> = {};
        this.timestamps.forEach((v, k) => {
          if (now - v < NOTIFICATION_WINDOW_MS) {
            obj[k] = v;
          }
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
      }
    } catch {
      // ignore
    }

    return true;
  }

  /**
   * Clears all notification timestamps (e.g. on full cache/history reset).
   */
  public static clear(): void {
    this.timestamps.clear();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }
}

