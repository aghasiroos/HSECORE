import React, { createContext, useContext, useState, useEffect } from 'react';

export type Role = 'ADMIN' | 'HSE_MANAGER' | 'SUPERVISOR' | 'WORKER';

interface KeycloakContextType {
  isAuthenticated: boolean;
  token: string | null;
  roles: Role[];
  username: string;
  hasRole: (role: Role) => boolean;
  login: (role: Role, username: string) => void;
  logout: () => void;
}

const KeycloakContext = createContext<KeycloakContextType | undefined>(undefined);

// Mock implementation of Keycloak provider for the application
export const KeycloakProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [username, setUsername] = useState('');
  const [token, setToken] = useState<string | null>(null);

  // Initialize with a mock WORKER if no state
  useEffect(() => {
    // For demonstration purposes, we start with no auth or a default admin
    const savedRole = localStorage.getItem('mock_kc_role') as Role || 'ADMIN';
    const savedUser = localStorage.getItem('mock_kc_user') || 'Admin User';
    
    setRoles([savedRole]);
    setUsername(savedUser);
    setIsAuthenticated(true);
    setToken(`mock-jwt-token-with-${savedRole}-role`);
  }, []);

  const hasRole = (role: Role) => {
    return roles.includes(role) || roles.includes('ADMIN'); // ADMIN has all roles
  };

  const login = (role: Role, name: string) => {
    localStorage.setItem('mock_kc_role', role);
    localStorage.setItem('mock_kc_user', name);
    setRoles([role]);
    setUsername(name);
    setIsAuthenticated(true);
    setToken(`mock-jwt-token-with-${role}-role`);
  };

  const logout = () => {
    localStorage.removeItem('mock_kc_role');
    localStorage.removeItem('mock_kc_user');
    setRoles([]);
    setUsername('');
    setIsAuthenticated(false);
    setToken(null);
  };

  return (
    <KeycloakContext.Provider value={{ isAuthenticated, token, roles, username, hasRole, login, logout }}>
      {children}
    </KeycloakContext.Provider>
  );
};

export const useKeycloak = () => {
  const context = useContext(KeycloakContext);
  if (context === undefined) {
    throw new Error('useKeycloak must be used within a KeycloakProvider');
  }
  return context;
};
