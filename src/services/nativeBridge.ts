/**
 * Native Bridge: Bridges React UI to Tauri native Rust layer where available,
 * with standard browser/desktop web fallback.
 */

export interface NativeBridgeAPI {
  isTauri: boolean;
  pickDirectory: () => Promise<string | null>;
  pickDirectoryFiles: () => Promise<{ folderPath: string; files: File[] } | null>;
  openFileDialog: (accept?: string) => Promise<File[]>;
  isDolbyHardwareSupported: () => Promise<boolean>;
  getSystemTheme: () => 'dark' | 'light';
  openFileLocation: (path: string) => Promise<void>;
  pickLyricsFile: () => Promise<{ name: string; content: string } | null>;
  exportLyricsFile: (filename: string, content: string) => void;
}

interface WindowWithTauri extends Window {
  __TAURI_INTERNALS__?: Record<string, unknown>;
  __TAURI__?: {
    invoke?: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  };
}

class NativeBridgeServiceImpl implements NativeBridgeAPI {
  public isTauri: boolean;

  constructor() {
    this.isTauri =
      typeof window !== 'undefined' &&
      Boolean(
        (window as WindowWithTauri).__TAURI_INTERNALS__ ||
          (window as WindowWithTauri).__TAURI__
      );
  }

  public async pickDirectory(): Promise<string | null> {
    if (this.isTauri) {
      try {
        const win = window as WindowWithTauri;
        if (win.__TAURI__?.invoke) {
          return await win.__TAURI__.invoke<string>('pick_music_folder');
        }
      } catch {
        // fallback
      }
    }

    const manualPath = window.prompt(
      'Enter local music directory path (e.g. /home/user/Music or D:\\Music):'
    );
    return manualPath ? manualPath.trim() : null;
  }

  /**
   * Prompts the user to select a folder and returns all its audio files recursively
   */
  public async pickDirectoryFiles(): Promise<{ folderPath: string; files: File[] } | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');
      input.multiple = true;

      input.onchange = () => {
        if (input.files && input.files.length > 0) {
          const files = Array.from(input.files);
          // Determine base folder name from first relative path
          const firstRel = files[0].webkitRelativePath || files[0].name;
          const folderName = firstRel.split('/')[0] || 'Music Folder';
          resolve({ folderPath: folderName, files });
        } else {
          resolve(null);
        }
      };

      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  public async openFileDialog(
    accept = 'audio/*,.mp3,.flac,.wav,.ogg,.m4a,.aac,.opus,.webm'
  ): Promise<File[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = accept;

      input.onchange = () => {
        if (input.files && input.files.length > 0) {
          resolve(Array.from(input.files));
        } else {
          resolve([]);
        }
      };

      input.oncancel = () => resolve([]);
      input.click();
    });
  }

  public async openFileLocation(path: string): Promise<void> {
    if (this.isTauri) {
      try {
        const win = window as WindowWithTauri;
        if (win.__TAURI__?.invoke) {
          await win.__TAURI__.invoke('open_file_location', { path });
          return;
        }
      } catch {
        // ignore
      }
    }
    console.info(`[NativeBridge] Opening file location: ${path}`);
  }

  public async isDolbyHardwareSupported(): Promise<boolean> {
    if (this.isTauri) {
      try {
        const win = window as WindowWithTauri;
        if (win.__TAURI__?.invoke) {
          return await win.__TAURI__.invoke<boolean>('check_dolby_support');
        }
      } catch {
        return false;
      }
    }
    return false;
  }

  public getSystemTheme(): 'dark' | 'light' {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  }

  public async pickLyricsFile(): Promise<{ name: string; content: string } | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.lrc,.txt';
      input.onchange = async () => {
        if (input.files && input.files.length > 0) {
          const file = input.files[0];
          const content = await file.text();
          resolve({ name: file.name, content });
        } else {
          resolve(null);
        }
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  public exportLyricsFile(filename: string, content: string): void {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const nativeBridge = new NativeBridgeServiceImpl();
