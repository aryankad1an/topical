import { useState } from 'react';
import { X, Send, BookOpen, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Post, Comment } from '@/lib/communityApi';
import { useDialogDismiss } from '@/hooks/useDialogDismiss';
import { Avatar } from '@/components/ui/primitives';
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
        <div className="post-detail-header">
          <button className="detail-close-btn" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            {/* `border-t-white/40` — a literal white on a page whose ground is
                cream, so in the light theme the moving part of the spinner was
                the one part you could not see. */}
            <div className="detail-spinner" />
          </div>
        ) : post ? (
          <div className="post-detail-body">
            {/* Title + vote */}
            <div className="flex gap-4 items-start mb-4">
              <div className="flex flex-col items-center gap-1 pt-1">
                <button className="vote-btn" onClick={() => vote.mutate(1)} disabled={!isAuthenticated}><ArrowUp className="h-3.5 w-3.5" /></button>
                <span className="text-xs font-semibold" style={{ color: 'var(--ink-muted)' }}>{score}</span>
                <button className="vote-btn" onClick={() => vote.mutate(-1)} disabled={!isAuthenticated}><ArrowDown className="h-3.5 w-3.5" /></button>
              </div>
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
            </div>

            {/* Attached lesson */}
            {post.lessonPlanId && post.lessonPlanName && (
              <div className="attached-lesson-row">
                <BookOpen className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--ink-muted)' }} />
                <span className="text-xs text-[var(--ink-muted)] flex-1">{post.lessonPlanName}</span>
                {onViewLesson && (
                  <button
                    className="text-xs font-medium"
                    style={{ color: 'var(--ink-muted)' }}
                    onClick={() => onViewLesson(post.lessonPlanId!)}
                  >
                    View lesson →
                  </button>
                )}
              </div>
            )}

            {/* Comments */}
            <div className="detail-divider" />
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
                    <div className="flex items-center gap-2 mb-1">
                      <span className="comment-author">{c.authorName}</span>
                      <span className="text-[10px] text-[var(--ink-ghost)]">
                        {pending ? 'sending…' : relativeTime(c.createdAt)}
                      </span>
                      {mine && !pending && (
                        <button
                          onClick={() => removeComment.mutate(c.id)}
                          className="icon-btn icon-btn--danger ml-auto opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                          style={{ height: 22, width: 22 }}
                          title="Delete comment"
                          aria-label="Delete your comment"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <p className="comment-body">{c.body}</p>
                  </div>
                </div>
              );
            })}

            {/* Add comment */}
            {isAuthenticated && (
              <div className="add-comment-row">
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Write a comment…"
                  rows={2}
                  className="glass-input w-full text-sm p-3 resize-none"
                  style={{ borderRadius: 12, cursor: 'text' }}
                />
                <button
                  className="cta-btn h-9 px-4 text-xs self-end"
                  disabled={!commentText.trim() || comment.isPending}
                  onClick={() => commentText.trim() && comment.mutate(commentText.trim())}
                >
                  <Send className="h-3.5 w-3.5" />
                  {comment.isPending ? 'Posting…' : 'Post'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-[var(--ink-faint)] py-12">Post not found.</p>
        )}
      </div>
    </div>
  );
}
