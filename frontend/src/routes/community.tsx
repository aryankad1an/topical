/**
 * The community screen: a published-document library and a discussion forum,
 * switched by tab.
 *
 * Every lesson here opens at its own address, `/projects/:format/:id`, the
 * same one the projects page and the palette use. Whether it opens for reading
 * or for writing is settled there, by the server.
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, TrendingUp, Clock, Plus, Globe, Layers, BookOpen, Users as UsersIcon, X, ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { fetchPosts, deletePost, type Post, type SortMode } from '@/lib/communityApi';
import { fetchPeople, personName } from '@/lib/api';
import { Avatar, EmptyState, PageHeader, Refreshing } from '@/components/ui/primitives';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import { getPublicLessonPlans, userByIdQueryOptions } from '@/lib/api';
import { documentRoute } from '@/lib/documentUrl';
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
  const { data: postsData, isLoading: postsLoading, isFetching: postsFetching } = useQuery({
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
  const { data: peopleData, isLoading: peopleLoading, isFetching: peopleFetching } = useQuery({
    queryKey: ['people', search],
    queryFn: () => fetchPeople(search),
    enabled: tab === 'people',
  });
  const people = peopleData ?? [];

  // ── Public lessons ──
  const { data: lessonsData, isLoading: lessonsLoading, isFetching: lessonsFetching } = useQuery({
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

  /*
   * Every lesson opens at the same address.
   *
   * This used to compare owner ids in the browser and send you to the editor
   * or the reader accordingly — a guess the client is not entitled to make. It
   * was also wrong for co-authors, who were sent to the read-only view of a
   * document they may write.
   */
  const handleViewLesson = (id: number, mainTopic: string) => {
    navigate(documentRoute(id, mainTopic));
  };

  return (
    <div className="page-shell">
      {/* ── Header ── */}
      <PageHeader
        title="Community"
        subtitle="Discuss ideas, share lessons, and learn together."
        actions={isAuthenticated && (
          <button className="new-post-btn" onClick={() => setShowNewPost(true)}>
            <Plus className="h-4 w-4" /> New Post
          </button>
        )}
      />

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

        <div className="search-field search-field--grow">
          <Search className="search-field-icon" />
          <input
            type="text"
            className={`glass-input search-input${search ? ' search-input--clearable' : ''}`}
            placeholder={tab === 'forum' ? 'Search posts…' : tab === 'people' ? 'Search people…' : 'Search lessons…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setSearch(''); }}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
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

            <span className="flex items-center gap-2.5">
              <Refreshing active={postsFetching && !postsLoading} />
              <span className="text-[11px] text-[var(--ink-ghost)]">
                {filteredPosts.length} {filteredPosts.length === 1 ? 'post' : 'posts'}
              </span>
            </span>
          </div>

          {postsLoading ? (
            /* A skeleton has to be the shape of what is coming, or it is just
               four blank rectangles pulsing at you. These were exactly that:
               empty 88px cards on Tailwind's `animate-pulse`, which fades the
               whole box in and out rather than sweeping it, and told the
               reader nothing about whether a post is a title, a paragraph or
               a row of numbers. Now it is a vote gutter, a headline, a line of
               body and a meta row — the real card, unloaded. */
            <div className="forum-skeleton" aria-hidden="true">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="community-card">
                  <div className="community-vote-col">
                    <div className="skeleton" style={{ height: 12, width: 20 }} />
                  </div>
                  <div className="community-card-content">
                    <div className="skeleton" style={{ height: 15, width: `${72 - i * 9}%`, marginBottom: 10 }} />
                    <div className="skeleton" style={{ height: 10, width: '92%', marginBottom: 6 }} />
                    <div className="skeleton" style={{ height: 10, width: '48%' }} />
                    <div className="community-card-meta">
                      <div className="skeleton" style={{ height: 9, width: 64 }} />
                      <div className="skeleton" style={{ height: 9, width: 44 }} />
                    </div>
                  </div>
                </div>
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
            <Refreshing active={peopleFetching && !peopleLoading} />
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
            <Refreshing active={lessonsFetching && !lessonsLoading} />
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
                    {/* One button. There were two — "Read", which opened a
                        separate read-only page in a new tab, and "Edit", which
                        was shown to anyone signed in and failed for everyone
                        who did not own the document. */}
                    <button
                      className="w-full h-8 text-xs rounded-lg flex items-center justify-center gap-1 font-medium transition-all"
                      style={{ background: 'var(--accent-400)', color: 'var(--accent-ink)' }}
                      onClick={() => handleViewLesson(plan.id, plan.mainTopic)}
                    >
                      Open <ArrowUpRight className="h-3 w-3" />
                    </button>
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
