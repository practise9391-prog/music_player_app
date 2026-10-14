# Privacy Policy for Nova Music Player

**Effective Date:** October 2026  
**Application Version:** 1.0.0 (Production Release)

Nova Music Player is built with an uncompromising commitment to user privacy, offline security, and zero-telemetry operations. We believe your personal music library, listening habits, and playlists belong exclusively to you on your device.

---

## 1. Zero Telemetry & Air-Gapped Architecture

- **No Remote Tracking:** Nova Music Player does NOT collect, transmit, sell, or analyze your personal information, listening history, library contents, or hardware identifiers.
- **Air-Gap Default:** All local music indexing, DSP audio processing, metadata parsing, equalizer adjustments, playlists, ratings, and playback bookmarks execute 100% locally on your device via standard platform APIs and IndexedDB.
- **No Background Network Activity:** The application never initiates background internet connections unless you explicitly trigger an online action (e.g. searching an online link or downloading an authorized audio file).

---

## 2. Permissions & How They Are Used

Nova Music Player requests permissions on Android only when required to provide core music playback:

1. **`READ_MEDIA_AUDIO` / `READ_EXTERNAL_STORAGE`**:
   - Used strictly to discover and play local music files on your device storage.
   - Files are indexed solely in local storage.
2. **`FOREGROUND_SERVICE` & `FOREGROUND_SERVICE_MEDIA_PLAYBACK`**:
   - Required by Android to continue uninterrupted music playback when the screen is locked, minimized, or when you switch apps.
3. **`POST_NOTIFICATIONS`**:
   - Displays persistent notification controls with playback actions (Play, Pause, Next, Previous, Favorite) on the lock screen and notification shade.
4. **`INTERNET` & `ACCESS_NETWORK_STATE`**:
   - Used strictly for user-initiated online playback or authorized audio downloads.
   - Network access can be completely disabled at any time via the built-in **Network Air-Gap Lock** toggle in Settings.

---

## 3. Local Data Storage & Diagnostics

- **Play History & Statistics:** All listening sessions, favorite tracks, and play counts are stored in a private, sandboxed database on your device.
- **App Lock & PIN Security:** If enabled, your security PIN is hashed locally using standard cryptographic salts. We cannot recover forgotten PINs because hashes never leave your device.
- **Sanitized Issue Reports:** When generating an issue or diagnostics report, all absolute filesystem paths, device identifiers, and personal tokens are scrubbed automatically before the user downloads or shares the report.

---

## 4. Third-Party Libraries & Codecs

Nova Music Player uses standard, open-source audio processing engines (WebAudio API, Dexie.js, Lucide). None of these libraries bundle tracking SDKs, advertising beacons, or remote analytics hooks.

---

## 5. Contact & Support

If you have questions about Nova Music Player's privacy practices, or wish to review the source code for offline compliance, visit our repository or contact the development team directly.

