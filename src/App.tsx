import React from 'react';
import { SettingsProvider } from './settings/SettingsContext';
import { I18nProvider } from './services/i18n/I18nService';
import { ThemeProvider } from './themes/ThemeContext';
import { NetworkProvider } from './network/NetworkContext';
import { PlayerProvider } from './player/PlayerContext';
import { AppShell } from './layouts/AppShell';

export function App() {
  return (
    <SettingsProvider>
      <I18nProvider>
        <ThemeProvider>
          <NetworkProvider>
            <PlayerProvider>
              <AppShell />
            </PlayerProvider>
          </NetworkProvider>
        </ThemeProvider>
      </I18nProvider>
    </SettingsProvider>
  );
}

export default App;
