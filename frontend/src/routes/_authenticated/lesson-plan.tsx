import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  searchTopics,
  generateSingleTopic,
  generateSingleTopicRaw,
  generateMdxFromUrlsRaw,
  generateMdxLlmOnlyRaw,
  refineWithSelectionRaw,
  refineWithCrawlingRaw,
  refineWithUrlsRaw,
  getSavedTopics,
  saveLessonPlan,
  getLessonPlanById,
  getPublicLessonPlanById
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { stripFrontmatter } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { MDXRenderer } from '@/components/mdxRenderer';
import { Loader2, Search, X, Maximize2, Minimize2, ChevronLeft, ChevronRight, Link, Save, FilePlus, Plus, FileText, Settings } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useLessonPlanStore, UrlInput, SavedLessonTopic } from '@/stores/lessonPlanStore';
import { DraggableTopicList } from '@/components/DraggableTopicList';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
// Using Dialog component instead of AlertDialog since it's not available

export const Route = createFileRoute('/_authenticated/lesson-plan')({
  component: LessonPlan,
});

export interface Topic {
  topic: string;
  subtopics: string[];
}

// Alias for Topic to match the usage in reconstructHierarchyFromTopics
type TopicHierarchy = Topic;



// UrlInput is now imported from the store

interface MdxResponse {
  status: string;
  data: {
    mdx_content: string;
    crawled_websites?: string[];
  };
}

interface TopicsResponse {
  status: string;
  data: {
    topics: string;
  };
}

// Interface for the response from the API
// eslint-disable-next-line @typescript-eslint/no-unused-vars


// Type guard function to check if the response is a TopicsResponse
function isTopicsResponse(data: unknown): data is TopicsResponse {
  return data !== null &&
    typeof data === 'object' &&
    'status' in data &&
    'data' in data &&
    data.data !== null &&
    typeof data.data === 'object' &&
    'topics' in data.data;
}

// Type guard function to check if the response is an MdxResponse
function isMdxResponse(data: unknown): data is MdxResponse {
  return data !== null &&
    typeof data === 'object' &&
    'status' in data &&
    'data' in data &&
    data.data !== null &&
    typeof data.data === 'object' &&
    'mdx_content' in data.data;
}

// We're using Zustand for state persistence now

function LessonPlan() {
  // Get route state
  const routeContext = Route.useRouteContext();
  // @ts-ignore - state property might not be defined in the type but it exists at runtime
  const state = routeContext.state;
  const fromDashboard = state?.fromDashboard === true;

  // Get current user from auth context
  const { user } = useAuth();

  // Get state and actions from Zustand store
  const {
    searchQuery, setSearchQuery,
    selectedTopic, setSelectedTopic,
    selectedSubtopic, setSelectedSubtopic,
    mainTopic, setMainTopic,
    showRightSidebar, setShowRightSidebar,
    urlInputs, setUrlInputs,
    mdxContent, setMdxContent,
    showEditor, setShowEditor,
    generationMethod, setGenerationMethod,
    lastUsedGenerationMethod, setLastUsedGenerationMethod,
    showGenerationOptions, setShowGenerationOptions,
    editorViewMode, setEditorViewMode,
    isLeftSidebarCollapsed, setIsLeftSidebarCollapsed,
    isRightSidebarCollapsed, setIsRightSidebarCollapsed,
    currentLessonPlan, setCurrentLessonPlan,
    savedTopics, // Add this to access the saved topics
    saveMdxToCurrentLesson,
    hasUnsavedChanges,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    lessonPlanToLoad, setLessonPlanToLoad,
    topicsHierarchy, setTopicsHierarchy, // Add these to access and update the topics hierarchy
    isReadOnly, setIsReadOnly, // Add these to access and update the read-only flag
    resetState
  } = useLessonPlanStore();

  // Local state for UI that doesn't need to persist
  const [isGeneratingMdx, setIsGeneratingMdx] = useState(false);
  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [isSavingMdx, setIsSavingMdx] = useState(false);
  const [hasSavedContent, setHasSavedContent] = useState(false);

  // Mobile-specific state
  const [mobileActivePanel, setMobileActivePanel] = useState<'left' | 'main' | 'right'>('main');

  // Topic management state
  const [showAddTopicDialog, setShowAddTopicDialog] = useState(false);
  const [showAddSubtopicDialog, setShowAddSubtopicDialog] = useState(false);
  const [showDeleteTopicDialog, setShowDeleteTopicDialog] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newSubtopicName, setNewSubtopicName] = useState('');
  const [parentTopicForSubtopic, setParentTopicForSubtopic] = useState<string | null>(null);
  const [topicToDelete, setTopicToDelete] = useState<{topic: string, isSubtopic: boolean, parentTopic?: string} | null>(null);

  // Lesson plan management state
  const [isSavingLessonPlan, setIsSavingLessonPlan] = useState(false);
  const [showSaveConfirmDialog, setShowSaveConfirmDialog] = useState(false);
  const [showLoadConfirmDialog, setShowLoadConfirmDialog] = useState(false);
  const [localLessonPlanToLoad, setLocalLessonPlanToLoad] = useState<number | null>(null);
  const [isLoadingLessonPlan, setIsLoadingLessonPlan] = useState(false);

  // Content refinement states
  const [refinementMethod, setRefinementMethod] = useState<'selection' | 'crawling' | 'urls'>('selection');
  const [refinementQuestion, setRefinementQuestion] = useState('');
  const [selectedEditorText, setSelectedEditorText] = useState('');
  const [originalSelectedText, setOriginalSelectedText] = useState('');
  // We need setRefinedText for the refinement functionality
  const [, setRefinedText] = useState('');
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [isTextRefined, setIsTextRefined] = useState(false);
  const [refinementUrlInputs, setRefinementUrlInputs] = useState<UrlInput[]>([{ value: '', isValid: false }]);
  const [isRefiningMdx, setIsRefiningMdx] = useState(false);
  const [refinementError, setRefinementError] = useState<string | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Drag-and-drop media upload state
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // Upload an image file and insert the Markdown image syntax at the cursor
  const handleMediaDrop = async (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (isReadOnly) return;

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;

    setIsUploadingMedia(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Upload failed' })) as { error: string };
          toast.error(err.error || 'Upload failed');
          continue;
        }
        const { url } = await res.json() as { url: string };
        const altText = file.name.replace(/\.[^.]+$/, '');
        const imageMarkdown = `\n![${altText}](${url})\n`;

        // Insert at cursor position
        const textarea = editorRef.current;
        if (textarea) {
          const start = textarea.selectionStart;
          const before = mdxContent.slice(0, start);
          const after = mdxContent.slice(textarea.selectionEnd);
          const newContent = before + imageMarkdown + after;
          setMdxContent(newContent);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + imageMarkdown.length;
            textarea.focus();
          }, 0);
        } else {
          setMdxContent(mdxContent + imageMarkdown);
        }
        toast.success(`Image "${file.name}" uploaded`);
      }
    } catch {
      toast.error('Image upload failed');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Trigger a file picker for image upload (toolbar button)
  const handleImageUploadClick = () => {
    if (isReadOnly) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async () => {
      if (!input.files?.length) return;
      const fakeEvent = {
        preventDefault: () => {},
        dataTransfer: { files: input.files! }
      } as unknown as React.DragEvent<HTMLTextAreaElement>;
      setIsDraggingOver(false);
      await handleMediaDrop(fakeEvent);
    };
    input.click();
  };


  // Resizable panel state
  const [leftPanelWidth, setLeftPanelWidth] = useState(250); // in pixels
  const [rightPanelWidth, setRightPanelWidth] = useState(280); // in pixels
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Query for searching topics
  const {
    data: topicsData,
    isLoading: isLoadingTopics,
    isError: isTopicsError,
    refetch: refetchTopics,
  } = useQuery({
    queryKey: ['search-topics', searchQuery],
    queryFn: async () => {
      console.log('Fetching topics hierarchy for:', searchQuery);
      
      // Check if we already have a valid saved hierarchy - don't overwrite it!
      const storeState = useLessonPlanStore.getState();
      const hasExistingHierarchy = storeState.usingSavedHierarchy || storeState.hasValidHierarchy;
      const existingHierarchy = storeState.topicsHierarchy;
      
      if (hasExistingHierarchy && existingHierarchy && existingHierarchy.length > 0) {
        console.log('Already have a valid saved hierarchy, skipping API fetch to preserve it');
        return { status: 'success', data: { topics: '' }, skipped: true };
      }
      
      const result = await searchTopics(searchQuery, 3);

      // If the search is successful, parse and store the hierarchy in the Zustand store
      if (result && isTopicsResponse(result) && result.status === 'success') {
        try {
          const topicsString = result.data.topics;
          const jsonMatch = topicsString.match(/```json\n([\s\S]*?)\n```/);

          if (jsonMatch && jsonMatch[1]) {
            const parsedTopics: Topic[] = JSON.parse(jsonMatch[1]);

            // Only update the store if we actually got topics AND we don't already have a saved hierarchy
            if (parsedTopics && Array.isArray(parsedTopics) && parsedTopics.length > 0) {
              // Double-check we still don't have a saved hierarchy (in case it was set during the fetch)
              const currentState = useLessonPlanStore.getState();
              if (!currentState.usingSavedHierarchy && !currentState.hasValidHierarchy) {
                // Store the parsed hierarchy in the Zustand store
                setTopicsHierarchy(parsedTopics);
                console.log('Stored topics hierarchy in Zustand store:', parsedTopics);
              } else {
                console.log('Saved hierarchy was set during fetch, not overwriting');
              }

              // If we don't have a main topic set yet, use the search query
              if (!mainTopic) {
                console.log('Setting main topic to search query:', searchQuery);
                setMainTopic(searchQuery);
              }
            } else {
              console.warn('Parsed topics array is empty or invalid');
            }
          } else {
            console.warn('No JSON match found in topics response');
          }
        } catch (error) {
          console.error("Error parsing topics hierarchy:", error);
        }
      } else {
        console.warn('Topics search response is invalid or unsuccessful');
      }

      return result;
    },
    enabled: false,
  });

  // Query for generating MDX content for a selected topic
  const {
    data: mdxData,
    isLoading: isLoadingMdx,
    isError: isMdxError,
  } = useQuery({
    queryKey: ['generate-mdx', selectedTopic || selectedSubtopic, mainTopic],
    queryFn: () => {
      const selectedTopicValue = selectedTopic || selectedSubtopic || '';
      // Use the tracked mainTopic state
      const mainTopicValue = mainTopic || '';
      console.log('Auto-generating MDX with:', {
        selected_topic: selectedTopicValue,
        main_topic: mainTopicValue
      });
      return generateSingleTopic(selectedTopicValue, mainTopicValue, 2);
    },
    enabled: !!(selectedTopic || selectedSubtopic) && !showRightSidebar && !showEditor,
  });

  // Query for fetching saved topics - only enabled when we don't have a lesson plan loaded
  const {
    data: savedTopicsData,
  } = useQuery({
    queryKey: ['saved-topics'],
    queryFn: () => getSavedTopics(),
    enabled: !currentLessonPlan, // Only fetch when no lesson plan is loaded
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Store the search query as the main topic
      const searchTerm = searchQuery.trim();
      console.log('Setting main topic to search query:', searchTerm);
      setMainTopic(searchTerm);

      // Clear any existing selected topics
      setSelectedTopic(null);
      setSelectedSubtopic(null);

      // Fetch the hierarchy
      console.log('Fetching hierarchy for search term:', searchTerm);
      refetchTopics();
    }
  };

  // Function to check if there's saved content for a topic
  const checkForSavedContent = useCallback((topicName: string) => {
    console.log(`Checking for saved content for topic: ${topicName}`);

    // First check in the current lesson plan in the store
    if (currentLessonPlan?.topics) {
      console.log(`Current lesson plan has ${currentLessonPlan.topics.length} topics`);
      const savedTopic = currentLessonPlan.topics.find(
        (topic) => topic.topic === topicName
      );

      if (savedTopic && savedTopic.mdxContent) {
        console.log(`Found saved content for ${topicName} in current lesson plan`);
        setHasSavedContent(true);
        // If there's saved content, use it - strip frontmatter if present
        setMdxContent(stripFrontmatter(savedTopic.mdxContent));
        setShowEditor(true);

        // Make sure the right sidebar is visible
        setShowRightSidebar(true);

        return true;
      }

      // If we have a current lesson plan but the topic isn't found or has no content,
      // we don't need to check the database since the lesson plan should be complete
      console.log(`No saved content for ${topicName} in current lesson plan`);
      setHasSavedContent(false);
      return false;
    } else {
      console.log('No current lesson plan or no topics in current lesson plan');
    }

    // Only check the database if we don't have a current lesson plan
    // This avoids unnecessary API calls when we already have all the data
    if (!currentLessonPlan && savedTopicsData?.topics && Array.isArray(savedTopicsData.topics)) {
      console.log(`Checking in database (${savedTopicsData.topics.length} topics)`);
      const savedTopic = savedTopicsData.topics.find(
        (topic) => topic.topic === topicName
      );

      if (savedTopic) {
        console.log(`Found saved content for ${topicName} in database`);
        setHasSavedContent(true);
        // If there's saved content, use it - strip frontmatter if present
        setMdxContent(stripFrontmatter(savedTopic.mdxContent));
        setShowEditor(true);

        // Make sure the right sidebar is visible
        setShowRightSidebar(true);

        // Also save to the current lesson plan in the store
        if (savedTopic.mdxContent) {
          saveMdxToCurrentLesson(
            topicName,
            savedTopic.mdxContent,
            !!selectedSubtopic,
            selectedSubtopic ? (mainTopic || undefined) : undefined
          );
        }

        return true;
      }
    } else if (!currentLessonPlan) {
      console.log('No saved topics data available from database');
    }

    console.log(`No saved content found for ${topicName}`);
    setHasSavedContent(false);
    return false;
  }, [
    currentLessonPlan,
    savedTopicsData,
    setHasSavedContent,
    setMdxContent,
    setShowEditor,
    setShowRightSidebar,
    saveMdxToCurrentLesson,
    selectedSubtopic,
    mainTopic
  ]);

  // Function to save MDX content (only to frontend state management)
  const handleSaveMdx = async () => {
    if (!mdxContent.trim()) {
      toast.error('Cannot save empty content');
      return;
    }

    const selectedTopicValue = selectedTopic || selectedSubtopic || '';
    const mainTopicValue = mainTopic || '';
    const isSubtopicValue = !!selectedSubtopic;

    if (!selectedTopicValue || !mainTopicValue) {
      toast.error('Topic information is missing');
      return;
    }

    setIsSavingMdx(true);

    try {
      // Determine parent topic
      // If it's a subtopic, use mainTopic as parent
      // If it's a parent topic, use itself as parent
      const parentTopicValue = isSubtopicValue ? mainTopicValue : selectedTopicValue;

      // Save to the current lesson plan in the store (frontend state management only)
      saveMdxToCurrentLesson(
        selectedTopicValue,
        mdxContent,
        isSubtopicValue,
        parentTopicValue
      );

      // Mark as saved in the UI
      setHasSavedContent(true);
      toast.success('MDX content saved to lesson plan');
    } catch (error) {
      console.error('Error saving MDX content:', error);
      toast.error('Failed to save MDX content');
    } finally {
      setIsSavingMdx(false);
    }
  };

  const handleTopicSelect = (topic: string) => {
    setSelectedTopic(topic);
    setSelectedSubtopic(null);
    // Keep the search query as the main topic instead of setting it to the selected topic
    // setMainTopic(topic);
    setShowRightSidebar(true);

    // Check if there's saved content for this topic in the current lesson plan or database
    const hasSaved = checkForSavedContent(topic);

    if (!hasSaved) {
      setShowEditor(false);
      setMdxContent('');
    }

    setGenerationError(null);
    setShowGenerationOptions(true);
    setLastUsedGenerationMethod(null);

    // If we have a current lesson plan, update the parent topic for this topic
    if (currentLessonPlan) {
      const existingTopic = currentLessonPlan.topics.find(t => t.topic === topic);
      if (existingTopic && !existingTopic.parentTopic) {
        // For parent topics, set parent to itself
        saveMdxToCurrentLesson(
          topic,
          existingTopic.mdxContent,
          false, // Not a subtopic
          topic // Parent topic is itself
        );
      }
    }

    // State is automatically persisted by Zustand
  };

  const handleSubtopicSelect = (subtopic: string, parentTopic: string) => {
    setSelectedSubtopic(subtopic);
    setSelectedTopic(null);
    // Keep the search query as the main topic instead of setting it to the parent topic
    setShowRightSidebar(true);

    // Check if there's saved content for this subtopic in the current lesson plan or database
    const hasSaved = checkForSavedContent(subtopic);

    if (!hasSaved) {
      setShowEditor(false);
      setMdxContent('');
    }

    setGenerationError(null);
    setShowGenerationOptions(true);
    setLastUsedGenerationMethod(null);

    // If we have a current lesson plan, update the parent topic for this subtopic
    if (currentLessonPlan) {
      const existingTopic = currentLessonPlan.topics.find(t => t.topic === subtopic);
      if (existingTopic) {
        // For subtopics, use the provided parentTopic (which comes from the hierarchy)
        // This ensures the correct parent-child relationship is maintained
        if (parentTopic && (!existingTopic.parentTopic || existingTopic.parentTopic !== parentTopic)) {
          saveMdxToCurrentLesson(
            subtopic,
            existingTopic.mdxContent,
            true, // Is a subtopic
            parentTopic // Use the provided parent topic from the hierarchy
          );
        }
      }
    }

    // State is automatically persisted by Zustand
  };

  const handleUrlChange = (index: number, value: string) => {
    const newUrlInputs = [...urlInputs];
    const isValid = /^(http|https):\/\/[^ "]+$/.test(value);
    newUrlInputs[index] = { value, isValid };
    setUrlInputs(newUrlInputs);
  };

  const addUrlInput = () => {
    if (urlInputs.length < 4) {
      setUrlInputs([...urlInputs, { value: '', isValid: false }]);
    }
  };

  const removeUrlInput = (index: number) => {
    if (urlInputs.length > 1) {
      const newUrlInputs = urlInputs.filter((_, i) => i !== index);
      setUrlInputs(newUrlInputs);
    }
  };

  const validateUrls = () => {
    // Check if at least one URL is valid
    const validUrls = urlInputs.filter(url => url.isValid);
    return validUrls.length > 0;
  };

  const generateMdxFromCrawling = async () => {
    setIsGeneratingMdx(true);
    setGenerationError(null);
    try {
      const selectedTopicValue = selectedTopic || selectedSubtopic || '';
      // Use the tracked mainTopic state
      const mainTopicValue = mainTopic || '';

      console.log('Generating MDX with:', {
        selected_topic: selectedTopicValue,
        main_topic: mainTopicValue,
        search_query: searchQuery
      });

      const rawMdx = await generateSingleTopicRaw(selectedTopicValue, mainTopicValue, 3);
      // Strip frontmatter before setting the content
      const cleanedMdx = stripFrontmatter(rawMdx);
      setMdxContent(cleanedMdx);
      setShowEditor(true);
      // Keep the right sidebar visible
      setShowRightSidebar(true);
      // Store the generation method used
      setLastUsedGenerationMethod('crawl');
      // Keep showing generation options
      setShowGenerationOptions(true);

      // State is automatically persisted by Zustand
    } catch (error) {
      console.error('Error generating MDX from crawling:', error);
      setGenerationError('Failed to generate MDX content from crawling. Please try again.');
    } finally {
      setIsGeneratingMdx(false);
    }
  };

  const generateMdxFromUrlsList = async () => {
    if (!validateUrls()) {
      setGenerationError('Please enter at least one valid URL');
      return;
    }

    setIsGeneratingMdx(true);
    setGenerationError(null);
    try {
      const selectedTopicValue = selectedTopic || selectedSubtopic || '';
      // Use the tracked mainTopic state
      const mainTopicValue = mainTopic || '';
      const validUrls = urlInputs.filter(url => url.isValid).map(url => url.value);

      console.log('Generating MDX from URLs with:', {
        urls: validUrls,
        selected_topic: selectedTopicValue,
        main_topic: mainTopicValue
      });

      const rawMdx = await generateMdxFromUrlsRaw(validUrls, selectedTopicValue, mainTopicValue, undefined, true);
      // Strip frontmatter before setting the content
      const cleanedMdx = stripFrontmatter(rawMdx);
      setMdxContent(cleanedMdx);
      setShowEditor(true);
      // Keep the right sidebar visible
      setShowRightSidebar(true);
      // Store the generation method used
      setLastUsedGenerationMethod('urls');
      // Keep showing generation options
      setShowGenerationOptions(true);

      // State is automatically persisted by Zustand
    } catch (error) {
      console.error('Error generating MDX from URLs:', error);
      setGenerationError('Failed to generate MDX content from URLs. Please try again.');
    } finally {
      setIsGeneratingMdx(false);
    }
  };

  const generateMdxFromLlmOnly = async () => {
    setIsGeneratingMdx(true);
    setGenerationError(null);
    try {
      const selectedTopicValue = selectedTopic || selectedSubtopic || '';
      // Use the tracked mainTopic state
      const mainTopicValue = mainTopic || '';

      console.log('Generating MDX with LLM only:', {
        selected_topic: selectedTopicValue,
        main_topic: mainTopicValue
      });

      const rawMdx = await generateMdxLlmOnlyRaw(selectedTopicValue, mainTopicValue);
      // Strip frontmatter before setting the content
      const cleanedMdx = stripFrontmatter(rawMdx);
      setMdxContent(cleanedMdx);
      setShowEditor(true);
      // Keep the right sidebar visible
      setShowRightSidebar(true);
      // Store the generation method used
      setLastUsedGenerationMethod('llm');
      // Keep showing generation options
      setShowGenerationOptions(true);

      // State is automatically persisted by Zustand
    } catch (error) {
      console.error('Error generating MDX using LLM only:', error);
      setGenerationError('Failed to generate MDX content using LLM only. Please try again.');
    } finally {
      setIsGeneratingMdx(false);
    }
  };

  // No need for localStorage functions since we're using Zustand with persist middleware

  // Function to reconstruct hierarchy from lesson plan topics
  const reconstructHierarchyFromTopics = useCallback((topics: SavedLessonTopic[]) => {
    console.log('Reconstructing hierarchy from lesson plan topics:', topics);

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      console.warn('No topics provided to reconstruct hierarchy');
      return [];
    }

    // Group topics by parent
    const topicsByParent: Record<string, SavedLessonTopic[]> = {};

    // First, find all parent topics (where topic === parentTopic or !isSubtopic)
    let parentTopics = topics.filter(t => !t.isSubtopic || t.topic === t.parentTopic);

    // If we don't have any parent topics but have topics, try to infer parent topics
    if (parentTopics.length === 0 && topics.length > 0) {
      console.log('No explicit parent topics found, trying to infer from parentTopic field');

      // Get unique parent topic names from the parentTopic field
      const uniqueParentTopicNames = new Set<string>();
      topics.forEach(topic => {
        if (topic.parentTopic) {
          uniqueParentTopicNames.add(topic.parentTopic);
        }
      });

      console.log('Inferred parent topics:', Array.from(uniqueParentTopicNames));

      // For each unique parent topic name, check if it exists as a topic
      // If not, create a synthetic parent topic
      uniqueParentTopicNames.forEach(parentTopicName => {
        const existingTopic = topics.find(t => t.topic === parentTopicName);
        if (!existingTopic) {
          console.log(`Creating synthetic parent topic for: ${parentTopicName}`);
          parentTopics.push({
            topic: parentTopicName,
            mdxContent: '',
            isSubtopic: false,
            parentTopic: parentTopicName,
            mainTopic: topics[0]?.mainTopic || ''
          });
        } else if (!parentTopics.includes(existingTopic)) {
          console.log(`Adding existing topic as parent: ${parentTopicName}`);
          parentTopics.push(existingTopic);
        }
      });
    }

    // Then group subtopics by their parent
    topics.forEach(topic => {
      if (topic.isSubtopic && topic.parentTopic && topic.parentTopic !== topic.topic) {
        if (!topicsByParent[topic.parentTopic]) {
          topicsByParent[topic.parentTopic] = [];
        }
        topicsByParent[topic.parentTopic].push(topic);
      }
    });

    // If we still don't have any parent topics, use all topics as parent topics
    if (parentTopics.length === 0) {
      console.log('No parent topics found, using all topics as parent topics');
      parentTopics = topics;
    }

    // Create the hierarchy structure
    const hierarchy: TopicHierarchy[] = parentTopics.map(parentTopic => {
      return {
        topic: parentTopic.topic,
        subtopics: (topicsByParent[parentTopic.topic] || []).map(st => st.topic)
      };
    });

    console.log('Reconstructed hierarchy:', hierarchy);
    return hierarchy;
  }, []);

  // Function to load a lesson plan by ID
  const loadLessonPlanById = useCallback(async (id: number, isPublic = false) => {
    setIsLoadingLessonPlan(true);
    try {
      console.log(`Loading lesson plan with ID: ${id}, isPublic: ${isPublic}`);

      // Use the appropriate API endpoint based on whether it's a public lesson
      let response;
      if (isPublic) {
        console.log('Using getPublicLessonPlanById endpoint');
        response = await getPublicLessonPlanById(id);
      } else {
        console.log('Using getLessonPlanById endpoint');
        response = await getLessonPlanById(id);
      }

      // Check if the response is an error
      if ('error' in response) {
        console.error('Error in response:', response.error);

        // If we get a "not found" error and we're not already trying the public endpoint,
        // try the public endpoint as a fallback
        if (response.error.includes('not found') && !isPublic) {
          console.log('Lesson plan not found, trying public endpoint as fallback');
          return loadLessonPlanById(id, true);
        }

        throw new Error(response.error);
      }

      console.log('Successfully fetched lesson plan data:', {
        id: response.id,
        name: response.name,
        mainTopic: response.mainTopic,
        topicsCount: response.topics?.length || 0,
        isPublic: response.isPublic
      });

      // Set read-only mode if the lesson plan belongs to another user or is public
      const isOwnLessonPlan = user?.id === response.userId;
      const shouldBeReadOnly = !isOwnLessonPlan || isPublic;
      console.log(`Setting read-only mode: ${shouldBeReadOnly} (isOwnLessonPlan: ${isOwnLessonPlan}, isPublic: ${isPublic})`);
      setIsReadOnly(shouldBeReadOnly);

      // Set the main topic from the lesson plan
      setMainTopic(response.mainTopic);

      // Set the search query to match the main topic for consistency
      setSearchQuery(response.mainTopic);

      // Make sure the right sidebar is visible
      setShowRightSidebar(true);
      setShowGenerationOptions(true);

      // Set a flag to indicate we're using a saved hierarchy
      // This will prevent automatic API calls to fetch a new hierarchy
      useLessonPlanStore.setState({ usingSavedHierarchy: true });

      // Set the current lesson plan in the store
      // This will also reset the unsaved changes flag
      setCurrentLessonPlan({
        id: response.id,
        name: response.name,
        mainTopic: response.mainTopic,
        topics: response.topics,
        isPublic: response.isPublic,
        createdAt: response.createdAt || undefined,
        updatedAt: response.updatedAt || undefined
      });

      // Reconstruct the hierarchy from the loaded topics
      if (response.topics && response.topics.length > 0) {
        console.log(`Processing ${response.topics.length} topics from the lesson plan`);

        // Set the search query to match the main topic for consistency
        setSearchQuery(response.mainTopic);

        // Update the saved topics list to highlight topics with content
        const savedTopicsList = response.topics
          .filter(topic => topic.mdxContent && topic.mdxContent.trim() !== '')
          .map(topic => topic.topic);

        console.log(`Found ${savedTopicsList.length} topics with content`);

        // Update the savedTopics in the store
        useLessonPlanStore.setState({ savedTopics: savedTopicsList });

        // Reconstruct the hierarchy from the lesson plan topics
        const reconstructedHierarchy = reconstructHierarchyFromTopics(response.topics);

        // Only update the hierarchy if we successfully reconstructed it
        if (reconstructedHierarchy && reconstructedHierarchy.length > 0) {
          console.log('Setting reconstructed hierarchy from lesson plan:', reconstructedHierarchy);
          // Directly update the store to ensure the hierarchy is updated
          useLessonPlanStore.setState({ topicsHierarchy: reconstructedHierarchy });

          // Set a flag to indicate we have a valid hierarchy
          // This will prevent automatic API calls to fetch a new hierarchy
          useLessonPlanStore.setState({ hasValidHierarchy: true });
        } else {
          console.warn('Failed to reconstruct hierarchy from lesson plan topics');
          // Only fetch from API if not a public lesson or if we really need to
          if (!isPublic) {
            console.log('Fetching hierarchy from API for:', response.mainTopic);
            // Make sure the search query is set to the main topic
            setSearchQuery(response.mainTopic);
            // Add a small delay to ensure the search query is updated
            setTimeout(() => {
              refetchTopics();
            }, 100);
          } else {
            console.log('Not fetching hierarchy from API for public lesson to preserve saved hierarchy');
          }
        }
      }

      // If there are topics, select the first one to display
      if (response.topics && response.topics.length > 0) {
        // Find a parent topic (not a subtopic)
        const parentTopic = response.topics.find(t => !t.isSubtopic);

        if (parentTopic) {
          console.log('Selecting parent topic:', parentTopic.topic);
          setSelectedTopic(parentTopic.topic);
          setSelectedSubtopic(null);
          // Strip frontmatter if present
          const cleanedMdx = stripFrontmatter(parentTopic.mdxContent || '');
          setMdxContent(cleanedMdx);
          setShowEditor(!!cleanedMdx);
        } else {
          // If no parent topic, just select the first one
          const firstTopic = response.topics[0];
          console.log('Selecting first topic:', firstTopic.topic, 'isSubtopic:', firstTopic.isSubtopic);

          if (firstTopic.isSubtopic) {
            setSelectedSubtopic(firstTopic.topic);
            setSelectedTopic(null);
          } else {
            setSelectedTopic(firstTopic.topic);
            setSelectedSubtopic(null);
          }

          // Strip frontmatter if present
          const cleanedMdx = stripFrontmatter(firstTopic.mdxContent || '');
          setMdxContent(cleanedMdx);
          setShowEditor(!!cleanedMdx);
        }

        // Force a UI update by triggering a window resize event
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));

          // Check current store state (not stale closure value) for hierarchy
          const currentStoreState = useLessonPlanStore.getState();
          const currentHierarchy = currentStoreState.topicsHierarchy;
          const hasSavedHierarchy = currentStoreState.usingSavedHierarchy || currentStoreState.hasValidHierarchy;

          // We should already have a reconstructed hierarchy from the lesson plan topics,
          // Only fetch if we truly don't have one AND we're not using a saved hierarchy
          if (!hasSavedHierarchy && (!currentHierarchy || !Array.isArray(currentHierarchy) || currentHierarchy.length === 0)) {
            if (!isPublic) {
              console.log('No hierarchy found after loading lesson plan, fetching hierarchy for:', response.mainTopic);
              refetchTopics();
            } else {
              console.log('No hierarchy found for public lesson, but not fetching to preserve saved state');
            }
          } else {
            console.log('Using hierarchy from store after loading lesson plan:', currentHierarchy);
          }
        }, 200);
      }

      // Show success message
      toast.success(`Loaded lesson plan: ${response.name}`);
    } catch (error) {
      console.error('Error loading lesson plan:', error);

      // Show a more specific error message
      if (error instanceof Error) {
        if (error.message.includes('not public')) {
          toast.error('This lesson plan is not public and cannot be viewed');
        } else if (error.message.includes('not found')) {
          toast.error('Lesson plan not found. It may have been deleted or is not accessible.');
        } else {
          toast.error(`Failed to load lesson plan: ${error.message}`);
        }
      } else {
        toast.error('Failed to load lesson plan');
      }

      // Reset the state to clear any partial data
      resetState();
    } finally {
      setIsLoadingLessonPlan(false);
      setShowLoadConfirmDialog(false);
    }
  }, [
    reconstructHierarchyFromTopics,
    setMainTopic,
    setSearchQuery,
    setShowRightSidebar,
    setShowGenerationOptions,
    setCurrentLessonPlan,
    refetchTopics,
    setMdxContent,
    setSelectedSubtopic,
    setSelectedTopic,
    setShowEditor,
    topicsHierarchy,
    user,
    setIsReadOnly,
    resetState
    // setTopicsHierarchy is intentionally omitted as it's a stable reference from Zustand
  ]);

  // Function to handle loading a lesson plan when there are unsaved changes
  const handleLoadLessonPlan = useCallback((id: number, isPublic = false) => {
    console.log(`handleLoadLessonPlan called with id: ${id}, isPublic: ${isPublic}`);

    if (hasUnsavedChanges) {
      // If there are unsaved changes, show confirmation dialog
      setLocalLessonPlanToLoad(id);
      // Store whether it's a public lesson plan
      useLessonPlanStore.setState({ isLoadingPublicLesson: isPublic });
      setShowLoadConfirmDialog(true);
    } else {
      // If no unsaved changes, load directly
      console.log(`No unsaved changes, loading lesson plan directly with isPublic: ${isPublic}`);
      loadLessonPlanById(id, isPublic);
    }
  }, [hasUnsavedChanges, loadLessonPlanById, setLocalLessonPlanToLoad, setShowLoadConfirmDialog]);

  // Handle confirming to discard changes and load the lesson plan
  const handleDiscardAndLoad = () => {
    if (localLessonPlanToLoad) {
      // Get the isLoadingPublicLesson flag from the store
      const isLoadingPublicLesson = useLessonPlanStore.getState().isLoadingPublicLesson;
      console.log(`handleDiscardAndLoad: Loading lesson plan ${localLessonPlanToLoad}, isPublic: ${isLoadingPublicLesson}`);

      // Reset state to clear unsaved changes
      resetState();

      // Reset the flags to ensure we don't use stale data
      useLessonPlanStore.setState({
        isLoadingPublicLesson: false,
        usingSavedHierarchy: false,
        hasValidHierarchy: false
      });

      // Load the lesson plan
      loadLessonPlanById(localLessonPlanToLoad, isLoadingPublicLesson);

      // Close the dialog
      setShowLoadConfirmDialog(false);
    }
  };

  // Check for lesson plan to load from the store
  useEffect(() => {
    if (lessonPlanToLoad !== null) {
      // Get the isLoadingPublicLesson flag from the store
      const isLoadingPublicLesson = useLessonPlanStore.getState().isLoadingPublicLesson;

      console.log(`Found lesson plan to load from store: ${lessonPlanToLoad}, isPublic: ${isLoadingPublicLesson}`);

      // Add a small delay to ensure the component is fully mounted
      setTimeout(() => {
        // If we're coming from the public lessons page, use the isPublic flag
        // or if the state indicates it's a public lesson
        const shouldLoadAsPublic = isLoadingPublicLesson || (state && state.isPublic === true);
        console.log('Loading lesson plan with public flag:', shouldLoadAsPublic);

        // Reset any existing state before loading the new lesson plan
        if (currentLessonPlan && currentLessonPlan.id !== lessonPlanToLoad) {
          console.log('Resetting state before loading new lesson plan');
          resetState();
        }

        handleLoadLessonPlan(lessonPlanToLoad, shouldLoadAsPublic);
        // Clear the lessonPlanToLoad after handling it
        setLessonPlanToLoad(null);
      }, 100);
    }
  }, [lessonPlanToLoad, handleLoadLessonPlan, setLessonPlanToLoad, state, currentLessonPlan, resetState]);

  // Handle loading lesson plan when coming from the dashboard or public lessons page
  useEffect(() => {
    if (fromDashboard || state?.isPublic) {
      // Get the isLoadingPublicLesson flag from the store
      const isLoadingPublicLesson = useLessonPlanStore.getState().isLoadingPublicLesson;

      if (lessonPlanToLoad !== null) {
        toast.info('Loading lesson plan...');
        console.log('Loading lesson plan with ID:', lessonPlanToLoad, 'isPublic:', isLoadingPublicLesson);

        // Add a small delay to ensure the component is fully mounted
        setTimeout(() => {
          // If we're coming from the public lessons page, use the isPublic flag
          // or if the state indicates it's a public lesson
          const shouldLoadAsPublic = isLoadingPublicLesson || (state && state.isPublic === true);
          console.log('Loading lesson plan with public flag:', shouldLoadAsPublic);

          // Reset any existing state before loading the new lesson plan
          if (currentLessonPlan && currentLessonPlan.id !== lessonPlanToLoad) {
            console.log('Resetting state before loading new lesson plan');
            resetState();
          }

          handleLoadLessonPlan(lessonPlanToLoad, shouldLoadAsPublic);
          // Clear the lessonPlanToLoad after handling it
          setLessonPlanToLoad(null);
        }, 200);
      } else if (state && state.lessonPlanId) {
        // Check if there's a lesson plan ID in the route state
        console.log('Found lesson plan ID in route state:', state.lessonPlanId, 'isPublic:', state.isPublic);
        // Check if it's a public lesson plan
        const isPublic = state.isPublic === true;

        // Reset any existing state before loading the new lesson plan
        if (currentLessonPlan && currentLessonPlan.id !== state.lessonPlanId) {
          console.log('Resetting state before loading new lesson plan from route state');
          resetState();
        }

        handleLoadLessonPlan(state.lessonPlanId, isPublic);
      }
    }
  }, [fromDashboard, lessonPlanToLoad, handleLoadLessonPlan, setLessonPlanToLoad, state, currentLessonPlan, resetState]);

  // Check for mobile view and handle resize
  useEffect(() => {
    const checkMobileView = () => {
      const isMobile = window.innerWidth < 768;
      setIsMobileView(isMobile);

      // If switching from mobile to desktop, ensure we're showing the main content
      if (!isMobile && mobileActivePanel !== 'main') {
        setMobileActivePanel('main');
      }
    };

    // Initial check
    checkMobileView();

    // Add resize listener
    window.addEventListener('resize', checkMobileView);

    // Add orientation change listener for mobile devices
    window.addEventListener('orientationchange', checkMobileView);

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkMobileView);
      window.removeEventListener('orientationchange', checkMobileView);
    };
  }, [mobileActivePanel]);

  // Handle panel resizing with mouse events
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      
      if (isResizingLeft) {
        const newWidth = e.clientX - containerRect.left;
        // Constrain between 150px and 400px
        setLeftPanelWidth(Math.max(150, Math.min(400, newWidth)));
      }
      
      if (isResizingRight) {
        // Calculate from the right edge
        const newWidth = containerRect.right - e.clientX;
        // Constrain between 200px and 450px
        setRightPanelWidth(Math.max(200, Math.min(450, newWidth)));
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    if (isResizingLeft || isResizingRight) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLeft, isResizingRight]);

  // Resize handle component
  const ResizeHandle = ({ position, onMouseDown }: { position: 'left' | 'right', onMouseDown: () => void }) => (
    <div
      className={`absolute top-0 ${position === 'left' ? '-right-2' : '-left-2'} w-4 h-full cursor-col-resize group z-20 
        flex items-center justify-center`}
      onMouseDown={(e) => {
        e.preventDefault();
        onMouseDown();
      }}
    >
      {/* Visible drag handle bar */}
      <div className={`w-1 h-full bg-transparent group-hover:bg-primary/40 transition-colors duration-150`} />
      {/* Center grip indicator */}
      <div className={`absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2
        w-4 h-16 rounded-md bg-border/60 group-hover:bg-primary/60 transition-all duration-150 
        flex items-center justify-center shadow-sm opacity-50 group-hover:opacity-100`}>
        <div className="flex flex-col gap-1">
          <div className="w-1 h-1 rounded-full bg-muted-foreground/70" />
          <div className="w-1 h-1 rounded-full bg-muted-foreground/70" />
          <div className="w-1 h-1 rounded-full bg-muted-foreground/70" />
        </div>
      </div>
    </div>
  );

  // Initial load effect - run once when component mounts
  useEffect(() => {
    // Get the usingSavedHierarchy flag from the store
    const usingSavedHierarchy = useLessonPlanStore.getState().usingSavedHierarchy;
    const hasValidHierarchy = useLessonPlanStore.getState().hasValidHierarchy;

    // If we're using a saved hierarchy, don't fetch a new one
    if (usingSavedHierarchy || hasValidHierarchy) {
      console.log('Initial load: Using saved hierarchy, not fetching a new one');

      // If we have a persisted hierarchy but no selected topic, select the first one
      if (!selectedTopic && !selectedSubtopic && topicsHierarchy && Array.isArray(topicsHierarchy) && topicsHierarchy.length > 0) {
        const firstTopic = topicsHierarchy[0];
        console.log('Auto-selecting first topic from saved hierarchy:', firstTopic.topic);
        handleTopicSelect(firstTopic.topic);
      }
      return;
    }

    // Check if we have a mainTopic but no hierarchy data or API response
    if (mainTopic && (!topicsHierarchy || !Array.isArray(topicsHierarchy) || topicsHierarchy.length === 0)) {
      console.log('Initial load: Fetching hierarchy for main topic:', mainTopic);

      // Set search query to match the main topic
      setSearchQuery(mainTopic);

      // Trigger a search to fetch the hierarchy
      setTimeout(() => {
        refetchTopics();
      }, 100);
    } else if (Array.isArray(topicsHierarchy) && topicsHierarchy.length > 0) {
      console.log('Initial load: Using persisted hierarchy from store:', topicsHierarchy);

      // If we have a persisted hierarchy but no selected topic, select the first one
      if (!selectedTopic && !selectedSubtopic && topicsHierarchy.length > 0) {
        const firstTopic = topicsHierarchy[0];
        console.log('Auto-selecting first topic from persisted hierarchy:', firstTopic.topic);
        handleTopicSelect(firstTopic.topic);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array means this runs once on mount

  // Auto-refetch topics if we have a mainTopic but no hierarchy data
  useEffect(() => {
    // Get the usingSavedHierarchy flag from the store
    const usingSavedHierarchy = useLessonPlanStore.getState().usingSavedHierarchy;
    const hasValidHierarchy = useLessonPlanStore.getState().hasValidHierarchy;

    // If we're using a saved hierarchy, don't fetch a new one
    if (usingSavedHierarchy || hasValidHierarchy) {
      console.log('Auto-refetch: Using saved hierarchy, not fetching a new one');
      return;
    }

    if (mainTopic && (!topicsHierarchy || !Array.isArray(topicsHierarchy) || topicsHierarchy.length === 0) && !topicsData) {
      console.log('Auto-refetching topics for:', mainTopic);
      setSearchQuery(mainTopic);
      // Add a small delay to ensure the searchQuery is updated
      setTimeout(() => {
        refetchTopics();
      }, 100);
    }
  }, [mainTopic, topicsHierarchy, topicsData, setSearchQuery, refetchTopics]);

  // Check for saved content when selected topic changes
  useEffect(() => {
    // If a topic is selected, check if it has saved content
    if (selectedTopic) {
      checkForSavedContent(selectedTopic);
    } else if (selectedSubtopic) {
      checkForSavedContent(selectedSubtopic);
    }
  }, [selectedTopic, selectedSubtopic, checkForSavedContent]);

  // Handle content changes
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setMdxContent(newContent);

    // If the content has been saved and is now being edited, update the state
    if (hasSavedContent) {
      // Check if the content has been modified from the saved version
      const currentTopic = selectedTopic || selectedSubtopic || '';

      // Get the saved content from the current lesson plan
      const savedContent = currentLessonPlan?.topics.find(t => t.topic === currentTopic)?.mdxContent;

      if (savedContent && savedContent !== newContent) {
        // Content has been modified from the saved version
        setHasSavedContent(false);
      }
    }

    // If the user manually edits the content, reset the refinement state
    if (isTextRefined) {
      setIsTextRefined(false);
      setRefinedText('');
      setOriginalSelectedText('');
      setSelectionStart(null);
      setSelectionEnd(null);
    }

    // State is automatically persisted by Zustand
  };

  // Handle text selection in the editor
  const handleEditorSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    const selectedText = target.value.substring(target.selectionStart, target.selectionEnd);
    if (selectedText) {
      // Reset any previous refinement state when new text is selected
      if (isTextRefined) {
        setIsTextRefined(false);
        setRefinedText('');
      }

      setSelectedEditorText(selectedText);
      setOriginalSelectedText(selectedText);
      setSelectionStart(target.selectionStart);
      setSelectionEnd(target.selectionEnd);
    }
  };

  // Handle refinement URL changes
  const handleRefinementUrlChange = (index: number, value: string) => {
    const newUrlInputs = [...refinementUrlInputs];
    const isValid = /^(http|https):\/\/[^ "]+$/.test(value);
    newUrlInputs[index] = { value, isValid };
    setRefinementUrlInputs(newUrlInputs);
  };

  // Add refinement URL input
  const addRefinementUrlInput = () => {
    if (refinementUrlInputs.length < 4) {
      setRefinementUrlInputs([...refinementUrlInputs, { value: '', isValid: false }]);
    }
  };

  // Remove refinement URL input
  const removeRefinementUrlInput = (index: number) => {
    if (refinementUrlInputs.length > 1) {
      const newUrlInputs = refinementUrlInputs.filter((_, i) => i !== index);
      setRefinementUrlInputs(newUrlInputs);
    }
  };

  // Validate refinement URLs
  const validateRefinementUrls = () => {
    // Check if at least one URL is valid
    const validUrls = refinementUrlInputs.filter(url => url.isValid);
    return validUrls.length > 0;
  };

  // Refine content with selection
  const refineWithSelection = async () => {
    if (!selectedEditorText) {
      setRefinementError('Please select some text in the editor to refine');
      return;
    }

    if (!refinementQuestion.trim()) {
      setRefinementError('Please enter a question or prompt for refinement');
      return;
    }

    if (selectionStart === null || selectionEnd === null) {
      setRefinementError('Invalid text selection');
      return;
    }

    setIsRefiningMdx(true);
    setRefinementError(null);

    try {
      const selectedTopicValue = selectedTopic || selectedSubtopic || '';
      const mainTopicValue = mainTopic || '';

      console.log('Refining content with selection:', {
        selected_text: selectedEditorText,
        question: refinementQuestion,
        selected_topic: selectedTopicValue,
        main_topic: mainTopicValue
      });

      // Get the refined text from the API
      const response = await refineWithSelectionRaw(
        mdxContent,
        refinementQuestion,
        selectedEditorText,
        selectedTopicValue,
        mainTopicValue
      );

      // Process the response to strip frontmatter if present
      const processedResponse = stripFrontmatter(response);

      // Extract the refined text (the API returns the full document with the selected text replaced)
      const refinedText = processedResponse.substring(selectionStart, processedResponse.length - (mdxContent.length - selectionEnd));
      setRefinedText(refinedText);

      // Update the content
      const newContent = mdxContent.substring(0, selectionStart) +
                         refinedText +
                         mdxContent.substring(selectionEnd);

      setMdxContent(newContent);
      setIsTextRefined(true);

      // Update the selection end to account for the new text length
      setSelectionEnd(selectionStart + refinedText.length);

      // Restore the selection to highlight the refined text
      if (editorRef.current) {
        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.focus();
            editorRef.current.setSelectionRange(selectionStart, selectionStart + refinedText.length);
          }
        }, 0);
      }
    } catch (error) {
      console.error('Error refining content with selection:', error);
      setRefinementError('Failed to refine content. Please try again.');
    } finally {
      setIsRefiningMdx(false);
    }
  };

  // Revert refined text to original
  const revertRefinedText = () => {
    if (!isTextRefined || !originalSelectedText || selectionStart === null || selectionEnd === null) {
      return;
    }

    try {
      // Replace the refined text with the original text
      const newContent = mdxContent.substring(0, selectionStart) +
                         originalSelectedText +
                         mdxContent.substring(selectionEnd);

      setMdxContent(newContent);
      setIsTextRefined(false);
      setRefinedText('');

      // Restore the selection
      if (editorRef.current) {
        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.focus();
            editorRef.current.setSelectionRange(selectionStart, selectionStart + originalSelectedText.length);
          }
        }, 0);
      }

      toast.success('Changes reverted');
    } catch (error) {
      console.error('Error reverting text:', error);
      toast.error('Failed to revert changes');
    }
  };

  // Refine content with crawling
  const refineWithCrawl = async () => {
    if (!selectedEditorText) {
      setRefinementError('Please select some text in the editor to refine');
      return;
    }

    if (!refinementQuestion.trim()) {
      setRefinementError('Please enter a question or prompt for refinement');
      return;
    }

    if (selectionStart === null || selectionEnd === null) {
      setRefinementError('Invalid text selection');
      return;
    }

    setIsRefiningMdx(true);
    setRefinementError(null);

    try {
      const selectedTopicValue = selectedTopic || selectedSubtopic || '';
      const mainTopicValue = mainTopic || '';

      console.log('Refining content with crawling:', {
        selected_text: selectedEditorText,
        question: refinementQuestion,
        selected_topic: selectedTopicValue,
        main_topic: mainTopicValue
      });

      // Get the refined text from the API
      const response = await refineWithCrawlingRaw(
        mdxContent,
        refinementQuestion,
        selectedEditorText,
        selectedTopicValue,
        mainTopicValue,
        2 // Default number of results
      );

      // Process the response to strip frontmatter if present
      const processedResponse = stripFrontmatter(response);

      // Extract the refined text (the API returns the full document with the selected text replaced)
      const refinedText = processedResponse.substring(selectionStart, processedResponse.length - (mdxContent.length - selectionEnd));
      setRefinedText(refinedText);

      // Update the content
      const newContent = mdxContent.substring(0, selectionStart) +
                         refinedText +
                         mdxContent.substring(selectionEnd);

      // Force a reflow to ensure the layout updates correctly
      setTimeout(() => {
        setMdxContent(newContent);
        setIsTextRefined(true);

        // Force another reflow to ensure content is properly laid out
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
        }, 100);
      }, 50);

      // Update the selection end to account for the new text length
      setSelectionEnd(selectionStart + refinedText.length);

      // Restore the selection to highlight the refined text
      if (editorRef.current) {
        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.focus();
            editorRef.current.setSelectionRange(selectionStart, selectionStart + refinedText.length);
          }
        }, 0);
      }
    } catch (error) {
      console.error('Error refining content with crawling:', error);
      setRefinementError('Failed to refine content with crawling. Please try again.');
    } finally {
      setIsRefiningMdx(false);
    }
  };

  // Refine content with URLs
  const refineWithUrlsList = async () => {
    if (!selectedEditorText) {
      setRefinementError('Please select some text in the editor to refine');
      return;
    }

    if (!refinementQuestion.trim()) {
      setRefinementError('Please enter a question or prompt for refinement');
      return;
    }

    if (!validateRefinementUrls()) {
      setRefinementError('Please enter at least one valid URL');
      return;
    }

    if (selectionStart === null || selectionEnd === null) {
      setRefinementError('Invalid text selection');
      return;
    }

    setIsRefiningMdx(true);
    setRefinementError(null);

    try {
      const selectedTopicValue = selectedTopic || selectedSubtopic || '';
      const mainTopicValue = mainTopic || '';
      const validUrls = refinementUrlInputs.filter(url => url.isValid).map(url => url.value);

      console.log('Refining content with URLs:', {
        selected_text: selectedEditorText,
        question: refinementQuestion,
        selected_topic: selectedTopicValue,
        main_topic: mainTopicValue,
        urls: validUrls
      });

      // Get the refined text from the API
      const response = await refineWithUrlsRaw(
        mdxContent,
        refinementQuestion,
        selectedEditorText,
        selectedTopicValue,
        mainTopicValue,
        validUrls
      );

      // Process the response to strip frontmatter if present
      const processedResponse = stripFrontmatter(response);

      // Extract the refined text (the API returns the full document with the selected text replaced)
      const refinedText = processedResponse.substring(selectionStart, processedResponse.length - (mdxContent.length - selectionEnd));
      setRefinedText(refinedText);

      // Update the content
      const newContent = mdxContent.substring(0, selectionStart) +
                         refinedText +
                         mdxContent.substring(selectionEnd);

      // Force a reflow to ensure the layout updates correctly
      setTimeout(() => {
        setMdxContent(newContent);
        setIsTextRefined(true);

        // Force another reflow to ensure content is properly laid out
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
        }, 100);
      }, 50);

      // Update the selection end to account for the new text length
      setSelectionEnd(selectionStart + refinedText.length);

      // Restore the selection to highlight the refined text
      if (editorRef.current) {
        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.focus();
            editorRef.current.setSelectionRange(selectionStart, selectionStart + refinedText.length);
          }
        }, 0);
      }
    } catch (error) {
      console.error('Error refining content with URLs:', error);
      setRefinementError('Failed to refine content with URLs. Please try again.');
    } finally {
      setIsRefiningMdx(false);
    }
  };

  // Toggle fullscreen for editor
  const toggleEditorFullscreen = () => {
    const newState = !isEditorFullscreen;
    setIsEditorFullscreen(newState);

    if (newState) {
      // When entering fullscreen, ensure preview is hidden and set view mode to code
      setIsPreviewFullscreen(false);
      setEditorViewMode('code');
    }

    // Keep the right sidebar visible even in fullscreen mode
    setShowRightSidebar(true);
  };

  // Toggle fullscreen for preview
  const togglePreviewFullscreen = () => {
    const newState = !isPreviewFullscreen;
    setIsPreviewFullscreen(newState);

    if (newState) {
      // When entering fullscreen, ensure editor is hidden and set view mode to preview
      setIsEditorFullscreen(false);
      setEditorViewMode('preview');

      // Force a reflow to ensure the layout updates correctly
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        // Force another reflow after a bit more time to ensure content is centered
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
        }, 100);
      }, 50);
    }

    // Keep the right sidebar visible even in fullscreen mode
    setShowRightSidebar(true);
  };

  // Toggle left sidebar collapse
  const toggleLeftSidebar = () => {
    setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed);
  };

  // Toggle right sidebar collapse
  const toggleRightSidebar = () => {
    setIsRightSidebarCollapsed(!isRightSidebarCollapsed);
  };

  // Function to open the add topic dialog
  const openAddTopicDialog = () => {
    setNewTopicName('');
    setShowAddTopicDialog(true);
  };

  // Function to open the add subtopic dialog
  const openAddSubtopicDialog = (parentTopic: string) => {
    setNewSubtopicName('');
    setParentTopicForSubtopic(parentTopic);
    setShowAddSubtopicDialog(true);
  };

  // Function to open the delete topic dialog
  const openDeleteTopicDialog = (topic: string, isSubtopic: boolean, parentTopic?: string) => {
    setTopicToDelete({ topic, isSubtopic, parentTopic });
    setShowDeleteTopicDialog(true);
  };

  // Function to handle reordering of main topics
  const handleTopicsReordered = (reorderedTopics: Topic[]) => {
    console.log('handleTopicsReordered called with:', reorderedTopics);
    console.log('Current topicsHierarchy:', topicsHierarchy);

    // Update the topics hierarchy in the store
    setTopicsHierarchy(reorderedTopics);

    // Force a re-render by updating a state variable
    // This is a workaround for the UI not updating
    setTimeout(() => {
      // Force a re-render by updating the state
      const updatedTopics = [...reorderedTopics];
      setTopicsHierarchy(updatedTopics);
      console.log('Topics hierarchy updated:', updatedTopics);
    }, 100);

    toast.success('Topics reordered successfully');
  };

  // Function to handle reordering of subtopics
  const handleSubtopicsReordered = (parentTopic: string, reorderedSubtopics: string[]) => {
    console.log('handleSubtopicsReordered called with:', parentTopic, reorderedSubtopics);
    console.log('Current topicsHierarchy:', topicsHierarchy);

    // Find the parent topic in the hierarchy
    const updatedHierarchy = [...topicsHierarchy];
    const parentTopicIndex = updatedHierarchy.findIndex(t => t.topic === parentTopic);

    if (parentTopicIndex === -1) {
      toast.error('Parent topic not found');
      return;
    }

    // Update the subtopics array for the parent topic
    updatedHierarchy[parentTopicIndex].subtopics = reorderedSubtopics;

    // Update the hierarchy in the store
    setTopicsHierarchy(updatedHierarchy);

    // Force a re-render by updating a state variable
    // This is a workaround for the UI not updating
    setTimeout(() => {
      // Force a re-render by updating the state
      const updatedTopics = [...updatedHierarchy];
      setTopicsHierarchy(updatedTopics);
      console.log('Subtopics hierarchy updated:', updatedTopics);
    }, 100);

    toast.success('Subtopics reordered successfully');
  };

  // Function to add a new main topic
  const handleAddTopic = () => {
    if (!newTopicName.trim()) {
      toast.error('Topic name cannot be empty');
      return;
    }

    // Check if the topic already exists
    const topicExists = topicsHierarchy.some(t => t.topic === newTopicName);
    if (topicExists) {
      toast.error('Topic already exists');
      return;
    }

    // Create a new topic and add it to the hierarchy
    const updatedHierarchy = [...topicsHierarchy];
    updatedHierarchy.push({
      topic: newTopicName,
      subtopics: []
    });

    // Update the hierarchy in the store
    setTopicsHierarchy(updatedHierarchy);

    // Add the new topic to savedTopics to ensure it's included in the hierarchy
    const updatedSavedTopics = [...savedTopics, newTopicName];
    useLessonPlanStore.setState({ savedTopics: updatedSavedTopics });

    // Close the dialog
    setShowAddTopicDialog(false);

    toast.success(`Topic "${newTopicName}" added successfully`);
  };

  // Function to add a new subtopic
  const handleAddSubtopic = () => {
    if (!newSubtopicName.trim() || !parentTopicForSubtopic) {
      toast.error('Subtopic name cannot be empty');
      return;
    }

    // Find the parent topic in the hierarchy
    const updatedHierarchy = [...topicsHierarchy];
    const parentTopicIndex = updatedHierarchy.findIndex(t => t.topic === parentTopicForSubtopic);

    if (parentTopicIndex === -1) {
      toast.error('Parent topic not found');
      return;
    }

    // Check if the subtopic already exists
    const subtopicExists = updatedHierarchy[parentTopicIndex].subtopics.includes(newSubtopicName);
    if (subtopicExists) {
      toast.error('Subtopic already exists');
      return;
    }

    // Add the subtopic to the parent topic
    updatedHierarchy[parentTopicIndex].subtopics.push(newSubtopicName);

    // Update the hierarchy in the store
    setTopicsHierarchy(updatedHierarchy);

    // Add the new subtopic to savedTopics to ensure it's included in the hierarchy
    const updatedSavedTopics = [...savedTopics, newSubtopicName];
    useLessonPlanStore.setState({ savedTopics: updatedSavedTopics });

    // Close the dialog
    setShowAddSubtopicDialog(false);

    toast.success(`Subtopic "${newSubtopicName}" added successfully`);
  };

  // Function to delete a topic or subtopic
  const handleDeleteTopic = () => {
    if (!topicToDelete) {
      toast.error('No topic selected for deletion');
      return;
    }

    const { topic, isSubtopic, parentTopic } = topicToDelete;
    const updatedHierarchy = [...topicsHierarchy];

    if (isSubtopic && parentTopic) {
      // Delete a subtopic
      const parentTopicIndex = updatedHierarchy.findIndex(t => t.topic === parentTopic);
      if (parentTopicIndex === -1) {
        toast.error('Parent topic not found');
        return;
      }

      // Remove the subtopic from the parent topic
      updatedHierarchy[parentTopicIndex].subtopics = updatedHierarchy[parentTopicIndex].subtopics.filter(
        st => st !== topic
      );
    } else {
      // Delete a main topic (and all its subtopics)
      const topicIndex = updatedHierarchy.findIndex(t => t.topic === topic);
      if (topicIndex === -1) {
        toast.error('Topic not found');
        return;
      }

      // Remove the topic from the hierarchy
      updatedHierarchy.splice(topicIndex, 1);
    }

    // Update the hierarchy in the store
    setTopicsHierarchy(updatedHierarchy);

    // Remove the deleted topic from savedTopics
    const updatedSavedTopics = savedTopics.filter(t => t !== topic);

    // If it's a main topic, also remove all its subtopics from savedTopics
    let finalSavedTopics = updatedSavedTopics;
    if (!isSubtopic) {
      // Get all subtopics of the deleted topic
      const deletedSubtopics = topicsHierarchy.find(t => t.topic === topic)?.subtopics || [];
      // Remove all subtopics from savedTopics
      finalSavedTopics = updatedSavedTopics.filter(t => !deletedSubtopics.includes(t));
    }

    // Update savedTopics in the store
    useLessonPlanStore.setState({ savedTopics: finalSavedTopics });

    // If the deleted topic was selected, clear the selection
    if (selectedTopic === topic) {
      setSelectedTopic(null);
      setShowEditor(false);
      setMdxContent('');
    } else if (selectedSubtopic === topic) {
      setSelectedSubtopic(null);
      setShowEditor(false);
      setMdxContent('');
    }

    // Close the dialog
    setShowDeleteTopicDialog(false);

    toast.success(`${isSubtopic ? 'Subtopic' : 'Topic'} "${topic}" deleted successfully`);
  };

  // Handle saving the current lesson plan to the database
  // This function ensures that each topic/subtopic has:
  // 1. A parent topic:
  //    - If it's a subtopic, parent is the actual parent topic from the hierarchy (not the main topic)
  //    - If it's a parent topic, parent is itself
  // 2. The main topic (lesson plan name) to maintain the hierarchy relationship
  // This ensures the correct hierarchy is maintained, e.g., "What is RAG and why it is important"
  // has parent topic "Introduction to RAG" and main topic "RAG"
  const handleSaveLessonPlan = async () => {
    if (!mainTopic) {
      toast.error('Please search for a topic first');
      return;
    }

    setIsSavingLessonPlan(true);

    try {
      // Collect all topics with their MDX content
      const topicsToSave: SavedLessonTopic[] = [];

      // First, extract the complete hierarchy from topicsHierarchy state to preserve ordering
      // This ensures we use the most up-to-date hierarchy including any user modifications
      let parsedTopics: Topic[] = [];

      // Use the topicsHierarchy from the store as the primary source of hierarchy
      if (topicsHierarchy && Array.isArray(topicsHierarchy) && topicsHierarchy.length > 0) {
        console.log('Using topicsHierarchy from store for saving:', topicsHierarchy);
        parsedTopics = [...topicsHierarchy]; // Create a copy to avoid mutation issues
      }
      // Fallback to topicsData if topicsHierarchy is not available
      else if (topicsData && isTopicsResponse(topicsData) && topicsData.status === 'success') {
        try {
          const topicsString = topicsData.data.topics;
          const jsonMatch = topicsString.match(/```json\n([\s\S]*?)\n```/);

          if (jsonMatch && jsonMatch[1]) {
            parsedTopics = JSON.parse(jsonMatch[1]);
          }
        } catch (error) {
          console.error("Error parsing topics hierarchy:", error);
        }
      }

      // If we have a valid hierarchy, add all topics and subtopics to preserve the complete structure
      if (parsedTopics.length > 0) {
        // First, add all parent topics in order
        parsedTopics.forEach((parentTopic, index) => {
          // Check if this topic already exists in the current lesson plan
          const existingTopic = currentLessonPlan?.topics.find(t => t.topic === parentTopic.topic);

          // Add the parent topic
          topicsToSave.push({
            topic: parentTopic.topic,
            mdxContent: existingTopic?.mdxContent || '', // Use existing content or empty string
            isSubtopic: false,
            parentTopic: parentTopic.topic, // Parent topic is itself
            mainTopic: mainTopic,
            // Add an order field to preserve the hierarchy order
            order: index
          });

          // Then add all its subtopics in order
          if (parentTopic.subtopics && parentTopic.subtopics.length > 0) {
            parentTopic.subtopics.forEach((subtopic, subIndex) => {
              // Check if this subtopic already exists in the current lesson plan
              const existingSubtopic = currentLessonPlan?.topics.find(t => t.topic === subtopic);

              // Add the subtopic
              topicsToSave.push({
                topic: subtopic,
                mdxContent: existingSubtopic?.mdxContent || '', // Use existing content or empty string
                isSubtopic: true,
                parentTopic: parentTopic.topic,
                mainTopic: mainTopic,
                // Add an order field to preserve the hierarchy order
                order: index * 100 + subIndex // This ensures subtopics are grouped with their parents
              });
            });
          }
        });
      }

      // Now update any topics that have content in the current editor
      if (mdxContent && (selectedTopic || selectedSubtopic)) {
        const currentTopic = selectedTopic || selectedSubtopic || '';
        const isCurrentTopicSubtopic = !!selectedSubtopic;
        let parentTopicValue;

        // Determine the parent topic
        if (isCurrentTopicSubtopic) {
          // For subtopics, find the parent from the hierarchy
          const parentTopicObj = parsedTopics.find(topic =>
            topic.subtopics && topic.subtopics.includes(currentTopic)
          );
          parentTopicValue = parentTopicObj ? parentTopicObj.topic : mainTopic;
        } else {
          // For parent topics, the parent is itself
          parentTopicValue = currentTopic;
        }

        // Save to the current lesson in the store
        saveMdxToCurrentLesson(
          currentTopic,
          mdxContent,
          isCurrentTopicSubtopic,
          parentTopicValue
        );

        // Update the content in the topicsToSave array
        const topicIndex = topicsToSave.findIndex(t => t.topic === currentTopic);
        if (topicIndex >= 0) {
          // Update existing topic in the array
          topicsToSave[topicIndex].mdxContent = mdxContent;
        } else {
          // If not found in the hierarchy (rare case), add it
          topicsToSave.push({
            topic: currentTopic,
            mdxContent,
            isSubtopic: isCurrentTopicSubtopic,
            parentTopic: parentTopicValue,
            mainTopic: mainTopic
          });
        }
      }

      // Update with any additional content from the current lesson plan
      if (currentLessonPlan && currentLessonPlan.topics) {
        currentLessonPlan.topics.forEach(topic => {
          // Skip if it's the current topic (already handled)
          if (topic.topic === selectedTopic || topic.topic === selectedSubtopic) {
            return;
          }

          // Find if this topic exists in our topicsToSave array
          const existingIndex = topicsToSave.findIndex(t => t.topic === topic.topic);

          if (existingIndex >= 0 && topic.mdxContent) {
            // Update the content for an existing topic
            topicsToSave[existingIndex].mdxContent = topic.mdxContent;
          } else if (existingIndex === -1 && topic.mdxContent) {
            // If not in the hierarchy but has content, add it
            topicsToSave.push({
              topic: topic.topic,
              mdxContent: topic.mdxContent,
              isSubtopic: topic.isSubtopic,
              parentTopic: topic.parentTopic || (topic.isSubtopic ? mainTopic : topic.topic),
              mainTopic: mainTopic
            });
          }
        });
      }

      // Sort the topics by order if available
      topicsToSave.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        return 0;
      });

      if (topicsToSave.length === 0) {
        toast.error('No topics to save');
        setIsSavingLessonPlan(false);
        return;
      }

      // Create or update the lesson plan
      // Create a copy of topics without the order property for sending to the backend
      const cleanedTopics = topicsToSave.map(topic => ({
        topic: topic.topic,
        mdxContent: topic.mdxContent,
        isSubtopic: topic.isSubtopic,
        parentTopic: topic.parentTopic,
        mainTopic: topic.mainTopic
      }));

      const lessonPlan = {
        id: currentLessonPlan?.id,
        name: currentLessonPlan?.name || mainTopic || 'Untitled Lesson Plan',
        mainTopic: mainTopic || '',
        topics: cleanedTopics
      };

      const result = await saveLessonPlan(lessonPlan);
      console.log('Lesson plan saved to database:', result);

      // Check if the result is an error response
      if ('error' in result) {
        throw new Error(result.error);
      }

      // Update the current lesson plan in the store
      // Convert the result to match our LessonPlan type
      const savedLessonPlan = {
        id: result.id,
        name: result.name,
        mainTopic: result.mainTopic,
        topics: result.topics,
        createdAt: result.createdAt || undefined,
        updatedAt: result.updatedAt || undefined
      };

      // We'll update the lesson plan and then fix the savedTopics

      // Update the lesson plan in the store
      // This will also update the topicsHierarchy in the store based on the saved lesson plan
      setCurrentLessonPlan(savedLessonPlan);

      // Only include topics with actual MDX content in savedTopics
      // This ensures only topics with content are highlighted as saved (green)
      const topicsWithContent = savedLessonPlan.topics
        .filter(topic => topic.mdxContent && topic.mdxContent.trim() !== '')
        .map(topic => topic.topic);

      // Update the savedTopics in the store to only include topics with content
      useLessonPlanStore.setState({ savedTopics: topicsWithContent });

      // Show different success message based on whether we created or updated
      if (lessonPlan.id) {
        toast.success('Lesson plan updated in database successfully');
      } else {
        toast.success('New lesson plan saved to database successfully');
      }
    } catch (error) {
      console.error('Error saving lesson plan to database:', error);
      toast.error('Failed to save lesson plan to database');
    } finally {
      setIsSavingLessonPlan(false);
    }
  };

  // Handle creating a new lesson plan
  const handleCreateNewLesson = () => {
    // Show confirmation dialog if there's content
    if (mdxContent.trim() || currentLessonPlan) {
      setShowSaveConfirmDialog(true);
    } else {
      // Reset state for a new lesson
      resetLessonState();
    }
  };

  // Reset the state for a new lesson
  const resetLessonState = () => {
    setSelectedTopic(null);
    setSelectedSubtopic(null);
    setMainTopic(null);
    setMdxContent('');
    setShowEditor(false);
    setCurrentLessonPlan(null);
    setSearchQuery('');
    setHasSavedContent(false);
    setTopicsHierarchy([]); // Clear the persisted hierarchy

    // Reset UI state
    setShowRightSidebar(false);
    setLastUsedGenerationMethod(null);
    setShowGenerationOptions(true);

    toast.success('Started a new lesson plan');
  };

  // Handle confirmation to save before creating a new lesson
  const handleSaveBeforeNew = async () => {
    await handleSaveLessonPlan();
    resetLessonState();
    setShowSaveConfirmDialog(false);
  };

  // Handle discarding changes and creating a new lesson
  const handleDiscardAndCreateNew = () => {
    resetLessonState();
    setShowSaveConfirmDialog(false);
  };

  // Handle closing a lesson plan (especially for read-only mode)
  const handleCloseLessonPlan = () => {
    // Reset the state to clear everything
    resetState();

    // Make sure read-only mode is turned off
    setIsReadOnly(false);

    // Show a success message
    toast.success('Closed lesson plan');
  };

  // Determine panel widths based on fullscreen states and view mode
  const getEditorWidth = () => {
    if (isEditorFullscreen) return 'w-full';
    if (isPreviewFullscreen) return 'w-0 hidden';

    // Handle different view modes
    if (editorViewMode === 'code') return 'w-full';
    if (editorViewMode === 'preview') return 'w-0 hidden';

    // For split view
    if (isMobileView) {
      return 'w-full'; // On mobile, take full width but height will be 50%
    }
    return 'w-1/2'; // On desktop, split view (50/50)
  };

  const getPreviewWidth = () => {
    if (isPreviewFullscreen) return 'w-full';
    if (isEditorFullscreen) return 'w-0 hidden';

    // Handle different view modes
    if (editorViewMode === 'code') return 'w-0 hidden';
    if (editorViewMode === 'preview') return 'w-full';

    // For split view
    if (isMobileView) {
      return 'w-full'; // On mobile, take full width but height will be 50%
    }
    return 'w-1/2'; // On desktop, split view (50/50)
  };

  return (
    <div className={`flex flex-col gap-4 w-full ${isEditorFullscreen || isPreviewFullscreen ? 'h-screen overflow-hidden' : ''}`}>
      {/* Top buttons for lesson plan management */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-2 py-2 bg-card rounded-lg shadow-sm border gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center">
          <h2 className="text-lg font-semibold mr-4">Lesson Plan</h2>
          <div className="flex flex-wrap gap-1 mt-1 sm:mt-0">
            {currentLessonPlan && (
              <span className="text-sm bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {currentLessonPlan.name}
              </span>
            )}
            {isReadOnly && (
              <span className="text-sm bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 rounded-full">
                Read-Only Mode
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {isReadOnly ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloseLessonPlan}
              className="flex items-center w-full sm:w-auto"
            >
              <X className="h-4 w-4 mr-1" />
              Close Lesson
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateNewLesson}
                className="flex items-center flex-1 sm:flex-none"
              >
                <FilePlus className="h-4 w-4 mr-1" />
                <span className="sm:inline">Create New</span>
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveLessonPlan}
                disabled={isSavingLessonPlan}
                className="flex items-center flex-1 sm:flex-none"
              >
                {isSavingLessonPlan ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    <span className="sm:inline">Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" />
                    <span className="sm:inline">{currentLessonPlan?.id ? 'Update' : 'Save'}</span>
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Save confirmation dialog */}
      <Dialog open={showSaveConfirmDialog} onOpenChange={setShowSaveConfirmDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save changes?</DialogTitle>
            <DialogDescription>
              You have unsaved changes in your current lesson plan. Would you like to save them before creating a new lesson?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
            <Button variant="outline" onClick={handleDiscardAndCreateNew} className="w-full sm:w-auto">
              Discard Changes
            </Button>
            <Button onClick={handleSaveBeforeNew} className="w-full sm:w-auto">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load lesson plan confirmation dialog */}
      <Dialog open={showLoadConfirmDialog} onOpenChange={setShowLoadConfirmDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes in your current lesson plan. Would you like to save them before loading another lesson plan?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={handleDiscardAndLoad}
              disabled={isLoadingLessonPlan}
              className="w-full sm:w-auto"
            >
              Discard Changes
            </Button>
            <Button
              onClick={async () => {
                await handleSaveLessonPlan();
                if (localLessonPlanToLoad) {
                  loadLessonPlanById(localLessonPlanToLoad);
                }
              }}
              disabled={isLoadingLessonPlan}
              className="w-full sm:w-auto"
            >
              {isLoadingLessonPlan ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Loading...
                </>
              ) : (
                'Save and Load'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile Navigation Tabs */}
      {isMobileView && (
        <div className="flex w-full border-b border-border mb-4 sticky top-0 z-10 bg-background shadow-sm">
          <button
            className={`flex-1 py-3 text-center font-medium transition-all duration-200 ${
              mobileActivePanel === 'left'
                ? 'bg-background shadow-sm border-b-2 border-primary text-primary'
                : 'bg-transparent hover:bg-background/50'
            }`}
            onClick={() => setMobileActivePanel('left')}
          >
            <span className="flex items-center justify-center">
              <Search className="h-4 w-4 mr-2" />
              Hierarchy
            </span>
          </button>
          <button
            className={`flex-1 py-3 text-center font-medium transition-all duration-200 ${
              mobileActivePanel === 'main'
                ? 'bg-background shadow-sm border-b-2 border-primary text-primary'
                : 'bg-transparent hover:bg-background/50'
            }`}
            onClick={() => setMobileActivePanel('main')}
          >
            <span className="flex items-center justify-center">
              <FileText className="h-4 w-4 mr-2" />
              Content
            </span>
          </button>
          <button
            className={`flex-1 py-3 text-center font-medium transition-all duration-200 ${
              mobileActivePanel === 'right' && showRightSidebar
                ? 'bg-background shadow-sm border-b-2 border-primary text-primary'
                : 'bg-transparent hover:bg-background/50'
            }`}
            onClick={() => {
              if (showRightSidebar) {
                setMobileActivePanel('right');
              }
            }}
            disabled={!showRightSidebar}
          >
            <span className="flex items-center justify-center">
              <Settings className="h-4 w-4 mr-2" />
              Options
            </span>
          </button>
        </div>
      )}

      <div ref={containerRef} className="flex flex-col md:flex-row w-full relative">
        {/* Left sidebar for topic hierarchy */}
      <div 
        className={`
          ${isEditorFullscreen || isPreviewFullscreen ? 'hidden md:hidden' : ''}
          ${isMobileView && mobileActivePanel !== 'left' ? 'hidden' : ''}
          ${isResizingLeft || isResizingRight ? '' : 'transition-all duration-150'} relative flex-shrink-0
        `}
        style={{ 
          width: isMobileView ? '100%' : isLeftSidebarCollapsed ? '56px' : `${leftPanelWidth}px`,
          minWidth: isLeftSidebarCollapsed ? '56px' : '150px',
          maxWidth: isMobileView ? '100%' : '400px'
        }}
      >
        <Card className={`${isMobileView ? 'h-[70vh]' : 'h-full'} overflow-hidden border-border`}>
          <div className="border-b border-border flex items-center justify-between p-2 bg-muted/30">
            {!isLeftSidebarCollapsed && (
              <div className="font-medium text-sm flex items-center">
                <span className="bg-primary/10 text-primary rounded-md px-2 py-0.5">Hierarchy</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLeftSidebar}
              className={`h-8 w-8 p-0 hover:bg-muted ${isLeftSidebarCollapsed ? 'mx-auto' : 'mr-0 ml-auto'}`}
              title={isLeftSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isLeftSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          {!isLeftSidebarCollapsed ? (
            <div className="flex flex-col h-[calc(100%-40px)]">
              <CardHeader className="py-3 pb-1">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg font-semibold">Lesson Plan Hierarchy</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Search for a topic to generate a lesson plan
                    </CardDescription>
                  </div>
                  {!isReadOnly && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openAddTopicDialog}
                      className="h-8 w-8 p-0"
                      title="Add new topic"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="overflow-auto flex-1 pt-2">
                <form onSubmit={handleSearch} className="flex items-center space-x-2 mb-4">
                  <Input
                    type="text"
                    placeholder="Enter a topic..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={isLoadingTopics} size="icon" className="h-9 w-9">
                    {isLoadingTopics ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </form>

                {isTopicsError && (
                  <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mb-4">
                    Error loading topics. Please try again.
                  </div>
                )}

                {/* Render hierarchy from either fresh API data or persisted state */}
                {((topicsData && isTopicsResponse(topicsData) && topicsData.status === 'success' && topicsData.data?.topics) ||
                  (topicsHierarchy && Array.isArray(topicsHierarchy) && topicsHierarchy.length > 0)) && (
                  <div className="space-y-2">
                    {(() => {
                      try {
                        // First try to use the hierarchy from the API response
                        let parsedTopics: Topic[] = [];

                        if (topicsData && isTopicsResponse(topicsData) && topicsData.status === 'success') {
                          // Extract the JSON string from the code block
                          const topicsString = topicsData.data.topics;
                          const jsonMatch = topicsString.match(/```json\n([\s\S]*?)\n```/);

                          if (jsonMatch && jsonMatch[1]) {
                            parsedTopics = JSON.parse(jsonMatch[1]);
                          }
                        }

                        // If we couldn't parse from API response, use the persisted hierarchy
                        if (parsedTopics.length === 0 && topicsHierarchy && Array.isArray(topicsHierarchy) && topicsHierarchy.length > 0) {
                          console.log('Using persisted hierarchy from Zustand store:', topicsHierarchy);
                          parsedTopics = [...topicsHierarchy]; // Create a copy to avoid mutation issues
                        }

                        // If we still don't have a hierarchy, show an error
                        if (parsedTopics.length === 0) {
                          return <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">Error parsing topics data</div>;
                        }

                        // Use the topicsHierarchy from the store if it's available and valid
                        // This ensures we're always using the latest state
                        const topicsToRender = topicsHierarchy && topicsHierarchy.length > 0 ? topicsHierarchy : parsedTopics;

                        console.log('Rendering topics hierarchy:', topicsToRender);

                        return (
                          <DraggableTopicList
                            topics={topicsToRender}
                            savedTopics={savedTopics}
                            selectedTopic={selectedTopic}
                            selectedSubtopic={selectedSubtopic}
                            isReadOnly={isReadOnly}
                            onTopicSelect={handleTopicSelect}
                            onSubtopicSelect={handleSubtopicSelect}
                            onAddSubtopic={openAddSubtopicDialog}
                            onDeleteTopic={openDeleteTopicDialog}
                            onTopicsReordered={handleTopicsReordered}
                          />
                        );
                      } catch (error) {
                        console.error("Error parsing topics:", error);
                        return <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">Error parsing topics data</div>;
                      }
                    })()}
                  </div>
                )}

                {!topicsData && (!topicsHierarchy || topicsHierarchy.length === 0) && (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Search className="h-10 w-10 mb-4 opacity-20" />
                    <p className="text-center text-sm">Search for a topic to begin</p>
                  </div>
                )}
              </CardContent>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-start h-[calc(100%-40px)] pt-4">
              <div className="bg-primary/10 text-primary rounded-full p-1.5 mb-4">
                <Search className="h-4 w-4" />
              </div>
              <div className="text-xs text-center px-1 font-medium rotate-90 whitespace-nowrap mt-4">
                {searchQuery ? (searchQuery.length > 15 ? `${searchQuery.substring(0, 15)}...` : searchQuery) : "Hierarchy"}
              </div>
            </div>
          )}
        </Card>
        {/* Resize handle for left panel */}
        {!isMobileView && !isLeftSidebarCollapsed && !isEditorFullscreen && !isPreviewFullscreen && (
          <ResizeHandle position="left" onMouseDown={() => setIsResizingLeft(true)} />
        )}
      </div>

      {/* Right sidebar for MDX generation options */}
      {showRightSidebar && (
        <div 
          className={`
            ${isEditorFullscreen || isPreviewFullscreen ? 'md:w-1/6 lg:w-1/7' : ''}
            ${isMobileView && mobileActivePanel !== 'right' ? 'hidden' : ''}
            ${isResizingLeft || isResizingRight ? '' : 'transition-all duration-150'} relative flex-shrink-0 order-last
          `}
          style={{ 
            width: isMobileView ? '100%' : isRightSidebarCollapsed ? '56px' : `${rightPanelWidth}px`,
            minWidth: isRightSidebarCollapsed ? '56px' : '200px',
            maxWidth: isMobileView ? '100%' : '450px'
          }}
        >
          {/* Resize handle for right panel */}
          {!isMobileView && !isRightSidebarCollapsed && !isEditorFullscreen && !isPreviewFullscreen && (
            <ResizeHandle position="right" onMouseDown={() => setIsResizingRight(true)} />
          )}
          <Card className={`${isMobileView ? 'h-[70vh]' : 'h-full'} overflow-hidden border-border`}>
            <div className="border-b border-border flex items-center justify-between p-2 bg-muted/30">
              {!isRightSidebarCollapsed && (
                <div className="font-medium text-sm flex items-center">
                  <span className="bg-primary/10 text-primary rounded-md px-2 py-0.5">Mode</span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleRightSidebar}
                className={`h-8 w-8 p-0 hover:bg-muted ${isRightSidebarCollapsed ? 'mx-auto' : 'mr-0 ml-auto'}`}
                title={isRightSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isRightSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
            </div>

            {!isRightSidebarCollapsed ? (
              <div className="flex flex-col h-[calc(100%-40px)]">
                <CardHeader className="py-3 pb-1">
                  <CardTitle className="text-lg font-semibold flex items-center">
                    <span className="mr-2">{showGenerationOptions ? 'Generation Mode' : 'Content Refinement'}</span>
                    {selectedTopic || selectedSubtopic ? (
                      <span className="text-xs bg-secondary/50 text-secondary-foreground px-2 py-0.5 rounded-full">
                        {(selectedTopic || selectedSubtopic || '').length > 15
                          ? `${(selectedTopic || selectedSubtopic || '').substring(0, 15)}...`
                          : (selectedTopic || selectedSubtopic)}
                      </span>
                    ) : null}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {showGenerationOptions
                      ? 'Choose a mdx generation method below'
                      : 'Refine your content with AI assistance'}
                  </CardDescription>
                </CardHeader>

                {showGenerationOptions ? (
                  <>
                    {!isReadOnly && (
                      <div className="px-4 py-2">
                        <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
                          <Button
                            onClick={() => setGenerationMethod('crawl')}
                            variant="ghost"
                            size="sm"
                            className={`flex-1 ${generationMethod === 'crawl'
                              ? 'bg-background shadow-sm'
                              : 'hover:bg-background/80'}`}
                          >
                            Crawl
                          </Button>
                          <Button
                            onClick={() => setGenerationMethod('urls')}
                            variant="ghost"
                            size="sm"
                            className={`flex-1 ${generationMethod === 'urls'
                              ? 'bg-background shadow-sm'
                              : 'hover:bg-background/80'}`}
                          >
                            URLs
                          </Button>
                          <Button
                            onClick={() => setGenerationMethod('llm')}
                            variant="ghost"
                            size="sm"
                            className={`flex-1 ${generationMethod === 'llm'
                              ? 'bg-background shadow-sm'
                              : 'hover:bg-background/80'}`}
                          >
                            LLM Only
                          </Button>
                        </div>
                      </div>
                    )}

                    <CardContent className="overflow-auto flex-1 pt-2">
                      <div className="space-y-4">
                        {/* Selected Text Display - also shown in Generation Mode */}
                        {selectedEditorText && !isReadOnly && (
                          <div className="space-y-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                            <div className="flex items-center justify-between">
                              <label className="text-sm font-medium flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                Text Selected (Switch to Refinement to edit):
                              </label>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => setShowGenerationOptions(false)}
                              >
                                Refine →
                              </Button>
                            </div>
                            <div 
                              className="bg-amber-500/5 border border-amber-500/20 rounded-md p-2 text-sm max-h-[60px] overflow-y-auto cursor-pointer hover:bg-amber-500/10 transition-colors"
                              onClick={() => {
                                if (editorRef.current && selectionStart !== null && selectionEnd !== null) {
                                  editorRef.current.focus();
                                  editorRef.current.setSelectionRange(selectionStart, selectionEnd);
                                }
                              }}
                              title="Click to re-highlight in editor"
                            >
                              <pre className="whitespace-pre-wrap font-mono text-xs break-words text-muted-foreground">
                                {selectedEditorText.length > 200 
                                  ? selectedEditorText.substring(0, 200) + '...' 
                                  : selectedEditorText}
                              </pre>
                            </div>
                          </div>
                        )}

                        {generationMethod === 'crawl' && (
                          <div className="space-y-4">
                            <div className="bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground">
                              <p>
                                This will generate MDX content by crawling the web for information about the selected topic.
                              </p>
                              {isReadOnly && (
                                <p className="mt-2 text-amber-600 dark:text-amber-400">
                                  You are in read-only mode. Content generation is disabled.
                                </p>
                              )}
                            </div>
                            {!isReadOnly && (
                              <Button
                                onClick={generateMdxFromCrawling}
                                disabled={isGeneratingMdx}
                                className="w-full"
                              >
                                {isGeneratingMdx ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Generating...
                                  </>
                                ) : (
                                  mdxContent ? 'Regenerate MDX' : 'Generate MDX'
                                )}
                              </Button>
                            )}
                          </div>
                        )}

                        {generationMethod === 'urls' && (
                          <div className="space-y-4">
                            <div className="bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground">
                              <p>
                                Enter 1-4 URLs to generate MDX content from. Each URL should be a valid web address.
                              </p>
                              {isReadOnly && (
                                <p className="mt-2 text-amber-600 dark:text-amber-400">
                                  You are in read-only mode. Content generation is disabled.
                                </p>
                              )}
                            </div>

                            {!isReadOnly && (
                              <>
                                <div className="space-y-2">
                                  {urlInputs.map((url, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                      <Input
                                        type="url"
                                        placeholder="https://example.com"
                                        value={url.value}
                                        onChange={(e) => handleUrlChange(index, e.target.value)}
                                        className={`flex-1 text-xs ${!url.value || url.isValid ? '' : 'border-red-500'}`}
                                      />
                                      {urlInputs.length > 1 && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => removeUrlInput(index)}
                                          className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  ))}
                                </div>

                                {urlInputs.length < 4 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={addUrlInput}
                                    className="w-full text-xs"
                                  >
                                    + Add URL
                                  </Button>
                                )}

                                <Button
                                  onClick={generateMdxFromUrlsList}
                                  disabled={isGeneratingMdx || !validateUrls()}
                                  className="w-full mt-2"
                                >
                                  {isGeneratingMdx ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                      Generating...
                                    </>
                                  ) : (
                                    mdxContent ? 'Regenerate MDX from URLs' : 'Generate MDX from URLs'
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        )}

                        {generationMethod === 'llm' && (
                          <div className="space-y-4">
                            <div className="bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground">
                              <p>
                                This will generate MDX content using only the LLM's knowledge without web crawling.
                              </p>
                              <p className="mt-2">
                                Use this option when you want faster generation or when the topic is well-known.
                              </p>
                              {isReadOnly && (
                                <p className="mt-2 text-amber-600 dark:text-amber-400">
                                  You are in read-only mode. Content generation is disabled.
                                </p>
                              )}
                            </div>
                            {!isReadOnly && (
                              <Button
                                onClick={generateMdxFromLlmOnly}
                                disabled={isGeneratingMdx}
                                className="w-full"
                              >
                                {isGeneratingMdx ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Generating...
                                  </>
                                ) : (
                                  mdxContent ? 'Regenerate MDX using LLM Only' : 'Generate MDX using LLM Only'
                                )}
                              </Button>
                            )}
                          </div>
                        )}

                        {generationError && (
                          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mt-4">
                            {generationError}
                          </div>
                        )}



                        {showEditor && !isReadOnly && (
                          <div className="mt-4 pt-4 border-t border-border space-y-2">
                            <Button
                              onClick={handleSaveMdx}
                              disabled={isSavingMdx || !mdxContent.trim()}
                              className="w-full"
                              variant="default"
                            >
                              {isSavingMdx ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Saving...
                                </>
                              ) : (
                                hasSavedContent ? 'Update MDX in Lesson' : 'Save MDX to Lesson'
                              )}
                            </Button>

                            <Button
                              onClick={() => setShowGenerationOptions(false)}
                              variant="secondary"
                              className="w-full"
                            >
                              Switch to Refinement Mode
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </>
                ) : (
                  <>
                    {!isReadOnly ? (
                      <div className="px-4 py-2">
                        <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
                          <Button
                            onClick={() => setRefinementMethod('selection')}
                            variant="ghost"
                            size="sm"
                            className={`flex-1 ${refinementMethod === 'selection'
                              ? 'bg-background shadow-sm'
                              : 'hover:bg-background/80'}`}
                          >
                            Selection
                          </Button>
                          <Button
                            onClick={() => setRefinementMethod('crawling')}
                            variant="ghost"
                            size="sm"
                            className={`flex-1 ${refinementMethod === 'crawling'
                              ? 'bg-background shadow-sm'
                              : 'hover:bg-background/80'}`}
                          >
                            Crawling
                          </Button>
                          <Button
                            onClick={() => setRefinementMethod('urls')}
                            variant="ghost"
                            size="sm"
                            className={`flex-1 ${refinementMethod === 'urls'
                              ? 'bg-background shadow-sm'
                              : 'hover:bg-background/80'}`}
                          >
                            URLs
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 py-2">
                        <div className="bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground">
                          <p className="text-amber-600 dark:text-amber-400">
                            You are in read-only mode. Content refinement is disabled.
                          </p>
                        </div>
                      </div>
                    )}

                    <CardContent className="overflow-auto flex-1 pt-2">
                      <div className="space-y-4">
                        {!isReadOnly ? (
                          <>
                            {/* Selected Text Display */}
                            {selectedEditorText && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="text-sm font-medium flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                                    Selected Text:
                                  </label>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs"
                                      onClick={() => {
                                        if (editorRef.current && selectionStart !== null && selectionEnd !== null) {
                                          editorRef.current.focus();
                                          editorRef.current.setSelectionRange(selectionStart, selectionEnd);
                                        }
                                      }}
                                      title="Re-highlight in editor"
                                    >
                                      Show
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                                      onClick={() => {
                                        setSelectedEditorText('');
                                        setOriginalSelectedText('');
                                        setSelectionStart(null);
                                        setSelectionEnd(null);
                                      }}
                                      title="Clear selection"
                                    >
                                      Clear
                                    </Button>
                                  </div>
                                </div>
                                <div 
                                  className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-sm max-h-[120px] overflow-y-auto cursor-pointer hover:bg-primary/15 transition-colors"
                                  onClick={() => {
                                    if (editorRef.current && selectionStart !== null && selectionEnd !== null) {
                                      editorRef.current.focus();
                                      editorRef.current.setSelectionRange(selectionStart, selectionEnd);
                                    }
                                  }}
                                  title="Click to re-highlight in editor"
                                >
                                  <pre className="whitespace-pre-wrap font-mono text-xs break-words">
                                    {selectedEditorText.length > 500 
                                      ? selectedEditorText.substring(0, 500) + '...' 
                                      : selectedEditorText}
                                  </pre>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {selectedEditorText.length} characters selected • Click the box to re-highlight
                                </p>
                              </div>
                            )}

                            <div className="space-y-2">
                              <label className="text-sm font-medium">
                                Refinement Question/Prompt:
                              </label>
                              <Textarea
                                placeholder="Ask a question or provide instructions for refining the selected text..."
                                value={refinementQuestion}
                                onChange={(e) => setRefinementQuestion(e.target.value)}
                                className="min-h-[80px] text-sm"
                              />
                            </div>

                            <div className="bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground">
                              <p>
                                {refinementMethod === 'selection'
                                  ? 'Refine the selected text using the LLM\'s knowledge.'
                                  : refinementMethod === 'crawling'
                                    ? 'Refine the selected text by crawling the web for additional information.'
                                    : 'Refine the selected text using specific URLs as references.'}
                              </p>
                              <p className="mt-2 text-xs">
                                {selectedEditorText 
                                  ? 'Your selection is shown above. Enter a refinement prompt below.'
                                  : 'Select text in the editor and enter a question or prompt above.'}
                                {isTextRefined && ' The refined text will remain highlighted until you accept or revert the changes.'}
                              </p>
                            </div>
                          </>
                        ) : (
                          <div className="bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground">
                            <p className="text-amber-600 dark:text-amber-400">
                              You are in read-only mode. Content refinement is disabled.
                            </p>
                          </div>
                        )}

                        {refinementMethod === 'urls' && !isReadOnly && (
                          <div className="space-y-2 mt-4">
                            <label className="text-sm font-medium">Reference URLs:</label>
                            <div className="space-y-2">
                              {refinementUrlInputs.map((url, index) => (
                                <div key={index} className="flex items-center gap-2">
                                  <Input
                                    type="url"
                                    placeholder="https://example.com"
                                    value={url.value}
                                    onChange={(e) => handleRefinementUrlChange(index, e.target.value)}
                                    className={`flex-1 text-xs ${!url.value || url.isValid ? '' : 'border-red-500'}`}
                                  />
                                  {refinementUrlInputs.length > 1 && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeRefinementUrlInput(index)}
                                      className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>

                            {refinementUrlInputs.length < 4 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={addRefinementUrlInput}
                                className="w-full text-xs"
                              >
                                + Add URL
                              </Button>
                            )}
                          </div>
                        )}

                        {!isReadOnly && (
                          <div className="flex gap-2 mt-2">
                            <Button
                              onClick={
                                refinementMethod === 'selection'
                                  ? refineWithSelection
                                  : refinementMethod === 'crawling'
                                    ? refineWithCrawl
                                    : refineWithUrlsList
                              }
                              disabled={
                                isRefiningMdx ||
                                !selectedEditorText ||
                                !refinementQuestion.trim() ||
                                (refinementMethod === 'urls' && !validateRefinementUrls())
                              }
                              className="flex-1"
                            >
                              {isRefiningMdx ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Refining...
                                </>
                              ) : (
                                'Refine Content'
                              )}
                            </Button>

                            {isTextRefined && (
                              <Button
                                onClick={revertRefinedText}
                                variant="outline"
                                className="flex-1"
                              >
                                Revert Changes
                              </Button>
                            )}
                          </div>
                        )}

                        {refinementError && (
                          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mt-4">
                            {refinementError}
                          </div>
                        )}

                        {showEditor && lastUsedGenerationMethod && !isReadOnly && (
                          <div className="mt-4 pt-4 border-t border-border space-y-2">
                            <Button
                              onClick={handleSaveMdx}
                              disabled={isSavingMdx || !mdxContent.trim()}
                              className="w-full"
                              variant="default"
                            >
                              {isSavingMdx ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Saving...
                                </>
                              ) : (
                                hasSavedContent ? 'Update MDX in Lesson' : 'Save MDX to Lesson'
                              )}
                            </Button>

                            <Button
                              onClick={() => setShowGenerationOptions(true)}
                              variant="secondary"
                              className="w-full"
                            >
                              Switch to Generation Mode
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-start h-[calc(100%-40px)] pt-4">
                <div className="bg-primary/10 text-primary rounded-full p-1.5 mb-4">
                  <span className="sr-only">{showGenerationOptions ? 'MDX Generation' : 'Content Refinement'}</span>
                  {!showGenerationOptions ? (
                    refinementMethod === 'selection' ? (
                      <span className="h-4 w-4 flex items-center justify-center text-xs font-bold">AI</span>
                    ) : refinementMethod === 'crawling' ? (
                      <Search className="h-4 w-4" />
                    ) : (
                      <Link className="h-4 w-4" />
                    )
                  ) : (
                    generationMethod === 'crawl' ? (
                      <Search className="h-4 w-4" />
                    ) : generationMethod === 'urls' ? (
                      <Link className="h-4 w-4" />
                    ) : (
                      <span className="h-4 w-4 flex items-center justify-center text-xs font-bold">AI</span>
                    )
                  )}
                </div>
                <div className="text-xs text-center px-1 font-medium rotate-90 whitespace-nowrap mt-4">
                  {!showGenerationOptions ? (
                    refinementMethod === 'selection'
                      ? 'Selection Mode'
                      : refinementMethod === 'crawling'
                        ? 'Crawling Mode'
                        : 'URLs Mode'
                  ) : (
                    generationMethod === 'crawl'
                      ? 'Crawl Mode'
                      : generationMethod === 'urls'
                        ? 'URLs Mode'
                        : 'LLM Mode'
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Main content area for MDX */}
      {!showEditor && !isEditorFullscreen && !isPreviewFullscreen && (
        <div className={`flex-1 min-w-0 mx-2 ${isMobileView && mobileActivePanel !== 'main' ? 'hidden' : ''}`}>
          <Card className={`${isMobileView ? 'h-[70vh]' : 'h-full'}`}>
            <CardHeader>
              <CardTitle>
                {selectedTopic || selectedSubtopic || 'Select a topic to view content'}
              </CardTitle>
              <CardDescription>
                {selectedTopic || selectedSubtopic
                  ? showRightSidebar
                    ? 'Select a generation method from the right sidebar'
                    : 'Generated lesson plan content'
                  : 'Content will appear here after selecting a topic'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingMdx && (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}

              {isMdxError && (
                <div className="text-red-500 p-4">
                  Error generating content. Please try selecting a different topic.
                </div>
              )}

              {mdxData && isMdxResponse(mdxData) && mdxData.status === 'success' &&
               mdxData.data?.mdx_content && (
                <div className="prose dark:prose-invert max-w-none">
                  <MDXRenderer content={mdxData.data.mdx_content} />
                </div>
              )}

              {!selectedTopic && !selectedSubtopic && !isLoadingMdx && (
                <div className="text-center py-8 text-gray-500">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Search for a topic and select it from the sidebar to generate content</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* MDX Editor with Preview */}
      {showEditor && (
        <div className={`
          ${isEditorFullscreen || isPreviewFullscreen ? 'w-full h-full flex-grow' : 'flex-1 min-w-0 mx-2'}
          ${isMobileView && mobileActivePanel !== 'main' ? 'hidden' : ''}
        `}>
          <div className={`flex flex-col ${isMobileView ? 'h-[70vh]' : 'h-full'} border rounded-lg bg-card shadow-sm overflow-hidden`}>
            {/* View Mode Selector - Hidden in fullscreen */}
            {!isEditorFullscreen && !isPreviewFullscreen && (
              <div className="flex w-full border-b border-slate-200 dark:border-slate-700 bg-muted/30">
                <button
                  className={`flex-1 py-3 px-2 md:px-6 text-center font-medium transition-all duration-200 ${
                    editorViewMode === 'code'
                      ? 'bg-background shadow-sm border-b-2 border-primary text-primary'
                      : 'bg-transparent hover:bg-background/50'
                  }`}
                  onClick={() => setEditorViewMode('code')}
                >
                  MDX Code
                </button>
                <button
                  className={`flex-1 py-3 px-2 md:px-6 text-center font-medium transition-all duration-200 ${
                    editorViewMode === 'preview'
                      ? 'bg-background shadow-sm border-b-2 border-primary text-primary'
                      : 'bg-transparent hover:bg-background/50'
                  }`}
                  onClick={() => setEditorViewMode('preview')}
                >
                  Preview
                </button>
                <button
                  className={`flex-1 py-3 px-2 md:px-6 text-center font-medium transition-all duration-200 ${
                    editorViewMode === 'split'
                      ? 'bg-background shadow-sm border-b-2 border-primary text-primary'
                      : 'bg-transparent hover:bg-background/50'
                  } ${isMobileView ? 'hidden md:block' : ''}`}
                  onClick={() => setEditorViewMode('split')}
                >
                  Split
                </button>
              </div>
            )}
            <div className={`flex ${isMobileView ? 'flex-col' : 'flex-row'} h-full w-full overflow-hidden`} style={{ maxWidth: '100%' }}>

            {/* Editor Panel */}
            <div
              className={`${getEditorWidth()} h-full ${!isMobileView && 'border-r border-slate-200 dark:border-slate-700'} transition-all duration-300 overflow-hidden ${
                editorViewMode === 'preview' || isPreviewFullscreen ? 'hidden' : ''
              } ${isMobileView && editorViewMode === 'split' ? 'h-1/2' : ''}`}
              style={{ maxWidth: !isMobileView && editorViewMode === 'split' ? '50%' : '100%' }}
            >
              <div className="p-3 h-14 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center">
                  <h2 className="text-lg font-semibold truncate max-w-[150px] md:max-w-full">
                    {isMobileView ? 'Editor' : `MDX Editor: ${selectedTopic || selectedSubtopic}`}
                  </h2>
                  {isReadOnly && (
                    <span className="ml-2 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 rounded-full">
                      Read-Only
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!isReadOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleImageUploadClick}
                      disabled={isUploadingMedia}
                      className="h-8 px-2 text-xs gap-1"
                      title="Upload image (or drag & drop onto editor)"
                    >
                      {isUploadingMedia ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <span>📷 Image</span>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleEditorFullscreen}
                    className="h-8 w-8 p-0"
                    title={isEditorFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  >
                    {isEditorFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </Button>
                </div>
              </div>
              <div className="relative w-full h-[calc(100%-3.5rem)]">
                {isDraggingOver && !isReadOnly && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded pointer-events-none">
                    <span className="text-4xl mb-2">🖼️</span>
                    <span className="text-primary font-semibold">Drop image to upload</span>
                  </div>
                )}
                <Textarea
                  ref={editorRef}
                  className={`w-full h-full border-none rounded-none resize-none font-mono focus:ring-0 focus:outline-none text-base ${isTextRefined ? 'selection:bg-green-200 dark:selection:bg-green-800 selection:text-black dark:selection:text-white' : ''} ${isReadOnly ? 'bg-muted/30 cursor-not-allowed' : ''}`}
                  value={mdxContent}
                  onChange={handleContentChange}
                  onSelect={isReadOnly ? undefined : handleEditorSelect}
                  onMouseUp={isReadOnly ? undefined : handleEditorSelect}
                  onKeyUp={isReadOnly ? undefined : (e) => {
                    if (e.shiftKey || e.ctrlKey || e.metaKey) {
                      handleEditorSelect(e as unknown as React.SyntheticEvent<HTMLTextAreaElement>);
                    }
                  }}
                  onDragOver={(e) => { e.preventDefault(); if (!isReadOnly) setIsDraggingOver(true); }}
                  onDragLeave={() => setIsDraggingOver(false)}
                  onDrop={handleMediaDrop}
                  readOnly={isReadOnly}
                  style={{
                    fontSize: isMobileView ? '0.875rem' : '1rem',
                    lineHeight: '1.6',
                    minHeight: isEditorFullscreen ? 'calc(100vh - 120px)' : isMobileView ? '200px' : '500px',
                    padding: isMobileView ? '0.75rem' : '1rem 1.5rem',
                    tabSize: '2',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    wordWrap: 'break-word',
                    wordBreak: 'break-word'
                  }}
                />
              </div>
            </div>

            {/* Preview Panel */}
            <div
              className={`${getPreviewWidth()} ${isMobileView && editorViewMode === 'split' ? 'h-1/2 border-t border-slate-200 dark:border-slate-700' : 'h-full'} overflow-hidden transition-all duration-300 ${
                editorViewMode === 'code' && !isPreviewFullscreen ? 'hidden' : ''
              } ${isPreviewFullscreen ? 'w-full' : ''}`}
              style={{ maxWidth: !isMobileView && editorViewMode === 'split' ? '50%' : '100%' }}
            >
              <div className="p-3 h-14 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center">
                  <h2 className="text-lg font-semibold">Preview</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={togglePreviewFullscreen}
                    className="h-8 w-8 p-0"
                    title={isPreviewFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  >
                    {isPreviewFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </Button>
                </div>
              </div>
              <div
                className={`overflow-auto h-[calc(100%-3.5rem)] w-full`}
                style={{
                  minHeight: isPreviewFullscreen ? 'calc(100vh - 120px)' : isMobileView ? '200px' : '500px',
                  padding: isMobileView ? '0.75rem' : '1rem 1.5rem',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word'
                }}
              >
                <div className={`prose ${isMobileView ? 'prose-sm' : ''} dark:prose-invert w-full max-w-none`}>
                  <MDXRenderer content={mdxContent} />
                </div>
              </div>
            </div>
            </div> {/* Close the flex-row div */}
          </div>
        </div>
      )}
      </div>

      {/* Add Topic Dialog */}
      <Dialog open={showAddTopicDialog} onOpenChange={setShowAddTopicDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Topic</DialogTitle>
            <DialogDescription>
              Enter a name for the new topic. This will be added as a main topic in the hierarchy.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Enter topic name"
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              className="w-full"
            />
          </div>
          <DialogFooter className="flex flex-col sm:flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddTopicDialog(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleAddTopic} className="w-full sm:w-auto">
              Add Topic
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Subtopic Dialog */}
      <Dialog open={showAddSubtopicDialog} onOpenChange={setShowAddSubtopicDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Subtopic</DialogTitle>
            <DialogDescription>
              Enter a name for the new subtopic. This will be added under the selected topic.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="mb-4">
              <Label htmlFor="parentTopic">Parent Topic</Label>
              <Input
                id="parentTopic"
                value={parentTopicForSubtopic || ''}
                disabled
                className="w-full mt-1"
              />
            </div>
            <div>
              <Label htmlFor="subtopicName">Subtopic Name</Label>
              <Input
                id="subtopicName"
                placeholder="Enter subtopic name"
                value={newSubtopicName}
                onChange={(e) => setNewSubtopicName(e.target.value)}
                className="w-full mt-1"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddSubtopicDialog(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleAddSubtopic} className="w-full sm:w-auto">
              Add Subtopic
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Topic Confirmation Dialog */}
      <Dialog open={showDeleteTopicDialog} onOpenChange={setShowDeleteTopicDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {topicToDelete?.isSubtopic ? 'Subtopic' : 'Topic'}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{topicToDelete?.topic}"?
              {!topicToDelete?.isSubtopic && " This will also delete all its subtopics."}
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteTopicDialog(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteTopic} className="w-full sm:w-auto">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
