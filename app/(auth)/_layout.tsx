import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function AuthLayout() {
  const { session, loading } = useAuth();

  // Authenticated users go straight to the app root (Home tab), not Profile.
  if (!loading && session) {
    return <Redirect href="/(app)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}