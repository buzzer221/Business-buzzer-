import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { SectorId, User } from '../types/index.js';

interface AuthContextType {
  user: User | null;
  allowedSectors: SectorId[];
  allUsers: Array<{ id: string; name: string; role: string; sectors: SectorId[] }>;
  isLoading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isVeterinaire: boolean;
  isEmployee: boolean;
  canAccessSector: (sector: SectorId) => boolean;
  switchUser: (userId: string, pin?: string) => Promise<void>;
  login: (userId: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [allowedSectors, setAllowedSectors] = useState<SectorId[]>([]);
  const [allUsers, setAllUsers] = useState<Array<{ id: string; name: string; role: string; sectors: SectorId[] }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCurrentAuth = async () => {
    try {
      setIsLoading(true);
      const data = await api.getMe();
      setUser(data.user);
      setAllowedSectors(data.allowedSectors || []);
      setAllUsers(data.allUsers || []);
    } catch (err) {
      console.error('Failed to load user session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentAuth();
  }, []);

  const handleSwitchUser = async (userId: string, pin?: string) => {
    try {
      setIsLoading(true);
      const res = await api.switchUser(userId, pin);
      setUser(res.user);
      setAllowedSectors(res.allowedSectors || []);
      await loadCurrentAuth();
    } catch (err) {
      console.error('Failed to switch user:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (userId: string, pin: string) => {
    try {
      setIsLoading(true);
      const res = await api.login(userId, pin);
      setUser(res.user);
      setAllowedSectors(res.allowedSectors || []);
      await loadCurrentAuth();
    } catch (err) {
      console.error('Failed to login:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await api.logout();
      setUser(null);
      setAllowedSectors([]);
    } catch (err) {
      console.error('Failed to logout:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isVeterinaire = user?.role === 'veterinaire';
  const isEmployee = user?.role === 'employee';

  const canAccessSector = (sector: SectorId): boolean => {
    if (isAdmin || isManager || isVeterinaire) return true;
    return allowedSectors.includes(sector);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        allowedSectors,
        allUsers,
        isLoading,
        isAdmin,
        isManager,
        isVeterinaire,
        isEmployee,
        canAccessSector,
        switchUser: handleSwitchUser,
        login: handleLogin,
        logout: handleLogout,
        refreshAuth: loadCurrentAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
