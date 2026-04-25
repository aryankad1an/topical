import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { MDXRenderer } from '@/components/mdxRenderer';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SavedLessonTopic } from '@/stores/lessonPlanStore';
import { getLessonPlanById, getPublicLessonPlanById, LessonPlanResponse, getUserById } from '@/lib/api';
// import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  FileText,
  BookOpen,
  Loader2,
  FileCode,
  ArrowLeft,
  Download,
} from 'lucide-react';

export const Route = createFileRoute('/combined-mdx')({
  component: CombinedMdxPage,
});

function CombinedMdxPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [lessonPlan, setLessonPlan] = useState<LessonPlanResponse | null>(null);
  const [combinedMdxContent, setCombinedMdxContent] = useState('');
  const [contributorName, setContributorName] = useState<string | null>(null);
  // const navigate = useNavigate();

  // Get the lesson plan ID from the URL search params
  const searchParams = new URLSearchParams(window.location.search);
  const lessonPlanId = searchParams.get('id');

  // Fetch the lesson plan data
  useEffect(() => {
    async function fetchLessonPlan() {
      if (!lessonPlanId) {
        setIsLoading(false);
        return;
      }

      try {
        const id = parseInt(lessonPlanId);

        // First try to get the lesson plan as a private lesson plan
        let response = await getLessonPlanById(id);

        // If there's an error, try to get it as a public lesson plan
        if ('error' in response) {
          console.log('Private lesson plan not found, trying public endpoint');
          response = await getPublicLessonPlanById(id);

          // If still error, show error message
          if ('error' in response) {
            console.error('Error fetching lesson plan:', response.error);
            toast.error('Lesson plan not found or you do not have permission to view it');
            setIsLoading(false);
            return;
          }
        }

        setLessonPlan(response);

        // Generate the combined MDX content
        const combinedContent = generateCombinedMdxContent(response);
        setCombinedMdxContent(combinedContent);

        // Fetch contributor information
        if (response.userId) {
          try {
            const userData = await getUserById(response.userId);
            if (userData) {
              const fullName = userData.given_name && userData.family_name
                ? `${userData.given_name} ${userData.family_name}`
                : userData.given_name || null;
              setContributorName(fullName);
            }
          } catch (error) {
            console.error('Error fetching contributor information:', error);
            // Continue without contributor name
          }
        }
      } catch (error) {
        console.error('Error fetching lesson plan:', error);
        toast.error('Failed to load lesson plan');
      } finally {
        setIsLoading(false);
      }
    }

    fetchLessonPlan();
  }, [lessonPlanId]);

  // Generate combined MDX content from a lesson plan
  const generateCombinedMdxContent = (lessonPlan: LessonPlanResponse): string => {
    if (!lessonPlan || !lessonPlan.topics || lessonPlan.topics.length === 0) {
      return `# ${lessonPlan.name}\n\nNo content available for this lesson plan.`;
    }

    // Start with the lesson plan name as the main heading
    let combinedContent = `# ${lessonPlan.name}\n\n`;

    // Add contributor information if available
    if (contributorName) {
      combinedContent += `*Created by ${contributorName}*\n\n`;
    }

    // Sort topics by order if available, otherwise maintain the original order
    const sortedTopics = [...lessonPlan.topics].sort((a, b) => {
      // Use type assertion to handle the order property
      const topicA = a as SavedLessonTopic;
      const topicB = b as SavedLessonTopic;

      // If both topics have order field, use it
      if (topicA.order !== undefined && topicB.order !== undefined) {
        return topicA.order - topicB.order;
      }
      // If only one has order, prioritize the one with order
      if (topicA.order !== undefined) return -1;
      if (topicB.order !== undefined) return 1;
      // Otherwise, keep original order
      return 0;
    });

    // Create a map of topics by their order in the hierarchy
    const topicMap = new Map<string, any[]>();
    const mainTopics: {
      topic: string;
      mdxContent: string;
      isSubtopic: boolean;
      parentTopic?: string;
      mainTopic?: string;
      order?: number;
    }[] = [];

    // First, identify all main topics and create a map for quick lookup
    // Preserve the sorted order
    sortedTopics.forEach(topic => {
      if (!topic.isSubtopic) {
        mainTopics.push(topic);
        // Initialize with empty array for subtopics
        topicMap.set(topic.topic, []);
      }
    });

    // Then, add all subtopics to their parent topics
    // Collect subtopics by parent topic
    const subtopicsByParent = new Map<string, any[]>();

    sortedTopics.forEach(topic => {
      if (topic.isSubtopic && topic.parentTopic) {
        if (!subtopicsByParent.has(topic.parentTopic)) {
          subtopicsByParent.set(topic.parentTopic, []);
        }
        subtopicsByParent.get(topic.parentTopic)?.push(topic);
      }
    });

    // Add subtopics to their parent topics in the sorted order
    for (const [parentTopic, subtopics] of subtopicsByParent.entries()) {
      // Sort subtopics by order if available
      const sortedSubtopics = [...subtopics].sort((a, b) => {
        // Use type assertion to handle the order property
        const topicA = a as SavedLessonTopic;
        const topicB = b as SavedLessonTopic;

        if (topicA.order !== undefined && topicB.order !== undefined) {
          return topicA.order - topicB.order;
        }
        if (topicA.order !== undefined) return -1;
        if (topicB.order !== undefined) return 1;
        return 0;
      });
      topicMap.set(parentTopic, sortedSubtopics);
    }

    // Process main topics in the order they appear in the original array
    mainTopics.forEach(topic => {
      // Add topic as heading
      combinedContent += `## ${topic.topic}\n\n`;

      // Add MDX content if available
      if (topic.mdxContent && topic.mdxContent.trim()) {
        combinedContent += `${topic.mdxContent.trim()}\n\n`;
      } else {
        combinedContent += `*No content available for this topic.*\n\n`;
      }

      // Add related subtopics
      const relatedSubtopics = topicMap.get(topic.topic) || [];

      if (relatedSubtopics.length > 0) {
        relatedSubtopics.forEach(subtopic => {
          // Add subtopic as subheading
          combinedContent += `### ${subtopic.topic}\n\n`;

          // Add MDX content if available
          if (subtopic.mdxContent && subtopic.mdxContent.trim()) {
            combinedContent += `${subtopic.mdxContent.trim()}\n\n`;
          } else {
            combinedContent += `*No content available for this subtopic.*\n\n`;
          }
        });
      }
    });

    return combinedContent;
  };

  // Handle downloading the MDX content
  const handleDownload = () => {
    if (!lessonPlan || !combinedMdxContent) return;

    const fileName = `${lessonPlan.name.replace(/\s+/g, '-').toLowerCase()}-combined.mdx`;
    const blob = new Blob([combinedMdxContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border py-3 sm:py-4 px-3 sm:px-6 bg-card">
        <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <div className="flex items-center">
            <FileCode className="h-5 w-5 sm:h-6 sm:w-6 text-primary mr-2 flex-shrink-0" />
            <div className="overflow-hidden">
              <h1 className="text-lg sm:text-xl font-bold truncate">
                {isLoading ? 'Loading...' : lessonPlan ? `Combined MDX: ${lessonPlan.name}` : 'Combined MDX Content'}
              </h1>
              {contributorName && lessonPlan && (
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Published by {contributorName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={isLoading || !lessonPlan}
              className="flex items-center h-8 text-xs sm:text-sm"
            >
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
              <span className="hidden xs:inline">Download</span> MDX
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.close()}
              className="flex items-center h-8 text-xs sm:text-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
              Close
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-3 sm:p-6">
        <div className="max-w-7xl mx-auto w-full">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 sm:py-12">
              <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 animate-spin text-primary mb-3 sm:mb-4" />
              <p className="text-muted-foreground text-sm sm:text-base">Loading lesson plan content...</p>
            </div>
          ) : !lessonPlan ? (
            <div className="text-center py-8 sm:py-12 bg-muted/30 rounded-lg border border-border">
              <p className="text-lg sm:text-xl font-medium mb-2">Lesson plan not found</p>
              <p className="text-muted-foreground mb-4 sm:mb-6 text-sm sm:text-base">The requested lesson plan could not be loaded.</p>
              <Button onClick={() => window.close()} size="sm" className="text-xs sm:text-sm">Close Window</Button>
            </div>
          ) : (
            <Tabs defaultValue="preview" className="w-full">
              <TabsList className="w-full max-w-xs sm:max-w-md mx-auto mb-4 sm:mb-6 grid grid-cols-2">
                <TabsTrigger value="code" className="py-2 sm:py-3 text-xs sm:text-sm">
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden xs:inline">MDX</span> Code
                </TabsTrigger>
                <TabsTrigger value="preview" className="py-2 sm:py-3 text-xs sm:text-sm">
                  <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Preview
                </TabsTrigger>
              </TabsList>

              <TabsContent value="code" className="mt-0">
                <div className="relative">
                  <pre className="p-3 sm:p-6 rounded-lg bg-muted/50 overflow-auto font-mono text-xs sm:text-sm whitespace-pre-wrap border border-border min-h-[300px] sm:min-h-[500px]">
                    {combinedMdxContent}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="mt-0">
                <div className="rounded-lg border border-border bg-card p-4 sm:p-8 min-h-[300px] sm:min-h-[500px]">
                  <div className="prose prose-sm sm:prose-base md:prose-lg dark:prose-invert max-w-none">
                    <MDXRenderer content={combinedMdxContent} />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
    </div>
  );
}
