import { createContext, useContext, ReactNode, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { userQueryOptions } from './api';

const AUTH_ROUTES = {
  login: '/api/login',
  register: '/api/register',
  logout: '/api/logout',
} as const;

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
  /** True the instant a login/register/logout action has been triggered but the
   *  full-page navigation hasn't happened yet — use for immediate button feedback. */
  isNavigating: boolean;
  hasRole: (role: string) => boolean;
  refetchUser?: () => Promise<void>;
  loginUrl: string;
  registerUrl: string;
  loginAction: (e?: React.MouseEvent) => void;
  registerAction: (e?: React.MouseEvent) => void;
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
  loginUrl: AUTH_ROUTES.login,
  registerUrl: AUTH_ROUTES.register,
  loginAction: () => {},
  registerAction: () => {},
  logout: () => {},
});

// Create a provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  // Flips true the moment a login/register/logout click is handled, purely so
  // buttons can show instant feedback — the actual navigation is a real <a
  // href> or window.location.assign, never something this flag gates.
  const [isNavigating, setIsNavigating] = useState(false);

  // No persisted cache to go stale: every full page load fetches /api/me
  // fresh, so this always reflects the server's actual session state.
  const { data, isLoading, refetch } = useQuery(userQueryOptions);

  const user = (data?.user as unknown as User) || null;
  const isAuthenticated = !!user;
  // True only on the /api/me response right after a user's very first login.
  const isNewUser = !!(data as { isNewUser?: boolean } | undefined)?.isNewUser;

  const hasRole = (role: string) => !!user?.roles?.includes(role);

  const refetchUser = async () => {
    await refetch();
  };

  // Login/register links are real <a href> elements — the browser's native
  // navigation is the actual mechanism, this just flags "pending" for UI
  // feedback. Deliberately does NOT preventDefault or reimplement navigation.
  const loginAction = (_e?: React.MouseEvent) => setIsNavigating(true);
  const registerAction = (_e?: React.MouseEvent) => setIsNavigating(true);

  // Logout is triggered from a plain <button> (no href to fall back on), so
  // it has to navigate itself.
  const logout = () => {
    setIsNavigating(true);
    window.location.assign(AUTH_ROUTES.logout);
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
        loginUrl: AUTH_ROUTES.login,
        registerUrl: AUTH_ROUTES.register,
        loginAction,
        registerAction,
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
