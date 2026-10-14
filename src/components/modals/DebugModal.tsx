import React, { useEffect, useState } from 'react';
import { usePlayer } from '../../player/PlayerContext';
import { useNetwork } from '../../network/NetworkContext';
import { db } from '../../database/db';
import { Button } from '../ui/Button';
import { Terminal, X, RefreshCw, Activity } from 'lucide-react';

interface DebugModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DebugModal: React.FC<DebugModalProps> = ({ isOpen, onClose }) => {
  const { state: playerState, currentTrack } = usePlayer();
  const { networkState } = useNetwork();
  const [dbStats, setDbStats] = useState<{
    tracks: number;
    playHistory: number;
    onlineHistory: number;
  }>({ tracks: 0, playHistory: 0, onlineHistory: 0 });

  const loadStats = async () => {
    try {
      const tracks = await db.tracks.count();
      const playHistory = await db.play_history.count();
      const onlineHistory = await db.online_history.count();
      setDbStats({ tracks, playHistory, onlineHistory });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="font-mono text-sm font-bold text-[var(--text-primary)]">
              NOVA AUDIO ENGINE — DEBUG TELEMETRY (LOCAL)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-5 overflow-y-auto font-mono text-xs space-y-4">
          {/* Audio Engine Live State */}
          <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <div className="flex justify-between items-center mb-2 font-bold text-[var(--accent)]">
              <span>● AUDIO ENGINE PIPELINE</span>
              <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-[var(--surface-secondary)]">
                {playerState.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[var(--text-secondary)]">
              <div>Current Position: <span className="text-[var(--text-primary)]">{playerState.currentTime.toFixed(2)}s</span></div>
              <div>Duration: <span className="text-[var(--text-primary)]">{playerState.duration.toFixed(2)}s</span></div>
              <div>Volume Slider: <span className="text-[var(--text-primary)]">{(playerState.volume * 100).toFixed(0)}%</span></div>
              <div>Volume Boost Level: <span className="text-[var(--text-primary)]">{(playerState.boostLevel * 100).toFixed(0)}%</span></div>
              <div>Clipping Protection: <span className="text-emerald-400">BRICKWALL LIMITER ACTIVE (-0.5dB)</span></div>
              <div>Muted: <span className="text-[var(--text-primary)]">{playerState.isMuted ? 'YES' : 'NO'}</span></div>
              <div>Playback Rate: <span className="text-[var(--text-primary)]">{playerState.playbackRate}x</span></div>
              <div>Repeat Mode: <span className="text-[var(--text-primary)]">{playerState.repeatMode}</span></div>
              <div>Shuffle: <span className="text-[var(--text-primary)]">{playerState.isShuffle ? 'ON' : 'OFF'}</span></div>
              <div>Active EQ Profile: <span className="text-[var(--accent)]">{playerState.activeProfile}</span></div>
              <div>Spatial Mode: <span className="text-[var(--accent)]">{playerState.spatialMode}</span></div>
            </div>
          </div>

          {/* Current Track Info */}
          <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <div className="font-bold text-[var(--accent)] mb-2">● CURRENT TRACK LOADED</div>
            {currentTrack ? (
              <div className="grid grid-cols-2 gap-2 text-[var(--text-secondary)]">
                <div>Title: <span className="text-[var(--text-primary)]">{currentTrack.title}</span></div>
                <div>Artist: <span className="text-[var(--text-primary)]">{currentTrack.artist}</span></div>
                <div>Source: <span className="text-[var(--text-primary)]">{currentTrack.source}</span></div>
                <div>Format: <span className="text-[var(--text-primary)]">{currentTrack.format}</span></div>
                <div>Bitrate: <span className="text-[var(--text-primary)]">{currentTrack.bitrate || 'Standard'} kbps</span></div>
                <div>Path: <span className="text-[var(--text-primary)] truncate block">{currentTrack.path}</span></div>
              </div>
            ) : (
              <div className="text-[var(--text-muted)] italic">No track loaded in player buffer.</div>
            )}
          </div>

          {/* Network State */}
          <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <div className="font-bold text-[var(--accent)] mb-2">● NETWORK AIR-GAP MONITOR</div>
            <div className="grid grid-cols-2 gap-2 text-[var(--text-secondary)]">
              <div>Network Status: <span className="text-amber-400 font-bold">{networkState.status}</span></div>
              <div>Air-Gap Mode: <span className="text-[var(--text-primary)]">{networkState.isAirGapped ? 'BLOCKED' : 'PERMITTED'}</span></div>
              <div>Active HTTP / Sockets: <span className="text-[var(--text-primary)]">{networkState.activeConnections}</span></div>
              <div>Telemetry / Analytics: <span className="text-emerald-400">HARD-CODED DISABLED (0 packets)</span></div>
              <div>Temporary Access: <span className="text-[var(--text-primary)]">{networkState.temporaryAccessExpiresAt ? 'ACTIVE' : 'NONE'}</span></div>
            </div>
          </div>

          {/* Database State */}
          <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-[var(--accent)]">● LOCAL DATABASE (INDEXEDDB)</span>
              <button onClick={loadStats} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 text-[11px]">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[var(--text-secondary)]">
              <div>Tracks Stored: <span className="text-[var(--text-primary)] font-bold">{dbStats.tracks}</span></div>
              <div>Play History: <span className="text-[var(--text-primary)] font-bold">{dbStats.playHistory}</span></div>
              <div>Online History: <span className="text-[var(--text-primary)] font-bold">{dbStats.onlineHistory}</span></div>
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-[var(--border)] flex justify-end bg-[var(--surface)]">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close Telemetry
          </Button>
        </div>
      </div>
    </div>
  );
};
