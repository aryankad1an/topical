import { hc } from "hono/client";
import { type ApiRoutes } from "@server/app";
import { queryOptions } from "@tanstack/react-query";
import { LessonPlan } from "@/stores/lessonPlanStore";
import { toast } from "sonner";

const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const urlStr = typeof input === "string" ? input : (input as Request).url || input.toString();
  
  if (urlStr.includes("/api/ai/")) {
    toast.info("Query submitted");
    
    try {
      const response = await fetch(input, init);
      
      if (!response.ok) {
        toast.error("Error connecting to Gemini API, maybe check your api key");
      }
      
      return response;
    } catch (error: any) {
      toast.error("Error connecting to Gemini API, maybe check your api key");
      throw error;
    }
  }
  
  return fetch(input, init);
};

const client = hc<ApiRoutes>("/", { fetch: customFetch });

export const api = client.api;

async function getCurrentUser() {
  const res = await api.me.$get();
  // 401 is expected when the visitor isn't logged in.
  // Treat it as an anonymous session so we don't trigger react-query retries.
  if (res.status === 401) {
    return { user: null };
  }
  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(errorText || `Failed to fetch current user (${res.status})`);
  }
  return res.json();
}

export const userQueryOptions = queryOptions({
  queryKey: ["get-current-user"],
  queryFn: getCurrentUser,
  staleTime: 1000 * 60 * 5, // 5 minutes instead of Infinity to allow auto-heal
  retry: false,
});

// AI Content API functions

// Search for topics
export async function searchTopics(query: string, limit?: number) {
  const res = await api.ai["search-topics"].$post({
    json: { query, limit }
  });
  if (!res.ok) {
    throw new Error("Failed to search topics");
  }
  const data = await res.json();
  return data;
}

// Save MDX content for a topic
export async function saveMdxContent(
  selectedTopic: string,
  mainTopic: string,
  mdxContent: string,
  isSubtopic: boolean = false,
  parentTopic?: string
) {
  try {
    // If it's a parent topic, set parent to itself
    const finalParentTopic = isSubtopic ? (parentTopic || mainTopic) : selectedTopic;

    console.log('Saving MDX content with:', {
      axiosWing: mainTopic,
      topic: selectedTopic,
      difficulty: "Beginner",
      mdxContent: mdxContent.substring(0, 100) + '...', // Log just the beginning for debugging
      mainTopic: mainTopic,
      parentTopic: finalParentTopic,
      isSubtopic: isSubtopic
    });

    const res = await api.topics.$post({
      json: {
        axiosWing: mainTopic, // Using mainTopic as the axiosWing (note the 's' in axios)
        topic: selectedTopic,
        difficulty: "Beginner", // Default difficulty
        mdxContent: mdxContent,
        mainTopic: mainTopic,
        parentTopic: finalParentTopic,
        isSubtopic: isSubtopic
      }
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'No error text available');
      console.error('Server error response when saving MDX:', errorText);
      throw new Error(`Failed to save MDX content: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    console.log('MDX content saved successfully:', data);
    return data;
  } catch (error) {
    console.error('Error in saveMdxContent:', error);
    throw error;
  }
}

// Get saved MDX content for a topic
export async function getSavedTopics() {
  try {
    const res = await api.topics.$get();

    if (!res.ok) {
      throw new Error("Failed to get saved topics");
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error in getSavedTopics:', error);
    throw error;
  }
}

// Generate MDX content for a single topic
export async function generateSingleTopic(selectedTopic: string, mainTopic: string, numResults?: number, hierarchy?: string) {
  const res = await api.ai["single-topic"].$post({
    json: { selected_topic: selectedTopic, main_topic: mainTopic, topic: selectedTopic, num_results: numResults, hierarchy }
  });
  if (!res.ok) {
    throw new Error("Failed to generate MDX content");
  }
  const data = await res.json();
  return data;
}

// Generate raw MDX content for a single topic
export async function generateSingleTopicRaw(selectedTopic: string, mainTopic: string, numResults?: number, hierarchy?: string) {
  try {
    console.log('API call params:', { selected_topic: selectedTopic, main_topic: mainTopic, topic: selectedTopic, num_results: numResults, hierarchy });
    const res = await api.ai["single-topic-raw"].$post({
      json: { selected_topic: selectedTopic, main_topic: mainTopic, topic: selectedTopic, num_results: numResults, hierarchy }
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'No error text available');
      console.error('Server error response:', errorText);
      throw new Error(`Failed to generate raw MDX content: ${res.status} ${res.statusText}`);
    }

    const text = await res.text();
    return text;
  } catch (error) {
    console.error('Error in generateSingleTopicRaw:', error);
    throw error;
  }
}

// Generate MDX content using LLM only
export async function generateMdxLlmOnly(selectedTopic: string, mainTopic: string, hierarchy?: string) {
  const res = await api.ai["generate-mdx-llm-only"].$post({
    json: { selected_topic: selectedTopic, main_topic: mainTopic, topic: selectedTopic, hierarchy }
  });
  if (!res.ok) {
    throw new Error("Failed to generate MDX content using LLM only");
  }
  const data = await res.json();
  return data;
}

// Generate raw MDX content using LLM only
export async function generateMdxLlmOnlyRaw(selectedTopic: string, mainTopic: string, hierarchy?: string) {
  try {
    console.log('API call params (LLM only):', { selected_topic: selectedTopic, main_topic: mainTopic, topic: selectedTopic, hierarchy });
    const res = await api.ai["generate-mdx-llm-only-raw"].$post({
      json: { selected_topic: selectedTopic, main_topic: mainTopic, topic: selectedTopic, hierarchy }
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'No error text available');
      console.error('Server error response (LLM only):', errorText);
      throw new Error(`Failed to generate raw MDX content using LLM only: ${res.status} ${res.statusText}`);
    }

    const text = await res.text();
    return text;
  } catch (error) {
    console.error('Error in generateMdxLlmOnlyRaw:', error);
    throw error;
  }
}

// Generate MDX content from a URL
export async function generateMdxFromUrl(url: string, selectedTopic: string, mainTopic: string, topic?: string, useLlmKnowledge?: boolean, hierarchy?: string) {
  const res = await api.ai["generate-mdx-from-url"].$post({
    json: { url, selected_topic: selectedTopic, main_topic: mainTopic, topic, use_llm_knowledge: useLlmKnowledge, hierarchy }
  });
  if (!res.ok) {
    throw new Error("Failed to generate MDX from URL");
  }
  const data = await res.json();
  return data;
}

// Generate raw MDX content from a URL
export async function generateMdxFromUrlRaw(url: string, selectedTopic: string, mainTopic: string, topic?: string, useLlmKnowledge?: boolean, hierarchy?: string) {
  const res = await api.ai["generate-mdx-from-url-raw"].$post({
    json: { url, selected_topic: selectedTopic, main_topic: mainTopic, topic, use_llm_knowledge: useLlmKnowledge, hierarchy }
  });
  if (!res.ok) {
    throw new Error("Failed to generate raw MDX from URL");
  }
  const text = await res.text();
  return text;
}

// Generate MDX content from multiple URLs
export async function generateMdxFromUrls(urls: string[], selectedTopic: string, mainTopic: string, topic?: string, useLlmKnowledge?: boolean, hierarchy?: string) {
  const res = await api.ai["generate-mdx-from-urls"].$post({
    json: { urls, selected_topic: selectedTopic, main_topic: mainTopic, topic, use_llm_knowledge: useLlmKnowledge, hierarchy }
  });
  if (!res.ok) {
    throw new Error("Failed to generate MDX from URLs");
  }
  const data = await res.json();
  return data;
}

// Generate raw MDX content from multiple URLs
export async function generateMdxFromUrlsRaw(urls: string[], selectedTopic: string, mainTopic: string, topic?: string, useLlmKnowledge?: boolean, hierarchy?: string) {
  try {
    console.log('API call params (URLs):', {
      urls,
      selected_topic: selectedTopic,
      main_topic: mainTopic,
      topic,
      use_llm_knowledge: useLlmKnowledge,
      hierarchy
    });

    const res = await api.ai["generate-mdx-from-urls-raw"].$post({
      json: { urls, selected_topic: selectedTopic, main_topic: mainTopic, topic, use_llm_knowledge: useLlmKnowledge, hierarchy }
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'No error text available');
      console.error('Server error response (URLs):', errorText);
      throw new Error(`Failed to generate raw MDX from URLs: ${res.status} ${res.statusText}`);
    }

    const text = await res.text();
    return text;
  } catch (error) {
    console.error('Error in generateMdxFromUrlsRaw:', error);
    throw error;
  }
}

// Refine content
export async function refineContent(mdx: string, question: string) {
  const res = await fetch('/api/ai/refine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mdx, question })
  });
  if (!res.ok) {
    throw new Error("Failed to refine content");
  }
  const data = await res.json();
  return data;
}

// Refine content with selection
export async function refineWithSelection(mdx: string, question: string, selectedText: string, topic: string) {
  const res = await api.ai["refine-with-selection"].$post({
    json: { mdx, question, selected_text: selectedText, topic }
  });
  if (!res.ok) {
    throw new Error("Failed to refine content with selection");
  }
  const data = await res.json();
  return data;
}

// Refine content with crawling
export async function refineWithCrawling(
  mdx: string,
  question: string,
  selectedText: string,
  topic: string,
  numResults?: number
) {
  const res = await api.ai["refine-with-crawling"].$post({
    json: { mdx, question, selected_text: selectedText, topic, num_results: numResults }
  });
  if (!res.ok) {
    throw new Error("Failed to refine content with crawling");
  }
  const data = await res.json();
  return data;
}

// Refine content with URLs
export async function refineWithUrls(
  mdx: string,
  question: string,
  selectedText: string,
  topic: string,
  urls: string[]
) {
  const res = await api.ai["refine-with-urls"].$post({
    json: { mdx, question, selected_text: selectedText, topic, urls }
  });
  if (!res.ok) {
    throw new Error("Failed to refine content with URLs");
  }
  const data = await res.json();
  return data;
}

// Refine content with selection (raw)
export async function refineWithSelectionRaw(
  mdx: string,
  question: string,
  selectedText: string,
  selectedTopic: string,
  mainTopic: string
) {
  try {
    console.log('API call params (refine with selection):', {
      mdx: mdx.substring(0, 50) + "...", // Log just a snippet of the MDX
      question,
      selected_text: selectedText,
      selected_topic: selectedTopic,
      main_topic: mainTopic
    });

    const res = await api.ai["refine-with-selection-raw"].$post({
      json: {
        mdx,
        question,
        selected_text: selectedText,
        topic: selectedTopic  // Server will map this to selected_topic and main_topic
      }
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'No error text available');
      console.error('Server error response (refine with selection):', errorText);
      throw new Error(`Failed to refine content with selection: ${res.status} ${res.statusText}`);
    }

    const refinedText = await res.text();

    // Replace only the selected text with the refined content
    return mdx.replace(selectedText, refinedText);
  } catch (error) {
    console.error('Error in refineWithSelectionRaw:', error);
    throw error;
  }
}

// Direct replacement of selected text with new content
export async function directReplaceSelectedText(
  mdx: string,
  selectedText: string,
  replacementText: string,
  topic: string
) {
  try {
    console.log('API call params (direct text replacement):', {
      mdx: mdx.substring(0, 50) + "...", // Log just a snippet of the MDX
      selected_text: selectedText.substring(0, 50) + (selectedText.length > 50 ? "..." : ""),
      replacement_text: replacementText.substring(0, 50) + (replacementText.length > 50 ? "..." : ""),
      topic
    });

    // Simple client-side replacement without server call
    return mdx.replace(selectedText, replacementText);
  } catch (error) {
    console.error('Error in directReplaceSelectedText:', error);
    throw error;
  }
}

// Refine content with crawling (raw)
export async function refineWithCrawlingRaw(
  mdx: string,
  question: string,
  selectedText: string,
  selectedTopic: string,
  mainTopic: string,
  numResults?: number
) {
  try {
    console.log('API call params (refine with crawling):', {
      mdx: mdx.substring(0, 50) + "...", // Log just a snippet of the MDX
      question,
      selected_text: selectedText,
      selected_topic: selectedTopic,
      main_topic: mainTopic,
      num_results: numResults
    });

    const res = await api.ai["refine-with-crawling-raw"].$post({
      json: {
        mdx,
        question,
        selected_text: selectedText,
        topic: selectedTopic,  // Server will map this to selected_topic and main_topic
        num_results: numResults
      }
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'No error text available');
      console.error('Server error response (refine with crawling):', errorText);
      throw new Error(`Failed to refine content with crawling: ${res.status} ${res.statusText}`);
    }

    const refinedText = await res.text();

    // Replace only the selected text with the refined content
    return mdx.replace(selectedText, refinedText);
  } catch (error) {
    console.error('Error in refineWithCrawlingRaw:', error);
    throw error;
  }
}

// Refine content with URLs (raw)
export async function refineWithUrlsRaw(
  mdx: string,
  question: string,
  selectedText: string,
  selectedTopic: string,
  mainTopic: string,
  urls: string[]
) {
  try {
    console.log('API call params (refine with URLs):', {
      mdx: mdx.substring(0, 50) + "...", // Log just a snippet of the MDX
      question,
      selected_text: selectedText,
      selected_topic: selectedTopic,
      main_topic: mainTopic,
      urls
    });

    const res = await api.ai["refine-with-urls-raw"].$post({
      json: {
        mdx,
        question,
        selected_text: selectedText,
        topic: selectedTopic,  // Server will map this to selected_topic and main_topic
        urls
      }
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'No error text available');
      console.error('Server error response (refine with URLs):', errorText);
      throw new Error(`Failed to refine content with URLs: ${res.status} ${res.statusText}`);
    }

    const refinedText = await res.text();

    // Replace only the selected text with the refined content
    return mdx.replace(selectedText, refinedText);
  } catch (error) {
    console.error('Error in refineWithUrlsRaw:', error);
    throw error;
  }
}

// Lesson Plan API functions

// Save a complete lesson plan
export async function saveLessonPlan(lessonPlan: LessonPlan) {
  try {
    console.log('Saving lesson plan:', {
      id: lessonPlan.id,
      name: lessonPlan.name,
      mainTopic: lessonPlan.mainTopic,
      topicsCount: lessonPlan.topics.length
    });

    let res;

    // If the lesson plan has an ID, update it instead of creating a new one
    if (lessonPlan.id) {
      console.log(`Updating existing lesson plan with ID: ${lessonPlan.id}`);
      res = await api.lessonPlans[`:id`].$put({
        param: { id: lessonPlan.id.toString() },
        json: lessonPlan
      } as any);
    } else {
      console.log('Creating new lesson plan');
      res = await api.lessonPlans.$post({
        json: lessonPlan
      } as any);
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'No error text available');
      console.error('Server error response when saving lesson plan:', errorText);
      throw new Error(`Failed to save lesson plan: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    console.log('Lesson plan saved successfully:', data);
    return data;
  } catch (error) {
    console.error('Error in saveLessonPlan:', error);
    throw error;
  }
}

// Get all lesson plans for the current user
export async function getLessonPlans() {
  try {
    const res = await api.lessonPlans.$get();

    if (!res.ok) {
      throw new Error("Failed to get lesson plans");
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error in getLessonPlans:', error);
    throw error;
  }
}

// Define the type for a lesson plan response
export type LessonPlanResponse = {
  id: number;
  userId: string;
  name: string;
  mainTopic: string;
  topics: {
    topic: string;
    mdxContent: string;
    isSubtopic: boolean;
    parentTopic?: string;
    mainTopic?: string;
  }[];
  isPublic: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

// Define the type for an error response
export type ErrorResponse = {
  error: string;
};

// Get a specific lesson plan by ID
export async function getLessonPlanById(id: number): Promise<LessonPlanResponse | ErrorResponse> {
  try {
    console.log(`Fetching lesson plan with ID: ${id}`);
    const res = await api.lessonPlans[":id"].$get({ param: { id: String(id) } });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'No error text available');
      console.error('Server error response when fetching lesson plan:', errorText);
      return { error: `Failed to get lesson plan with ID ${id}: ${res.status} ${res.statusText}` };
    }

    const data = await res.json() as LessonPlanResponse;
    console.log('Lesson plan fetched successfully:', {
      id: data.id,
      name: data.name,
      mainTopic: data.mainTopic,
      topicsCount: data.topics?.length || 0
    });
    return data;
  } catch (error) {
    console.error(`Error in getLessonPlanById(${id}):`, error);
    return { error: `Failed to get lesson plan: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// Delete a lesson plan by ID
export async function deleteLessonPlan(id: number) {
  try {
    console.log(`Deleting lesson plan with ID: ${id}`);
    const res = await api.lessonPlans[":id"].$delete({ param: { id: String(id) } });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'No error text available');
      console.error('Server error response when deleting lesson plan:', errorText);
      throw new Error(`Failed to delete lesson plan: ${res.status} ${res.statusText}`);
    }

    console.log('Lesson plan deleted successfully');
    return true;
  } catch (error) {
    console.error(`Error in deleteLessonPlan(${id}):`, error);
    throw error;
  }
}

// React Query options
export const searchTopicsQueryOptions = queryOptions({
  queryKey: ["search-topics", "", undefined] as [string, string, number | undefined],
  queryFn: ({ queryKey }) => searchTopics(queryKey[1], queryKey[2]),
  enabled: false, // Only run when explicitly called
});

// Get all public lesson plans
export async function getPublicLessonPlans() {
  try {
    console.log('Fetching all public lesson plans');
    const res = await api.lessonPlans.public.$get();

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'No error text available');
      console.error('Server error response when fetching public lesson plans:', errorText);
      throw new Error(`Failed to get public lesson plans: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    console.log('Public lesson plans fetched successfully:', {
      count: data.lessonPlans?.length || 0,
      plans: data.lessonPlans?.map(plan => ({
        id: plan.id,
        name: plan.name,
        isPublic: plan.isPublic,
        userId: plan.userId
      }))
    });
    return data;
  } catch (error) {
    console.error('Error in getPublicLessonPlans:', error);
    throw error;
  }
}

// Check if a lesson plan is public
export async function checkIfLessonPlanIsPublic(id: number): Promise<boolean> {
  try {
    console.log(`Checking if lesson plan with ID ${id} is public`);

    // Use the new direct endpoint to check if a lesson plan is public
    const res = await api.lessonPlans["check-public"][":id"].$get({ param: { id: String(id) } });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'No error text available');
      console.error(`Server error response when checking if lesson plan ${id} is public:`, errorText);
      return false;
    }

    const data = await res.json() as { exists: boolean; isPublic: boolean };
    console.log(`Direct check result for lesson plan ${id}:`, data);

    // Return whether the lesson plan exists and is public
    return data.exists && data.isPublic;
  } catch (error) {
    console.error(`Error checking if lesson plan ${id} is public:`, error);
    return false;
  }
}

// Get a specific public lesson plan by ID
export async function getPublicLessonPlanById(id: number): Promise<LessonPlanResponse | ErrorResponse> {
  try {
    console.log(`Fetching public lesson plan with ID: ${id}`);

    // Directly try to fetch the public lesson plan
    const res = await api.lessonPlans.public[":id"].$get({ param: { id: String(id) } });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'No error text available');
      console.error('Server error response when fetching public lesson plan:', errorText);
      return { error: `Failed to get public lesson plan with ID ${id}: ${res.status} ${res.statusText}` };
    }

    const data = await res.json() as LessonPlanResponse;
    console.log('Public lesson plan fetched successfully:', {
      id: data.id,
      name: data.name,
      mainTopic: data.mainTopic,
      topicsCount: data.topics?.length || 0
    });
    return data;
  } catch (error) {
    console.error(`Error in getPublicLessonPlanById(${id}):`, error);
    return { error: `Failed to get public lesson plan: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// Lesson plan query options
export const lessonPlansQueryOptions = queryOptions({
  queryKey: ["lesson-plans"],
  queryFn: getLessonPlans,
  staleTime: 1000 * 60 * 5, // 5 minutes
});

// Public lesson plan query options
export const publicLessonPlansQueryOptions = queryOptions({
  queryKey: ["public-lesson-plans"],
  queryFn: getPublicLessonPlans,
  staleTime: 1000 * 60 * 5, // 5 minutes
});

// Get user information by ID (for public display)
export async function getUserById(id: string) {
  try {
    console.log(`Fetching user information for ID: ${id}`);
    // The user endpoint is under the root auth route
    const res = await api["user"][":id"].$get({ param: { id } });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'No error text available');
      console.error('Server error response when fetching user:', errorText);
      return null;
    }

    const data = await res.json();
    if ('user' in data) {
      return data.user;
    }
    return null;
  } catch (error) {
    console.error(`Error in getUserById(${id}):`, error);
    return null;
  }
}

// User query options by ID
export const userByIdQueryOptions = (id: string) => queryOptions({
  queryKey: ["user", id],
  queryFn: () => getUserById(id),
  staleTime: 1000 * 60 * 60, // 1 hour
  enabled: !!id, // Only run if ID is provided
});

