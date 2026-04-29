import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, TrendingUp, Clock, Plus, Globe, Layers, BookOpen } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { fetchPosts, type Post, type SortMode } from '@/lib/communityApi';
import { getPublicLessonPlans, userByIdQueryOptions } from '@/lib/api';
import { PostCard } from '@/components/community/PostCard';
import { PostDetail } from '@/components/community/PostDetail';
import { NewPostDialog } from '@/components/community/NewPostDialog';
import { useLessonPlanStore } from '@/stores/lessonPlanStore';
import { useQueries } from '@tanstack/react-query';

export const Route = createFileRoute('/community')({ component: CommunityPage });

type Tab = 'forum' | 'lessons';

function CommunityPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setLessonPlanToLoad = useLessonPlanStore(s => s.setLessonPlanToLoad);
  const setIsReadOnly = useLessonPlanStore(s => s.setIsReadOnly);

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

  const filteredPosts = posts.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.body.toLowerCase().includes(search.toLowerCase())
  );

  const handlePostUpdate = useCallback((updated: Post) => {
    setLocalPosts(prev => {
      const exists = prev.find(p => p.id === updated.id);
      return exists ? prev.map(p => p.id === updated.id ? updated : p) : [...prev, updated];
    });
  }, []);

  const handleNewPost = (post: Post) => {
    qc.invalidateQueries({ queryKey: ['community-posts'] });
  };

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

  const handleViewLesson = (id: number, ownerId: string) => {
    setIsReadOnly(ownerId !== user?.id);
    if (ownerId !== user?.id) useLessonPlanStore.setState({ isLoadingPublicLesson: true });
    setLessonPlanToLoad(id);
    navigate({ to: '/lesson-plan', search: {}, state: { lessonPlanId: id, fromDashboard: true } } as any);
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  return (
    <div className="community-root">
      {/* ── Hero ── */}
      <section className="community-hero">
        <h1 className="community-hero-title">Community</h1>
        <p className="community-hero-sub">
          Discuss ideas, share lessons, and learn together.
        </p>

        {/* Tabs */}
        <div className="community-tabs">
          <button className={`community-tab ${tab === 'forum' ? 'active' : ''}`} onClick={() => setTab('forum')}>
            <TrendingUp className="h-3.5 w-3.5" /> Forum
          </button>
          <button className={`community-tab ${tab === 'lessons' ? 'active' : ''}`} onClick={() => setTab('lessons')}>
            <BookOpen className="h-3.5 w-3.5" /> Public Lessons
          </button>
        </div>

        {/* Search */}
        <div className="community-search-wrap">
          <Search className="community-search-icon" />
          <input
            type="text"
            className="glass-input community-search"
            placeholder={tab === 'forum' ? 'Search posts…' : 'Search lessons…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </section>

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

            {isAuthenticated && (
              <button className="new-post-btn" onClick={() => setShowNewPost(true)}>
                <Plus className="h-4 w-4" /> New Post
              </button>
            )}
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
                />
              ))}
            </div>
          ) : (
            <div className="community-empty">
              <TrendingUp className="h-10 w-10 opacity-10 mx-auto mb-3" />
              <p className="text-white/25 text-sm">
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

      {/* ── Lessons tab ── */}
      {tab === 'lessons' && (
        <section className="community-section">
          <div className="community-toolbar">
            <span className="text-xs text-white/25 flex items-center gap-1.5">
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
                      <h3 className="text-sm font-semibold text-white/75 group-hover:text-white/90 transition-colors leading-snug flex-1 mr-2">
                        {plan.name}
                      </h3>
                      {isOwn && <span className="own-badge">Yours</span>}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-white/25 mb-3">
                      <span>{isOwn ? 'You' : userMap[plan.userId] || 'Member'}</span>
                      <span>·</span>
                      <span>{formatDate(plan.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-white/25 mb-4">
                      <Layers className="h-2.5 w-2.5" />
                      {plan.topics.length} {plan.topics.length === 1 ? 'topic' : 'topics'}
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="glass-btn flex-1 h-8 text-xs flex items-center justify-center gap-1.5"
                        onClick={() => window.open(`/combined-mdx?id=${plan.id}`, '_blank')}
                      >
                        Read
                      </button>
                      {isAuthenticated && (
                        <button
                          className="flex-1 h-8 text-xs rounded-lg flex items-center justify-center gap-1 font-medium transition-all"
                          style={{ background: 'linear-gradient(135deg,#cbd5e1,#e2e8f0)', color: '#080a0c' }}
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
              <p className="text-white/25 text-sm">
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
