import { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

const SESSION_DURATION_MS = 6 * 60 * 60 * 1000;
const SESSION_START_KEY = 'ftc_session_start';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  isRecovering: boolean;
  endRecovery: () => void;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  isRecovering: false,
  endRecovery: () => {},
});

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (error) {
  console.warn('Push notification handler unavailable:', error);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecovering, setIsRecovering] = useState(false);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushTokenRef = useRef<string | null>(null);

  async function registerForPushNotifications(userId: string) {
    if (!Device.isDevice) return;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      const token = (
        await Notifications.getExpoPushTokenAsync({
          projectId: '9dc4271a-acd9-43fb-8270-dce455ba4b4b',
        })
      ).data;

      pushTokenRef.current = token;

      await supabase.from('push_tokens').upsert(
        {
          user_id: userId,
          token: token,
        },
        { onConflict: 'token' }
      );
    } catch (error) {
      console.warn('Push token registration skipped:', error);
    }
  }

  async function unregisterPushNotifications() {
    if (!pushTokenRef.current) return;

    try {
      await supabase.from('push_tokens').delete().eq('token', pushTokenRef.current);
    } catch (error) {
      console.warn('Push token unregister failed:', error);
    } finally {
      pushTokenRef.current = null;
    }
  }

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
    await unregisterPushNotifications();
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
          await AsyncStorage.setItem(SESSION_START_KEY, String(Date.now()));
          scheduleAutoLogout(SESSION_DURATION_MS);
        }
        await registerForPushNotifications(data.session.user.id);
      }

      setSession(data.session);
      setLoading(false);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);

        if (event === 'PASSWORD_RECOVERY') {
          setIsRecovering(true);
        } else if (event === 'SIGNED_IN' && newSession) {
          await AsyncStorage.setItem(SESSION_START_KEY, String(Date.now()));
          scheduleAutoLogout(SESSION_DURATION_MS);
          await registerForPushNotifications(newSession.user.id);
        } else if (event === 'SIGNED_OUT') {
          await unregisterPushNotifications();
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