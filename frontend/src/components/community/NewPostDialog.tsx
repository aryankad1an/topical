import { useState } from 'react';
import { PenLine, BookOpen } from 'lucide-react';
import type { Post } from '@/lib/communityApi';
import { createPost } from '@/lib/communityApi';
import { getPublicLessonPlans } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { Button, Field, Input, Textarea, MenuEmpty, MenuItem, MenuPanel, Stack, PanelHeader, Modal } from '@/components/ui';

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
    <Modal label="New post" onClose={onClose} overlayClassName="post-detail-overlay">
      {/* A real form, so Enter in the title submits and the browser knows what
          this is. It was a `<div>` with a button at the bottom, which means the
          one key everybody presses to finish a short form did nothing. */}
      <form
        className="new-post-dialog"
        onSubmit={e => { e.preventDefault(); handleSubmit(); }}
      >
        <PanelHeader size="md" icon={<PenLine className="h-4 w-4" />} title="New post" onClose={onClose} />

        <Stack gap={4} className="p-5">
          {/* Labelled, not placeholder-only. A placeholder is gone the instant
              somebody types into it, so a half-filled form of placeholder-only
              fields no longer says what any of them are — and "Title*" put the
              required marker in the one place guaranteed to vanish first. */}
          <Field id="new-post-title" label="Title" requirement="required">
            <Input
              id="new-post-title"
              autoFocus
              required
              placeholder="What do you want to ask or share?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={200}
            />
          </Field>

          <Field id="new-post-body" label="Body" requirement="optional">
            <Textarea
              id="new-post-body"
              placeholder="Add the detail that makes it answerable."
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={4}
              maxLength={5000}
            />
          </Field>

          {/* Attach lesson */}
          <div>
            <Button
              type="button"
              variant="ghost"
              size="md"
              className="mb-2"
              aria-expanded={showLessons}
              onClick={() => setShowLessons(v => !v)}
            >
              <BookOpen className="h-3.5 w-3.5" />
              {attachedName ? `Attached: ${attachedName}` : 'Attach one of your lessons (optional)'}
            </Button>

            {showLessons && (
              <MenuPanel inset="sm" className="lesson-picker">
                <MenuItem checked={!attachedId} onClick={() => { setAttachedId(null); setAttachedName(''); setShowLessons(false); }}>
                  None
                </MenuItem>
                {myPlans.map(p => (
                  <MenuItem
                    key={p.id}
                    checked={attachedId === p.id}
                    onClick={() => { setAttachedId(p.id); setAttachedName(p.name); setShowLessons(false); }}
                  >
                    {p.name}
                  </MenuItem>
                ))}
                {myPlans.length === 0 && (
                  <MenuEmpty>No public lessons found. Make a lesson public first.</MenuEmpty>
                )}
              </MenuPanel>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="hero"
            width="full"
            disabled={!title.trim() || submitting}
          >
            {submitting ? 'Posting…' : 'Post to community'}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
