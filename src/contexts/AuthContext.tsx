import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';

interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  balance: number;
  penalty_credit: number;
  is_banned: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isBlocked: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

const ADMIN_EMAIL = 'admin@vuangala.tv';

// Build a minimal user from session so we NEVER lose the logged-in state
function buildUserFromSession(supabaseUser: SupabaseUser): AppUser {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    full_name: supabaseUser.user_metadata?.full_name || null,
    is_admin: supabaseUser.email === ADMIN_EMAIL,
    balance: 0,
    penalty_credit: 100,
    is_banned: false,
  };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAndSetProfile = async (supabaseUser: SupabaseUser, attempts = 0) => {
    // Immediately set user from session so the app never shows login page for a logged-in user
    setUser(buildUserFromSession(supabaseUser));

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, is_admin, balance')
        .eq('id', supabaseUser.id)
        .single();

      if (!error && data) {
        // Profile found, update with real data
        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email || '',
          full_name: data.full_name,
          is_admin: data.is_admin || supabaseUser.email === ADMIN_EMAIL,
          balance: parseFloat(data.balance || 0),
          penalty_credit: 100,
          is_banned: false,
        });
        console.log('[Auth] Profile loaded successfully.');
        return;
      }

      // Profile not found yet (trigger might be slow), retry up to 5 times
      if (attempts < 5) {
        console.warn(`[Auth] Profile not found, retry ${attempts + 1}/5 in 1s...`);
        setTimeout(() => fetchAndSetProfile(supabaseUser, attempts + 1), 1000);
        return;
      }

      // Final fallback: create the profile ourselves
      console.warn('[Auth] Creating profile as final fallback...');
      const { data: created } = await supabase
        .from('profiles')
        .upsert({
          id: supabaseUser.id,
          full_name: supabaseUser.user_metadata?.full_name || '',
          is_admin: supabaseUser.email === ADMIN_EMAIL,
          balance: 0,
          penalty_credit: 100,
          is_banned: false,
        }, { onConflict: 'id' })
        .select('id, full_name, is_admin, balance')
        .single();

      if (created) {
        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email || '',
          full_name: created.full_name,
          is_admin: created.is_admin || supabaseUser.email === ADMIN_EMAIL,
          balance: parseFloat(created.balance || 0),
          penalty_credit: 100,
          is_banned: false,
        });
      }
    } catch (err) {
      console.error('[Auth] Error fetching profile:', err);
      // Keep the session-based user, don't null it out
    }
  };

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await fetchAndSetProfile(session.user);
    }
  };

  useEffect(() => {
    let mounted = true;

    const handleSession = async (session: Session | null) => {
      if (!mounted) return;
      if (session?.user) {
        setLoading(true);
        await fetchAndSetProfile(session.user);
        if (mounted) setLoading(false);
      } else {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      }
    };

    // Get current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    // Listen to all subsequent changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[Auth] State change:', _event, session?.user?.email);
      handleSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('[Auth] Login error:', error.message);
      return { success: false, error: 'Email ou senha inválidos. Verifique os dados e tente novamente.' };
    }
  };

  const register = async (email: string, password: string, fullName: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('[Auth] Register error:', error.message);
      // Traduzir erros comuns do Supabase
      let errorMessage = error.message;
      if (error.message.includes('User already registered')) {
        errorMessage = 'Este email já está registado. Tente fazer login.';
      } else if (error.message.includes('Password')) {
        errorMessage = 'A senha deve ter pelo menos 6 caracteres.';
      } else if (error.message.includes('email')) {
        errorMessage = 'Por favor, insira um email válido.';
      }
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const isBlocked = user ? (user.penalty_credit <= 20 || user.is_banned) : false;

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshProfile, isBlocked }}>
      {children}
    </AuthContext.Provider>
  );
};
