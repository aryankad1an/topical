import { useState } from 'react';
import { X, PenLine, BookOpen } from 'lucide-react';
import type { Post } from '@/lib/communityApi';
import { createPost } from '@/lib/communityApi';
import { getPublicLessonPlans } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { useDialogDismiss } from '@/hooks/useDialogDismiss';

interface NewPostDialogProps {
  onClose: () => void;
  onCreated: (post: Post) => void;
}

export function NewPostDialog({ onClose, onCreated }: NewPostDialogProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [attachedId, setAttachedId] = useState<number | null>(null);
  const [attachedName, setAttachedName] = useState('');
  const [showLessons, setShowLessons] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useDialogDismiss(onClose);

  const { data: plansData } = useQuery({
    queryKey: ['public-lesson-plans'],
    queryFn: getPublicLessonPlans,
    enabled: showLessons,
  });

  const myPlans = (plansData?.lessonPlans ?? []).filter(p => p.userId === user?.id);

  async function handleSubmit() {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      const post = await createPost({
        title: title.trim(),
        body: body.trim(),
        ...(attachedId ? { lessonPlanId: attachedId, lessonPlanName: attachedName } : {}),
      });
      onCreated(post);
      onClose();
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <div className="post-detail-overlay" onClick={onClose}>
      {/* A real form, so Enter in the title submits and the browser knows what
          this is. It was a `<div>` with a button at the bottom, which means the
          one key everybody presses to finish a short form did nothing. */}
      <form
        className="new-post-dialog"
        onClick={e => e.stopPropagation()}
        onSubmit={e => { e.preventDefault(); handleSubmit(); }}
      >
        <div className="post-detail-header">
          <span className="text-sm font-semibold text-[var(--ink-2)] flex items-center gap-2">
            <PenLine className="h-4 w-4" /> New post
          </span>
          <button type="button" className="detail-close-btn" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Labelled, not placeholder-only. A placeholder is gone the instant
              somebody types into it, so a half-filled form of placeholder-only
              fields no longer says what any of them are — and "Title*" put the
              required marker in the one place guaranteed to vanish first. */}
          <div className="dialog-field">
            <label className="dialog-label" htmlFor="new-post-title">
              Title <span className="dialog-req">required</span>
            </label>
            <input
              id="new-post-title"
              autoFocus
              required
              className="glass-input w-full h-10 px-4 text-sm"
              placeholder="What do you want to ask or share?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{ cursor: 'text' }}
              maxLength={200}
            />
          </div>

          <div className="dialog-field">
            <label className="dialog-label" htmlFor="new-post-body">
              Body <span className="dialog-optional">optional</span>
            </label>
            <textarea
              id="new-post-body"
              className="glass-input w-full p-3 text-sm resize-none"
              placeholder="Add the detail that makes it answerable."
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={4}
              style={{ borderRadius: 12, cursor: 'text' }}
              maxLength={5000}
            />
          </div>

          {/* Attach lesson */}
          <div>
            <button
              type="button"
              className="flex items-center gap-2 text-xs text-[var(--ink-faint)] hover:text-[var(--ink-muted)] transition-colors mb-2"
              onClick={() => setShowLessons(v => !v)}
            >
              <BookOpen className="h-3.5 w-3.5" />
              {attachedName ? `Attached: ${attachedName}` : 'Attach one of your lessons (optional)'}
            </button>

            {showLessons && (
              <div className="lesson-picker">
                <button
                  type="button"
                  className={`lesson-pick-item ${!attachedId ? 'active' : ''}`}
                  onClick={() => { setAttachedId(null); setAttachedName(''); setShowLessons(false); }}
                >
                  None
                </button>
                {myPlans.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className={`lesson-pick-item ${attachedId === p.id ? 'active' : ''}`}
                    onClick={() => { setAttachedId(p.id); setAttachedName(p.name); setShowLessons(false); }}
                  >
                    {p.name}
                  </button>
                ))}
                {myPlans.length === 0 && (
                  <p className="text-xs text-[var(--ink-ghost)] p-3">No public lessons found. Make a lesson public first.</p>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="cta-btn w-full"
            disabled={!title.trim() || submitting}
          >
            {submitting ? 'Posting…' : 'Post to community'}
          </button>
        </div>
      </form>
    </div>
  );
}
