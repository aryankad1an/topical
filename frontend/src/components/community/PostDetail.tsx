import { useState } from 'react';
import { X, Send, BookOpen, ChevronDown } from 'lucide-react';
import type { Post, Comment } from '@/lib/communityApi';
import { fetchPostDetail, addComment, votePost } from '@/lib/communityApi';
import { useAuth } from '@/lib/auth-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, ArrowDown, Clock } from 'lucide-react';

interface PostDetailProps {
  postId: number;
  onClose: () => void;
  onPostUpdate: (p: Post) => void;
  onViewLesson?: (id: number) => void;
}

export function PostDetail({ postId, onClose, onPostUpdate, onViewLesson }: PostDetailProps) {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [commentText, setCommentText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['post-detail', postId],
    queryFn: () => fetchPostDetail(postId),
  });

  const vote = useMutation({
    mutationFn: (v: 1 | -1) => votePost(postId, v),
    onSuccess: (updated) => {
      onPostUpdate(updated);
      qc.setQueryData(['post-detail', postId], (old: any) => old ? { ...old, post: updated } : old);
    },
  });

  const comment = useMutation({
    mutationFn: (body: string) => addComment(postId, body),
    onSuccess: () => {
      setCommentText('');
      qc.invalidateQueries({ queryKey: ['post-detail', postId] });
    },
  });

  const relTime = (d: string | null) => {
    if (!d) return '';
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
  };

  const post = data?.post;
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
            <div className="h-6 w-6 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
          </div>
        ) : post ? (
          <div className="post-detail-body">
            {/* Title + vote */}
            <div className="flex gap-4 items-start mb-4">
              <div className="flex flex-col items-center gap-1 pt-1">
                <button className="vote-btn" onClick={() => vote.mutate(1)} disabled={!isAuthenticated}><ArrowUp className="h-3.5 w-3.5" /></button>
                <span className="text-xs font-semibold" style={{ color: '#94a3b8' }}>{score}</span>
                <button className="vote-btn" onClick={() => vote.mutate(-1)} disabled={!isAuthenticated}><ArrowDown className="h-3.5 w-3.5" /></button>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-white/85 leading-snug mb-1">{post.title}</h2>
                <div className="flex items-center gap-3 text-[11px] text-white/25 mb-3">
                  <span>by {post.authorName}</span>
                  <span><Clock className="inline h-2.5 w-2.5 mr-0.5" />{relTime(post.createdAt)}</span>
                </div>
                {post.body && <p className="text-sm text-white/50 leading-relaxed whitespace-pre-wrap">{post.body}</p>}
              </div>
            </div>

            {/* Attached lesson */}
            {post.lessonPlanId && post.lessonPlanName && (
              <div className="attached-lesson-row">
                <BookOpen className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#94a3b8' }} />
                <span className="text-xs text-white/50 flex-1">{post.lessonPlanName}</span>
                {onViewLesson && (
                  <button
                    className="text-xs font-medium"
                    style={{ color: '#94a3b8' }}
                    onClick={() => onViewLesson(post.lessonPlanId!)}
                  >
                    View lesson →
                  </button>
                )}
              </div>
            )}

            {/* Comments */}
            <div className="detail-divider" />
            <h3 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">
              {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
            </h3>

            {comments.map(c => (
              <div key={c.id} className="comment-row">
                <div className="comment-avatar">{c.authorName[0]?.toUpperCase()}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-white/55">{c.authorName}</span>
                    <span className="text-[10px] text-white/20">{relTime(c.createdAt)}</span>
                  </div>
                  <p className="text-sm text-white/40 leading-relaxed whitespace-pre-wrap">{c.body}</p>
                </div>
              </div>
            ))}

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
          <p className="text-center text-white/30 py-12">Post not found.</p>
        )}
      </div>
    </div>
  );
}
