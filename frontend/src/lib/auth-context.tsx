import { createContext, useContext, ReactNode, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { userQueryOptions } from './api';

export const AUTH_ROUTES = {
  login: '/api/login',
  register: '/api/register',
  logout: '/api/logout',
} as const;

export const AUTH_CACHE_KEY = 'topical-react-query-cache';

// Define the shape of our user object
export interface User {
  id: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  picture?: string;
  roles?: string[];
}

// Define the shape of our auth context
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasRole: (role: string) => boolean;
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
  hasRole: () => false,
  loginUrl: AUTH_ROUTES.login,
  registerUrl: AUTH_ROUTES.register,
  loginAction: () => {},
  registerAction: () => {},
  logout: () => {},
});

// Create a provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const queryClient = useQueryClient();

  // Use the userQueryOptions to fetch the current user
  const { data, isLoading } = useQuery(userQueryOptions);

  // Extract the user from the data
  const user = (data?.user as unknown as User) || null;
  const isAuthenticated = !!user;

  // Function to check if the user has a specific role
  const hasRole = (role: string) => {
    if (!user || !user.roles) return false;
    return user.roles.includes(role);
  };

  // Function to handle logout
  const logout = () => {
    setIsRedirecting(true);
    queryClient.setQueryData(userQueryOptions.queryKey, { user: null });
    queryClient.removeQueries({ queryKey: userQueryOptions.queryKey });
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(AUTH_CACHE_KEY);
      window.location.assign(AUTH_ROUTES.logout);
    }
  };

  const loginAction = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setIsRedirecting(true);
    queryClient.setQueryData(userQueryOptions.queryKey, { user: null });
    queryClient.removeQueries({ queryKey: userQueryOptions.queryKey });
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(AUTH_CACHE_KEY);
      window.location.assign(AUTH_ROUTES.login);
    }
  };

  const registerAction = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setIsRedirecting(true);
    queryClient.setQueryData(userQueryOptions.queryKey, { user: null });
    queryClient.removeQueries({ queryKey: userQueryOptions.queryKey });
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(AUTH_CACHE_KEY);
      window.location.assign(AUTH_ROUTES.register);
    }
  };

  // Note: 401 on /api/me is expected for unauthenticated users — no toast needed

  // Provide the auth context to children
  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: isLoading || isRedirecting,
        isAuthenticated,
        hasRole,
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
