import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  isAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => boolean;
  register: (email: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

const ADMIN_EMAIL = 'admin@vuangala.tv';
const ADMIN_PASS = 'root2026';

interface StoredUser {
  id: string;
  email: string;
  password: string;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const users: StoredUser[] = JSON.parse(localStorage.getItem('fv_users') || '[]');
    if (!users.find(u => u.email === ADMIN_EMAIL)) {
      users.push({ id: 'admin-001', email: ADMIN_EMAIL, password: ADMIN_PASS });
      localStorage.setItem('fv_users', JSON.stringify(users));
    }
    const saved = localStorage.getItem('fv_session');
    if (saved) setUser(JSON.parse(saved));
  }, []);

  const login = (email: string, password: string): boolean => {
    const users: StoredUser[] = JSON.parse(localStorage.getItem('fv_users') || '[]');
    const found = users.find(u => u.email === email && u.password === password);
    if (!found) return false;
    const session: User = { id: found.id, email: found.email, isAdmin: found.email === ADMIN_EMAIL };
    setUser(session);
    localStorage.setItem('fv_session', JSON.stringify(session));
    return true;
  };

  const register = (email: string, password: string): boolean => {
    const users: StoredUser[] = JSON.parse(localStorage.getItem('fv_users') || '[]');
    if (users.find(u => u.email === email)) return false;
    const newUser: StoredUser = { id: crypto.randomUUID(), email, password };
    users.push(newUser);
    localStorage.setItem('fv_users', JSON.stringify(users));
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('fv_session');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
