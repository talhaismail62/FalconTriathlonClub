import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function AppLayout() {
  const { session, loading } = useAuth();

  // Protect the app routes: bounce unauthenticated users to login.
  if (!loading && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
