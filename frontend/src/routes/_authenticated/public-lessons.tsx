import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getPublicLessonPlans, checkIfLessonPlanIsPublic, getPublicLessonPlanById, userByIdQueryOptions, saveLessonPlan } from '@/lib/api';
import { useNavigate } from '@tanstack/react-router';
import { useLessonPlanStore } from '@/stores/lessonPlanStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BookMarked, Calendar, Search, User, FileCode, Loader2, Lock, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute('/_authenticated/public-lessons')({
  component: PublicLessons,
});

function PublicLessons() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const setLessonPlanToLoad = useLessonPlanStore((state) => state.setLessonPlanToLoad);
  const setIsReadOnly = useLessonPlanStore((state) => state.setIsReadOnly);

  // State for make private confirmation dialog
  const [showMakePrivateDialog, setShowMakePrivateDialog] = useState(false);
  const [lessonToMakePrivate, setLessonToMakePrivate] = useState<{id: number, name: string, topics: any[]} | null>(null);
  const [isMakingPrivate, setIsMakingPrivate] = useState(false);

  // Pagination state
  const INITIAL_DISPLAY_COUNT = 6;
  const LOAD_MORE_COUNT = 6;
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);

  // Fetch public lesson plans
  const {
    data: publicLessonPlansData,
    isLoading: isPublicLessonPlansLoading,
    error: publicLessonPlansError,
    /* refetch: refetchPublicLessonPlans */
  } = useQuery({
    queryKey: ['public-lesson-plans'],
    queryFn: getPublicLessonPlans,
  });

  // Log the public lesson plans data when it changes
  useEffect(() => {
    if (publicLessonPlansData) {
      console.log('Public lesson plans data:', {
        count: publicLessonPlansData.lessonPlans?.length || 0,
        plans: publicLessonPlansData.lessonPlans?.map(plan => ({
          id: plan.id,
          name: plan.name,
          isPublic: plan.isPublic,
          userId: plan.userId
        }))
      });
    }
  }, [publicLessonPlansData]);

  // Show error toast if data fetch fails
  useEffect(() => {
    if (publicLessonPlansError) {
      toast.error('Failed to load public lesson plans');
    }
  }, [publicLessonPlansError]);

  const publicLessonPlans = publicLessonPlansData?.lessonPlans || [];
  const totalPublicLessonPlans = publicLessonPlans.length;
  const myPublicLessonPlans = publicLessonPlans.filter(plan => plan.userId === user?.id).length;
  const [showOnlyMine, setShowOnlyMine] = useState(false);

  // Fetch user information for each lesson plan creator
  const userQueries = useQueries({
    queries: publicLessonPlans.map(plan => ({
      ...userByIdQueryOptions(plan.userId),
      staleTime: Infinity, // Cache user data indefinitely for this session
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

  // Filter lesson plans based on search query and "show only mine" toggle
  const filteredLessonPlans = publicLessonPlans.filter(plan => {
    const matchesSearch = plan.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMineFilter = showOnlyMine ? plan.userId === user?.id : true;
    return matchesSearch && matchesMineFilter;
  });

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(INITIAL_DISPLAY_COUNT);
  }, [searchQuery, showOnlyMine]);

  // Get the lessons to display based on current display count
  const visibleLessonPlans = filteredLessonPlans.slice(0, displayCount);
  const hasMoreLessons = filteredLessonPlans.length > displayCount;
  const remainingCount = filteredLessonPlans.length - displayCount;

  // Handle loading more lessons
  const handleLoadMore = () => {
    setDisplayCount(prev => prev + LOAD_MORE_COUNT);
  };

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Function to handle viewing combined MDX content
  const handleViewCombinedMdx = (id: number) => {
    // Open the combined MDX page in a new tab with the lesson plan ID
    window.open(`/combined-mdx?id=${id}`, '_blank');
  };

  // Handle viewing a lesson plan
  const handleViewLessonPlan = (id: number, ownerId: string, isPublicPlan: boolean) => {
    // Set read-only mode if the lesson plan belongs to another user
    const isOwnLessonPlan = ownerId === user?.id;
    setIsReadOnly(!isOwnLessonPlan);

    // If it's not the user's own lesson plan, we need to load it as a public lesson
    // But only if it's actually marked as public
    const isPublic = !isOwnLessonPlan && isPublicPlan;

    console.log('Viewing lesson plan:', {
      id,
      ownerId,
      isOwnLessonPlan,
      isPublic,
      isPublicPlan,
      currentUserId: user?.id
    });

    // If it's not public and not the user's own, show an error
    if (!isOwnLessonPlan && !isPublicPlan) {
      toast.error('This lesson plan is not public and does not belong to you');
      return;
    }

    // Set the isLoadingPublicLesson flag in the store if needed
    if (isPublic) {
      useLessonPlanStore.setState({ isLoadingPublicLesson: true });
    }

    // Set the lesson plan to load and navigate to the lesson plan page
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

  // Handle opening the make private confirmation dialog
  const openMakePrivateDialog = (plan: {id: number, name: string, topics: any[]}) => {
    setLessonToMakePrivate(plan);
    setShowMakePrivateDialog(true);
  };

  // Handle making a lesson plan private
  const handleMakeLessonPrivate = async () => {
    if (!lessonToMakePrivate) return;

    setIsMakingPrivate(true);
    try {
      // Create an updated lesson plan with isPublic set to false
      const updatedLessonPlan = {
        id: lessonToMakePrivate.id,
        name: lessonToMakePrivate.name,
        mainTopic: lessonToMakePrivate.name, // Using name as mainTopic since we don't have it
        topics: lessonToMakePrivate.topics,
        isPublic: false
      };

      // Save the updated lesson plan
      await saveLessonPlan(updatedLessonPlan);

      // Invalidate the public lesson plans query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['public-lesson-plans'] });

      toast.success(`"${lessonToMakePrivate.name}" is now private. You can make it public again from your Dashboard.`);
      setShowMakePrivateDialog(false);
      setLessonToMakePrivate(null);
    } catch (error) {
      console.error('Error making lesson plan private:', error);
      toast.error('Failed to make lesson plan private');
    } finally {
      setIsMakingPrivate(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Public Lessons</h1>
      <p className="text-muted-foreground mb-6 sm:mb-8 text-sm sm:text-base">
        Browse lesson plans shared by the community
      </p>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <Card>
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg font-medium">Available Public Lessons</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Lesson plans shared by the community</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="flex items-center">
              <BookMarked className="h-6 w-6 sm:h-8 sm:w-8 text-primary mr-2 sm:mr-3" />
              {isPublicLessonPlansLoading ? (
                <Skeleton className="h-8 sm:h-10 w-16 sm:w-20" />
              ) : (
                <span className="text-2xl sm:text-3xl font-bold">{totalPublicLessonPlans}</span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg font-medium">Your Public Lessons</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Lesson plans you've shared publicly</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <User className="h-6 w-6 sm:h-8 sm:w-8 text-primary mr-2 sm:mr-3" />
                {isPublicLessonPlansLoading ? (
                  <Skeleton className="h-8 sm:h-10 w-16 sm:w-20" />
                ) : (
                  <span className="text-2xl sm:text-3xl font-bold">{myPublicLessonPlans}</span>
                )}
              </div>
              {myPublicLessonPlans > 0 && (
                <Button
                  size="sm"
                  variant={showOnlyMine ? "default" : "outline"}
                  onClick={() => setShowOnlyMine(!showOnlyMine)}
                  className="text-xs"
                >
                  {showOnlyMine ? 'Show All' : 'Show Mine'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Public Lesson Plans */}
      <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Browse Public Lesson Plans</h2>
      <Card>
        <CardHeader className="pb-2 px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg">Community Lesson Plans</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Search and explore lesson plans shared by the community
          </CardDescription>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-2 mt-3 sm:mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search public lesson plans..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-sm"
              />
            </div>
            {showOnlyMine && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowOnlyMine(false)}
                className="text-xs flex items-center gap-1 whitespace-nowrap"
              >
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                Showing your lessons only
                <span className="ml-1">×</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {isPublicLessonPlansLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredLessonPlans.length > 0 ? (
            <div className="space-y-4">
              {visibleLessonPlans.map((plan) => {
                const isOwnPlan = plan.userId === user?.id;
                return (
                  <div 
                    key={plan.id} 
                    className={`flex flex-col sm:flex-row sm:items-start sm:justify-between border-b pb-3 last:border-0 gap-3 sm:gap-2 rounded-lg p-3 -mx-3 transition-colors
                      ${isOwnPlan 
                        ? 'bg-primary/5 border-l-4 border-l-primary border-b-0 last:border-b-0' 
                        : 'hover:bg-muted/30'
                      }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm sm:text-base">{plan.name}</h3>
                        {isOwnPlan && (
                          <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-medium">
                            Your Lesson
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center text-xs sm:text-sm text-muted-foreground gap-1 sm:gap-0 mt-1">
                        <div className="flex items-center mr-2">
                          <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span>{formatDate(plan.createdAt)}</span>
                        </div>
                        <div className="flex items-center mr-2">
                          <User className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span className={`truncate max-w-[150px] sm:max-w-none ${isOwnPlan ? 'text-primary font-medium' : ''}`}>
                            {isOwnPlan ? 'You' : userMap[plan.userId] || 'Community Member'}
                          </span>
                        </div>
                        <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full inline-flex items-center">
                          {plan.topics.length} {plan.topics.length === 1 ? 'topic' : 'topics'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-start mt-1 sm:mt-0 flex-wrap justify-end">
                      {isOwnPlan && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openMakePrivateDialog({id: plan.id, name: plan.name, topics: plan.topics})}
                          className="flex items-center h-8 px-2 sm:px-3 text-amber-600 border-amber-300 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-950"
                          title="Make this lesson plan private"
                        >
                          <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Make Private</span>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewCombinedMdx(plan.id)}
                        className="flex items-center hover:bg-primary/10 hover:text-primary h-8 px-2 sm:px-3"
                        title="View all MDX content combined in one document"
                      >
                        <FileCode className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Combined</span>
                      </Button>
                      <Button
                        size="sm"
                        variant={isOwnPlan ? "default" : "default"}
                        onClick={() => handleViewLessonPlan(plan.id, plan.userId, plan.isPublic ?? false)}
                        className={`h-8 ${isOwnPlan ? 'bg-primary hover:bg-primary/90' : ''}`}
                      >
                        {isOwnPlan ? 'Edit' : 'View'}
                      </Button>
                    </div>
                  </div>
                );
              })}
              
              {/* View More Button */}
              {hasMoreLessons && (
                <div className="flex flex-col items-center justify-center pt-6 pb-2 border-t mt-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    Showing {visibleLessonPlans.length} of {filteredLessonPlans.length} lesson plans
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    className="min-w-[200px]"
                  >
                    View More ({remainingCount} remaining)
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 sm:py-6">
              {searchQuery.trim() ? (
                <div>
                  <Search className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-20" />
                  <p className="text-muted-foreground mb-3 sm:mb-4 text-sm">No public lesson plans found matching "{searchQuery}"</p>
                  <Button variant="outline" onClick={() => setSearchQuery('')} size="sm" className="text-xs sm:text-sm">
                    Clear Search
                  </Button>
                </div>
              ) : (
                <div>
                  <p className="text-muted-foreground mb-3 sm:mb-4 text-sm">No public lesson plans available yet</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Make Private Confirmation Dialog */}
      <Dialog open={showMakePrivateDialog} onOpenChange={setShowMakePrivateDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Make Lesson Private?
            </DialogTitle>
            <DialogDescription className="pt-2">
              Are you sure you want to make <strong>"{lessonToMakePrivate?.name}"</strong> private?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
            <p className="text-amber-800 dark:text-amber-200">
              <strong>Important:</strong> Once private, this lesson will be removed from the public list and can only be made public again from your <strong>Dashboard</strong>.
            </p>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowMakePrivateDialog(false);
                setLessonToMakePrivate(null);
              }}
              disabled={isMakingPrivate}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleMakeLessonPrivate}
              disabled={isMakingPrivate}
              className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isMakingPrivate ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Making Private...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Yes, Make Private
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
