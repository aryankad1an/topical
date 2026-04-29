import { useState } from 'react';
import { X, PenLine, BookOpen } from 'lucide-react';
import type { Post } from '@/lib/communityApi';
import { createPost } from '@/lib/communityApi';
import { getPublicLessonPlans } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';

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
      <div className="new-post-dialog" onClick={e => e.stopPropagation()}>
        <div className="post-detail-header">
          <span className="text-sm font-semibold text-white/70 flex items-center gap-2">
            <PenLine className="h-4 w-4" /> New post
          </span>
          <button className="detail-close-btn" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <input
            className="glass-input w-full h-10 px-4 text-sm"
            placeholder="Title*"
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={{ cursor: 'text' }}
            maxLength={200}
          />
          <textarea
            className="glass-input w-full p-3 text-sm resize-none"
            placeholder="Share your thoughts… (optional)"
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={4}
            style={{ borderRadius: 12, cursor: 'text' }}
            maxLength={5000}
          />

          {/* Attach lesson */}
          <div>
            <button
              className="flex items-center gap-2 text-xs text-white/35 hover:text-white/60 transition-colors mb-2"
              onClick={() => setShowLessons(v => !v)}
            >
              <BookOpen className="h-3.5 w-3.5" />
              {attachedName ? `Attached: ${attachedName}` : 'Attach one of your lessons (optional)'}
            </button>

            {showLessons && (
              <div className="lesson-picker">
                <button
                  className={`lesson-pick-item ${!attachedId ? 'active' : ''}`}
                  onClick={() => { setAttachedId(null); setAttachedName(''); setShowLessons(false); }}
                >
                  None
                </button>
                {myPlans.map(p => (
                  <button
                    key={p.id}
                    className={`lesson-pick-item ${attachedId === p.id ? 'active' : ''}`}
                    onClick={() => { setAttachedId(p.id); setAttachedName(p.name); setShowLessons(false); }}
                  >
                    {p.name}
                  </button>
                ))}
                {myPlans.length === 0 && (
                  <p className="text-xs text-white/25 p-3">No public lessons found. Make a lesson public first.</p>
                )}
              </div>
            )}
          </div>

          <button
            className="cta-btn w-full"
            disabled={!title.trim() || submitting}
            onClick={handleSubmit}
          >
            {submitting ? 'Posting…' : 'Post to community'}
          </button>
        </div>
      </div>
    </div>
  );
}
