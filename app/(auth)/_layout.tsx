import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function AuthLayout() {
  const { session, loading } = useAuth();

  // Don't let an already-authenticated user see login/signup.
  if (!loading && session) {
    return <Redirect href="/(app)/profile" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
