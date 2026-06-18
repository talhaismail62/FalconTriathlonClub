import { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  /** True while we restore the persisted session on app launch. */
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore any persisted session on launch.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Keep state in sync with sign in / sign out events.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
