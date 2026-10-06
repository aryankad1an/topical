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
import { TrendingUp, Clock, Plus, Globe, Layers, BookOpen, Users as UsersIcon, ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { fetchPosts, deletePost, type Post, type SortMode } from '@/lib/communityApi';
import { fetchPeople, personName } from '@/lib/api';
import { Avatar, Button, EmptyState, PageHeader, Refreshing, SearchField, Segmented, Skeleton, Page, Row, Text, Grid } from '@/components/ui';
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
    <Page>
      {/* ── Header ── */}
      <PageHeader
        title="Community"
        subtitle="Discuss ideas, share lessons, and learn together."
        actions={isAuthenticated && (
          <Button variant="primary" size="lg" onClick={() => setShowNewPost(true)}>
            <Plus className="h-4 w-4" /> New Post
          </Button>
        )}
      />

      <div className="community-controls">
        <Segmented
          aria-label="Community sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'forum', label: 'Forum', icon: <TrendingUp className="h-3.5 w-3.5" /> },
            { value: 'lessons', label: 'Public Lessons', icon: <BookOpen className="h-3.5 w-3.5" /> },
            { value: 'people', label: 'People', icon: <UsersIcon className="h-3.5 w-3.5" /> },
          ]}
        />

        <SearchField
          grow
          placeholder={tab === 'forum' ? 'Search posts…' : tab === 'people' ? 'Search people…' : 'Search lessons…'}
          aria-label={tab === 'forum' ? 'Search posts' : tab === 'people' ? 'Search people' : 'Search lessons'}
          value={search}
          onValueChange={setSearch}
          clearOnEscape
        />
      </div>

      {/* ── Forum tab ── */}
      {tab === 'forum' && (
        <section className="community-section">
          <div className="community-toolbar">
            {/* Sort pills */}
            <Segmented
              variant="pills"
              size="sm"
              aria-label="Sort posts"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'latest', label: 'Latest', icon: <Clock className="h-3 w-3" /> },
                { value: 'top', label: 'Top', icon: <TrendingUp className="h-3 w-3" /> },
              ]}
            />

            <Row align="center" gap={2.5} as="span">
              <Refreshing active={postsFetching && !postsLoading} />
              <Text size="2xs" tone="ghost" as="span">
                {filteredPosts.length} {filteredPosts.length === 1 ? 'post' : 'posts'}
              </Text>
            </Row>
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
                    <Skeleton height={12} width={20} />
                  </div>
                  <div className="community-card-content">
                    <Skeleton height={15} width={`${72 - i * 9}%`} className="mb-2.5" />
                    <Skeleton height={10} width="92%" className="mb-1.5" />
                    <Skeleton height={10} width="48%" />
                    <div className="community-card-meta">
                      <Skeleton height={9} width={64} />
                      <Skeleton height={9} width={44} />
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
              <Text tone="ghost" size="sm">
                {search ? `No posts matching "${search}"` : 'No posts yet — be the first!'}
              </Text>
              {isAuthenticated && !search && (
                /* Hero type in a 40px box is what this renders today: the size
                   utilities it was written with lost to `.cta-btn`. LEDGER A-07. */
                <Button variant="primary" size="hero" className="mt-5 h-10" onClick={() => setShowNewPost(true)}>
                  <Plus className="h-4 w-4" /> Start a discussion
                </Button>
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
            <Grid gap={2} cols={{ sm: 2 }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="person-card">
                  <Skeleton height={44} width={44} radius="md" />
                  <div className="flex-1">
                    <Skeleton height={14} width="50%" className="mb-2" />
                    <Skeleton height={10} width="33%" />
                  </div>
                </div>
              ))}
            </Grid>
          ) : people.length > 0 ? (
            <Grid gap={2} cols={{ sm: 2 }}>
              {people.map(p => (
                <Link key={p.id} to="/u/$username" params={{ username: p.username ?? '' }} className="person-card">
                  <Avatar seed={p.id} src={p.avatarUrl} name={personName(p)} size="md" />
                  <span className="min-w-0 flex-1">
                    <Text size="sm" weight="semibold" tone="ink" truncate as="span" className="block">{personName(p)}</Text>
                    <span className="person-handle block">@{p.username}</span>
                    {p.bio && <Text size="2xs" tone="faint" truncate as="span" className="block mt-0.5">{p.bio}</Text>}
                  </span>
                </Link>
              ))}
            </Grid>
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
                <Skeleton key={i} height={120} radius="lg" />
              ))}
            </div>
          ) : filteredLessons.length > 0 ? (
            <div className="lessons-grid">
              {filteredLessons.map(plan => {
                const isOwn = plan.userId === user?.id;
                return (
                  <div key={plan.id} className="lesson-community-card group">
                    <Row align="start" justify="between" className="mb-2">
                      <h3 className="text-sm font-semibold text-[var(--ink-2)] group-hover:text-[var(--ink)] transition-colors leading-snug flex-1 mr-2">
                        {plan.name}
                      </h3>
                      {isOwn && <span className="own-badge">Yours</span>}
                    </Row>
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
                    <Button
                      variant="primary"
                      size="md"
                      width="full"
                      onClick={() => handleViewLesson(plan.id, plan.mainTopic)}
                    >
                      Open <ArrowUpRight className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="community-empty">
              <BookOpen className="h-10 w-10 opacity-10 mx-auto mb-3" />
              <Text tone="ghost" size="sm">
                {search ? `No lessons matching "${search}"` : 'No public lessons yet.'}
              </Text>
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
    </Page>
  );
}
