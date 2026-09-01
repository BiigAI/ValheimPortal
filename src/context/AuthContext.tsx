import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, AUTH_STORAGE_KEY } from '../api/client';

export interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  login: async () => ({ success: false, message: 'Not initialized' }),
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem('bifrostheim_auth');
    setIsAuthenticated(false);
  }, []);

  // Validate session against server on startup
  useEffect(() => {
    let isMounted = true;

    const verifyCurrentSession = async () => {
      const storedToken = sessionStorage.getItem(AUTH_STORAGE_KEY) || sessionStorage.getItem('bifrostheim_auth');

      // If no token exists at all in storage, immediately mark unauthenticated
      if (!storedToken) {
        if (isMounted) {
          setIsAuthenticated(false);
          setIsLoading(false);
        }
        return;
      }

      try {
        const res = await api.verifyAuth();
        if (isMounted) {
          if (res.authenticated) {
            setIsAuthenticated(true);
          } else {
            logout();
          }
        }
      } catch {
        // If verify fails (e.g. 401 or network error), clear invalid token
        if (isMounted) {
          logout();
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    verifyCurrentSession();

    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener('bigfrost_unauthorized', handleUnauthorized);
    return () => {
      isMounted = false;
      window.removeEventListener('bigfrost_unauthorized', handleUnauthorized);
    };
  }, [logout]);

  const login = async (password: string): Promise<{ success: boolean; message: string }> => {
    const trimmed = password.trim();
    if (!trimmed) {
      return { success: false, message: 'Please enter the admin password.' };
    }

    try {
      const res = await api.login(trimmed);
      if (res.success) {
        sessionStorage.setItem(AUTH_STORAGE_KEY, trimmed);
        sessionStorage.setItem('bifrostheim_auth', trimmed);
        setIsAuthenticated(true);
        return { success: true, message: res.message || 'Authenticated successfully' };
      }
      return { success: false, message: res.message || 'Invalid admin password.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Could not connect to the server. Is it online?' };
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
