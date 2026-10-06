import { useState } from 'react';
import { Send, BookOpen, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Post, Comment } from '@/lib/communityApi';
import { useDialogDismiss } from '@/hooks/useDialogDismiss';
import { Avatar, Button, IconButton, Textarea, LoadingState, Divider, Row, Stack, Text, PanelHeader } from '@/components/ui';
import { fetchPostDetail, addComment, votePost, deleteComment } from '@/lib/communityApi';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, ArrowDown, Clock } from 'lucide-react';
import { relativeTime } from '@/lib/format';

interface PostDetailProps {
  postId: number;
  onClose: () => void;
  onPostUpdate: (p: Post) => void;
  onViewLesson?: (id: number) => void;
}

export function PostDetail({ postId, onClose, onPostUpdate, onViewLesson }: PostDetailProps) {
  const { isAuthenticated, user } = useAuth();
  const qc = useQueryClient();
  const [commentText, setCommentText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['post-detail', postId],
    queryFn: () => fetchPostDetail(postId),
  });

  const post = data?.post;

  const vote = useMutation({
    mutationFn: (v: 1 | -1) => votePost(postId, v),
    onSuccess: (updated) => {
      onPostUpdate(updated);
      qc.setQueryData(
        ['post-detail', postId],
        (old: { post: Post; comments: Comment[] } | undefined) => old ? { ...old, post: updated } : old
      );
    },
  });

  type Detail = { post: Post; comments: Comment[] };

  /**
   * Comments post optimistically: the thread updates the moment you hit send,
   * with the temporary row rolled back if the request fails. Waiting on a
   * round-trip made the thread feel laggy on every reply.
   */
  const comment = useMutation({
    mutationFn: (body: string) => addComment(postId, body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ['post-detail', postId] });
      const previous = qc.getQueryData<Detail>(['post-detail', postId]);
      const optimistic: Comment = {
        id: -Date.now(), // negative id — never collides with a real one
        postId,
        userId: user?.id ?? '',
        authorName: user?.given_name || user?.username || 'You',
        body,
        createdAt: new Date().toISOString(),
      };
      qc.setQueryData<Detail>(['post-detail', postId], old =>
        old ? { ...old, comments: [optimistic, ...old.comments] } : old);
      setCommentText('');
      return { previous, optimisticId: optimistic.id };
    },
    onError: (err, _body, ctx) => {
      if (ctx?.previous) qc.setQueryData(['post-detail', postId], ctx.previous);
      toast.error(errorMessage(err, 'Could not post your comment'));
    },
    onSuccess: (saved, _body, ctx) => {
      // Swap the placeholder for the server row, keeping its position.
      qc.setQueryData<Detail>(['post-detail', postId], old => old ? {
        ...old,
        comments: old.comments.map(c => (c.id === ctx?.optimisticId ? saved : c)),
      } : old);
      onPostUpdate({ ...(post as Post), commentCount: (post?.commentCount ?? 0) + 1 });
    },
  });

  const removeComment = useMutation({
    mutationFn: (commentId: number) => deleteComment(postId, commentId),
    onMutate: async (commentId) => {
      await qc.cancelQueries({ queryKey: ['post-detail', postId] });
      const previous = qc.getQueryData<Detail>(['post-detail', postId]);
      qc.setQueryData<Detail>(['post-detail', postId], old =>
        old ? { ...old, comments: old.comments.filter(c => c.id !== commentId) } : old);
      return { previous };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(['post-detail', postId], ctx.previous);
      toast.error(errorMessage(err, 'Could not delete that comment'));
    },
    onSuccess: () => {
      toast.success('Comment deleted');
      onPostUpdate({ ...(post as Post), commentCount: Math.max((post?.commentCount ?? 1) - 1, 0) });
    },
  });

  useDialogDismiss(onClose);

  const comments = data?.comments ?? [];
  const score = (post?.upvotes ?? 0) - (post?.downvotes ?? 0);

  return (
    <div className="post-detail-overlay" onClick={onClose}>
      <div className="post-detail-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <PanelHeader size="md" onClose={onClose} className="justify-end" />

        {isLoading ? (
          <LoadingState size="inline" />
        ) : post ? (
          <div className="post-detail-body">
            {/* Title + vote */}
            <Row gap={4} align="start" className="mb-4">
              <Stack align="center" gap={1} className="pt-1">
                <IconButton size="lg" onClick={() => vote.mutate(1)} disabled={!isAuthenticated} aria-label="Upvote"><ArrowUp className="h-3.5 w-3.5" /></IconButton>
                <Text size="xs" weight="semibold" as="span" style={{ color: 'var(--ink-muted)' }}>{score}</Text>
                <IconButton size="lg" onClick={() => vote.mutate(-1)} disabled={!isAuthenticated} aria-label="Downvote"><ArrowDown className="h-3.5 w-3.5" /></IconButton>
              </Stack>
              <div className="flex-1">
                {/* The same string, in the same face, as the card this was
                    opened from — clicking a post should not change the
                    typeface of its own title. */}
                <h2 className="post-detail-title">{post.title}</h2>
                <div className="flex items-center gap-3 text-[11px] text-[var(--ink-ghost)] mb-3">
                  <span>by {post.authorName}</span>
                  <span><Clock className="inline h-2.5 w-2.5 mr-0.5" />{relativeTime(post.createdAt)}</span>
                </div>
                {post.body && <p className="text-sm text-[var(--ink-muted)] leading-relaxed whitespace-pre-wrap">{post.body}</p>}
              </div>
            </Row>

            {/* Attached lesson */}
            {post.lessonPlanId && post.lessonPlanName && (
              <div className="attached-lesson-row">
                <BookOpen className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--ink-muted)' }} />
                <Text size="xs" tone="muted" as="span" className="flex-1">{post.lessonPlanName}</Text>
                {onViewLesson && (
                  <Button variant="ghost" size="md" onClick={() => onViewLesson(post.lessonPlanId!)}>
                    View lesson →
                  </Button>
                )}
              </div>
            )}

            {/* Comments */}
            <Divider className="detail-divider" />
            <h3 className="text-xs font-semibold text-[var(--ink-faint)] uppercase tracking-widest mb-3">
              {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
            </h3>

            {comments.map(c => {
              // Negative ids belong to optimistic rows still in flight.
              const pending = c.id < 0;
              const mine = !!user && c.userId === user.id;
              return (
                <div key={c.id} className="comment-row group"
                  style={pending ? { opacity: 0.55 } : undefined}>
                  {/* The shared avatar, so a person is the same colour here as
                      in the people list, the nav and their profile. This was a
                      grey circle with an initial in it — a second avatar
                      implementation, and the only one that made everybody look
                      identical. */}
                  <Avatar seed={c.userId} name={c.authorName} size="xs" />
                  <div className="flex-1 min-w-0">
                    <Row align="center" gap={2} className="mb-1">
                      <span className="comment-author">{c.authorName}</span>
                      <Text size="3xs" tone="ghost" as="span">
                        {pending ? 'sending…' : relativeTime(c.createdAt)}
                      </Text>
                      {mine && !pending && (
                        <IconButton
                          size="sm"
                          tone="danger"
                          revealOnHover
                          className="ml-auto"
                          onClick={() => removeComment.mutate(c.id)}
                          title="Delete comment"
                          aria-label="Delete your comment"
                        >
                          <Trash2 className="h-3 w-3" />
                        </IconButton>
                      )}
                    </Row>
                    <p className="comment-body">{c.body}</p>
                  </div>
                </div>
              );
            })}

            {/* Add comment */}
            {isAuthenticated && (
              <div className="add-comment-row">
                <Textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Write a comment…"
                  aria-label="Write a comment"
                  rows={2}
                />
                {/* Hero type in a 40px box is what this renders today: the size
                    utilities it was written with lost to `.cta-btn`. LEDGER A-07. */}
                <Button
                  variant="primary"
                  size="hero"
                  className="h-9 self-end"
                  disabled={!commentText.trim() || comment.isPending}
                  onClick={() => commentText.trim() && comment.mutate(commentText.trim())}
                >
                  <Send className="h-3.5 w-3.5" />
                  {comment.isPending ? 'Posting…' : 'Post'}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <Text tone="faint" className="text-center py-12">Post not found.</Text>
        )}
      </div>
    </div>
  );
}
