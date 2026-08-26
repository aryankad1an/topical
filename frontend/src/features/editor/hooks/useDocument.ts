import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { saveLessonPlan, type LessonPlanResponse } from '@/lib/api';
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
  saveState: SaveState;
  lastSavedAt: number | null;
  save: (silent?: boolean) => Promise<void>;
  authorUsername: string | null;
  coAuthors: string[];
  coAuthorUsernames: (string | null)[];
  setCoAuthors: (ids: string[], usernames: (string | null)[]) => void;
  /** Whether the document is on the community library. */
  isPublic: boolean;
  /** Live collaboration. */
  peers: ReturnType<typeof useYjsCollab>['peers'];
  connected: boolean;
  updateCursor: (index: number, length: number) => void;
  isRemoteUpdate: React.MutableRefObject<boolean>;
}

/**
 * Everything about the document as a stored, shared thing: holding it,
 * saving it, autosaving it, and keeping it in sync with other editors.
 *
 * The editor screen deals with text and selection; this deals with the fact
 * that the text belongs to somebody and lives on a server.
 *
 * The document arrives already fetched. The route has to load it anyway — it
 * cannot know whether to show the reader or the editor until the server has
 * said what this viewer may do with it — so fetching again in here meant the
 * same document over the wire twice and a second spinner after the first had
 * cleared. It is also never null: a document is created before it is opened,
 * so there is no "unsaved, id-less document" state for anything downstream to
 * carry a branch for.
 */
export function useDocument(
  currentUsername: string,
  plan: LessonPlanResponse,
  /**
   * Whether the writing surface is live.
   *
   * Gates the collaboration session. A reader has nothing to send — there is
   * no textarea for them to type into — but joining the room would still put
   * them in everyone else's peer list and stream them the writers' cursors,
   * and on a published document that is a stranger appearing in the owner's
   * editor. Reading is not participating.
   */
  editing: boolean,
): DocumentModel {
  const [projectId, setProjectId] = useState<number | undefined>(plan.id);
  const [name, setName] = useState(plan.name);
  const [format] = useState<DocFormat>(formatOf(plan.mainTopic));
  const [content, setContentRaw] = useState(() => documentContent(plan.topics));
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [authorUsername] = useState<string | null>(plan.authorUsername ?? null);
  const [coAuthors, setCoAuthorIds] = useState<string[]>(plan.coAuthors ?? []);
  const [coAuthorUsernames, setCoAuthorUsernames] = useState<(string | null)[]>(
    plan.coAuthorUsernames ?? [],
  );
  /**
   * Whether the document is published, carried so every save can say so.
   *
   * It was never held here at all, so the editor's payload never contained
   * the field — and the API writes every column it is handed, defaulting a
   * missing `isPublic` to false. Publishing a document and then typing one
   * character silently withdrew it from the community library, as did adding
   * a co-author. The server no longer clears an omitted flag, but the editor
   * should still be able to state the truth rather than rely on that.
   */
  const [isPublic] = useState(!!plan.isPublic);

  const { peers, connected, initContent, applyLocalChange, updateCursor, isRemoteUpdate } =
    useYjsCollab(
      editing && projectId ? String(projectId) : undefined,
      currentUsername,
      remote => setContentRaw(remote),
    );

  const setContent = useCallback((value: string) => {
    setContentRaw(value);
    setIsDirty(true);
    // Only push to Yjs for local edits, or a remote change echoes back.
    if (!isRemoteUpdate.current) applyLocalChange(value);
  }, [applyLocalChange, isRemoteUpdate]);

  // ── Adopt ───────────────────────────────────────────────────────────────
  /*
   * The document arrives already fetched, so every field above is seeded from
   * it at first render rather than being filled in by an effect afterwards.
   * What is left for an effect is the one thing that cannot happen during
   * render: seeding the shared Yjs document for collaborators.
   *
   * Keyed on the id so that opening a second document — which the router does
   * by remounting this route — starts its own handshake, and so that a re-render
   * for any other reason does not re-seed and clobber a peer's edits.
   */
  useEffect(() => {
    if (!editing) return;
    const combined = documentContent(plan.topics);
    // Ignored if a peer already populated it.
    const timer = setTimeout(() => initContent(combined), 500);
    return () => clearTimeout(timer);
    // `initContent` is recreated on every collaboration state change; keying
    // this on the document id is what actually matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, editing]);

  // ── Save ────────────────────────────────────────────────────────────────
  const planFor = useCallback((overrides: Partial<LessonPlan> = {}): LessonPlan => {
    const mainTopic = format === 'latex' ? `${LATEX_PREFIX}${name}` : name;
    return {
      id: projectId,
      name,
      mainTopic,
      topics: [{ topic: name, mdxContent: content, isSubtopic: false, parentTopic: name, mainTopic }],
      coAuthors,
      isPublic,
      ...overrides,
    };
  }, [coAuthors, content, format, isPublic, name, projectId]);

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
    if (!editing) return;
    const timer = setInterval(() => {
      if (isDirty && !savingRef.current && projectId) save(true);
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [editing, isDirty, projectId, save]);

  // ── Co-authors ──────────────────────────────────────────────────────────
  const setCoAuthors = useCallback((ids: string[], usernames: (string | null)[]) => {
    setCoAuthorIds(ids);
    setCoAuthorUsernames(usernames);
    // Persist immediately: waiting for autosave means a collaborator who was
    // just added can't open the document yet.
    saveLessonPlan(planFor({ coAuthors: ids }))
      .then(() => setLastSavedAt(Date.now()))
      .catch(() => toast.error('Failed to save co-author changes'));
  }, [planFor]);

  return {
    projectId,
    name,
    setName: (next: string) => { setName(next); setIsDirty(true); },
    format,
    content,
    setContent,
    saveState: isSaving ? 'saving' : isDirty ? 'dirty' : 'saved',
    lastSavedAt,
    save,
    authorUsername,
    coAuthors,
    coAuthorUsernames,
    setCoAuthors,
    isPublic,
    peers,
    connected,
    updateCursor,
    isRemoteUpdate,
  };
}
