/** Editor chrome preferences, remembered between sessions. */

export type ViewMode = 'code' | 'preview' | 'split';

export interface ViewOptions {
  outline: boolean;
  /** Width of the outline rail, in px — the writer drags it. */
  outlineWidth: number;
  lineNumbers: boolean;
  focusMode: boolean;
  syncScroll: boolean;
  fontSize: number;
}

export const DEFAULT_OPTIONS: ViewOptions = {
  outline: true,
  outlineWidth: 300,
  lineNumbers: true,
  focusMode: false,
  syncScroll: true,
  fontSize: 16,
};

const STORAGE_KEY = 'topical_editor_view';

export function loadOptions(): ViewOptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Merged over the defaults so a new option doesn't come back undefined.
    return raw ? { ...DEFAULT_OPTIONS, ...JSON.parse(raw) } : DEFAULT_OPTIONS;
  } catch {
    return DEFAULT_OPTIONS;
  }
}

export function saveOptions(options: ViewOptions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch {
    // Private mode and full quotas are not worth failing an edit over.
  }
}

/** The rail has to hold an editable tree without becoming the whole screen. */
export const MIN_OUTLINE_WIDTH = 210;
export const MAX_OUTLINE_WIDTH = 620;
