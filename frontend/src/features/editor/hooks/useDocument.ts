import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import type { EditorSearch } from '@/routes/_authenticated/editor';
import { toast } from 'sonner';
import { getLessonPlanById, saveLessonPlan } from '@/lib/api';
import { documentContent } from '@/lib/documents';
import { formatOf, LATEX_PREFIX, type DocFormat, type LessonPlan } from '@/lib/types';
import { useYjsCollab } from '@/hooks/useYjsCollab';

const AUTOSAVE_INTERVAL_MS = 15_000;

export type SaveState = 'saved' | 'dirty' | 'saving';

export interface DocumentModel {
  projectId?: number;
  name: string;
  setName: (name: string) => void;
  format: DocFormat;
  content: string;
  /** Local edit — pushes to collaborators and marks the document dirty. */
  setContent: (value: string) => void;
  isLoading: boolean;
  saveState: SaveState;
  lastSavedAt: number | null;
  save: (silent?: boolean) => Promise<void>;
  authorUsername: string | null;
  isAuthor: boolean;
  coAuthors: string[];
  coAuthorUsernames: string[];
  setCoAuthors: (ids: string[], usernames: string[]) => void;
  /** Live collaboration. */
  peers: ReturnType<typeof useYjsCollab>['peers'];
  connected: boolean;
  updateCursor: (index: number, length: number) => void;
  isRemoteUpdate: React.MutableRefObject<boolean>;
}

/**
 * Everything about the document as a stored, shared thing: loading it,
 * saving it, autosaving it, and keeping it in sync with other editors.
 *
 * The editor screen deals with text and selection; this deals with the fact
 * that the text belongs to somebody and lives on a server.
 */
export function useDocument(currentUsername: string): DocumentModel {
  const [projectId, setProjectId] = useState<number | undefined>();
  const [name, setName] = useState('Untitled Project');
  const [format, setFormat] = useState<DocFormat>('mdx');
  const [content, setContentRaw] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [authorUsername, setAuthorUsername] = useState<string | null>(null);
  const [coAuthors, setCoAuthorIds] = useState<string[]>([]);
  const [coAuthorUsernames, setCoAuthorUsernames] = useState<string[]>([]);

  const { peers, connected, initContent, applyLocalChange, updateCursor, isRemoteUpdate } =
    useYjsCollab(projectId ? String(projectId) : undefined, currentUsername, remote => setContentRaw(remote));

  const setContent = useCallback((value: string) => {
    setContentRaw(value);
    setIsDirty(true);
    // Only push to Yjs for local edits, or a remote change echoes back.
    if (!isRemoteUpdate.current) applyLocalChange(value);
  }, [applyLocalChange, isRemoteUpdate]);

  // ── Load ────────────────────────────────────────────────────────────────
  // Read from the router, not from `window.location` once at mount: opening a
  // second document from the command palette or the community list reuses this
  // component, and a mount-only read would leave the previous document on
  // screen under the new title.
  const search = useRouterState({ select: state => state.location.search }) as EditorSearch;
  const documentId = search.id ?? null;
  const requestedFormat = search.type ?? 'mdx';

  useEffect(() => {
    if (!documentId || Number.isNaN(documentId)) {
      setFormat(requestedFormat);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const result = await getLessonPlanById(documentId);
        if ('error' in result) throw new Error(result.error);
        if (cancelled) return;

        const combined = documentContent(result.topics);

        setProjectId(result.id);
        setName(result.name);
        setAuthorUsername(result.authorUsername || null);
        setCoAuthorIds(result.coAuthors || []);
        setCoAuthorUsernames(result.coAuthorUsernames || []);
        setFormat(formatOf(result.mainTopic));
        setContentRaw(combined);
        // Freshly loaded text is by definition what the server already has.
        setIsDirty(false);
        // Seed the shared document; ignored if a peer already populated it.
        setTimeout(() => initContent(combined), 500);
      } catch {
        if (!cancelled) toast.error('Failed to load project');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // `initContent` is recreated on every collaboration state change; keying
    // the load on the document id is what actually matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, requestedFormat]);

  // ── Save ────────────────────────────────────────────────────────────────
  const planFor = useCallback((overrides: Partial<LessonPlan> = {}): LessonPlan => {
    const mainTopic = format === 'latex' ? `${LATEX_PREFIX}${name}` : name;
    return {
      id: projectId,
      name,
      mainTopic,
      topics: [{ topic: name, mdxContent: content, isSubtopic: false, parentTopic: name, mainTopic }],
      coAuthors,
      ...overrides,
    };
  }, [coAuthors, content, format, name, projectId]);

  const savingRef = useRef(false);
  const save = useCallback(async (silent = false) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      const result = await saveLessonPlan(planFor());
      setProjectId(result.id);
      setIsDirty(false);
      setLastSavedAt(Date.now());
      if (!silent) toast.success('Saved');
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [planFor]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (isDirty && !savingRef.current && projectId) save(true);
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isDirty, projectId, save]);

  // ── Co-authors ──────────────────────────────────────────────────────────
  const setCoAuthors = useCallback((ids: string[], usernames: string[]) => {
    setCoAuthorIds(ids);
    setCoAuthorUsernames(usernames);
    if (!projectId) {
      setIsDirty(true);
      return;
    }
    // Persist immediately: waiting for autosave means a collaborator who was
    // just added can't open the document yet.
    saveLessonPlan(planFor({ coAuthors: ids }))
      .then(() => setLastSavedAt(Date.now()))
      .catch(() => toast.error('Failed to save co-author changes'));
  }, [planFor, projectId]);

  return {
    projectId,
    name,
    setName: (next: string) => { setName(next); setIsDirty(true); },
    format,
    content,
    setContent,
    isLoading,
    saveState: isSaving ? 'saving' : isDirty ? 'dirty' : 'saved',
    lastSavedAt,
    save,
    authorUsername,
    isAuthor: !authorUsername || authorUsername === currentUsername,
    coAuthors,
    coAuthorUsernames,
    setCoAuthors,
    peers,
    connected,
    updateCursor,
    isRemoteUpdate,
  };
}
