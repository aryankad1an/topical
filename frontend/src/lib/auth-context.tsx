import { createContext, useContext, ReactNode, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  loginWithPassword,
  logoutSession,
  registerAccount,
  userQueryOptions,
  type Credentials,
  type Registration,
  type SessionResponse,
} from './api';

// Define the shape of our user object
export interface User {
  id: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  picture?: string;
  username?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  roles?: string[];
}

// Define the shape of our auth context
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isNewUser: boolean;
  /** True while a sign-in, sign-up or sign-out is in flight — use for
   *  immediate button feedback. */
  isNavigating: boolean;
  hasRole: (role: string) => boolean;
  refetchUser?: () => Promise<void>;
  /** Sign in with an email and password. Throws with the server's reason. */
  login: (credentials: Credentials) => Promise<void>;
  /** Create an account. The response is already signed in. */
  register: (registration: Registration) => Promise<void>;
  logout: () => void;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isNewUser: false,
  isNavigating: false,
  hasRole: () => false,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

// Create a provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  // Flips true while an auth request is in flight, purely so buttons can show
  // instant feedback.
  const [isNavigating, setIsNavigating] = useState(false);
  // Set by register(), and cleared once the client has run onboarding. The
  // server reports it on exactly one response, so it cannot be re-read.
  const [justRegistered, setJustRegistered] = useState(false);
  const queryClient = useQueryClient();

  // No persisted cache to go stale: every full page load fetches /api/me
  // fresh, so this always reflects the server's actual session state.
  const { data, isLoading, refetch } = useQuery(userQueryOptions);

  const user = (data?.user as unknown as User) || null;
  const isAuthenticated = !!user;
  const isNewUser = justRegistered || !!(data as { isNewUser?: boolean } | undefined)?.isNewUser;

  const hasRole = (role: string) => !!user?.roles?.includes(role);

  const refetchUser = async () => {
    await refetch();
  };

  /**
   * Adopt a session response as the current user.
   *
   * Seeding the cache rather than refetching: the sign-in response already
   * carries the user, and a refetch would leave the screen unauthenticated for
   * one more round trip after the password was accepted.
   */
  const adopt = (session: SessionResponse) => {
    queryClient.setQueryData(userQueryOptions.queryKey, session);
  };

  const login = async (credentials: Credentials) => {
    setIsNavigating(true);
    try {
      adopt(await loginWithPassword(credentials));
      setJustRegistered(false);
    } finally {
      setIsNavigating(false);
    }
  };

  const register = async (registration: Registration) => {
    setIsNavigating(true);
    try {
      adopt(await registerAccount(registration));
      setJustRegistered(true);
    } finally {
      setIsNavigating(false);
    }
  };

  const logout = () => {
    setIsNavigating(true);
    // The cache is cleared before the navigation so no signed-in data survives
    // into the next page, even if the request itself fails.
    void logoutSession()
      .catch(() => {})
      .finally(() => {
        queryClient.clear();
        window.location.assign('/');
      });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: isLoading || isNavigating,
        isAuthenticated,
        isNewUser,
        isNavigating,
        hasRole,
        refetchUser,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Create a hook to use the auth context
export function useAuth() {
  return useContext(AuthContext);
}
