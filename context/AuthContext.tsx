import { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

// ── 6-hour session cap (Defect #1) ──────────────────────────────────
const SESSION_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours
const SESSION_START_KEY = 'ftc_session_start';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  /**
   * True between clicking a password-reset link and finishing (or abandoning)
   * the reset. The recovery session is a real session, so without this flag the
   * root redirect would drop the user into the app instead of the reset screen.
   */
  isRecovering: boolean;
  endRecovery: () => void;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  isRecovering: false,
  endRecovery: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecovering, setIsRecovering] = useState(false);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Schedule the forced sign-out ──
  function scheduleAutoLogout(delay: number) {
    clearAutoLogout();
    if (delay <= 0) {
      forceSignOut();
      return;
    }
    logoutTimer.current = setTimeout(forceSignOut, delay);
  }

  function clearAutoLogout() {
    if (logoutTimer.current) {
      clearTimeout(logoutTimer.current);
      logoutTimer.current = null;
    }
  }

  async function forceSignOut() {
    await supabase.auth.signOut();
    await AsyncStorage.removeItem(SESSION_START_KEY);
    setSession(null);
    clearAutoLogout();
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data.session) {
        // Check whether the stored session has exceeded 6 hours.
        const storedStart = await AsyncStorage.getItem(SESSION_START_KEY);
        if (storedStart) {
          const elapsed = Date.now() - parseInt(storedStart, 10);
          if (elapsed >= SESSION_DURATION_MS) {
            await forceSignOut();
            setLoading(false);
            return;
          }
          scheduleAutoLogout(SESSION_DURATION_MS - elapsed);
        } else {
          // No start recorded (e.g. first launch with a persisted session).
          await AsyncStorage.setItem(SESSION_START_KEY, String(Date.now()));
          scheduleAutoLogout(SESSION_DURATION_MS);
        }
      }

      setSession(data.session);
      setLoading(false);
    })();

    // ── Keep session state in sync with auth events ──
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);

        if (event === 'PASSWORD_RECOVERY') {
          // Recovery session: hold the user on the reset screen rather than
          // letting the root redirect treat this as a normal login.
          setIsRecovering(true);
        } else if (event === 'SIGNED_IN' && newSession) {
          await AsyncStorage.setItem(SESSION_START_KEY, String(Date.now()));
          scheduleAutoLogout(SESSION_DURATION_MS);
        } else if (event === 'SIGNED_OUT') {
          await AsyncStorage.removeItem(SESSION_START_KEY);
          clearAutoLogout();
          setIsRecovering(false);
        }
      }
    );

    return () => {
      mounted = false;
      clearAutoLogout();
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, loading, isRecovering, endRecovery: () => setIsRecovering(false) }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}