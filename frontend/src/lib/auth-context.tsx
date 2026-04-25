import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { userQueryOptions } from './api';
import { toast } from 'sonner';

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
  refetchUser: () => Promise<void>;
  logout: () => void;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  hasRole: () => false,
  refetchUser: async () => {},
  logout: () => {},
});

// Create a provider component
export function AuthProvider({ children }: { children: ReactNode }) {
    const [isRedirecting, setIsRedirecting] = useState(false);

  // Use the userQueryOptions to fetch the current user
  const { data, isLoading, isError, refetch } = useQuery(userQueryOptions);

  // Extract the user from the data
  const user = (data?.user as unknown as User) || null;
  const isAuthenticated = !!user;

  // Function to check if the user has a specific role
  const hasRole = (role: string) => {
    if (!user || !user.roles) return false;
    return user.roles.includes(role);
  };

  // Function to refetch the user data
  const refetchUser = async () => {
    try {
      await refetch();
    } catch (error) {
      console.error('Failed to refetch user:', error);
    }
  };

  // Function to handle logout
  const logout = () => {
    setIsRedirecting(true);
    // We'll redirect to the logout endpoint
    window.location.href = '/api/logout';
  };

  // Show a toast message if there's an authentication error
  useEffect(() => {
    if (isError) {
      toast.error('Authentication error. Please log in again.');
    }
  }, [isError]);

  // Provide the auth context to children
  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: isLoading || isRedirecting,
        isAuthenticated,
        hasRole,
        refetchUser,
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
