import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";
// Import the auth provider
import { AuthProvider } from "./lib/auth-context";

// Create a client. Auth state is intentionally NOT persisted to localStorage:
// the session lives in an httpOnly cookie the server controls, so every reload
// should ask it who is signed in rather than trust a cached user that may have
// been signed out since. See auth-context.tsx.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24,
    },
  },
});

// Create a new router instance
const router = createRouter({ routeTree, context: {queryClient} });

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
