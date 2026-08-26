import { Wifi, WifiOff } from 'lucide-react';
import type { DocFormat } from '@/lib/types';
import type { SaveState } from '../hooks/useDocument';
import type { DocStats } from '../lib/stats';

interface Props {
  /** Whether the writing surface is live, or this is the reading view. */
  editing: boolean;
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
  editing, saveState, lastSavedAt, stats, line, column, selectedWords, connected, peerCount, format,
}: Props) {
  return (
    // A `contentinfo` landmark, so the bar is reachable by landmark navigation
    // rather than only by tabbing past the whole document.
    <div className="editor-status" role="contentinfo" aria-label="Document status">
      {/* Only the save state is announced. The rest changes on every keystroke,
          and a live region that reads the column number aloud as you type is
          unusable — those are marked aria-hidden and remain readable on screen. */}
      {/* Nothing is being saved while reading, and nothing is unsaved — a
          bar that says "all changes saved" to someone who cannot make changes
          is reporting on a thing that is not happening. */}
      {editing && (
        <span className="editor-status-item" role="status" aria-live="polite">
          <span className="editor-status-dot" data-state={saveState} aria-hidden="true" />
          {savedLabel(saveState, lastSavedAt)}
        </span>
      )}
      {/* `--aux` marks the readings that are nice to have rather than needed.
          A narrow window drops them (see editor.css) so the two that matter —
          whether the work is saved, and whether the session is live — are not
          pushed off the end of the bar by a character count. */}
      {/* A caret position, with no caret. */}
      {editing && (
        <span className="editor-status-item editor-status-item--aux" aria-hidden="true">Ln {line}, Col {column}</span>
      )}
      <span className="editor-status-item" aria-hidden="true">
        {selectedWords > 0
          ? `${selectedWords.toLocaleString()} of ${stats.words.toLocaleString()} words`
          : `${stats.words.toLocaleString()} words`}
      </span>
      <span className="editor-status-item editor-status-item--aux" aria-hidden="true">{stats.chars.toLocaleString()} characters</span>
      <span className="editor-status-item editor-status-item--aux" aria-hidden="true">{stats.readMinutes} min read</span>

      {/* Reading does not join the collaboration session at all, so there is
          no connection to report on. */}
      {editing && (
        <span className="editor-status-item ml-auto">
          {connected
            ? <><Wifi className="h-3 w-3" style={{ color: 'var(--status-success)' }} />
                {peerCount > 0 ? `${peerCount + 1} editing` : 'Live'}</>
            : <><WifiOff className="h-3 w-3 opacity-50" /> Offline</>}
        </span>
      )}
      <span className={`editor-status-item uppercase tracking-wider${editing ? '' : ' ml-auto'}`} style={{ fontSize: 10 }}>{format}</span>
    </div>
  );
}
