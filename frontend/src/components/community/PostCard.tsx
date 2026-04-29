import { useState } from 'react';
import { ArrowUp, ArrowDown, MessageSquare, BookOpen, Clock, User } from 'lucide-react';
import type { Post } from '@/lib/communityApi';
import { votePost } from '@/lib/communityApi';
import { useAuth } from '@/lib/auth-context';

interface PostCardProps {
  post: Post;
  onUpdate: (updated: Post) => void;
  onOpen: (id: number) => void;
}

export function PostCard({ post, onUpdate, onOpen }: PostCardProps) {
  const { isAuthenticated } = useAuth();
  const [voting, setVoting] = useState(false);

  const score = post.upvotes - post.downvotes;

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
    <div className="community-card" onClick={() => onOpen(post.id)}>

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
          style={{ color: score > 0 ? '#cbd5e1' : score < 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.2)' }}
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
        <h3 className="community-card-title">{post.title}</h3>

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
        <div className="community-card-meta" style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
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
