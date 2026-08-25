import { useState } from 'react';
import { ArrowUp, ArrowDown, MessageSquare, BookOpen, Clock, User, Trash2 } from 'lucide-react';
import type { Post } from '@/lib/communityApi';
import { votePost } from '@/lib/communityApi';
import { useAuth } from '@/lib/auth-context';

interface PostCardProps {
  post: Post;
  onUpdate: (updated: Post) => void;
  onOpen: (id: number) => void;
  onDelete: (id: number) => void;
}

export function PostCard({ post, onUpdate, onOpen, onDelete }: PostCardProps) {
  const { isAuthenticated, user } = useAuth();
  const [voting, setVoting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const score = post.upvotes - post.downvotes;
  const isAuthor = !!user && user.id === post.userId;

  async function handleVote(e: React.MouseEvent, v: 1 | -1) {
    e.stopPropagation();
    if (!isAuthenticated || voting) return;
    setVoting(true);
    try {
      const updated = await votePost(post.id, v);
      onUpdate(updated);
    } catch { /* ignore */ }
    setVoting(false);
  }

  const relTime = (d: string | null) => {
    if (!d) return '';
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div className="community-card group" onClick={() => onOpen(post.id)}>

      {/* ── Vote column ── */}
      <div className="community-vote-col" onClick={e => e.stopPropagation()}>
        <button
          className="vote-btn"
          onClick={e => handleVote(e, 1)}
          disabled={!isAuthenticated || voting}
          title="Upvote"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
        <span
          className="vote-score"
          style={{ color: score > 0 ? 'var(--ink-muted)' : score < 0 ? 'var(--ink-ghost)' : 'var(--ink-a12)' }}
        >
          {score}
        </span>
        <button
          className="vote-btn"
          onClick={e => handleVote(e, -1)}
          disabled={!isAuthenticated || voting}
          title="Downvote"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      </div>

      {/* ── Content ── */}
      <div className="community-card-content">
        {/* Title */}
        <div className="flex items-start gap-2">
          <h3 className="community-card-title flex-1">{post.title}</h3>

          {isAuthor && (
            /* Two-step delete: the second click confirms. A modal for a single
               forum post would be heavier than the action deserves. */
            <div onClick={e => e.stopPropagation()} className="shrink-0 flex items-center gap-1">
              {confirming ? (
                <>
                  <button
                    className="text-[10.5px] font-semibold px-2 py-1 rounded-md transition-colors"
                    /* The label was `--status-danger` on a `--status-danger`
                       fill: a red lozenge with an invisible word in it. The
                       fill is the tint, the label is the colour. */
                    style={{
                      color: 'var(--status-danger)',
                      background: 'rgb(var(--danger-rgb) / 0.12)',
                      border: '1px solid rgb(var(--danger-rgb) / 0.35)',
                    }}
                    onClick={() => onDelete(post.id)}
                  >
                    Delete?
                  </button>
                  <button
                    className="text-[10.5px] px-2 py-1 rounded-md text-[var(--ink-faint)] hover:text-[var(--ink-2)]"
                    onClick={() => setConfirming(false)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  className="icon-btn icon-btn--danger opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => setConfirming(true)}
                  title="Delete post"
                  aria-label={`Delete post "${post.title}"`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Body preview */}
        {post.body && (
          <p className="community-card-body">
            {post.body.slice(0, 200)}{post.body.length > 200 ? '…' : ''}
          </p>
        )}

        {/* Attached lesson */}
        {post.lessonPlanName && (
          <div className="lesson-badge" style={{ marginBottom: 10, alignSelf: 'flex-start' }}>
            <BookOpen className="h-3 w-3" />
            {post.lessonPlanName}
          </div>
        )}

        {/* Meta row — pinned to bottom */}
        {/* No rule above this row. A full-width hairline three-quarters of the
            way down a card cuts it into two stacked cards, and a list of them
            reads as twice as many objects as there are posts. Space separates
            it well enough. */}
        <div className="community-card-meta">
          <span className="meta-item">
            <User className="h-3 w-3" />
            {post.authorName}
          </span>
          <span className="meta-item" style={{ opacity: 0.4 }}>·</span>
          <span className="meta-item">
            <Clock className="h-3 w-3" />
            {relTime(post.createdAt)}
          </span>
          <span className="meta-item" style={{ opacity: 0.4 }}>·</span>
          <span className="meta-item">
            <MessageSquare className="h-3 w-3" />
            {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
          </span>
        </div>
      </div>
    </div>
  );
}
