import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getPublicLessonPlans, userByIdQueryOptions } from '@/lib/api';
import { useNavigate } from '@tanstack/react-router';
import { useLessonPlanStore } from '@/stores/lessonPlanStore';
import { useAuth } from '@/lib/auth-context';
import {
  BookMarked,
  Calendar,
  Search,
  User,
  FileCode,
  Loader2,
  ChevronDown,
  Layers,
} from 'lucide-react';

export const Route = createFileRoute('/public-lessons')({
  component: PublicLessonsPage,
});

function PublicLessonsPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const setLessonPlanToLoad = useLessonPlanStore((state) => state.setLessonPlanToLoad);
  const setIsReadOnly = useLessonPlanStore((state) => state.setIsReadOnly);

  // Pagination state
  const INITIAL_DISPLAY_COUNT = 9;
  const LOAD_MORE_COUNT = 6;
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);

  // Fetch public lesson plans
  const {
    data: publicLessonPlansData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['public-lesson-plans'],
    queryFn: getPublicLessonPlans,
  });

  useEffect(() => {
    if (error) {
      toast.error('Failed to load public lesson plans');
    }
  }, [error]);

  const publicLessonPlans = publicLessonPlansData?.lessonPlans || [];

  // Fetch user information for each lesson plan creator
  const userQueries = useQueries({
    queries: publicLessonPlans.map(plan => ({
      ...userByIdQueryOptions(plan.userId),
      staleTime: Infinity,
    })),
  });

  // Create a map of user IDs to user names
  const userMap = publicLessonPlans.reduce((map, plan, index) => {
    const userData = userQueries[index].data;
    if (userData) {
      const fullName = userData.given_name && userData.family_name
        ? `${userData.given_name} ${userData.family_name}`
        : userData.given_name || 'Community Member';
      map[plan.userId] = fullName;
    }
    return map;
  }, {} as Record<string, string>);

  // Filter lesson plans based on search query
  const filteredLessonPlans = publicLessonPlans.filter(plan =>
    plan.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(INITIAL_DISPLAY_COUNT);
  }, [searchQuery]);

  // Get the lessons to display based on current display count
  const visibleLessonPlans = filteredLessonPlans.slice(0, displayCount);
  const hasMoreLessons = filteredLessonPlans.length > displayCount;
  const remainingCount = filteredLessonPlans.length - displayCount;

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + LOAD_MORE_COUNT);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleViewCombinedMdx = (id: number) => {
    window.open(`/combined-mdx?id=${id}`, '_blank');
  };

  const handleViewLessonPlan = (id: number, ownerId: string, isPublicPlan: boolean) => {
    if (!isAuthenticated) {
      // For unauthenticated users, open combined view
      handleViewCombinedMdx(id);
      return;
    }

    const isOwnLessonPlan = ownerId === user?.id;
    setIsReadOnly(!isOwnLessonPlan);

    const isPublic = !isOwnLessonPlan && isPublicPlan;

    if (isPublic) {
      useLessonPlanStore.setState({ isLoadingPublicLesson: true });
    }

    setLessonPlanToLoad(id);
    navigate({
      to: '/lesson-plan',
      search: {},
      state: {
        lessonPlanId: id,
        isPublic: isPublic,
        fromDashboard: true
      }
    } as any);
  };

  return (
    <div className="flex flex-col min-h-screen w-full">
      {/* Hero Section */}
      <section className="relative py-16 px-4 overflow-hidden">
        <div className="container mx-auto max-w-4xl relative z-10">
          <div className="text-center">
            <h1
              className="font-brand text-4xl md:text-5xl tracking-tight mb-4"
              style={{
                background: 'linear-gradient(135deg, #22c55e, #4ade80, #86efac, #22c55e)',
                backgroundSize: '300% 300%',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'iridescent 8s ease-in-out infinite',
              }}
            >
              Explore
            </h1>
            <p className="text-sm text-white/35 max-w-md mx-auto mb-8">
              Lesson plans shared by the community
            </p>

            {/* Search */}
            <div className="max-w-md mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
              <input
                type="text"
                placeholder="Search lessons..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="glass-input w-full h-11 pl-11 pr-4 text-sm"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-4 pb-4">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center justify-center gap-6 text-xs text-white/30">
            <div className="flex items-center gap-1.5">
              <Layers className="h-3 w-3" style={{ color: '#22c55e' }} />
              <span className="text-white/50 font-medium">{publicLessonPlans.length}</span>
              <span>lessons</span>
            </div>
          </div>
        </div>
      </section>

      {/* Lesson Plans Grid */}
      <section className="px-4 pb-20">
        <div className="container mx-auto max-w-4xl">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="glass-card p-5 animate-pulse">
                  <div className="h-4 bg-white/[0.04] rounded w-3/4 mb-3" />
                  <div className="h-3 bg-white/[0.03] rounded w-1/2 mb-2" />
                  <div className="h-3 bg-white/[0.03] rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : filteredLessonPlans.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleLessonPlans.map((plan) => {
                  const isOwnPlan = user?.id && plan.userId === user.id;
                  return (
                    <div
                      key={plan.id}
                      className="glass-card liquid-glow p-5 group flex flex-col"
                    >
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2.5">
                          <h3 className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors leading-tight flex-1 mr-2">
                            {plan.name}
                          </h3>
                          {isOwnPlan && (
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                              style={{
                                background: 'rgba(34, 197, 94, 0.08)',
                                border: '1px solid rgba(34, 197, 94, 0.15)',
                                color: '#22c55e',
                              }}
                            >
                              Yours
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/25 mb-3">
                          <div className="flex items-center gap-1">
                            <User className="h-2.5 w-2.5" />
                            <span>{isOwnPlan ? 'You' : userMap[plan.userId] || 'Community Member'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-2.5 w-2.5" />
                            <span>{formatDate(plan.createdAt)}</span>
                          </div>
                        </div>

                        <div
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] mb-3"
                          style={{
                            background: 'rgba(34, 197, 94, 0.04)',
                            border: '1px solid rgba(34, 197, 94, 0.08)',
                            color: 'rgba(34, 197, 94, 0.7)',
                          }}
                        >
                          <Layers className="h-2.5 w-2.5 mr-1" />
                          {plan.topics.length} {plan.topics.length === 1 ? 'topic' : 'topics'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <button
                          onClick={() => handleViewCombinedMdx(plan.id)}
                          className="glass-btn flex-1 h-8 text-xs font-medium flex items-center justify-center gap-1.5"
                        >
                          <FileCode className="h-3 w-3" />
                          Read
                        </button>
                        <button
                          onClick={() => handleViewLessonPlan(plan.id, plan.userId, plan.isPublic ?? false)}
                          className="flex-1 h-8 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 text-black transition-all duration-300 hover:scale-[1.02]"
                          style={{
                            background: 'linear-gradient(135deg, #22c55e, #4ade80)',
                          }}
                        >
                          {isAuthenticated ? (isOwnPlan ? 'Edit' : 'View') : 'Read'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load More */}
              {hasMoreLessons && (
                <div className="flex flex-col items-center justify-center pt-10">
                  <p className="text-[11px] text-white/20 mb-3">
                    Showing {visibleLessonPlans.length} of {filteredLessonPlans.length}
                  </p>
                  <button
                    onClick={handleLoadMore}
                    className="glass-btn h-9 px-5 text-xs font-medium flex items-center gap-2"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                    More ({remainingCount})
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20">
              {searchQuery.trim() ? (
                <div>
                  <Search className="h-10 w-10 mx-auto mb-4 text-white/8" />
                  <p className="text-white/30 mb-4 text-sm">No results for "{searchQuery}"</p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="glass-btn h-8 px-4 text-xs font-medium"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <div>
                  <BookMarked className="h-10 w-10 mx-auto mb-4 text-white/8" />
                  <p className="text-white/30 text-sm">No public lessons yet</p>
                  {isAuthenticated && (
                    <p className="text-white/20 text-xs mt-2">Create one and make it public</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
