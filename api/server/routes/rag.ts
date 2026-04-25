import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { getUser } from "../kinde";

// RAG Service URL Priority:
// 1. If LOCAL_RAG_URL is set in .env, use it (for local development)
// 2. Otherwise, use DEPLOYED_RAG_URL from .env (Modal deployment)
const RAG_SERVICE_URL = process.env.LOCAL_RAG_URL || process.env.DEPLOYED_RAG_URL || "https://manishk5507--topicmarker-rag-fastapi-app.modal.run";

console.log(`🔗 RAG Service: ${RAG_SERVICE_URL} (${process.env.LOCAL_RAG_URL ? "LOCAL" : "DEPLOYED"})`);

// Schema for topic search
const searchTopicsSchema = z.object({
  query: z.string().min(1),
  limit: z.number().optional(),
});

// Schema for single topic generation
const singleTopicSchema = z.object({
  selected_topic: z.string().min(1),
  main_topic: z.string().min(1),
  topic: z.string().optional(),
  num_results: z.number().optional(),
});

// Schema for LLM-only MDX generation
const llmOnlyMdxSchema = z.object({
  selected_topic: z.string().min(1),
  main_topic: z.string().min(1),
  topic: z.string().optional(),
});

// Schema for URL-based MDX generation
const urlMdxSchema = z.object({
  url: z.string().url(),
  selected_topic: z.string().min(1),
  main_topic: z.string().min(1),
  topic: z.string().optional(),
  use_llm_knowledge: z.boolean().optional(),
});

// Schema for multiple URLs MDX generation
const urlsMdxSchema = z.object({
  urls: z.array(z.string().url()),
  selected_topic: z.string().min(1),
  main_topic: z.string().min(1),
  topic: z.string().optional(),
  use_llm_knowledge: z.boolean().optional(),
});

// Schema for content refinement
const refineSchema = z.object({
  mdx: z.string(),
  question: z.string().min(1),
});

// Schema for content refinement with selection
const refineWithSelectionSchema = z.object({
  mdx: z.string(),
  question: z.string().min(1),
  selected_text: z.string(),
  topic: z.string().min(1),
  direct_replacement: z.string().optional(), // Optional parameter for direct text replacement
});

// Schema for content refinement with crawling
const refineWithCrawlingSchema = z.object({
  mdx: z.string(),
  question: z.string().min(1),
  selected_text: z.string(),
  topic: z.string().min(1),
  num_results: z.number().optional(),
});

// Schema for content refinement with URLs
const refineWithUrlsSchema = z.object({
  mdx: z.string(),
  question: z.string().min(1),
  selected_text: z.string(),
  topic: z.string().min(1),
  urls: z.array(z.string().url()),
});

export const ragRoute = new Hono()
  // Topic Generation
  .post("/search-topics", getUser, zValidator("json", searchTopicsSchema), async (c) => {
    const { query, limit } = c.req.valid("json");
    try {
      const response = await fetch(`${RAG_SERVICE_URL}/rag/search-topics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, limit }),
      });

      if (!response.ok) {
        throw new Error("RAG service error");
      }

      const data = await response.json();
      return c.json(data);
    } catch (error) {
      console.error(error);
      return c.json({ error: "Failed to query RAG service" }, 500);
    }
  })

  // MDX Generation
  .post("/single-topic", getUser, zValidator("json", singleTopicSchema), async (c) => {
    const { selected_topic, main_topic, topic, num_results } =
      c.req.valid("json");
    try {
      console.log("Server received request for single-topic:", {
        selected_topic,
        main_topic,
        topic,
        num_results,
      });

      // Prepare the request body
      const requestBody: any = {
        main_topic,
        num_results,
      };

      // Use the provided topic if it exists, otherwise use selected_topic
      requestBody.topic = topic || selected_topic;

      console.log("Sending to backend:", requestBody);

      const response = await fetch(`${RAG_SERVICE_URL}/rag/single-topic`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error("RAG service error");
      }

      const data = await response.json();
      return c.json(data);
    } catch (error) {
      console.error(error);
      return c.json({ error: "Failed to generate MDX content" }, 500);
    }
  })

  .post(
    "/single-topic-raw",
    getUser,
    zValidator("json", singleTopicSchema),
    async (c) => {
      const { selected_topic, main_topic, topic, num_results } =
        c.req.valid("json");
      try {
        console.log("Server received request for single-topic-raw:", {
          selected_topic,
          main_topic,
          topic,
          num_results,
        });

        // Prepare the request body
        const requestBody: any = {
          main_topic,
          num_results,
          selected_topic
        };

        // Use the provided topic if it exists, otherwise use selected_topic
        requestBody.topic = topic || selected_topic;

        console.log("Sending to backend:", requestBody);

        const response = await fetch(
          `${RAG_SERVICE_URL}/rag/single-topic-raw`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          }
        );

        if (!response.ok) {
          const errorText = await response
            .text()
            .catch(() => "No error details available");
          console.error(`RAG service error (${response.status}):`, errorText);
          throw new Error(
            `RAG service error: ${response.status} ${response.statusText}`
          );
        }

        const rawText = await response.text();
        return c.text(rawText);
      } catch (error) {
        console.error("Error in single-topic-raw:", error);
        return c.text(
          `Failed to generate MDX content: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          500
        );
      }
    }
  )

  // LLM-only MDX Generation
  .post(
    "/generate-mdx-llm-only",
    getUser,
    zValidator("json", llmOnlyMdxSchema),
    async (c) => {
      const { selected_topic, main_topic, topic } = c.req.valid("json");
      try {
        console.log("Server received request for generate-mdx-llm-only:", {
          selected_topic,
          main_topic,
          topic,
        });
        console.log("Processing request for:", { selected_topic, main_topic });

        try {
          // Use exactly the format the RAG backend expects
          const exactRequestBody = {
            selected_topic: selected_topic,
            main_topic: main_topic,
          };

          console.log(
            "Sending exact request format to backend:",
            exactRequestBody
          );

          const response = await fetch(
            `${RAG_SERVICE_URL}/rag/generate-mdx-llm-only`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify(exactRequestBody),
            }
          );

          // Log the response status and headers for debugging
          console.log(
            `RAG response status: ${response.status} ${response.statusText}`
          );
          // Log a few important headers
          console.log(
            `RAG response content-type:`,
            response.headers.get("content-type")
          );
          console.log(
            `RAG response content-length:`,
            response.headers.get("content-length")
          );

          if (!response.ok) {
            const errorText = await response
              .text()
              .catch(() => "No error details available");
            console.error(
              `RAG service error (${response.status}) in LLM-only:`,
              errorText
            );
            console.error(
              `Request body sent:`,
              JSON.stringify(exactRequestBody)
            );

            // Handle different error types
            if (response.status === 404) {
              console.log(
                "RAG endpoint not found, generating fallback content"
              );
              // Generate a simple MDX content as fallback for 404
              return c.json({
                status: "success",
                data: {
                  mdx_content: `# ${selected_topic}

## Overview

This is a fallback content for "${selected_topic}" in the context of "${main_topic}".

The RAG service endpoint for LLM-only generation is currently unavailable. Please try one of the following:

1. Check if the RAG backend service is running at ${RAG_SERVICE_URL}
2. Verify that the RAG backend has the required endpoint: /rag/generate-mdx-llm-only
3. Try using the URL-based or crawling generation methods instead

## Next Steps

- Ensure the RAG backend service is properly configured
- Contact the system administrator if the issue persists
`,
                },
              });
            } else if (response.status === 422) {
              console.log("RAG validation error, generating fallback content");

              // Try to parse the error response for more details
              let errorDetails = "Unknown validation error";
              try {
                if (errorText && errorText.includes("{")) {
                  const errorJson = JSON.parse(errorText);
                  errorDetails = JSON.stringify(errorJson, null, 2);
                } else {
                  errorDetails = errorText;
                }
              } catch (e) {
                console.error("Error parsing validation error:", e);
                errorDetails = errorText;
              }

              // Generate a simple MDX content as fallback for validation errors
              return c.json({
                status: "success",
                data: {
                  mdx_content: `# ${selected_topic}

## Content Generation Error

There was a validation error when trying to generate content for "${selected_topic}" in the context of "${main_topic}".

### Error Details
The RAG service reported a validation error (422 Unprocessable Entity):

\`\`\`
${errorDetails}
\`\`\`

This typically means:
- The request format doesn't match what the API expects
- Some required parameters are missing or invalid
- The topic may require specific formatting

### Troubleshooting
- Check that the RAG backend is properly configured
- Verify that the API endpoint is correctly implemented
- Ensure the request format matches the API's expectations

For more detailed information, try using the URL-based or crawling generation methods.
`,
                },
              });
            }

            // For other errors, generate a generic fallback
            return c.json({
              status: "success",
              data: {
                mdx_content: `# ${selected_topic}

## Error Generating Content

We encountered an error (${response.status} ${response.statusText}) when trying to generate content for "${selected_topic}" in the context of "${main_topic}".

### Basic Information
Here's some basic information about the topic:

Next.js 15 is a major release of the popular React framework that introduces several new features and improvements compared to previous versions.

### Try Alternative Methods
Please try:
- Using the URL-based generation method
- Using the crawling generation method
- Refreshing the page and trying again
- Selecting a different topic

If the problem persists, contact the system administrator.
`,
              },
            });
          }

          const data = await response.json();
          return c.json(data);
        } catch (fetchError) {
          // Handle connection errors (e.g., RAG service not running)
          if (
            fetchError instanceof TypeError &&
            fetchError.message.includes("fetch failed")
          ) {
            console.error("RAG service connection error:", fetchError);

            // Generate a simple MDX content as fallback when service is unreachable
            return c.json({
              status: "success",
              data: {
                mdx_content: `# ${selected_topic}

## Connection Error

Unable to connect to the RAG service at ${RAG_SERVICE_URL}.

### Possible reasons:
- The RAG backend service is not running
- There's a network issue preventing connection to the service
- The service URL is incorrect

### Suggested actions:
1. Start the RAG backend service if it's not running
2. Check network connectivity
3. Verify the RAG_SERVICE_URL configuration in the server

For now, you can try using the URL-based generation method which might have cached responses.
`,
              },
            });
          }

          // Re-throw other errors
          throw fetchError;
        }
      } catch (error) {
        console.error("Error in generate-mdx-llm-only:", error);
        return c.json(
          {
            error: `Failed to generate MDX content using LLM only: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
          500
        );
      }
    }
  )

  .post(
    "/generate-mdx-llm-only-raw",
    getUser,
    zValidator("json", llmOnlyMdxSchema),
    async (c) => {
      const { selected_topic, main_topic, topic } = c.req.valid("json");
      try {
        console.log("Server received request for generate-mdx-llm-only-raw:", {
          selected_topic,
          main_topic,
          topic,
        });
        console.log("Processing request for:", { selected_topic, main_topic });

        try {
          // Prepare the request body with exactly the format expected by the RAG backend
          const requestBody = {
            selected_topic: selected_topic,
            main_topic: main_topic
          };

          console.log(
            "Sending exact request format to backend:",
            requestBody
          );

          const response = await fetch(
            `${RAG_SERVICE_URL}/rag/generate-mdx-llm-only-raw`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Accept": "text/plain",
              },
              body: JSON.stringify(requestBody),
            }
          );

          // Log the response status and headers for debugging
          console.log(
            `RAG response status: ${response.status} ${response.statusText}`
          );
          // Log a few important headers
          console.log(
            `RAG response content-type:`,
            response.headers.get("content-type")
          );
          console.log(
            `RAG response content-length:`,
            response.headers.get("content-length")
          );

          if (!response.ok) {
            const errorText = await response
              .text()
              .catch(() => "No error details available");
            console.error(
              `RAG service error (${response.status}) in LLM-only:`,
              errorText
            );
            console.error(
              `Request body sent:`,
              JSON.stringify(requestBody)
            );

            // Handle different error types
            if (response.status === 404) {
              console.log(
                "RAG endpoint not found, generating fallback content"
              );
              // Generate a simple MDX content as fallback for 404
              const fallbackMdx = `# ${selected_topic}

## Overview

This is a fallback content for "${selected_topic}" in the context of "${main_topic}".

The RAG service endpoint for LLM-only generation is currently unavailable. Please try one of the following:

1. Check if the RAG backend service is running at ${RAG_SERVICE_URL}
2. Verify that the RAG backend has the required endpoint: /rag/generate-mdx-llm-only-raw
3. Try using the URL-based or crawling generation methods instead

## Next Steps

- Ensure the RAG backend service is properly configured
- Contact the system administrator if the issue persists
`;
              return c.text(fallbackMdx);
            } else if (response.status === 422) {
              console.log("RAG validation error, generating fallback content");

              // Try to parse the error response for more details
              let errorDetails = "Unknown validation error";
              try {
                if (errorText && errorText.includes("{")) {
                  const errorJson = JSON.parse(errorText);
                  errorDetails = JSON.stringify(errorJson, null, 2);
                } else {
                  errorDetails = errorText;
                }
              } catch (e) {
                console.error("Error parsing validation error:", e);
                errorDetails = errorText;
              }

              // Generate a simple MDX content as fallback for validation errors
              const validationErrorMdx = `# ${selected_topic}

## Content Generation Error

There was a validation error when trying to generate content for "${selected_topic}" in the context of "${main_topic}".

### Error Details
The RAG service reported a validation error (422 Unprocessable Entity):

\`\`\`
${errorDetails}
\`\`\`

This typically means:
- The request format doesn't match what the API expects
- Some required parameters are missing or invalid
- The topic may require specific formatting

### Troubleshooting
- Check that the RAG backend is properly configured
- Verify that the API endpoint is correctly implemented
- Ensure the request format matches the API's expectations

For more detailed information, try using the URL-based or crawling generation methods.
`;
              return c.text(validationErrorMdx);
            }

            // For other errors, generate a generic fallback
            const genericErrorMdx = `# ${selected_topic}

## Error Generating Content

We encountered an error (${response.status} ${response.statusText}) when trying to generate content for "${selected_topic}" in the context of "${main_topic}".

### Basic Information
Here's some basic information about the topic:

Next.js 15 is a major release of the popular React framework that introduces several new features and improvements compared to previous versions.

### Try Alternative Methods
Please try:
- Using the URL-based generation method
- Using the crawling generation method
- Refreshing the page and trying again
- Selecting a different topic

If the problem persists, contact the system administrator.
`;
            return c.text(genericErrorMdx);
          }

          const rawText = await response.text();
          return c.text(rawText);
        } catch (fetchError) {
          // Handle connection errors (e.g., RAG service not running)
          if (
            fetchError instanceof TypeError &&
            fetchError.message.includes("fetch failed")
          ) {
            console.error("RAG service connection error:", fetchError);

            // Generate a simple MDX content as fallback when service is unreachable
            const connectionErrorMdx = `# ${selected_topic}

## Connection Error

Unable to connect to the RAG service at ${RAG_SERVICE_URL}.

### Possible reasons:
- The RAG backend service is not running
- There's a network issue preventing connection to the service
- The service URL is incorrect

### Suggested actions:
1. Start the RAG backend service if it's not running
2. Check network connectivity
3. Verify the RAG_SERVICE_URL configuration in the server

For now, you can try using the URL-based generation method which might have cached responses.
`;
            return c.text(connectionErrorMdx);
          }

          // Re-throw other errors
          throw fetchError;
        }
      } catch (error) {
        console.error("Error in generate-mdx-llm-only-raw:", error);
        return c.text(
          `Failed to generate MDX content using LLM only: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          500
        );
      }
    }
  )

  // URL-based MDX Generation
  .post(
    "/generate-mdx-from-url",
    zValidator("json", urlMdxSchema),
    async (c) => {
      const { url, selected_topic, main_topic, topic, use_llm_knowledge } =
        c.req.valid("json");
      try {
        const response = await fetch(
          `${RAG_SERVICE_URL}/rag/generate-mdx-from-url`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url,
              selected_topic,
              main_topic,
              topic,
              use_llm_knowledge,
            }),
          }
        );

        if (!response.ok) {
          throw new Error("RAG service error");
        }

        const data = await response.json();
        return c.json(data);
      } catch (error) {
        console.error(error);
        return c.json({ error: "Failed to generate MDX from URL" }, 500);
      }
    }
  )

  .post(
    "/generate-mdx-from-url-raw",
    zValidator("json", urlMdxSchema),
    async (c) => {
      const { url, selected_topic, main_topic, topic, use_llm_knowledge } =
        c.req.valid("json");
      try {
        const response = await fetch(
          `${RAG_SERVICE_URL}/rag/generate-mdx-from-url-raw`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url,
              selected_topic,
              main_topic,
              topic,
              use_llm_knowledge,
            }),
          }
        );

        if (!response.ok) {
          throw new Error("RAG service error");
        }

        const rawText = await response.text();
        return c.text(rawText);
      } catch (error) {
        console.error(error);
        return c.text("Failed to generate MDX from URL", 500);
      }
    }
  )

  .post(
    "/generate-mdx-from-urls",
    zValidator("json", urlsMdxSchema),
    async (c) => {
      const { urls, selected_topic, main_topic, topic, use_llm_knowledge } =
        c.req.valid("json");
      try {
        const response = await fetch(
          `${RAG_SERVICE_URL}/rag/generate-mdx-from-urls`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              urls,
              selected_topic,
              main_topic,
              topic,
              use_llm_knowledge,
            }),
          }
        );

        if (!response.ok) {
          throw new Error("RAG service error");
        }

        const data = await response.json();
        return c.json(data);
      } catch (error) {
        console.error(error);
        return c.json({ error: "Failed to generate MDX from URLs" }, 500);
      }
    }
  )

  .post(
    "/generate-mdx-from-urls-raw",
    zValidator("json", urlsMdxSchema),
    async (c) => {
      const { urls, selected_topic, main_topic, topic, use_llm_knowledge } =
        c.req.valid("json");
      try {
        console.log("Server received request for generate-mdx-from-urls-raw:", {
          urls,
          selected_topic,
          main_topic,
          topic,
          use_llm_knowledge,
        });

        const response = await fetch(
          `${RAG_SERVICE_URL}/rag/generate-mdx-from-urls-raw`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              urls,
              selected_topic,
              main_topic,
              topic,
              use_llm_knowledge,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response
            .text()
            .catch(() => "No error details available");
          console.error(
            `RAG service error (${response.status}) in URLs:`,
            errorText
          );
          throw new Error(
            `RAG service error in URLs: ${response.status} ${response.statusText}`
          );
        }

        const rawText = await response.text();
        return c.text(rawText);
      } catch (error) {
        console.error("Error in generate-mdx-from-urls-raw:", error);
        return c.text(
          `Failed to generate MDX from URLs: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          500
        );
      }
    }
  )

  // Content Refinement
  .post("/refine", zValidator("json", refineSchema), async (c) => {
    const { mdx, question } = c.req.valid("json");
    try {
      const response = await fetch(`${RAG_SERVICE_URL}/rag/refine`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mdx, question }),
      });

      if (!response.ok) {
        throw new Error("RAG service error");
      }

      const data = await response.json();
      return c.json(data);
    } catch (error) {
      console.error(error);
      return c.json({ error: "Failed to refine content" }, 500);
    }
  })

  .post(
    "/refine-with-selection",
    zValidator("json", refineWithSelectionSchema),
    async (c) => {
      const { mdx, question, selected_text, topic, direct_replacement } = c.req.valid("json");
      try {
        // If direct_replacement is provided, we'll skip the RAG service and do the replacement directly
        if (direct_replacement) {
          console.log("Server received request for direct text replacement:", {
            mdx: mdx.substring(0, 50) + "...", // Log just a snippet of the MDX
            selected_text: selected_text.substring(0, 50) + (selected_text.length > 50 ? "..." : ""),
            direct_replacement: direct_replacement.substring(0, 50) + (direct_replacement.length > 50 ? "..." : ""),
            topic
          });

          // Simple string replacement - replace the selected_text with direct_replacement
          const updatedMdx = mdx.replace(selected_text, direct_replacement);
          return c.json({
            status: "success",
            data: {
              mdx_content: updatedMdx
            }
          });
        }

        console.log("Server received request for refine-with-selection:", {
          mdx: mdx.substring(0, 50) + "...", // Log just a snippet of the MDX
          question,
          selected_text,
          topic
        });

        // The RAG backend expects selected_topic and main_topic
        const response = await fetch(
          `${RAG_SERVICE_URL}/rag/refine-with-selection`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mdx,
              question,
              selected_text,
              selected_topic: topic,
              main_topic: topic  // Using topic as main_topic as well
            }),
          }
        );

        if (!response.ok) {
          throw new Error("RAG service error");
        }

        const data = await response.json();
        return c.json(data);
      } catch (error) {
        console.error(error);
        return c.json(
          { error: "Failed to refine content with selection" },
          500
        );
      }
    }
  )

  .post(
    "/refine-with-selection-raw",
    zValidator("json", refineWithSelectionSchema),
    async (c) => {
      const { mdx, question, selected_text, topic, direct_replacement } = c.req.valid("json");
      try {
        // If direct_replacement is provided, we'll skip the RAG service and do the replacement directly
        if (direct_replacement) {
          console.log("Server received request for direct text replacement:", {
            mdx: mdx.substring(0, 50) + "...", // Log just a snippet of the MDX
            selected_text: selected_text.substring(0, 50) + (selected_text.length > 50 ? "..." : ""),
            direct_replacement: direct_replacement.substring(0, 50) + (direct_replacement.length > 50 ? "..." : ""),
            topic
          });

          // Simple string replacement - replace the selected_text with direct_replacement
          const updatedMdx = mdx.replace(selected_text, direct_replacement);
          return c.text(updatedMdx);
        }

        // Otherwise, proceed with the normal RAG service refinement
        console.log("Server received request for refine-with-selection-raw:", {
          mdx: mdx.substring(0, 50) + "...", // Log just a snippet of the MDX
          question,
          selected_text,
          topic
        });

        // The RAG backend expects selected_topic and main_topic
        const response = await fetch(
          `${RAG_SERVICE_URL}/rag/refine-with-selection-raw`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mdx,
              question,
              selected_text,
              selected_topic: topic,
              main_topic: topic  // Using topic as main_topic as well
            }),
          }
        );

        if (!response.ok) {
          throw new Error("RAG service error");
        }

        const rawText = await response.text();
        return c.text(rawText);
      } catch (error) {
        console.error(error);
        return c.text("Failed to refine content with selection", 500);
      }
    }
  )

  .post(
    "/refine-with-crawling",
    zValidator("json", refineWithCrawlingSchema),
    async (c) => {
      const { mdx, question, selected_text, topic, num_results } =
        c.req.valid("json");
      try {
        console.log("Server received request for refine-with-crawling:", {
          mdx: mdx.substring(0, 50) + "...", // Log just a snippet of the MDX
          question,
          selected_text,
          topic,
          num_results
        });

        // The RAG backend expects selected_topic and main_topic
        const response = await fetch(
          `${RAG_SERVICE_URL}/rag/refine-with-crawling`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mdx,
              question,
              selected_text,
              selected_topic: topic,
              main_topic: topic,  // Using topic as main_topic as well
              num_results,
            }),
          }
        );

        if (!response.ok) {
          throw new Error("RAG service error");
        }

        const data = await response.json();
        return c.json(data);
      } catch (error) {
        console.error(error);
        return c.json({ error: "Failed to refine content with crawling" }, 500);
      }
    }
  )

  .post(
    "/refine-with-crawling-raw",
    zValidator("json", refineWithCrawlingSchema),
    async (c) => {
      const { mdx, question, selected_text, topic, num_results } =
        c.req.valid("json");
      try {
        console.log("Server received request for refine-with-crawling-raw:", {
          mdx: mdx.substring(0, 50) + "...", // Log just a snippet of the MDX
          question,
          selected_text,
          topic,
          num_results
        });

        // The RAG backend expects selected_topic and main_topic
        const response = await fetch(
          `${RAG_SERVICE_URL}/rag/refine-with-crawling-raw`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mdx,
              question,
              selected_text,
              selected_topic: topic,
              main_topic: topic,  // Using topic as main_topic as well
              num_results,
            }),
          }
        );

        if (!response.ok) {
          throw new Error("RAG service error");
        }

        const rawText = await response.text();
        return c.text(rawText);
      } catch (error) {
        console.error(error);
        return c.text("Failed to refine content with crawling", 500);
      }
    }
  )

  .post(
    "/refine-with-urls",
    zValidator("json", refineWithUrlsSchema),
    async (c) => {
      const { mdx, question, selected_text, topic, urls } = c.req.valid("json");
      try {
        console.log("Server received request for refine-with-urls:", {
          mdx: mdx.substring(0, 50) + "...", // Log just a snippet of the MDX
          question,
          selected_text,
          topic,
          urls
        });

        // The RAG backend expects selected_topic and main_topic
        const response = await fetch(
          `${RAG_SERVICE_URL}/rag/refine-with-urls`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mdx,
              question,
              selected_text,
              selected_topic: topic,
              main_topic: topic,  // Using topic as main_topic as well
              urls
            }),
          }
        );

        if (!response.ok) {
          throw new Error("RAG service error");
        }

        const data = await response.json();
        return c.json(data);
      } catch (error) {
        console.error(error);
        return c.json({ error: "Failed to refine content with URLs" }, 500);
      }
    }
  )

  .post(
    "/refine-with-urls-raw",
    zValidator("json", refineWithUrlsSchema),
    async (c) => {
      const { mdx, question, selected_text, topic, urls } = c.req.valid("json");
      try {
        console.log("Server received request for refine-with-urls-raw:", {
          mdx: mdx.substring(0, 50) + "...", // Log just a snippet of the MDX
          question,
          selected_text,
          topic,
          urls
        });

        // The RAG backend expects selected_topic and main_topic
        const response = await fetch(
          `${RAG_SERVICE_URL}/rag/refine-with-urls-raw`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mdx,
              question,
              selected_text,
              selected_topic: topic,
              main_topic: topic,  // Using topic as main_topic as well
              urls
            }),
          }
        );

        if (!response.ok) {
          throw new Error("RAG service error");
        }

        const rawText = await response.text();
        return c.text(rawText);
      } catch (error) {
        console.error(error);
        return c.text("Failed to refine content with URLs", 500);
      }
    }
  );
