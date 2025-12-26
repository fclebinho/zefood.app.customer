import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthResponse } from '../types';
import { authService, authEvents, AUTH_EVENTS } from '../services/api';
import api from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    name: string;
    cpf: string;
    phone?: string;
    address?: {
      street: string;
      number: string;
      complement?: string;
      neighborhood: string;
      city: string;
      state: string;
      zipCode: string;
    };
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredUser();

    // Listen for session expired events (when refresh token fails)
    const handleSessionExpired = () => {
      console.log('[useAuth] Session expired, forcing logout');
      setUser(null);
    };

    authEvents.on(AUTH_EVENTS.SESSION_EXPIRED, handleSessionExpired);

    return () => {
      authEvents.off(AUTH_EVENTS.SESSION_EXPIRED, handleSessionExpired);
    };
  }, []);

  const loadStoredUser = async () => {
    try {
      const storedUser = await authService.getStoredUser();
      if (storedUser) {
        setUser(storedUser);
      }
    } catch (error) {
      console.error('Error loading stored user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response: AuthResponse = await authService.login(email, password);
    await authService.storeAuth({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      user: response.user,
    });
    setUser(response.user);
  };

  const register = async (data: {
    email: string;
    password: string;
    name: string;
    cpf: string;
    phone?: string;
    address?: {
      street: string;
      number: string;
      complement?: string;
      neighborhood: string;
      city: string;
      state: string;
      zipCode: string;
    };
  }) => {
    const response: AuthResponse = await authService.register(data);
    await authService.storeAuth({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      user: response.user,
    });
    setUser(response.user);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const response = await api.get('/users/me');
      const updatedUser = response.data;
      setUser(updatedUser);
      // Update stored user
      await authService.updateStoredUser(updatedUser);
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
