import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, TrendingUp, Clock, Plus, Globe, Layers, BookOpen, Users as UsersIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { fetchPosts, deletePost, type Post, type SortMode } from '@/lib/communityApi';
import { fetchPeople, personName } from '@/lib/api';
import { Avatar, EmptyState } from '@/components/ui/primitives';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/utils';
import { getPublicLessonPlans, userByIdQueryOptions } from '@/lib/api';
import { PostCard } from '@/components/community/PostCard';
import { PostDetail } from '@/components/community/PostDetail';
import { NewPostDialog } from '@/components/community/NewPostDialog';
import { useQueries } from '@tanstack/react-query';

export const Route = createFileRoute('/community')({ component: CommunityPage });

type Tab = 'forum' | 'lessons' | 'people';

function CommunityPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>('forum');
  const [sort, setSort] = useState<SortMode>('latest');
  const [search, setSearch] = useState('');
  const [openPostId, setOpenPostId] = useState<number | null>(null);
  const [showNewPost, setShowNewPost] = useState(false);

  // ── Forum posts ──
  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['community-posts', sort],
    queryFn: () => fetchPosts(sort),
  });
  const [localPosts, setLocalPosts] = useState<Post[]>([]);
  const posts: Post[] = localPosts.length
    ? postsData?.map(p => localPosts.find(lp => lp.id === p.id) ?? p) ?? []
    : postsData ?? [];

  // Search covers author too — "who posted this?" is as common as
  // "what was it called?" — and multi-word queries match on every term, so
  // word order doesn't matter.
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
  const filteredPosts = posts
    .filter(p => !deletedIds.includes(p.id))
    .filter(p => {
      if (!terms.length) return true;
      const haystack = `${p.title} ${p.body} ${p.authorName}`.toLowerCase();
      return terms.every(t => haystack.includes(t));
    });

  const handlePostUpdate = useCallback((updated: Post) => {
    setLocalPosts(prev => {
      const exists = prev.find(p => p.id === updated.id);
      return exists ? prev.map(p => p.id === updated.id ? updated : p) : [...prev, updated];
    });
  }, []);

  /** Remove immediately, restoring the row if the server rejects it. */
  const handleDeletePost = useCallback(async (id: number) => {
    setDeletedIds(prev => [...prev, id]);
    try {
      await deletePost(id);
      toast.success('Post deleted');
      qc.invalidateQueries({ queryKey: ['community-posts'] });
      setOpenPostId(curr => (curr === id ? null : curr));
    } catch (err) {
      setDeletedIds(prev => prev.filter(d => d !== id));
      toast.error(errorMessage(err, 'Could not delete that post'));
    }
  }, [qc]);

  const handleNewPost = () => {
    qc.invalidateQueries({ queryKey: ['community-posts'] });
  };

  // ── People ──
  const { data: peopleData, isLoading: peopleLoading } = useQuery({
    queryKey: ['people', search],
    queryFn: () => fetchPeople(search),
    enabled: tab === 'people',
  });
  const people = peopleData ?? [];

  // ── Public lessons ──
  const { data: lessonsData, isLoading: lessonsLoading } = useQuery({
    queryKey: ['public-lesson-plans'],
    queryFn: getPublicLessonPlans,
    enabled: tab === 'lessons',
  });
  const publicLessons = lessonsData?.lessonPlans ?? [];
  const filteredLessons = publicLessons.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const userQueries = useQueries({
    queries: publicLessons.map(plan => ({
      ...userByIdQueryOptions(plan.userId),
      staleTime: Infinity,
    })),
  });
  const userMap = publicLessons.reduce((m, plan, i) => {
    const u = userQueries[i].data;
    if (u) m[plan.userId] = u.given_name ? `${u.given_name} ${u.family_name || ''}`.trim() : 'Member';
    return m;
  }, {} as Record<string, string>);

  // Yours opens in the editor; everyone else's opens in the reader.
  const handleViewLesson = (id: number, ownerId: string) => {
    if (ownerId === user?.id) navigate({ to: '/editor', search: { id } as never });
    else navigate({ to: '/read', search: { id } as never });
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  return (
    <div className="community-root">
      {/* ── Header ── */}
      <section className="community-hero">
        <div>
          <h1 className="community-hero-title">Community</h1>
          <p className="community-hero-sub">
            Discuss ideas, share lessons, and learn together.
          </p>
        </div>
        {isAuthenticated && tab === 'forum' && (
          <button className="new-post-btn" onClick={() => setShowNewPost(true)}>
            <Plus className="h-4 w-4" /> New Post
          </button>
        )}
      </section>

      {/* ── Tabs + search ── */}
      <div className="community-controls">
        <div className="community-tabs">
          <button className={`community-tab ${tab === 'forum' ? 'active' : ''}`} onClick={() => setTab('forum')}>
            <TrendingUp className="h-3.5 w-3.5" /> Forum
          </button>
          <button className={`community-tab ${tab === 'lessons' ? 'active' : ''}`} onClick={() => setTab('lessons')}>
            <BookOpen className="h-3.5 w-3.5" /> Public Lessons
          </button>
          <button className={`community-tab ${tab === 'people' ? 'active' : ''}`} onClick={() => setTab('people')}>
            <UsersIcon className="h-3.5 w-3.5" /> People
          </button>
        </div>

        <div className="community-search-wrap">
          <Search className="community-search-icon" />
          <input
            type="text"
            className="glass-input community-search"
            placeholder={tab === 'forum' ? 'Search posts…' : tab === 'people' ? 'Search people…' : 'Search lessons…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Forum tab ── */}
      {tab === 'forum' && (
        <section className="community-section">
          <div className="community-toolbar">
            {/* Sort pills */}
            <div className="sort-pills">
              <button className={`sort-pill ${sort === 'latest' ? 'active' : ''}`} onClick={() => setSort('latest')}>
                <Clock className="h-3 w-3" /> Latest
              </button>
              <button className={`sort-pill ${sort === 'top' ? 'active' : ''}`} onClick={() => setSort('top')}>
                <TrendingUp className="h-3 w-3" /> Top
              </button>
            </div>

            <span className="text-[11px] text-[var(--ink-ghost)]">
              {filteredPosts.length} {filteredPosts.length === 1 ? 'post' : 'posts'}
            </span>
          </div>

          {postsLoading ? (
            <div className="forum-skeleton">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="community-card animate-pulse" style={{ height: 88 }} />
              ))}
            </div>
          ) : filteredPosts.length > 0 ? (
            <div className="forum-list">
              {filteredPosts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  onUpdate={handlePostUpdate}
                  onOpen={setOpenPostId}
                  onDelete={handleDeletePost}
                />
              ))}
            </div>
          ) : (
            <div className="community-empty">
              <TrendingUp className="h-10 w-10 opacity-10 mx-auto mb-3" />
              <p className="text-[var(--ink-ghost)] text-sm">
                {search ? `No posts matching "${search}"` : 'No posts yet — be the first!'}
              </p>
              {isAuthenticated && !search && (
                <button className="cta-btn mt-5 h-10 px-6 text-sm" onClick={() => setShowNewPost(true)}>
                  <Plus className="h-4 w-4" /> Start a discussion
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── People tab ── */}
      {tab === 'people' && (
        <section className="community-section">
          <div className="community-toolbar">
            <span className="text-xs text-[var(--ink-ghost)] flex items-center gap-1.5">
              <UsersIcon className="h-3.5 w-3.5" />
              {people.length} {people.length === 1 ? 'member' : 'members'}
            </span>
          </div>

          {peopleLoading ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="person-card">
                  <div className="skeleton" style={{ height: 44, width: 44, borderRadius: 13 }} />
                  <div className="flex-1">
                    <div className="skeleton h-3.5 w-1/2 mb-2" />
                    <div className="skeleton h-2.5 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : people.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {people.map(p => (
                <Link key={p.id} to="/u/$username" params={{ username: p.username ?? '' }} className="person-card">
                  <Avatar seed={p.id} src={p.avatarUrl} name={personName(p)} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[var(--ink)] truncate">{personName(p)}</span>
                    <span className="person-handle block">@{p.username}</span>
                    {p.bio && <span className="block text-[11.5px] text-[var(--ink-faint)] truncate mt-0.5">{p.bio}</span>}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={UsersIcon}
              tone="muted"
              title={search ? `No members matching “${search}”` : 'No members yet'}
              description="Members appear here once they choose a username."
            />
          )}
        </section>
      )}

      {/* ── Lessons tab ── */}
      {tab === 'lessons' && (
        <section className="community-section">
          <div className="community-toolbar">
            <span className="text-xs text-[var(--ink-ghost)] flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              {filteredLessons.length} public {filteredLessons.length === 1 ? 'lesson' : 'lessons'}
            </span>
          </div>

          {lessonsLoading ? (
            <div className="lessons-grid">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="glass-card animate-pulse" style={{ height: 120 }} />
              ))}
            </div>
          ) : filteredLessons.length > 0 ? (
            <div className="lessons-grid">
              {filteredLessons.map(plan => {
                const isOwn = plan.userId === user?.id;
                return (
                  <div key={plan.id} className="lesson-community-card group">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-sm font-semibold text-[var(--ink-2)] group-hover:text-[var(--ink)] transition-colors leading-snug flex-1 mr-2">
                        {plan.name}
                      </h3>
                      {isOwn && <span className="own-badge">Yours</span>}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[var(--ink-ghost)] mb-3">
                      <span>{isOwn ? 'You' : userMap[plan.userId] || 'Member'}</span>
                      <span>·</span>
                      <span>{formatDate(plan.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--ink-ghost)] mb-4">
                      <Layers className="h-2.5 w-2.5" />
                      {plan.topics.length} {plan.topics.length === 1 ? 'topic' : 'topics'}
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="glass-btn flex-1 h-8 text-xs flex items-center justify-center gap-1.5"
                        onClick={() => window.open(`/read?id=${plan.id}`, '_blank')}
                      >
                        Read
                      </button>
                      {isAuthenticated && (
                        <button
                          className="flex-1 h-8 text-xs rounded-lg flex items-center justify-center gap-1 font-medium transition-all"
                          style={{ background: 'var(--accent-400)', color: 'var(--accent-ink)' }}
                          onClick={() => handleViewLesson(plan.id, plan.userId)}
                        >
                          {isOwn ? 'Edit' : 'View'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="community-empty">
              <BookOpen className="h-10 w-10 opacity-10 mx-auto mb-3" />
              <p className="text-[var(--ink-ghost)] text-sm">
                {search ? `No lessons matching "${search}"` : 'No public lessons yet.'}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Modals */}
      {openPostId !== null && (
        <PostDetail
          postId={openPostId}
          onClose={() => setOpenPostId(null)}
          onPostUpdate={handlePostUpdate}
          onViewLesson={id => { setOpenPostId(null); handleViewLesson(id, ''); }}
        />
      )}
      {showNewPost && (
        <NewPostDialog onClose={() => setShowNewPost(false)} onCreated={handleNewPost} />
      )}
    </div>
  );
}
