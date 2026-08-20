import { Wifi, WifiOff } from 'lucide-react';
import type { DocFormat } from '@/lib/types';
import type { SaveState } from '../hooks/useDocument';
import type { DocStats } from '../lib/stats';

interface Props {
  saveState: SaveState;
  lastSavedAt: number | null;
  stats: DocStats;
  line: number;
  column: number;
  selectedWords: number;
  connected: boolean;
  peerCount: number;
  format: DocFormat;
}

function savedLabel(state: SaveState, at: number | null): string {
  if (state === 'saving') return 'Saving…';
  if (state === 'dirty') return 'Unsaved changes';
  if (!at) return 'All changes saved';
  const seconds = Math.round((Date.now() - at) / 1000);
  if (seconds < 45) return 'Saved just now';
  return `Saved ${Math.round(seconds / 60)} min ago`;
}

/** Ambient feedback while writing: length, position, save and session state. */
export function StatusBar({
  saveState, lastSavedAt, stats, line, column, selectedWords, connected, peerCount, format,
}: Props) {
  return (
    <div className="editor-status">
      <span className="editor-status-item">
        <span className="editor-status-dot" data-state={saveState} />
        {savedLabel(saveState, lastSavedAt)}
      </span>
      <span className="editor-status-item">Ln {line}, Col {column}</span>
      <span className="editor-status-item">
        {selectedWords > 0
          ? `${selectedWords.toLocaleString()} of ${stats.words.toLocaleString()} words`
          : `${stats.words.toLocaleString()} words`}
      </span>
      <span className="editor-status-item">{stats.chars.toLocaleString()} characters</span>
      <span className="editor-status-item">{stats.readMinutes} min read</span>

      <span className="editor-status-item ml-auto">
        {connected
          ? <><Wifi className="h-3 w-3" style={{ color: 'var(--status-success)' }} />
              {peerCount > 0 ? `${peerCount + 1} editing` : 'Live'}</>
          : <><WifiOff className="h-3 w-3 opacity-50" /> Offline</>}
      </span>
      <span className="editor-status-item uppercase tracking-wider" style={{ fontSize: 10 }}>{format}</span>
    </div>
  );
}
