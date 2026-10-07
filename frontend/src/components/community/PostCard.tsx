import { useState } from 'react';
import { ArrowUp, ArrowDown, MessageSquare, BookOpen, Clock, User, Trash2 } from 'lucide-react';
import type { Post } from '@/lib/communityApi';
import { votePost } from '@/lib/communityApi';
import { useAuth } from '@/lib/auth-context';
import { relativeTime } from '@/lib/format';
import { Button, IconButton, Row, Chip } from '@/components/ui';

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

  return (
    <div className="community-card group" onClick={() => onOpen(post.id)}>

      {/* ── Vote column ── */}
      <div className="community-vote-col" onClick={e => e.stopPropagation()}>
        <IconButton
          size="lg"
          onClick={e => handleVote(e, 1)}
          disabled={!isAuthenticated || voting}
          title="Upvote"
          aria-label="Upvote"
        >
          <ArrowUp className="h-4 w-4" />
        </IconButton>
        <span
          className="vote-score"
          style={{ color: score > 0 ? 'var(--ink-muted)' : 'var(--ink-ghost)' }}
        >
          {score}
        </span>
        <IconButton
          size="lg"
          onClick={e => handleVote(e, -1)}
          disabled={!isAuthenticated || voting}
          title="Downvote"
          aria-label="Downvote"
        >
          <ArrowDown className="h-4 w-4" />
        </IconButton>
      </div>

      {/* ── Content ── */}
      <div className="community-card-content">
        {/* Title */}
        <Row align="start" gap={2}>
          {/* The card is clickable anywhere with a pointer; this button is the
              same action for the keyboard and for assistive tech, which a
              clickable <div> offered neither. */}
          <h3 className="community-card-title flex-1">
            <button type="button" className="community-card-open" onClick={e => { e.stopPropagation(); onOpen(post.id); }}>
              {post.title}
            </button>
          </h3>

          {isAuthor && (
            /* Two-step delete: the second click confirms. A modal for a single
               forum post would be heavier than the action deserves. */
            <Row onClick={e => e.stopPropagation()} align="center" gap={1} className="shrink-0">
              {confirming ? (
                <>
                  <Button variant="secondary" tone="danger" size="xs" onClick={() => onDelete(post.id)}>
                    Delete?
                  </Button>
                  <Button variant="ghost" size="xs" onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <IconButton
                  size="sm"
                  tone="danger"
                  revealOnHover
                  onClick={() => setConfirming(true)}
                  title="Delete post"
                  aria-label={`Delete post "${post.title}"`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              )}
            </Row>
          )}
        </Row>

        {/* Body preview */}
        {post.body && (
          <p className="community-card-body">
            {post.body.slice(0, 200)}{post.body.length > 200 ? '…' : ''}
          </p>
        )}

        {/* Attached lesson */}
        {post.lessonPlanName && (
          <Chip tone="quiet" className="mb-2.5 self-start">
            <BookOpen className="h-3 w-3" />
            {post.lessonPlanName}
          </Chip>
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
          <span className="meta-item" style={{ opacity: 0.4 }} aria-hidden="true">·</span>
          <span className="meta-item">
            <Clock className="h-3 w-3" />
            {relativeTime(post.createdAt)}
          </span>
          <span className="meta-item" style={{ opacity: 0.4 }} aria-hidden="true">·</span>
          <span className="meta-item">
            <MessageSquare className="h-3 w-3" />
            {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
          </span>
        </div>
      </div>
    </div>
  );
}
